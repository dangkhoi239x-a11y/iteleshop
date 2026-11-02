import { useId } from 'react';
const tones=['var(--primary)','var(--accent)','var(--warning)','var(--success)','var(--flash)','var(--secondary)','var(--chart-5)','var(--chart-1)'];
export function PrizeWheel({prizes,rotation}:{prizes:{id:string;label:string}[];rotation:number}){
 const id=useId();const n=prizes.length;
 return <div className="relative mx-auto w-full max-w-80 aspect-square">
  <span className="absolute left-1/2 -top-1 z-10 -translate-x-1/2 text-warning text-3xl" aria-hidden>▼</span>
  <svg viewBox="0 0 320 320" role="img" aria-label="Prize wheel" className="h-full w-full" style={{transform:`rotate(${rotation}deg)`,transition:'transform 2s cubic-bezier(.15,.7,.15,1)'}}>
   <defs><filter id={id}><feDropShadow dx="0" dy="3" stdDeviation="2" floodColor="var(--background)" /></filter></defs>
   {prizes.map((p,i)=>{const a=(i*360/n-90)*Math.PI/180,b=((i+1)*360/n-90)*Math.PI/180,m=(a+b)/2;return <g key={p.id}><path d={`M160 160 L${160+148*Math.cos(a)} ${160+148*Math.sin(a)} A148 148 0 ${360/n>180?1:0} 1 ${160+148*Math.cos(b)} ${160+148*Math.sin(b)} Z`} fill={tones[i]} stroke="var(--background)" strokeWidth="3"/><text x={160+104*Math.cos(m)} y={160+104*Math.sin(m)} textAnchor="middle" dominantBaseline="central" fill="var(--primary-foreground)" fontSize="20" fontWeight="700">{i+1}</text></g>})}
   <circle cx="160" cy="160" r="34" fill="var(--card)" stroke="var(--foreground)" strokeWidth="3"/><text x="160" y="166" textAnchor="middle" fontSize="16" fontWeight="700" fill="var(--foreground)">🎁</text>
  </svg>
 </div>;
}