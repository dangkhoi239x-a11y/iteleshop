import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { checked } from "@/lib/data-result";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const admin = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin;

async function myShopId(userId: string) {
  const db = await admin();
  const { data } = await db.from("shops").select("id").eq("owner_id", userId).maybeSingle();
  if (!data) throw new Error("You don't have a shop yet");
  return data.id;
}

const url = z.string().url().max(1000).or(z.literal("")).optional().nullable();

// ---------- Profile ----------
export const updateLanguage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ language: z.enum(["vi", "en", "ru", "zh"]) }).parse(i))
  .handler(async ({ data, context }) => {
    const db = await admin();
    checked(await db.from("profiles").update({ language: data.language }).eq("id", context.userId));
    return { ok: true };
  });

// ---------- Shops ----------
const shopInput = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().max(1000).optional().nullable(),
  category: z.string().max(40).optional().nullable(),
  logo_url: url,
  banner_url: url,
  wallet_address: z.string().max(128).optional().nullable(),
  telegram_channel: z.string().max(100).optional().nullable(),
  affiliate_percent: z.number().min(0).max(50).optional(),
});

export const createShop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => shopInput.extend({ plan: z.enum(["starter", "pro", "enterprise"]).default("starter") }).parse(i))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const base = data.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "shop";
    const slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    const { data: shop, error } = await db
      .from("shops")
      .insert({ name: data.name, description: data.description ?? null, category: data.category ?? null, wallet_address: data.wallet_address ?? null, telegram_channel: data.telegram_channel ?? null, plan: data.plan, affiliate_percent: data.affiliate_percent ?? 5, logo_url: data.logo_url || null, banner_url: data.banner_url || null, owner_id: context.userId, slug })
      .select("id")
      .single();
    if (error) throw new Error(error.code === "23505" ? "You already have a shop" : error.message);
    return shop;
  });

export const updateShop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => shopInput.partial().parse(i))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const id = await myShopId(context.userId);
    const patch = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined).map(([k, v]) => [k, (k === "logo_url" || k === "banner_url") && !v ? null : v]));
    const { error } = await db.from("shops").update(patch as { name?: string }).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateShopBot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ bot_token: z.string().regex(/^\d+:[\w-]{30,}$/).or(z.literal("")).nullable(), notification_chat_id: z.string().regex(/^-?\d+$/).or(z.literal("")).nullable() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const db = await admin();
    const id = await myShopId(context.userId);
    checked(await db.from("shop_bots").upsert({ shop_id: id, bot_token: data.bot_token || null, notification_chat_id: data.notification_chat_id || null, updated_at: new Date().toISOString() }));
    return { ok: true };
  });

export const testShopBot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await admin();
    const id = await myShopId(context.userId);
    const { data } = await db.from("shop_bots").select("*").eq("shop_id", id).maybeSingle();
    if (!data?.bot_token || !data.notification_chat_id) throw new Error("Bot token and chat ID are required");
    const res = await fetch(`https://api.telegram.org/bot${data.bot_token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: data.notification_chat_id, text: "✅ TeleShop: test notification" }),
    });
    if (!res.ok) throw new Error("Telegram rejected the message — check token and chat ID");
    return { ok: true };
  });

// ---------- Products ----------
const productInput = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().max(4000).optional().nullable(),
  price: z.number().positive().max(1e9),
  currency: z.enum(["USDT", "TON"]),
  image_url: url,
  category: z.string().max(40).optional().nullable(),
  stock: z.number().int().min(0).max(1e7),
  status: z.enum(["active", "draft"]).default("active"),
  warranty_type: z.enum(["standard", "none"]).default("standard"),
  escrow_release_days: z.number().int().min(1).max(30).default(3),
  delivery_content: z.string().max(5000).optional().nullable(),
  auto_send_telegram: z.boolean().default(true),
  goods_kind:z.enum(["digital","physical"]).default("digital"),
  buyer_guide: z.string().max(4000).optional().nullable(),
  highlights: z.string().max(2000).optional().nullable(),
  bulk_discounts: z.string().max(500).optional().nullable(),
  buy_x: z.number().int().min(1).max(100).nullable().optional(),
  get_y: z.number().int().min(1).max(100).nullable().optional(),
});

export const saveProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => productInput.extend({ id: z.string().uuid().optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const shopId = await myShopId(context.userId);
    const { id, delivery_content, ...rest } = data;
    // Mỗi dòng trong delivery_content là một mã/link riêng, bán đúng một lần.
    const { parseCodeLines } = await import("@/lib/codes");
    const codes = parseCodeLines(delivery_content);
    const addCodes = async (pid: string) => {
      if (!codes.length) return 0;
      const { error } = await db.from("product_codes").insert(codes.map((content) => ({ product_id: pid, content })));
      if (error) throw new Error(error.message);
      const { count } = await db.from("product_codes").select("id", { count: "exact", head: true }).eq("product_id", pid).eq("status", "available");
      checked(await db.from("products").update({ stock: count ?? 0 }).eq("id", pid));
      return codes.length;
    };
    const row = { ...rest, description: rest.description ?? null, category: rest.category ?? null, image_url: rest.image_url || null, buyer_guide: rest.buyer_guide || null, highlights: rest.highlights || null, bulk_discounts: rest.bulk_discounts || null, buy_x: rest.buy_x && rest.get_y ? rest.buy_x : null, get_y: rest.buy_x && rest.get_y ? rest.get_y : null };
    if (id) {
      const { data: cur } = await db.from("products").select("status, stock").eq("id", id).eq("shop_id", shopId).maybeSingle();
      // Admin-hidden products stay hidden until an admin restores them.
      if (cur?.status === "suspended") (row as { status: string }).status = "suspended";
      const { error } = await db.from("products").update(row).eq("id", id).eq("shop_id", shopId);
      if (error) throw new Error(error.message);
      const added = await addCodes(id);
      if ((added > 0 || (cur?.stock === 0 && rest.stock > 0)) && row.status === "active") {
        void notifyRestockSubscribers(db, id, row.name);
      }
      return { id, added };
    }
    const { data: p, error } = await db.from("products").insert({ ...row, shop_id: shopId }).select("id").single();
    if (error) throw new Error(error.message);
    const added = await addCodes(p.id);
    return { id: p.id, added };
  });

async function notifyRestockSubscribers(db: Awaited<ReturnType<typeof admin>>, productId: string, productName: string) {
  const { data: alerts } = await db.from("restock_alerts").select("id, user_id").eq("product_id", productId).is("notified_at", null).limit(200);
  if (!alerts?.length) return;
  const userIds = alerts.map((a) => a.user_id);
  const { data: profiles } = await db.from("profiles").select("id, telegram_id").in("id", userIds);
  const tgMap = new Map((profiles ?? []).map((p) => [p.id, p.telegram_id]));
  const tok = process.env["TELEGRAM_BOT_TOKEN"];
  const { sendTelegramMessage, escapeHtml } = await import("@/server/telegram.server");
  const { telegramStoreUrl } = await import("@/lib/telegram-start");
  const base = telegramStoreUrl(process.env["TELEGRAM_APP_URL"]).replace(/\/$/, "");
  const sentIds: string[] = [];
  for (const a of alerts) {
    const tid = tgMap.get(a.user_id);
    if (tid && (await sendTelegramMessage(tok, tid, `🔔 <b>${escapeHtml(productName)}</b> đã có hàng trở lại!\n${base}/product/${productId}`))) {
      sentIds.push(a.id);
    }
  }
  if (sentIds.length) await db.from("restock_alerts").update({ notified_at: new Date().toISOString() }).in("id", sentIds);
}

export const subscribeRestockAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ productId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: p } = await db.from("products").select("id, stock, status").eq("id", data.productId).maybeSingle();
    if (!p || p.status !== "active") throw new Error("Product not found");
    if (p.stock > 0) throw new Error("Product is already in stock");
    checked(
      await db
        .from("restock_alerts")
        .upsert({ product_id: data.productId, user_id: context.userId, notified_at: null }, { onConflict: "product_id,user_id" }),
    );
    return { ok: true };
  });

export const removeProductCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const shopId = await myShopId(context.userId);
    const { data: c } = await db.from("product_codes").select("id, product_id, status, products!inner(shop_id)").eq("id", data.id).single();
    if (!c || c.products.shop_id !== shopId) throw new Error("Code not found");
    if (c.status !== "available") throw new Error("Only unsold codes can be removed");
    checked(await db.from("product_codes").delete().eq("id", c.id));
    const { count } = await db.from("product_codes").select("id", { count: "exact", head: true }).eq("product_id", c.product_id).eq("status", "available");
    checked(await db.from("products").update({ stock: count ?? 0 }).eq("id", c.product_id));
    return { ok: true };
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const shopId = await myShopId(context.userId);
    // Products with orders are archived instead of deleted to keep order history.
    const { count } = await db.from("orders").select("id", { count: "exact", head: true }).eq("product_id", data.id);
    if (count) await db.from("products").update({ status: "archived" }).eq("id", data.id).eq("shop_id", shopId);
    else await db.from("products").delete().eq("id", data.id).eq("shop_id", shopId);
    return { ok: true };
  });

export const setFlashSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), flash_sale_price: z.number().positive().nullable(), flash_sale_end: z.string().datetime().nullable() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const db = await admin();
    const shopId = await myShopId(context.userId);
    const { data: p } = await db.from("products").select("price").eq("id", data.id).eq("shop_id", shopId).single();
    if (!p) throw new Error("Product not found");
    if (data.flash_sale_price != null && data.flash_sale_price >= Number(p.price)) throw new Error("Flash sale price must be lower than the regular price");
    if (data.flash_sale_end && new Date(data.flash_sale_end) <= new Date()) throw new Error("End time must be in the future");
    checked(await db.from("products").update({ flash_sale_price: data.flash_sale_price, flash_sale_end: data.flash_sale_end }).eq("id", data.id));
    return { ok: true };
  });

// ---------- Vouchers ----------
export async function checkVoucherAudience(
  db: Awaited<ReturnType<typeof admin>>,
  v: { shop_id: string; audience?: string | null; target_user_id?: string | null },
  userId: string | null,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (v.target_user_id && v.target_user_id !== userId) return { ok: false, reason: "not_yours" };
  const aud = v.audience ?? "all";
  if (aud === "all" || aud === "channel" || aud === "points") return { ok: true };
  if (!userId) return { ok: false, reason: "sign_in_required" };
  const { data: paidOrders } = await db
    .from("orders")
    .select("paid_at")
    .eq("shop_id", v.shop_id)
    .eq("buyer_id", userId)
    .not("paid_at", "is", null)
    .order("paid_at", { ascending: false })
    .limit(1);
  if (aud === "first_time") {
    return (paidOrders?.length ?? 0) === 0 ? { ok: true } : { ok: false, reason: "first_time_only" };
  }
  if (aud === "win_back") {
    const lastPaid = paidOrders?.[0]?.paid_at;
    if (!lastPaid) return { ok: false, reason: "win_back_only" };
    const daysSince = (Date.now() - new Date(lastPaid).getTime()) / 86_400_000;
    return daysSince >= 30 ? { ok: true } : { ok: false, reason: "win_back_only" };
  }
  return { ok: true };
}

export const saveVoucher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,20}$/),
        discount_type: z.enum(["percent", "fixed"]),
        discount_value: z.number().positive(),
        min_order_amount: z.number().min(0).nullable(),
        max_uses: z.number().int().positive().nullable(),
        expires_at: z.string().datetime().nullable(),
        audience: z.enum(["all", "first_time", "win_back", "channel"]).default("all"),
      })
      .refine((v) => v.discount_type !== "percent" || v.discount_value <= 100, "Percent must be ≤ 100")
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const db = await admin();
    const shopId = await myShopId(context.userId);
    const { error } = await db.from("vouchers").insert({ ...data, shop_id: shopId });
    if (error) throw new Error(error.code === "23505" ? "This code already exists" : error.message);
    return { ok: true };
  });

export const toggleVoucher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid(), is_active: z.boolean().optional(), remove: z.boolean().optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const shopId = await myShopId(context.userId);
    if (data.remove) checked(await db.from("vouchers").delete().eq("id", data.id).eq("shop_id", shopId));
    else checked(await db.from("vouchers").update({ is_active: !!data.is_active }).eq("id", data.id).eq("shop_id", shopId));
    return { ok: true };
  });

export const checkVoucher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ shopId: z.string().uuid(), code: z.string().trim().max(20), subtotal: z.number().positive() }).parse(i))
  .handler(async ({ data, context }) => {
    const { voucherDiscount } = await import("@/lib/pricing");
    const db = await admin();
    const v = checked(await db.from("vouchers").select("*").eq("shop_id", data.shopId).eq("code", data.code.toUpperCase()).maybeSingle());
    if (!v) return { ok: false as const, reason: "not_found" };
    const aud = await checkVoucherAudience(db, v, context.userId);
    if (!aud.ok) return aud;
    return voucherDiscount(v, data.subtotal);
  });

export const listShopPublicVouchers = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => z.object({ shopId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const db = await admin();
    const rows = checked(
      await db
        .from("vouchers")
        .select("id, code, discount_type, discount_value, min_order_amount, max_uses, used_count, expires_at, audience")
        .eq("shop_id", data.shopId)
        .eq("is_active", true)
        .in("audience", ["all", "first_time", "win_back"])
        .order("discount_value", { ascending: false })
        .limit(20),
    );
    const now = Date.now();
    return (rows ?? []).filter(
      (v) =>
        (!v.expires_at || new Date(v.expires_at).getTime() > now) &&
        (v.max_uses == null || v.used_count < v.max_uses),
    );
  });

// ---------- Affiliate / KOL ----------
export const joinAffiliate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ kol: z.boolean().default(false), channel_url: z.string().max(200).optional().nullable(), audience_size: z.number().int().min(0).optional().nullable(), niche: z.string().max(60).optional().nullable() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const db = await admin();
    const tier = data.kol ? ((data.audience_size ?? 0) >= 50000 ? "kol_gold" : "kol") : "standard";
    checked(await db.from("affiliates").upsert({ user_id: context.userId, tier, channel_url: data.channel_url ?? null, audience_size: data.audience_size ?? null, niche: data.niche ?? null }));
    return { ok: true, tier };
  });

export const getAffiliateStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await admin();
    const { count: referrals } = await db.from("profiles").select("id", { count: "exact", head: true }).eq("referred_by", context.userId);
    const { data: pending } = await db.from("orders").select("total_amount, affiliate_percent, currency").eq("affiliate_user_id", context.userId).eq("escrow_status", "holding");
    const pendingAmount = (pending ?? []).reduce((s, o) => s + (Number(o.total_amount) * Number(o.affiliate_percent)) / 100, 0);
    return { referrals: referrals ?? 0, pendingAmount };
  });

/** Sends a voucher to the shop's past buyers via the platform bot and to the shop's own channel/chat. */
export const broadcastVoucher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid(), message: z.string().max(500).optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const shopId = await myShopId(context.userId);
    const { data: v } = await db.from("vouchers").select("*, shops(name, telegram_channel)").eq("id", data.id).eq("shop_id", shopId).single();
    if (!v || !v.is_active) throw new Error("Voucher is not active");
    if (v.last_broadcast_at && Date.now() - new Date(v.last_broadcast_at).getTime() < 6 * 3600e3) throw new Error("This voucher was sent less than 6 hours ago");
    const { sendTelegramMessage, escapeHtml } = await import("@/server/telegram.server");
    const off = v.discount_type === "percent" ? `${Number(v.discount_value)}%` : `${Number(v.discount_value)}`;
    const tag = v.audience === "channel" ? "🔒 Channel Promo · " : "";
    const text = `🎟 ${tag}<b>${escapeHtml(v.shops?.name ?? "Shop")}</b> — voucher <code>${v.code}</code> (−${off})${v.expires_at ? `\n⏰ ${new Date(v.expires_at).toISOString().slice(0, 10)}` : ""}${data.message ? `\n\n${escapeHtml(data.message)}` : ""}`;
    const tok = process.env["TELEGRAM_BOT_TOKEN"];
    let sent = 0;
    if (v.audience !== "channel") {
      const { data: orders } = await db.from("orders").select("buyer_id").eq("shop_id", shopId).not("paid_at", "is", null).limit(2000);
      const ids = [...new Set((orders ?? []).map((o) => o.buyer_id))].slice(0, 500);
      const { data: buyers } = ids.length ? await db.from("profiles").select("telegram_id").in("id", ids) : { data: [] };
      for (const b of buyers ?? []) { if (b.telegram_id && await sendTelegramMessage(tok, b.telegram_id, text)) sent++; }
    }
    const { data: bot } = await db.from("shop_bots").select("*").eq("shop_id", shopId).maybeSingle();
    if (bot?.bot_token && bot?.notification_chat_id && await sendTelegramMessage(bot.bot_token, bot.notification_chat_id, text)) sent++;
    else if (v.audience === "channel" && v.shops?.telegram_channel) {
      const ch = v.shops.telegram_channel.startsWith("@") ? v.shops.telegram_channel : `@${v.shops.telegram_channel.replace(/^https?:\/\/t\.me\//i, "")}`;
      if (await sendTelegramMessage(tok, ch, text)) sent++;
    }
    checked(await db.from("vouchers").update({ last_broadcast_at: new Date().toISOString() }).eq("id", v.id));
    return { sent };
  });
