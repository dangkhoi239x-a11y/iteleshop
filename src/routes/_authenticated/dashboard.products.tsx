import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy, KeyRound, Package, Pencil, Plus, Trash2, Webhook, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, Field, PageHeader, StatusPill, errMsg } from "@/components/app/ui-bits";
import { ShopGate, type ShopRow } from "@/components/app/ShopGate";
import { myProductsQuery } from "@/lib/queries";
import { money } from "@/lib/format";
import { deleteProduct, removeProductCode, saveProduct, testWebhookEndpoint } from "@/functions/market.functions";
import type { Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";

type P = Database["public"]["Tables"]["products"]["Row"];
type Code = Database["public"]["Tables"]["product_codes"]["Row"];

export const Route = createFileRoute("/_authenticated/dashboard/products")({
  head: () => ({ meta: [{ title: "Products · TeleShop" }, { name: "description", content: "Manage your shop products." }, { property: "og:title", content: "Products · TeleShop" }, { property: "og:description", content: "Manage products." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: () => <ShopGate>{(shop) => <Products shop={shop} />}</ShopGate>,
});

const blank = { name: "", description: "", price: "", currency: "USDT" as "USDT" | "TON", image_url: "", category: "", stock: "10", status: "active" as "active" | "draft", warranty_type: "standard" as "standard" | "none", escrow_release_days: "3", delivery_content: "", goods_kind:"digital" as "digital"|"physical", auto_send_telegram: true, buyer_guide: "", highlights: "", bulk_discounts: "", buy_x: "", get_y: "", fulfillment_mode: "pool" as "pool" | "webhook_api", webhook_url: "", external_sku: "", webhook_secret: "" };

function Products({ shop }: { shop: ShopRow }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data = [] } = useQuery(myProductsQuery(shop.id));
  const save = useServerFn(saveProduct);
  const del = useServerFn(deleteProduct);
  const testWh = useServerFn(testWebhookEndpoint);
  const [editing, setEditing] = useState<string | null | undefined>(undefined);
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [testingWh, setTestingWh] = useState(false);
  const [codes, setCodes] = useState<Code[]>([]);
  const removeCode = useServerFn(removeProductCode);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const loadCodes = async (pid: string) => {
    const { data } = await supabase.from("product_codes").select("*").eq("product_id", pid).order("created_at");
    setCodes(data ?? []);
  };

  const open = async (p?: P) => {
    setEditing(p?.id ?? null);
    setCodes([]);
    if (p) void loadCodes(p.id);
    setF(p ? { name: p.name, description: p.description ?? "", price: String(Number(p.price)), currency: p.currency as "USDT", image_url: p.image_url ?? "", category: p.category ?? "", stock: String(p.stock), status: p.status === "draft" ? "draft" : "active", warranty_type: p.warranty_type as "standard", escrow_release_days: String(p.escrow_release_days), delivery_content: "", goods_kind:p.goods_kind as "digital"|"physical", auto_send_telegram: p.auto_send_telegram, buyer_guide: p.buyer_guide ?? "", highlights: p.highlights ?? "", bulk_discounts: p.bulk_discounts ?? "", buy_x: p.buy_x ? String(p.buy_x) : "", get_y: p.get_y ? String(p.get_y) : "", fulfillment_mode: (p.fulfillment_mode === "webhook_api" ? "webhook_api" : "pool"), webhook_url: p.webhook_url ?? "", external_sku: p.external_sku ?? "", webhook_secret: p.webhook_secret ?? "" } : blank);
  };

  const delCode = async (id: string) => {
    try {
      await removeCode({ data: { id } });
      if (editing) await loadCodes(editing);
      await qc.invalidateQueries({ queryKey: ["myProducts"] });
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const submit = async () => {
    setBusy(true);
    try {
      const r = await save({ data: { id: editing ?? undefined, name: f.name, description: f.description || null, price: Number(f.price), currency: f.currency, image_url: f.image_url, category: f.category || null, stock: Number(f.stock), status: f.status, warranty_type: f.warranty_type, escrow_release_days: Number(f.escrow_release_days), delivery_content: f.delivery_content, goods_kind:f.goods_kind, auto_send_telegram: f.auto_send_telegram, buyer_guide: f.buyer_guide || null, highlights: f.highlights || null, bulk_discounts: f.bulk_discounts || null, buy_x: Number(f.buy_x) || null, get_y: Number(f.get_y) || null, fulfillment_mode: f.fulfillment_mode, webhook_url: f.webhook_url || null, external_sku: f.external_sku || null } });
      toast.success(r.added ? t("products.savedWithCodes", { n: r.added }) : t("common.saved"));
      setEditing(undefined);
      await qc.invalidateQueries({ queryKey: ["myProducts"] });
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title={t("products.title")} action={<Button size="sm" onClick={() => open()}><Plus /> {t("products.add")}</Button>} />
      <div className="space-y-2 p-4">
        {data.length === 0 && <EmptyState icon={Package} title={t("products.empty")} action={<Button onClick={() => open()}><Plus /> {t("products.add")}</Button>} />}
        {data.map((p) => (
          <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-muted">{p.image_url && <img src={p.image_url} alt="" className="h-full w-full object-cover" />}</div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-1 text-sm font-medium">{p.name}</p>
              <p className="tabular text-sm font-bold text-primary">{money(p.price, p.currency)}</p>
              <p className="text-[11px] text-muted-foreground">{t("products.stock")}: {p.stock} · {t("product.sold", { n: p.sold_count })}</p>
            </div>
            {p.status === "draft" && <StatusPill status="cancelled" label={t("products.draft")} />}
            <Button variant="ghost" size="icon" onClick={() => open(p)}><Pencil /></Button>
            <Button variant="ghost" size="icon" onClick={async () => { if (!confirm(t("products.deleteAsk"))) return; try { await del({ data: { id: p.id } }); await qc.invalidateQueries({ queryKey: ["myProducts"] }); } catch (e) { toast.error(errMsg(e)); } }}><Trash2 className="text-destructive" /></Button>
          </div>
        ))}
      </div>
      <Sheet open={editing !== undefined} onOpenChange={(o) => !o && setEditing(undefined)}>
        <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto rounded-t-3xl">
          <SheetHeader><SheetTitle>{editing ? t("products.edit") : t("products.add")}</SheetTitle></SheetHeader>
          <div className="space-y-3 p-4">
            <Field label="Loại hàng"><Select value={f.goods_kind} onValueChange={v=>setF({...f,goods_kind:v as "digital"|"physical"})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="digital">Hàng số · Telegram Stars</SelectItem><SelectItem value="physical">Hàng vật lý</SelectItem></SelectContent></Select></Field>
            <Field label={t("products.name")}><Input value={f.name} onChange={set("name")} maxLength={120} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("products.price")}><Input type="number" inputMode="decimal" value={f.price} onChange={set("price")} /></Field>
              <Field label={t("products.currency")}>
                <Select value={f.currency} onValueChange={(v) => setF({ ...f, currency: v as "USDT" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="USDT">USDT</SelectItem><SelectItem value="TON">TON</SelectItem></SelectContent></Select>
              </Field>
              <Field label={t("products.stock")}><Input type="number" inputMode="numeric" value={f.stock} onChange={set("stock")} /></Field>
              <Field label={t("products.status")}>
                <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v as "active" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">{t("products.active")}</SelectItem><SelectItem value="draft">{t("products.draft")}</SelectItem></SelectContent></Select>
              </Field>
            </div>
            <Field label={t("products.image")}><Input value={f.image_url} onChange={set("image_url")} placeholder="https://…" /></Field>
            <Field label={t("products.category")}><Input value={f.category} onChange={set("category")} maxLength={40} /></Field>
            <Field label={t("shop.desc")}><Textarea value={f.description} onChange={set("description")} rows={4} maxLength={4000} /></Field>
            <Field label="Chế độ giao mã">
              <Select value={f.fulfillment_mode} onValueChange={(v) => setF({ ...f, fulfillment_mode: v as "pool" | "webhook_api" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pool">Kho mã có sẵn (Pool)</SelectItem>
                  <SelectItem value="webhook_api">API / Bot bên ngoài (Webhook)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {f.fulfillment_mode === "webhook_api" ? (
              <div className="space-y-3 rounded-2xl border border-primary/30 bg-primary/5 p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-primary"><Webhook className="h-3.5 w-3.5" />Kết nối API / Bot tạo mã tự động</p>
                <Field label="Webhook URL (HTTPS)"><Input value={f.webhook_url} onChange={set("webhook_url")} placeholder="https://api.shop.com/teleshop/fulfill" /></Field>
                <Field label="External SKU (tùy chọn)"><Input value={f.external_sku} onChange={set("external_sku")} placeholder="COUPON-20PCT" maxLength={100} /></Field>
                {f.webhook_secret && (
                  <div className="flex items-center justify-between gap-2 rounded-xl bg-background px-2.5 py-2 text-xs">
                    <span className="truncate font-mono text-[11px]">Secret: {f.webhook_secret}</span>
                    <Button type="button" size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => { void navigator.clipboard?.writeText(f.webhook_secret); toast.success(t("common.copied")); }}><Copy className="h-3 w-3" /></Button>
                  </div>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full"
                  disabled={testingWh || !f.webhook_url}
                  onClick={async () => {
                    setTestingWh(true);
                    try {
                      const r = await testWh({ data: { productId: editing ?? undefined, webhook_url: f.webhook_url, external_sku: f.external_sku || null } });
                      toast.success(r.mode === "async" ? "Kết nối OK (Async 202)" : `Kết nối OK (${r.sampleCount} mã)`);
                    } catch (e) {
                      toast.error(errMsg(e));
                    } finally {
                      setTestingWh(false);
                    }
                  }}
                >
                  Test kết nối API
                </Button>
              </div>
            ) : (
              <Field label={t("products.delivery")} hint={t("products.deliveryHint")}><Textarea value={f.delivery_content} onChange={set("delivery_content")} rows={3} maxLength={20000} placeholder={"CODE-XXXX\nhttps://…"} /></Field>
            )}
            <label className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"><span><span className="block text-sm font-medium">{t("extra.autoSend")}</span><span className="block text-xs text-muted-foreground">{t("extra.autoSendHint")}</span></span><Switch checked={f.auto_send_telegram} onCheckedChange={(v) => setF({ ...f, auto_send_telegram: v })} /></label>
            <Field label={t("extra.highlights")} hint={t("extra.highlightsHint")}><Textarea value={f.highlights} onChange={set("highlights")} rows={3} maxLength={2000} /></Field>
            <Field label={t("extra.bulk")} hint={t("extra.bulkHint")}><Textarea value={f.bulk_discounts} onChange={set("bulk_discounts")} rows={2} maxLength={500} placeholder={"3:10\n5:15"} /></Field>
            <div className="grid grid-cols-2 gap-3"><Field label={t("extra.buyX")}><Input type="number" value={f.buy_x} onChange={set("buy_x")} placeholder="2" /></Field><Field label={t("extra.getY")} hint={t("extra.bxgyHint")}><Input type="number" value={f.get_y} onChange={set("get_y")} placeholder="1" /></Field></div>
            <Field label={t("extra.buyerGuide")} hint={t("extra.buyerGuideHint")}><Textarea value={f.buyer_guide} onChange={set("buyer_guide")} rows={3} maxLength={4000} /></Field>
            {editing && (
              <div className="space-y-2 rounded-2xl border border-border bg-secondary/40 p-3">
                <p className="flex items-center gap-2 text-xs font-semibold"><KeyRound className="h-3.5 w-3.5 text-primary" />{t("products.codePool", { n: codes.filter((c) => c.status === "available").length, sold: codes.filter((c) => c.status === "sold").length })}</p>
                {codes.length === 0 && <p className="text-xs text-muted-foreground">{t("products.noCodes")}</p>}
                <div className="max-h-40 space-y-1 overflow-y-auto">
                  {codes.map((c) => (
                    <div key={c.id} className="flex items-center gap-2 rounded-lg bg-background px-2 py-1.5">
                      <span className="min-w-0 flex-1 truncate font-mono text-[11px]">{c.content}</span>
                      {c.status === "available" ? (
                        <button onClick={() => delCode(c.id)} className="shrink-0 text-muted-foreground hover:text-destructive" aria-label={t("common.delete")}><X className="h-3.5 w-3.5" /></button>
                      ) : (
                        <span className="shrink-0 text-[10px] text-muted-foreground">{t(`products.codeStatus.${c.status}`)}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <Field label={t("products.warranty")}>
              <Select value={f.warranty_type} onValueChange={(v) => setF({ ...f, warranty_type: v as "standard" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="standard">{t("products.warrantyStandard")}</SelectItem><SelectItem value="none">{t("products.warrantyNone")}</SelectItem></SelectContent></Select>
            </Field>
            {f.warranty_type === "none" && <Field label={t("products.releaseDays")}><Input type="number" min={1} max={30} value={f.escrow_release_days} onChange={set("escrow_release_days")} /></Field>}
            <Button className="w-full" onClick={submit} disabled={busy || f.name.trim().length < 2 || !(Number(f.price) > 0)}>{t("common.save")}</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
