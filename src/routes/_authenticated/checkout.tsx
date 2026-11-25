import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Minus, Plus, ShieldCheck } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, Field, PageHeader, errMsg } from "@/components/app/ui-bits";
import { productQuery, platformSettingsQuery } from "@/lib/queries";
import { freeUnits, orderQuote, starsFor } from "@/lib/pricing";
import { openStarsInvoice } from "@/lib/telegram";
import { money } from "@/lib/format";
import { checkVoucher, listShopPublicVouchers } from "@/functions/market.functions";
import { createOrder } from "@/functions/orders.functions";
import { haptic, openExternal } from "@/lib/telegram";
import { storefrontText } from "@/locales/storefront";

export const Route = createFileRoute("/_authenticated/checkout")({
  validateSearch: z.object({ productId: z.string(), quantity: z.coerce.number().int().min(1).max(100).optional() }),
  head: () => ({ meta: [{ title: "Checkout · TeleShop" }, { name: "description", content: "Pay with Telegram Stars or supported crypto on TeleShop." }, { property: "og:title", content: "Checkout · TeleShop" }, { property: "og:description", content: "Telegram Stars checkout and supported crypto." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Checkout,
});

function Checkout() {
  const { t, i18n } = useTranslation();
  const text = storefrontText(i18n.language);
  const { productId, quantity } = Route.useSearch();
  const nav = useNavigate();
  const { data: p } = useQuery(productQuery(productId));
  const check = useServerFn(checkVoucher);
  const fetchVouchers = useServerFn(listShopPublicVouchers);
  const create = useServerFn(createOrder);
  const [qty, setQty] = useState(quantity ?? 1);
  const { data: settings, error: settingsError } = useQuery(platformSettingsQuery());
  const { data: shopVouchers = [] } = useQuery({
    queryKey: ["shopPublicVouchers", p?.shop_id],
    queryFn: () => fetchVouchers({ data: { shopId: p!.shop_id } }),
    enabled: !!p?.shop_id,
  });
  const [method, setMethod] = useState<"crypto" | "stars" | null>(null);
  const payMethod = p?.goods_kind === "digital" ? "stars" : method ?? (settings && !settings.crypto_enabled ? "stars" : "crypto");
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState<{ code: string; discount: number } | null>(null);
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  if (settingsError) return <EmptyState title={errMsg(settingsError)} />;
  if (!p) return <EmptyState title={t("common.loading")} />;
  const {unit,gross,bulkOff,subtotal,total:beforeVoucher} = orderQuote(p,qty);
  const discount = applied ? Math.min(applied.discount, subtotal) : 0;
  const total = beforeVoucher-discount;
  const changeQty = (next:number) => { setQty(Math.min(100,Math.max(1,next))); setApplied(null); };
  const free = freeUnits(qty, p.buy_x, p.get_y);
  const stars = settings ? starsFor(total, p.currency, settings) : 0;

  const applyCode = async (rawCode: string) => {
    const trimmed = rawCode.trim().toUpperCase();
    if (!trimmed || !p) return;
    setCode(trimmed);
    try {
      const r = await check({ data: { shopId: p.shop_id, code: trimmed, subtotal } });
      if (r.ok) {
        setApplied({ code: trimmed, discount: r.discount });
        toast.success(t("checkout.voucherOk", { amount: money(r.discount, p.currency) }));
      } else {
        setApplied(null);
        toast.error(t("checkout.voucherInvalid"));
      }
    } catch (e) {
      toast.error(errMsg(e));
    }
  };
  const apply = () => applyCode(code);

  const pay = async () => {
    setBusy(true);
    try {
      const r = await create({ data: { productId: p.id, quantity: qty, voucherCode: applied?.code ?? null, deliveryAddress: address || null, note: note || null, payMethod } });
      haptic("success");
      if (r.invoiceUrl && payMethod === "stars") openStarsInvoice(r.invoiceUrl);
      else if (r.invoiceUrl) openExternal(r.invoiceUrl);
      else toast.error(t("checkout.paymentErr", { msg: r.paymentError }));
      await nav({ to: "/orders/$orderId", params: { orderId: r.orderId } });
    } catch (e) {
      haptic("error");
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pb-28">
      <PageHeader title={t("checkout.title")} />
      <div className="space-y-5 p-4">
        <div className="flex gap-3 rounded-2xl border border-border bg-card p-3">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted">{p.image_url && <img src={p.image_url} alt="" className="h-full w-full object-cover" />}</div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-sm font-medium">{p.name}</p>
            <p className="tabular mt-1 font-bold text-primary">{money(unit, p.currency)}</p>
          </div>
        </div>
        <Field label={t("checkout.quantity")}>
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="icon" onClick={() => changeQty(qty-1)}><Minus /></Button>
            <span className="tabular w-8 text-center font-display text-lg font-bold">{qty}</span>
            <Button variant="secondary" size="icon" onClick={() => changeQty(qty+1)} disabled={qty >= 100 || qty + 1 + freeUnits(qty + 1, p.buy_x, p.get_y) > p.stock}><Plus /></Button>
          </div>
        </Field>
        {free > 0 && <p className="rounded-xl bg-success/10 p-2 text-sm text-success">{t("extra.freeGot", { n: free })}</p>}
        {p.goods_kind !== "digital" && settings?.stars_enabled && settings.crypto_enabled && (
          <Field label={t("extra.payMethod")}>
            <div className="grid grid-cols-2 gap-2">
              <Button variant={payMethod === "crypto" ? "default" : "secondary"} onClick={() => setMethod("crypto")}>{t("extra.payCrypto")}</Button>
              <Button variant={payMethod === "stars" ? "default" : "secondary"} onClick={() => setMethod("stars")}>⭐ Telegram Stars</Button>
            </div>
          </Field>
        )}
        <Field label={t("checkout.voucher")}>
          <div className="flex gap-2">
            <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="SALE10" className="uppercase" />
            <Button variant="secondary" onClick={apply}>{t("checkout.apply")}</Button>
          </div>
          {shopVouchers.length > 0 && (
            <div className="mt-2 space-y-1.5">
              <p className="text-[11px] text-muted-foreground">{text.availableVouchers}</p>
              <div className="flex flex-wrap gap-1.5">
                {shopVouchers.map((v) => {
                  const minOk = v.min_order_amount == null || subtotal >= Number(v.min_order_amount);
                  const active = applied?.code === v.code;
                  return (
                    <Button
                      key={v.id}
                      type="button"
                      size="sm"
                      variant={active ? "default" : "outline"}
                      disabled={!minOk}
                      className="h-auto px-2.5 py-1 text-[11px]"
                      onClick={() => void applyCode(v.code)}
                    >
                      <span className="font-mono font-semibold">{v.code}</span>
                      <span>· {v.discount_type === "percent" ? `−${Number(v.discount_value)}%` : `−${money(v.discount_value, p.currency)}`}</span>
                      {v.min_order_amount != null && <span className="opacity-75">({text.minSpend} {money(v.min_order_amount, p.currency)})</span>}
                    </Button>
                  );
                })}
              </div>
            </div>
          )}
        </Field>
        {p.goods_kind !== "digital" && (
          <Field label={t("checkout.address")}>
            <Textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t("checkout.addressPh")} rows={2} maxLength={500} />
          </Field>
        )}
        <Field label={`${t("checkout.note")} (${t("common.optional")})`}>
          <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
        </Field>
        <div className="space-y-2 rounded-2xl border border-border bg-card p-4 text-sm">
          <Row k={t("checkout.subtotal")} v={money(gross, p.currency)} />
          {bulkOff > 0 && <Row k={t("extra.bulkTitle")} v={`−${money(bulkOff, p.currency)}`} className="text-success" />}
          {discount > 0 && <Row k={t("checkout.discount")} v={`−${money(discount, p.currency)}`} className="text-success" />}
          <div className="border-t border-border pt-2"><Row k={t("checkout.total")} v={payMethod === "stars" ? `${stars} ⭐ (≈ ${money(total, p.currency)})` : money(total, p.currency)} className="font-display text-base font-bold" /></div>
        </div>
        <p className="flex gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 shrink-0 text-success" />{payMethod === "stars" ? text.starsEscrow : t("checkout.secured")}</p>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t border-border bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <Button size="lg" className="w-full shadow-glow" onClick={pay} disabled={busy || !settings || (payMethod === "stars" ? !settings.stars_enabled : !settings.crypto_enabled) || total<=0}>
          {busy ? <><Loader2 className="animate-spin" /> {t("checkout.processing")}</> : (payMethod === "stars" ? text.payStars.replace("{{n}}", String(stars)) : t("checkout.payNow", {amount:money(total,p.currency)}))}
        </Button>
      </div>
    </div>
  );
}

function Row({ k, v, className }: { k: string; v: string; className?: string }) {
  return <div className={`flex justify-between ${className ?? ""}`}><span className="text-muted-foreground">{k}</span><span className="tabular">{v}</span></div>;
}
