import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Flame, Package, ShieldCheck, Store, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Countdown, EmptyState, PageHeader } from "@/components/app/ui-bits";
import { productQuery } from "@/lib/queries";
import { effectivePrice, isFlashSaleActive } from "@/lib/pricing";
import { money } from "@/lib/format";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/product/$productId")({
  head: () => ({
    meta: [
      { title: "Product · TeleShop" },
      { name: "description", content: "Buy with USDT or TON, protected by escrow on TeleShop." },
      { property: "og:title", content: "Product · TeleShop" },
      { property: "og:description", content: "Escrow-protected crypto purchase on TeleShop." },
      { property: "og:type", content: "product" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProductPage,
});

function ProductPage() {
  const { productId } = Route.useParams();
  const { t } = useTranslation();
  const { userId } = useAuth();
  const { data: p, isLoading } = useQuery(productQuery(productId));
  if (isLoading) return <div className="space-y-3 p-4"><Skeleton className="aspect-square rounded-2xl" /><Skeleton className="h-24 rounded-2xl" /></div>;
  if (!p) return <EmptyState title="404" />;
  const flash = isFlashSaleActive(p);
  const own = p.shops?.owner_id === userId;
  return (
    <div className="pb-24">
      <PageHeader title={p.name} />
      <div className="aspect-square bg-muted">
        {p.image_url ? <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Package className="h-12 w-12 text-muted-foreground" /></div>}
      </div>
      <div className="space-y-4 p-4">
        {flash && (
          <div className="flex items-center justify-between rounded-xl bg-flash-gradient px-3 py-2 text-sm">
            <span className="flex items-center gap-1.5 font-semibold text-flash"><Flame className="h-4 w-4" /> {t("home.flashSale")}</span>
            <span>{t("home.endsIn")} <Countdown end={p.flash_sale_end!} className="font-bold" /></span>
          </div>
        )}
        <div>
          <h2 className="font-display text-xl font-bold">{p.name}</h2>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="tabular font-display text-2xl font-bold text-primary">{money(effectivePrice(p), p.currency)}</span>
            {flash && <span className="tabular text-sm text-muted-foreground line-through">{money(p.price, p.currency)}</span>}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{p.stock > 0 ? t("product.stock", { n: p.stock }) : t("product.outOfStock")} · {t("product.sold", { n: p.sold_count })}</p>
        </div>
        <div className="flex gap-3 rounded-xl border border-border bg-card p-3 text-sm">
          {p.warranty_type === "none" ? <Timer className="h-5 w-5 shrink-0 text-warning" /> : <ShieldCheck className="h-5 w-5 shrink-0 text-success" />}
          <span className="text-muted-foreground">{p.warranty_type === "none" ? t("product.warrantyNone", { days: p.escrow_release_days }) : t("product.warrantyStandard")}</span>
        </div>
        {p.shops && (
          <Link to="/shop/$shopId" params={{ shopId: p.shops.id }} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
            <Store className="h-5 w-5 text-muted-foreground" />
            <span className="flex-1 font-medium">{p.shops.name}</span>
            <span className="text-xs text-primary">{t("product.visitShop")}</span>
          </Link>
        )}
        {p.description && (
          <div>
            <h3 className="mb-1 text-sm font-semibold">{t("product.description")}</h3>
            <p className="whitespace-pre-line text-sm text-muted-foreground">{p.description}</p>
          </div>
        )}
      </div>
      <div className="fixed inset-x-0 bottom-16 z-30 mx-auto max-w-md border-t border-border bg-background/95 p-3 backdrop-blur">
        {own ? (
          <p className="text-center text-sm text-muted-foreground">{t("product.ownShop")}</p>
        ) : (
          <Button size="lg" className="w-full shadow-glow" disabled={p.stock === 0} asChild={p.stock > 0}>
            {p.stock > 0 ? <Link to="/checkout" search={{ productId: p.id }}>{t("product.buyNow")}</Link> : <span>{t("product.outOfStock")}</span>}
          </Button>
        )}
      </div>
    </div>
  );
}
