import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarCheck, Coins, ExternalLink, Gift, ListChecks, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Countdown, EmptyState, PageHeader, Section, errMsg } from "@/components/app/ui-bits";
import { useAuth } from "@/lib/auth";
import { myRewardsQuery, rewardsQuery } from "@/lib/queries";
import { claimTask, dailyCheckin, enterDraw } from "@/functions/rewards.functions";
import { shortDate } from "@/lib/format";
import { useGrowthText } from '@/lib/growth-text';

export const Route = createFileRoute("/rewards")({
  head: () => ({ meta: [{ title: "Rewards · TeleShop" }, { name: "description", content: "Daily check-in, tasks and lucky draws to earn TeleShop reward points." }, { property: "og:title", content: "Rewards · TeleShop" }, { property: "og:description", content: "Check in, complete tasks and join lucky draws." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Rewards,
});

const todayVN = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

function Rewards() {
  const growth = useGrowthText();
  const { t } = useTranslation();
  const { userId, session } = useAuth();
  const qc = useQueryClient();
  const pub = useQuery(rewardsQuery());
  const [pages,setPages]=useState(1);
  const mine = useQuery({ ...myRewardsQuery(userId ?? "",pages), enabled: !!userId });
  const checkin = useServerFn(dailyCheckin);
  const claim = useServerFn(claimTask);
  const enter = useServerFn(enterDraw);
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try { await fn(); toast.success(ok); await qc.invalidateQueries({ queryKey: ["myRewards"] }); await qc.invalidateQueries({ queryKey: ["rewards"] }); }
    catch (e) { toast.error(errMsg(e)); }
    finally { setBusy(null); }
  };

  const balance = mine.data?.balance ?? "—";
  const last = mine.data?.lastCheckin;
  const doneToday = last?.day === todayVN();
  const now = Date.now();

  return (
    <div>
      <PageHeader title={t("rewards.title")} />
      <div className="space-y-5 p-4">
        <Button asChild variant="outline" className="w-full"><Link to="/growth"><Gift/>{growth.title}</Link></Button>
        <div className="rounded-2xl border border-border bg-hero p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">{t("rewards.points")}</p>
              <p className="flex items-center gap-2 font-display text-3xl font-bold"><Coins className="h-6 w-6 text-primary" />{session ? balance : "—"}</p>
              {last && <p className="text-xs text-muted-foreground">{t("rewards.streak", { n: last.streak })}</p>}
            </div>
            {session ? (
              <Button disabled={doneToday || busy === "ck"} onClick={() => run("ck", () => checkin(), t("rewards.checkedIn"))}>
                <CalendarCheck /> {doneToday ? t("rewards.checkedIn") : t("rewards.checkin")}
              </Button>
            ) : <Button asChild><Link to="/auth">{t("rewards.signIn")}</Link></Button>}
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">{t("rewards.bonusHint")}</p>
        </div>

        <Section title={t("rewards.tasks")}>
          {pub.data?.tasks.length ? (
            <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {pub.data.tasks.map((task) => {
                const done = mine.data?.done.includes(task.id);
                return (
                  <div key={task.id} className="flex items-center gap-3 p-3">
                    <ListChecks className="h-5 w-5 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{task.title}</p>
                      <p className="text-[11px] text-muted-foreground">{task.shops?.name ?? t("rewards.platform")} · {t(`rewards.k_${task.kind}`)} · +{task.points} {t("rewards.ptsUnit")}</p>
                    </div>
                    {(task.link_url || (task.kind === "join_channel" && task.target?.startsWith("@"))) && !done && (
                      <a href={task.link_url ?? `https://t.me/${task.target?.slice(1)}`} target="_blank" rel="noreferrer" className="text-primary" aria-label={t("rewards.go")}><ExternalLink className="h-4 w-4" /></a>
                    )}
                    <Button size="sm" variant={done ? "secondary" : "default"} disabled={!session || done || busy === task.id} onClick={() => run(task.id, () => claim({ data: { taskId: task.id } }), `+${task.points}`)}>
                      {done ? t("rewards.claimed") : t("rewards.claim")}
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : <EmptyState icon={ListChecks} title={t("rewards.empty")} />}
        </Section>

        <Section title={t("rewards.draws")}>
          {pub.data?.draws.length ? (
            <div className="space-y-3">
              {pub.data.draws.map((d) => {
                const n = mine.data?.entries.filter((x) => x === d.id).length ?? 0;
                const started = new Date(d.starts_at).getTime() <= now;
                const ended = new Date(d.ends_at).getTime() <= now;
                return (
                  <div key={d.id} className="overflow-hidden rounded-2xl border border-border bg-card">
                    {d.image_url && <img src={d.image_url} alt={d.title} className="h-32 w-full object-cover" />}
                    <div className="space-y-2 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-display font-semibold">{d.title}</p>
                          <p className="text-[11px] text-muted-foreground">{d.shops?.name ?? t("rewards.platform")}</p>
                        </div>
                        <span className="rounded-lg bg-primary/10 px-2 py-1 text-xs text-primary">{d.entry_cost ? `${d.entry_cost} ${t("rewards.ptsUnit")}` : t("rewards.free")}</span>
                      </div>
                      <p className="flex items-center gap-2 text-sm"><Gift className="h-4 w-4 text-accent" />{d.prize}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.status === "drawn" ? t("rewards.drawn") : !started ? <>{t("rewards.startsAt")} {shortDate(d.starts_at)}</> : ended ? t("rewards.ended") : <>{t("rewards.endsAt")} <Countdown end={d.ends_at} className="font-semibold text-foreground" /></>}
                        {" · "}{t("rewards.winnersCount")}: {d.winners_count}
                      </p>
                      {d.status === "drawn" ? (
                        <div className="rounded-xl bg-secondary p-2 text-sm">
                          <p className="mb-1 flex items-center gap-1 font-medium"><Trophy className="h-4 w-4 text-warning" />{t("rewards.winners")}</p>
                          {d.draw_winners.length ? [...d.draw_winners].sort((a, b) => a.rank - b.rank).map((w) => <p key={w.rank} className="text-xs">#{w.rank} {w.display_name}</p>) : <p className="text-xs text-muted-foreground">{t("rewards.empty")}</p>}
                        </div>
                      ) : session && started && !ended ? (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">{t("rewards.entries", { n, max: d.max_entries_per_user })}</span>
                          <Button size="sm" disabled={n >= d.max_entries_per_user || busy === d.id} onClick={() => run(d.id, () => enter({ data: { drawId: d.id } }), t("rewards.enter"))}>{t("rewards.enter")}</Button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <EmptyState icon={Gift} title={t("rewards.empty")} />}
        </Section>

        {!!mine.data?.points.length && (
          <Section title={t("rewards.history")}>
            <div className="divide-y divide-border rounded-2xl border border-border bg-card text-sm">
              {mine.data.points.map((p, i) => (
                <div key={i} className="flex justify-between px-3 py-2"><span className="truncate text-muted-foreground">{p.note ?? p.source} · {shortDate(p.created_at)}</span><span className={p.amount > 0 ? "text-success" : "text-destructive"}>{p.amount > 0 ? "+" : ""}{p.amount}</span></div>
              ))}
            </div>
          {mine.data.points.length===pages*20&&<Button variant="outline" className="w-full" onClick={()=>setPages(n=>n+1)}>Tải thêm</Button>}
          </Section>
        )}
      </div>
    </div>
  );
}
