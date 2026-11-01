import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "./ui-bits";
import { myShopQuery } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import type { Database } from "@/integrations/supabase/types";

export type ShopRow = Database["public"]["Tables"]["shops"]["Row"];
export type BotRow = Database["public"]["Tables"]["shop_bots"]["Row"];

export function ShopGate({ children }: { children: (shop: ShopRow, bot: BotRow | null) => ReactNode }) {
  const { t } = useTranslation();
  const { userId } = useAuth();
  const { data, isLoading } = useQuery({ ...myShopQuery(userId ?? ""), enabled: !!userId });
  if (isLoading || !userId) return <EmptyState title={t("common.loading")} />;
  if (!data?.shop) return <EmptyState icon={Store} title={t("shop.register")} sub={t("shop.registerSub")} action={<Button asChild><Link to="/register-shop">{t("shop.register")}</Link></Button>} />;
  return <>{children(data.shop, data.bot)}</>;
}
