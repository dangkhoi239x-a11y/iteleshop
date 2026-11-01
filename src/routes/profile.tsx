import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ChevronRight, Gift, Languages, LayoutDashboard, ListOrdered, LogOut, Share2, Shield, Store, User, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/ui-bits";
import { useAuth } from "@/lib/auth";
import { displayName } from "@/lib/format";
import i18n, { LANGUAGES } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { updateLanguage } from "@/functions/market.functions";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile · TeleShop" }, { name: "description", content: "Your TeleShop account, shop, wallet and language." }, { property: "og:title", content: "Profile · TeleShop" }, { property: "og:description", content: "Your TeleShop account." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Profile,
});

function Profile() {
  const { t } = useTranslation();
  const { session, profile, shop, isAdmin, signOut } = useAuth();
  const saveLang = useServerFn(updateLanguage);
  const qc = useQueryClient();

  const setLang = async (code: "vi" | "en" | "ru" | "zh") => {
    await i18n.changeLanguage(code);
    localStorage.setItem("ts_lang", code);
    if (session) {
      await saveLang({ data: { language: code } });
      await qc.invalidateQueries({ queryKey: ["me"] });
    }
  };

  const items = session
    ? [
        { to: "/orders", icon: ListOrdered, label: t("profile.myOrders") },
        shop ? { to: "/dashboard", icon: LayoutDashboard, label: t("profile.dashboard") } : { to: "/register-shop", icon: Store, label: t("profile.openShop") },
        { to: "/wallet", icon: Wallet, label: t("profile.wallet") },
        { to: "/rewards", icon: Gift, label: t("rewards.title") },
        { to: "/affiliate", icon: Share2, label: t("profile.affiliate") },
        ...(isAdmin ? [{ to: "/admin", icon: Shield, label: t("profile.admin") }, { to: "/rewards-admin", icon: Gift, label: `${t("profile.admin")} · ${t("rewards.title")}` }] : []),
      ]
    : [];

  return (
    <div>
      <PageHeader title={t("profile.title")} back={false} />
      <div className="space-y-5 p-4">
        <div className="flex items-center gap-4 rounded-2xl bg-hero p-4 border border-border">
          <div className="h-14 w-14 overflow-hidden rounded-full bg-secondary">{profile?.photo_url ? <img src={profile.photo_url} alt="" className="h-full w-full object-cover" /> : <User className="m-4 h-6 w-6 text-muted-foreground" />}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-lg font-semibold">{session ? displayName(profile) : t("profile.guest")}</p>
            {profile?.username && <p className="text-sm text-muted-foreground">@{profile.username}</p>}
          </div>
          {!session && <Button asChild size="sm"><Link to="/auth">{t("common.signIn")}</Link></Button>}
        </div>

        {items.length > 0 && (
          <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {items.map(({ to, icon: Icon, label }) => (
              <Link key={to} to={to} className="flex items-center gap-3 px-4 py-3.5 text-sm hover:bg-secondary">
                <Icon className="h-5 w-5 text-primary" /> <span className="flex-1">{label}</span> <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        )}

        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-medium"><Languages className="h-4 w-4 text-primary" />{t("profile.language")}</p>
          <div className="grid grid-cols-2 gap-2">
            {LANGUAGES.map((l) => (
              <button key={l.code} onClick={() => setLang(l.code)} className={cn("rounded-xl border px-3 py-2 text-sm", i18n.language === l.code ? "border-primary bg-primary/10 text-primary" : "border-border")}>
                {l.label}
              </button>
            ))}
          </div>
        </div>

        {session && <Button variant="ghost" className="w-full text-destructive" onClick={signOut}><LogOut /> {t("profile.signOut")}</Button>}
      </div>
    </div>
  );
}
