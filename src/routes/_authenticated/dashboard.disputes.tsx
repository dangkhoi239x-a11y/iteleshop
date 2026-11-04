import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, PageHeader, errMsg } from "@/components/app/ui-bits";
import { ShopGate, type ShopRow } from "@/components/app/ShopGate";
import { money, shortDate } from "@/lib/format";
import { respondDispute } from "@/functions/orders.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/dashboard/disputes")({
  head: () => ({ meta: [{ title: "Tranh chấp đơn hàng · TeleShop" }, { name: "description", content: "Shop gửi lý do, admin xác nhận và giải ngân." }, { property: "og:title", content: "Tranh chấp đơn hàng · TeleShop" }, { property: "og:description", content: "Xử lý tranh chấp đơn hàng của shop." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: () => <ShopGate>{(shop) => <Disputes shop={shop} />}</ShopGate>,
});

const STATUS: Record<string, string> = { open: "Chờ admin xác nhận", resolved_release: "Đã giải ngân vào ví shop", resolved_refund: "Đã hoàn tiền người mua" };

function Disputes({ shop }: { shop: ShopRow }) {
  const qc = useQueryClient();
  const respond = useServerFn(respondDispute);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const { data = [], isLoading } = useQuery({
    queryKey: ["shopDisputes", shop.id],
    queryFn: async () => {
      const r = await supabase.from("disputes").select("*, orders!inner(id, shop_id, order_number, product_name, total_amount, currency)").eq("orders.shop_id", shop.id).order("created_at", { ascending: false }).limit(100);
      if (r.error) throw new Error(r.error.message);
      return r.data;
    },
  });
  const send = async (id: string) => {
    try { await respond({ data: { disputeId: id, note: notes[id] ?? "" } }); toast.success("Đã gửi lý do cho admin"); qc.invalidateQueries({ queryKey: ["shopDisputes", shop.id] }); }
    catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div className="min-w-0 space-y-3 p-4 [overflow-wrap:anywhere]">
      <PageHeader title="Tranh chấp đơn hàng" />
      <p className="text-xs text-muted-foreground">Gửi lý do kèm bằng chứng. Khi admin xác nhận giải ngân, mã chuyển "đã nhận" và tiền vào ví shop.</p>
      {!isLoading && data.length === 0 && <EmptyState title="Chưa có tranh chấp" />}
      {data.map((d) => (
        <div key={d.id} className="space-y-2 rounded-2xl border border-border bg-card p-3 text-sm">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <Link to="/orders/$orderId" params={{ orderId: d.orders.id }} className="font-medium">#{d.orders.order_number} · {d.orders.product_name}</Link>
            <span className="tabular text-xs">{money(d.orders.total_amount, d.orders.currency)}</span>
          </div>
          <p className="text-xs text-muted-foreground">{shortDate(d.created_at)} · {STATUS[d.status] ?? d.status}</p>
          <p className="whitespace-pre-wrap rounded-lg bg-secondary p-2 text-xs"><b>Người mua:</b> {d.reason}{d.buyer_note ? ` — ${d.buyer_note}` : ""}</p>
          {d.seller_note && <p className="whitespace-pre-wrap rounded-lg border border-border p-2 text-xs"><b>Shop:</b> {d.seller_note}</p>}
          {d.admin_note && <p className="whitespace-pre-wrap rounded-lg border border-primary/40 p-2 text-xs"><b>Admin:</b> {d.admin_note}</p>}
          {d.status === "open" && (
            <div className="space-y-2">
              <Textarea rows={3} placeholder="Lý do của shop (mã đã giao đúng, bằng chứng...)" value={notes[d.id] ?? d.seller_note ?? ""} onChange={(e) => setNotes({ ...notes, [d.id]: e.target.value })} />
              <Button size="sm" className="w-full" disabled={(notes[d.id] ?? "").trim().length < 2} onClick={() => send(d.id)}>{d.seller_note ? "Cập nhật lý do" : "Gửi lý do cho admin"}</Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
