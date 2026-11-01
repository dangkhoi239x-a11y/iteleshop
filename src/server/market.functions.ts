import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
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
    await db.from("profiles").update({ language: data.language }).eq("id", context.userId);
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
      .insert({ ...data, logo_url: data.logo_url || null, banner_url: data.banner_url || null, owner_id: context.userId, slug })
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
    const patch = { ...data } as Record<string, unknown>;
    if ("logo_url" in patch) patch.logo_url = patch.logo_url || null;
    if ("banner_url" in patch) patch.banner_url = patch.banner_url || null;
    const { error } = await db.from("shops").update(patch).eq("id", id);
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
    await db.from("shop_bots").upsert({ shop_id: id, bot_token: data.bot_token || null, notification_chat_id: data.notification_chat_id || null, updated_at: new Date().toISOString() });
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
});

export const saveProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => productInput.extend({ id: z.string().uuid().optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const shopId = await myShopId(context.userId);
    const { id, ...rest } = data;
    const row = { ...rest, image_url: rest.image_url || null };
    if (id) {
      const { error } = await db.from("products").update(row).eq("id", id).eq("shop_id", shopId);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: p, error } = await db.from("products").insert({ ...row, shop_id: shopId }).select("id").single();
    if (error) throw new Error(error.message);
    return p;
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
    await db.from("products").update({ flash_sale_price: data.flash_sale_price, flash_sale_end: data.flash_sale_end }).eq("id", data.id);
    return { ok: true };
  });

// ---------- Vouchers ----------
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
    if (data.remove) await db.from("vouchers").delete().eq("id", data.id).eq("shop_id", shopId);
    else await db.from("vouchers").update({ is_active: !!data.is_active }).eq("id", data.id).eq("shop_id", shopId);
    return { ok: true };
  });

export const checkVoucher = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ shopId: z.string().uuid(), code: z.string().trim().max(20), subtotal: z.number().positive() }).parse(i))
  .handler(async ({ data }) => {
    const { voucherDiscount } = await import("@/lib/pricing");
    const db = await admin();
    const { data: v } = await db.from("vouchers").select("*").eq("shop_id", data.shopId).eq("code", data.code.toUpperCase()).maybeSingle();
    if (!v) return { ok: false as const, reason: "not_found" };
    return voucherDiscount(v, data.subtotal);
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
    await db.from("affiliates").upsert({ user_id: context.userId, tier, channel_url: data.channel_url ?? null, audience_size: data.audience_size ?? null, niche: data.niche ?? null });
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
