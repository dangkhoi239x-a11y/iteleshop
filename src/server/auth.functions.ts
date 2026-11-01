import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

function randomCode() {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => a[b % a.length]).join("");
}

/**
 * Signs a Telegram Mini App user in. Telegram initData is verified with the bot token,
 * then a Cloud account bound to that Telegram ID is created/reused and a session returned.
 * Outside Telegram, a per-browser demo account (demo_*) can be used for testing.
 */
export const telegramLogin = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ initData: z.string().max(4096).optional(), demoId: z.string().regex(/^[a-z0-9]{12,40}$/).optional(), ref: z.string().max(32).optional() }).parse(i),
  )
  .handler(async ({ data }) => {
    const { validateInitData } = await import("./telegram.server");
    const { hmacHex } = await import("./crypto.server");
    const sessionSecret = process.env["SESSION_SECRET"]!;
    let tg: { id: string; first_name?: string | undefined; last_name?: string | undefined; username?: string | undefined; photo_url?: string | undefined; lang?: string | undefined };
    let ref = data.ref;

    if (data.initData) {
      const bot = process.env["TELEGRAM_BOT_TOKEN"];
      if (!bot) throw new Error("Telegram bot is not configured yet.");
      const v = await validateInitData(data.initData, bot);
      if (!v) throw new Error("Invalid Telegram session. Please reopen the app from Telegram.");
      tg = { id: String(v.user.id), first_name: v.user.first_name, last_name: v.user.last_name, username: v.user.username, photo_url: v.user.photo_url, lang: v.user.language_code };
      if (v.startParam?.startsWith("ref_")) ref = v.startParam.slice(4);
    } else if (data.demoId) {
      tg = { id: `demo_${data.demoId}`, first_name: "Demo", last_name: "User", };
    } else {
      throw new Error("Missing login data");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = `tg_${tg.id}@telegram.teleshop.app`.toLowerCase();
    const password = await hmacHex(sessionSecret, `tg:${tg.id}`);

    const { data: existing } = await supabaseAdmin.from("profiles").select("id").eq("telegram_id", tg.id).maybeSingle();
    let userId = existing?.id;
    if (!userId) {
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { telegram_id: tg.id } });
      if (error || !created.user) throw new Error(error?.message ?? "Could not create account");
      userId = created.user.id;
      let referredBy: string | null = null;
      if (ref) {
        const { data: r } = await supabaseAdmin.from("profiles").select("id").eq("referral_code", ref.toUpperCase()).maybeSingle();
        if (r && r.id !== userId) referredBy = r.id;
      }
      const lang = ["vi", "en", "ru", "zh"].includes(tg.lang?.slice(0, 2) ?? "") ? tg.lang!.slice(0, 2) : "vi";
      await supabaseAdmin.from("profiles").insert({
        id: userId, telegram_id: tg.id, username: tg.username ?? null, first_name: tg.first_name ?? null, last_name: tg.last_name ?? null,
        photo_url: tg.photo_url ?? null, referral_code: randomCode(), referred_by: referredBy, language: lang,
      });
    } else if (data.initData) {
      await supabaseAdmin.from("profiles").update({ username: tg.username ?? null, first_name: tg.first_name ?? null, last_name: tg.last_name ?? null, photo_url: tg.photo_url ?? null }).eq("id", userId);
    }

    const admins = (process.env["ADMIN_TELEGRAM_IDS"] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    if (admins.includes(tg.id)) {
      await supabaseAdmin.from("user_roles").upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
    }

    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const pub = createClient(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });
    const { data: s, error: se } = await pub.auth.signInWithPassword({ email, password });
    if (se || !s.session) throw new Error(se?.message ?? "Sign-in failed");
    return { access_token: s.session.access_token, refresh_token: s.session.refresh_token };
  });
