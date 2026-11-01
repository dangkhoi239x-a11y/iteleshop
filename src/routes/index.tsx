import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Flame, Search, Store } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Countdown, EmptyState, ProductCard, Section } from "@/components/app/ui-bits";
import { flashQuery, productsQuery } from "@/lib/queries";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TeleShop — Crypto marketplace in Telegram" },
      { name: "description", content: "Buy and sell with USDT and TON inside Telegram. Escrow-protected orders, flash sales and affiliate rewards." },
      { property: "og:title", content: "TeleShop — Crypto marketplace in Telegram" },
      { property: "og:description", content: "Buy and sell with USDT and TON, escrow-protected." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const { t } = useTranslation();
  const { shop, session } = useAuth();
  const [q, setQ] = useState("");
  const products = useQuery(productsQuery(q.trim()));
  const flash = useQuery(flashQuery());
  const soonestEnd = flash.data?.[0]?.flash_sale_end;

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between pt-1">
        <h1 className="font-display text-2xl font-bold">Tele<span className="text-primary">Shop</span></h1>
        {!session && <Link to="/auth" className="text-sm font-medium text-primary">{t("common.signIn")}</Link>}
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("home.search")} className="rounded-full bg-card pl-9" />
      </div>

      {!q && (flash.data?.length ?? 0) > 0 && (
        <Section>
          <div className="rounded-2xl border border-flash/40 bg-flash-gradient p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="h-5 w-5 text-flash" />
                <div>
                  <p className="font-display font-bold text-flash">{t("home.flashSale")}</p>
                  <p className="text-[11px] text-muted-foreground">{t("home.flashSub")}</p>
                </div>
              </div>
              {soonestEnd && <span className="rounded-lg bg-background/60 px-2 py-1 text-xs">{t("home.endsIn")} <Countdown end={soonestEnd} className="font-bold" /></span>}
            </div>
            <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1">
              {flash.data!.map((p) => (
                <div key={p.id} className="w-36 shrink-0 snap-start"><ProductCard p={p} /></div>
              ))}
            </div>
          </div>
        </Section>
      )}

      {!q && !shop && (
        <Link to={session ? "/register-shop" : "/auth"} className="flex items-center gap-3 rounded-2xl bg-hero p-4 border border-border">
          <span className="rounded-xl bg-accent p-2.5"><Store className="h-5 w-5 text-accent-foreground" /></span>
          <div>
            <p className="font-display font-semibold">{t("home.openShopCta")}</p>
            <p className="text-xs text-muted-foreground">{t("home.openShopSub")}</p>
          </div>
        </Link>
      )}

      <Section title={t("home.trending")}>
        {products.isLoading ? (
          <div className="grid grid-cols-2 gap-3">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-56 rounded-2xl" />)}</div>
        ) : products.data?.length ? (
          <div className="grid grid-cols-2 gap-3">{products.data.map((p) => <ProductCard key={p.id} p={p} />)}</div>
        ) : (
          <EmptyState title={t("home.noProducts")} />
        )}
      </Section>
    </div>
  );
}
