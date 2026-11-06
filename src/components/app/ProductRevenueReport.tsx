import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useTranslation } from 'react-i18next';
import { getProductRevenue } from '@/functions/revenue.functions';
import { money } from '@/lib/format';
import { useAuth } from '@/lib/auth';
const L = {
 vi: { title: 'Doanh thu theo ngày & sản phẩm', day: 'Ngày', product: 'Sản phẩm', orders: 'Đơn', units: 'Số lượng', gross: 'Doanh thu', net: 'Thực nhận', codes: 'Mã đã giao', received: 'Đã nhận', disputed: 'Đang tranh chấp', empty: 'Chưa có đơn trong khoảng này.', loading: 'Đang tải…', failed: 'Không tải được báo cáo.' },
 en: { title: 'Revenue by day & product', day: 'Day', product: 'Product', orders: 'Orders', units: 'Units', gross: 'Revenue', net: 'Net', codes: 'Codes delivered', received: 'Received', disputed: 'In dispute', empty: 'No orders in this range.', loading: 'Loading…', failed: 'Could not load report.' },
 ru: { title: 'Выручка по дням и товарам', day: 'День', product: 'Товар', orders: 'Заказы', units: 'Кол-во', gross: 'Выручка', net: 'Чистыми', codes: 'Выдано кодов', received: 'Получено', disputed: 'В споре', empty: 'Нет заказов за период.', loading: 'Загрузка…', failed: 'Не удалось загрузить отчёт.' },
 zh: { title: '按日期和商品的收入', day: '日期', product: '商品', orders: '订单', units: '数量', gross: '收入', net: '净额', codes: '已发码', received: '已收货', disputed: '争议中', empty: '此期间无订单。', loading: '加载中…', failed: '无法加载报告。' },
};
export function ProductRevenueReport({ from, to, shopId }: { from: string; to: string; shopId?: string | undefined }) {
 const { i18n } = useTranslation(); const t = L[i18n.language.slice(0, 2) as keyof typeof L] ?? L.vi;
 const { userId } = useAuth(); const fetchReport = useServerFn(getProductRevenue);
 const { data, isPending, isError } = useQuery({ queryKey: ['product-revenue', userId, from, to, shopId ?? 'all'], queryFn: () => fetchReport({ data: { from, to, ...(shopId ? { shopId } : {}) } }), enabled: !!userId && !!from && !!to && from <= to });
 const name = (id: string) => data?.products.find(p => p.id === id)?.name ?? id.slice(0, 8);
 const rows = data?.rows ?? [];
 const sum = rows.reduce((a, r) => ({ codes: a.codes + r.codes, received: a.received + r.received, disputed: a.disputed + r.disputed }), { codes: 0, received: 0, disputed: 0 });
 return <section className="space-y-3"><h2 className="text-base font-semibold">{t.title}</h2>
  {isError ? <p role="alert" className="text-destructive">{t.failed}</p> : isPending ? <p role="status" className="text-muted-foreground">{t.loading}</p> : !rows.length ? <p className="py-6 text-center text-muted-foreground">{t.empty}</p> : <>
   <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
    <div><p className="text-muted-foreground">{t.codes}</p><p className="text-xl font-semibold tabular-nums">{sum.codes}</p></div>
    <div><p className="text-muted-foreground">{t.received}</p><p className="text-xl font-semibold tabular-nums text-primary">{sum.received}</p></div>
    <div><p className="text-muted-foreground">{t.disputed}</p><p className="text-xl font-semibold tabular-nums text-destructive">{sum.disputed}</p></div>
   </div>
   <div className="overflow-x-auto" role="region" aria-label={t.title} tabIndex={0}><table className="w-full min-w-[760px] text-left text-xs"><thead className="border-b border-border text-muted-foreground"><tr>{[t.day, t.product, t.orders, t.units, t.gross, t.net, t.codes, t.received, t.disputed].map(h => <th key={h} className="px-2 py-2 font-medium">{h}</th>)}</tr></thead>
    <tbody>{rows.map(r => <tr key={`${r.day}${r.productId}${r.currency}`} className="border-b border-border/60"><td className="px-2 py-2 whitespace-nowrap">{r.day}</td><td className="px-2 py-2 max-w-[200px] break-words">{name(r.productId)}</td><td className="px-2 py-2 tabular-nums">{r.orders}</td><td className="px-2 py-2 tabular-nums">{r.units}</td><td className="px-2 py-2 tabular-nums">{money(r.gross, r.currency)}</td><td className="px-2 py-2 tabular-nums">{money(r.net, r.currency)}</td><td className="px-2 py-2 tabular-nums">{r.codes}</td><td className="px-2 py-2 tabular-nums text-primary">{r.received}</td><td className={`px-2 py-2 tabular-nums ${r.disputed ? 'text-destructive font-semibold' : ''}`}>{r.disputed}{r.disputedOrders ? ` (${r.disputedOrders})` : ''}</td></tr>)}</tbody></table></div>
  </>}
 </section>;
}
