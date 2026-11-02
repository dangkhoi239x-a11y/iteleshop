import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { Send, Save } from 'lucide-react';
import { telegramAdmin } from '@/functions/telegram-admin.functions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from './ui-bits';
export function TelegramAdmin(){
 const call=useServerFn(telegramAdmin),[name,setName]=useState(''),[chatId,setChatId]=useState(''),[busy,setBusy]=useState(false);
 const {data,error,refetch}=useQuery({queryKey:['telegramAdmin'],queryFn:()=>call({data:{action:'read'}})});
 const run=async(action:'save'|'test',id?:string)=>{setBusy(true);try{await call({data:{action,id,...(action==='save'?{name,chatId}: {})}});await refetch();toast.success('Đã hoàn tất');}catch(e){toast.error(e instanceof Error?e.message:'Không thể thực hiện');}finally{setBusy(false);}};
 return <section className="space-y-4"><h2 className="font-semibold">Kênh Telegram</h2>{error&&<p role="alert" className="text-destructive">Không tải được dữ liệu</p>}<div className="grid gap-3 sm:grid-cols-2"><Field label="Tên kênh"><Input value={name} onChange={e=>setName(e.target.value)}/></Field><Field label="Chat ID"><Input value={chatId} onChange={e=>setChatId(e.target.value)}/></Field></div><Button disabled={busy||name.length<2||! /^-?\d+$/.test(chatId)} onClick={()=>void run('save')}><Save/>Lưu kênh</Button>{data?.channels.map(c=><div key={c.id} className="flex items-center justify-between gap-3 border-b border-border py-3"><span className="break-all">{c.name} · {c.chat_id}</span><Button disabled={busy} variant="outline" size="sm" onClick={()=>void run('test',c.id)}><Send/>Gửi thử</Button></div>)}<h3 className="font-semibold">Lịch sử gửi</h3>{data?.logs.length===0&&<p className="text-muted-foreground">Chưa có lịch sử gửi</p>}{data?.logs.map(l=><div key={l.id} className="border-b border-border py-2 text-sm"><p>{l.chat_id} · {l.status==='sent'?'Đã gửi':'Gửi thất bại'}</p><p className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString()} · {l.error_code??l.message_id}</p></div>)}</section>;
}