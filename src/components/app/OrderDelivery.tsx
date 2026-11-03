import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { BookOpen, CheckCircle2, Copy, Gamepad2, Gift, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errMsg } from "./ui-bits";
import { resendDelivery } from "@/functions/orders.functions";
import { resendGrowthPrize } from "@/functions/growth.functions";
import { shortDate } from "@/lib/format";

type CodeRow = { id: string; content: string; received_at: string | null };
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
    const r = await supabase.from("product_codes").select("id,content,received_at").eq("order_id", orderId).eq("status", "sold").order("created_at");
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
    <Tabs defaultValue="codes" className="min-w-0 max-w-full rounded-2xl border border-border bg-card p-3 [overflow-wrap:anywhere]">
      <TabsList className={`grid h-auto w-full min-w-0 items-stretch ${showGuide ? "grid-cols-3" : "grid-cols-2"}`}>
        <TabsTrigger value="codes" className="min-h-12 min-w-0 flex-col gap-1 whitespace-normal px-1 py-2 text-xs leading-snug sm:flex-row"><Gift className="h-3.5 w-3.5 shrink-0" /><span>{t("order.tabCodes")}{codeList.length ? ` · ${codeList.length}` : ""}</span></TabsTrigger>
        {showGuide && <TabsTrigger value="guide" className="min-h-12 min-w-0 flex-col gap-1 whitespace-normal px-1 py-2 text-xs leading-snug sm:flex-row"><BookOpen className="h-3.5 w-3.5 shrink-0" /><span>{t("order.tabGuide")}</span></TabsTrigger>}
        <TabsTrigger value="games" className="min-h-12 min-w-0 flex-col gap-1 whitespace-normal px-1 py-2 text-xs leading-snug sm:flex-row"><Gamepad2 className="h-3.5 w-3.5 shrink-0" /><span>{t("order.tabGames")}</span></TabsTrigger>
      </TabsList>

      <TabsContent value="codes" className="min-w-0 space-y-2">
        {codeList.map((c, i) => (
          <div key={c.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2 gap-y-1 rounded-xl bg-background/60 p-3">
            <p className="min-w-0 whitespace-pre-wrap font-mono text-sm leading-relaxed">{codeList.length > 1 ? `${i + 1}. ` : ""}{c.content}</p>
            <Button size="icon" variant="ghost" aria-label={t("common.copy")} className="size-9 shrink-0" onClick={() => copy(c.content)}><Copy className="h-3.5 w-3.5" /></Button>
            {c.received_at && <span className="col-span-2 flex w-fit max-w-full items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"><CheckCircle2 className="h-3 w-3 shrink-0" />{t("order.codeReceived")}</span>}
          </div>
        ))}
        {!codeList.length && deliveredContent && (
          <div className="rounded-xl bg-background/60 p-3"><p className="whitespace-pre-wrap break-all font-mono text-sm">{deliveredContent}</p></div>
        )}
        {!codeList.length && !deliveredContent && <p className="text-sm text-muted-foreground">{t("order.codePending")}</p>}
        <div className="flex min-w-0 flex-wrap gap-2">
          {codeList.length > 1 && <Button size="sm" variant="secondary" className="h-auto min-h-9 max-w-full whitespace-normal py-2" onClick={() => copy(codeList.map(c => c.content).join("\n"))}><Copy /> {t("common.copy")}</Button>}
          {isBuyer && !!deliveredContent && <Button size="sm" variant="outline" className="h-auto min-h-9 min-w-0 max-w-full whitespace-normal py-2" disabled={busy} onClick={() => resend(() => resendCode({ data: { orderId } }))}><Send /> {t("order.resend")}</Button>}
        </div>
      </TabsContent>

      {showGuide && (
        <TabsContent value="guide" className="min-w-0 rounded-xl bg-primary/5 p-3">
          <p className="mb-1 flex items-start gap-1.5 text-sm font-semibold text-primary"><BookOpen className="h-4 w-4 shrink-0" />{t("extra.guideTitle")}</p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{buyerGuide}</p>
        </TabsContent>
      )}

      <TabsContent value="games" className="min-w-0 space-y-2">
        {gameList.map(r => (
          <div key={r.id} className="min-w-0 space-y-2 rounded-xl bg-background/60 p-3">
            <p className="text-sm font-medium leading-relaxed">{r.shop_quizzes?.title}</p>
            <p className="text-xs text-muted-foreground">{shortDate(r.created_at)}</p>
            <p className="text-xs leading-relaxed text-accent">+{r.points} {t("order.gamePoints")}{r.entries ? ` · +${r.entries} ${t("order.gameSpins")}` : ""}</p>
            {r.delivered_content && (
              <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                <p className="min-w-0 flex-1 break-all whitespace-pre-wrap font-mono text-sm">{r.delivered_content}</p>
                <Button size="icon" variant="ghost" aria-label={t("common.copy")} className="size-9 shrink-0" onClick={() => { if (r.delivered_content) copy(r.delivered_content); }}><Copy className="h-3.5 w-3.5" /></Button>
              </div>
            )}
            {isBuyer && ["pending", "failed"].includes(r.telegram_state) && r.delivered_content && (
              <Button size="sm" variant="outline" className="h-auto min-h-9 min-w-0 max-w-full whitespace-normal py-2" disabled={busy} onClick={() => resend(() => resendGame({ data: { id: r.id, quiz: true } }))}><Send /> {t("order.resend")}</Button>
            )}
          </div>
        ))}
        {!gameList.length && <p className="text-sm text-muted-foreground">{t("order.noGames")}</p>}
      </TabsContent>
    </Tabs>
  );
}
