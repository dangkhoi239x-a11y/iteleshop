import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { ShopGate } from '@/components/app/ShopGate';
import { EmptyState, PageHeader } from '@/components/app/ui-bits';
import { Button } from '@/components/ui/button';
import { getGrowthBudget } from '@/functions/growth-budget.functions';
import { forecastBudget } from '@/lib/growth-budget';
import { useAuth } from '@/hooks/useAuth';

export const Route = createFileRoute('/_authenticated/dashboard/budget')({ head: () => ({ meta: [{ title: 'Ngân sách chiến dịch · TeleShop' }, { name: 'description', content: 'Pool budget, delivered prizes, remaining stock and forecasts per shop campaign.' }, { property: 'og:title', content: 'Ngân sách chiến dịch · TeleShop' }, { property: 'og:description', content: 'Track prize pool budget and forecasts for each campaign.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }), component: Page });

const fmt = (n: number, d = 2) => n.toLocaleString('vi-VN', { maximumFractionDigits: d });
function Budget({ shopId }: { shopId: string }) {
 const { userId } = useAuth(); const get = useServerFn(getGrowthBudget);
 const q = useQuery({ queryKey: ['growth-budget', userId, shopId], queryFn: () => get({ data: { shopId } }) });
 if (q.isPending) return <EmptyState title="Đang tải…" />;
 if (q.isError) return <EmptyState title={q.error.message} action={<Button onClick={() => q.refetch()}>Thử lại</Button>} />;
 if (!q.data.length) return <EmptyState title="Chưa có chiến dịch" />;
 const rows = q.data.map(c => ({ c, f: forecastBudget(c) }));
 const sum = rows.reduce((s, { c, f }) => ({ ton: s.ton + c.budgetTon, left: s.left + f.remainingTon, del: s.del + c.delivered, rem: s.rem + c.remaining }), { ton: 0, left: 0, del: 0, rem: 0 });
 const Stat = ({ k, v }: { k: string; v: string }) => <div className="rounded-lg border border-border bg-card p-3"><p className="text-xs text-muted-foreground">{k}</p><p className="text-lg font-semibold">{v}</p></div>;
 return <div className="space-y-4">
  <div className="grid grid-cols-2 gap-2"><Stat k="Tổng pool (TON dự kiến)" v={fmt(sum.ton)} /><Stat k="Pool còn lại (TON)" v={fmt(sum.left)} /><Stat k="Giải đã giao" v={fmt(sum.del, 0)} /><Stat k="Giải còn lại" v={fmt(sum.rem, 0)} /></div>
  <p className="text-xs text-muted-foreground">TON là ngân sách dự kiến, chưa nạp thật; phân bổ đều theo số giải. Dự báo dựa trên tốc độ giao giải từ lúc bắt đầu.</p>
  {rows.map(({ c, f }) => <section key={c.id} className="rounded-lg border border-border bg-card p-4 space-y-2">
   <div className="flex justify-between gap-2"><h2 className="font-semibold break-words">{c.title}</h2><span className="text-xs text-muted-foreground">{c.status}</span></div>
   <div className="h-2 rounded bg-muted overflow-hidden"><div className="h-full bg-accent" style={{ width: `${f.total ? (c.delivered / f.total) * 100 : 0}%` }} /></div>
   <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
    <span>Đã giao: <b>{c.delivered}</b>/{f.total}</span><span>Còn lại: <b>{c.remaining}</b></span>
    <span>Voucher quiz: <b>{c.vouchers}</b></span><span>Tốc độ: <b>{fmt(f.perDay, 1)}</b>/ngày</span>
    <span>TON đã dùng: <b>{fmt(f.usedTon)}</b></span><span>TON còn: <b>{fmt(f.remainingTon)}</b></span>
    <span>Dự báo giao: <b>{f.projected}</b></span><span>Dự báo dư: <b>{f.leftover}</b></span>
   </div>
   <p className="text-xs text-muted-foreground">{f.depletesAt ? `Dự kiến hết giải: ${new Date(f.depletesAt).toLocaleDateString('vi-VN')}` : 'Không hết giải trước khi kết thúc'} · Kết thúc {new Date(c.endsAt).toLocaleDateString('vi-VN')}</p>
  </section>)}
 </div>;
}
function Page() { return <ShopGate>{shop => <div><PageHeader title="Ngân sách chiến dịch" /><div className="p-4"><Budget shopId={shop.id} /></div></div>}</ShopGate>; }
