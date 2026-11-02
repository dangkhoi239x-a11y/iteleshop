import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { BookOpen, Copy, Gamepad2, Gift, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errMsg } from "./ui-bits";
import { resendDelivery } from "@/functions/orders.functions";
import { resendGrowthPrize } from "@/functions/growth.functions";
import { shortDate } from "@/lib/format";

type CodeRow = { id: string; content: string };
type GameRow = { id: string; kind: string; points: number; entries: number; delivered_content: string | null; telegram_state: string; created_at: string; shop_quizzes: { title: string } | null };

export function OrderDelivery({ orderId, shopId, userId, deliveredContent, buyerGuide, isBuyer }: {
  orderId: string; shopId: string; userId: string; deliveredContent: string | null; buyerGuide: string | null; isBuyer: boolean;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const resendCode = useServerFn(resendDelivery);
  const resendGame = useServerFn(resendGrowthPrize);
  const [busy, setBusy] = useState(false);
  const { data: codes } = useQuery({ queryKey: ["orderCodes", orderId], queryFn: async () => {
    const r = await supabase.from("product_codes").select("id,content").eq("order_id", orderId).eq("status", "sold").order("created_at");
    if (r.error) throw new Error(r.error.message);
    return (r.data ?? []) as CodeRow[];
  } });
  const { data: games } = useQuery({ queryKey: ["orderGames", shopId, userId], queryFn: async () => {
    const r = await supabase.from("shop_quiz_rewards").select("*, shop_quizzes(title)").eq("shop_id", shopId).eq("user_id", userId).order("created_at", { ascending: false }).limit(10);
    if (r.error) throw new Error(r.error.message);
    return (r.data ?? []) as GameRow[];
  } });

  const copy = (v: string) => { void navigator.clipboard.writeText(v).then(() => toast.success(t("common.copied"))).catch(e => toast.error(errMsg(e))); };
  const resend = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try { await fn(); await qc.invalidateQueries(); toast.success(t("order.resent")); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  const codeList = codes ?? [];
  const gameList = games ?? [];
  const showGuide = !!buyerGuide;

  return (
    <Tabs defaultValue="codes" className="rounded-2xl border border-border bg-card p-3">
      <TabsList className="flex w-full">
        <TabsTrigger value="codes" className="flex-1 gap-1"><Gift className="h-3.5 w-3.5" />{t("order.tabCodes")}{codeList.length ? ` · ${codeList.length}` : ""}</TabsTrigger>
        {showGuide && <TabsTrigger value="guide" className="flex-1 gap-1"><BookOpen className="h-3.5 w-3.5" />{t("order.tabGuide")}</TabsTrigger>}
        <TabsTrigger value="games" className="flex-1 gap-1"><Gamepad2 className="h-3.5 w-3.5" />{t("order.tabGames")}</TabsTrigger>
      </TabsList>

      <TabsContent value="codes" className="space-y-2">
        {codeList.map((c, i) => (
          <div key={c.id} className="flex items-start justify-between gap-2 rounded-xl bg-background/60 p-3">
            <p className="min-w-0 flex-1 break-all font-mono text-sm">{codeList.length > 1 ? `${i + 1}. ` : ""}{c.content}</p>
            <Button size="icon" variant="ghost" aria-label={t("common.copy")} className="h-7 w-7 shrink-0" onClick={() => copy(c.content)}><Copy className="h-3.5 w-3.5" /></Button>
          </div>
        ))}
        {!codeList.length && deliveredContent && (
          <div className="rounded-xl bg-background/60 p-3"><p className="whitespace-pre-wrap break-all font-mono text-sm">{deliveredContent}</p></div>
        )}
        {!codeList.length && !deliveredContent && <p className="text-sm text-muted-foreground">{t("order.codePending")}</p>}
        <div className="flex gap-2">
          {codeList.length > 1 && <Button size="sm" variant="secondary" onClick={() => copy(codeList.map(c => c.content).join("\n"))}><Copy /> {t("common.copy")}</Button>}
          {isBuyer && !!deliveredContent && <Button size="sm" variant="outline" disabled={busy} onClick={() => resend(() => resendCode({ data: { orderId } }))}><Send /> {t("order.resend")}</Button>}
        </div>
      </TabsContent>

      {showGuide && (
        <TabsContent value="guide" className="rounded-xl bg-primary/5 p-3">
          <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-primary"><BookOpen className="h-4 w-4" />{t("extra.guideTitle")}</p>
          <p className="whitespace-pre-line break-words text-sm">{buyerGuide}</p>
        </TabsContent>
      )}

      <TabsContent value="games" className="space-y-2">
        {gameList.map(r => (
          <div key={r.id} className="space-y-1 rounded-xl bg-background/60 p-3">
            <p className="text-sm font-medium">{r.shop_quizzes?.title} · {shortDate(r.created_at)}</p>
            <p className="text-xs text-accent">+{r.points} {t("order.gamePoints")}{r.entries ? ` · +${r.entries} ${t("order.gameSpins")}` : ""}</p>
            {r.delivered_content && (
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 flex-1 break-all whitespace-pre-wrap font-mono text-sm">{r.delivered_content}</p>
                <Button size="icon" variant="ghost" aria-label={t("common.copy")} className="h-7 w-7 shrink-0" onClick={() => copy(r.delivered_content!)}><Copy className="h-3.5 w-3.5" /></Button>
              </div>
            )}
            {isBuyer && ["pending", "failed"].includes(r.telegram_state) && r.delivered_content && (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => resend(() => resendGame({ data: { id: r.id, quiz: true } }))}><Send /> {t("order.resend")}</Button>
            )}
          </div>
        ))}
        {!gameList.length && <p className="text-sm text-muted-foreground">{t("order.noGames")}</p>}
      </TabsContent>
    </Tabs>
  );
}
