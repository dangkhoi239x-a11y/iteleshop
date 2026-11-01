import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Store } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/app/ui-bits";
import { Skeleton } from "@/components/ui/skeleton";
import { shopsQuery } from "@/lib/queries";

export const Route = createFileRoute("/shops")({
  head: () => ({
    meta: [
      { title: "Shops · TeleShop" },
      { name: "description", content: "Browse crypto shops selling for USDT and TON on TeleShop." },
      { property: "og:title", content: "Shops · TeleShop" },
      { property: "og:description", content: "Browse crypto shops on TeleShop." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Shops,
});

function Shops() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery(shopsQuery());
  return (
    <div>
      <PageHeader title={t("shop.list")} back={false} />
      <div className="space-y-2 p-4">
        {isLoading && [1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        {data?.length === 0 && <EmptyState icon={Store} title={t("shop.noShops")} />}
        {data?.map((s) => (
          <Link key={s.id} to="/shop/$shopId" params={{ shopId: s.id }} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-secondary">
              {s.logo_url ? <img src={s.logo_url} alt="" className="h-full w-full object-cover" /> : <Store className="m-3 h-6 w-6 text-muted-foreground" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{s.name}</p>
              <p className="line-clamp-1 text-xs text-muted-foreground">{s.description || s.category}</p>
            </div>
            <span className="tabular text-xs text-muted-foreground">{t("shop.sales")}: {s.total_sales}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
