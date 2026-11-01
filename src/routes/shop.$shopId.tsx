import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Send, Store } from "lucide-react";
import { EmptyState, PageHeader, ProductCard } from "@/components/app/ui-bits";
import { Skeleton } from "@/components/ui/skeleton";
import { shopQuery } from "@/lib/queries";
import { openExternal } from "@/lib/telegram";

export const Route = createFileRoute("/shop/$shopId")({
  head: () => ({
    meta: [
      { title: "Shop · TeleShop" },
      { name: "description", content: "Products from this TeleShop store, payable in USDT and TON." },
      { property: "og:title", content: "Shop · TeleShop" },
      { property: "og:description", content: "Crypto shop on TeleShop." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ShopPage,
});

function ShopPage() {
  const { shopId } = Route.useParams();
  const { t } = useTranslation();
  const { data, isLoading } = useQuery(shopQuery(shopId));
  if (isLoading) return <div className="space-y-3 p-4"><Skeleton className="h-40 rounded-2xl" /><Skeleton className="h-60 rounded-2xl" /></div>;
  if (!data?.shop) return <EmptyState icon={Store} title="404" />;
  const s = data.shop;
  return (
    <div>
      <PageHeader title={s.name} />
      <div className="relative h-32 bg-hero">{s.banner_url && <img src={s.banner_url} alt="" className="h-full w-full object-cover opacity-80" />}</div>
      <div className="-mt-8 px-4">
        <div className="flex items-end gap-3">
          <div className="h-16 w-16 overflow-hidden rounded-2xl border-4 border-background bg-secondary">
            {s.logo_url ? <img src={s.logo_url} alt="" className="h-full w-full object-cover" /> : <Store className="m-4 h-6 w-6 text-muted-foreground" />}
          </div>
          <div className="pb-1">
            <h2 className="font-display text-xl font-bold">{s.name}</h2>
            <p className="text-xs text-muted-foreground">{t("shop.sales")}: {s.total_sales} · {data.products.length} {t("shop.products").toLowerCase()}</p>
          </div>
        </div>
        {s.description && <p className="mt-3 text-sm text-muted-foreground">{s.description}</p>}
        {s.telegram_channel && (
          <button onClick={() => openExternal(`https://t.me/${s.telegram_channel!.replace(/^@|https?:\/\/t\.me\//g, "")}`)} className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary">
            <Send className="h-4 w-4" /> {s.telegram_channel}
          </button>
        )}
      </div>
      <div className="p-4">
        {data.products.length ? <div className="grid grid-cols-2 gap-3">{data.products.map((p) => <ProductCard key={p.id} p={p} />)}</div> : <EmptyState title={t("shop.empty")} />}
      </div>
    </div>
  );
}
