import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Flame, Gift, Search, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Countdown, EmptyState, ProductCard, Section } from "@/components/app/ui-bits";
import { categoriesQuery, flashQuery, productsQuery, type ProductSort } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { AiRecommendations } from "@/components/app/AiRecommendations";
import { storefrontText } from "@/locales/storefront";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TeleShop — Crypto marketplace in Telegram" },
      { name: "description", content: "Digital goods with Telegram Stars and supported crypto payments. Escrow-protected orders, flash sales and affiliate rewards." },
      { property: "og:title", content: "TeleShop — Crypto marketplace in Telegram" },
      { property: "og:description", content: "Buy and sell with USDT and TON, escrow-protected." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const { t, i18n } = useTranslation();
  const text = storefrontText(i18n.language);
  const { shop, session } = useAuth();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [goodsKind, setGoodsKind] = useState<"" | "digital" | "physical">("");
  const [sort, setSort] = useState<ProductSort>("popular");
  const [pages,setPages] = useState(1);
  const { data: categories = [] } = useQuery(categoriesQuery());
  const products = useQuery(productsQuery(q.trim(), category, pages, { goodsKind, sort }));
  const [flashPages,setFlashPages]=useState(1);
  const flash = useQuery(flashQuery(flashPages));
  const soonestEnd = flash.data?.[0]?.flash_sale_end;

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between pt-1">
        <h1 className="font-display text-2xl font-bold">Tele<span className="text-primary">Shop</span></h1>
        {!session && <Link to="/auth" className="text-sm font-medium text-primary">{t("common.signIn")}</Link>}
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => {setQ(e.target.value);setPages(1)}} placeholder={t("home.search")} className="rounded-full bg-card pl-9" />
      </div>

      {!q && (
        <Link to="/rewards" className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
          <span className="rounded-xl bg-primary/10 p-2.5"><Gift className="h-5 w-5 text-primary" /></span>
          <div className="flex-1">
            <p className="font-display font-semibold">{t("rewards.title")}</p>
            <p className="text-xs text-muted-foreground">{t("rewards.checkin")} · {t("rewards.tasks")} · {t("rewards.draws")}</p>
          </div>
        </Link>
      )}

      <AiRecommendations />

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
              {flash.data?.map((p) => (
                <div key={p.id} className="w-36 shrink-0 snap-start"><ProductCard p={p} /></div>
              ))}
            </div>
            {flash.data?.length===flashPages*20&&<Button variant="outline" size="sm" onClick={()=>setFlashPages(n=>n+1)}>{text.loadMoreOffers}</Button>}
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

      <Section
        title={t("home.trending")}
        action={
          <select
            aria-label={text.choose}
            value={sort}
            onChange={(e) => { setSort(e.target.value as ProductSort); setPages(1); }}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          >
            <option value="popular">{text.popular}</option>
            <option value="newest">{text.newest}</option>
            <option value="price_asc">{text.price}</option>
            <option value="price_desc">{text.priceDesc}</option>
          </select>
        }
      >
        <div className="flex flex-wrap items-center gap-1.5">
          {([["", text.allKinds], ["digital", text.digital], ["physical", text.physical]] as const).map(([k, label]) => (
            <Button key={k || "all"} size="sm" variant={goodsKind === k ? "default" : "secondary"} className="h-7 rounded-full px-3 text-xs" onClick={() => { setGoodsKind(k); setPages(1); }}>
              {label}
            </Button>
          ))}
        </div>
        {categories.length > 0 && (
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            <Button size="sm" variant={category === "" ? "secondary" : "ghost"} className="h-7 shrink-0 rounded-full px-3 text-xs" onClick={() => { setCategory(""); setPages(1); }}>
              {text.all}
            </Button>
            {categories.map((c) => (
              <Button key={c} size="sm" variant={category === c ? "secondary" : "ghost"} className="h-7 shrink-0 rounded-full px-3 text-xs" onClick={() => { setCategory(c); setPages(1); }}>
                {c}
              </Button>
            ))}
          </div>
        )}
        {products.isError ? <EmptyState title={products.error.message} /> : products.isLoading ? (
          <div className="grid grid-cols-2 gap-3">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-56 rounded-2xl" />)}</div>
        ) : products.data?.length ? (
          <div className="grid grid-cols-2 gap-3">{products.data.map((p) => <ProductCard key={p.id} p={p} />)}</div>
        ) : (
          <EmptyState title={t("home.noProducts")} />
        )}
      {products.data?.length===pages*60&&<Button variant="outline" className="w-full mt-3" onClick={()=>setPages(n=>n+1)}>{text.loadMore}</Button>}
      </Section>
    </div>
  );
}
