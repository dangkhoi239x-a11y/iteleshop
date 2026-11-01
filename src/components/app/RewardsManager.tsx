import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, Field, Section, errMsg } from "@/components/app/ui-bits";
import { managedRewardsQuery } from "@/lib/queries";
import { TASK_KINDS, type TaskKind } from "@/lib/rewards";
import { runDraw, saveDraw, saveTask, toggleTask } from "@/functions/rewards.functions";
import { shortDate } from "@/lib/format";

const toLocal = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export function RewardsManager({ shopId }: { shopId: string | null }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data } = useQuery(managedRewardsQuery(shopId));
  const fSaveTask = useServerFn(saveTask);
  const fToggle = useServerFn(toggleTask);
  const fSaveDraw = useServerFn(saveDraw);
  const fRun = useServerFn(runDraw);
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ["managedRewards"] }), qc.invalidateQueries({ queryKey: ["rewards"] })]);
  const act = async (fn: () => Promise<unknown>) => { try { await fn(); toast.success(t("common.saved")); await refresh(); return true; } catch (e) { toast.error(errMsg(e)); return false; } };

  const kinds = shopId ? TASK_KINDS.filter((k) => k !== "invite") : TASK_KINDS;
  const [tk, setTk] = useState({ title: "", kind: "custom" as TaskKind, target: "", amount: "", link: "", points: "50" });
  const [dr, setDr] = useState({ title: "", prize: "", image: "", cost: "0", max: "1", winners: "1", starts: toLocal(new Date()), ends: toLocal(new Date(Date.now() + 7 * 86400000)) });

  const submitTask = async () => {
    if (await act(() => fSaveTask({ data: { shopId, title: tk.title, kind: tk.kind, target: tk.target || undefined, targetAmount: Number(tk.amount || 0), linkUrl: tk.link, points: Number(tk.points) } })))
      setTk({ ...tk, title: "", target: "", amount: "", link: "" });
  };
  const submitDraw = async () => {
    if (await act(() => fSaveDraw({ data: { shopId, title: dr.title, prize: dr.prize, imageUrl: dr.image, entryCost: Number(dr.cost), maxEntries: Number(dr.max), winners: Number(dr.winners), startsAt: new Date(dr.starts).toISOString(), endsAt: new Date(dr.ends).toISOString() } })))
      setDr({ ...dr, title: "", prize: "", image: "" });
  };

  return (
    <div className="space-y-6 p-4">
      <Section title={t("rewards.newTask")}>
        <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <Field label={t("rewards.taskTitle")}><Input value={tk.title} onChange={(e) => setTk({ ...tk, title: e.target.value })} /></Field>
          <Field label={t("rewards.kind")}>
            <Select value={tk.kind} onValueChange={(v) => setTk({ ...tk, kind: v as TaskKind })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{kinds.map((k) => <SelectItem key={k} value={k}>{t(`rewards.k_${k}`)}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          {tk.kind === "join_channel" && <Field label={t("rewards.target")}><Input value={tk.target} placeholder="@channel" onChange={(e) => setTk({ ...tk, target: e.target.value })} /></Field>}
          {(tk.kind === "invite" || tk.kind === "spend") && <Field label={t("rewards.targetAmount")}><Input type="number" min={1} value={tk.amount} onChange={(e) => setTk({ ...tk, amount: e.target.value })} /></Field>}
          <Field label={t("rewards.link")}><Input value={tk.link} placeholder="https://" onChange={(e) => setTk({ ...tk, link: e.target.value })} /></Field>
          <Field label={t("rewards.points")}><Input type="number" min={1} value={tk.points} onChange={(e) => setTk({ ...tk, points: e.target.value })} /></Field>
          <Button className="w-full" onClick={submitTask} disabled={!tk.title}>{t("rewards.newTask")}</Button>
        </div>
      </Section>

      <Section title={t("rewards.tasks")}>
        {data?.tasks.length ? (
          <div className="divide-y divide-border rounded-2xl border border-border bg-card">
            {data.tasks.map((x) => (
              <div key={x.id} className="flex items-center gap-3 p-3 text-sm">
                <div className="min-w-0 flex-1"><p className="truncate font-medium">{x.title}</p><p className="text-[11px] text-muted-foreground">{t(`rewards.k_${x.kind}`)} · +{x.points}</p></div>
                <Switch checked={x.is_active} onCheckedChange={(v) => act(() => fToggle({ data: { id: x.id, active: v } }))} aria-label={t("rewards.active")} />
              </div>
            ))}
          </div>
        ) : <EmptyState title={t("rewards.empty")} />}
      </Section>

      <Section title={t("rewards.newDraw")}>
        <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <Field label={t("rewards.taskTitle")}><Input value={dr.title} onChange={(e) => setDr({ ...dr, title: e.target.value })} /></Field>
          <Field label={t("rewards.prize")}><Input value={dr.prize} onChange={(e) => setDr({ ...dr, prize: e.target.value })} /></Field>
          <Field label="Image URL" hint={t("common.optional")}><Input value={dr.image} placeholder="https://" onChange={(e) => setDr({ ...dr, image: e.target.value })} /></Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label={t("rewards.cost")}><Input type="number" min={0} value={dr.cost} onChange={(e) => setDr({ ...dr, cost: e.target.value })} /></Field>
            <Field label={t("rewards.maxEntries")}><Input type="number" min={1} value={dr.max} onChange={(e) => setDr({ ...dr, max: e.target.value })} /></Field>
            <Field label={t("rewards.winnersCount")}><Input type="number" min={1} value={dr.winners} onChange={(e) => setDr({ ...dr, winners: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t("rewards.startsAt")}><Input type="datetime-local" value={dr.starts} onChange={(e) => setDr({ ...dr, starts: e.target.value })} /></Field>
            <Field label={t("rewards.endsAt")}><Input type="datetime-local" value={dr.ends} onChange={(e) => setDr({ ...dr, ends: e.target.value })} /></Field>
          </div>
          <Button className="w-full" onClick={submitDraw} disabled={!dr.title || !dr.prize}>{t("rewards.newDraw")}</Button>
        </div>
      </Section>

      <Section title={t("rewards.draws")}>
        {data?.draws.length ? (
          <div className="divide-y divide-border rounded-2xl border border-border bg-card">
            {data.draws.map((d) => (
              <div key={d.id} className="space-y-1 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-medium">{d.title}</p>
                  {d.status === "open" && <Button size="sm" disabled={new Date(d.ends_at).getTime() > Date.now()} onClick={() => act(() => fRun({ data: { drawId: d.id } }))}>{t("rewards.run")}</Button>}
                </div>
                <p className="text-[11px] text-muted-foreground">{shortDate(d.starts_at)} → {shortDate(d.ends_at)} · {d.status === "drawn" ? t("rewards.drawn") : d.status}</p>
                {d.status === "drawn" && <p className="text-xs">{t("rewards.winners")}: {d.draw_winners.map((w) => w.display_name).join(", ") || "—"}</p>}
              </div>
            ))}
          </div>
        ) : <EmptyState title={t("rewards.empty")} />}
      </Section>
    </div>
  );
}
