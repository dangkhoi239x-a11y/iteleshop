import { Copy, Share2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { shareLink } from '@/lib/telegram';
import { storefrontText } from '@/locales/storefront';

export function ShareActions({ path, name }: { path: string; name: string }) {
 const { i18n } = useTranslation(); const text = storefrontText(i18n.language);
 const url = () => `https://iteleshop.lovable.app${path}`;
 return <div className="flex shrink-0 gap-1">
  <Button variant="ghost" size="icon" title={text.share} aria-label={text.share} onClick={()=>shareLink(url(),name)}><Share2 /></Button>
  <Button variant="ghost" size="icon" title={text.copy} aria-label={text.copy} onClick={async()=>{try{await navigator.clipboard.writeText(url());toast.success(text.copied);}catch{toast.error(text.copy);}}}><Copy /></Button>
 </div>;
}
