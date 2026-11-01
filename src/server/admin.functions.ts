import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const adminMw = [requireSupabaseAuth] as const;

async function assertAdmin(ctx: { supabase: { rpc: (...a: never[]) => unknown }; userId: string }) {
  const sb = ctx.supabase as unknown as { rpc: (fn: string, args: object) => Promise<{ data: boolean | null }> };
  const { data } = await sb.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

export const adminOverview = createServerFn({ method: "POST" })
  .middleware([...adminMw])
  .handler(async ({ context }) => {
    const db = await assertAdmin(context);
    const [users, shops, orders, paid] = await Promise.all([
      db.from("profiles").select("id", { count: "exact", head: true }),
      db.from("shops").select("id, name, status, total_sales, created_at").order("created_at", { ascending: false }).limit(100),
      db.from("orders").select("id", { count: "exact", head: true }),
      db.from("orders").select("total_amount, commission_amount, currency").in("escrow_status", ["holding", "released", "frozen"]),
    ]);
    const volume: Record<string, number> = {};
    const fees: Record<string, number> = {};
    for (const o of paid.data ?? []) {
      volume[o.currency] = (volume[o.currency] ?? 0) + Number(o.total_amount);
      fees[o.currency] = (fees[o.currency] ?? 0) + Number(o.commission_amount);
    }
    const { data: withdrawals } = await db.from("wallet_transactions").select("*").eq("type", "withdrawal").eq("status", "pending").order("created_at");
    const { data: disputes } = await db.from("disputes").select("*, orders(order_number, product_name, total_amount, currency)").eq("status", "open").order("created_at");
    return { users: users.count ?? 0, orders: orders.count ?? 0, shops: shops.data ?? [], volume, fees, withdrawals: withdrawals ?? [], disputes: disputes ?? [] };
  });

export const adminWithdrawal = createServerFn({ method: "POST" })
  .middleware([...adminMw])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid(), approve: z.boolean(), txHash: z.string().max(200).optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const db = await assertAdmin(context);
    await db.from("wallet_transactions").update({ status: data.approve ? "completed" : "rejected", tx_hash: data.txHash ?? null }).eq("id", data.id).eq("status", "pending");
    return { ok: true };
  });

export const adminResolveDispute = createServerFn({ method: "POST" })
  .middleware([...adminMw])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid(), outcome: z.enum(["refund", "release"]), note: z.string().max(2000).optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const db = await assertAdmin(context);
    const { data: d } = await db.from("disputes").select("order_id, status").eq("id", data.id).single();
    if (!d || d.status !== "open") throw new Error("Dispute is not open");
    if (data.outcome === "refund") await db.rpc("refund_order_escrow", { _order_id: d.order_id });
    else {
      await db.from("orders").update({ escrow_status: "holding" }).eq("id", d.order_id).eq("escrow_status", "frozen");
      await db.rpc("release_order_escrow", { _order_id: d.order_id });
    }
    await db.from("disputes").update({ status: data.outcome === "refund" ? "resolved_refund" : "resolved_release", admin_note: data.note ?? null, resolved_at: new Date().toISOString() }).eq("id", data.id);
    return { ok: true };
  });

export const adminShopStatus = createServerFn({ method: "POST" })
  .middleware([...adminMw])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid(), status: z.enum(["active", "suspended"]) }).parse(i))
  .handler(async ({ data, context }) => {
    const db = await assertAdmin(context);
    await db.from("shops").update({ status: data.status }).eq("id", data.id);
    return { ok: true };
  });

export const adminSaveTier = createServerFn({ method: "POST" })
  .middleware([...adminMw])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid().optional(), min_order_amount: z.number().min(0), max_order_amount: z.number().positive().nullable(), commission_percent: z.number().min(0).max(50), remove: z.boolean().optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const db = await assertAdmin(context);
    const { id, remove, ...row } = data;
    if (id && remove) await db.from("commission_tiers").delete().eq("id", id);
    else if (id) await db.from("commission_tiers").update(row).eq("id", id);
    else await db.from("commission_tiers").insert(row);
    return { ok: true };
  });
