import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowDownLeft, ArrowUpRight, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, Field, PageHeader, Section, StatusPill, errMsg } from "@/components/app/ui-bits";
import { getWallet, requestWithdrawal } from "@/functions/orders.functions";
import { money, shortDate } from "@/lib/format";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/wallet")({
  head: () => ({ meta: [{ title: "Wallet · TeleShop" }, { name: "description", content: "Your USDT and TON balances, escrow and withdrawals." }, { property: "og:title", content: "Wallet · TeleShop" }, { property: "og:description", content: "Balances and withdrawals." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: WalletPage,
});

function WalletPage() {
  const { t } = useTranslation();
  const { userId } = useAuth();
  const qc = useQueryClient();
  const fetchWallet = useServerFn(getWallet);
  const withdraw = useServerFn(requestWithdrawal);
  const { data, isLoading } = useQuery({ queryKey: ["wallet", userId], queryFn: () => fetchWallet(), enabled: !!userId });
  const [cur, setCur] = useState<"USDT" | "TON">("USDT");
  const [amount, setAmount] = useState("");
  const [address, setAddress] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const b = data?.balances[cur] ?? { available: 0, pendingWithdraw: 0, escrow: 0 };

  const submit = async () => {
    setBusy(true);
    try {
      await withdraw({ data: { amount: Number(amount), currency: cur, address: address.trim() } });
      toast.success(t("wallet.success"));
      setOpen(false);
      setAmount("");
      await qc.invalidateQueries({ queryKey: ["wallet"] });
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title={t("wallet.title")} back={false} />
      <div className="space-y-5 p-4">
        <Tabs value={cur} onValueChange={(v) => setCur(v as "USDT" | "TON")}>
          <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="USDT">USDT</TabsTrigger><TabsTrigger value="TON">TON</TabsTrigger></TabsList>
        </Tabs>
        {isLoading ? <Skeleton className="h-40 rounded-2xl" /> : (
          <div className="rounded-3xl border border-border bg-hero p-5 shadow-glow">
            <p className="text-sm text-muted-foreground">{t("wallet.available")}</p>
            <p className="tabular mt-1 font-display text-4xl font-bold">{money(b.available, cur)}</p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-background/50 p-3"><p className="text-xs text-muted-foreground">{t("wallet.escrow")}</p><p className="tabular font-semibold">{money(b.escrow)}</p></div>
              <div className="rounded-xl bg-background/50 p-3"><p className="text-xs text-muted-foreground">{t("wallet.pendingW")}</p><p className="tabular font-semibold">{money(b.pendingWithdraw)}</p></div>
            </div>
            <Button className="mt-4 w-full" variant="secondary" onClick={() => setOpen((v) => !v)} disabled={b.available <= 0}><ArrowUpRight /> {t("wallet.withdraw")}</Button>
          </div>
        )}
        {open && (
          <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
            <Field label={`${t("wallet.amount")} (${cur})`}><Input type="number" inputMode="decimal" min={1} max={b.available} value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
            <Field label={t("wallet.address")} hint={t("wallet.minNote")}><Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder={cur === "TON" ? "UQ…" : "T… / 0x…"} /></Field>
            <Button className="w-full" onClick={submit} disabled={busy || !(Number(amount) >= 1) || Number(amount) > b.available || address.trim().length < 20}>{t("wallet.submit")}</Button>
          </div>
        )}
        <Section title={t("wallet.history")}>
          {data?.transactions.length === 0 && <EmptyState icon={Wallet} title={t("wallet.empty")} />}
          <div className="space-y-2">
            {data?.transactions.map((tx) => {
              const neg = Number(tx.amount) < 0;
              return (
                <div key={tx.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                  <span className={`rounded-lg p-2 ${neg ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}>{neg ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{t(`wallet.types.${tx.type}`)}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{tx.description} · {shortDate(tx.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <p className={`tabular text-sm font-semibold ${neg ? "" : "text-success"}`}>{neg ? "" : "+"}{money(tx.amount, tx.currency)}</p>
                    {tx.status !== "completed" && <StatusPill status={tx.status} label={t(`wallet.tstatus.${tx.status}`)} />}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      </div>
    </div>
  );
}
