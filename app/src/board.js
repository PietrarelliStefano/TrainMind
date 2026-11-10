
/* ===== Attivazione iniziale (mobilità e andature), variata per giorno MD ===== */
const ATT={
 forza:{nome:'Attivazione: mobilità, andature ed elasticità',descrizione:'Mobilità dinamica di anche, caviglie e colonna (3′). Andature su 20 m: skip, calciata, passo accostato e incrociato (4′). Balzi bassi e reattivi, 2 serie da 6 (1′). 3 allunghi progressivi (2′).',coaching:'Appoggi attivi sull’avampiede, busto alto, braccia coordinate.'},
 ampiezza:{nome:'Attivazione: mobilità, andature e allunghi',descrizione:'Mobilità dinamica (3′). Andature ampie su 25 m: skip lungo, corsa calciata, slanci, corsa laterale (4′). 4 allunghi al 70-80% su 40 m con ritorno al passo (3′).',coaching:'Ampiezza del passo, spalle rilassate.'},
 rapidita:{nome:'Attivazione: mobilità, andature e rapidità',descrizione:'Mobilità dinamica (3′). Andature brevi ad alta frequenza su 15 m: skip rapido, doppio appoggio, cambi di direzione (4′). 4 partenze reattive su 10 m a segnale (3′).',coaching:'Frequenza alta, primi passi corti ed esplosivi.'},
 leggera:{nome:'Attivazione: mobilità e andature leggere',descrizione:'Mobilità articolare (4′). Andature tecniche a ritmo blando (4′). 2 allunghi brevi (2′).',coaching:'Sciogliere, nessuna fretta.'}
};
const attKey=md=>(md=normMd(md),{'MD+2':'forza','MD+3':'forza','MD-3':'ampiezza','MD-2':'rapidita','MD-1':'rapidita'}[md]||'leggera');
function attSchema(){
  const el=[];[3,7.5,12,16.5].forEach(y=>{el.push({k:'cono',x:5,y},{k:'cono',x:25,y},{k:'A',x:2.5,y},{k:'corsa',x:6.5,y,x2:23.5,y2:y})});
  return {campo:'rett',w:30,h:20,el};
}
function attivazione(md,min){const a=ATT[attKey(md)];return {nome:a.nome,fase:'attivazione',durata:Number(min)||10,spazio:'Corsie da 20 m',giocatori:'Tutti',descrizione:a.descrizione,principio:'Preparazione al lavoro e prevenzione',coaching:a.coaching,schema:attSchema()}}

/* ===== Lavagna: schema dell'esercizio in metri, origine in alto a sinistra ===== */
const FIELDS={intero:{w:105,h:68,l:'Campo intero'},meta:{w:52.5,h:68,l:'Metà campo'},area:{w:36,h:44,l:'Zona area'},rett:{w:40,h:30,l:'Spazio delimitato'}};
const KINDS=['A','B','J','P','palla','cono','porta','porticina','corsa','passaggio','conduzione'];
const LINES=['corsa','passaggio','conduzione'];
const PCOL={A:'#E4572E',B:'#2F6FDB',J:'#F2C230',P:'#1E1E1E'};
const PITCH='#3D8A4B',PITCH2='#44934F',LINE='rgba(255,255,255,.88)';
const r1=v=>Math.round(v*10)/10;
function boardMetrics(sc){const F=FIELDS[sc&&sc.campo]||FIELDS.rett;const w=Number(sc&&sc.w)||F.w,h=Number(sc&&sc.h)||F.h;const pr=Math.min(1.8,Math.max(0.6,Math.max(w,h)/55));return {w,h,pr}}
function normalizeSchema(r){
  if(!r||typeof r!=='object')return null;
  const campo=FIELDS[r.campo]?r.campo:'rett';const F=FIELDS[campo];
  let w=Number(r.w)||F.w,h=Number(r.h)||F.h;if(campo!=='rett'){w=F.w;h=F.h}
  w=Math.min(110,Math.max(5,w));h=Math.min(75,Math.max(4,h));if(h>w&&campo==='rett'){const t=w;w=h;h=t}
  const cl=(v,mx)=>r1(Math.min(mx+4,Math.max(-4,Number(v)||0)));
  const el=[];(Array.isArray(r.el)?r.el:[]).slice(0,60).forEach(x=>{
    const o=Array.isArray(x)?{k:x[0],x:x[1],y:x[2],x2:x[3],y2:x[4]}:{k:x&&x.k,x:x&&(x.x??x.x1),y:x&&(x.y??x.y1),x2:x&&x.x2,y2:x&&x.y2};
    if(!KINDS.includes(o.k))return;const e={k:o.k,x:cl(o.x,w),y:cl(o.y,h)};
    if(LINES.includes(o.k)){e.x2=cl(o.x2,w);e.y2=cl(o.y2,h)}el.push(e)});
  return {campo,w,h,el};
}
function parseDims(sp){const m=String(sp||'').match(/(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)/i);return m?[Number(m[1].replace(',','.')),Number(m[2].replace(',','.'))]:null}
function autoSchema(e){
  const sp=String(e.spazio||'').toLowerCase(),gi=String(e.giocatori||'').toLowerCase(),nm=String(e.nome||'').toLowerCase(),ds=String(e.descrizione||'').toLowerCase();
  let campo='rett',w=40,h=30;const d=parseDims(sp);
  if(d){w=Math.max(d[0],d[1]);h=Math.min(d[0],d[1]);if(w>=90){campo='intero';w=105;h=68}}
  else if(/intero/.test(sp)){campo='intero';w=105;h=68}
  else if(/met[àa]|3\/4/.test(sp)){campo='meta';w=52.5;h=68}
  else if(/area|porta/.test(sp)){campo='area';w=36;h=44}
  const el=[];let A=0,B=0,J=0,P=0;
  const mm=gi.match(/(\d+)\s*(\+\s*p\s*)?c\s*(\d+)/);
  if(mm){A=+mm[1];B=+mm[3];if(mm[2])P=1;const rest=gi.slice(mm.index+mm[0].length);const jm=rest.match(/\+\s*(\d+)/);if(jm&&!/recupero/.test(rest))J=+jm[1];if(/recupero/.test(rest)&&jm)B+=+jm[1]}
  else if(/coppie/.test(gi))A=6;else{const g=gi.match(/gruppi da (\d+)/);if(g)A=+g[1]}
  if(/portier/.test(gi))P=2;
  A=Math.min(A,11);B=Math.min(B,11);J=Math.min(J,4);
  const pr=boardMetrics({campo,w,h}).pr;
  const grid=(n,x0,x1,off)=>{const out=[];if(!n)return out;const cols=Math.max(1,Math.round(Math.sqrt(n*(x1-x0)/h)));const rows=Math.ceil(n/cols);for(let i=0;i<n;i++){const c=i%cols,r=Math.floor(i/cols);out.push({x:r1(x0+(x1-x0)*(cols===1?.5:c/(cols-1))+(r%2?off:0)),y:r1(h*(r+1)/(rows+1))})}return out};
  if(/rondo/.test(nm)&&A){const R=Math.min(w,h)*.42;for(let i=0;i<A;i++){const a=2*Math.PI*i/A-Math.PI/2;el.push({k:'A',x:r1(w/2+R*Math.cos(a)),y:r1(h/2+R*Math.sin(a))})}for(let i=0;i<B;i++)el.push({k:'B',x:r1(w/2+(i-(B-1)/2)*pr*2.2),y:r1(h/2)})}
  else{grid(A,w*.12,w*.44,w*.04).forEach(p=>el.push({k:'A',...p}));grid(B,w*.56,w*.88,-w*.04).forEach(p=>el.push({k:'B',...p}))}
  [[w/2,.6],[w/2,h-.6],[.6,h/2],[w-.6,h/2]].slice(0,J).forEach(([x,y])=>el.push({k:'J',x:r1(x),y:r1(y)}));
  const small=/porticin|porte piccole|porticine/.test(gi+' '+nm+' '+ds);
  const goals=P||/porte|porta|portier/.test(gi+' '+nm+' '+ds);
  if(campo==='meta'||campo==='area'){if(goals||campo==='area'){el.push({k:'porta',x:w,y:h/2});if(P||campo==='area')el.push({k:'P',x:r1(w-1.2),y:h/2})}}
  else if(small){el.push({k:'porticina',x:0,y:h/2},{k:'porticina',x:w,y:h/2})}
  else if(goals){el.push({k:'porta',x:0,y:h/2},{k:'porta',x:w,y:h/2});if(P){el.push({k:'P',x:1.2,y:h/2});if(P>1)el.push({k:'P',x:r1(w-1.2),y:h/2})}}
  if(campo==='rett')[[0,0],[w,0],[0,h],[w,h]].forEach(([x,y])=>el.push({k:'cono',x,y}));
  const a0=el.find(x=>x.k==='A');if(a0)el.push({k:'palla',x:r1(a0.x+pr*1.3),y:r1(a0.y+pr*.6)});
  return {campo,w,h,el,auto:true};
}
let _svgSeq=0;
function svgBoard(sc,o){
  o=o||{};sc=sc||{campo:'rett',w:40,h:30,el:[]};
  const {w,h,pr}=boardMetrics(sc);const m=r1(Math.max(w,h)*.04+1.5);const id='bd'+(++_svgSeq);const lw=r1(Math.max(.12,pr*.14)*100)/100;
  let g='';const n=Math.max(4,Math.round(w/7));for(let i=0;i<n;i++)if(i%2)g+=`<rect x="${r1(i*w/n)}" y="0" width="${r1(w/n)}" height="${h}" fill="${PITCH2}"/>`;
  g+=`<rect x="0" y="0" width="${w}" height="${h}" fill="none" stroke="${LINE}" stroke-width="${lw}"/>`;
  const box=(right)=>{const bx=right?w-16.5:0,gx=right?w-5.5:0,sx=right?w-11:11,ex=right?w-16.5:16.5;
    return `<rect x="${bx}" y="${r1(h/2-20.16)}" width="16.5" height="40.32" fill="none" stroke="${LINE}" stroke-width="${lw}"/><rect x="${gx}" y="${r1(h/2-9.16)}" width="5.5" height="18.32" fill="none" stroke="${LINE}" stroke-width="${lw}"/><circle cx="${sx}" cy="${h/2}" r="${lw*1.6}" fill="${LINE}"/><path d="M${ex},${r1(h/2-7.31)} A9.15 9.15 0 0 ${right?0:1} ${ex},${r1(h/2+7.31)}" fill="none" stroke="${LINE}" stroke-width="${lw}"/>`};
  if(sc.campo==='intero')g+=`<line x1="${w/2}" y1="0" x2="${w/2}" y2="${h}" stroke="${LINE}" stroke-width="${lw}"/><circle cx="${w/2}" cy="${h/2}" r="9.15" fill="none" stroke="${LINE}" stroke-width="${lw}"/>`+box(false)+box(true);
  if(sc.campo==='meta')g+=`<path d="M0,${h/2-9.15} A9.15 9.15 0 0 1 0,${h/2+9.15}" fill="none" stroke="${LINE}" stroke-width="${lw}"/>`+box(true);
  if(sc.campo==='area')g+=box(true);
  const els=(sc.el||[]).map((e,i)=>({e,i}));const order=k=>LINES.includes(k)?0:k==='cono'?1:(k==='porta'||k==='porticina')?2:k==='palla'?4:3;
  els.sort((a,b)=>order(a.e.k)-order(b.e.k));
  const wavy=(e)=>{const dx=e.x2-e.x,dy=e.y2-e.y,L=Math.hypot(dx,dy);if(L<.5)return '';const ux=dx/L,uy=dy/L,amp=pr*.32,wl=pr*1.3,end=Math.max(0,L-pr*1.1);let d=`M${r1(e.x)},${r1(e.y)}`;for(let t=wl/4;t<end;t+=wl/4){const s=Math.sin(t/wl*2*Math.PI)*amp;d+=` L${r1(e.x+ux*t-uy*s)},${r1(e.y+uy*t+ux*s)}`}d+=` L${r1(e.x2)},${r1(e.y2)}`;return d};
  const sel=o.sel;
  els.forEach(({e,i})=>{const hl=i===sel;const k=e.k;
    if(LINES.includes(k)){const sw=r1(lw*1.6*100)/100;const st=hl?'#FFE15A':'#fff';
      if(k==='conduzione')g+=`<path d="${wavy(e)}" fill="none" stroke="${st}" stroke-width="${sw}" stroke-linejoin="round" marker-end="url(#${id}${hl?'h':'a'})"/>`;
      else g+=`<line x1="${e.x}" y1="${e.y}" x2="${e.x2}" y2="${e.y2}" stroke="${st}" stroke-width="${sw}" ${k==='corsa'?`stroke-dasharray="${r1(pr*.55)} ${r1(pr*.38)}"`:''} marker-end="url(#${id}${hl?'h':'a'})"/>`;
      if(hl)g+=`<circle cx="${e.x}" cy="${e.y}" r="${r1(pr*.45)}" fill="#FFE15A"/><circle cx="${e.x2}" cy="${e.y2}" r="${r1(pr*.45)}" fill="#FFE15A"/>`;return}
    if(k==='cono'){const s=pr*.75;g+=`<path d="M${r1(e.x)},${r1(e.y-s)} L${r1(e.x-s*.8)},${r1(e.y+s*.6)} L${r1(e.x+s*.8)},${r1(e.y+s*.6)}Z" fill="#FF8A1F" stroke="#7a3a00" stroke-width="${lw*.6}"/>`}
    else if(k==='porta'||k==='porticina'){const gh=k==='porta'?7.32:Math.max(2,pr*2.2),gd=k==='porta'?Math.max(1.2,pr*.9):pr*.7;const right=e.x>w/2;const x=right?e.x:e.x-gd;g+=`<rect x="${r1(x)}" y="${r1(e.y-gh/2)}" width="${r1(gd)}" height="${r1(gh)}" fill="rgba(255,255,255,.35)" stroke="#fff" stroke-width="${lw*1.3}"/>`}
    else if(k==='palla')g+=`<circle cx="${e.x}" cy="${e.y}" r="${r1(pr*.5)}" fill="#fff" stroke="#111" stroke-width="${lw*.9}"/>`;
    else g+=`<circle cx="${e.x}" cy="${e.y}" r="${pr}" fill="${PCOL[k]}" stroke="${k==='J'?'#5a4700':'#fff'}" stroke-width="${lw*1.2}"/>${k==='P'?`<text x="${e.x}" y="${r1(e.y+pr*.42)}" font-size="${r1(pr*1.2)}" text-anchor="middle" fill="#fff" font-family="Arial,sans-serif" font-weight="700">P</text>`:''}`;
    if(hl&&!LINES.includes(k))g+=`<circle cx="${e.x}" cy="${e.y}" r="${r1(pr*1.6)}" fill="none" stroke="#FFE15A" stroke-width="${lw*1.4}" stroke-dasharray="${r1(pr*.4)} ${r1(pr*.3)}"/>`;
  });
  const pv=o.preview;if(pv)g+=`<line x1="${pv.x}" y1="${pv.y}" x2="${pv.x2}" y2="${pv.y2}" stroke="#FFE15A" stroke-width="${lw*1.6}" stroke-dasharray="${r1(pr*.5)} ${r1(pr*.3)}" marker-end="url(#${id}h)"/>`;
  const mk=(sfx,c)=>`<marker id="${id}${sfx}" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 Z" fill="${c}"/></marker>`;
  return `<svg viewBox="${-m} ${-m} ${r1(w+2*m)} ${r1(h+2*m)}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc0(o.label||'Schema esercizio')}"><defs>${mk('a','#fff')}${mk('h','#FFE15A')}</defs><rect x="${-m}" y="${-m}" width="${r1(w+2*m)}" height="${r1(h+2*m)}" fill="${PITCH}" rx="${m*.6}"/>${g}</svg>`;
}
function esc0(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function segDist(p,e){const dx=e.x2-e.x,dy=e.y2-e.y,L2=dx*dx+dy*dy;let t=L2?((p.x-e.x)*dx+(p.y-e.y)*dy)/L2:0;t=Math.max(0,Math.min(1,t));return Math.hypot(p.x-(e.x+t*dx),p.y-(e.y+t*dy))}
function hitBoard(sc,p){const {pr}=boardMetrics(sc);for(let i=sc.el.length-1;i>=0;i--){const e=sc.el[i];
  if(LINES.includes(e.k)){if(segDist(p,e)<pr*.8){const de=Math.hypot(p.x-e.x2,p.y-e.y2),ds=Math.hypot(p.x-e.x,p.y-e.y);return {i,part:de<pr?'end':ds<pr?'start':'all'}}}
  else{const R=e.k==='porta'?3.8:e.k==='porticina'?pr*1.4:pr*1.35;if(Math.hypot(p.x-e.x,p.y-e.y)<R)return {i,part:'all'}}}return null}
const SCHEMA_SPEC=`SCHEMA GRAFICO ("schema"): oggetto {"campo":"intero|meta|area|rett","w":numero,"h":numero,"el":[...]} in metri, origine in alto a sinistra, x da 0 a w (lunghezza), y da 0 a h (larghezza).
- "intero": w=105, h=68. "meta": w=52.5, h=68, linea di metà campo a x=0, porta a destra (x=52.5). "area": w=36, h=44, porta a destra (x=36). "rett": spazio delimitato con le misure dell'esercizio (w = lato lungo).
- el, ogni elemento è un array: ["A",x,y] giocatore squadra A (in possesso/attaccanti), ["B",x,y] squadra B (difendenti), ["J",x,y] jolly, ["P",x,y] portiere, ["palla",x,y], ["cono",x,y], ["porta",x,y] porta regolare (x=0 o x=w, y=centro), ["porticina",x,y], ["corsa",x1,y1,x2,y2] movimento senza palla, ["passaggio",x1,y1,x2,y2], ["conduzione",x1,y1,x2,y2].
- Metti tutti i giocatori nella posizione di partenza, i coni che delimitano lo spazio e 2-5 frecce per i movimenti chiave. Al massimo 30 elementi.`;
