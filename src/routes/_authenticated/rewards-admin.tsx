import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { EmptyState, PageHeader } from "@/components/app/ui-bits";
import { RewardsManager } from "@/components/app/RewardsManager";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/rewards-admin")({
  head: () => ({ meta: [{ title: "Platform rewards · TeleShop" }, { name: "description", content: "Manage platform-wide tasks and lucky draws." }, { property: "og:title", content: "Platform rewards · TeleShop" }, { property: "og:description", content: "Platform tasks and draws." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Page,
});

function Page() {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  return <div><PageHeader title={t("rewards.manage")} />{isAdmin ? <RewardsManager shopId={null} /> : <EmptyState title="403" sub="Admins only" />}</div>;
}
