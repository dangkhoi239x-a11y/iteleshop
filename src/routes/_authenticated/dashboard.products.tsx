import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Package, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, Field, PageHeader, StatusPill, errMsg } from "@/components/app/ui-bits";
import { ShopGate, type ShopRow } from "@/components/app/ShopGate";
import { myProductsQuery } from "@/lib/queries";
import { money } from "@/lib/format";
import { deleteProduct, saveProduct } from "@/functions/market.functions";
import type { Database } from "@/integrations/supabase/types";

type P = Database["public"]["Tables"]["products"]["Row"];

export const Route = createFileRoute("/_authenticated/dashboard/products")({
  head: () => ({ meta: [{ title: "Products · TeleShop" }, { name: "description", content: "Manage your shop products." }, { property: "og:title", content: "Products · TeleShop" }, { property: "og:description", content: "Manage products." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: () => <ShopGate>{(shop) => <Products shop={shop} />}</ShopGate>,
});

const blank = { name: "", description: "", price: "", currency: "USDT" as "USDT" | "TON", image_url: "", category: "", stock: "10", status: "active" as "active" | "draft", warranty_type: "standard" as "standard" | "none", escrow_release_days: "3" };

function Products({ shop }: { shop: ShopRow }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data = [] } = useQuery(myProductsQuery(shop.id));
  const save = useServerFn(saveProduct);
  const del = useServerFn(deleteProduct);
  const [editing, setEditing] = useState<string | null | undefined>(undefined);
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const open = (p?: P) => {
    setEditing(p?.id ?? null);
    setF(p ? { name: p.name, description: p.description ?? "", price: String(Number(p.price)), currency: p.currency as "USDT", image_url: p.image_url ?? "", category: p.category ?? "", stock: String(p.stock), status: p.status === "draft" ? "draft" : "active", warranty_type: p.warranty_type as "standard", escrow_release_days: String(p.escrow_release_days) } : blank);
  };

  const submit = async () => {
    setBusy(true);
    try {
      await save({ data: { id: editing ?? undefined, name: f.name, description: f.description || null, price: Number(f.price), currency: f.currency, image_url: f.image_url, category: f.category || null, stock: Number(f.stock), status: f.status, warranty_type: f.warranty_type, escrow_release_days: Number(f.escrow_release_days) } });
      toast.success(t("common.saved"));
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
