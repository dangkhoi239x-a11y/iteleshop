import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Send, ShieldCheck, Coins, Users } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { inTelegram } from "@/lib/telegram";
import { demoLoginConfig } from "@/functions/auth.functions";

export const Route = createFileRoute("/auth")({
  validateSearch: z.object({ redirect: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Sign in · TeleShop" },
      { name: "description", content: "Sign in to TeleShop, the crypto marketplace inside Telegram." },
      { property: "og:title", content: "Sign in · TeleShop" },
      { property: "og:description", content: "Pay with USDT & TON, escrow-protected." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { t } = useTranslation();
  const { session, signingIn, loginError, loginTelegram, loginDemo, loginDemoAdmin } = useAuth();
  const getCfg = useServerFn(demoLoginConfig);
  const { data: cfg } = useQuery({ queryKey: ["demoLoginConfig"], queryFn: () => getCfg() });
  const { redirect } = Route.useSearch();
  const nav = useNavigate();
  const tgMode = typeof window !== "undefined" && inTelegram();

  useEffect(() => {
    if (session) {
      const target = redirect && redirect.startsWith("/") && !redirect.startsWith("//") ? redirect : "/";
      void nav({ to: target as "/" });
    }
  }, [session, redirect, nav]);

  return (
    <div className="flex min-h-[100dvh] flex-col justify-between bg-hero px-6 py-10">
      <div className="pt-10">
        <div className="mb-6 inline-flex rounded-2xl bg-primary p-3 shadow-glow"><Send className="h-7 w-7 text-primary-foreground" /></div>
        <h1 className="font-display text-4xl font-bold">TeleShop</h1>
        <p className="mt-2 text-lg text-muted-foreground">{t("auth.tagline")}</p>
        <ul className="mt-10 space-y-4">
          {[[Coins, "auth.f1"], [ShieldCheck, "auth.f2"], [Users, "auth.f3"]].map(([Icon, k]) => {
            const I = Icon as typeof Coins;
            return (
              <li key={k as string} className="flex items-center gap-3 text-sm">
                <span className="rounded-lg bg-secondary p-2"><I className="h-4 w-4 text-accent" /></span>
                {t(k as string)}
              </li>
            );
          })}
        </ul>
      </div>
      <div className="space-y-3">
        {loginError && <p className="rounded-xl bg-destructive/15 p-3 text-sm text-destructive">{loginError}</p>}
        {tgMode ? (
          <Button size="lg" className="w-full" onClick={loginTelegram} disabled={signingIn}>
            {signingIn ? <Loader2 className="animate-spin" /> : <Send />} {signingIn ? t("auth.connecting") : t("auth.signIn")}
          </Button>
        ) : (
          <>
            <p className="text-center text-xs text-muted-foreground">{t("auth.openInTelegram")}</p>
            <Button size="lg" className="w-full" onClick={loginDemo} disabled={signingIn}>
              {signingIn && <Loader2 className="animate-spin" />} {t("auth.demo")}
            </Button>
            {cfg?.demoAdminEnabled && (
              <Button size="lg" variant="outline" className="w-full" onClick={loginDemoAdmin} disabled={signingIn}>
                {signingIn ? <Loader2 className="animate-spin" /> : <ShieldCheck />} Demo Admin (Test)
              </Button>
            )}
            <p className="text-center text-[11px] text-muted-foreground">{t("auth.demoHint")}</p>
          </>
        )}
        <Button variant="ghost" className="w-full" asChild><Link to="/">{t("auth.browse")}</Link></Button>
      </div>
    </div>
  );
}
