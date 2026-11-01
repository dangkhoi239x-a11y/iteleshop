import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { drawSchema, taskMet, taskSchema } from "@/lib/rewards";

type Ctx = { supabase: unknown; userId: string };
const admin = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin;

/** Caller may manage platform items (admin) or their own shop's items. */
async function assertManager(ctx: Ctx, shopId: string | null) {
  const sb = ctx.supabase as { rpc: (fn: string, a: object) => Promise<{ data: boolean | null }> };
  const { data: isAdmin } = await sb.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  const db = await admin();
  if (shopId === null) {
    if (!isAdmin) throw new Error("Forbidden");
  } else if (!isAdmin) {
    const { data: s } = await db.from("shops").select("owner_id").eq("id", shopId).maybeSingle();
    if (s?.owner_id !== ctx.userId) throw new Error("Forbidden");
  }
  return db;
}

const PAID = ["paid", "shipped", "delivered", "completed"];

export const dailyCheckin = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const db = await admin();
  const r = await db.rpc("daily_checkin", { _user: context.userId });
  if (r.error) throw new Error(r.error.message);
  return { points: r.data as number };
});

export const claimTask = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ taskId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: t } = await db.from("reward_tasks").select("*").eq("id", data.taskId).eq("is_active", true).maybeSingle();
    if (!t) throw new Error("Task not available");
    let progress = 0;
    if (t.kind === "join_channel") {
      const token = process.env["TELEGRAM_BOT_TOKEN"];
      if (!token) throw new Error("Telegram bot is not configured yet");
      const { data: p } = await db.from("profiles").select("telegram_id").eq("id", context.userId).single();
      if (!p || !/^\d+$/.test(p.telegram_id)) throw new Error("Sign in with Telegram to verify this task");
      const res = await fetch(`https://api.telegram.org/bot${token}/getChatMember?chat_id=${encodeURIComponent(t.target ?? "")}&user_id=${p.telegram_id}`);
      const j = (await res.json()) as { ok: boolean; result?: { status: string } };
      progress = j.ok && ["member", "administrator", "creator", "restricted"].includes(j.result?.status ?? "") ? 1 : 0;
    } else if (t.kind === "invite") {
      const { count } = await db.from("profiles").select("id", { count: "exact", head: true }).eq("referred_by", context.userId);
      progress = count ?? 0;
    } else if (t.kind === "first_purchase" || t.kind === "spend") {
      let q = db.from("orders").select("total_amount").eq("buyer_id", context.userId).in("status", PAID);
      if (t.shop_id) q = q.eq("shop_id", t.shop_id);
      const { data: os } = await q;
      progress = t.kind === "spend" ? (os ?? []).reduce((s, o) => s + Number(o.total_amount), 0) : (os ?? []).length;
    }
    if (!taskMet(t.kind as never, progress, Number(t.target_amount))) throw new Error("Task requirement not met yet");
    const r = await db.rpc("award_task", { _user: context.userId, _task: t.id });
    if (r.error) throw new Error(r.error.code === "23505" ? "Already claimed" : r.error.message);
    return { points: r.data as number };
  });

export const enterDraw = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ drawId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const r = await (await admin()).rpc("enter_draw", { _user: context.userId, _draw: data.drawId });
    if (r.error) throw new Error(r.error.message);
    return { ok: true };
  });

export const saveTask = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => taskSchema.parse(i))
  .handler(async ({ data, context }) => {
    const db = await assertManager(context, data.shopId);
    const r = await db.from("reward_tasks").insert({ shop_id: data.shopId, created_by: context.userId, title: data.title, description: data.description || null, kind: data.kind, target: data.target || null, target_amount: data.targetAmount, link_url: data.linkUrl || null, points: data.points });
    if (r.error) throw new Error(r.error.message);
    return { ok: true };
  });

export const toggleTask = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: t } = await (await admin()).from("reward_tasks").select("shop_id").eq("id", data.id).single();
    if (!t) throw new Error("Not found");
    const db = await assertManager(context, t.shop_id);
    await db.from("reward_tasks").update({ is_active: data.active }).eq("id", data.id);
    return { ok: true };
  });

export const saveDraw = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => drawSchema.parse(i))
  .handler(async ({ data, context }) => {
    const db = await assertManager(context, data.shopId);
    const r = await db.from("lucky_draws").insert({ shop_id: data.shopId, created_by: context.userId, title: data.title, prize: data.prize, image_url: data.imageUrl || null, entry_cost: data.entryCost, max_entries_per_user: data.maxEntries, winners_count: data.winners, starts_at: data.startsAt, ends_at: data.endsAt });
    if (r.error) throw new Error(r.error.message);
    return { ok: true };
  });

export const runDraw = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ drawId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const r = await (await admin()).rpc("run_draw", { _actor: context.userId, _draw: data.drawId });
    if (r.error) throw new Error(r.error.message);
    return { winners: r.data as number };
  });
