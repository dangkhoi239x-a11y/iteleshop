import { Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Flame, Package, type LucideIcon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { countdown, money } from "@/lib/format";
import { isFlashSaleActive } from "@/lib/pricing";
import { Button } from "@/components/ui/button";
import { ProductBadges, ProductPrice, type MerchProduct } from "./ProductMerchandising";

export function PageHeader({ title, back = true, action }: { title: string; back?: boolean; action?: ReactNode }) {
  const router = useRouter();
  return (
    <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border/60 bg-background/85 px-4 py-3 backdrop-blur">
      {back && (
        <Button variant="ghost" size="icon" onClick={() => router.history.back()} className="-ml-1 shrink-0 text-muted-foreground" aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
      )}
      <h1 className="flex-1 truncate text-lg font-semibold">{title}</h1>
      {action}
    </header>
  );
}

export function EmptyState({ icon: Icon = Package, title, sub, action }: { icon?: LucideIcon; title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 rounded-2xl bg-secondary p-4">
        <Icon className="h-7 w-7 text-muted-foreground" />
      </div>
      <p className="font-display font-semibold">{title}</p>
      {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

const STATUS_TONE: Record<string, string> = {
  awaiting_payment: "bg-warning/15 text-warning",
  paid: "bg-primary/15 text-primary",
  shipped: "bg-primary/15 text-primary",
  delivered: "bg-accent/15 text-accent",
  completed: "bg-success/15 text-success",
  disputed: "bg-destructive/15 text-destructive",
  refunded: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground",
  expired: "bg-muted text-muted-foreground",
  pending: "bg-warning/15 text-warning",
  rejected: "bg-destructive/15 text-destructive",
  open: "bg-warning/15 text-warning",
};

export function StatusPill({ status, label }: { status: string; label: string }) {
  return <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold", STATUS_TONE[status] ?? "bg-secondary text-secondary-foreground")}>{label}</span>;
}

export function Countdown({ end, className }: { end: string; className?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return <span className={cn("tabular font-mono", className)}>{countdown(end, now)}</span>;
}

type CardProduct = MerchProduct & { id: string; name: string; image_url: string | null; sold_count: number; stock: number };

export function ProductCard({ p }: { p: CardProduct }) {
 const { t } = useTranslation(); const flash = isFlashSaleActive(p);
 return <Link to="/product/$productId" params={{productId:p.id}} className="group flex h-full min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary/50">
  <div className="relative aspect-[16/10] overflow-hidden bg-muted">
   {p.image_url ? <img src={p.image_url} alt={p.name} loading="lazy" className="h-full w-full object-contain p-2" /> : <div className="flex h-full items-center justify-center"><Package className="size-8 text-muted-foreground" /></div>}
   {flash && p.flash_sale_end && <span className="absolute right-1.5 top-1.5 inline-flex items-center gap-1 rounded bg-background/90 px-1.5 py-1 text-[10px] text-flash"><Flame className="size-3" /><Countdown end={p.flash_sale_end} /></span>}
   {p.stock === 0 && <span className="absolute inset-x-0 bottom-0 bg-background/90 py-1 text-center text-[11px]">{t('product.outOfStock')}</span>}
  </div>
  <div className="flex flex-1 flex-col gap-2 p-2.5">
   <h3 className="line-clamp-2 min-h-10 break-words text-sm font-semibold">{p.name}</h3>
   <ProductPrice p={p} /><ProductBadges p={p} />
   <div className="mt-auto flex flex-wrap justify-between gap-1 border-t border-border/60 pt-2 text-[10px] text-muted-foreground"><span>{t('product.sold',{n:p.sold_count})}</span><span className={p.stock>0?'text-success':''}>{p.stock>0?t('product.stock',{n:p.stock}):t('product.outOfStock')}</span></div>
  </div>
 </Link>;
}

export function StatCard({ label, value, icon: Icon, tone = "primary" }: { label: string; value: ReactNode; icon?: LucideIcon; tone?: "primary" | "accent" | "warning" | "success" }) {
  const tones = { primary: "text-primary bg-primary/10", accent: "text-accent bg-accent/10", warning: "text-warning bg-warning/10", success: "text-success bg-success/10" };
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5">
      {Icon && <div className={cn("mb-2 inline-flex rounded-lg p-1.5", tones[tone])}><Icon className="h-4 w-4" /></div>}
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="tabular mt-0.5 font-display text-lg font-bold">{value}</p>
    </div>
  );
}

export function Section({ title, children, action }: { title?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="space-y-3">
      {title && (
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-semibold">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function errMsg(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}
