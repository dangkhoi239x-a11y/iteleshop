import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getRecommendations } from "@/functions/recommendations.functions";
import { useAuth } from "@/lib/auth";
import { ProductCard, Field, errMsg } from "./ui-bits";

export function AiRecommendations({ shopId }: { shopId?: string }) {
  const { t, i18n } = useTranslation();
  const { session } = useAuth();
  const recommend = useServerFn(getRecommendations);
  const [need,setNeed] = useState("");
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [result,setResult] = useState<Awaited<ReturnType<typeof getRecommendations>> | null>(null);
  const submit = async () => {
    setBusy(true); setError(""); setResult(null);
    try { const language = ["vi","en","ru","zh"].includes(i18n.language) ? i18n.language as "vi"|"en"|"ru"|"zh" : "vi"; setResult(await recommend({data:{need,language,shopId}})); }
    catch(e) { setError(errMsg(e)); } finally { setBusy(false); }
  };
  return <section className="space-y-3 border-y border-border py-4">
    <h2 className="flex items-center gap-2 font-display font-semibold"><Sparkles className="h-5 w-5 text-accent" />{t("ai.title")}</h2>
    <Field label={t("ai.need")}><Textarea value={need} onChange={e=>setNeed(e.target.value)} placeholder={t("ai.placeholder")} maxLength={1500} rows={3} /></Field>
    {session ? <Button disabled={busy || need.trim().length<5} onClick={submit}>{busy?<Loader2 className="animate-spin" />:<Sparkles />}{busy?t("common.loading"):t("ai.submit")}</Button> : <Button asChild variant="outline"><Link to="/auth">{t("common.signIn")}</Link></Button>}
    {error && <p role="alert" className="break-words text-sm text-destructive">{error}</p>}
    {result && <div className="space-y-3" aria-live="polite"><p className="text-sm">{result.emptyCatalog?t("ai.empty"):result.summary || t("ai.noMatch")}</p><div className="grid grid-cols-2 gap-3">{result.items.map(({product,reason})=><div key={product.id} className="min-w-0 space-y-2"><ProductCard p={product} /><p className="break-words text-xs text-muted-foreground">{reason}</p></div>)}</div></div>}
  </section>;
}