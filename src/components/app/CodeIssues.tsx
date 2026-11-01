import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AlertTriangle, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, StatusPill, errMsg } from "./ui-bits";
import { reportCodeIssue, resolveCodeIssue } from "@/functions/code-issues.functions";
import { shortDate } from "@/lib/format";

export function CodeIssues({ orderId, isBuyer, isSeller, eligible }: { orderId: string; isBuyer: boolean; isSeller: boolean; eligible: boolean }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const report = useServerFn(reportCodeIssue);
  const resolve = useServerFn(resolveCodeIssue);
  const [codeId, setCodeId] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState<Record<string,string>>({});
  const [busy, setBusy] = useState(false);
  const { data, error } = useQuery({ queryKey: ["codeIssues",orderId], queryFn: async () => {
    const [codes,issues,events] = await Promise.all([
      supabase.from("product_codes").select("id,content").eq("order_id",orderId).eq("status","sold"),
      supabase.from("code_issues").select("*").eq("order_id",orderId).order("created_at"),
      supabase.from("code_issue_events").select("*").eq("order_id",orderId).order("created_at"),
    ]);
    if (codes.error || issues.error || events.error) throw new Error(codes.error?.message ?? issues.error?.message ?? events.error?.message);
    return { codes: codes.data ?? [], issues: issues.data ?? [], events: events.data ?? [] };
  } });
  const available = data?.codes.filter(c => !data.issues.some(i => i.code_id===c.id && ["open","reviewing"].includes(i.status))) ?? [];
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try { await fn(); setDescription(""); setCodeId(""); await qc.invalidateQueries(); toast.success(t("common.saved")); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  if (error) return <p role="alert" className="text-sm text-destructive">{errMsg(error)}</p>;
  return <section className="space-y-4 border-t border-border pt-4">
    {isBuyer && eligible && available.length>0 && <div className="space-y-3">
      <h2 className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4 text-warning" />{t("codeIssue.title")}</h2>
      <Field label={t("codeIssue.code")}><Select value={codeId} onValueChange={setCodeId}><SelectTrigger><SelectValue placeholder={t("codeIssue.code")} /></SelectTrigger><SelectContent>{available.map((c,n)=><SelectItem key={c.id} value={c.id}>{n+1}. {c.content.slice(0,60)}</SelectItem>)}</SelectContent></Select></Field>
      <Field label={t("codeIssue.description")}><Textarea value={description} onChange={e=>setDescription(e.target.value)} maxLength={2000} rows={3} /></Field>
      <Button disabled={busy || !codeId || description.trim().length<10} onClick={()=>run(()=>report({data:{orderId,codeId,description}}))}>{t("codeIssue.send")}</Button>
    </div>}
    {data?.issues.map(i=><article key={i.id} className="space-y-2 rounded-lg border border-border p-3">
      <StatusPill status={i.status==="replaced"?"completed":i.status} label={t(`codeIssue.${i.status}`)} />
      <p className="whitespace-pre-wrap break-words text-sm">{i.description}</p>
      {isSeller && ["open","reviewing"].includes(i.status) && <div className="space-y-2">
        <Field label={t("codeIssue.note")}><Textarea rows={2} maxLength={2000} value={notes[i.id]??""} onChange={e=>setNotes({...notes,[i.id]:e.target.value})} /></Field>
        <div className="flex flex-wrap gap-2">{(["reviewing","replaced","rejected"] as const).filter(a=>a!=="reviewing" || i.status==="open").map(a=><Button key={a} size="sm" variant={a==="replaced"?"default":"outline"} disabled={busy || (notes[i.id]??"").trim().length<2} onClick={()=>run(()=>resolve({data:{issueId:i.id,action:a,note:notes[i.id]??""}}))}>{t(`codeIssue.${a==="reviewing"?"review":a==="replaced"?"replace":"reject"}`)}</Button>)}</div>
      </div>}
    </article>)}
    {!!data?.events.length && <div className="space-y-3"><h2 className="flex items-center gap-2 font-semibold"><History className="h-4 w-4" />{t("codeIssue.history")}</h2>{data.events.map(e=><div key={e.id} className="border-l-2 border-border pl-3 text-sm"><p className="font-medium">{t(`codeIssue.${e.action}`)} <span className="text-xs text-muted-foreground">· {shortDate(e.created_at)}</span></p><p className="whitespace-pre-wrap break-words">{e.note}</p>{e.old_content && <p className="break-all font-mono text-xs text-muted-foreground">{t("codeIssue.old")}: {e.old_content}</p>}{e.new_content && <p className="break-all font-mono text-xs text-accent">{t("codeIssue.new")}: {e.new_content}</p>}</div>)}</div>}
  </section>;
}