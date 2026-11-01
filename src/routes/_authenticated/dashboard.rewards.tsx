import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/app/ui-bits";
import { ShopGate } from "@/components/app/ShopGate";
import { RewardsManager } from "@/components/app/RewardsManager";

export const Route = createFileRoute("/_authenticated/dashboard/rewards")({
  head: () => ({ meta: [{ title: "Shop rewards · TeleShop" }, { name: "description", content: "Create tasks and lucky draws for your shop's customers." }, { property: "og:title", content: "Shop rewards · TeleShop" }, { property: "og:description", content: "Tasks and lucky draws for your shop." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Page,
});

function Page() {
  const { t } = useTranslation();
  return <div><PageHeader title={t("rewards.manage")} /><ShopGate>{(shop) => <RewardsManager shopId={shop.id} />}</ShopGate></div>;
}
