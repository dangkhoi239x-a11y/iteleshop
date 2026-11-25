import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckSquare, Download, EyeOff, KeyRound, Search, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Field, errMsg } from "@/components/app/ui-bits";
import { bulkManageCodes, exportProductCodes, importProductCodes, listProductCodes } from "@/functions/market.functions";
import { parseImportedCodes } from "@/lib/codes";
import { shortDate } from "@/lib/format";

export function CodePoolManager({ productId, productName, open, onOpenChange }: { productId: string | null; productName: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const listFn = useServerFn(listProductCodes);
  const importFn = useServerFn(importProductCodes);
  const bulkFn = useServerFn(bulkManageCodes);
  const exportFn = useServerFn(exportProductCodes);

  const [status, setStatus] = useState<"all" | "available" | "sold" | "disabled">("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [paste, setPaste] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["productCodes", productId, status, q, page],
    enabled: open && !!productId,
    queryFn: () => listFn({ data: { productId: productId!, status, q, page } }),
  });

  const parsedPreview = parseImportedCodes(paste, 2000);

  const handleImport = async (codesToImport: string[]) => {
    if (!productId || !codesToImport.length) return;
    setBusy(true);
    try {
      const r = await importFn({
        data: {
          productId,
          codes: codesToImport,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        },
      });
      toast.success(`Đã thêm ${r.added} mã mới${r.skipped ? `, bỏ qua ${r.skipped} mã trùng` : ""}`);
      setPaste("");
      setSelected([]);
      await Promise.all([refetch(), qc.invalidateQueries({ queryKey: ["myProducts"] })]);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    const codes = parseImportedCodes(text, 2000);
    if (!codes.length) {
      toast.error("File không có mã hợp lệ");
      return;
    }
    await handleImport(codes);
  };

  const handleBulk = async (action: "disable" | "enable" | "delete" | "purge_expired") => {
    if (!productId) return;
    setBusy(true);
    try {
      const r = await bulkFn({ data: { productId, action, ids: selected } });
      toast.success(`Đã xử lý ${r.affected} mã · Tồn kho: ${r.stock}`);
      setSelected([]);
      await Promise.all([refetch(), qc.invalidateQueries({ queryKey: ["myProducts"] })]);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const handleExport = async () => {
    if (!productId) return;
    try {
      const r = await exportFn({ data: { productId, status } });
      const blob = new Blob([r.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `codes-${productName.slice(0, 20).replace(/[^a-zA-Z0-9_-]/g, "_")}-${status}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Đã xuất ${r.count} mã`);
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const selectableIds = (data?.rows ?? []).filter((r) => r.status !== "sold").map((r) => r.id);
  const toggleAll = () => {
    setSelected((prev) => (prev.length === selectableIds.length ? [] : selectableIds));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto rounded-t-3xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4 text-primary" />
            <span className="truncate">Kho mã · {productName}</span>
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 p-4">
          {data?.counts && (
            <div className="grid grid-cols-4 gap-1.5 text-center text-xs">
              <div className="rounded-xl bg-success/10 p-2"><p className="font-bold text-success">{data.counts.available}</p><p className="text-[10px] text-muted-foreground">Còn</p></div>
              <div className="rounded-xl bg-primary/10 p-2"><p className="font-bold text-primary">{data.counts.sold}</p><p className="text-[10px] text-muted-foreground">Đã bán</p></div>
              <div className="rounded-xl bg-secondary p-2"><p className="font-bold">{data.counts.disabled}</p><p className="text-[10px] text-muted-foreground">Tắt</p></div>
              <div className="rounded-xl bg-warning/10 p-2"><p className="font-bold text-warning">{data.counts.expired}</p><p className="text-[10px] text-muted-foreground">Hết hạn</p></div>
            </div>
          )}

          <div className="space-y-2.5 rounded-2xl border border-border bg-card p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold">Nạp thêm mã (tự lọc trùng)</span>
              <input ref={fileRef} type="file" accept=".txt,.csv" className="hidden" onChange={(e) => { void handleFile(e.target.files?.[0]); e.target.value = ""; }} />
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs" disabled={busy} onClick={() => fileRef.current?.click()}>
                <Upload className="h-3.5 w-3.5" /> Import .txt / .csv
              </Button>
            </div>
            <Textarea
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              rows={3}
              placeholder={"CODE-001\nCODE-002\nhttps://..."}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Field label="Hạn sử dụng (tùy chọn)">
                <Input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="h-8 text-xs" />
              </Field>
              <Button size="sm" className="mt-5 flex-1" disabled={busy || parsedPreview.length === 0} onClick={() => void handleImport(parsedPreview)}>
                Nạp {parsedPreview.length} mã
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Tìm mã..." className="h-8 pl-8 text-xs" />
              </div>
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => void handleExport()}>
                <Download className="h-3.5 w-3.5" /> CSV
              </Button>
            </div>

            <div className="flex flex-wrap gap-1">
              {([["all", "Tất cả"], ["available", "Còn"], ["sold", "Đã bán"], ["disabled", "Tắt"]] as const).map(([k, label]) => (
                <Button key={k} size="sm" variant={status === k ? "default" : "secondary"} className="h-7 rounded-full px-3 text-xs" onClick={() => { setStatus(k); setPage(1); setSelected([]); }}>
                  {label}
                </Button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {selectableIds.length > 0 && (
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={toggleAll}>
                  <CheckSquare className="h-3.5 w-3.5" /> {selected.length === selectableIds.length ? "Bỏ chọn" : "Chọn hết"}
                </Button>
              )}
              {selected.length > 0 && (
                <>
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={busy} onClick={() => void handleBulk("disable")}><EyeOff className="h-3 w-3" /> Tắt ({selected.length})</Button>
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={busy} onClick={() => void handleBulk("enable")}>Bật ({selected.length})</Button>
                  <Button size="sm" variant="destructive" className="h-7 px-2 text-xs" disabled={busy} onClick={() => void handleBulk("delete")}><Trash2 className="h-3 w-3" /> Xóa</Button>
                </>
              )}
              {(data?.counts.expired ?? 0) > 0 && (
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-warning" disabled={busy} onClick={() => void handleBulk("purge_expired")}>
                  Dọn {data?.counts.expired} mã hết hạn
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            {isLoading && <p className="text-xs text-muted-foreground">{t("common.loading")}</p>}
            {!isLoading && !data?.rows.length && <p className="py-4 text-center text-xs text-muted-foreground">Không có mã nào</p>}
            {data?.rows.map((c) => {
              const isExpired = c.status === "available" && !!c.expires_at && new Date(c.expires_at).getTime() <= Date.now();
              const checkedBox = selected.includes(c.id);
              return (
                <div key={c.id} className="flex items-center gap-2 rounded-xl border border-border bg-card px-2.5 py-2 text-xs">
                  {c.status !== "sold" && (
                    <input
                      type="checkbox"
                      checked={checkedBox}
                      onChange={(e) => setSelected((prev) => (e.target.checked ? [...prev, c.id] : prev.filter((x) => x !== c.id)))}
                      className="h-4 w-4 shrink-0"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-[11px] font-medium">{c.content}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {c.expires_at ? `HSD: ${shortDate(c.expires_at)} · ` : ""}
                      {c.sold_at ? `Bán ${shortDate(c.sold_at)}` : shortDate(c.created_at)}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${isExpired ? "bg-warning/15 text-warning" : c.status === "available" ? "bg-success/15 text-success" : c.status === "sold" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {isExpired ? "Hết hạn" : t(`products.codeStatus.${c.status}`)}
                  </span>
                </div>
              );
            })}
          </div>

          {(data?.rows.length ?? 0) === (data?.pageSize ?? 50) && (
            <div className="flex justify-between gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Trang trước</Button>
              <Button size="sm" variant="outline" onClick={() => setPage((p) => p + 1)}>Trang sau</Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
