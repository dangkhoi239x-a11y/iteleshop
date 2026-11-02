import { createFileRoute } from '@tanstack/react-router';
import { RevenueReport, useFinanceText, useRevenueText } from '@/components/app/RevenueReport';
import { EmptyState, PageHeader } from '@/components/app/ui-bits';
import { useAuth } from '@/lib/auth';

export const Route = createFileRoute('/_authenticated/revenue')({
 head: () => ({ meta: [
  { title: 'Platform revenue by shop and day · TeleShop' },
  { name: 'description', content: 'Actual shop revenue by UTC+7 payment day, with separate Stars and crypto proceeds, escrow and wallet credits.' },
  { property: 'og:title', content: 'Platform revenue by shop and day · TeleShop' },
  { property: 'og:description', content: 'Track realized Stars and crypto proceeds for every TeleShop store.' },
  { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
 ] }),
 component: RevenuePage,
});
function RevenuePage() {
 const { ready, isAdmin } = useAuth();
 const text = useFinanceText(), labels = useRevenueText();
 if (!ready) return <p role="status" className="p-4 text-muted-foreground">{labels.loading}</p>;
 if (!isAdmin) return <EmptyState title="403" sub={labels.denied} />;
 return <div><PageHeader title={text.title} /><div className="p-4"><RevenueReport admin /></div></div>;
}