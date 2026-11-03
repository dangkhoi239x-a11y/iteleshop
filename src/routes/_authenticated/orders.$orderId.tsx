import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Loader2, ShieldCheck } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, Field, PageHeader, StatusPill, errMsg } from "@/components/app/ui-bits";
import { orderQuery } from "@/lib/queries";
import { money, shortDate } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { openDispute, payOrder, respondDispute, updateOrder } from "@/functions/orders.functions";
import { haptic, openExternal } from "@/lib/telegram";
import { CodeIssues } from "@/components/app/CodeIssues";
import { OrderDelivery } from "@/components/app/OrderDelivery";

export const Route = createFileRoute("/_authenticated/orders/$orderId")({
  validateSearch: z.object({ paid: z.coerce.number().optional() }),
  head: () => ({ meta: [{ title: "Order · TeleShop" }, { name: "description", content: "Order details, payment and escrow status." }, { property: "og:title", content: "Order · TeleShop" }, { property: "og:description", content: "Order details." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: OrderPage,
});

const REASONS = ["not_received", "not_as_described", "damaged", "other"] as const;

function OrderPage() {
  const { orderId } = Route.useParams();
  const { t } = useTranslation();
  const { userId } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    ...orderQuery(orderId),
    refetchInterval: (q) => (q.state.data?.order?.status === "awaiting_payment" ? 8000 : false),
  });
  const pay = useServerFn(payOrder);
  const update = useServerFn(updateOrder);
  const dispute = useServerFn(openDispute);
  const respond = useServerFn(respondDispute);
  const [busy, setBusy] = useState(false);
  const [showDispute, setShowDispute] = useState(false);
  const [reason, setReason] = useState<string>("not_received");
  const [note, setNote] = useState("");
  const [reply, setReply] = useState("");

  if (isLoading) return <EmptyState title={t("common.loading")} />;
  if (!data?.order) return <EmptyState title="404" />;
  const o = data.order;
  const d = data.dispute;
  const isBuyer = o.buyer_id === userId;
  const isSeller = o.shops?.owner_id === userId;

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    try {
      await fn();
      if (ok) toast.success(ok);
      haptic("success");
      await qc.invalidateQueries();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-w-0 pb-6 [overflow-wrap:anywhere]">
      <PageHeader title={t("order.number", { n: o.order_number })} />
      <div className="space-y-4 p-4">
        {o.status === "awaiting_payment" && (
          <div className="rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm">
            <p className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin text-warning" />{t("order.paidBanner")}</p>
            {isBuyer && (
              <div className="mt-3 flex gap-2">
                <Button className="flex-1" disabled={busy} onClick={() => run(async () => { const r = await pay({ data: { orderId } }); openExternal(r.invoiceUrl); })}>{t("order.pay")}</Button>
                <Button variant="outline" disabled={busy} onClick={() => run(() => update({ data: { orderId, action: "cancel" } }))}>{t("order.cancel")}</Button>
              </div>
            )}
          </div>
        )}

        <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-2xl border border-border bg-card p-3">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted">{o.product_image && <img src={o.product_image} alt="" className="h-full w-full object-cover" />}</div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:justify-between">
              <p className="min-w-0 text-sm font-medium">{o.product_name}</p>
              <StatusPill status={o.status} label={t(`order.status.${o.status}`)} />
            </div>
          <p className="mt-1 text-xs text-muted-foreground">{o.shops?.name}</p>
          </div>
        </div>

        {!["awaiting_payment", "cancelled", "expired"].includes(o.status) && (
          <OrderDelivery orderId={orderId} shopId={o.shops?.id ?? ""} userId={userId ?? ""} deliveredContent={o.delivered_content} buyerGuide={o.buyer_guide} isBuyer={isBuyer} />
        )}

        <div className="space-y-2 rounded-2xl border border-border bg-card p-4 text-sm">
          <Row k={t("order.unit")} v={money(o.unit_price, o.currency)} />
          <Row k={t("order.qty")} v={String(o.quantity)} />
          {Number(o.discount_amount) > 0 && <Row k={`${t("checkout.discount")} (${o.voucher_code})`} v={`−${money(o.discount_amount, o.currency)}`} />}
          <Row k={t("checkout.total")} v={money(o.total_amount, o.currency)} bold />
          <Row k={t("order.placed")} v={shortDate(o.created_at)} />
          <Row k={t("order.escrowLabel")} v={t(`order.escrow.${o.escrow_status}`)} />
          {o.escrow_release_at && o.escrow_status === "holding" && <Row k="" v={t("order.autoRelease", { date: shortDate(o.escrow_release_at) })} />}
          {o.delivery_address && <Row k={t("checkout.address")} v={o.delivery_address} />}
          {o.note && <Row k={t("checkout.note")} v={o.note} />}
          {o.tracking_info && <Row k={t("order.tracking")} v={o.tracking_info} />}
        </div>

        {(isBuyer || isSeller) && <CodeIssues orderId={orderId} isBuyer={isBuyer} isSeller={isSeller} eligible={!!o.delivered_content && ["paid","shipped","delivered","completed","disputed"].includes(o.status)} />}

        {isBuyer && ["paid", "shipped", "delivered"].includes(o.status) && (
          <div className="space-y-2">
            <Button size="lg" className="w-full" disabled={busy} onClick={() => { if (confirm(t("order.confirmAsk"))) void run(() => update({ data: { orderId, action: "confirm" } })); }}>
              <ShieldCheck /> {t("order.confirmReceipt")}
            </Button>
            {!d && <Button variant="outline" className="w-full" onClick={() => setShowDispute((v) => !v)}><AlertTriangle /> {t("order.dispute")}</Button>}
          </div>
        )}

        {showDispute && !d && (
          <div className="space-y-3 rounded-2xl border border-destructive/40 bg-card p-4">
            <Field label={t("dispute.reason")}>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{REASONS.map((r) => <SelectItem key={r} value={r}>{t(`dispute.reasons.${r}`)}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label={t("dispute.note")}><Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("dispute.notePh")} rows={4} maxLength={2000} /></Field>
            <Button variant="destructive" className="w-full" disabled={busy || note.trim().length < 10} onClick={() => run(() => dispute({ data: { orderId, reason, note: note.trim() } }), t("dispute.sent"))}>{t("dispute.submit")}</Button>
          </div>
        )}

        {d && (
          <div className="space-y-3 rounded-2xl border border-destructive/40 bg-card p-4 text-sm">
            <div className="flex items-center justify-between">
              <p className="font-display font-semibold">{t("dispute.title")}</p>
              <StatusPill status={d.status === "open" ? "open" : "completed"} label={t(`dispute.status.${d.status}`)} />
            </div>
            <p><span className="text-muted-foreground">{t("dispute.reason")}:</span> {t(`dispute.reasons.${d.reason}`, d.reason)}</p>
            <p className="whitespace-pre-line text-muted-foreground">{d.buyer_note}</p>
            {d.seller_note && <div className="rounded-xl bg-secondary p-3"><p className="text-xs text-muted-foreground">{t("dispute.sellerReply")}</p><p className="whitespace-pre-line">{d.seller_note}</p></div>}
            {d.admin_note && <div className="rounded-xl bg-primary/10 p-3"><p className="text-xs text-muted-foreground">{t("dispute.adminNote")}</p><p>{d.admin_note}</p></div>}
            {isSeller && d.status === "open" && (
              <div className="space-y-2">
                <Textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} maxLength={2000} />
                <Button className="w-full" disabled={busy || reply.trim().length < 2} onClick={() => run(() => respond({ data: { disputeId: d.id, note: reply.trim() } }), t("common.saved"))}>{t("dispute.reply")}</Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-3">
      <span className="min-w-0 text-muted-foreground">{k}</span>
      <span className={`min-w-0 whitespace-pre-wrap tabular text-right ${bold ? "font-display font-bold text-primary" : ""}`}>{v}</span>
    </div>
  );
}
