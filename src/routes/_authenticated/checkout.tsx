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
import { productQuery } from "@/lib/queries";
import { effectivePrice, round6 } from "@/lib/pricing";
import { money } from "@/lib/format";
import { checkVoucher } from "@/functions/market.functions";
import { createOrder } from "@/functions/orders.functions";
import { haptic, openExternal } from "@/lib/telegram";

export const Route = createFileRoute("/_authenticated/checkout")({
  validateSearch: z.object({ productId: z.string() }),
  head: () => ({ meta: [{ title: "Checkout · TeleShop" }, { name: "description", content: "Pay with crypto on TeleShop." }, { property: "og:title", content: "Checkout · TeleShop" }, { property: "og:description", content: "Pay with crypto." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Checkout,
});

function Checkout() {
  const { t } = useTranslation();
  const { productId } = Route.useSearch();
  const nav = useNavigate();
  const { data: p } = useQuery(productQuery(productId));
  const check = useServerFn(checkVoucher);
  const create = useServerFn(createOrder);
  const [qty, setQty] = useState(1);
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState<{ code: string; discount: number } | null>(null);
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  if (!p) return <EmptyState title={t("common.loading")} />;
  const unit = effectivePrice(p);
  const subtotal = round6(unit * qty);
  const discount = applied ? Math.min(applied.discount, subtotal) : 0;
  const total = round6(subtotal - discount);

  const apply = async () => {
    if (!code.trim()) return;
    try {
      const r = await check({ data: { shopId: p.shop_id, code: code.trim(), subtotal } });
      if (r.ok) {
        setApplied({ code: code.trim().toUpperCase(), discount: r.discount });
        toast.success(t("checkout.voucherOk", { amount: money(r.discount, p.currency) }));
      } else {
        setApplied(null);
        toast.error(t("checkout.voucherInvalid"));
      }
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const pay = async () => {
    setBusy(true);
    try {
      const r = await create({ data: { productId: p.id, quantity: qty, voucherCode: applied?.code ?? null, deliveryAddress: address || null, note: note || null } });
      haptic("success");
      if (r.invoiceUrl) openExternal(r.invoiceUrl);
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
            <Button variant="secondary" size="icon" onClick={() => setQty((q) => Math.max(1, q - 1))}><Minus /></Button>
            <span className="tabular w-8 text-center font-display text-lg font-bold">{qty}</span>
            <Button variant="secondary" size="icon" onClick={() => setQty((q) => Math.min(p.stock, q + 1))} disabled={qty >= p.stock}><Plus /></Button>
          </div>
        </Field>
        <Field label={t("checkout.voucher")}>
          <div className="flex gap-2">
            <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="SALE10" className="uppercase" />
            <Button variant="secondary" onClick={apply}>{t("checkout.apply")}</Button>
          </div>
        </Field>
        <Field label={t("checkout.address")}>
          <Textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t("checkout.addressPh")} rows={2} maxLength={500} />
        </Field>
        <Field label={`${t("checkout.note")} (${t("common.optional")})`}>
          <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
        </Field>
        <div className="space-y-2 rounded-2xl border border-border bg-card p-4 text-sm">
          <Row k={t("checkout.subtotal")} v={money(subtotal, p.currency)} />
          {discount > 0 && <Row k={t("checkout.discount")} v={`−${money(discount, p.currency)}`} className="text-success" />}
          <div className="border-t border-border pt-2"><Row k={t("checkout.total")} v={money(total, p.currency)} className="font-display text-base font-bold" /></div>
        </div>
        <p className="flex gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 shrink-0 text-success" />{t("checkout.secured")}</p>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t border-border bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <Button size="lg" className="w-full shadow-glow" onClick={pay} disabled={busy}>
          {busy ? <><Loader2 className="animate-spin" /> {t("checkout.processing")}</> : t("checkout.payNow", { amount: money(total, p.currency) })}
        </Button>
      </div>
    </div>
  );
}

function Row({ k, v, className }: { k: string; v: string; className?: string }) {
  return <div className={`flex justify-between ${className ?? ""}`}><span className="text-muted-foreground">{k}</span><span className="tabular">{v}</span></div>;
}
