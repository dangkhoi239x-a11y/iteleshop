import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { Copy, Megaphone, Send, Share2, Users, Clock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader, Section, StatCard, errMsg } from "@/components/app/ui-bits";
import { affiliateQuery } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { getAffiliateStats, joinAffiliate } from "@/functions/market.functions";
import { referralLink, shareLink } from "@/lib/telegram";
import { money } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/affiliate")({
  head: () => ({ meta: [{ title: "Affiliate · TeleShop" }, { name: "description", content: "Share your link and earn crypto commission on TeleShop." }, { property: "og:title", content: "Affiliate · TeleShop" }, { property: "og:description", content: "Earn commission." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Affiliate,
});

function Affiliate() {
  const { t } = useTranslation();
  const { userId, profile } = useAuth();
  const qc = useQueryClient();
  const join = useServerFn(joinAffiliate);
  const statsFn = useServerFn(getAffiliateStats);
  const { data: aff, isLoading } = useQuery({ ...affiliateQuery(userId ?? ""), enabled: !!userId });
  const { data: stats } = useQuery({ queryKey: ["affStats", userId], queryFn: () => statsFn(), enabled: !!aff });
  const link = profile ? referralLink(profile.referral_code) : "";

  return (
    <div>
      <PageHeader title={t("aff.title")} />
      <div className="space-y-5 p-4">
        <div className="rounded-3xl border border-border bg-hero p-5">
          <Share2 className="mb-3 h-7 w-7 text-accent" />
          <p className="text-sm text-muted-foreground">{t("aff.sub")}</p>
          {!isLoading && !aff && (
            <Button className="mt-4 w-full" onClick={async () => { try { await join({ data: { kol: false } }); await qc.invalidateQueries({ queryKey: ["affiliate"] }); } catch (e) { toast.error(errMsg(e)); } }}>{t("aff.join")}</Button>
          )}
        </div>
        {aff && (
          <>
            <Section title={t("aff.link")}>
              <div className="rounded-2xl border border-border bg-card p-3">
                <p className="break-all font-mono text-xs">{link}</p>
                <div className="mt-3 flex gap-2">
                  <Button variant="secondary" className="flex-1" onClick={() => { void navigator.clipboard.writeText(link); toast.success(t("common.copied")); }}><Copy /> {t("common.copy")}</Button>
                  <Button className="flex-1" onClick={() => shareLink(link, "TeleShop — crypto marketplace in Telegram")}><Send /> Share</Button>
                </div>
              </div>
            </Section>
            <div className="grid grid-cols-3 gap-2">
              <StatCard label={t("aff.referrals")} value={stats?.referrals ?? 0} icon={Users} />
              <StatCard label={t("aff.pending")} value={money(stats?.pendingAmount ?? 0)} icon={Clock} tone="warning" />
              <StatCard label={t("aff.tier")} value={aff.tier} icon={Megaphone} tone="accent" />
            </div>
          </>
        )}
        <Section title={t("aff.how")}>
          <ol className="space-y-2">
            {["aff.step1", "aff.step2", "aff.step3"].map((k, i) => (
              <li key={k} className="flex items-center gap-3 rounded-xl bg-card p-3 text-sm border border-border">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary font-display text-xs font-bold text-primary-foreground">{i + 1}</span>{t(k)}
              </li>
            ))}
          </ol>
        </Section>
        <Button variant="outline" className="w-full" asChild><Link to="/kol-onboarding"><Megaphone /> {t("aff.kolCta")}</Link></Button>
      </div>
    </div>
  );
}
