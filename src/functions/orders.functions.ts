import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const admin = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin;

function requestOrigin() {
  const req = getRequest();
  const h = req.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : new URL(req.url).origin;
}

async function attachInvoice(orderId: string) {
  const db = await admin();
  const { data: o } = await db.from("orders").select("*").eq("id", orderId).single();
  if (!o) throw new Error("Order not found");
  const { createInvoice } = await import("@/server/nowpayments.server");
  const inv = await createInvoice({
    orderId: o.id,
    amount: Number(o.total_amount),
    currency: o.currency as "USDT" | "TON",
    description: `TeleShop #${o.order_number} – ${o.product_name} x${o.quantity}`,
    origin: requestOrigin(),
  });
  await db.from("orders").update({ invoice_id: inv.invoiceId, invoice_url: inv.invoiceUrl, payment_status: "waiting" }).eq("id", o.id);
  return inv.invoiceUrl;
}

export const createOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        productId: z.string().uuid(),
        quantity: z.number().int().min(1).max(100),
        voucherCode: z.string().trim().max(20).optional().nullable(),
        deliveryAddress: z.string().max(500).optional().nullable(),
        note: z.string().max(500).optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { effectivePrice, voucherDiscount, commissionPercent, round6, parseBulkTiers, bulkPercent } = await import("@/lib/pricing");
    const db = await admin();
    const { data: p } = await db.from("products").select("*, shops!inner(id, owner_id, status, affiliate_percent)").eq("id", data.productId).single();
    if (!p || p.status !== "active" || p.shops.status !== "active") throw new Error("Product is not available");
    if (p.shops.owner_id === context.userId) throw new Error("You cannot buy from your own shop");
    if (p.stock < data.quantity) throw new Error("Not enough stock");

    const unit = effectivePrice(p);
    const gross = round6(unit * data.quantity);
    const bulkOff = round6((gross * bulkPercent(parseBulkTiers(p.bulk_discounts), data.quantity)) / 100);
    const subtotal = round6(gross - bulkOff);
    let discount = 0;
    let voucherCode: string | null = null;
    if (data.voucherCode) {
      const { data: v } = await db.from("vouchers").select("*").eq("shop_id", p.shop_id).eq("code", data.voucherCode.toUpperCase()).maybeSingle();
      if (!v) throw new Error("Voucher not found");
      const r = voucherDiscount(v, subtotal);
      if (!r.ok) throw new Error(`Voucher not valid (${r.reason})`);
      discount = r.discount;
      voucherCode = v.code;
    }
    discount = round6(discount + bulkOff);
    const total = round6(gross - discount);
    if (total <= 0) throw new Error("Order total must be positive");
    const { data: tiers } = await db.from("commission_tiers").select("*");
    const cp = commissionPercent(tiers ?? [], total);

    let affiliateUser: string | null = null;
    const { data: me } = await db.from("profiles").select("referred_by").eq("id", context.userId).single();
    if (me?.referred_by && me.referred_by !== p.shops.owner_id) {
      const { data: aff } = await db.from("affiliates").select("user_id, status").eq("user_id", me.referred_by).maybeSingle();
      if (aff?.status === "active") affiliateUser = aff.user_id;
    }

    const { data: order, error } = await db
      .from("orders")
      .insert({
        buyer_id: context.userId, shop_id: p.shop_id, product_id: p.id, product_name: p.name, product_image: p.image_url,
        quantity: data.quantity, unit_price: unit, subtotal: gross, discount_amount: discount, total_amount: total, currency: p.currency,
        warranty_type: p.warranty_type, escrow_release_days: p.escrow_release_days, commission_percent: cp,
        commission_amount: round6((total * cp) / 100), affiliate_user_id: affiliateUser,
        affiliate_percent: affiliateUser ? Number(p.shops.affiliate_percent) : 0,
        delivery_address: data.deliveryAddress ?? null, note: data.note ?? null, voucher_code: voucherCode,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    try {
      return { orderId: order.id, invoiceUrl: await attachInvoice(order.id) };
    } catch (e) {
      return { orderId: order.id, invoiceUrl: null, paymentError: (e as Error).message };
    }
  });

export const payOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ orderId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: o } = await db.from("orders").select("buyer_id, status, invoice_url").eq("id", data.orderId).single();
    if (!o || o.buyer_id !== context.userId) throw new Error("Order not found");
    if (o.status !== "awaiting_payment") throw new Error("This order is not awaiting payment");
    return { invoiceUrl: o.invoice_url ?? (await attachInvoice(data.orderId)) };
  });

/** Seller: paid → shipped → delivered. Buyer: confirm receipt (releases escrow) or cancel unpaid. */
export const updateOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ orderId: z.string().uuid(), action: z.enum(["ship", "deliver", "confirm", "cancel"]), tracking: z.string().max(300).optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: o } = await db.from("orders").select("*, shops!inner(owner_id)").eq("id", data.orderId).single();
    if (!o) throw new Error("Order not found");
    const isSeller = o.shops.owner_id === context.userId;
    const isBuyer = o.buyer_id === context.userId;
    const now = new Date().toISOString();
    if (data.action === "ship" && isSeller && o.status === "paid") {
      await db.from("orders").update({ status: "shipped", tracking_info: data.tracking ?? null, updated_at: now }).eq("id", o.id);
    } else if (data.action === "deliver" && isSeller && o.status === "shipped") {
      await db.from("orders").update({ status: "delivered", updated_at: now }).eq("id", o.id);
    } else if (data.action === "confirm" && isBuyer && ["paid", "shipped", "delivered"].includes(o.status)) {
      await db.rpc("release_order_escrow", { _order_id: o.id });
    } else if (data.action === "cancel" && isBuyer && o.status === "awaiting_payment") {
      await db.from("orders").update({ status: "cancelled", updated_at: now }).eq("id", o.id);
    } else {
      throw new Error("This action is not allowed for this order");
    }
    if (isSeller) {
      const { data: buyer } = await db.from("profiles").select("telegram_id").eq("id", o.buyer_id).single();
      const { sendTelegramMessage, escapeHtml } = await import("@/server/telegram.server");
      await sendTelegramMessage(process.env["TELEGRAM_BOT_TOKEN"], buyer?.telegram_id, `📦 Order #${o.order_number} (${escapeHtml(o.product_name)}) is now <b>${data.action === "ship" ? "shipped" : "delivered"}</b>.${data.tracking ? `\n${escapeHtml(data.tracking)}` : ""}`);
    }
    return { ok: true };
  });

/** Buyer: gửi lại mã/link đã mua qua Telegram khi lỡ mất tin nhắn. */
export const resendDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ orderId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: o } = await db.from("orders").select("buyer_id, order_number, delivered_content").eq("id", data.orderId).single();
    if (!o || o.buyer_id !== context.userId) throw new Error("Order not found");
    if (!o.delivered_content) throw new Error("This order has no digital item yet");
    const { data: buyer } = await db.from("profiles").select("telegram_id").eq("id", context.userId).single();
    if (!buyer?.telegram_id) throw new Error("No linked Telegram account — copy the code from this page instead");
    const { sendTelegramMessage, escapeHtml } = await import("@/server/telegram.server");
    await sendTelegramMessage(process.env["TELEGRAM_BOT_TOKEN"], buyer.telegram_id, `🎁 Your item (#${o.order_number}):\n<code>${escapeHtml(o.delivered_content)}</code>`);
    return { ok: true };
  });

export const openDispute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ orderId: z.string().uuid(), reason: z.string().min(2).max(60), note: z.string().min(10).max(2000) }).parse(i))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: o } = await db.from("orders").select("*").eq("id", data.orderId).single();
    if (!o || o.buyer_id !== context.userId) throw new Error("Order not found");
    if (o.escrow_status !== "holding") throw new Error("Disputes can only be opened while funds are in escrow");
    const { error } = await db.from("disputes").insert({ order_id: o.id, opened_by: context.userId, reason: data.reason, buyer_note: data.note });
    if (error) throw new Error(error.code === "23505" ? "A dispute already exists for this order" : error.message);
    await db.from("orders").update({ status: "disputed", escrow_status: "frozen", updated_at: new Date().toISOString() }).eq("id", o.id);
    return { ok: true };
  });

export const respondDispute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ disputeId: z.string().uuid(), note: z.string().min(2).max(2000) }).parse(i))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: d } = await db.from("disputes").select("*, orders!inner(shop_id, shops!inner(owner_id))").eq("id", data.disputeId).single();
    if (!d || d.orders.shops.owner_id !== context.userId) throw new Error("Not allowed");
    await db.from("disputes").update({ seller_note: data.note }).eq("id", d.id);
    return { ok: true };
  });

/** Auto-release: no-warranty orders after their release date; delivered orders after 7 days without buyer action. */
export async function releaseDueEscrows() {
  const db = await admin();
  const now = new Date();
  const week = new Date(now.getTime() - 7 * 86400000).toISOString();
  const { data: a } = await db.from("orders").select("id").eq("escrow_status", "holding").eq("warranty_type", "none").lte("escrow_release_at", now.toISOString()).limit(200);
  const { data: b } = await db.from("orders").select("id").eq("escrow_status", "holding").eq("status", "delivered").lte("updated_at", week).limit(200);
  for (const o of [...(a ?? []), ...(b ?? [])]) await db.rpc("release_order_escrow", { _order_id: o.id });
}

export const getWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await releaseDueEscrows();
    const db = await admin();
    const { data: txs } = await db.from("wallet_transactions").select("*").eq("user_id", context.userId).order("created_at", { ascending: false }).limit(200);
    const balances: Record<string, { available: number; pendingWithdraw: number; escrow: number }> = { USDT: { available: 0, pendingWithdraw: 0, escrow: 0 }, TON: { available: 0, pendingWithdraw: 0, escrow: 0 } };
    const { data: all } = await db.from("wallet_transactions").select("amount, currency, status").eq("user_id", context.userId).neq("status", "rejected");
    for (const t of all ?? []) {
      const b = (balances[t.currency] ??= { available: 0, pendingWithdraw: 0, escrow: 0 });
      b.available += Number(t.amount);
      if (t.status === "pending") b.pendingWithdraw += -Number(t.amount);
    }
    const { data: shop } = await db.from("shops").select("id").eq("owner_id", context.userId).maybeSingle();
    if (shop) {
      const { data: held } = await db.from("orders").select("total_amount, commission_amount, affiliate_percent, currency").eq("shop_id", shop.id).in("escrow_status", ["holding", "frozen"]);
      for (const o of held ?? []) {
        const net = Number(o.total_amount) - Number(o.commission_amount) - (Number(o.total_amount) * Number(o.affiliate_percent)) / 100;
        (balances[o.currency] ??= { available: 0, pendingWithdraw: 0, escrow: 0 }).escrow += net;
      }
    }
    return { balances, transactions: txs ?? [] };
  });

export const requestWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ amount: z.number().min(1), currency: z.enum(["USDT", "TON"]), address: z.string().trim().min(20).max(128) }).parse(i))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { error } = await db.rpc("request_withdrawal", { _user_id: context.userId, _amount: data.amount, _currency: data.currency, _address: data.address });
    if (error) throw new Error(error.message.includes("Insufficient") ? "Insufficient balance" : error.message);
    return { ok: true };
  });
