
/* ===== Stato e persistenza ===== */
const S={classifica:null,team:null,players:[],weeks:{},matches:[],drills:[],route:'settimana',sub:'rosa',weekStart:iso(mondayOf(new Date())),db:null,sample:null,dbState:'loading',libCat:'tutti',rosaFilter:'tutti',chat:[],chatBusy:false,chatOpen:false,ai:null};
const DEFAULT_TEAM={nome:'La mia squadra',categoria:'',livello:'Dilettanti',sistema:'',matchDay:6,sedute:3,giorni:[1,3,4],orari:{},durata:90,attivazione:10,campo:'',principi:{offensiva:'',difensiva:'',transPos:'',transNeg:'',inattive:''},note:''};
const team=()=>S.team||DEFAULT_TEAM;
const queue={};
function put(col,id,data){
  if(!S.db){render();return Promise.resolve()}
  const key=col+'/'+id;
  const run=()=>S.db.collection(col).doc(id).set(JSON.parse(JSON.stringify(data))).catch(e=>{toast(e&&e.code==='quota_exceeded'?'Spazio dati esaurito':'Salvataggio non riuscito, riprova');console.warn(e)});
  queue[key]=(queue[key]||Promise.resolve()).then(run);return queue[key];
}
function del(col,id){if(!S.db){render();return Promise.resolve()}const key=col+'/'+id;queue[key]=(queue[key]||Promise.resolve()).then(()=>S.db.collection(col).doc(id).delete()).catch(()=>toast('Eliminazione non riuscita'));return queue[key]}
function saveWeek(w){S.weeks[w.id]=w;render();return put('settimane',w.id,w)}
function getWeek(id){return S.weeks[id]||{id,matchDay:team().matchDay,avversario:'',competizione:'',obiettivo:'',sessioni:[],note:''}}

async function boot(){
  render();
  try{
    const c=window.claude;
    const [db,sample,downloads]=await Promise.all([c?.use?c.use('db'):null,c?.use?c.use('sample'):null,c?.use?c.use('downloads'):null]);
    S.sample=sample;S.db=db;S.downloads=downloads;
    if(!db){S.dbState='off';render();return}
    const first={info:0,giocatori:0,settimane:0,partite:0,esercizi:0};
    const timer=setTimeout(()=>{if(S.dbState==='loading'){S.dbState='slow';render()}},10000);
    const done=k=>{first[k]=1;if(Object.values(first).every(Boolean)){clearTimeout(timer);S.dbState='ok';render()}};
    const err=e=>{clearTimeout(timer);S.dbState='err';render();console.warn(e)};
    db.doc('squadra/classifica').onSnapshot(s=>{S.classifica=s.exists?s.data():null;render()},()=>{});
    db.doc('squadra/info').onSnapshot(s=>{if(s.exists)S.team={...DEFAULT_TEAM,...s.data(),principi:{...DEFAULT_TEAM.principi,...(s.data().principi||{})}};if(!s.metadata.fromCache)done('info');render()},err);
    db.collection('giocatori').onSnapshot(q=>{S.players=q.docs.map(d=>({...d.data(),id:d.id}));if(!q.metadata.fromCache){done('giocatori');autoReturns()}render()},err);
    db.collection('settimane').onSnapshot(q=>{const w={};q.docs.forEach(d=>{const x={...d.data(),id:d.id};if(Array.isArray(x.sessioni))x.sessioni=x.sessioni.map(o=>o&&o.md?{...o,md:normMd(o.md),titolo:String(o.titolo||'').replace(/MD-[456]\b/g,normMd),esercizi:Array.isArray(o.esercizi)?o.esercizi.map(e=>e&&e.schemaG==null?fixEx(JSON.parse(JSON.stringify(e))):e):o.esercizi}:o);w[d.id]=x});S.weeks=w;if(!q.metadata.fromCache)done('settimane');render()},err);
    db.collection('partite').onSnapshot(q=>{S.matches=q.docs.map(d=>({...d.data(),id:d.id}));if(!q.metadata.fromCache)done('partite');render()},err);
    db.collection('esercizi').onSnapshot(q=>{S.drills=q.docs.map(d=>({...d.data(),id:d.id}));if(!q.metadata.fromCache)done('esercizi');render()},err);
  }catch(e){S.dbState='off';render()}
}

/* ===== Utilità ===== */
const esc=esc0;
const fmtDay=d=>d.getDate()+' '+MONTHS[d.getMonth()];
const todayIso=()=>iso(new Date());
function toast(t){const el=document.createElement('div');el.className='toast';el.setAttribute('role','status');el.textContent=t;document.body.append(el);setTimeout(()=>el.remove(),2600)}
const STATI={disponibile:['Disponibile','ok'],acciaccato:['Acciaccato','warn'],infortunato:['Infortunato','bad'],squalificato:['Squalificato','bad'],assente:['Assente','warn']};
const RUOLI={POR:'Portiere',DIF:'Difensore',CEN:'Centrocampista',ATT:'Attaccante'};
const RUOLI_OPT={...RUOLI,'':'Da definire'};
const POS=[['POR','Portiere'],['DIF','Difensore centrale'],['DIF','Braccetto (difesa a 3)'],['DIF','Terzino'],['DIF','Terzino destro'],['DIF','Terzino sinistro'],['CEN','Quinto (tutta fascia)'],['CEN','Mediano'],['CEN','Regista'],['CEN',"Mezz'ala/esterno"],['CEN','Mezzala'],['CEN','Trequartista'],['ATT','Ala'],['ATT','Ala destra'],['ATT','Ala sinistra'],['ATT','Seconda punta'],['ATT','Attaccante centrale']];
const repOf=pos=>(POS.find(p=>p[1]===pos)||[])[0]||'';
const posSelect=(id,val,ph)=>`<select id="${id}"><option value="">${ph}</option>${Object.entries(RUOLI).map(([k,l])=>`<optgroup label="${l}">${POS.filter(p=>p[0]===k).map(p=>`<option ${val===p[1]?'selected':''}>${esc(p[1])}</option>`).join('')}</optgroup>`).join('')}</select>`;
const posFull=p=>[p.pos1||p.posizione||RUOLI[p.ruolo]||'',p.pos2?'alt. '+p.pos2:'',p.sottoruolo||''].filter(Boolean).join(', ');
const shortName=p=>{const t=String(p.nome||'').trim().split(/\s+/);return t.length>1?t.slice(1).join(' '):t[0]||'?'};
const ora=d=>{const o=team().orari||{};return o[d]||o[String(d)]||''};
const cognome=p=>{const t=String(p.nome||'').trim().split(/\s+/);return t.length>1?t.slice(1).join(' '):t[0]||''};
const cogNome=p=>{const t=String(p.nome||'').trim().split(/\s+/);return t.length>1?t.slice(1).join(' ')+' '+t[0]:t[0]||''};
const sortPlayers=a=>[...a].sort((x,y)=>cognome(x).localeCompare(cognome(y),'it',{sensitivity:'base'})||String(x.nome).localeCompare(String(y.nome),'it'));
const mdChip=md=>md?`<span class="md ${mdClass(md)}">${esc(normMd(md))}</span>`:'';
const FASI=['attivazione','iniziale','centrale','condizionale','finale'];
const STATI_GRUPPO=['','Motivato e in fiducia','Euforico dopo una vittoria','Giù dopo una sconfitta','Stanco o poco brillante','Teso o nervoso','Poco concentrato','Poco unito'];
const gkDefault=(d)=>{const t=team();const g=t.prepPortieri||'a volte';return g==='sempre'||(g==='a volte'&&(t.gkDays||[]).map(Number).includes(Number(d)))};
const prettySis=n=>/^\d{3,5}$/.test(n)?'1-'+n.split('').join('-'):n;
const sistemi=()=>{const t=team();if(Array.isArray(t.sistemi)&&t.sistemi.length)return t.sistemi.filter(x=>x&&x.nome);return String(t.sistema||'').split(/[\/,]/).map(x=>x.trim()).filter(Boolean).map(n=>({nome:prettySis(n),uso:'',stato:'in costruzione'}))};
const STATI_SIS=[['introduzione','Introduzione'],['in costruzione','In costruzione'],['consolidato','Consolidato']];
function titRule(w){if(!w)return '';const t=team();const md=matchDayOf(w);if(md==null||md==='')return '';const g=(t.giorni||[]).filter(d=>d<Number(md));if(!g.length)return '';const eve=Math.max(...g);const F=w.formazione;const nm=id=>{const p=S.players.find(x=>x.id===id);return p?cognome(p):''};
  return `SQUADRE DELLA SETTIMANA: nell'ultima seduta prima della partita (${DAYS_FULL[eve]}) le squadre sono TITOLARI${F&&F.slots?' ('+F.sistema+': '+F.slots.map(nm).filter(Boolean).join(', ')+')':''} contro RISERVE che simulano il sistema dell'avversario${w.sistemaAvversario?' ('+w.sistemaAvversario+')':''}: progetta quella seduta con lavori tattici e partita titolari contro riserve. Negli altri giorni le squadre sono miste ed equilibrate.${w.ideaPartita?'\nIDEA TATTICA DELLA PARTITA (concordata con il mister): '+w.ideaPartita:''}`}
function sisRule(w){const ss=sistemi();if(!ss.length)return '';const sp=w&&w.sistemaPartita;
  const crit=ss.map(x=>x.nome+(x.uso?' = '+x.uso:'')+' ('+(x.stato||'in costruzione')+')').join('; ');
  return `SISTEMI DI GIOCO della squadra: ${crit}.
${sp?`SISTEMA DELLA SETTIMANA: ${sp}. Tutti gli esercizi legati a un sistema (fase difensiva, prima pressione, costruzione, partite a tema) si fanno SOLO con il ${sp}: reparti, numeri e posizioni devono essere quelli del ${sp}. Non proporre lavori sull'altro sistema a meno che il mister lo chieda nelle indicazioni.`:`Il sistema per la partita non è ancora deciso: scegline UNO in base ai criteri d'uso indicati sopra e all'avversario, scrivi la scelta e il motivo nelle note, e usa SOLO quello per tutta la settimana.`}
Nel campo "sistema" di ogni esercizio scrivi il nome del sistema, oppure "entrambi" solo per esercizi che non dipendono dal sistema (rondo, possessi, transizioni a numeri ridotti). Negli schemi disponi i giocatori secondo il sistema indicato.${w?'\n'+titRule(w):''}`}
const FASI_GIOCO=[['offensiva','Fase offensiva','Es. gioco diretto, ampiezza per attrarre e attaccare la profondità.','Es. lanci senza riferimenti, punte isolate, nessuno attacca la profondità.'],['difensiva','Fase difensiva','Es. compattezza centrale, +1 dietro, scalate.','Es. reparti lunghi, centrocampo scavalcato, difesa che scappa.'],['transPos','Transizione positiva','Es. verticalità immediata.','Es. dopo il recupero si torna indietro, ripartenze lente.'],['transNeg','Transizione negativa','Es. riaggressione 5” dei più vicini, gli altri chiudono il centro.','Es. dopo la perdita si guarda la palla, nessuna copertura preventiva, gol presi in ripartenza centrale.'],['inattive','Palle inattive','Es. zona mista: 2 a zona, 1 al limite, 2 alti, gli altri a uomo.','Es. marcature perse sul secondo palo.']];
function matchDayOf(w){return w.matchDay===undefined?team().matchDay:w.matchDay}
function attendance(pid){let tot=0,pres=0;Object.values(S.weeks).forEach(w=>(w.sessioni||[]).forEach(s=>{if(Array.isArray(s.presenti)&&s.done){tot++;if(s.presenti.includes(pid))pres++}}));return tot?{pct:Math.round(pres/tot*100),pres,tot}:null}
function nextMatch(){const t=todayIso();return S.matches.filter(m=>m.data>=t&&!m.giocata).sort((a,b)=>a.data<b.data?-1:1)[0]}
function lastMatch(){const t=todayIso();return S.matches.filter(m=>m.giocata||m.data<t).sort((a,b)=>a.data>b.data?-1:1)[0]}
function upcomingSessions(){const t=todayIso();const out=[];[0,7].forEach(off=>{const id=iso(addDays(mondayOf(new Date()),off));const w=S.weeks[id];if(!w)return;(w.sessioni||[]).forEach((s,i)=>{const d=iso(addDays(parseIso(id),s.giorno));if(d>=t)out.push({w,s,i,d})})});return out.sort((a,b)=>a.d<b.d?-1:1)}
const schemaOf=e=>e.schema||autoSchema(e);
const thumb=(e,attrs)=>`<button class="thumb" ${attrs} aria-label="Apri il disegno di ${esc(e.nome)}">${svgBoard(schemaOf(e),{label:e.nome})}</button>`;

/* ===== Navigazione ===== */
const ROUTES=[['settimana','Settimana'],['squadra','Squadra'],['esercizi','Esercizi']];
const ALIAS={oggi:'settimana',rosa:['squadra','rosa'],partite:['squadra','partite'],classifica:['squadra','classifica'],modello:'impostazioni',assistente:'settimana'};
function readHash(){let h=location.hash.slice(1);if(h==='assistente')S.chatOpen=true;const a=ALIAS[h];if(Array.isArray(a)){S.route=a[0];S.sub=a[1]}else if(a)S.route=a;else S.route=ROUTES.some(r=>r[0]===h)||h==='impostazioni'?h:'settimana'}
window.addEventListener('hashchange',()=>{readHash();render();window.scrollTo(0,0)});

function render(){
  document.getElementById('navlist').innerHTML=ROUTES.map(([k,l])=>`<li><a href="#${k}" ${S.route===k?'aria-current="page"':''}>${l}</a></li>`).join('');
  document.getElementById('navset').setAttribute('aria-current',S.route==='impostazioni'?'page':'false');
  const t=team();
  document.getElementById('teamLine').textContent=[t.nome,t.categoria].filter(Boolean).join(' · ');
  const st={ok:['','Dati salvati'],loading:['off','Caricamento dati…'],slow:['off','Dati non ancora raggiungibili'],off:['off','Dati non salvati in questa vista'],err:['off','Collegamento ai dati interrotto']}[S.dbState];
  document.getElementById('syncState').innerHTML=`<span class="dot ${st[0]}"></span>${st[1]}`;
  const v=document.getElementById('view');
  const keep={};v.querySelectorAll('textarea[id],input[id]').forEach(el=>{if(document.activeElement===el||el.dataset.keep)keep[el.id]=el.value});
  const focused=document.activeElement&&document.activeElement.id;
  v.innerHTML=banner()+({settimana:vSettimana,squadra:vSquadra,esercizi:vEsercizi,impostazioni:vImpostazioni}[S.route]||vSettimana)();
  Object.entries(keep).forEach(([id,val])=>{const el=document.getElementById(id);if(el)el.value=val});
  if(focused){const el=v.querySelector('#'+CSS.escape(focused));if(el&&(el.tagName==='TEXTAREA'||el.type==='text'))el.focus()}
  renderChat();
}
function banner(){
  if(S.dbState==='off')return `<div class="banner">I dati non vengono salvati in questa vista: apri la pagina su claude.ai con il tuo account per conservare rosa, settimane e partite.</div>`;
  if(S.dbState==='slow')return `<div class="banner">I dati salvati non sono ancora raggiungibili. Quello che vedi potrebbe non essere aggiornato.</div>`;
  if(S.dbState==='err')return `<div class="banner">Il collegamento ai dati si è interrotto. Ricarica la pagina per riprendere a salvare.</div>`;
  return '';
}

/* ===== Vista: Settimana (con la seduta di oggi in testa) ===== */
function vSettimana(){
  const t=team();const start=parseIso(S.weekStart);const w=getWeek(S.weekStart);const md=matchDayOf(w);
  const today=todayIso();const isCurrent=S.weekStart===iso(mondayOf(new Date()));
  const days=DAYS.map((dn,i)=>{const d=addDays(start,i);const lab=mdLabel(i,md);const ss=(w.sessioni||[]).map((s,idx)=>({s,idx})).filter(x=>x.s.giorno===i);
    const isM=md!=null&&md!==''&&Number(md)===i;let body='';
    if(isM){const m=S.matches.find(m=>m.data===iso(d));body+=`<div class="matchcard"><span class="lbl">Partita</span><span class="t">${esc(w.avversario||(m&&m.avversario)||'Avversario da definire')}</span>${m?`<span style="font-size:.8rem">${m.casa?'In casa':'Trasferta'}${m.ora?' · ore '+esc(m.ora):''}</span>`:''}</div>`}
    body+=ss.map(({s,idx})=>`<button class="sess ${mdClass(s.md)}" data-act="openSess" data-w="${w.id}" data-i="${idx}"><span class="row" style="justify-content:space-between;gap:4px">${mdChip(s.md)}${s.done?'<span class="pill ok">Svolta</span>':''}</span><span class="t">${esc(s.titolo||s.tipo)}</span><span class="meta num"><span>${s.durata}′</span><span>RPE ${s.rpe}</span></span><ol>${(s.esercizi||[]).filter(e=>e.fase!=='attivazione').slice(0,4).map(e=>`<li>${esc(e.nome)}</li>`).join('')}</ol></button>`).join('');
    if(!ss.length&&!isM)body+=`<button class="addsess" data-act="newSess" data-d="${i}">+ Seduta</button>`;
    return `<div class="day ${iso(d)===today?'today':''}"><div class="dh"><b>${dn} ${d.getDate()}</b>${lab&&lab!=='MD'?`<span class="mono muted">${lab}${ora(i)&&ss.length?' · '+ora(i):''}</span>`:''}</div><div class="stack" style="gap:8px">${body}</div></div>`}).join('');
  const pl=dailyLoads(w,t,false),rl=dailyLoads(w,t,true);const tp=pl.reduce((a,b)=>a+b,0),tr=rl.reduce((a,b)=>a+b,0);const mono=monotony(pl);
  const prevId=iso(addDays(start,-7));const prev=getWeek(prevId);const tprev=dailyLoads(prev,t,true).reduce((a,b)=>a+b,0)||dailyLoads(prev,t,false).reduce((a,b)=>a+b,0);
  const delta=S.weeks[prevId]&&tprev?Math.round((tp-tprev)/tprev*100):null;
  return `${isCurrent?oggiBlock():''}
  <div class="head"><div><span class="lbl">Microciclo · ${fmtDay(start)} – ${fmtDay(addDays(start,6))}</span><h1>Settimana ${weekNo(start)}</h1></div>
    <div class="weeknav"><button class="btn" data-act="wk" data-d="-7" aria-label="Settimana precedente">‹</button><button class="btn" data-act="wk" data-d="0" ${isCurrent?'disabled':''}>Questa settimana</button><button class="btn" data-act="wk" data-d="7" aria-label="Settimana successiva">›</button></div></div>
  <div class="card stack">
    <label class="f"><span>Obiettivo tattico della settimana</span><textarea id="wObj" data-act-change="weekField" data-k="obiettivo" placeholder="Es. Uscita palla contro il pressing a 2 punte e riaggressione dopo la perdita">${esc(w.obiettivo)}</textarea></label>
    <div class="row"><button class="btn ai" data-act="aiOpen">Progetta la settimana con l'AI</button><button class="btn" data-act="tplWeek" ${w.sessioni?.length?'data-confirm="Conferma: sostituisce le sedute"':''}>Morfociclo di base</button>
    <details class="more" style="margin-left:auto"><summary class="muted" style="font-size:.88rem">Partita della settimana</summary>
      <div class="fgrid" style="margin-top:10px;min-width:min(560px,80vw)">
      <label class="f"><span>Giorno partita</span><select id="wMatchDay" data-act-change="weekField" data-k="matchDay"><option value="">Nessuna (sosta)</option>${DAYS_FULL.map((d,i)=>`<option value="${i}" ${String(md)===String(i)?'selected':''}>${d}</option>`).join('')}</select></label>
      <label class="f"><span>Avversario</span><input type="text" id="wAvv" value="${esc(w.avversario)}" data-act-change="weekField" data-k="avversario"></label>
      <label class="f"><span>Sistema per la partita</span><select id="wSis" data-act-change="weekField" data-k="sistemaPartita"><option value="">Da decidere</option>${sistemi().map(x=>`<option ${w.sistemaPartita===x.nome?'selected':''}>${esc(x.nome)}</option>`).join('')}</select></label>
      <label class="f"><span>Sistema dell’avversario</span><input type="text" id="wSisAvv" value="${esc(w.sistemaAvversario||'')}" data-act-change="weekField" data-k="sistemaAvversario" placeholder="Es. 4-3-1-2"></label>
      <label class="f"><span>RPE partita</span><input type="number" min="0" max="10" step="0.5" id="wRpeP" value="${w.rpePartita??''}" data-act-change="weekField" data-k="rpePartita" placeholder="0-10"></label></div>
      <label class="f" style="margin-top:10px"><span>Idea tattica della partita</span><textarea id="wIdea" data-act-change="weekField" data-k="ideaPartita" placeholder="Es. indirizzarli a destra e aggredire; attaccare lo spazio tra i due centrali; costruzione a 3+2 se si abbassa il mediano">${esc(w.ideaPartita||'')}</textarea></label>
      <div class="row" style="margin-top:8px">${S.sample?`<button class="btn sm ai" data-act="ideaChat">Ragiona la partita con l’assistente</button>`:''}<button class="btn sm" data-act="formOpen">Formazione titolare${w.formazione&&w.formazione.slots?` (${w.formazione.slots.filter(Boolean).length}/11)`:''}</button><span class="muted" style="font-size:.82rem">Nell’ultima seduta prima della gara le squadre saranno titolari contro riserve.</span></div></details></div>
    ${aiPanel(w)}
  </div>
  <div class="days">${days}</div>
  <div class="card stack"><div class="row" style="justify-content:space-between"><h2>Carico</h2><span class="legend"><span><i style="background:var(--line)"></i>Pianificato</span><span><i style="background:var(--accent)"></i>Rilevato (sRPE)</span></span></div>
    <div class="stats"><div class="stat"><div class="v num">${tp}<small> UA</small></div><span class="muted">pianificate</span></div><div class="stat"><div class="v num">${tr}<small> UA</small></div><span class="muted">rilevate</span></div>
    <div class="stat"><div class="v num">${mono?mono.toFixed(2):'—'}</div><span class="muted">monotonia ${mono&&mono>2?'<span class="pill warn">alta</span>':''}</span></div>
    <div class="stat"><div class="v num">${delta==null?'—':(delta>0?'+':'')+delta+'%'}</div><span class="muted">vs settimana prima ${delta!=null&&Math.abs(delta)>15?'<span class="pill warn">oltre ±15%</span>':''}</span></div></div>
    ${weekChart(pl,rl,md)}
    <details class="more"><summary>Ultime 6 settimane</summary>${multiWeekChart()}</details>
    <p class="muted" style="font-size:.82rem">UA = RPE (scala CR-10) × minuti. La partita pianificata conta 9 × 95′.</p>
  </div>`;
}
function oggiBlock(){
  const now=new Date();const up=upcomingSessions();const nx=up[0];const nm=nextMatch();
  const out=S.players.filter(p=>p.stato&&p.stato!=='disponibile');
  let sess;
  if(nx){const d=parseIso(nx.d);const isToday=nx.d===todayIso();
    sess=`<div class="card stack">
      <div class="row" style="justify-content:space-between"><div class="row">${mdChip(nx.s.md)}<span class="lbl">${isToday?'Seduta di oggi':DAYS_FULL[nx.s.giorno]+' '+fmtDay(d)}${ora(nx.s.giorno)?' · ore '+ora(nx.s.giorno):''}</span></div>
      <div class="row"><span class="pill num">${nx.s.durata}′</span><span class="pill num">RPE ${nx.s.rpe}</span></div></div>
      <h2>${esc(nx.s.titolo||nx.s.tipo)}</h2>
      ${nx.s.focus?`<p class="muted">${esc(nx.s.focus)}</p>`:''}
      <ul class="drills">${(nx.s.esercizi||[]).map((e,i)=>`<li>${thumb(e,`data-act="openSess" data-w="${nx.w.id}" data-i="${nx.i}" data-tab="scheda"`)}<div><span class="fase">${esc(e.fase||'')}</span><div class="nm">${esc(e.nome)}</div><div class="ds">${esc([e.spazio,e.giocatori].filter(Boolean).join(' · '))}</div></div><span class="du">${esc(e.durata)}′</span></li>`).join('')||'<li><span></span><span class="muted">Nessun esercizio inserito</span><span></span></li>'}</ul>
      <div class="row"><button class="btn pri" data-act="openSess" data-w="${nx.w.id}" data-i="${nx.i}" data-tab="scheda">Apri la seduta</button><button class="btn" data-act="openSess" data-w="${nx.w.id}" data-i="${nx.i}" data-tab="dopo">Presenze e RPE</button></div>
    </div>`}
  else sess=`<div class="card stack"><span class="lbl">Prossima seduta</span><h2>Nessuna seduta in programma</h2><p class="muted">Pianifica la settimana qui sotto: il morfociclo parte dal giorno della partita.</p></div>`;
  return `<div class="head"><div><span class="lbl">${DAYS_FULL[(now.getDay()+6)%7]} ${fmtDay(now)}</span><h1>${esc(team().nome)}</h1></div></div>
  <div class="grid2">${sess}
    <div class="stack">
      <div class="card stack"><span class="lbl">Prossima partita</span>${nm?`<h3 style="font-size:1.35rem">${esc(nm.avversario)}</h3><p class="muted">${DAYS_FULL[(parseIso(nm.data).getDay()+6)%7]} ${fmtDay(parseIso(nm.data))}${nm.ora?' · ore '+esc(nm.ora):''} · ${nm.casa?'in casa':'in trasferta'}</p>${nm.luogo?`<p class="muted" style="font-size:.85rem">${esc(nm.luogo)}</p>`:''}${posLine()}`:'<p class="muted">Nessuna partita in calendario.</p>'}</div>
      <div class="card stack"><div class="row" style="justify-content:space-between"><span class="lbl">Disponibilità</span><a class="btn sm ghost" href="#rosa">Rosa</a></div>
        <p><b class="num" style="font-size:1.3rem">${S.players.length-out.length}</b> <span class="muted">disponibili su ${S.players.length}</span></p>
        ${out.map(p=>`<div class="row" style="justify-content:space-between"><span>${esc(p.nome)}</span><span class="pill ${STATI[p.stato][1]}">${STATI[p.stato][0]}${p.rientro?' · '+fmtDay(parseIso(p.rientro)):''}</span></div>`).join('')}
      </div>
    </div></div>`;
}
function posLine(){const c=S.classifica;if(!c||!Array.isArray(c.righe))return '';const i=c.righe.findIndex(r=>r.nostra);return i<0?'':`<p style="font-size:.85rem">In classifica: <b>${i+1}º</b> con ${c.righe[i].pt} punti</p>`}
function weekChart(pl,rl,md){
  const max=Math.max(600,...pl,...rl);const sm=Math.ceil(max/300)*300;const W=640,H=190,L=44,B=26,T=10,cw=(W-L-8)/7;const y=v=>T+(H-T-B)*(1-v/sm);
  let g='';for(let v=0;v<=sm;v+=sm/3){g+=`<line x1="${L}" x2="${W-4}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${L-6}" y="${y(v)+4}" text-anchor="end" font-size="11" fill="var(--muted)" font-family="JetBrains Mono,monospace">${v}</text>`}
  const b=DAYS.map((d,i)=>{const x=L+i*cw+cw*.16,bw=cw*.32;const isM=md!=null&&md!==''&&Number(md)===i;return `<rect x="${x}" y="${y(pl[i])}" width="${bw}" height="${y(0)-y(pl[i])}" fill="${isM?'var(--bib-soft)':'var(--line)'}" stroke="${isM?'var(--bib)':'none'}" rx="2"/><rect x="${x+bw+3}" y="${y(rl[i])}" width="${bw}" height="${y(0)-y(rl[i])}" fill="var(--accent)" rx="2"/><text x="${x+bw}" y="${H-8}" text-anchor="middle" font-size="11" fill="${isM?'var(--bib)':'var(--muted)'}">${d}</text>`}).join('');
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Carico giornaliero">${g}${b}</svg></div>`;
}
function multiWeekChart(){
  const t=team();const cur=mondayOf(new Date());const ws=[];
  for(let i=5;i>=0;i--){const id=iso(addDays(cur,-7*i));const w=getWeek(id);ws.push({id,p:dailyLoads(w,t,false).reduce((a,b)=>a+b,0),r:dailyLoads(w,t,true).reduce((a,b)=>a+b,0)})}
  const max=Math.max(1500,...ws.map(w=>Math.max(w.p,w.r)));const sm=Math.ceil(max/500)*500;
  const W=640,H=200,L=48,B=28,T=12,cw=(W-L-10)/ws.length;const y=v=>T+(H-T-B)*(1-v/sm);
  let g='';for(let v=0;v<=sm;v+=sm/4){g+=`<line x1="${L}" x2="${W-6}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${L-6}" y="${y(v)+4}" text-anchor="end" font-size="11" fill="var(--muted)" font-family="JetBrains Mono,monospace">${v}</text>`}
  const bars=ws.map((w,i)=>{const x=L+i*cw+cw*.18;const bw=cw*.3;return `<rect x="${x}" y="${y(w.p)}" width="${bw}" height="${y(0)-y(w.p)}" fill="var(--line)" rx="2"/><rect x="${x+bw+3}" y="${y(w.r)}" width="${bw}" height="${y(0)-y(w.r)}" fill="var(--accent)" rx="2"/><text x="${x+bw+1}" y="${H-9}" text-anchor="middle" font-size="11" fill="var(--muted)">${i===5?'Questa':fmtDay(parseIso(w.id))}</text>`}).join('');
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Carico delle ultime sei settimane">${g}${bars}</svg></div>`;
}

/* ===== AI: progettazione della settimana ===== */
const METODO=`METODOLOGIA (Periodizzazione Tattica, morfociclo standard):
- Il Modello di gioco guida tutto: ogni esercizio allena principi e sotto-principi del modello, in modo specifico (con palla, avversari, direzione di gioco quando possibile).
- Alternanza orizzontale dei carichi rispetto alla partita (MD): MD+1 recupero; MD+2 / MD+3 Tensione (si contano i giorni dalla partita giocata) (spazi ridotti, alta densità di duelli, contrazioni intense, sotto-principi); MD-3 Durata (spazi ampi, numeri vicini all'11c11, grandi principi, giorno più carico); MD-2 Velocità (spazi ampi, bassa densità, esecuzioni rapide, recuperi completi, volume ridotto); MD-1 Attivazione (volume basso, palle inattive, strategia).
  Con 3 sedute: MD+2 ripresa + tensione, MD-3 durata, MD-2 velocità + palle inattive + strategia sull'avversario.
- Monitoraggio del carico con sRPE (RPE CR-10 x minuti = UA): variazioni settimanali entro il 10-15%, monotonia sotto 2.
- Progressione complessa: dal semplice al complesso, dai sotto-principi ai principi, collegando l'obiettivo settimanale alla partita precedente e all'avversario.
- Lavora sulla distanza tra il modello (VOGLIO) e il comportamento attuale (OGGI LA SQUADRA): parti dalle fasi con priorità alta, scegli sotto-principi raggiungibili da dove la squadra è oggi e costruisci esercizi in cui il comportamento voluto è conveniente e quello attuale viene punito dalle regole.`;
function disponibili(){const av=S.players.filter(p=>!p.stato||p.stato==='disponibile'||p.stato==='acciaccato');return {m:av.filter(p=>p.ruolo!=='POR').length,p:av.filter(p=>p.ruolo==='POR').length}}
function previsti(w,d){const v=w&&w.previsti&&w.previsti[d];const a=disponibili();return {m:v&&v.m!=null?Number(v.m):a.m,p:v&&v.p!=null?Number(v.p):a.p}}
function numRule(w,giorni){return `NUMERI (vincolo obbligatorio, verifica i conti prima di rispondere):
- Presenti previsti: ${giorni.map(d=>{const x=previsti(w,d);return DAYS_FULL[d]+' '+x.m+' giocatori di movimento + '+x.p+' portieri'}).join('; ')}.
- In ogni esercizio: giocatori in campo + jolly + gruppi in rotazione = giocatori di movimento presenti quel giorno (nessuno senza compito). Dichiara dove sono i portieri (in porta, come jolly, con il preparatore).
- I reparti rispettano il sistema dell'esercizio; la squadra avversaria simulata usa il proprio sistema.
- Nel campo "giocatori" scrivi i numeri esatti e il totale, es. "9c9 + 2 P = 20" oppure "6+P contro 6, 6 in rotazione ogni 3' = 18 + 2 P". Lo schema contiene esattamente quei giocatori.`}
const APP_TYPES=[['rondo','Rondo','pratica di campo: rondo 4c1 8x8 ≈ 13, 5c2 12x12 ≈ 20, posizionale 2+2c2+2 24x12 ≈ 36'],['possesso','Possesso / gioco di posizione (senza porte)','6c6 posizionale ≈ 75; giochi ridotti ≈ 90; senza portieri ≈ 165 per la corsa intensa di gara (adulti, Riboli 2020)'],['tensione','Tensione (MD+2/MD+3): giochi ridotti con porte, duelli','spazi stretti: alta densità di accelerazioni, frenate e duelli'],['durata','Durata (MD-3): giochi e lavori di reparto ampi','150-210 m² per riprodurre le distanze di gara negli U15-U19 (Riboli 2022)'],['velocita','Velocità (MD-2): spazi ampi, pochi giocatori','≈ 210 m² per lo sprint negli U15-U19; ≈ 300 per esposizione allo sprint'],['partita','Partita finale / a tema','11c11 su campo intero ≈ 320 m² per giocatore']];
const APP_DEF={rondo:[8,35],possesso:[50,150],tensione:[60,120],durata:[150,250],velocita:[200,320],partita:[120,320]};
const appRanges=()=>({...APP_DEF,...(team().app||{})});
function appType(e,md){const n=((e.nome||'')+' '+(e.giocatori||'')).toLowerCase();if(e.fase==='attivazione'||e.fase==='condizionale')return null;if(/angol|punizion|palle inattive|piazzat|tiro|cross|finalizz|strategia 11c0|11c0|a secco|prevenzion|duell|1c1|2c1|a ondate|sprint/.test(n))return null;
  if(/rondo/.test(n))return 'rondo';if(e.fase==='finale'||/^partita/.test((e.nome||'').toLowerCase()))return mdClass(md)==='ten'?'tensione':'partita';if(/possess|posizional/.test(n)&&!/port/.test(n))return 'possesso';
  const c=mdClass(md);return c==='ten'?'tensione':c==='dur'?'durata':c==='vel'?'velocita':c==='att'?'velocita':null}
function appOf(e){const pt=parseTeams(e);if(!pt.sizes.length)return null;const g=String(e.giocatori||'').toLowerCase();const fields=pt.sizes.length>=4?2:1;
  let dims=parseDims(e.spazio)||parseDims(e.descrizione);let area;if(dims)area=dims[0]*dims[1];else if(e.schema&&!e.schema.auto&&e.schema.campo!=='rett'){const F=FIELDS[e.schema.campo];area=F.w*F.h}else if(e.schema&&!e.schema.auto)area=e.schema.w*e.schema.h;else return null;
  const perField=pt.sizes.slice(0,2).reduce((a,b)=>a+b,0)+Math.round((pt.J||0)/fields);const gk=/\+\s*p\b|portier/.test(g)&&!/con il preparatore/.test(g)&&!/rondo|possess/.test(g+(e.nome||'').toLowerCase())?2:0;
  const n=perField+gk;if(!n||!area)return null;return {app:Math.round(area/n),n,area:Math.round(area)}}
function appBadge(e,md){const t=appType(e,md);const a=appOf(e);if(!t||!a)return '';const [lo,hi]=appRanges()[t]||[0,1e9];const ok=a.app>=lo&&a.app<=hi;const lbl=(APP_TYPES.find(x=>x[0]===t)||[])[1]||t;
  return `<span class="pill ${ok?'ok':'warn'}" title="${esc(lbl)}: ${lo}-${hi} m² per giocatore">${a.app} m²/giocatore${ok?'':a.app<lo?' · stretto':' · largo'}</span>`}
function designRule(){return `PRINCIPI DI PROGETTAZIONE (basati sull'evidenza, obbligatori):
- Forme di gioco prima di tutto: nella parte centrale privilegia esercizi con avversari, direzione e decisioni (apprendimento rappresentativo: si trasferisce in partita ciò che si allena con gli stessi stimoli di gara). Esercitazioni analitiche senza opposizione solo brevi e collegate al gioco che segue.
- Usa i vincoli in modo intenzionale, sapendo cosa producono:
  · numero di giocatori e dimensioni sono i vincoli più potenti: spazi e numeri ridotti = più azioni tecniche e duelli; spazi ampi = più ampiezza, profondità, distanze tra squadre e corsa;
  · forma del campo: più lungo che largo = verticalità e attacco della profondità; più largo = ampiezza e cambi di fronte; accorciare la lunghezza aiuta la compattezza tra i reparti;
  · tocchi: 2 tocchi = circolazione rapida e smarcamento continuo con pressione gestibile; 1 tocco aumenta il coinvolgimento ma anche errori e palle perse (evitalo quando l'obiettivo è la fiducia); gioco libero = più azioni individuali, dribbling e 1c1;
  · superiorità numerica e jolly: favoriscono azioni collettive (appoggi, coperture, combinazioni) e la costruzione, ma abbassano l'intensità fisica e rendono il gioco più posizionale; parità numerica = più duelli, penetrazione e intensità; inferiorità per chi difende = difesa compatta e scalate;
  · obiettivi: porte con portiere = finalizzazione realistica (servono spazi più grandi); porticine = attacco degli spazi e cambi di fronte con meno corsa; meta o zona da raggiungere in conduzione = progressione e attacco della profondità; senza porte = conservazione e riaggressione;
  · punteggi e regole speciali premiano il comportamento voluto (es. recupero entro 5" = punti) e puniscono quello attuale;
  · fuorigioco quando si lavora su linea difensiva, profondità e tempi di inserimento.
- Progressione: tra un blocco e l'altro cambia un vincolo alla volta, dal semplice al complesso, invece di ripetere identico.
- Esercizi a step: per transizioni e situazioni progressive proponi UN esercizio con 2-3 step (es. 1c0 → 1c1 → 2c1; 3c3 → 4c4 → 5c5; 4c3 → 5c4 → squadra contro squadra) compilando "step" con titolo, giocatori e descrizione di ogni fase; lo schema mostra il primo step. Se l'esercizio non è progressivo ometti "step".
- Conduzione del mister: poche indicazioni e brevi, domande guida durante le pause (es. "dove c'era lo spazio?"), lascia giocare durante i blocchi.
- Per ogni esercizio compila "vincoli": le regole usate e l'effetto atteso in campo (es. "2 tocchi → circolazione veloce; campo lungo 40x30 → attacco della profondità; gol doppio dopo recupero in 5" → riaggressione").`}
function appRule(){const r=appRanges();return `SPAZIO PER GIOCATORE (m² = area del campo / giocatori in quel campo, portieri inclusi se in porta; con 2 campi conta un campo): rispetta questi intervalli per tipo di lavoro: ${APP_TYPES.map(([k,l])=>`${l} ${r[k][0]}-${r[k][1]}`).join('; ')}. Riferimenti: sotto ~150 m² per giocatore i giochi non riproducono la corsa ad alta velocità di gara, ~200-210 m² per lo sprint (Riboli et al. 2022, U15-U19); i giochi senza portieri richiedono meno spazio di quelli con portieri a parità di intensità. Scrivi sempre lo spazio come "AxB m" e aggiungi il calcolo, es. "30x25 m (≈ 83 m² per giocatore)".`}
function condRule(){const t=team();if(t.prepAtletico==='si')return '';return `LAVORO CONDIZIONALE (non c'è preparatore atletico, lo pianifichi tu): distribuisci nella settimana forza, prevenzione, resistenza e velocità coerenti con il giorno MD, preferendo il lavoro integrato con palla (rapporto lavoro/recupero, dimensione del campo, numero di giocatori) e aggiungendo brevi blocchi a secco quando servono:
- giorno di tensione/MD+2: forza e prevenzione infortuni (es. 8-10' a secco: nordic hamstring, adduttori Copenhagen, polpacci, core, salti e atterraggi) più giochi a campo ridotto ad alta intensità;
- MD-3 (durata): resistenza specifica con blocchi lunghi in spazi ampi o intermittente a secco breve (es. 15"-15");
- MD-2: velocità e accelerazioni brevi (sprint 10-20 m con recupero completo), volume basso.
Per ogni esercizio compila "condizionale" con l'obiettivo fisico e i parametri (es. "intermittente 1' lavoro/1' recupero, alta intensità", "forza eccentrica ischiocrurali 3x6").`}
function dayRule(giorni){const t=team();const st=t.stileGiorni||{};const r=giorni.filter(d=>st[d]).map(d=>`${DAYS_FULL[d]}: ${st[d]}`);return r.length?`IMPOSTAZIONE PREFERITA DAL MISTER PER I GIORNI (rispettala, integrandola con la logica MD): ${r.join(' | ')}`:''}
function groupRule(w){const a=w&&w.statoGruppo,b=w&&w.obiettivoGruppo;return a||b?`STATO E OBIETTIVO DEL GRUPPO (oltre agli aspetti tecnico-tattici): ${a?'stato mentale: '+a+'. ':''}${b?'cosa vuole ottenere il mister dal gruppo: '+b+'. ':''}Scegli forme di esercizio, competizione, punteggi, squadre e clima della seduta adatti a questo (es. sfide a punteggio e squadre fisse per la competitività, giochi ad alta riuscita per ritrovare fiducia, esercizi cognitivi con regole che cambiano per la concentrazione).`:''}
function staffRule(w){const t=team();const gk=t.prepPortieri||'a volte';const days=w&&Array.isArray(w.gkCoach)?w.gkCoach:(t.gkDays&&gk==='a volte'?t.gkDays.map(Number):null);
  const gkTxt=gk==='mai'?'Non c’è preparatore dei portieri: ogni esercizio coinvolge i portieri con compiti da portiere (porta, uscite, prese alte, rinvii, costruzione, jolly con i piedi nei possessi).':`Preparatore dei portieri: ${days?(days.length?'presente '+days.map(d=>DAYS_FULL[d]).join(', ')+'; negli altri giorni non c’è':'questa settimana non c’è'):(gk==='sempre'?'sempre presente':'non sempre presente, non contarci')}. Quando c’è, i portieri possono fare i primi 15-25' di lavoro specifico con lui e poi entrano negli esercizi. Quando NON c’è, ogni esercizio coinvolge i portieri con compiti da portiere: in porta, uscite, prese alte sui cross, rinvii e costruzione dal basso, come jolly di appoggio con i piedi nei possessi; mai portieri fermi o usati a caso come giocatori di movimento.`;
  return `ORGANIZZAZIONE (vincolo obbligatorio): l'allenatore è SOLO in campo. ${gkTxt}
- Vietati: lavori differenziati per minutaggio, compensativi, gruppi separati che richiedono un secondo allenatore.
- Tutto il gruppo lavora insieme in un unico esercizio, oppure in gruppi uguali e autogestiti con regole semplici controllabili con un colpo d'occhio da una posizione.
- SQUADRE: nei giochi a squadre usa 2 squadre (al massimo 3) per tutta la seduta; per i lavori su 2 campi (rondo, tornei, partite in parallelo) ogni squadra si divide in 2 sottogruppi (es. Rossi A contro Blu A sul campo 1, Rossi B contro Blu B sul campo 2): non proporre 4 o più squadre indipendenti.
- MASSIMO 2 CAMPI in parallelo per i lavori a gruppi (rondo, possessi, partite a campo ridotto): mai 3 o più griglie. Eccezione: i DUELLI (1c1, 2c1, 2c2) e i lavori a file brevi e ripetuti si possono organizzare su più file o corsie affiancate (anche 3-4), purché siano una accanto all'altra e visibili da una posizione. Se i giocatori sono troppi per 2 campi, aumenta i numeri per campo (più giocatori, più jolly) o usa la rotazione ogni 3-4'. I due campi stanno affiancati, con l'allenatore in mezzo.
- Rotazioni ammesse: nei lavori tattici (es. linea difensiva + mediani contro attaccanti) un gruppo può aspettare fuori se si alterna con chi è dentro ogni 3-4 minuti; indica nella descrizione chi ruota e ogni quanto. Evita attese più lunghe o senza rotazione definita.
- Pochi tempi morti: esercizi in progressione che riusano lo stesso spazio e gli stessi coni (si passa al successivo spostando pochi coni), palloni di riserva già sistemati ai lati e nelle porte, regole spiegate durante le pause per bere, recuperi attivi (tecnica a coppie, giro palla) invece di pause ferme, rotazione dei jolly e dei giocatori in eccesso dentro l'esercizio.
- Per ogni esercizio compila "organizzazione": come preparare il campo, dove mettere i palloni, dove si posiziona l'allenatore e come passare all'esercizio successivo.`}
function finRule(){const f=Number(team().partitaFinale??15);return f?`
Ogni seduta TERMINA con una PARTITA (ultimo esercizio, fase "finale", nome che inizia con "Partita") di almeno ${f}': libera o a tema su un principio della seduta o della settimana, con numeri e portieri esatti. Dopo la partita al massimo un breve defaticamento.`:''}
function attRule(){const a=Number(team().attivazione??10);return (a?`Ogni seduta inizia SEMPRE con l'esercizio di attivazione di ${a}' (fase "attivazione", mobilità e andature, senza schema): nel giorno di tensione/MD+2 con elasticità e balzi bassi, in MD-3 con andature ampie e allunghi, in MD-2/MD-1 con frequenza e partenze reattive. Gli altri esercizi coprono i minuti restanti.`:'')+finRule()}
/* Allenatore di riferimento: le sedute seguono i suoi principi, adattati alla squadra */
function coachRule(){const t=team();const a=(t.allenatoreRif||'').trim(),pr=(t.principiRif||'').trim();if(!a&&!pr)return '';
  return `ALLENATORE DI RIFERIMENTO${a?': '+a:''}. Struttura la settimana e scegli gli esercizi secondo i suoi principi${a?' (idea di gioco, organizzazione del microciclo, tipi di esercitazioni ricorrenti, linguaggio)':''}, adattandoli a livello, numeri e risorse di questa squadra (allenatore solo in campo, durate e sedute indicate).${pr?' Principi indicati dal mister: '+pr+'.':''} Usa solo elementi che conosci con sicurezza e che sono documentati (libri, interviste, sedute pubbliche); non attribuirgli esercizi inventati. Nel razionale o nel principio scrivi quale suo principio stai applicando.`}
/* La richiesta del mister vale più delle regole generali: va in fondo al prompt e viene controllata */
function reqRule(req){req=String(req||'').trim();if(!req)return '';const nb=/senza\s+(il\s+)?pall/i.test(req);
  return `\nRICHIESTA DEL MISTER, VINCOLANTE (prevale su tutte le regole generali scritte sopra, comprese quelle su palla, avversari, partita finale e principi di progettazione): ${req}
Rispetta alla lettera ogni vincolo, numero, spazio e durata indicati.${nb?' "Senza palla" significa che il pallone non si usa: niente passaggi, conduzioni o tiri, e nello schema nessun elemento "palla", "passaggio" o "conduzione" (usa solo "corsa").':''}`}
function checkReq(req,e){req=String(req||'').toLowerCase();const v=[];if(!req||!e)return v;const el=(e.schema&&e.schema.el)||[];const txt=((e.descrizione||'')+' '+(e.organizzazione||'')).toLowerCase();
  if(/senza\s+(il\s+)?pall/.test(req)){if(el.some(x=>['palla','passaggio','conduzione'].includes(x.k)))v.push('il disegno contiene palla, passaggi o conduzioni');
    const m=txt.match(/(^|[^a-zà])(passaggi?o?|conduzion[ei]|conduce|tiro|tiri|calcia)(?=[^a-zà]|$)/);if(m&&!/(senza|niente|no|non)\s+[a-zà\s]{0,12}$/.test(txt.slice(Math.max(0,m.index-20),m.index+1)))v.push('la descrizione usa il pallone ('+m[2]+')')}
  if(/senza\s+port[ae]/.test(req)&&el.some(x=>x.k==='porta'||x.k==='porticina'))v.push('il disegno contiene porte');
  const d=req.match(/(\d{1,2})\s*(?:'|’|min)/);if(d&&Number(e.durata)!==Number(d[1]))v.push(`durata ${e.durata}' invece di ${d[1]}'`);
  const sp=req.match(/(\d+)\s*[x×]\s*(\d+)/);if(sp&&!(String(e.spazio||'').includes(sp[1])&&String(e.spazio||'').includes(sp[2])))v.push(`spazio "${e.spazio}" invece di ${sp[1]}x${sp[2]}`);
  return v}
function stripBall(e){if(e&&e.schema)e.schema={...e.schema,el:e.schema.el.filter(x=>!['palla','passaggio','conduzione'].includes(x.k))};return e}
/* Chiede un esercizio, controlla i vincoli e, se non rispettati, riprova una volta spiegando cosa non va */
async function askExercise(prompt,req){let e=normalizeEx(await S.sample.json(prompt,{modelTier:'default'}));let v=checkReq(req,e);
  if(v.length){try{e=normalizeEx(await S.sample.json(prompt+`\nATTENZIONE: una proposta precedente non rispettava la richiesta del mister (${v.join('; ')}). Correggi e rispetta tutti i vincoli.`,{modelTier:'default'}));v=checkReq(req,e)}catch(_){}}
  if(/senza\s+(il\s+)?pall/i.test(req||''))stripBall(e);return {e,v:checkReq(req,e)}}
function teamContext(){
  const t=team();const pr=t.principi||{};const pl=S.players;const by=r=>pl.filter(p=>p.ruolo===r);
  const unav=pl.filter(p=>p.stato&&p.stato!=='disponibile').map(p=>`${p.nome} (${p.posizione||p.ruolo||''}, ${STATI[p.stato][0].toLowerCase()}${p.rientro?', rientro '+p.rientro:''}${p.note?', '+p.note:''})`);
  const lm=lastMatch();const nm=nextMatch();
  const played=S.matches.filter(m=>m.giocata&&m.golFatti!==''&&m.golFatti!=null).sort((a,b)=>a.data<b.data?-1:1);
  return `SQUADRA: ${t.nome}, ${t.categoria}, livello ${t.livello}. Sistemi di gioco: ${sistemi().length?sistemi().map(x=>x.nome+(x.uso?' ('+x.uso+')':'')+', stato: '+(x.stato||'in costruzione')).join('; '):'non indicati'}. Allenamenti: ${(t.giorni||[]).map(d=>DAYS_FULL[d]+(ora(d)?' ore '+ora(d):'')).join(', ')}, ${t.durata}' ciascuno. Strutture: ${t.campo||'n.d.'}.
MODELLO DI GIOCO (come l'allenatore vuole giocare) E COMPORTAMENTO ATTUALE DELLA SQUADRA, per fase, ordinati per priorità:
${[...FASI_GIOCO].sort((a,b)=>({alta:0,media:1,bassa:2}[(t.priorita||{})[a[0]]||'media'])-({alta:0,media:1,bassa:2}[(t.priorita||{})[b[0]]||'media'])).map(([k,l])=>`- ${l} [priorità ${(t.priorita||{})[k]||'media'}]
  VOGLIO: ${pr[k]||'non specificato'}
  OGGI LA SQUADRA: ${(t.realta||{})[k]||'non descritto'}`).join('\n')}
${t.note?'Note dell’allenatore: '+t.note+'\n':''}${coachRule()?coachRule()+'\n':''}ROSA: ${pl.length} giocatori (POR ${by('POR').length}, DIF ${by('DIF').length}, CEN ${by('CEN').length}, ATT ${by('ATT').length}). Giocatori: ${sortPlayers(pl).map(p=>`${p.nome} (${posFull(p)}${p.piede?', '+p.piede:''}${p.nascita?', '+p.nascita:''})`).join('; ')}.
Non disponibili o limitati: ${unav.length?unav.join('; '):'nessuno'}.
${lm?`ULTIMA PARTITA: ${lm.data} vs ${lm.avversario} ${lm.golFatti!=null&&lm.golFatti!==''?lm.golFatti+'-'+lm.golSubiti:'(risultato non inserito)'}. Analisi: ${lm.analisi||'nessuna'}`:''}
${nm?`PROSSIMA PARTITA: ${nm.data}${nm.ora?' ore '+nm.ora:''} vs ${nm.avversario} (${nm.casa?'casa':'trasferta'}). Note sull'avversario: ${nm.analisi||'nessuna'}`:''}
${played.length?'RISULTATI STAGIONE: '+played.map(m=>`${m.data} ${m.casa?'casa':'trasf.'} vs ${m.avversario} ${m.golFatti}-${m.golSubiti}`).join('; '):''}
${S.classifica&&Array.isArray(S.classifica.righe)?'CLASSIFICA ('+(S.classifica.aggiornata||'')+'): '+S.classifica.righe.map((r,i)=>(i+1)+'. '+r.squadra+' '+r.pt+'pt').join('; '):''}
${(()=>{const t=S.drills.filter(d=>d.usi).sort((a,b)=>(b.valutazione==='funzionato')-(a.valutazione==='funzionato')||(b.usi||0)-(a.usi||0)).slice(0,25);return t.length?'ESERCIZI GIÀ SVOLTI DAL GRUPPO (libreria del mister; riproponi o adatta quelli funzionati, evita di ripetere identici quelli da rivedere): '+t.map(d=>`${d.nome} [${CATS[d.cat]||d.cat}, ${d.giocatori||''}, ${d.usi} volte${d.valutazione?', '+d.valutazione:''}]`).join('; '):''})()}`;
}
function prevWeekSummary(startIso){const id=iso(addDays(parseIso(startIso),-7));const w=S.weeks[id];if(!w)return 'SETTIMANA PRECEDENTE: non registrata.';const t=team();
  return `SETTIMANA PRECEDENTE (${id}): obiettivo "${w.obiettivo||'-'}"; carico pianificato ${dailyLoads(w,t,false).reduce((a,b)=>a+b,0)} UA, rilevato ${dailyLoads(w,t,true).reduce((a,b)=>a+b,0)} UA. Sedute: ${(w.sessioni||[]).map(s=>`${DAYS[s.giorno]} ${s.md} ${s.tipo} ${s.durata}' RPE ${s.rpe}${s.rpeReale!=null?' (reale '+s.rpeReale+')':''}${Array.isArray(s.presenti)?' presenti '+s.presenti.length:''}${s.note?' nota: '+s.note:''}`).join(' | ')}`}
/* Giorni da progettare: nella settimana in corso solo da oggi in avanti e non già svolti */
function aiDefaultDays(w,giorni){const cur=iso(mondayOf(new Date()))===w.id;const today=(new Date().getDay()+6)%7;
  return giorni.filter(d=>!(cur&&d<today)&&!(w.sessioni||[]).some(s=>s.giorno===d&&s.done))}
function aiPanel(w){
  const a=S.ai;if(!a||a.week!==w.id)return '';
  if(!S.sample)return `<div class="aibox"><p>L'assistente AI non è disponibile in questa vista. Apri la pagina su claude.ai per usarlo; intanto puoi usare il morfociclo di base.</p><div class="row"><button class="btn" data-act="aiClose">Chiudi</button></div></div>`;
  const t=team();const md=matchDayOf(w);const giorni=(t.giorni||[]).filter(d=>md==null||md===''||d!==Number(md));
  if(a.state==='form')return `<div class="aibox"><div class="row" style="justify-content:space-between"><h3>Progetta il microciclo</h3><button class="btn sm ghost" data-act="aiClose">Chiudi</button></div>
    <p class="muted" style="font-size:.9rem">Uso modello di gioco, rosa e disponibilità, ultima partita, prossimo avversario, classifica e carico della settimana prima. Sedute: ${giorni.map(d=>DAYS[d]+' '+(mdLabel(d,md)||'')+(ora(d)?' ore '+ora(d):'')).join(', ')||'nessun giorno impostato'}. Ogni esercizio arriva già disegnato.</p>
    ${(t.prepPortieri||'a volte')!=='mai'?`<div class="f"><span class="lbl">Preparatore portieri presente</span><div class="checks" id="aiGk" style="margin-top:6px">${giorni.map(d=>`<label><input type="checkbox" value="${d}" ${(Array.isArray(w.gkCoach)?w.gkCoach.includes(d):gkDefault(d))?'checked':''}>${DAYS_FULL[d]}</label>`).join('')}</div></div>`:''}
    <div class="f"><span class="lbl">Presenti previsti (movimento + portieri)</span><div class="checks" id="aiPrev" style="margin-top:6px">${giorni.map(d=>{const x=previsti(w,d);return `<label>${DAYS[d]} <input type="number" min="0" max="30" data-d="${d}" data-t="m" value="${x.m}" style="width:56px;padding:2px 6px" aria-label="Giocatori di movimento ${DAYS_FULL[d]}"> + <input type="number" min="0" max="4" data-d="${d}" data-t="p" value="${x.p}" style="width:46px;padding:2px 6px" aria-label="Portieri ${DAYS_FULL[d]}"> P</label>`}).join('')}</div></div>
    ${w.ideaPartita?`<div class="callout"><span class="lbl">Idea della partita (guida tutte le sedute che progetto)</span><p style="font-size:.9rem;margin-top:4px">${esc(w.ideaPartita)}</p></div>`:`<p class="muted" style="font-size:.85rem">Se hai già in mente come giocare la partita, scrivila in «Idea tattica della partita» qui sopra (o ragionala con l’assistente): le sedute la prepareranno.</p>`}
    <div class="f"><span class="lbl">Sedute da progettare</span><div class="checks" id="aiDays" style="margin-top:6px">${giorni.map(d=>{const old=(w.sessioni||[]).find(s=>s.giorno===d);const sel=(a.days||aiDefaultDays(w,giorni)).includes(d);return `<label><input type="checkbox" value="${d}" ${sel?'checked':''}>${DAYS_FULL[d]} ${mdLabel(d,md)||''}${old?` <span class="muted" style="font-size:.8rem">${old.done?'(svolta)':'(c’è già)'}</span>`:''}</label>`}).join('')}</div><p class="muted" style="font-size:.82rem;margin-top:4px">Le sedute non spuntate restano come sono e l’assistente ne tiene conto per carichi e contenuti.</p></div>
    <div class="fgrid"><label class="f"><span>Stato del gruppo</span><select id="aiStato">${STATI_GRUPPO.map(x=>`<option value="${esc(x)}" ${(w.statoGruppo||'')===x?'selected':''}>${x||'Non indicato'}</option>`).join('')}</select></label>
      <label class="f"><span>Cosa voglio ottenere dal gruppo</span><input type="text" id="aiObG" data-keep="1" value="${esc(w.obiettivoGruppo||'')}" placeholder="Es. ritrovare fiducia, più competitività, concentrazione"></label></div>
    <label class="f"><span>Indicazioni</span><textarea id="aiReq" data-keep="1" placeholder="Es. Sabato abbiamo preso 2 gol su ripartenze centrali. Lunedì siamo di solito in 14, mercoledì campo intero.">${esc(a.req||'')}</textarea></label>
    <div class="row"><button class="btn ai" data-act="aiGen">Progetta le sedute</button></div></div>`;
  if(a.state==='busy')return `<div class="aibox"><div class="row" style="justify-content:space-between"><h3>Sto progettando la settimana…</h3><button class="btn sm" data-act="aiStop">Interrompi</button></div><p class="muted" style="font-size:.85rem">Prima il piano della settimana, poi il dettaglio di ogni seduta con i disegni. Di solito 1-3 minuti.</p><ul id="aiSteps" style="margin:0;padding-left:18px;font-size:.9rem">${aiStepsHtml()}</ul></div>`;
  if(a.state==='error')return `<div class="aibox"><p>${esc(a.msg)}</p><div class="row"><button class="btn ai" data-act="aiGen">Riprova</button><button class="btn" data-act="aiClose">Chiudi</button></div></div>`;
  if(a.state==='done'){const r=a.result;return `<div class="aibox"><div class="row" style="justify-content:space-between"><h3>Proposta dell'assistente</h3><button class="btn sm ghost" data-act="aiClose">Scarta</button></div>
    ${r.obiettivo?`<p><b>Obiettivo:</b> ${esc(r.obiettivo)}</p>`:''}${r.razionale?`<p class="muted" style="font-size:.9rem">${esc(r.razionale)}</p>`:''}
    <div class="preview">${r.sessioni.map(s=>`<div class="ps ${mdClass(s.md)}"><div class="row">${mdChip(s.md)}<b>${DAYS_FULL[s.giorno]} · ${esc(s.titolo)}</b><span class="muted num" style="font-size:.85rem">${s.durata}′ · RPE ${s.rpe}</span></div><div style="font-size:.88rem">${esc(s.focus)}</div><div class="muted" style="font-size:.82rem">${s.esercizi.map(e=>esc(e.nome)+' ('+e.durata+'′)').join(' → ')}</div></div>`).join('')}</div>
    ${r.note?`<p style="font-size:.9rem"><b>Note per il mister:</b> ${esc(r.note)}</p>`:''}
    <div class="row"><button class="btn pri" data-act="aiApply" ${(w.sessioni||[]).some(x=>r.sessioni.some(y=>y.giorno===x.giorno))?`data-confirm="Conferma: sostituisce ${r.sessioni.map(x=>DAYS_FULL[x.giorno].toLowerCase()).join(' e ')}"`:''}>${a.kept?'Applica a '+r.sessioni.map(x=>DAYS_FULL[x.giorno].toLowerCase()).join(' e '):'Applica alla settimana'}</button><button class="btn" data-act="aiGen">Rigenera</button></div></div>`}
  return '';
}
const STEP_LBL={wait:'in attesa',run:'in corso…',retry:'nuovo tentativo…',ok:'fatto',fail:'non riuscito: uso il piano con disegni automatici'};
function aiStepsHtml(){return (S.ai&&S.ai.steps||[]).map(s=>`<li>${esc(s.label)}: <span class="${s.state==='ok'?'':'muted'}">${STEP_LBL[s.state]||''}</span></li>`).join('')}
function aiStepsUpd(){const el=document.getElementById('aiSteps');if(el)el.innerHTML=aiStepsHtml()}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function aiErrMsg(e){return e?.code==='not_granted'?'L’uso dell’assistente non è stato autorizzato per questa pagina.':e?.code==='rate_limited'?'Troppe richieste ravvicinate: aspetta un minuto e riprova.':e?.code==='invalid_json'?'La risposta dell’assistente non era nel formato atteso. Riprova.':'Generazione non riuscita'+(e?.code?' ('+e.code+')':'')+': '+(e?.message||'errore sconosciuto')}
async function aiGenerate(){
  const w=getWeek(S.weekStart);const t=team();const md=matchDayOf(w);
  const req=(document.getElementById('aiReq')?.value??S.ai?.req??'').trim();
  const gkBox=document.getElementById('aiGk');if(gkBox)w.gkCoach=[...gkBox.querySelectorAll('input:checked')].map(i=>Number(i.value));
  const pv=document.getElementById('aiPrev');if(pv){const o={};pv.querySelectorAll('input').forEach(i=>{const d=i.dataset.d;o[d]=o[d]||{};o[d][i.dataset.t]=Number(i.value)||0});w.previsti=o}
  const st=document.getElementById('aiStato');if(st){w.statoGruppo=st.value;w.obiettivoGruppo=(document.getElementById('aiObG')?.value||'').trim()}
  if(gkBox||pv||st)saveWeek({...w});
  const tutti=(t.giorni&&t.giorni.length?t.giorni:daysForSlots(t.sedute||3,md??6)).filter(d=>md==null||md===''||d!==Number(md));
  const dBox=document.getElementById('aiDays');const giorni=dBox?[...dBox.querySelectorAll('input:checked')].map(i=>Number(i.value)):(S.ai?.days||tutti);
  if(!giorni.length){toast('Scegli almeno una seduta da progettare');return}
  const kept=(w.sessioni||[]).filter(s=>!giorni.includes(s.giorno));
  const keptTxt=kept.length?`SEDUTE CHE RESTANO COME SONO (già svolte o già decise: non riprogettarle, ma tienine conto per carico, varietà e progressione): ${kept.map(s=>`${DAYS_FULL[s.giorno]} ${normMd(s.md)||''}${s.done?' (svolta'+(s.rpeReale?', RPE '+s.rpeReale:'')+')':''}: ${s.titolo} – ${(s.esercizi||[]).map(e=>e.nome).join(', ')}`).join(' | ')}`:'';
  const ideaTxt=w.ideaPartita?`IDEA DELLA PARTITA DI ${md!=null&&md!==''?DAYS_FULL[md].toUpperCase():'QUESTA SETTIMANA'} (spiegata dal mister, è il filo conduttore): ${w.ideaPartita}
Ogni seduta da progettare deve preparare questa idea, con i mezzi del suo giorno: in MD-3 i principi dell'idea in spazi ampi e numeri vicini all'11c11; in MD-2 le stesse situazioni a velocità alta, volume basso e recuperi completi; nell'ultima seduta prima della gara titolari contro riserve sull'idea. Scrivi nel "principio" di ogni esercizio quale parte dell'idea allena e chiudi con una partita a tema sull'idea.`:'';
  const steps=[{label:'Piano della settimana',state:'run'},...giorni.map(d=>({label:'Dettaglio di '+DAYS_FULL[d].toLowerCase(),state:'wait'}))];
  const ac=new AbortController();
  S.ai={week:w.id,state:'busy',req,steps,ac,days:giorni};render();
  const ctx=`${METODO}

${teamContext()}
${prevWeekSummary(w.id)}

CALENDARIO: partita ${md==null||md===''?'assente (settimana di sosta)':DAYS_FULL[md]+(w.avversario?' contro '+w.avversario:'')}.
Giorni di allenamento (0=lunedì … 6=domenica, etichetta MD già calcolata): ${giorni.map(d=>d+'='+DAYS_FULL[d]+' '+(mdLabel(d,md)||'')+(ora(d)?' ore '+ora(d):'')).join(', ')}.
Obiettivo indicato dal mister: ${w.obiettivo||'non indicato, proponilo tu'}.
${ideaTxt}
${keptTxt}
Indicazioni del mister: ${req||'nessuna'}.
${attRule()}
${sisRule(w)}
${staffRule(w)}
${numRule(w,giorni)}
${dayRule(giorni)}
${groupRule(w)}
${condRule()}
${appRule()}
${designRule()}`;
  const planPrompt=`Sei il collaboratore tecnico di un allenatore di calcio italiano. Progetta il PIANO ${kept.length?'delle sedute indicate':'del microciclo'} della settimana che inizia ${w.id} (il dettaglio degli esercizi verrà sviluppato dopo).
${ctx}

Rispondi SOLO con un oggetto JSON in italiano, conciso:
{"obiettivo":"una frase","razionale":"2-3 frasi","note":"indicazioni pratiche su carico, disponibilità e organizzazione (niente lavori differenziati)","sessioni":[{"giorno":0,"titolo":"titolo breve","focus":"obiettivo della seduta","durata":${t.durata},"rpe":6,"condizionale":"lavoro fisico della seduta","esercizi":[{"nome":"","fase":"attivazione|iniziale|centrale|condizionale|finale","durata":10,"giocatori":"numeri esatti con totale","sistema":"nome del sistema o entrambi","idea":"1-2 frasi: cosa si fa e perché"}]}]}
${reqRule(req)}
Una sessione per ciascun giorno indicato: attivazione + 2-3 esercizi (più un eventuale breve blocco condizionale) + la partita finale, durate che sommano a ${t.durata}'. Verifica i numeri di ogni esercizio.`;
  let plan;
  try{plan=await S.sample.json(planPrompt,{modelTier:'complex',signal:ac.signal});if(!Array.isArray(plan?.sessioni)||!plan.sessioni.length)throw {code:'empty',message:'Il piano non contiene sedute.'};steps[0].state='ok';aiStepsUpd()}
  catch(e){if(e&&(e.name==='AbortError'||e.code==='aborted')){S.ai={week:w.id,state:'form',req,days:giorni};render();return}S.ai={week:w.id,state:'error',req,days:giorni,msg:aiErrMsg(e)};render();return}
  const pianoTxt=JSON.stringify({obiettivo:plan.obiettivo,sessioni:plan.sessioni.map(s=>({giorno:s.giorno,titolo:s.titolo,focus:s.focus,esercizi:(s.esercizi||[]).map(e=>e.nome+' ('+e.durata+"')")}))});
  const detail=async(s,idx)=>{const stp=steps[idx+1]||{};
    const p=`Sei il collaboratore tecnico di un allenatore di calcio italiano. Sviluppa in dettaglio la seduta di ${DAYS_FULL[s.giorno]||''} del microciclo, mantenendo esercizi, ordine, durate e numeri del piano (correggi solo eventuali errori nei numeri).
${ctx}

PIANO DELLA SETTIMANA: ${pianoTxt}
SEDUTA DA SVILUPPARE: ${JSON.stringify(s)}

${SCHEMA_SPEC}

Rispondi SOLO con JSON: {"esercizi":[{"nome":"","fase":"attivazione|iniziale|centrale|condizionale|finale","durata":10,"spazio":"es. 30x25 m","giocatori":"numeri esatti con totale","descrizione":"regole, blocchi, recuperi e rotazioni","principio":"principio del modello allenato","coaching":"2-3 punti chiave","organizzazione":"preparazione campo, palloni, posizione allenatore, passaggio al successivo","condizionale":"obiettivo fisico e parametri","vincoli":"regole usate e effetto atteso","sistema":"nome del sistema o entrambi","step":[{"titolo":"","giocatori":"","descrizione":""}],"schema":{...}}]}
L'attivazione non ha schema; tutti gli altri esercizi sì.${reqRule(req)}`;
    for(let k=0;k<2;k++){
      stp.state=k?'retry':'run';aiStepsUpd();
      try{const r=await S.sample.json(p,{modelTier:'default',signal:ac.signal});const es=(Array.isArray(r?.esercizi)?r.esercizi:Array.isArray(r)?r:[]).map(normalizeEx);if(!es.length)throw {code:'empty'};stp.state='ok';aiStepsUpd();return es}
      catch(e){if(e&&(e.name==='AbortError'||e.code==='aborted'))throw e;if(e?.code==='not_granted')throw e;await sleep(e?.code==='rate_limited'?6000:800)}
    }
    stp.state='fail';aiStepsUpd();return null};
  try{
    const det=await Promise.all(plan.sessioni.map((s,i)=>sleep(i*700).then(()=>detail(s,i))));
    const failed=[];
    const res={...plan,sessioni:plan.sessioni.map((s,i)=>{if(det[i])return {...s,esercizi:det[i]};failed.push(DAYS_FULL[s.giorno]);return {...s,esercizi:(s.esercizi||[]).map(e=>({...e,descrizione:e.idea||''}))}})};
    if(failed.length)res.note=(res.note?res.note+' ':'')+`Il dettaglio di ${failed.join(', ')} non è riuscito: ci sono gli esercizi del piano con disegni automatici, completali da Modifica o rigenera.`;
    const r=normalizeWeekAI(res,md);if(!r.sessioni.length)throw {code:'empty',message:'La proposta non contiene sedute valide.'};
    r.sessioni=r.sessioni.filter(x=>giorni.includes(x.giorno));S.ai={week:w.id,state:'done',req,result:r,days:giorni,kept:kept.length};
  }catch(e){
    if(e&&(e.name==='AbortError'||e.code==='aborted'))S.ai={week:w.id,state:'form',req,days:giorni};
    else S.ai={week:w.id,state:'error',req,days:giorni,msg:aiErrMsg(e)};
  }
  render();
}
function normalizeEx(e){const o={nome:String(e?.nome||'Esercizio'),fase:FASI.includes(e?.fase)?e.fase:'centrale',durata:Math.max(1,Math.round(Number(e?.durata)||10)),spazio:String(e?.spazio||''),giocatori:String(e?.giocatori||''),descrizione:String(e?.descrizione||''),principio:String(e?.principio||''),coaching:String(e?.coaching||''),organizzazione:String(e?.organizzazione||''),condizionale:String(e?.condizionale||''),vincoli:String(e?.vincoli||''),sistema:String(e?.sistema||'')};const sc=normalizeSchema(e?.schema);if(sc&&sc.el.length)o.schema=sc;if(Array.isArray(e?.step)){const st=e.step.slice(0,4).map(x=>{const r={titolo:String(x?.titolo||''),giocatori:String(x?.giocatori||''),descrizione:String(x?.descrizione||'')};const ss=normalizeSchema(x?.schema);if(ss&&ss.el.length)r.schema=ss;return r}).filter(x=>x.titolo||x.descrizione);if(st.length)o.step=st}return fixEx(o)}
function ensureAtt(es,md){const a=Number(team().attivazione??10);if(!a)return es;const i=es.findIndex(e=>e.fase==='attivazione');const base=attivazione(md,a);if(i<0)return [base,...es];es[i]={...base,...es[i],schema:es[i].schema||base.schema};return es}
function normalizeWeekAI(res,md){
  const ss=Array.isArray(res?.sessioni)?res.sessioni:[];
  const sessioni=ss.map(s=>{const g=Math.min(6,Math.max(0,Math.round(Number(s.giorno))));const lab=mdLabel(g,md)||String(s.md||'');const es=ensureFinalGame(ensureAtt((Array.isArray(s.esercizi)?s.esercizi:[]).map(normalizeEx),lab),team().partitaFinale??15,Number(s.durata)||team().durata);
    return {id:uid(),giorno:g,md:lab,tipo:(MD_INFO[lab]||{}).tipo||String(s.tipo||'Seduta libera'),titolo:String(s.titolo||(MD_INFO[lab]||{}).tipo||'Seduta'),focus:String(s.focus||''),durata:Math.round(Number(s.durata)||es.reduce((a,e)=>a+e.durata,0)||90),rpe:Math.min(10,Math.max(1,Number(s.rpe)||5)),esercizi:es,presenti:null,rpeReale:null,note:'',done:false}}).filter(s=>Number.isFinite(s.giorno)).sort((a,b)=>a.giorno-b.giorno);
  return {obiettivo:String(res?.obiettivo||''),razionale:String(res?.razionale||''),note:String(res?.note||''),sessioni};
}

/* ===== Seduta: scheda, modifica, dopo la seduta ===== */
let ED=null;
function openSess(wid,idx,tab){const w=getWeek(wid);const s=idx>=0&&w.sessioni&&w.sessioni[idx]?JSON.parse(JSON.stringify(w.sessioni[idx])):null;if(!s)return;ED={wid,idx,s,tab:tab||'scheda'};drawEditor();const d=document.getElementById('dlg');if(!d.open)d.showModal()}
function newSess(day){const w=getWeek(S.weekStart);const md=matchDayOf(w);const s=templateSession(day,md,0,team().attivazione??10);s.esercizi=s.esercizi.filter(e=>e.fase==='attivazione');s.durata=team().durata;ED={wid:w.id,idx:-1,s,tab:'piano'};drawEditor();document.getElementById('dlg').showModal()}
const TEAM_NAMES=['Rossi','Blu','Gialli'];
const TEAM_COL={Rossi:'#E4572E',Blu:'#2F6FDB',Gialli:'#F2C230',Titolari:'#E4572E',Riserve:'#2F6FDB'};
function parseTeams(e){const parse=g=>{g=String(g||'').toLowerCase();const out={sizes:[],J:0,R:0};
  const pp=[...g.matchAll(/(\d+)\s*(?:giocatori\s*)?(?:di movimento\s*)?\+\s*p\b/g)].map(m=>+m[1]).filter(n=>n>0&&n<=11);
  let x=g.match(/(\d+)\s*(?:\+\s*p\s*)?(?:c(?=\s*\d)|contro|vs)\s*(?:[a-zà]+\s+)?(?:p\s*\+\s*)?(\d+)/);
  if(pp.length>=2&&!(x&&x.index<g.indexOf(pp[0]+'')))x={0:'',1:pp[0],2:pp[1],index:g.length};
  if(x){out.sizes=[+x[1],+x[2]];const rest=g.slice(x.index+x[0].length);const jm=rest.match(/^\s*\+\s*(\d+)(?!\s*p)/);if(jm)out.J=+jm[1]}
  const sq=g.match(/(\d+)\s*squadre\s*(?:fisse\s*)?da\s*(\d+)/);
  if(sq){const n=Math.min(6,+sq[1]),m=+sq[2];if(x&&/attesa|riposo|fuori/.test(g))out.sizes=[...out.sizes,...Array(n).fill(m)];else out.sizes=Array(n).fill(m)}
  const two=/(2|due)\s*(campi|griglie|quadrati)|in parallelo/.test(g);if(two&&out.sizes.length===2){out.sizes=[...out.sizes,...out.sizes];out.J*=2}
  const jj=g.match(/(\d+)\s*jolly/);if(jj)out.J=Math.max(out.J,+jj[1]);
  const rr=g.match(/(\d+)\s*in rotazione/);if(rr)out.R=+rr[1];
  return out};
  const a=parse(e.giocatori);return a.sizes.length?a:parse(e.descrizione)}
/* Il disegno deve avere tanti pallini quanti ne dice "giocatori": A e B dalle due squadre, jolly e portieri */
function expectedCounts(g){g=String(g||'');const t=parseTeams({giocatori:g});const out={};
  if(t.sizes.length===2){out.A=t.sizes[0];out.B=t.sizes[1]}
  const lg=g.toLowerCase();if(/jolly|\+\s*\d+(?!\s*p)/.test(lg)&&out.A!=null)out.J=t.J;
  const pm=lg.match(/(\d+)\s*portier/);if(pm)out.P=+pm[1];else{const k=(lg.match(/\+\s*p\b|\bp\s*\+/g)||[]).length;if(k)out.P=k;else if(/(un|1)\s*portiere/.test(lg))out.P=1}
  return out}
function fixCounts(sc,g){if(!sc||!Array.isArray(sc.el))return sc;const ex=expectedCounts(g);if(!Object.keys(ex).length)return sc;
  const el=sc.el.map(x=>({...x}));const w=sc.w,h=sc.h;const n=k=>el.filter(x=>x.k===k).length;
  if(ex.A!=null&&ex.A!==ex.B&&n('A')===ex.B&&n('B')===ex.A)el.forEach(x=>{if(x.k==='A')x.k='B';else if(x.k==='B')x.k='A'});
  const dots=()=>el.filter(x=>['A','B','J','P'].includes(x.k));
  const add=k=>{const mine=el.filter(x=>x.k===k);let x0,x1,y0,y1;
    if(k==='P'){const left=!el.some(m=>m.k==='P'&&m.x<w/2);el.push({k,x:r1(left?1.2:w-1.2),y:r1(h/2)});return}
    if(k==='J'){x0=0;x1=w;y0=0;y1=h}
    else if(mine.length){x0=Math.min(...mine.map(m=>m.x))-w*.12;x1=Math.max(...mine.map(m=>m.x))+w*.12;y0=Math.min(...mine.map(m=>m.y))-h*.12;y1=Math.max(...mine.map(m=>m.y))+h*.12}
    else if(k==='A'){x0=w*.08;x1=w*.46;y0=h*.1;y1=h*.9}else if(k==='B'){x0=w*.54;x1=w*.92;y0=h*.1;y1=h*.9}
    else{x0=0;x1=w;y0=0;y1=h}
    if(k!=='J'){x0=Math.max(1,x0);x1=Math.min(w-1,x1);y0=Math.max(1,y0);y1=Math.min(h-1,y1)}
    let best=null,bd=-1;for(let i=0;i<=12;i++)for(let j=0;j<=8;j++){const cx=x0+(x1-x0)*i/12,cy=y0+(y1-y0)*j/8;
      if(k==='J'&&(!(i===0||i===12||j===0||j===8)||((i===0||i===12)&&(j===0||j===8))))continue;
      const d=Math.min(1e9,...dots().map(m=>Math.hypot(m.x-cx,m.y-cy)));if(d>bd){bd=d;best={x:cx,y:cy}}}
    el.push({k,x:r1(best.x),y:r1(best.y)})};
  ['P','A','B','J'].forEach(k=>{if(ex[k]==null)return;let c=n(k);const want=Math.min(ex[k],k==='P'?4:22);
    while(c<want){add(k);c++}
    while(c>want){const i=el.map(x=>x.k).lastIndexOf(k);el.splice(i,1);c--}});
  return {...sc,el}}
function fixEx(e){if(!e)return e;e.schemaG=e.giocatori||'';if(e.schema)e.schema=fixCounts(e.schema,e.giocatori);if(Array.isArray(e.step))e.step.forEach(st=>{if(st&&st.schema)st.schema=fixCounts(st.schema,st.giocatori||e.giocatori)});return e}
const isTeamGame=e=>e.fase!=='attivazione'&&e.fase!=='condizionale'&&(parseTeams(e).sizes.length>0||/partita|squadre|torneo|rondo|possesso/i.test((e.nome||'')+' '+(e.giocatori||'')));
/* Disponibilità di ogni giocatore nel giorno della seduta: fuori, rientro (da infortunio, squalifica o assenza), acciaccato, ok */
const OUT_STATI=['infortunato','squalificato','assente'];
function rosterOn(dateIso){return sortPlayers(S.players).map(p=>{const st=p.stato||'disponibile';let k='ok',why='';
  if(OUT_STATI.includes(st)){if(p.rientro&&p.rientro<=dateIso){if(st==='infortunato'){k='rientro';why='rientro da infortunio previsto il '+fmtDay(parseIso(p.rientro))}}else{k='out';why=STATI[st][0].toLowerCase()+(p.rientro?' fino al '+fmtDay(parseIso(p.rientro)):'')}}
  else if(p.rientratoIl&&!['assente','squalificato'].includes(p.rientratoDa)&&(parseIso(dateIso)-parseIso(p.rientratoIl))/864e5>=0&&(parseIso(dateIso)-parseIso(p.rientratoIl))/864e5<=14){k='rientro';why='rientrato il '+fmtDay(parseIso(p.rientratoIl))+(p.rientratoDa?' ('+p.rientratoDa+')':'')}
  if(st==='acciaccato'){k='limitato';why='acciaccato'}
  return {p,k,why:why+(p.note&&k!=='ok'?' · '+p.note:'')}}).concat((ED&&ED.s&&ED.s.ospiti||[]).map(g=>({p:g,k:'ospite',why:'ospite per questa seduta'})))}
/* Il giorno del rientro il giocatore torna disponibile da solo */
function autoReturns(){const today=todayIso();const back=[];
  S.players.forEach(p=>{const st=p.stato||'disponibile';if(st==='disponibile'||!p.rientro||p.rientro>today)return;
    if(st==='infortunato'){p.rientratoIl=p.rientro;p.rientratoDa='infortunato'}
    p.stato='disponibile';p.rientro='';back.push(p);const {id,...rest}=p;put('giocatori',id,rest)});
  if(back.length){render();toast((back.length===1?'Torna disponibile: ':'Tornano disponibili: ')+back.map(p=>cogNome(p)).join(', '))}}
setInterval(()=>{if(S.players&&S.players.length)autoReturns()},30*60*1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&S.players&&S.players.length)autoReturns()});
function markReturn(p,oldSt,newSt){if(oldSt==='infortunato'&&!OUT_STATI.includes(newSt||'disponibile')){p.rientratoIl=todayIso();p.rientratoDa=STATI[oldSt][0].toLowerCase()}else if(OUT_STATI.includes(newSt)){delete p.rientratoIl;delete p.rientratoDa}}
/* Ospiti: giocatori aggregati solo per una seduta (es. un Under 17), salvati nella seduta e non nella rosa */
const allPl=()=>S.players.concat(ED&&ED.s&&Array.isArray(ED.s.ospiti)?ED.s.ospiti:[]);
const guestIds=s=>(s&&Array.isArray(s.ospiti)?s.ospiti:[]).map(g=>g.id);
function guestForm(){return `<details class="more"><summary>Aggiungi un ospite per questa seduta</summary><div class="row" style="flex-wrap:wrap;gap:8px;margin-top:8px"><input type="text" id="gNome" placeholder="Es. Rossi (Under 17)" style="flex:1;min-width:160px">${posSelect('gPos','','Ruolo')}<select id="gPiede"><option value="">Piede</option><option>destro</option><option>sinistro</option><option>ambidestro</option></select><button class="btn sm" data-act="guestAdd">Aggiungi</button></div><p class="muted" style="font-size:.82rem">Vale solo per questa seduta: conta nei numeri, nelle squadre e per l’assistente, ma non entra nella rosa.</p></details>`}
function presentIds(s){return Array.isArray(s.presenti)&&s.presenti.length?s.presenti:S.players.filter(p=>!p.stato||p.stato==='disponibile'||p.stato==='acciaccato').map(p=>p.id).concat(guestIds(s))}
/* --- duttilità: categorie di ruolo e fabbisogno per sistema --- */
const CAT_OF={'Difensore centrale':['DC'],'Braccetto (difesa a 3)':['DC','TER'],'Terzino':['TER','QUI'],'Terzino destro':['TER','QUI'],'Terzino sinistro':['TER','QUI'],'Quinto (tutta fascia)':['QUI','TER','EST'],'Mediano':['MED','MEZ'],'Regista':['MED','MEZ'],"Mezz'ala/esterno":['MEZ','QUI','EST'],'Mezzala':['MEZ','TRQ'],'Trequartista':['TRQ','MEZ','EST'],'Ala':['EST','PUN'],'Ala destra':['EST','QUI'],'Ala sinistra':['EST','QUI'],'Seconda punta':['PUN','TRQ'],'Attaccante centrale':['PUN']};
const CAT_LBL={DC:'centrale',TER:'terzino',QUI:'quinto',MED:'mediano',MEZ:'mezzala',TRQ:'trequartista',EST:'esterno/ala',PUN:'punta'};
function needsOf(sys){const n=String(sys).replace(/^1-/,'').split('-').map(Number).filter(x=>x>0);if(n.reduce((a,b)=>a+b,0)!==10)return null;const need={};const add=(k,v)=>{if(v>0)need[k]=(need[k]||0)+v};
  const def=n[0],att=n[n.length-1],mid=n.slice(1,-1);
  if(def===3)add('DC',3);else if(def===4){add('DC',2);add('TER',2)}else if(def===5){add('DC',3);add('QUI',2)}else add('DC',def);
  if(att===1)add('PUN',1);else if(att===2)add('PUN',2);else{add('PUN',1);add('EST',att-1)}
  if(mid.length===1){const m=mid[0];if(def===3&&m===5){add('QUI',2);add('MED',1);add('MEZ',2)}else if(m===3){add('MED',1);add('MEZ',2)}else if(m===4){add('MED',2);add('EST',2)}else if(m===5){add('MED',1);add('MEZ',2);add('EST',2)}else add('MEZ',m)}
  else{const[a,...r]=mid;add('MED',Math.min(a,2));add('MEZ',Math.max(0,a-2));r.forEach(m=>{if(m===3){add('EST',2);add('TRQ',1)}else if(m===1)add('TRQ',1);else if(m===2)add('EST',2);else add('MEZ',m)})}
  return need}
const _catCache=new Map();function catsOf(p){const key=p.id+'|'+p.pos1+'|'+p.pos2+'|'+p.ruolo;if(_catCache.has(key))return _catCache.get(key);const r=catsOf0(p);_catCache.set(key,r);return r}
function catsOf0(p){const w={};const put=(pos,f)=>(CAT_OF[pos]||[]).forEach((c,i)=>{const v=f*(i===0?1:.7);if(!(w[c]>=v))w[c]=v});if(p.pos1)put(p.pos1,1);if(p.pos2)put(p.pos2,.6);
  if(!p.pos1){const fb={DIF:['DC','TER'],CEN:['MED','MEZ'],ATT:['PUN','EST']}[p.ruolo]||[];fb.forEach((c,i)=>{w[c]=Math.max(w[c]||0,i?.5:.8)})}return w}
function coverage(players,need){const used=new Set();let got=0,tot=0;const miss=[];
  const slots=[];Object.entries(need).forEach(([c,n])=>{for(let i=0;i<n;i++)slots.push(c)});
  slots.sort((a,b)=>players.filter(p=>catsOf(p)[a]).length-players.filter(p=>catsOf(p)[b]).length);
  for(const c of slots){tot++;let best=null,bw=0;players.forEach(p=>{if(used.has(p.id))return;const w=catsOf(p)[c]||0;if(w>bw){bw=w;best=p}});if(best&&bw>=.4){used.add(best.id);got+=bw}else miss.push(c)}
  return {score:tot?got/tot:1,miss}}
function sessionSystems(s,w){const set=new Set();const add=x=>{if(x&&needsOf(x))set.add(x.startsWith('1-')?x:'1-'+x)};
  add(w&&w.sistemaPartita);(s.esercizi||[]).forEach(e=>{const t=[e.nome,e.giocatori,e.descrizione,e.sistema].join(' ');(t.match(/\b1?-?\d-\d-\d(?:-\d)?\b/g)||[]).forEach(m=>add(m.replace(/^-/,'')))});
  if(!set.size)sistemi().forEach(x=>add(x.nome));return [...set].slice(0,3)}
const isLeft=p=>p.piede==='sinistro'||p.piede==='ambidestro';
function balanceCost(groups,systems,withSys){let c=0;const sz=groups.map(g=>g.length);c+=(Math.max(...sz)-Math.min(...sz))*50;
  ['DIF','CEN','ATT'].forEach(r=>{const k=groups.map(g=>g.filter(p=>p.ruolo===r).length);c+=(Math.max(...k)-Math.min(...k))*6});
  const lefts=groups.map(g=>g.filter(isLeft).length);const totL=lefts.reduce((a,b)=>a+b,0);if(totL>=groups.length)c+=lefts.filter(x=>x===0).length*30;c+=(Math.max(...lefts)-Math.min(...lefts))*3;
  if(withSys)systems.forEach(sy=>{const need=needsOf(sy);if(!need)return;groups.forEach(g=>{const cv=coverage(g,need);const tot=Object.values(need).reduce((a,b)=>a+b,0);const ex=Math.max(0,cv.miss.length-Math.max(0,tot-g.length));c+=ex*25+(1-cv.score)*20})});
  return c}
function optimize(players,k,systems,withSys){
  let best=null,bc=1e9;
  for(let rep=0;rep<12;rep++){
    const ord={DIF:0,CEN:1,ATT:2};const pool=players.slice().sort(()=>Math.random()-.5).sort((a,b)=>(ord[a.ruolo]??3)-(ord[b.ruolo]??3));
    const g=Array.from({length:k},()=>[]);pool.forEach((p,i)=>{const r=Math.floor(i/k);const j=r%2?k-1-(i%k):i%k;g[j].push(p)});
    let cost=balanceCost(g,systems,withSys);let improved=true,it=0;
    while(improved&&it<60){improved=false;it++;
      for(let a=0;a<k;a++)for(let b=a+1;b<k;b++)for(let i=0;i<g[a].length;i++)for(let j=0;j<g[b].length;j++){
        const pa=g[a][i],pb=g[b][j];if(pa.ruolo===pb.ruolo&&pa.piede===pb.piede&&pa.pos1===pb.pos1)continue;
        g[a][i]=pb;g[b][j]=pa;const nc=balanceCost(g,systems,withSys);if(nc<cost-1e-9){cost=nc;improved=true}else{g[a][i]=pa;g[b][j]=pb}}}
    if(cost<bc){bc=cost;best=g.map(x=>x.slice())}}
  return best}
const SLOT_LBL={P:'Portiere',DC:'Centrale',TER:'Terzino',QUI:'Quinto',MED:'Mediano',MEZ:'Mezzala',TRQ:'Trequartista',EST:'Esterno',PUN:'Punta'};
function slotsOf(sys){const need=needsOf(sys)||needsOf('1-4-3-3');const order=['DC','TER','QUI','MED','MEZ','TRQ','EST','PUN'];const out=['P'];order.forEach(c=>{for(let i=0;i<(need[c]||0);i++)out.push(c)});return out}
function availPlayers(){return S.players.filter(p=>!p.stato||p.stato==='disponibile'||p.stato==='acciaccato')}
function proposeFormation(sys){const slots=slotsOf(sys);const av=availPlayers();const res=Array(slots.length).fill('');const used=new Set();
  const gk=av.find(p=>p.ruolo==='POR');if(gk){res[0]=gk.id;used.add(gk.id)}
  const idx=slots.map((c,i)=>i).filter(i=>i>0).sort((a,b)=>av.filter(p=>catsOf(p)[slots[a]]).length-av.filter(p=>catsOf(p)[slots[b]]).length);
  idx.forEach(i=>{let best=null,bw=0;av.forEach(p=>{if(used.has(p.id)||p.ruolo==='POR')return;const w=catsOf(p)[slots[i]]||0;if(w>bw){bw=w;best=p}});if(best){res[i]=best.id;used.add(best.id)}});
  return res}
function isMatchEve(s,w){const md=matchDayOf(w);if(md==null||md==='')return false;const before=(w.sessioni||[]).map(x=>x.giorno).filter(g=>g<Number(md));return before.length&&s.giorno===Math.max(...before)}
function proposeTitolari(s,w){const F=w.formazione;const pres=presentIds(s);const tit=(F.slots||[]).filter(Boolean).filter(id=>pres.includes(id));const P=id=>allPl().find(x=>x.id===id);
  const titOut=tit.filter(id=>P(id)&&P(id).ruolo!=='POR'),titGk=tit.filter(id=>P(id)&&P(id).ruolo==='POR');const ris=pres.filter(id=>!tit.includes(id));const risOut=ris.filter(id=>P(id)&&P(id).ruolo!=='POR'),risGk=ris.filter(id=>P(id)&&P(id).ruolo==='POR');
  const split=ids=>{const g=optimize(ids.map(P).filter(Boolean),2,[],false)||[[],[]];return {A:g[0].map(p=>p.id),B:(g[1]||[]).map(p=>p.id)}};
  return {n:2,modo:'titolari',sistemi:[F.sistema,w.sistemaAvversario].filter(x=>x&&needsOf(x)),squadre:[{nome:'Titolari',ids:titOut,sub:split(titOut),portieri:titGk},{nome:'Riserve',ids:risOut,sub:split(risOut),portieri:risGk}],creato:todayIso()}}
function formDialog(){const w=getWeek(S.weekStart);const sysList=sistemi().map(x=>x.nome);const F=w.formazione||{};const sys=F.sistema||w.sistemaPartita||sysList[0]||'1-4-3-3';const slots=slotsOf(sys);const cur=F.sistema===sys&&Array.isArray(F.slots)?F.slots:proposeFormation(sys);
  const av=sortPlayers(availPlayers());const used=new Set(cur.filter(Boolean));const ris=av.filter(p=>!used.has(p.id));
  document.getElementById('dlg').innerHTML=`<div class="dlg"><header><div><span class="lbl">Partita${w.avversario?' contro '+esc(w.avversario):''}</span><h2>Formazione titolare</h2></div><button class="btn ghost" data-act="dlgClose" aria-label="Chiudi">✕</button></header><div class="body">
    <div class="row"><label class="row" style="gap:6px">Sistema <select id="fSys" style="width:auto">${[...new Set([sys,...sysList])].map(x=>`<option ${x===sys?'selected':''}>${esc(x)}</option>`).join('')}</select></label><button class="btn sm" data-act="formAuto">Proponi in base ai ruoli</button></div>
    ${w.ideaPartita?`<p class="muted" style="font-size:.88rem"><b>Idea tattica:</b> ${esc(w.ideaPartita)}</p>`:''}
    <div class="fgrid" id="fSlots" style="grid-template-columns:repeat(auto-fill,minmax(230px,1fr))">${slots.map((c,i)=>`<label class="f"><span>${SLOT_LBL[c]||c}</span><select data-slot="${i}"><option value="">—</option>${av.filter(p=>c==='P'?p.ruolo==='POR':p.ruolo!=='POR').map(p=>`<option value="${p.id}" ${cur[i]===p.id?'selected':''}>${esc(cognome(p))} · ${esc(p.pos1||RUOLI[p.ruolo]||'')}${p.pos2?' / '+esc(p.pos2):''}</option>`).join('')}</select></label>`).join('')}</div>
    <p class="muted" style="font-size:.85rem"><b>Riserve disponibili (${ris.length}):</b> ${ris.map(p=>esc(cognome(p))).join(', ')||'—'}${w.sistemaAvversario?` · giocheranno con il ${esc(w.sistemaAvversario)} dell’avversario`:''}</p>
  </div><footer><div></div><div class="row"><button class="btn" data-act="dlgClose">Annulla</button><button class="btn pri" data-act="formSave">Salva formazione</button></div></footer></div>`;
  const d=document.getElementById('dlg');if(!d.open)d.showModal()}
function proposeSessionTeams(s,w,k){
  const P=allPl().filter(p=>presentIds(s).includes(p.id));const gks=P.filter(p=>p.ruolo==='POR');const out=P.filter(p=>p.ruolo!=='POR');
  const systems=sessionSystems(s,w);const groups=optimize(out,k,systems,true)||[];
  const squadre=groups.map((g,i)=>{const sub=optimize(g,2,systems,false)||[g,[]];return {nome:TEAM_NAMES[i],ids:g.map(p=>p.id),sub:{A:sub[0].map(p=>p.id),B:sub[1].map(p=>p.id)}}});
  gks.forEach((p,i)=>{const t=squadre[i%squadre.length];if(t){t.portieri=t.portieri||[];t.portieri.push(p.id)}});
  return {n:k,sistemi:systems,squadre,creato:todayIso()}}
function exMode(e){if(e.modoSquadre)return e.modoSquadre;if(!isTeamGame(e))return 'no';const pt=parseTeams(e);const g=((e.giocatori||'')+' '+(e.nome||'')).toLowerCase();return pt.sizes.length>=4||/(2|due)\s*(campi|griglie|quadrati)|torneo|parallelo|rondo/.test(g)?'sotto':'squadre'}
const pName=id=>{const p=allPl().find(x=>x.id===id);return p?shortName(p):'?'};
function teamStats(t,systems){const pl=allPl().filter(p=>t.ids.includes(p.id));const by=r=>pl.filter(p=>p.ruolo===r).length;
  const cov=systems.map(sy=>{const need=needsOf(sy);if(!need)return '';const c=coverage(pl,need);const tot=Object.values(need).reduce((a,b)=>a+b,0);const allowed=Math.max(0,tot-pl.length);const lst=[...new Set(c.miss)].map(m=>CAT_LBL[m]).join(', ');if(!c.miss.length)return `${sy} ✓`;if(c.miss.length<=allowed)return `${sy} ✓ (in ${pl.length}: senza ${lst})`;return `${sy}: manca ${lst}`}).filter(Boolean);
  return {txt:`${pl.length} · DIF ${by('DIF')} · CEN ${by('CEN')} · ATT ${by('ATT')} · mancini ${pl.filter(isLeft).length}`,cov}}
function sessionTeamsHtml(s){const w=getWeek(ED.wid);const T=s.squadreSeduta;const hasGames=(s.esercizi||[]).some(isTeamGame);if(!hasGames&&!T)return '';
  const eve=isMatchEve(s,w);const hasF=w.formazione&&Array.isArray(w.formazione.slots)&&w.formazione.slots.some(Boolean);
  if(!T&&eve)return `<div class="teamcard"><div class="row" style="justify-content:space-between"><b>Squadre della seduta · vigilia della gara</b><span class="row">${hasF?`<button class="btn sm pri" data-act="teamsTit">Titolari contro riserve</button>`:''}<button class="btn sm" data-act="teamsPropose">Squadre miste</button></span></div><p class="muted" style="font-size:.85rem">${hasF?`Titolari dalla formazione salvata${w.formazione.sistema?' ('+esc(w.formazione.sistema)+')':''}; le riserve fanno l’avversario${w.sistemaAvversario?' ('+esc(w.sistemaAvversario)+')':''}.`:'Per avere titolari contro riserve imposta prima idea tattica e formazione in Settimana › Partita della settimana.'}</p></div>`;
  if(!T)return `<div class="teamcard"><div class="row" style="justify-content:space-between"><b>Squadre della seduta</b><span class="row"><select id="teamsN" style="width:auto;padding:3px 6px" aria-label="Numero di squadre"><option value="2">2 squadre</option><option value="3">3 squadre</option></select><button class="btn sm pri" data-act="teamsPropose">Proponi squadre</button></span></div><p class="muted" style="font-size:.85rem">Equilibrate per ruoli, piede (almeno un mancino per squadra) e duttilità nei sistemi della seduta (${esc(sessionSystems(s,w).join(', ')||'—')}); ogni squadra è divisa in sottogruppi A e B per i lavori su due campi.</p></div>`;
  const edit=ED.teamsEdit;
  if(edit){const all=[...new Set([...presentIds(s),...T.squadre.flatMap(t=>[...t.ids,...(t.portieri||[])])])];
    const where=id=>{for(let i=0;i<T.squadre.length;i++){const t=T.squadre[i];if((t.portieri||[]).includes(id))return {t:i,sub:'P'};if(t.ids.includes(id))return {t:i,sub:t.sub.A.includes(id)?'A':'B'}}return {t:-1,sub:'A'}};
    return `<div class="teamcard"><div class="row" style="justify-content:space-between"><b>Modifica squadre</b><button class="btn sm pri" data-act="teamsDone">Fatto</button></div><div class="teamedit">${sortPlayers(S.players.filter(p=>all.includes(p.id))).map(p=>{const x=where(p.id);return `<div class="row" style="gap:6px;justify-content:space-between"><span style="min-width:0">${esc(p.nome)} <span class="muted" style="font-size:.78rem">${esc(p.pos1||RUOLI[p.ruolo]||'')}${p.piede==='sinistro'?' · SX':p.piede==='ambidestro'?' · AMB':''}</span></span><span class="row" style="gap:4px"><select data-act-change="tmTeam" data-pid="${p.id}" style="width:auto;padding:3px 6px" aria-label="Squadra di ${esc(p.nome)}"><option value="-1">Fuori</option>${T.squadre.map((t,i)=>`<option value="${i}" ${x.t===i?'selected':''}>${t.nome}</option>`).join('')}</select>${p.ruolo==='POR'?'':`<select data-act-change="tmSub" data-pid="${p.id}" style="width:auto;padding:3px 6px" aria-label="Sottogruppo di ${esc(p.nome)}"><option ${x.sub==='A'?'selected':''}>A</option><option ${x.sub==='B'?'selected':''}>B</option></select>`}</span></div>`}).join('')}</div></div>`}
  return `<div class="teamcard"><div class="row" style="justify-content:space-between"><b>Squadre della seduta</b><span class="row" style="gap:6px"><button class="btn sm" data-act="teamsEdit">Modifica</button>${T.modo==='titolari'?`<button class="btn sm" data-act="teamsTit">Aggiorna dai titolari</button>`:`<button class="btn sm" data-act="teamsPropose">Rimescola</button>`}<button class="btn sm ghost" data-act="teamsClear" data-confirm="Conferma: togli le squadre">Togli</button></span></div>
    <div class="teams">${T.squadre.map((t,ti)=>{const st=teamStats(t,T.modo==='titolari'?[(T.sistemi||[])[ti]].filter(Boolean):(T.sistemi||[]));return `<div class="team"><div class="row" style="gap:6px"><span class="tdot" style="background:${TEAM_COL[t.nome]||'#888'}"></span><b>${t.nome}</b>${(t.portieri||[]).length?`<span class="muted" style="font-size:.8rem">P ${t.portieri.map(pName).map(esc).join(', ')}</span>`:''}</div>
      <div class="tlist"><span class="mono muted">A</span> ${t.sub.A.map(pName).map(esc).join(', ')||'—'}</div><div class="tlist"><span class="mono muted">B</span> ${t.sub.B.map(pName).map(esc).join(', ')||'—'}</div>
      <div class="muted" style="font-size:.76rem;margin-top:4px">${esc(st.txt)}</div>${st.cov.map(c=>`<div style="font-size:.76rem" class="${c.includes('manca')?'warnt':'okt'}">${esc(c)}</div>`).join('')}</div>`}).join('')}</div></div>`}
function exTeamsLine(e,i,s){const T=s.squadreSeduta;if(!isTeamGame(e)&&!e.modoSquadre)return '';const m=exMode(e);
  const sel=`<select data-act-change="exMode" data-i="${i}" style="width:auto;padding:2px 6px;font-size:.8rem" aria-label="Divisione squadre"><option value="squadre" ${m==='squadre'?'selected':''}>Squadre</option><option value="sotto" ${m==='sotto'?'selected':''}>Sottogruppi A/B</option><option value="no" ${m==='no'?'selected':''}>Nessuna divisione</option></select>`;
  let txt='';if(T&&m==='squadre')txt=T.squadre.map(t=>t.nome).join(' contro ');
  if(T&&m==='sotto')txt=T.squadre.length===2?`Campo 1: ${T.squadre[0].nome} A – ${T.squadre[1].nome} A · Campo 2: ${T.squadre[0].nome} B – ${T.squadre[1].nome} B`:T.squadre.map(t=>t.nome+' A / '+t.nome+' B').join(' · ');
  return `<div class="row" style="gap:8px;font-size:.85rem"><span class="lbl">Squadre</span>${sel}${txt?`<span>${esc(txt)}</span>`:T?'':'<span class="muted">Componi le squadre della seduta in alto</span>'}</div>`}
function adaptPanel(s){const a=ED.adapt;const w=getWeek(ED.wid);const d=s.giorno;
  if(!a)return S.sample&&!s.done?`<div><button class="btn ai sm" data-act="adaptOpen">Adatta ai presenti</button></div>`:'';
  if(a.state==='busy')return `<div class="aibox"><div class="row" style="justify-content:space-between"><h3>Sto adattando la seduta…</h3><button class="btn sm" data-act="adaptStop">Interrompi</button></div><p class="muted" style="font-size:.85rem">Tengo obiettivo, logica del giorno e partita finale; adatto o sostituisco gli esercizi in base ai nuovi numeri.</p></div>`;
  if(a.state==='error')return `<div class="aibox"><p>${esc(a.msg)}</p><div class="row"><button class="btn ai sm" data-act="adaptGen">Riprova</button><button class="btn sm" data-act="adaptClose">Chiudi</button></div></div>`;
  if(a.state==='done'){const r=a.result;const lbl={invariato:['Invariato',''],adattato:['Adattato','warn'],nuovo:['Nuovo','ok']};
    return `<div class="aibox"><div class="row" style="justify-content:space-between"><h3>Proposta per ${a.m} + ${a.p} P</h3><button class="btn sm ghost" data-act="adaptClose">Scarta</button></div>${r.modifiche?`<p style="font-size:.9rem">${esc(r.modifiche)}</p>`:''}
    <div class="stack" style="gap:4px">${r.esercizi.map(e=>{const l=lbl[e._stato]||lbl.adattato;return `<div class="row" style="justify-content:space-between;border-top:1px solid var(--line);padding-top:4px"><span><b>${esc(e.nome)}</b> <span class="muted mono">${e.durata}′</span><br><span class="muted" style="font-size:.82rem">${esc(e.giocatori||'')}</span></span><span class="pill ${l[1]}">${l[0]}</span></div>`}).join('')}</div>
    <div class="row"><button class="btn pri sm" data-act="adaptApply">Applica alla seduta</button><button class="btn sm" data-act="adaptGen">Rigenera</button></div></div>`}
  const gk=Array.isArray(w.gkCoach)?w.gkCoach.includes(d):gkDefault(d);const date=iso(addDays(parseIso(ED.wid),d));
  const R=rosterOn(date);if(!a.sel)a.sel=R.filter(x=>x.k!=='out').map(x=>x.p.id);guestIds(s).forEach(id=>{if(!a.sel.includes(id)&&!a.unsel?.includes(id))a.sel.push(id)});
  const pill={out:'bad',rientro:'ok',limitato:'warn',ospite:''};const lab={out:'Fuori',rientro:'Rientro',limitato:'Acciaccato',ospite:'Ospite'};
  const cnt=adaptCounts(a.sel);const pv=previsti(w,d);
  const list=R.length?`<div class="row" style="justify-content:space-between"><span class="lbl">Chi c’è ${DAYS_FULL[d].toLowerCase()} ${fmtDay(parseIso(date))}</span><span class="num" id="adCount"><b>${cnt.m}</b> di movimento + <b>${cnt.p}</b> portieri</span></div>
    <div class="checks" id="adList">${R.map(x=>`<label title="${esc(x.why)}"><input type="checkbox" data-act-change="adSel" value="${x.p.id}" ${a.sel.includes(x.p.id)?'checked':''}>${esc(x.p.nome)}${x.k!=='ok'?` <span class="pill ${pill[x.k]}">${lab[x.k]}</span>`:''}${x.k==='ospite'?` <button type="button" class="btn sm ghost" data-act="guestDel" data-id="${x.p.id}" aria-label="Togli ${esc(x.p.nome)}">✕</button>`:''}</label>`).join('')}</div>${guestForm()}
    ${R.some(x=>x.k!=='ok'&&x.k!=='ospite')?`<p class="muted" style="font-size:.82rem">${R.filter(x=>x.k!=='ok'&&x.k!=='ospite').map(x=>`<b>${esc(x.p.nome)}</b>: ${esc(x.why)}`).join(' · ')}</p>`:''}`
    :`<div class="row"><label class="row" style="gap:6px">Giocatori di movimento <input type="number" id="adM" min="4" max="30" value="${a.m??pv.m}" style="width:64px"></label><label class="row" style="gap:6px">Portieri <input type="number" id="adP" min="0" max="4" value="${a.p??pv.p}" style="width:56px"></label></div>`;
  return `<div class="aibox"><div class="row" style="justify-content:space-between"><h3>Adatta ai presenti</h3><button class="btn sm ghost" data-act="adaptClose">Chiudi</button></div>
    <p class="muted" style="font-size:.85rem">Parto dalla situazione aggiornata della rosa: togli chi non viene, aggiungi chi rientra. Chi rientra o è acciaccato viene inserito con un ruolo protetto (jolly, sponda, niente contrasti duri).</p>
    ${list}
    ${(team().prepPortieri||'a volte')!=='mai'?`<label class="row" style="gap:6px"><input type="checkbox" id="adGk" ${gk?'checked':''}> Preparatore portieri presente</label>`:''}
    <div class="f"><span class="lbl">Cosa posso cambiare</span><div class="checks" style="margin-top:6px"><label><input type="radio" name="adMode" value="adatta" ${(a.mode||'adatta')==='adatta'?'checked':''}> Adatta la seduta pianificata (stesso obiettivo, durata, attivazione e partita finale)</label><label><input type="radio" name="adMode" value="libera" ${a.mode==='libera'?'checked':''}> Seduta diversa: seguo le tue indicazioni, senza i vincoli della seduta</label></div></div>
    <label class="f"><span>Indicazioni (facoltative)</span><input type="text" id="adReq" data-keep="1" value="${esc(a.req||'')}" placeholder="Es. oggi solo 60', niente partita finale, lavoro tecnico a coppie e un torneo 4c4"></label>
    <div class="row"><button class="btn ai sm" data-act="adaptGen">Adatta la seduta</button></div></div>`}
function adaptCounts(sel){const P=allPl().filter(p=>sel.includes(p.id));return {m:P.filter(p=>p.ruolo!=='POR').length,p:P.filter(p=>p.ruolo==='POR').length}}
async function adaptGen(){
  const s=ED.s;const w=getWeek(ED.wid);const d=s.giorno;const md=mdLabel(d,matchDayOf(w));
  const modeEl=document.querySelector('input[name=adMode]:checked');const mode=modeEl?modeEl.value:(ED.adapt.mode||'adatta');const libera=mode==='libera';
  const listEl=document.getElementById('adList');if(listEl)ED.adapt.sel=[...listEl.querySelectorAll('input:checked')].map(x=>x.value);
  const sel=ED.adapt.sel;const useList=S.players.length&&Array.isArray(sel);const cc=useList?adaptCounts(sel):null;
  const m=useList?cc.m:Number(document.getElementById('adM')?.value??ED.adapt.m),pp=useList?cc.p:Number(document.getElementById('adP')?.value??ED.adapt.p);
  const date=iso(addDays(parseIso(ED.wid),d));const R=useList?rosterOn(date):[];const nm=x=>`${x.p.nome} (${posFull(x.p)||x.p.ruolo||''}${x.p.piede?', piede '+x.p.piede:''})`;
  const inn=R.filter(x=>sel.includes(x.p.id)),fuori=R.filter(x=>!sel.includes(x.p.id));
  const dispo=useList?`DISPONIBILITÀ AGGIORNATA PER QUESTA SEDUTA (prevale su quanto scritto nella rosa sopra):
- Presenti (${m} di movimento + ${pp} portieri): ${inn.filter(x=>x.k==='ok').map(nm).join('; ')||'nessuno'}.
- Rientri (da reinserire con gradualità): ${inn.filter(x=>x.k==='rientro').map(x=>nm(x)+' – '+x.why).join('; ')||'nessuno'}.
- Ospiti aggregati solo per oggi (usali come gli altri, nel loro ruolo): ${inn.filter(x=>x.k==='ospite').map(nm).join('; ')||'nessuno'}.
- Acciaccati presenti: ${inn.filter(x=>x.k==='limitato').map(x=>nm(x)+' – '+x.why).join('; ')||'nessuno'}.
- Assenti: ${fuori.map(x=>nm(x)+(x.why?' – '+x.why:' – non viene')).join('; ')||'nessuno'}.
Regole per rientri e acciaccati: il mister è solo in campo, quindi niente lavoro differenziato a parte; li inserisci negli esercizi del gruppo con un ruolo protetto (jolly o sponda nei possessi, fuori dai duelli e dai contrasti più intensi, a tempo ridotto o come jolly nella partita finale) e lo scrivi nell'organizzazione dell'esercizio con il loro nome. Valuta se le assenze lasciano scoperti dei ruoli (es. centrali, mancini, portieri) e adatta esercizi e sistema di conseguenza.`:'';const gkEl=document.getElementById('adGk');const req=(document.getElementById('adReq')?.value??ED.adapt.req??'').trim();
  const prev={...(w.previsti||{})};prev[d]={m,p:pp};let gkc=Array.isArray(w.gkCoach)?w.gkCoach.slice():(team().giorni||[]).filter(gkDefault);if(gkEl){gkc=gkc.filter(x=>x!==d);if(gkEl.checked)gkc.push(d)}
  const w2={...w,previsti:prev,gkCoach:gkc};saveWeek(w2);
  const ac=new AbortController();ED.adapt={state:'busy',m,p:pp,req,ac,sel,mode};drawEditor();
  const strip=e=>{const {schema,svolto,salva,valutazione,libId,contato,...r}=e;return r};
  const others=(w.sessioni||[]).filter(x=>x!==w.sessioni[ED.idx]).map(x=>`${DAYS[x.giorno]} ${x.md}: ${x.titolo} (${(x.esercizi||[]).map(e=>e.nome).join(', ')})`).join(' | ');
  const prompt=`Sei il collaboratore tecnico di un allenatore di calcio italiano. La seduta di ${DAYS_FULL[d]} (${md}) era già pianificata, ma ${libera?'il mister vuole fare una seduta diversa':'i presenti cambiano'}: ${m} giocatori di movimento + ${pp} portieri. Rivedi SOLO questa seduta.
${METODO}

${teamContext()}
ALTRE SEDUTE DELLA SETTIMANA (non cambiano): ${others||'nessuna'}
Obiettivo della settimana: ${w.obiettivo||'-'}.
${libera?'':attRule()}
${sisRule(w2)}
${staffRule(w2)}
${numRule(w2,[d])}
${libera?'':dayRule([d])}
${groupRule(w2)}
${condRule()}
${appRule()}
${designRule()}

SEDUTA ATTUALE (indice, esercizio): ${JSON.stringify({titolo:s.titolo,focus:s.focus,durata:s.durata,rpe:s.rpe,esercizi:s.esercizi.map((e,i)=>({indice:i,...strip(e)}))})}
${dispo}${reqRule(req)}

${libera?`Il mister vuole una SEDUTA DIVERSA da quella pianificata, per motivi suoi: NON sei vincolato a obiettivo, tipo di seduta, esercizi, durata totale, attivazione o partita finale della seduta attuale. Progetta la seduta seguendo prima di tutto le sue indicazioni; usa la seduta attuale e il giorno ${md} solo come riferimento per il carico quando le indicazioni non dicono altro. Puoi tenere un esercizio esistente ("invariato" o "adattato"), gli altri sono "nuovo". Aggiungi a inizio JSON "titolo", "focus" e "rpe" della nuova seduta.`:`Regole della revisione: mantieni obiettivo, logica MD, durata totale (${s.durata}'), attivazione iniziale e partita finale, salvo diversa indicazione del mister. Per ogni esercizio decidi:`} se funziona così com'è con i nuovi numeri, "invariato"; se basta cambiare numeri, spazio, jolly o rotazioni, "adattato"; se non funziona più, sostituiscilo con un esercizio diverso ("nuovo") che alleni lo stesso principio. Usa "invariato" SOLO se anche il testo dei numeri ("giocatori", descrizione, organizzazione) resta corretto con i nuovi presenti: se cambia anche solo un conteggio, è "adattato" con tutti i numeri aggiornati.
${SCHEMA_SPEC}

Rispondi SOLO con JSON: {"modifiche":"2-4 frasi su cosa cambia e perché","esercizi":[{"stato":"invariato","indice":0} oppure {"stato":"adattato|nuovo","nome":"","fase":"attivazione|iniziale|centrale|condizionale|finale","durata":15,"spazio":"","giocatori":"numeri esatti con totale","descrizione":"","principio":"","coaching":"","organizzazione":"","condizionale":"","sistema":"","step":[{"titolo":"","giocatori":"","descrizione":""}],"schema":{...}}]}`;
  try{const r=await S.sample.json(prompt,{modelTier:'default',signal:ac.signal});
    const list=Array.isArray(r?.esercizi)?r.esercizi:[];if(!list.length)throw {code:'empty',message:'La proposta non contiene esercizi.'};
    let es=list.map(x=>{if(x&&x.stato==='invariato'&&s.esercizi[x.indice]){return {...JSON.parse(JSON.stringify(s.esercizi[x.indice])),_stato:'invariato'}}const e=normalizeEx(x);if(x&&s.esercizi[x.indice]&&x.stato==='adattato'&&!e.schema&&s.esercizi[x.indice].schema)e.schema=s.esercizi[x.indice].schema;e._stato=x&&x.stato==='nuovo'?'nuovo':'adattato';return e});
    if(!libera)es=ensureFinalGame(ensureAtt(es,md),team().partitaFinale??15,s.durata);es.forEach(e=>{if(!e._stato)e._stato='nuovo'});
    if(ED&&ED.adapt)ED.adapt={state:'done',m,p:pp,req,sel,mode,result:{modifiche:String(r.modifiche||''),esercizi:es,titolo:libera?String(r.titolo||''):'',focus:libera?String(r.focus||''):'',rpe:libera&&Number(r.rpe)?Math.min(10,Math.max(1,Number(r.rpe))):null}};
  }catch(e){if(!ED)return;if(e&&(e.name==='AbortError'||e.code==='aborted'))ED.adapt={state:'form',m,p:pp,req,sel,mode};else ED.adapt={state:'error',m,p:pp,req,sel,mode,msg:aiErrMsg(e)}}
  if(ED&&document.getElementById('dlg').open)drawEditor();
}
function stepsView(e,i){if(!Array.isArray(e.step)||!e.step.length)return '';return `<div class="steps">${e.step.map((st,k)=>`<div class="stp">${st.schema?`<div style="width:120px;flex:none">${thumb({...st,nome:e.nome+' step '+(k+1)},`data-act="stView" data-i="${i}" data-k="${k}"`)}</div>`:''}<div style="min-width:0"><b>Step ${k+1}${st.titolo?' · '+esc(st.titolo):''}</b>${st.giocatori?` <span class="muted mono" style="font-size:.8rem">${esc(st.giocatori)}</span>`:''}<div style="font-size:.88rem">${esc(st.descrizione)}</div></div></div>`).join('')}</div>`}
function stepsEdit(e,i){const st=Array.isArray(e.step)?e.step:[];return `<div class="stack" style="gap:6px"><div class="row" style="justify-content:space-between"><span class="lbl">Step progressivi</span><button class="btn sm" data-act="stAdd" data-i="${i}">+ Step</button></div>${st.map((x,k)=>`<div class="stp" style="align-items:flex-start"><b class="mono">${k+1}</b><div class="stack" style="gap:4px;flex:1;min-width:0"><div class="fgrid"><input type="text" data-st="${i}" data-sk="${k}" data-k="titolo" value="${esc(x.titolo)}" placeholder="Titolo (es. 2c1)" aria-label="Titolo step ${k+1}"><input type="text" data-st="${i}" data-sk="${k}" data-k="giocatori" value="${esc(x.giocatori)}" placeholder="Giocatori" aria-label="Giocatori step ${k+1}"></div><input type="text" data-st="${i}" data-sk="${k}" data-k="descrizione" value="${esc(x.descrizione)}" placeholder="Cosa cambia in questo step" aria-label="Descrizione step ${k+1}"></div><button class="btn sm" data-act="stBoard" data-i="${i}" data-k="${k}">${x.schema?'Disegno':'Disegna'}</button><button class="btn sm ghost danger" data-act="stDel" data-i="${i}" data-k="${k}" aria-label="Rimuovi step">✕</button></div>`).join('')}</div>`}
function schedaHtml(s){
  return `<div class="row"><span class="pill num">${s.durata}′</span><span class="pill num">RPE ${s.rpe}</span>${s.done?'<span class="pill ok">Svolta</span>':''}</div>
  ${adaptPanel(s)}
  ${s.focus?`<p>${esc(s.focus)}</p>`:''}
  ${sessionTeamsHtml(s)}
  <div>${(s.esercizi||[]).map((e,i)=>`<article class="sk"><div>${thumb(e,`data-act="boardSess" data-i="${i}"`)}</div><div class="stack" style="gap:8px">
    <div class="h"><span class="lbl">${esc(e.fase)}</span><b>${esc(e.nome)}</b><span class="mono">${esc(e.durata)}′</span></div>
    <div class="kv">${e.sistema?`<span class="pill">${esc(e.sistema)}</span>`:''}${appBadge(e,s.md)}${e.spazio?`<span>${esc(e.spazio)}</span>`:''}${e.giocatori?`<span>${esc(e.giocatori)}</span>`:''}</div>
    ${e.descrizione?`<p>${esc(e.descrizione)}</p>`:''}${stepsView(e,i)}${e.principio?`<p><b>Principio:</b> ${esc(e.principio)}</p>`:''}${e.coaching?`<p><b>Punti chiave:</b> ${esc(e.coaching)}</p>`:''}${e.vincoli?`<p><b>Vincoli:</b> ${esc(e.vincoli)}</p>`:''}${e.condizionale?`<p><b>Condizionale:</b> ${esc(e.condizionale)}</p>`:''}${e.organizzazione?`<p><b>Organizzazione:</b> ${esc(e.organizzazione)}</p>`:''}${exTeamsLine(e,i,s)}</div></article>`).join('')||'<div class="empty">Nessun esercizio. Aggiungili dalla scheda Modifica.</div>'}</div>`;
}
function drawEditor(){
  const s=ED.s;const w=getWeek(ED.wid);const md=matchDayOf(w);const d=addDays(parseIso(ED.wid),s.giorno);
  const allDr=[...S.drills,...BASE_DRILLS];
  const piano=`<div class="fgrid">
      <label class="f"><span>Giorno</span><select id="eGiorno">${DAYS_FULL.map((x,i)=>`<option value="${i}" ${s.giorno===i?'selected':''}>${x} (${mdLabel(i,md)||'—'})</option>`).join('')}</select></label>
      <label class="f"><span>Tipo di seduta</span><select id="eTipo">${TIPI.map(x=>`<option ${s.tipo===x?'selected':''}>${x}</option>`).join('')}</select></label>
      <label class="f"><span>Durata (min)</span><input type="number" id="eDurata" min="10" max="180" value="${s.durata}"></label>
      <label class="f"><span>RPE pianificato</span><input type="number" id="eRpe" min="1" max="10" step="0.5" value="${s.rpe}"></label>
    </div>
    <label class="f"><span>Titolo</span><input type="text" id="eTitolo" value="${esc(s.titolo)}"></label>
    <label class="f"><span>Obiettivo della seduta</span><textarea id="eFocus">${esc(s.focus)}</textarea></label>
    <div class="row" style="justify-content:space-between"><h3>Esercizi <span class="muted num" style="font-weight:500;font-size:.9rem">${s.esercizi.reduce((a,e)=>a+Number(e.durata||0),0)}′ su ${s.durata}′</span></h3>
      <div class="row"><select id="eLib" style="width:auto;max-width:240px" aria-label="Esercizio dalla libreria"><option value="">Dalla libreria…</option>${Object.keys(CATS).map(c=>`<optgroup label="${CATS[c]}">${allDr.filter(x=>x.cat===c).map(x=>`<option value="${x.id}">${esc(x.nome)}</option>`).join('')}</optgroup>`).join('')}</select><button class="btn sm" data-act="exAddLib">Aggiungi</button><button class="btn sm" data-act="exAdd">Vuoto</button></div></div>
    ${s.esercizi.map((e,i)=>`<div class="exed"><div class="side">${thumb(e,`data-act="boardSess" data-i="${i}"`)}<button class="btn sm" data-act="boardSess" data-i="${i}">${e.schema?'Modifica disegno':'Disegna'}</button></div><div class="main2">
      <div class="eh"><input type="text" data-ex="${i}" data-k="nome" value="${esc(e.nome)}" aria-label="Nome esercizio">
        <button class="btn sm ghost" data-act="exMove" data-i="${i}" data-d="-1" aria-label="Sposta su" ${i===0?'disabled':''}>↑</button><button class="btn sm ghost" data-act="exMove" data-i="${i}" data-d="1" aria-label="Sposta giù" ${i===s.esercizi.length-1?'disabled':''}>↓</button><button class="btn sm" data-act="replOpen" data-i="${i}">Sostituisci</button><button class="btn sm ghost danger" data-act="exDel" data-i="${i}" aria-label="Rimuovi">✕</button></div>
      ${replPanel(i)}
      <div class="fgrid"><label class="f"><span>Fase</span><select data-ex="${i}" data-k="fase">${FASI.map(f=>`<option ${e.fase===f?'selected':''}>${f}</option>`).join('')}</select></label>
        <label class="f"><span>Minuti</span><input type="number" min="1" data-ex="${i}" data-k="durata" value="${esc(e.durata)}"></label>
        <label class="f"><span>Spazio</span><input type="text" data-ex="${i}" data-k="spazio" value="${esc(e.spazio)}"></label>
        <label class="f"><span>Giocatori</span><input type="text" data-ex="${i}" data-k="giocatori" value="${esc(e.giocatori)}"></label>
        ${sistemi().length>1?`<label class="f"><span>Sistema</span><select data-ex="${i}" data-k="sistema"><option value="">—</option>${[...sistemi().map(x=>x.nome),'entrambi'].map(n=>`<option ${e.sistema===n?'selected':''}>${esc(n)}</option>`).join('')}</select></label>`:''}</div>
      <label class="f"><span>Descrizione</span><textarea data-ex="${i}" data-k="descrizione">${esc(e.descrizione)}</textarea></label>
      <div class="fgrid"><label class="f"><span>Principio allenato</span><input type="text" data-ex="${i}" data-k="principio" value="${esc(e.principio)}"></label><label class="f"><span>Punti chiave</span><input type="text" data-ex="${i}" data-k="coaching" value="${esc(e.coaching)}"></label></div>
      ${stepsEdit(e,i)}
      <label class="f"><span>Vincoli ed effetto atteso</span><input type="text" data-ex="${i}" data-k="vincoli" value="${esc(e.vincoli||'')}" placeholder="Es. 2 tocchi → circolazione veloce; campo lungo → attacco della profondità"></label>
      <label class="f"><span>Obiettivo condizionale</span><input type="text" data-ex="${i}" data-k="condizionale" value="${esc(e.condizionale||'')}" placeholder="Es. intermittente 1' lavoro / 1' recupero, alta intensità"></label>
      <label class="f"><span>Organizzazione (campo, palloni, passaggio al successivo)</span><input type="text" data-ex="${i}" data-k="organizzazione" value="${esc(e.organizzazione||'')}"></label>
    </div></div>`).join('')||'<div class="empty">Nessun esercizio. Aggiungine uno dalla libreria o chiedilo all’assistente.</div>'}
    ${S.sample?`<div class="aibox"><label class="f"><span>Chiedi un esercizio all'assistente (arriva già disegnato)</span><input type="text" id="exAiReq" placeholder="Es. 20' sulla copertura preventiva, siamo in 14 più un portiere"></label><div class="row"><button class="btn ai sm" data-act="exAi" ${ED.busy?'disabled':''}>${ED.busy?'Sto pensando…':'Proponi esercizio'}</button></div></div>`:''}`;
  const pls=sortPlayers(S.players).concat(s.ospiti||[]);const pres=Array.isArray(s.presenti)?s.presenti:pls.filter(p=>(p.stato||'disponibile')==='disponibile').map(p=>p.id);
  const dopo=`<div class="fgrid"><label class="f"><span>RPE medio rilevato</span><input type="number" id="eRpeR" min="0" max="10" step="0.1" value="${s.rpeReale??''}" placeholder="0-10"></label>
      <label class="f"><span>Stato</span><select id="eDone"><option value="0" ${!s.done?'selected':''}>Da svolgere</option><option value="1" ${s.done?'selected':''}>Svolta</option></select></label></div>
    <p class="muted" style="font-size:.85rem">RPE: circa 30 minuti dopo la fine chiedi “da 0 a 10, quanto è stata dura?” e inserisci la media.</p>
    <div class="row" style="justify-content:space-between"><h3>Presenze <span class="muted num" id="presCount" style="font-weight:500;font-size:.9rem">${pres.length} / ${pls.length}</span></h3><div class="row"><button class="btn sm" data-act="presAll" data-v="1">Tutti</button><button class="btn sm" data-act="presAll" data-v="0">Nessuno</button></div></div>
    ${pls.length?`<div class="checks" id="presList">${pls.map(p=>`<label><input type="checkbox" value="${p.id}" ${pres.includes(p.id)?'checked':''}>${esc(p.nome)}${p.ospite?' <span class="pill">Ospite</span>':''}${p.stato&&p.stato!=='disponibile'?` <span class="pill ${STATI[p.stato][1]}">${STATI[p.stato][0]}</span>`:''}</label>`).join('')}</div>${guestForm()}`:'<div class="empty">Aggiungi i giocatori nella sezione Squadra per registrare le presenze.</div>'}
    <h3>Esercizi svolti</h3><p class="muted" style="font-size:.85rem">Quando salvi la seduta come “Svolta”, gli esercizi spuntati in “Salva in libreria” vanno tra i tuoi esercizi con disegno e valutazione.</p>
    <div class="stack" style="gap:6px" id="exReview">${s.esercizi.map((e,i)=>{const sv=e.svolto!==false;const inLib=e.libId&&S.drills.some(d=>d.id===e.libId);return `<div class="row" style="justify-content:space-between;border-top:1px solid var(--line);padding-top:6px"><span style="min-width:0;flex:1"><b>${esc(e.nome)}</b> <span class="muted mono">${esc(e.durata)}′</span>${inLib?' <span class="pill ok">In libreria</span>':''}</span>
      <span class="row" style="gap:8px"><label class="row" style="gap:4px;font-size:.85rem"><input type="checkbox" data-ex2="${i}" data-k="svolto" ${sv?'checked':''}>Svolto</label>
      <select data-ex2="${i}" data-k="valutazione" style="width:auto;padding:3px 6px" aria-label="Valutazione ${esc(e.nome)}">${[['','Valutazione'],['funzionato','Funzionato'],['da rivedere','Da rivedere']].map(([v,l])=>`<option value="${v}" ${(e.valutazione||'')===v?'selected':''}>${l}</option>`).join('')}</select>
      ${inLib?'':`<label class="row" style="gap:4px;font-size:.85rem"><input type="checkbox" data-ex2="${i}" data-k="salva" ${(e.salva??(sv&&e.fase!=='attivazione'))?'checked':''}>Salva in libreria</label>`}</span></div>`}).join('')}</div>
    <label class="f"><span>Note sulla seduta</span><textarea id="eNote" placeholder="Cosa ha funzionato, cosa riprendere, chi ha svolto lavoro differenziato">${esc(s.note)}</textarea></label>`;
  const body={scheda:()=>schedaHtml(s),piano:()=>piano,dopo:()=>dopo}[ED.tab]();
  document.getElementById('dlg').innerHTML=`<div class="dlg"><header><div><span class="lbl">${DAYS_FULL[s.giorno]} ${fmtDay(d)}${ora(s.giorno)?' · ore '+ora(s.giorno):''}</span><h2 class="row" style="gap:8px">${mdChip(mdLabel(s.giorno,md))} ${ED.idx<0?'Nuova seduta':esc(s.titolo||s.tipo)}</h2></div><button class="btn ghost" data-act="dlgClose" aria-label="Chiudi">✕</button></header>
    <div class="tabs" role="tablist" style="padding:0 18px">${ED.idx>=0?`<button role="tab" aria-selected="${ED.tab==='scheda'}" data-act="edTab" data-t="scheda">Scheda</button>`:''}<button role="tab" aria-selected="${ED.tab==='piano'}" data-act="edTab" data-t="piano">Modifica</button><button role="tab" aria-selected="${ED.tab==='dopo'}" data-act="edTab" data-t="dopo">Dopo la seduta</button></div>
    <div class="body">${body}</div>
    <footer><div>${ED.idx>=0&&ED.tab==='piano'?`<button class="btn danger" data-act="sessDel" data-confirm="Conferma eliminazione">Elimina seduta</button>`:''}</div><div class="row">${ED.tab==='scheda'?`${S.downloads?`<button class="btn" data-act="sessPdfField" id="pdfBtn2">PDF da campo</button><button class="btn" data-act="sessPdf" id="pdfBtn">PDF completo</button>`:''}<button class="btn" data-act="dlgClose">Chiudi</button>`:`<button class="btn" data-act="dlgClose">Annulla</button><button class="btn pri" data-act="sessSave">Salva</button>`}</div></footer></div>`;
}
function collectEditor(){
  if(!ED)return;const s=ED.s;const g=id=>document.getElementById(id);
  if(g('eGiorno')){s.giorno=Number(g('eGiorno').value);s.tipo=g('eTipo').value;s.durata=Number(g('eDurata').value)||s.durata;s.rpe=Number(g('eRpe').value)||s.rpe;s.titolo=g('eTitolo').value;s.focus=g('eFocus').value;
    document.querySelectorAll('#dlg [data-st]').forEach(el=>{const e=s.esercizi[Number(el.dataset.st)];if(e&&e.step&&e.step[Number(el.dataset.sk)])e.step[Number(el.dataset.sk)][el.dataset.k]=el.value});
    document.querySelectorAll('#dlg [data-ex]').forEach(el=>{const e=s.esercizi[Number(el.dataset.ex)];if(e)e[el.dataset.k]=el.dataset.k==='durata'?Number(el.value)||0:el.value})}
  if(g('eRpeR')){const v=g('eRpeR').value;s.rpeReale=v===''?null:Number(v);s.done=g('eDone').value==='1';s.note=g('eNote').value;document.querySelectorAll('#dlg [data-ex2]').forEach(el=>{const e=s.esercizi[Number(el.dataset.ex2)];if(!e)return;const k=el.dataset.k;e[k]=el.type==='checkbox'?el.checked:el.value});const list=g('presList');if(list)s.presenti=[...list.querySelectorAll('input:checked')].map(i=>i.value)}
}
const CAT_BY_MD={ten:'tensione',dur:'durata',vel:'velocita',att:'attivazione',rec:'recupero'};
function catFor(e,md){if(e.fase==='condizionale')return 'condizionale';if(e.fase==='attivazione')return 'attivazione';const n=(e.nome||'').toLowerCase();if(/angol|punizion|palle inattive|piazzat/.test(n))return 'inattive';if(/transizion|ripartenz/.test(n))return 'transizioni';if(/tiro|cross|finalizz/.test(n))return 'finalizzazione';return CAT_BY_MD[mdClass(md)]||'durata'}
function saveToLibrary(){if(!ED||!ED.s.done)return 0;const s=ED.s;const w=getWeek(ED.wid);const data=iso(addDays(parseIso(ED.wid),s.giorno));let n=0;
  s.esercizi.forEach(e=>{if(e.svolto===false)return;const ex=e.libId&&S.drills.find(d=>d.id===e.libId);
    if(ex){if(!e.contato){const {id,mine,...rest}=ex;const nd={...rest,usi:(Number(ex.usi)||1)+1,ultimoUso:data,valutazione:e.valutazione||ex.valutazione||''};const i=S.drills.findIndex(d=>d.id===id);S.drills[i]={...nd,id};put('esercizi',id,nd);e.contato=true}return}
    if(!e.salva)return;const id=uid();const {svolto,salva,valutazione,libId,contato,...f}=e;
    const nd={...f,cat:catFor(e,s.md),usi:1,ultimoUso:data,valutazione:e.valutazione||'',origine:`${DAYS_FULL[s.giorno]} ${fmtDay(parseIso(data))} · ${s.titolo||s.tipo}`};
    S.drills.unshift({...nd,id});put('esercizi',id,nd);e.libId=id;e.contato=true;e.salva=false;n++});
  return n}
function persistED(){const w=getWeek(ED.wid);const s=ED.s;(s.esercizi||[]).forEach(e=>{if((e.giocatori||'')!==(e.schemaG??''))fixEx(e);if(Array.isArray(e.step)){e.step=e.step.filter(x=>x.titolo||x.descrizione||x.giocatori);if(!e.step.length)delete e.step}});s.md=mdLabel(s.giorno,matchDayOf(w));const ss=[...(w.sessioni||[])];if(ED.idx>=0)ss[ED.idx]=s;else{ss.push(s)}ss.sort((a,b)=>a.giorno-b.giorno);if(ED.idx<0)ED.idx=ss.indexOf(s);saveWeek({...w,sessioni:ss})}
function replPanel(i){const r=ED.repl;if(!r||r.i!==i)return '';const e=ED.s.esercizi[i];const allDr=[...S.drills,...BASE_DRILLS];
  if(r.state==='busy')return `<div class="aibox"><p>Cerco un’alternativa a “${esc(e.nome)}”…</p></div>`;
  if(r.state==='done'){const x=r.result;return `<div class="aibox"><div class="row" style="justify-content:space-between"><b>Proposta: ${esc(x.nome)}</b><span class="mono muted">${x.durata}′</span></div><div class="row" style="gap:12px;align-items:flex-start"><div style="width:180px">${thumb(x,'')}</div><div style="flex:1;min-width:0;font-size:.88rem"><div class="kv">${appBadge(x,ED.s.md)}<span>${esc(x.spazio)}</span><span>${esc(x.giocatori)}</span></div><p>${esc(x.descrizione)}</p>${x.principio?`<p><b>Principio:</b> ${esc(x.principio)}</p>`:''}</div></div><div class="row"><button class="btn pri sm" data-act="replUse" data-i="${i}">Usa questo</button><button class="btn sm" data-act="replAi" data-i="${i}">Altra proposta</button><button class="btn sm ghost" data-act="replClose">Annulla</button></div></div>`}
  return `<div class="aibox"><div class="row" style="justify-content:space-between"><b>Sostituisci “${esc(e.nome)}”</b><button class="btn sm ghost" data-act="replClose">Chiudi</button></div>
    ${S.sample?`<label class="f"><span>Cosa vuoi cambiare (facoltativo)</span><input type="text" id="replReq" data-keep="1" value="${esc(r.req||'')}" placeholder="Es. più cognitivo, senza porte, con meno attese, sul 1-3-5-2"></label><div class="row"><button class="btn ai sm" data-act="replAi" data-i="${i}">Proponi un’alternativa</button></div>`:''}
    <div class="row"><select id="replLib" style="width:auto;max-width:320px" aria-label="Esercizio dalla libreria"><option value="">Oppure dalla libreria…</option>${Object.keys(CATS).map(c=>`<optgroup label="${CATS[c]}">${allDr.filter(x=>x.cat===c).map(x=>`<option value="${x.id}">${esc(x.nome)}</option>`).join('')}</optgroup>`).join('')}</select><button class="btn sm" data-act="replLib" data-i="${i}">Sostituisci con questo</button></div></div>`}
async function replAi(i){collectEditor();const s=ED.s;const e=s.esercizi[i];const w=getWeek(ED.wid);const req=(document.getElementById('replReq')?.value??ED.repl?.req??'').trim();
  ED.repl={i,state:'busy',req};drawEditor();
  const strip=x=>{const {schema,svolto,salva,valutazione,libId,contato,...r}=x;return r};
  try{const r=await askExercise(`Sei il collaboratore tecnico di un allenatore di calcio italiano. Proponi UN esercizio ALTERNATIVO che sostituisca l'esercizio indicato nella seduta, nello stesso punto.
${METODO}
${teamContext()}
SEDUTA: ${DAYS_FULL[s.giorno]}, ${s.md||''}, ${s.titolo}. Obiettivo: ${s.focus}. Obiettivo settimana: ${w.obiettivo||'-'}.
Esercizi della seduta: ${s.esercizi.map((x,k)=>(k===i?'>> DA SOSTITUIRE: ':'')+x.nome+' ('+x.durata+"')").join(' | ')}
ESERCIZIO DA SOSTITUIRE: ${JSON.stringify(strip(e))}
Mantieni fase (${e.fase}), durata (${e.durata}'), numeri di giocatori e principio allenato, salvo diversa indicazione. Deve essere un esercizio diverso, non la stessa cosa con un nome nuovo.
Richiesta del mister: ${req||'nessuna, proponi la migliore alternativa'}.
${sisRule(w)}
${staffRule(w)}
${numRule(w,[s.giorno])}
${condRule()}
${appRule()}
${designRule()}
${SCHEMA_SPEC}
Rispondi SOLO con JSON: {"nome":"","fase":"${e.fase}","durata":${e.durata},"spazio":"","giocatori":"numeri esatti con totale","descrizione":"","principio":"","coaching":"","organizzazione":"","condizionale":"","vincoli":"","sistema":"","step":[{"titolo":"","giocatori":"","descrizione":""}],"schema":{...}}${reqRule(req)}`,req);
    if(r.v.length)toast('Controlla la proposta: '+r.v.join('; '));if(ED&&ED.repl)ED.repl={i,state:'done',req,result:r.e}}
  catch(err){toast(err?.code==='rate_limited'?'Troppe richieste: riprova tra poco':'Proposta non riuscita');if(ED)ED.repl={i,state:'form',req}}
  if(ED&&document.getElementById('dlg').open)drawEditor()}
async function exAi(){
  collectEditor();const req=(document.getElementById('exAiReq')?.value||'').trim();const s=ED.s;const w=getWeek(ED.wid);
  ED.busy=true;drawEditor();
  try{
    const r=await askExercise(`Sei il collaboratore tecnico di un allenatore di calcio. Proponi UN esercizio per questa seduta.
${METODO}
${teamContext()}
SEDUTA: ${DAYS_FULL[s.giorno]}, ${mdLabel(s.giorno,matchDayOf(w))||''}, tipo ${s.tipo}, obiettivo: ${s.focus}. Obiettivo settimana: ${w.obiettivo||'-'}. Esercizi già presenti: ${s.esercizi.map(e=>e.nome).join(', ')||'nessuno'}.
Richiesta del mister: ${req||'completa la seduta con l’esercizio più utile'}.
${SCHEMA_SPEC}
Rispondi SOLO con JSON: {"nome":"","fase":"iniziale|centrale|condizionale|finale","durata":15,"spazio":"","giocatori":"","descrizione":"regole, blocchi e recuperi","principio":"","coaching":"punti chiave","organizzazione":"preparazione campo, palloni, posizione allenatore, passaggio al successivo","condizionale":"obiettivo fisico e parametri","vincoli":"regole usate e effetto atteso","sistema":"nome del sistema o entrambi","step":[{"titolo":"","giocatori":"","descrizione":""}],"schema":{...}}
${sisRule(w)}
${staffRule(w)}
${numRule(w,[s.giorno])}
${dayRule([s.giorno])}
${groupRule(w)}
${condRule()}
${appRule()}
${designRule()}${reqRule(req)}`,req);
    s.esercizi.push(r.e);toast(r.v.length?'Esercizio aggiunto, ma controlla: '+r.v.join('; '):'Esercizio aggiunto, con disegno');
  }catch(e){toast(e?.code==='rate_limited'?'Troppe richieste: riprova tra poco':'Proposta non riuscita')}
  ED.busy=false;if(document.getElementById('dlg').open&&ED)drawEditor();
}

/* ===== Export PDF della seduta ===== */
const pdfT=s=>String(s??'').replace(/[′’‘]/g,"'").replace(/[″”“]/g,'"').replace(/[–—]/g,'-').replace(/…/g,'...').replace(/×/g,'x').replace(/[^\x00-\xFF€]/g,'');
function svgToPng(svg,w){return new Promise((res,rej)=>{const img=new Image();img.onload=()=>{const c=document.createElement('canvas');const r=img.height/img.width||0.7;c.width=w;c.height=Math.round(w*r);const x=c.getContext('2d');x.drawImage(img,0,0,c.width,c.height);try{res({url:c.toDataURL('image/png'),r})}catch(e){rej(e)}};img.onerror=rej;img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg.replace('<svg ','<svg width="'+w+'" '))})}
async function exportPdf(){
  if(!ED||!S.downloads)return;const b=document.getElementById('pdfBtn');if(b){b.disabled=true;b.textContent='Preparo il PDF…'}
  try{
    if(!window.jspdf)throw new Error('Libreria PDF non caricata');
    const {jsPDF}=window.jspdf;const doc=new jsPDF({unit:'mm',format:'a4'});const s=ED.s;const w=getWeek(ED.wid);const t=team();
    const d=addDays(parseIso(ED.wid),s.giorno);const W=210,M=14;let y=M;
    const need=h=>{if(y+h>287){doc.addPage();y=M}};
    const para=(txt,size,style,x,width,col)=>{if(!txt)return 0;doc.setFont('helvetica',style||'normal');doc.setFontSize(size);doc.setTextColor(...(col||[22,33,27]));const lines=doc.splitTextToSize(pdfT(txt),width);doc.text(lines,x,y);const h=lines.length*size*0.42+1.2;return h};
    doc.setFillColor(22,33,27);doc.rect(0,0,W,24,'F');doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(16);doc.text(pdfT(s.titolo||s.tipo),M,11);
    doc.setFont('helvetica','normal');doc.setFontSize(9.5);doc.text(pdfT(`${t.nome} · ${DAYS_FULL[s.giorno]} ${fmtDay(d)} ${d.getFullYear()}${ora(s.giorno)?' ore '+ora(s.giorno):''} · ${mdLabel(s.giorno,matchDayOf(w))||''} · ${s.durata}' · RPE ${s.rpe}`),M,18);y=31;
    if(s.focus){y+=para('Obiettivo della seduta: '+s.focus,10,'bold',M,W-2*M)}
    if(w.obiettivo){y+=para('Obiettivo della settimana: '+w.obiettivo,9,'normal',M,W-2*M,[90,104,95])}
    if(w.avversario){y+=para(`Partita: ${DAYS_FULL[matchDayOf(w)]||''} contro ${w.avversario}${w.sistemaPartita?' · sistema '+w.sistemaPartita:''}`,9,'normal',M,W-2*M,[90,104,95])}
    if(s.squadreSeduta){y+=2;y+=para('SQUADRE DELLA SEDUTA',8,'bold',M,W-2*M,[90,104,95]);s.squadreSeduta.squadre.forEach(t=>{y+=para(`${t.nome}${(t.portieri||[]).length?' (P '+t.portieri.map(pName).join(', ')+')':''} - A: ${t.sub.A.map(pName).join(', ')}  |  B: ${t.sub.B.map(pName).join(', ')}`,8.5,'normal',M,W-2*M)})}
    y+=3;
    for(const e of s.esercizi||[]){
      const img=await svgToPng(svgBoard(schemaOf(e)),900).catch(()=>null);const iw=74,ih=img?Math.min(60,iw*img.r):0;
      const tx=M+iw+6,tw=W-M-tx;
      const parts=[[e.descrizione,9,'normal'],[e.principio&&'Principio: '+e.principio,8.5,'normal'],[e.coaching&&'Punti chiave: '+e.coaching,8.5,'normal'],[e.vincoli&&'Vincoli: '+e.vincoli,8.5,'normal'],...(Array.isArray(e.step)?e.step.map((st,k)=>[`Step ${k+1}${st.titolo?' - '+st.titolo:''}${st.giocatori?' ('+st.giocatori+')':''}: ${st.descrizione}`,8.5,'normal']):[]),[e.organizzazione&&'Organizzazione: '+e.organizzazione,8.5,'normal'],[e.condizionale&&'Condizionale: '+e.condizionale,8.5,'normal']];
      doc.setFontSize(9);let th=12;parts.forEach(([x,sz])=>{if(x)th+=doc.splitTextToSize(pdfT(x),tw).length*sz*0.42+1.2});
      let teamTxt='';const T=s.squadreSeduta;const md2=exMode(e);if(T&&md2==='squadre')teamTxt=T.squadre.map(t=>t.nome).join(' contro ');if(T&&md2==='sotto')teamTxt=T.squadre.length===2?`campo 1 ${T.squadre[0].nome} A - ${T.squadre[1].nome} A, campo 2 ${T.squadre[0].nome} B - ${T.squadre[1].nome} B`:T.squadre.map(t=>t.nome+' A / B').join(', ');
      const teamH=teamTxt?doc.splitTextToSize(pdfT('Squadre - '+teamTxt),W-2*M).length*3.7+2:0;
      need(Math.max(ih,th)+teamH+8);
      doc.setDrawColor(205,213,202);doc.line(M,y,W-M,y);y+=4;const y0=y;
      if(img)doc.addImage(img.url,'PNG',M,y,iw,iw*img.r>60?60/img.r:iw,undefined,'FAST');
      doc.setFont('helvetica','bold');doc.setFontSize(7.5);doc.setTextColor(90,104,95);doc.text(pdfT((e.fase||'').toUpperCase()+'  ·  '+e.durata+"'"+(e.sistema&&e.sistema!=='entrambi'?'  ·  '+e.sistema:'')),tx,y+2);y+=6;
      y+=para(e.nome,11,'bold',tx,tw);
      y+=para([e.spazio,e.giocatori].filter(Boolean).join(' · '),8.5,'normal',tx,tw,[90,104,95]);
      parts.forEach(([x,sz])=>{if(x)y+=para(x,sz,'normal',tx,tw)});
      y=Math.max(y,y0+(img?Math.min(60,iw*img.r):0))+2;
      if(teamTxt){y+=para('Squadre - '+teamTxt,8.5,'bold',M,W-2*M,[29,106,70])}
      y+=2;
    }
    const pres=Array.isArray(s.presenti)?s.presenti.length:null;
    need(14);doc.setDrawColor(205,213,202);doc.line(M,y,W-M,y);y+=5;
    y+=para(`Note: ${s.note||'_______________________________________________'}${pres!=null?'   ·   Presenti: '+pres:''}${s.rpeReale!=null?'   ·   RPE rilevato: '+s.rpeReale:''}`,8.5,'normal',M,W-2*M,[90,104,95]);
    const fname=`Seduta ${pad(d.getDate())}-${pad(d.getMonth()+1)}-${d.getFullYear()} ${mdLabel(s.giorno,matchDayOf(w))||''}`.trim()+'.pdf';
    await S.downloads.save({filename:fname,data:doc.output('blob')});toast('PDF pronto');
  }catch(e){if(e&&e.code==='declined'){}else toast(e&&e.code==='rate_limited'?'Un salvataggio è già aperto: riprova tra poco':'Export non riuscito: '+(e&&(e.message||e.code)||'errore'))}
  const b2=document.getElementById('pdfBtn');if(b2){b2.disabled=false;b2.textContent='Esporta PDF'}
}
function shortTxt(t,n){t=String(t||'').replace(/\s+/g,' ').trim();if(t.length<=n)return t;const cut=t.slice(0,n);const k=Math.max(cut.lastIndexOf('. '),cut.lastIndexOf('; '));return (k>n*0.45?cut.slice(0,k+1):cut.slice(0,cut.lastIndexOf(' '))+'…')}
async function exportPdfField(){
  if(!ED||!S.downloads)return;const b=document.getElementById('pdfBtn2');if(b){b.disabled=true;b.textContent='Preparo…'}
  try{if(!window.jspdf)throw new Error('Libreria PDF non caricata');
    const {jsPDF}=window.jspdf;const doc=new jsPDF({unit:'mm',format:'a4'});const s=ED.s;const w=getWeek(ED.wid);const t=team();const d=addDays(parseIso(ED.wid),s.giorno);const md=mdLabel(s.giorno,matchDayOf(w))||'';
    const W=210,M=12;let y=M;const need=h=>{if(y+h>290){doc.addPage();y=M}};
    const txt=(str,size,style,x,width,col)=>{doc.setFont('helvetica',style||'normal');doc.setFontSize(size);doc.setTextColor(...(col||[22,33,27]));const lines=doc.splitTextToSize(pdfT(str),width);doc.text(lines,x,y);return lines.length*size*0.4+0.8};
    const hgt=(str,size,width)=>{doc.setFontSize(size);return doc.splitTextToSize(pdfT(str),width).length*size*0.4+0.8};
    doc.setFillColor(22,33,27);doc.rect(0,0,W,17,'F');doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(13);
    doc.text(pdfT(`${DAYS_FULL[s.giorno]} ${pad(d.getDate())}/${pad(d.getMonth()+1)} · ${md}${ora(s.giorno)?' · ore '+ora(s.giorno):''} · ${s.durata}' · RPE ${s.rpe}`),M,8);
    doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.text(pdfT(`${t.nome}${w.avversario?' · prossima partita: '+w.avversario:''}${w.sistemaPartita?' · '+w.sistemaPartita:''}`),M,13.5);y=22;
    if(s.focus)y+=txt('Obiettivo: '+s.focus,9.5,'bold',M,W-2*M);
    const T=s.squadreSeduta;if(T){y+=1;T.squadre.forEach(tm=>{y+=txt(`${tm.nome}${(tm.portieri||[]).length?' (P '+tm.portieri.map(pName).join(', ')+')':''}  A: ${tm.sub.A.map(pName).join(', ')}  |  B: ${tm.sub.B.map(pName).join(', ')}`,8,'normal',M,W-2*M,[60,72,64])})}
    y+=2;let tmin=null;const o=String(ora(s.giorno)||'').match(/(\d{1,2})[:.](\d{2})/);if(o)tmin=+o[1]*60+ +o[2];const hm=m=>pad(Math.floor(m/60)%24)+':'+pad(m%60);
    for(const e of s.esercizi||[]){
      const img=await svgToPng(svgBoard(schemaOf(e)),700).catch(()=>null);const iw=38,ih=img?Math.min(28,iw*img.r):0;const tx=M+20+iw+4,tw=W-M-tx;
      const a=appOf(e);const meta=[e.fase,e.durata+"'",e.spazio,e.giocatori,a&&appType(e,s.md)?a.app+' m2/g':''].filter(Boolean).join(' · ');
      const steps=Array.isArray(e.step)&&e.step.length?'Step: '+e.step.map((x,k)=>`${k+1}) ${x.titolo||shortTxt(x.descrizione,40)}`).join('  ->  '):'';
      const m2=exMode(e);const tl=T&&m2==='squadre'?'Squadre: '+T.squadre.map(x=>x.nome).join(' contro '):T&&m2==='sotto'?`Campo 1: ${T.squadre[0].nome} A - ${T.squadre[1]?T.squadre[1].nome:''} A  |  Campo 2: ${T.squadre[0].nome} B - ${T.squadre[1]?T.squadre[1].nome:''} B`:'';
      const rows=[[e.nome,10,'bold',[22,33,27]],[meta,7.8,'normal',[90,104,95]],[e.descrizione&&'Regole: '+shortTxt(e.descrizione,190),8.3,'normal'],[steps,8.3,'normal'],[e.coaching&&'Chiave: '+shortTxt(e.coaching,130),8.3,'bold',[29,106,70]],[tl,7.8,'normal',[90,104,95]]].filter(r=>r[0]);
      const th=rows.reduce((acc,r)=>acc+hgt(r[0],r[1],tw),0);need(Math.max(ih,th)+4);
      doc.setDrawColor(205,213,202);doc.line(M,y-1,W-M,y-1);const y0=y+1;
      doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setTextColor(22,33,27);if(tmin!=null){doc.text(hm(tmin),M,y0+3);doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.setTextColor(90,104,95);doc.text(hm(tmin+Number(e.durata||0)),M,y0+7);tmin+=Number(e.durata||0)}else{doc.text(e.durata+"'",M,y0+3)}
      if(img)doc.addImage(img.url,'PNG',M+20,y0,iw,ih,undefined,'FAST');
      y=y0+2.5;rows.forEach(r=>{y+=txt(r[0],r[1],r[2],tx,tw,r[3])});
      y=Math.max(y,y0+ih)+3;
    }
    need(10);doc.setDrawColor(205,213,202);doc.line(M,y-1,W-M,y-1);y+=3;txt('Note: _____________________________________________________________________________',8.5,'normal',M,W-2*M,[90,104,95]);
    const fname=`Seduta ${pad(d.getDate())}-${pad(d.getMonth()+1)}-${d.getFullYear()} ${md} campo`.trim()+'.pdf';
    await S.downloads.save({filename:fname,data:doc.output('blob')});toast('PDF da campo pronto');
  }catch(e){if(!(e&&e.code==='declined'))toast(e&&e.code==='rate_limited'?'Un salvataggio è già aperto: riprova tra poco':'Export non riuscito: '+(e&&(e.message||e.code)||'errore'))}
  const b2=document.getElementById('pdfBtn2');if(b2){b2.disabled=false;b2.textContent='PDF da campo'}
}
/* ===== Lavagna: editor ===== */
let BD=null;
const TOOLS=[['sel','Seleziona',''],['A','A','<i class="sw" style="background:#E4572E"></i>'],['B','B','<i class="sw" style="background:#2F6FDB"></i>'],['J','Jolly','<i class="sw" style="background:#F2C230"></i>'],['P','Portiere','<i class="sw" style="background:#1E1E1E"></i>'],['palla','Palla','<i class="sw" style="background:#fff"></i>'],['cono','Cono','<i class="sw" style="background:#FF8A1F;border-radius:2px"></i>'],['porta','Porta',''],['porticina','Porticina',''],['corsa','Corsa','<i class="ln d"></i>'],['passaggio','Passaggio','<i class="ln"></i>'],['conduzione','Conduzione','<i class="ln w"></i>'],['gomma','Gomma','']];
function openBoard(schema,opt){
  BD={sc:JSON.parse(JSON.stringify(normalizeSchema(schema)||{campo:'rett',w:40,h:30,el:[]})),tool:'sel',sel:null,hist:[],ro:!!opt.readOnly,onSave:opt.onSave,ctx:opt.ctx||{},title:opt.title||'Lavagna',busy:false};
  const dl=document.getElementById('board');
  const F=BD.sc;
  dl.innerHTML=`<div class="dlg"><header><div><span class="lbl">${BD.ro?'Schema':'Lavagna'}</span><h2>${esc(BD.title)}</h2></div><button class="btn ghost" data-act="bdClose" aria-label="Chiudi">✕</button></header>
    <div class="body" style="gap:12px">
    ${BD.ro?'':`<div class="tools" id="bdTools">${TOOLS.map(([k,l,ic])=>`<button data-act="bdTool" data-k="${k}" aria-pressed="${k===BD.tool}">${ic}${l}</button>`).join('')}</div>
    <div class="row"><select id="bdCampo" style="width:auto" aria-label="Tipo di campo">${Object.entries(FIELDS).map(([k,f])=>`<option value="${k}" ${F.campo===k?'selected':''}>${f.l}</option>`).join('')}</select>
      <span id="bdDims" ${F.campo==='rett'?'':'hidden'} class="row" style="gap:6px"><input type="number" id="bdW" value="${F.w}" min="5" max="110" style="width:76px" aria-label="Lunghezza in metri"> × <input type="number" id="bdH" value="${F.h}" min="4" max="75" style="width:76px" aria-label="Larghezza in metri"> m</span>
      <span style="flex:1"></span><button class="btn sm" data-act="bdUndo">Annulla</button><button class="btn sm" data-act="bdClear" data-confirm="Conferma: svuota">Svuota</button>${S.sample&&BD.ctx.nome?`<button class="btn sm ai" data-act="bdAi" id="bdAiBtn">Disegna con l'AI</button>`:''}</div>
    <p class="muted" style="font-size:.82rem">Scegli un elemento e clicca sul campo per posizionarlo. Per le frecce trascina dal punto di partenza a quello di arrivo. Con “Seleziona” sposti gli elementi; Canc elimina quello selezionato.</p>`}
    <div class="boardwrap" id="bdWrap"></div>
    ${BD.ro&&BD.ctx.descrizione?`<p>${esc(BD.ctx.descrizione)}</p>`:''}
    </div>
    <footer><div></div><div class="row">${BD.ro?`<button class="btn" data-act="bdClose">Chiudi</button>${opt.onEdit?`<button class="btn pri" data-act="bdEdit">Modifica</button>`:''}`:`<button class="btn" data-act="bdClose">Annulla</button><button class="btn pri" data-act="bdSave">Salva disegno</button>`}</div></footer></div>`;
  BD.onEdit=opt.onEdit;
  drawBoard();if(!dl.open)dl.showModal();
}
function drawBoard(){const w=document.getElementById('bdWrap');if(w&&BD)w.innerHTML=svgBoard(BD.sc,{sel:BD.sel,preview:BD.preview,label:BD.title})}
function bdPush(){BD.hist.push(JSON.stringify(BD.sc));if(BD.hist.length>60)BD.hist.shift()}
function bdPoint(ev){const svg=document.querySelector('#bdWrap svg');if(!svg)return null;const pt=svg.createSVGPoint();pt.x=ev.clientX;pt.y=ev.clientY;const p=pt.matrixTransform(svg.getScreenCTM().inverse());return {x:r1(p.x),y:r1(p.y)}}
function bdDown(ev){if(!BD||BD.ro)return;const p=bdPoint(ev);if(!p)return;const t=BD.tool;ev.preventDefault();
  if(t==='sel'){const h=hitBoard(BD.sc,p);BD.sel=h?h.i:null;if(h){bdPush();BD.drag={...h,last:p}}drawBoard()}
  else if(t==='gomma'){const h=hitBoard(BD.sc,p);if(h){bdPush();BD.sc.el.splice(h.i,1);BD.sel=null;drawBoard()}}
  else if(LINES.includes(t)){BD.drag={line:true};BD.preview={k:t,x:p.x,y:p.y,x2:p.x,y2:p.y}}
  else{bdPush();BD.sc.el.push({k:t,x:p.x,y:p.y});BD.sel=BD.sc.el.length-1;drawBoard()}
  try{ev.currentTarget.setPointerCapture(ev.pointerId)}catch(e){}}
function bdMove(ev){if(!BD||!BD.drag)return;const p=bdPoint(ev);if(!p)return;
  if(BD.drag.line){BD.preview.x2=p.x;BD.preview.y2=p.y;drawBoard();return}
  const e=BD.sc.el[BD.drag.i];if(!e)return;const dx=p.x-BD.drag.last.x,dy=p.y-BD.drag.last.y;BD.drag.last=p;
  if(BD.drag.part==='end'){e.x2=p.x;e.y2=p.y}else if(BD.drag.part==='start'){e.x=p.x;e.y=p.y}else{e.x=r1(e.x+dx);e.y=r1(e.y+dy);if('x2' in e){e.x2=r1(e.x2+dx);e.y2=r1(e.y2+dy)}}
  drawBoard()}
function bdUp(){if(!BD)return;if(BD.drag&&BD.drag.line){const pv=BD.preview;BD.preview=null;if(pv&&Math.hypot(pv.x2-pv.x,pv.y2-pv.y)>1){bdPush();BD.sc.el.push(pv);BD.sel=BD.sc.el.length-1}drawBoard()}BD.drag=null}
async function bdAi(){
  if(!BD||BD.busy)return;const c=BD.ctx;BD.busy=true;const b=document.getElementById('bdAiBtn');if(b){b.disabled=true;b.textContent='Sto disegnando…'}
  try{const r=await S.sample.json(`Disegna lo schema grafico di questo esercizio di calcio per una lavagna tattica.
ESERCIZIO: ${c.nome}. Spazio: ${c.spazio||'n.d.'}. Giocatori: ${c.giocatori||'n.d.'}. Descrizione: ${c.descrizione||''}. Principio: ${c.principio||''}.
${SCHEMA_SPEC}
Rispondi SOLO con l'oggetto JSON dello schema.`,{modelTier:'default'});
    const sc=normalizeSchema(r&&r.schema?r.schema:r);if(!sc||!sc.el.length)throw new Error('vuoto');
    if(BD){bdPush();BD.sc=sc;BD.sel=null;const cs=document.getElementById('bdCampo');if(cs)cs.value=sc.campo;const dm=document.getElementById('bdDims');if(dm){dm.hidden=sc.campo!=='rett';document.getElementById('bdW').value=sc.w;document.getElementById('bdH').value=sc.h}drawBoard();toast('Schema disegnato: correggilo se serve')}
  }catch(e){toast(e?.code==='rate_limited'?'Troppe richieste: riprova tra poco':'Disegno non riuscito, riprova')}
  if(BD){BD.busy=false}const b2=document.getElementById('bdAiBtn');if(b2){b2.disabled=false;b2.textContent="Disegna con l'AI"}
}
function boardForSessionExercise(i){
  collectEditor();const e=ED.s.esercizi[i];if(!e)return;
  openBoard(schemaOf(e),{title:e.nome,ctx:e,onSave:sc=>{collectEditor();ED.s.esercizi[i].schema=sc;persistED();drawEditor();toast('Disegno salvato')}});
}

/* ===== Vista: Squadra (rosa, partite, classifica) ===== */
function vSquadra(){
  const tabs=[['rosa','Rosa'],['partite','Partite'],['classifica','Classifica']];
  const body={rosa:vRosa,partite:vPartite,classifica:vClassifica}[S.sub]||vRosa;
  return `<div class="head"><div><span class="lbl">${esc(team().categoria||'')}</span><h1>Squadra</h1></div>${S.sub==='rosa'?'<button class="btn pri" data-act="plEdit">Aggiungi giocatore</button>':S.sub==='partite'?'<button class="btn pri" data-act="mEdit">Aggiungi partita</button>':''}</div>
  <nav class="subtabs" aria-label="Sezioni squadra">${tabs.map(([k,l])=>`<a href="#${k}" ${S.sub===k?'aria-current="page"':''}>${l}</a>`).join('')}</nav>${body()}`;
}
function vRosa(){
  const pl=sortPlayers(S.players).filter(p=>S.rosaFilter==='tutti'||p.ruolo===S.rosaFilter);
  const cnt=k=>S.players.filter(p=>(p.stato||'disponibile')===k).length;
  return `<p class="muted">${S.players.length} giocatori · ${cnt('disponibile')} disponibili${cnt('infortunato')?' · '+cnt('infortunato')+' infortunati':''}${cnt('acciaccato')?' · '+cnt('acciaccato')+' acciaccati':''}${cnt('squalificato')?' · '+cnt('squalificato')+' squalificati':''}</p>
  <div class="chips">${[['tutti','Tutti'],...Object.entries(RUOLI)].map(([k,l])=>`<button class="chip" aria-pressed="${S.rosaFilter===k}" data-act="rosaF" data-k="${k}">${l}</button>`).join('')}</div>
  ${pl.length?`<div class="card tbl" style="padding:6px 10px"><table><thead><tr><th>Giocatore</th><th>Ruolo</th><th>Stato</th><th>Presenze</th><th>Note</th><th></th></tr></thead><tbody>
  ${pl.map(p=>{const a=attendance(p.id);return `<tr><td><b>${esc(cogNome(p))}</b> <span class="muted num">${esc(p.nascita||'')}</span></td><td>${esc(p.pos1||p.posizione||RUOLI[p.ruolo]||'')}${p.pos2?` <span class="muted">· alt. ${esc(p.pos2)}</span>`:''}${p.piede?` <span class="muted">· ${esc(p.piede)}</span>`:''}${p.sottoruolo?`<div class="muted" style="font-size:.8rem">${esc(p.sottoruolo)}</div>`:''}</td>
   <td><select data-act-change="plStato" data-id="${p.id}" aria-label="Stato di ${esc(p.nome)}">${Object.entries(STATI).map(([k,[l]])=>`<option value="${k}" ${(p.stato||'disponibile')===k?'selected':''}>${l}</option>`).join('')}</select></td>
   <td class="num" style="white-space:nowrap">${a?`<span class="bar"><i style="width:${a.pct}%"></i></span>${a.pct}%`:'<span class="muted">—</span>'}</td><td class="muted" style="max-width:240px;font-size:.85rem">${esc(p.note||'')}${p.rientro?` <span class="pill">rientro ${fmtDay(parseIso(p.rientro))}</span>`:''}</td><td><button class="btn sm" data-act="plEdit" data-id="${p.id}">Modifica</button></td></tr>`}).join('')}
  </tbody></table></div>`:`<div class="empty">Nessun giocatore${S.rosaFilter!=='tutti'?' in questo ruolo':''}.</div>`}`;
}
function plDialog(id){
  const p=S.players.find(x=>x.id===id)||{ruolo:'CEN',stato:'disponibile'};
  document.getElementById('dlg').innerHTML=`<div class="dlg"><header><h2>${id?'Modifica giocatore':'Nuovo giocatore'}</h2><button class="btn ghost" data-act="dlgClose" aria-label="Chiudi">✕</button></header><div class="body">
    <div class="fgrid"><label class="f"><span>Nome e cognome</span><input type="text" id="pNome" value="${esc(p.nome)}"></label><label class="f"><span>Anno di nascita</span><input type="number" id="pNasc" value="${esc(p.nascita)}"></label></div>
    <div class="fgrid"><label class="f"><span>Reparto</span><select id="pRuolo">${Object.entries(RUOLI_OPT).map(([k,l])=>`<option value="${k}" ${p.ruolo===k?'selected':''}>${l}</option>`).join('')}</select></label><label class="f"><span>Ruolo principale</span>${posSelect('pPos1',p.pos1||'','—')}</label><label class="f"><span>Ruolo secondario</span>${posSelect('pPos2',p.pos2||'','Nessuno')}</label><label class="f"><span>Piede</span><select id="pPiede">${['','destro','sinistro','ambidestro'].map(x=>`<option ${p.piede===x?'selected':''}>${x}</option>`).join('')}</select></label></div>
    <label class="f"><span>Sotto-ruolo e caratteristiche</span><input type="text" id="pSub" value="${esc(p.sottoruolo||'')}" placeholder="Es. braccetto sinistro in impostazione, mezzala d’inserimento, punta di riferimento"></label>
    ${p.rientratoIl?`<div class="row" style="justify-content:space-between;background:var(--accent-soft);border-radius:var(--r);padding:8px 10px"><span style="font-size:.9rem">Segnato come rientro da infortunio dal ${fmtDay(parseIso(p.rientratoIl))}: nelle sedute lo inserisco con un ruolo protetto.</span><button class="btn sm" data-act="plNoReturn" data-id="${p.id}">Non è un rientro</button></div>`:''}
    <div class="fgrid"><label class="f"><span>Stato</span><select id="pStato">${Object.entries(STATI).map(([k,[l]])=>`<option value="${k}" ${(p.stato||'disponibile')===k?'selected':''}>${l}</option>`).join('')}</select></label><label class="f"><span>Rientro previsto</span><input type="date" id="pRientro" value="${esc(p.rientro)}"></label></div>
    <label class="f"><span>Note</span><textarea id="pNote">${esc(p.note)}</textarea></label>
  </div><footer><div>${id?`<button class="btn danger" data-act="plDel" data-id="${id}" data-confirm="Conferma eliminazione">Elimina</button>`:''}</div><div class="row"><button class="btn" data-act="dlgClose">Annulla</button><button class="btn pri" data-act="plSave" data-id="${id||''}">Salva</button></div></footer></div>`;
  document.getElementById('dlg').showModal();
}
function vPartite(){
  const t0=todayIso();const fut=S.matches.filter(m=>m.data>=t0).sort((a,b)=>a.data<b.data?-1:1);const past=S.matches.filter(m=>m.data<t0).sort((a,b)=>a.data>b.data?-1:1);
  const card=m=>{const d=parseIso(m.data);const res=m.giocata&&m.golFatti!==''&&m.golFatti!=null;const k=res?(+m.golFatti>+m.golSubiti?'ok':+m.golFatti<+m.golSubiti?'bad':'warn'):'';const nm=esc(team().nome);
    return `<div class="card stack" style="gap:8px"><div class="row" style="justify-content:space-between"><div class="row"><span class="mono muted">${DAYS[(d.getDay()+6)%7]} ${fmtDay(d)}${m.ora?' · '+esc(m.ora):''}</span>${m.giornata?`<span class="pill">${esc(m.giornata)}</span>`:''}</div><button class="btn sm" data-act="mEdit" data-id="${m.id}">${res||m.data>=t0?'Modifica':'Inserisci risultato'}</button></div>
    <div class="row" style="justify-content:space-between"><h3 style="font-size:1.3rem;text-transform:uppercase">${m.casa?nm+' – '+esc(m.avversario):esc(m.avversario)+' – '+nm}</h3>${res?`<span class="pill ${k} num" style="font-size:1rem">${m.casa?m.golFatti+' - '+m.golSubiti:m.golSubiti+' - '+m.golFatti}</span>`:''}</div>
    ${m.luogo&&m.data>=t0?`<p class="muted" style="font-size:.85rem">${esc(m.luogo)}</p>`:''}${m.analisi?`<p class="muted" style="white-space:pre-line">${esc(m.analisi)}</p>`:''}</div>`};
  return `${fut.length?`<h2>Prossime</h2><div class="stack">${fut.slice(0,3).map(card).join('')}</div>`:''}
  ${past.length?`<h2>Giocate</h2><div class="stack">${past.map(card).join('')}</div>`:''}
  ${fut.length>3?`<details class="more"><summary>Resto del calendario (${fut.length-3})</summary><div class="stack" style="margin-top:12px">${fut.slice(3).map(card).join('')}</div></details>`:''}
  ${!S.matches.length?'<div class="empty">Nessuna partita.</div>':''}`;
}
function vClassifica(){const c=S.classifica;if(!c||!Array.isArray(c.righe))return '<div class="empty">La classifica non è ancora disponibile.</div>';
  const pl=S.matches.filter(m=>m.giocata&&m.golFatti!==''&&m.golFatti!=null&&/Girone|Reg/.test(m.competizione||''));const v=pl.filter(m=>+m.golFatti>+m.golSubiti).length,n=pl.filter(m=>+m.golFatti===+m.golSubiti).length,p=pl.filter(m=>+m.golFatti<+m.golSubiti).length;
  return `<div class="card stack"><div class="row" style="justify-content:space-between"><h2>Classifica</h2><span class="muted" style="font-size:.82rem">${esc(c.aggiornata||'')}</span></div>
  <div class="tbl"><table><thead><tr><th>#</th><th>Squadra</th><th>Pt</th><th>G</th><th>V</th><th>N</th><th>P</th><th>GF</th><th>GS</th><th>DR</th></tr></thead><tbody>${c.righe.map((r,i)=>`<tr ${r.nostra?'style="background:var(--accent-soft);font-weight:700"':''}><td class="num">${i+1}</td><td>${esc(r.squadra)}</td><td class="num"><b>${r.pt}</b></td><td class="num">${r.g}</td><td class="num">${r.v}</td><td class="num">${r.n}</td><td class="num">${r.p}</td><td class="num">${r.gf}</td><td class="num">${r.gs}</td><td class="num">${r.gf-r.gs>0?'+':''}${r.gf-r.gs}</td></tr>`).join('')}</tbody></table></div>
  ${c.nota?`<p class="muted" style="font-size:.82rem">${esc(c.nota)}</p>`:''}</div>`}
function mDialog(id){
  const m=S.matches.find(x=>x.id===id)||{data:iso(addDays(mondayOf(new Date()),team().matchDay??6)),casa:true,giocata:false};
  document.getElementById('dlg').innerHTML=`<div class="dlg"><header><h2>${id?esc(m.avversario):'Nuova partita'}</h2><button class="btn ghost" data-act="dlgClose" aria-label="Chiudi">✕</button></header><div class="body">
    <div class="fgrid"><label class="f"><span>Giocata</span><select id="mGioc"><option value="0" ${!m.giocata?'selected':''}>Da giocare</option><option value="1" ${m.giocata?'selected':''}>Giocata</option></select></label><label class="f"><span>Gol fatti</span><input type="number" min="0" id="mGF" value="${esc(m.golFatti)}"></label><label class="f"><span>Gol subiti</span><input type="number" min="0" id="mGS" value="${esc(m.golSubiti)}"></label></div>
    <label class="f"><span>${m.giocata||m.data<todayIso()?'Analisi della partita':'Note sull’avversario'}</span><textarea id="mAn" style="min-height:130px" placeholder="Cosa ha funzionato e cosa no, per fase di gioco. Per l'avversario: sistema, punti di forza e deboli, giocatori chiave.">${esc(m.analisi)}</textarea></label>
    <details class="more"><summary>Dati della partita</summary><div class="stack" style="margin-top:12px">
    <div class="fgrid"><label class="f"><span>Data</span><input type="date" id="mData" value="${esc(m.data)}"></label><label class="f"><span>Ora</span><input type="text" id="mOra" value="${esc(m.ora)}"></label><label class="f"><span>Avversario</span><input type="text" id="mAvv" value="${esc(m.avversario)}"></label><label class="f"><span>Campo</span><select id="mCasa"><option value="1" ${m.casa?'selected':''}>In casa</option><option value="0" ${!m.casa?'selected':''}>In trasferta</option></select></label></div>
    <div class="fgrid"><label class="f"><span>Competizione</span><input type="text" id="mComp" value="${esc(m.competizione)}"></label><label class="f"><span>Giornata</span><input type="text" id="mGiorn" value="${esc(m.giornata)}"></label></div>
    <label class="f"><span>Impianto</span><input type="text" id="mLuogo" value="${esc(m.luogo)}"></label></div></details>
  </div><footer><div>${id?`<button class="btn danger" data-act="mDel" data-id="${id}" data-confirm="Conferma eliminazione">Elimina</button>`:''}</div><div class="row"><button class="btn" data-act="dlgClose">Annulla</button><button class="btn pri" data-act="mSave" data-id="${id||''}">Salva</button></div></footer></div>`;
  document.getElementById('dlg').showModal();
}

/* ===== Vista: Esercizi ===== */
let DD=null;
function vEsercizi(){
  const all=[...S.drills.map(d=>({...d,mine:true})),...BASE_DRILLS];const list=all.filter(d=>S.libCat==='tutti'||(S.libCat==='miei'?d.mine:d.cat===S.libCat));
  return `<div class="head"><div><span class="lbl">Libreria</span><h1>Esercizi</h1></div><button class="btn pri" data-act="dEdit">Nuovo esercizio</button></div>
  ${S.sample?`<div class="aibox"><label class="f"><span>Crea un esercizio con l'assistente (arriva già disegnato)</span><textarea id="dAiReq" data-keep="1" placeholder="Es. esercizio di tensione per la difesa a 4 contro i cross, 16 giocatori, metà campo"></textarea></label><div class="row"><button class="btn ai" data-act="dAi" ${S.dBusy?'disabled':''}>${S.dBusy?'Sto pensando…':'Crea e salva'}</button></div></div>`:''}
  <div class="chips">${[['tutti','Tutti'],['miei','I miei'],...Object.entries(CATS).filter(([k])=>k!=='attivazione')].map(([k,l])=>`<button class="chip" aria-pressed="${S.libCat===k}" data-act="libF" data-k="${k}">${l}</button>`).join('')}</div>
  <div class="lib">${list.map(d=>`<article class="drill">${thumb(d,`data-act="dView" data-id="${d.id}"`)}<div class="top"><span class="lbl">${CATS[d.cat]||d.cat} · ${esc(d.durata)}′</span>${d.mine?`<button class="btn sm" data-act="dEdit" data-id="${d.id}">Modifica</button>`:'<span class="pill">Base</span>'}</div><div class="nm">${esc(d.nome)}${Array.isArray(d.step)&&d.step.length?` <span class="pill">${d.step.length} step</span>`:''}</div>${d.mine&&d.usi?`<div class="row" style="gap:6px"><span class="pill">${d.usi===1?'Svolto 1 volta':'Svolto '+d.usi+' volte'}${d.ultimoUso?' · '+fmtDay(parseIso(d.ultimoUso)):''}</span>${d.valutazione?`<span class="pill ${d.valutazione==='funzionato'?'ok':'warn'}">${d.valutazione==='funzionato'?'Funzionato':'Da rivedere'}</span>`:''}</div>`:''}<p class="ds">${esc(d.descrizione)}</p></article>`).join('')||'<div class="empty">Nessun esercizio in questa categoria.</div>'}</div>`;
}
function dDialog(id){
  const d=S.drills.find(x=>x.id===id)||{cat:'tensione',fase:'centrale',durata:15};DD={id,schema:d.schema?JSON.parse(JSON.stringify(d.schema)):null};
  document.getElementById('dlg').innerHTML=`<div class="dlg"><header><h2>${id?'Modifica esercizio':'Nuovo esercizio'}</h2><button class="btn ghost" data-act="dlgClose" aria-label="Chiudi">✕</button></header><div class="body">
    <div class="exed" style="background:transparent;border:0;padding:0"><div class="side" id="ddThumb"></div><div class="main2">
    <label class="f"><span>Nome</span><input type="text" id="dNome" value="${esc(d.nome)}"></label>
    <div class="fgrid"><label class="f"><span>Categoria</span><select id="dCat">${Object.entries(CATS).map(([k,l])=>`<option value="${k}" ${d.cat===k?'selected':''}>${l}</option>`).join('')}</select></label><label class="f"><span>Fase</span><select id="dFase">${FASI.map(f=>`<option ${d.fase===f?'selected':''}>${f}</option>`).join('')}</select></label><label class="f"><span>Minuti</span><input type="number" id="dDur" value="${esc(d.durata)}"></label></div>
    <div class="fgrid"><label class="f"><span>Spazio</span><input type="text" id="dSpazio" value="${esc(d.spazio)}"></label><label class="f"><span>Giocatori</span><input type="text" id="dGioc" value="${esc(d.giocatori)}"></label></div></div></div>
    <label class="f"><span>Descrizione</span><textarea id="dDesc">${esc(d.descrizione)}</textarea></label>
    <div class="fgrid"><label class="f"><span>Principio allenato</span><input type="text" id="dPrinc" value="${esc(d.principio)}"></label><label class="f"><span>Punti chiave</span><input type="text" id="dCoach" value="${esc(d.coaching)}"></label></div>
  </div><footer><div>${id?`<button class="btn danger" data-act="dDel" data-id="${id}" data-confirm="Conferma eliminazione">Elimina</button>`:''}</div><div class="row"><button class="btn" data-act="dlgClose">Annulla</button><button class="btn pri" data-act="dSave" data-id="${id||''}">Salva</button></div></footer></div>`;
  ddThumb();document.getElementById('dlg').showModal();
}
function ddForm(){const g=id=>document.getElementById(id)?.value??'';return {nome:g('dNome').trim(),cat:g('dCat'),fase:g('dFase'),durata:Number(g('dDur'))||15,spazio:g('dSpazio'),giocatori:g('dGioc'),descrizione:g('dDesc'),principio:g('dPrinc'),coaching:g('dCoach')}}
function ddThumb(){const el=document.getElementById('ddThumb');if(!el||!DD)return;const f=ddForm();el.innerHTML=thumb({...f,schema:DD.schema},'data-act="ddBoard"')+`<button class="btn sm" data-act="ddBoard">${DD.schema?'Modifica disegno':'Disegna'}</button>`}

/* ===== Vista: Impostazioni ===== */
function vImpostazioni(){
  const t=team();const pr=t.principi||{};
  const fld=(id,l,v,ph)=>`<label class="f"><span>${l}</span><textarea id="${id}" placeholder="${esc(ph)}">${esc(v)}</textarea></label>`;
  return `<div class="head"><div><span class="lbl">Impostazioni</span><h1>Squadra e modello di gioco</h1><p class="sub">Il modello di gioco guida l'assistente: ogni esercizio viene progettato per allenare questi principi.</p></div><button class="btn pri" data-act="teamSave">Salva</button></div>
  ${window.TM_CLOUD?window.TM_CLOUD.card():''}
  <div class="card stack"><h2>Squadra e calendario</h2>
    <div class="fgrid"><label class="f"><span>Nome squadra</span><input type="text" id="tNome" value="${esc(t.nome)}"></label><label class="f"><span>Categoria</span><input type="text" id="tCat" value="${esc(t.categoria)}"></label>
      <label class="f"><span>Livello</span><select id="tLiv">${['Professionisti','Semiprofessionisti','Dilettanti','Settore giovanile agonistico','Settore giovanile di base'].map(x=>`<option ${t.livello===x?'selected':''}>${x}</option>`).join('')}</select></label>
      <label class="f"><span>Giorno partita</span><select id="tMD">${DAYS_FULL.map((d,i)=>`<option value="${i}" ${Number(t.matchDay)===i?'selected':''}>${d}</option>`).join('')}</select></label>
      <label class="f"><span>Durata seduta (min)</span><input type="number" id="tDur" value="${esc(t.durata)}"></label>
      <label class="f"><span>Partita finale (min minimi)</span><input type="number" id="tFin" min="0" max="45" value="${esc(t.partitaFinale??15)}"></label>
      <label class="f"><span>Attivazione iniziale (min)</span><input type="number" id="tAtt" min="0" max="25" value="${esc(t.attivazione??10)}"></label>
      <label class="f"><span>Preparatore portieri</span><select id="tGk">${[['sempre','Sempre presente'],['a volte','A volte'],['mai','Mai']].map(([v,l])=>`<option value="${v}" ${(t.prepPortieri||'a volte')===v?'selected':''}>${l}</option>`).join('')}</select></label>
      <label class="f"><span>Preparatore atletico</span><select id="tPA"><option value="no" ${t.prepAtletico!=='si'?'selected':''}>No: il condizionale lo pianifica l’assistente</option><option value="si" ${t.prepAtletico==='si'?'selected':''}>Sì</option></select></label></div>
    <div class="fgrid"><label class="f"><span>Allenatore di riferimento (facoltativo)</span><input type="text" id="tRif" value="${esc(t.allenatoreRif||'')}" placeholder="Es. Roberto De Zerbi"></label>
      <label class="f"><span>Suoi principi che vuoi seguire</span><input type="text" id="tRifP" value="${esc(t.principiRif||'')}" placeholder="Es. costruzione dal basso per attirare la pressione, uomo libero dietro la linea, riaggressione in 5 secondi"></label></div>
    <div class="f"><span class="lbl">Di solito il preparatore dei portieri c’è</span><div class="checks" id="tGkDays" style="margin-top:6px">${(t.giorni||[]).map(d=>`<label><input type="checkbox" value="${d}" ${(t.gkDays||[]).map(Number).includes(d)?'checked':''}>${DAYS_FULL[d]}</label>`).join('')||'<span class="muted">Imposta prima i giorni di allenamento</span>'}</div><span class="muted" style="font-size:.82rem">Ogni settimana puoi cambiarlo quando progetti con l’AI. Nei giorni senza preparatore i portieri sono coinvolti in tutti gli esercizi.</span></div>
    <p class="muted" style="font-size:.85rem">In campo sei da solo: l’assistente non propone lavori differenziati o gruppi separati e organizza le sedute per ridurre i tempi morti.</p>
    <div class="f"><span class="lbl">Giorni e orari di allenamento</span><div class="checks" id="tGiorni" style="margin-top:6px">${DAYS_FULL.map((d,i)=>`<label><input type="checkbox" value="${i}" ${(t.giorni||[]).includes(i)?'checked':''}>${d} <span class="mono muted">${mdLabel(i,t.matchDay)||''}</span><input type="text" id="tOra${i}" value="${esc(ora(i))}" placeholder="ora" aria-label="Orario ${d}" style="width:64px;padding:2px 6px"></label>`).join('')}</div></div>
    <label class="f"><span>Strutture e vincoli</span><input type="text" id="tCampo" value="${esc(t.campo)}"></label>
  </div>
  <details class="card more"><summary><b>Come progetta l’assistente</b> <span class="muted">· metodo e fonti</span></summary><div class="stack" style="margin-top:10px;font-size:.9rem">
    <p><b>Struttura della settimana:</b> Periodizzazione Tattica (morfociclo): tensione, durata e velocità rispetto al giorno partita; carico controllato con sRPE (variazione settimanale entro il 10-15%, monotonia sotto 2).</p>
    <p><b>Contenuti:</b> si parte dalla distanza tra il modello di gioco e quello che la squadra fa oggi, nelle fasi con priorità alta.</p>
    <p><b>Forma degli esercizi:</b> forme di gioco con avversari e decisioni (apprendimento rappresentativo); vincoli scelti per l’effetto che producono: numeri e spazi sono i più incisivi, poi forma del campo, tocchi, superiorità o jolly, tipo di porte, punteggi, fuorigioco. Ogni esercizio dichiara i suoi vincoli e l’effetto atteso.</p>
    <p><b>Spazi:</b> m² per giocatore per tipo di lavoro (tabella qui sotto).</p>
    <p class="muted">Fonti principali: revisioni sistematiche sui giochi a campo ridotto (Sarmento et al. 2018; Ometto et al. 2018 sui vincoli e il comportamento tattico; revisione recente sulla limitazione dei tocchi; meta-analisi 2023 sulle dimensioni del campo); Riboli et al. 2020 e 2022 sullo spazio per giocatore; letteratura sull’apprendimento rappresentativo e sui comportamenti degli allenatori nei settori giovanili. Le evidenze vengono in gran parte da squadre d’élite e da studi piccoli: sono una guida, non regole assolute.</p>
  </div></details>
  <div class="card stack"><h2>Spazio per giocatore</h2><p class="muted" style="font-size:.9rem">Intervalli in m² per giocatore (area del campo divisa per i giocatori in campo, portieri inclusi). L’assistente li rispetta e ogni esercizio mostra il valore calcolato, in giallo se è fuori intervallo.</p>
    <div class="tbl"><table><thead><tr><th>Tipo di lavoro</th><th>Min</th><th>Max</th><th>Riferimento</th></tr></thead><tbody>${APP_TYPES.map(([k,l,ref])=>{const r=appRanges()[k];return `<tr><td>${esc(l)}</td><td><input type="number" id="app_${k}_0" value="${r[0]}" style="width:72px" aria-label="Minimo ${esc(l)}"></td><td><input type="number" id="app_${k}_1" value="${r[1]}" style="width:72px" aria-label="Massimo ${esc(l)}"></td><td class="muted" style="font-size:.82rem">${esc(ref)}</td></tr>`}).join('')}</tbody></table></div>
  </div>
  <div class="card stack"><h2>Come imposto i giorni</h2><p class="muted" style="font-size:.9rem">Il tuo stile per ogni giorno di allenamento, al di là dei contenuti tecnico-tattici: intensità, clima, tipo di esercizi. L’assistente lo rispetta quando progetta.</p>
    ${(t.giorni||[]).map(d=>`<label class="f"><span>${DAYS_FULL[d]} <span class="mono">${mdLabel(d,t.matchDay)||''}</span></span><input type="text" id="sg_${d}" value="${esc((t.stileGiorni||{})[d]||'')}" placeholder="${d===(t.giorni||[])[0]?'Es. si va forte per tutto l’allenamento, 4c4 a campo ridotto con cambio squadre ogni minuto':'Es. seduta più cognitiva, regole che cambiano, decisioni rapide'}"></label>`).join('')}
  </div>
  <div class="card stack"><h2>Sistemi di gioco</h2><p class="muted" style="font-size:.9rem">Se ne portate avanti più di uno, l’assistente distribuisce il lavoro tra i sistemi e indica per ogni esercizio quale allena.</p>
    ${[0,1,2].map(i=>{const x=sistemi()[i]||{};return `<div class="fgrid" style="grid-template-columns:minmax(120px,160px) minmax(0,1fr) minmax(140px,180px)"><label class="f"><span>Sistema ${i+1}</span><input type="text" id="sis_n_${i}" value="${esc(x.nome)}" placeholder="${i===2?'(facoltativo)':'Es. 1-4-2-3-1'}"></label><label class="f"><span>Quando lo usiamo</span><input type="text" id="sis_u_${i}" value="${esc(x.uso)}" placeholder="Es. sistema base / contro squadre a due punte / per rimontare"></label><label class="f"><span>A che punto siamo</span><select id="sis_s_${i}">${STATI_SIS.map(([v,l])=>`<option value="${v}" ${(x.stato||'in costruzione')===v?'selected':''}>${l}</option>`).join('')}</select></label></div>`}).join('')}
  </div>
  <div class="card stack"><div class="row" style="justify-content:space-between"><h2>Modello di gioco</h2>${S.sample?`<button class="btn ai sm" data-act="realtaAi" ${S.realtaBusy?'disabled':''}>${S.realtaBusy?'Sto leggendo le analisi…':'Compila “oggi” dalle analisi delle partite'}</button>`:''}</div>
    <p class="muted" style="font-size:.9rem">Per ogni fase scrivi come vuoi che giochi la squadra e cosa fa davvero oggi. L’assistente progetta le settimane per ridurre la distanza tra le due cose, partendo dalle fasi con priorità alta.</p>
    ${FASI_GIOCO.map(([k,l,ph1,ph2])=>`<div class="fase-g"><div class="row" style="justify-content:space-between"><h3>${l}</h3><label class="row" style="gap:6px;font-size:.85rem"><span class="muted">Priorità</span><select id="pr_${k}" style="width:auto">${[['alta','Alta'],['media','Media'],['bassa','Bassa']].map(([v,n])=>`<option value="${v}" ${(t.priorita||{})[k]===v||(!(t.priorita||{})[k]&&v==='media')?'selected':''}>${n}</option>`).join('')}</select></label></div>
      <div class="fgrid" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">${fld('mo_'+k,'Come voglio che giochi',pr[k],ph1)}${fld('re_'+k,'Cosa fa oggi la squadra',(t.realta||{})[k],ph2)}</div></div>`).join('')}
    ${fld('tNote','Note per l’assistente',t.note,'Caratteristiche del gruppo, vincoli, cose da sapere.')}
  </div>
  <div class="row"><button class="btn pri" data-act="teamSave">Salva</button></div>`;
}

/* ===== Assistente (pannello laterale) ===== */
function mdLite(t){const lines=esc(t).split('\n');let out='',inList=false;
  for(let l of lines){l=l.replace(/\*\*(.+?)\*\*/g,'<b>$1</b>');const m=l.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)/);const h=l.match(/^#{1,4}\s+(.*)/);
    if(m){if(!inList){out+='<ul>';inList=true}out+='<li>'+m[1]+'</li>';continue}
    if(inList){out+='</ul>';inList=false}
    if(h)out+='<p><b>'+h[1]+'</b></p>';else if(l.trim())out+='<p>'+l+'</p>'}
  if(inList)out+='</ul>';return out}
const SUGG=['Chi ha meno presenze e come lo gestisco?','Come preparo la partita di sabato contro il prossimo avversario?','Proponi un esercizio sulla transizione negativa','Il carico delle ultime settimane è equilibrato?','Prepara il discorso pre-partita in 5 punti'];
function renderChat(){
  const dr=document.getElementById('drawer');dr.hidden=!S.chatOpen;document.getElementById('fab').hidden=S.chatOpen;
  if(!S.chatOpen)return;
  const b=document.getElementById('chatBody');
  b.innerHTML=(!S.sample?'<div class="banner">L’assistente non è disponibile in questa vista. Apri la pagina su claude.ai con il tuo account.</div>':'')+
    (S.chat.length?S.chat.map(m=>`<div class="msg ${m.role==='user'?'u':'a'}">${m.role==='user'?esc(m.content).replace(/\n/g,'<br>'):mdLite(m.content||'…')}</div>`).join(''):`<p class="muted" style="font-size:.9rem">Conosce rosa, risultati, classifica, carichi e la settimana in corso.</p><div class="chips">${SUGG.map((s,i)=>`<button class="chip" data-act="sugg" data-i="${i}">${esc(s)}</button>`).join('')}</div>`);
  const lastA=[...b.querySelectorAll('.msg.a')].pop();if(lastA&&!S.chatBusy&&S.chat.length&&S.chat[S.chat.length-1].content){const bt=document.createElement('div');bt.className='row';bt.style.marginTop='-4px';bt.innerHTML='<button class="btn sm" data-act="saveIdea">Salva come idea tattica della partita</button>';lastA.after(bt)}
  const btn=document.getElementById('chatSendBtn');btn.disabled=S.chatBusy||!S.sample;btn.textContent=S.chatBusy?'…':'Invia';
  document.getElementById('chatClear').hidden=!S.chat.length;
  if(S.chatScroll){b.scrollTop=b.scrollHeight;S.chatScroll=false}
}
async function chatSend(text){
  text=(text||'').trim();if(!text||S.chatBusy||!S.sample)return;
  S.chat.push({role:'user',content:text});S.chat.push({role:'assistant',content:''});S.chatBusy=true;S.chatScroll=true;renderChat();
  const cw=getWeek(iso(mondayOf(new Date())));
  const ctx=`Sei il collaboratore tecnico di un allenatore di calcio italiano. Rispondi in italiano, in modo pratico e conciso, con proposte concrete (esercizi con spazi, numeri, tempi e recuperi; carico in UA quando utile).
${staffRule(cw)}
${condRule()}
${appRule()}
${designRule()}
${dayRule(team().giorni||[])}
${groupRule(cw)}
${METODO}

${teamContext()}
SETTIMANA IN CORSO: obiettivo "${cw.obiettivo||'-'}", sistema per la partita ${cw.sistemaPartita||'da decidere'}, sistema dell'avversario ${cw.sistemaAvversario||'non indicato'}, idea tattica: ${cw.ideaPartita||'non ancora definita'}, formazione: ${cw.formazione&&cw.formazione.slots?cw.formazione.slots.map(id=>{const p=S.players.find(x=>x.id===id);return p?cognome(p):''}).filter(Boolean).join(', '):'non definita'}, partita ${matchDayOf(cw)!=null&&matchDayOf(cw)!==''?DAYS_FULL[matchDayOf(cw)]:'nessuna'}${cw.avversario?' vs '+cw.avversario:''}; sedute: ${(cw.sessioni||[]).map(s=>`${DAYS[s.giorno]} ${s.md} ${s.titolo} (${s.durata}' RPE ${s.rpe}${s.done?', svolta, RPE reale '+(s.rpeReale??'-')+', presenti '+(s.presenti?s.presenti.length:'-'):''}): ${(s.esercizi||[]).map(e=>e.nome).join(', ')}`).join(' | ')||'nessuna'}
${prevWeekSummary(iso(mondayOf(new Date())))}
PRESENZE: ${S.players.map(p=>{const a=attendance(p.id);return a?p.nome+' '+a.pct+'%':null}).filter(Boolean).join(', ')||'non ancora registrate'}
CARICO ULTIME 6 SETTIMANE (pianificato/rilevato UA): ${[5,4,3,2,1,0].map(i=>{const id=iso(addDays(mondayOf(new Date()),-7*i));const w=getWeek(id);return id+': '+dailyLoads(w,team(),false).reduce((a,b)=>a+b,0)+'/'+dailyLoads(w,team(),true).reduce((a,b)=>a+b,0)}).join('; ')}
Oggi è ${DAYS_FULL[(new Date().getDay()+6)%7]} ${todayIso()}.`;
  const msgs=S.chat.slice(0,-1).map((m,i)=>({role:m.role,content:i===0?ctx+'\n\nDOMANDA DEL MISTER: '+m.content:m.content}));
  const target=S.chat[S.chat.length-1];
  try{const r=await S.sample(msgs,{modelTier:'default',cache:false,onText:({text})=>{target.content=text;const els=document.querySelectorAll('#chatBody .msg.a');const el=els[els.length-1];if(el)el.innerHTML=mdLite(text);const b=document.getElementById('chatBody');if(b)b.scrollTop=b.scrollHeight}});target.content=r.text}
  catch(e){target.content=e?.code==='rate_limited'?'Troppe richieste ravvicinate: riprova tra un minuto.':e?.code==='not_granted'?'L’uso dell’assistente non è stato autorizzato per questa pagina.':(e?.text||'Non sono riuscito a rispondere. Riprova.')}
  S.chatBusy=false;S.chatScroll=true;renderChat();
}

/* ===== Azioni ===== */
const closeDlg=()=>{const d=document.getElementById('dlg');if(d.open)d.close();ED=null;DD=null};
const ACT={
  wk:t=>{const d=Number(t.dataset.d);S.weekStart=d===0?iso(mondayOf(new Date())):iso(addDays(parseIso(S.weekStart),d));S.ai=null;render()},
  aiOpen:()=>{S.ai={week:S.weekStart,state:'form'};render();setTimeout(()=>document.getElementById('aiReq')?.focus(),0)},
  aiClose:()=>{S.ai=null;render()},
  aiGen:()=>aiGenerate(),
  aiStop:()=>{S.ai?.ac?.abort();S.ai={week:S.weekStart,state:'form',req:S.ai?.req,days:S.ai?.days};render()},
  aiApply:()=>{const w=getWeek(S.weekStart);const r=S.ai.result;const g=r.sessioni.map(x=>x.giorno);const merged=[...(w.sessioni||[]).filter(x=>!g.includes(x.giorno)),...r.sessioni].sort((a,b)=>a.giorno-b.giorno);saveWeek({...w,sessioni:merged,obiettivo:w.obiettivo||r.obiettivo,note:r.note,generatedBy:'ai'});S.ai=null;toast('Settimana aggiornata');render()},
  tplWeek:()=>{const w=getWeek(S.weekStart);saveWeek({...w,sessioni:templateWeek(w.id,team(),matchDayOf(w)),generatedBy:'template'});toast('Morfociclo applicato')},
  openSess:t=>{S.weekStart=t.dataset.w;openSess(t.dataset.w,Number(t.dataset.i),t.dataset.tab);render()},
  newSess:t=>newSess(Number(t.dataset.d)),
  dlgClose:()=>closeDlg(),
  edTab:t=>{collectEditor();ED.tab=t.dataset.t;drawEditor()},
  exAdd:()=>{collectEditor();ED.s.esercizi.push(normalizeEx({nome:'Nuovo esercizio',durata:15}));drawEditor()},
  exAddLib:()=>{collectEditor();const id=document.getElementById('eLib').value;const d=[...S.drills,...BASE_DRILLS].find(x=>x.id===id);if(!d)return toast('Scegli un esercizio dalla libreria');const c=drillCopy(d);if(S.drills.some(x=>x.id===d.id))c.libId=d.id;ED.s.esercizi.push(c);drawEditor()},
  exDel:t=>{collectEditor();ED.s.esercizi.splice(Number(t.dataset.i),1);drawEditor()},
  exMove:t=>{collectEditor();const i=Number(t.dataset.i),j=i+Number(t.dataset.d);const a=ED.s.esercizi;[a[i],a[j]]=[a[j],a[i]];drawEditor()},
  exAi:()=>exAi(),
  replOpen:t=>{collectEditor();ED.repl={i:Number(t.dataset.i),state:'form'};drawEditor()},
  replClose:()=>{collectEditor();ED.repl=null;drawEditor()},
  replAi:t=>replAi(Number(t.dataset.i)),
  replUse:t=>{collectEditor();const i=Number(t.dataset.i);const old=ED.s.esercizi[i];const x=ED.repl.result;ED.s.esercizi[i]={...x,fase:x.fase||old.fase};ED.repl=null;drawEditor();toast('Esercizio sostituito: ricordati di salvare la seduta')},
  replLib:t=>{collectEditor();const i=Number(t.dataset.i);const id=document.getElementById('replLib').value;const d=[...S.drills,...BASE_DRILLS].find(x=>x.id===id);if(!d)return toast('Scegli un esercizio dalla libreria');const old=ED.s.esercizi[i];const c=drillCopy(d);c.durata=old.durata;c.fase=old.fase;if(S.drills.some(x=>x.id===d.id))c.libId=d.id;ED.s.esercizi[i]=c;ED.repl=null;drawEditor();toast('Esercizio sostituito: ricordati di salvare la seduta')},
  boardSess:t=>{const i=Number(t.dataset.i);if(ED.tab==='scheda'){const e=ED.s.esercizi[i];openBoard(schemaOf(e),{title:e.nome,ctx:e,readOnly:true,onEdit:()=>boardForSessionExercise(i)})}else boardForSessionExercise(i)},
  teamsPropose:()=>{const k=Number(document.getElementById('teamsN')?.value||ED.s.squadreSeduta?.n||2);ED.s.squadreSeduta=proposeSessionTeams(ED.s,getWeek(ED.wid),k);ED.teamsEdit=false;persistED();drawEditor()},
  teamsEdit:()=>{ED.teamsEdit=true;drawEditor()},
  teamsDone:()=>{ED.teamsEdit=false;persistED();drawEditor();toast('Squadre salvate')},
  teamsClear:()=>{delete ED.s.squadreSeduta;persistED();drawEditor()},
  sessPdf:()=>exportPdf(),
  sessPdfField:()=>exportPdfField(),
  stAdd:t=>{collectEditor();const e=ED.s.esercizi[Number(t.dataset.i)];e.step=e.step||[];e.step.push({titolo:'',giocatori:'',descrizione:''});drawEditor()},
  stDel:t=>{collectEditor();const e=ED.s.esercizi[Number(t.dataset.i)];e.step.splice(Number(t.dataset.k),1);if(!e.step.length)delete e.step;drawEditor()},
  stBoard:t=>{collectEditor();const i=Number(t.dataset.i),k=Number(t.dataset.k);const e=ED.s.esercizi[i];const st=e.step[k];openBoard(st.schema||schemaOf(e),{title:e.nome+' · step '+(k+1),ctx:{...e,nome:e.nome+' step '+(k+1)+': '+st.titolo,giocatori:st.giocatori||e.giocatori,descrizione:st.descrizione},onSave:sc=>{collectEditor();ED.s.esercizi[i].step[k].schema=sc;persistED();drawEditor();toast('Disegno dello step salvato')}})},
  stView:t=>{const e=ED.s.esercizi[Number(t.dataset.i)];const st=e.step[Number(t.dataset.k)];openBoard(st.schema,{title:e.nome+' · step '+(Number(t.dataset.k)+1),ctx:{descrizione:st.descrizione},readOnly:true})},
  teamsTit:()=>{const w=getWeek(ED.wid);if(!w.formazione)return toast('Imposta prima la formazione titolare');ED.s.squadreSeduta=proposeTitolari(ED.s,w);ED.teamsEdit=false;persistED();drawEditor()},
  formOpen:()=>formDialog(),
  formAuto:()=>{const sys=document.getElementById('fSys').value;const res=proposeFormation(sys);document.querySelectorAll('#fSlots [data-slot]').forEach(el=>{el.value=res[Number(el.dataset.slot)]||''})},
  formSave:()=>{const w=getWeek(S.weekStart);const sys=document.getElementById('fSys').value;const slots=[...document.querySelectorAll('#fSlots [data-slot]')].map(el=>el.value);const dup=slots.filter(Boolean).filter((x,i,a)=>a.indexOf(x)!==i);if(dup.length)return toast('Un giocatore è in due ruoli: correggi prima di salvare');saveWeek({...w,formazione:{sistema:sys,slots,creato:todayIso()},sistemaPartita:w.sistemaPartita||sys});closeDlg();toast('Formazione salvata')},
  ideaChat:()=>{const w=getWeek(S.weekStart);const md=matchDayOf(w);S.chatOpen=true;renderChat();chatSend(`Ragioniamo insieme l'idea tattica della partita${md!=null&&md!==''?' di '+DAYS_FULL[md].toLowerCase():''}${w.avversario?' contro '+w.avversario:''}${w.sistemaAvversario?' (giocano con il '+w.sistemaAvversario+')':''}. Partendo dal nostro modello di gioco, dal sistema ${w.sistemaPartita||'che ritieni più adatto'} e dalle caratteristiche dei nostri giocatori, proponimi 4-5 principi chiave per la partita (costruzione, non possesso e direzione della pressione, transizioni, dove attaccarli) e una formazione titolare con i ruoli. Poi chiedimi cosa ne penso.`)},
  saveIdea:()=>{const m=[...S.chat].reverse().find(x=>x.role==='assistant'&&x.content);if(!m)return;const id=iso(mondayOf(new Date()));const w=getWeek(S.route==='settimana'?S.weekStart:id);saveWeek({...w,ideaPartita:m.content.slice(0,3000)});toast('Idea tattica salvata nella settimana')},
  adaptOpen:()=>{ED.adapt={state:'form'};drawEditor()},
  adaptClose:()=>{ED.adapt=null;drawEditor()},
  adaptStop:()=>{ED.adapt?.ac?.abort();ED.adapt={state:'form',m:ED.adapt?.m,p:ED.adapt?.p,req:ED.adapt?.req};drawEditor()},
  adaptGen:()=>adaptGen(),
  adaptApply:()=>{const r=ED.adapt.result;ED.s.esercizi=r.esercizi.map(({_stato,...e})=>e);if(ED.adapt.mode==='libera'){if(r.titolo)ED.s.titolo=r.titolo;if(r.focus)ED.s.focus=r.focus;if(r.rpe)ED.s.rpe=r.rpe;ED.s.durata=ED.s.esercizi.reduce((a,e)=>a+(Number(e.durata)||0),0)||ED.s.durata}const had=!!ED.s.squadreSeduta;if(Array.isArray(ED.adapt.sel)&&S.players.length)ED.s.presenti=ED.adapt.sel.slice();ED.s.adattata={data:todayIso(),presenti:ED.adapt.m+' + '+ED.adapt.p+' P',modifiche:r.modifiche};const sq=ED.s.squadreSeduta;ED.adapt=null;if(had&&sq&&ED.s.presenti){const w=getWeek(ED.wid);ED.s.squadreSeduta=sq.modo==='titolari'&&w.formazione?proposeTitolari(ED.s,w):proposeSessionTeams(ED.s,w,sq.n||2)}persistED();drawEditor();toast(had?'Seduta aggiornata e squadre rifatte con i presenti':'Seduta aggiornata')},
  guestAdd:()=>{const g=id=>document.getElementById(id);const nome=(g('gNome')?.value||'').trim();if(!nome)return toast('Scrivi il nome dell’ospite');const pos1=g('gPos')?.value||'';
    const o={id:'ospite-'+uid(),nome,pos1,posizione:pos1,ruolo:repOf(pos1)||'CEN',piede:g('gPiede')?.value||'',stato:'disponibile',ospite:true};
    ED.s.ospiti=[...(ED.s.ospiti||[]),o];if(Array.isArray(ED.s.presenti))ED.s.presenti=[...ED.s.presenti,o.id];if(ED.adapt&&Array.isArray(ED.adapt.sel))ED.adapt.sel.push(o.id);
    persistED();drawEditor();toast(nome+' aggiunto alla seduta'+(ED.s.esercizi&&ED.s.esercizi.length&&S.sample?': usa “Adatta ai presenti” per rifare numeri e disegni':''))},
  guestDel:t=>{const id=t.dataset.id;ED.s.ospiti=(ED.s.ospiti||[]).filter(g=>g.id!==id);if(Array.isArray(ED.s.presenti))ED.s.presenti=ED.s.presenti.filter(x=>x!==id);if(ED.adapt&&Array.isArray(ED.adapt.sel))ED.adapt.sel=ED.adapt.sel.filter(x=>x!==id);
    const T=ED.s.squadreSeduta;if(T&&Array.isArray(T.squadre))T.squadre.forEach(q=>{['ids','portieri'].forEach(k=>{if(Array.isArray(q[k]))q[k]=q[k].filter(x=>x!==id)});if(q.sub)Object.keys(q.sub).forEach(k=>{if(Array.isArray(q.sub[k]))q.sub[k]=q.sub[k].filter(x=>x!==id)})});
    persistED();drawEditor()},
  presAll:t=>{document.querySelectorAll('#presList input').forEach(i=>i.checked=t.dataset.v==='1');updPres()},
  sessSave:()=>{collectEditor();const n=saveToLibrary();persistED();closeDlg();toast(n?`Seduta salvata, ${n} esercizi in libreria`:'Seduta salvata')},
  sessDel:()=>{const w=getWeek(ED.wid);const ss=[...w.sessioni];ss.splice(ED.idx,1);saveWeek({...w,sessioni:ss});closeDlg();toast('Seduta eliminata')},
  rosaF:t=>{S.rosaFilter=t.dataset.k;render()},
  plEdit:t=>plDialog(t.dataset.id),
  plSave:t=>{const g=id=>document.getElementById(id).value;const nome=g('pNome').trim();if(!nome)return toast('Inserisci il nome del giocatore');const id=t.dataset.id||uid();const old=S.players.find(x=>x.id===id)||{};const pos1=g('pPos1'),pos2=g('pPos2');const p={...old,nome,nascita:g('pNasc'),ruolo:repOf(pos1)||g('pRuolo'),pos1,pos2,sottoruolo:g('pSub').trim(),posizione:pos1?pos1+(pos2?' (alt. '+pos2.toLowerCase()+')':''):(old.posizione||''),piede:g('pPiede'),stato:g('pStato'),rientro:g('pRientro'),note:g('pNote')};markReturn(p,old.stato,p.stato);delete p.id;
    const i=S.players.findIndex(x=>x.id===id);if(i>=0)S.players[i]={...p,id};else S.players.push({...p,id});put('giocatori',id,p);closeDlg();toast('Giocatore salvato');render()},
  plNoReturn:t=>{const p=S.players.find(x=>x.id===t.dataset.id);if(!p)return;delete p.rientratoIl;delete p.rientratoDa;const {id,...rest}=p;put('giocatori',id,{...rest,rientratoIl:null,rientratoDa:null});closeDlg();render();toast(cogNome(p)+': tolta la segnalazione di rientro')},
  plDel:t=>{S.players=S.players.filter(p=>p.id!==t.dataset.id);del('giocatori',t.dataset.id);closeDlg();render()},
  mEdit:t=>mDialog(t.dataset.id),
  mSave:t=>{const g=id=>document.getElementById(id).value;if(!g('mAvv').trim()||!g('mData'))return toast('Inserisci data e avversario');const id=t.dataset.id||uid();const old=S.matches.find(x=>x.id===id)||{};
    const gf=g('mGF'),gs=g('mGS');const m={...old,data:g('mData'),ora:g('mOra'),giornata:g('mGiorn'),luogo:g('mLuogo'),avversario:g('mAvv').trim(),competizione:g('mComp'),casa:g('mCasa')==='1',giocata:g('mGioc')==='1'||(gf!==''&&gs!==''),golFatti:gf,golSubiti:gs,analisi:g('mAn')};delete m.id;
    const i=S.matches.findIndex(x=>x.id===id);if(i>=0)S.matches[i]={...m,id};else S.matches.push({...m,id});put('partite',id,m);
    const wid=iso(mondayOf(parseIso(m.data)));const w=getWeek(wid);if(!m.giocata&&!w.avversario){saveWeek({...w,avversario:m.avversario,matchDay:(parseIso(m.data).getDay()+6)%7})}
    closeDlg();toast('Partita salvata');render()},
  mDel:t=>{S.matches=S.matches.filter(m=>m.id!==t.dataset.id);del('partite',t.dataset.id);closeDlg();render()},
  libF:t=>{S.libCat=t.dataset.k;render()},
  dView:t=>{const d=[...S.drills.map(x=>({...x,mine:true})),...BASE_DRILLS].find(x=>x.id===t.dataset.id);if(!d)return;
    if(d.mine)openBoard(schemaOf(d),{title:d.nome,ctx:d,readOnly:true,onEdit:()=>openBoard(schemaOf(d),{title:d.nome,ctx:d,onSave:sc=>{const {mine,id,...rest}=d;const nd={...rest,schema:sc};const i=S.drills.findIndex(x=>x.id===id);if(i>=0)S.drills[i]={...nd,id};put('esercizi',id,nd);toast('Disegno salvato');render()}})});
    else openBoard(schemaOf(d),{title:d.nome,ctx:d,readOnly:true,onEdit:()=>openBoard(schemaOf(d),{title:d.nome+' (copia)',ctx:d,onSave:sc=>{const {id,...rest}=d;const nid=uid();const nd={...rest,nome:d.nome,schema:sc};S.drills.unshift({...nd,id:nid});put('esercizi',nid,nd);toast('Copia salvata tra i tuoi esercizi');render()}})})},
  dEdit:t=>dDialog(t.dataset.id),
  ddBoard:()=>{const f=ddForm();openBoard(DD.schema||autoSchema(f),{title:f.nome||'Nuovo esercizio',ctx:f,onSave:sc=>{DD.schema=sc;ddThumb()}})},
  dSave:t=>{const f=ddForm();if(!f.nome)return toast('Inserisci il nome');const id=t.dataset.id||uid();const d={...f};if(DD&&DD.schema)d.schema=DD.schema;
    const i=S.drills.findIndex(x=>x.id===id);if(i>=0)S.drills[i]={...d,id};else S.drills.unshift({...d,id});put('esercizi',id,d);closeDlg();toast('Esercizio salvato');render()},
  dDel:t=>{S.drills=S.drills.filter(d=>d.id!==t.dataset.id);del('esercizi',t.dataset.id);closeDlg();render()},
  dAi:async()=>{const req=(document.getElementById('dAiReq')?.value||'').trim();if(!req)return toast('Descrivi l’esercizio che ti serve');S.dBusy=true;render();
    try{const r=await S.sample.json(`Sei il collaboratore tecnico di un allenatore di calcio. Crea UN esercizio di allenamento.
${METODO}
${teamContext()}
Richiesta: ${req}
${SCHEMA_SPEC}
Rispondi SOLO con JSON: {"nome":"","cat":"${Object.keys(CATS).join('|')}","fase":"iniziale|centrale|condizionale|finale","durata":15,"spazio":"","giocatori":"","descrizione":"regole, blocchi e recuperi","principio":"","coaching":"punti chiave","organizzazione":"preparazione campo, palloni, posizione allenatore","condizionale":"obiettivo fisico e parametri","vincoli":"regole usate e effetto atteso","sistema":"nome del sistema o entrambi","step":[{"titolo":"","giocatori":"","descrizione":""}],"schema":{...}}
${sisRule(null)}
${staffRule(null)}`,{modelTier:'default'});
      const e=normalizeEx(r);const d={...e,cat:CATS[r?.cat]?r.cat:'tensione'};const id=uid();S.drills.unshift({...d,id});put('esercizi',id,d);const ta=document.getElementById('dAiReq');if(ta)ta.value='';S.libCat='miei';toast('Esercizio salvato tra i tuoi')}
    catch(e){toast(e?.code==='rate_limited'?'Troppe richieste: riprova tra poco':'Creazione non riuscita')}
    S.dBusy=false;render()},
  teamSave:()=>{const g=id=>document.getElementById(id).value;const giorni=[...document.querySelectorAll('#tGiorni input[type=checkbox]:checked')].map(i=>Number(i.value));
    const orari={};giorni.forEach(d=>{const v=g('tOra'+d).trim();if(v)orari[d]=v});
    const t={...team(),orari,nome:g('tNome')||'La mia squadra',categoria:g('tCat'),livello:g('tLiv'),sistemi:[0,1,2].map(i=>({nome:g('sis_n_'+i).trim(),uso:g('sis_u_'+i).trim(),stato:g('sis_s_'+i)})).filter(x=>x.nome),sistema:[0,1,2].map(i=>g('sis_n_'+i).trim()).filter(Boolean).join(' / '),matchDay:Number(g('tMD')),durata:Number(g('tDur'))||90,attivazione:Math.max(0,Number(g('tAtt'))||0),allenatoreRif:(g('tRif')||'').trim(),principiRif:(g('tRifP')||'').trim(),partitaFinale:Math.max(0,Number(g('tFin'))||0),app:Object.fromEntries(APP_TYPES.map(([k])=>[k,[Number(g('app_'+k+'_0'))||APP_DEF[k][0],Number(g('app_'+k+'_1'))||APP_DEF[k][1]]])),prepPortieri:g('tGk'),prepAtletico:g('tPA'),gkDays:[...document.querySelectorAll('#tGkDays input:checked')].map(i=>Number(i.value)),stileGiorni:Object.fromEntries((team().giorni||[]).map(d=>[d,(document.getElementById('sg_'+d)?.value||'').trim()]).filter(x=>x[1])),giorni,sedute:giorni.length,campo:g('tCampo'),note:g('tNote'),
      principi:Object.fromEntries(FASI_GIOCO.map(([k])=>[k,g('mo_'+k)])),realta:Object.fromEntries(FASI_GIOCO.map(([k])=>[k,g('re_'+k)])),priorita:Object.fromEntries(FASI_GIOCO.map(([k])=>[k,g('pr_'+k)]))};
    S.team=t;put('squadra','info',t);toast('Impostazioni salvate');render()},
  realtaAi:async()=>{const played=S.matches.filter(m=>m.analisi&&(m.giocata||m.data<todayIso())).sort((a,b)=>a.data<b.data?-1:1);
    if(!played.length)return toast('Scrivi prima l’analisi di almeno una partita (Squadra › Partite)');
    S.realtaBusy=true;render();
    try{const t=team();const r=await S.sample.json(`Sei il match analyst di una squadra di calcio. Dalle analisi delle partite scritte dall'allenatore descrivi in modo concreto e sintetico (2-3 frasi per fase) come si comporta OGGI la squadra in ogni fase di gioco, confrontandolo con il modello voluto. Non inventare: se le analisi non dicono nulla su una fase, rispondi con stringa vuota.
MODELLO VOLUTO: ${FASI_GIOCO.map(([k,l])=>l+': '+((t.principi||{})[k]||'-')).join(' | ')}
ANALISI DELLE PARTITE: ${played.map(m=>`${m.data} vs ${m.avversario} ${m.golFatti??''}-${m.golSubiti??''}: ${m.analisi}`).join('\n')}
Rispondi SOLO con JSON: {"offensiva":"","difensiva":"","transPos":"","transNeg":"","inattive":""}`,{modelTier:'default'});
      let n=0;FASI_GIOCO.forEach(([k])=>{const el=document.getElementById('re_'+k);if(el&&!el.value.trim()&&r&&typeof r[k]==='string'&&r[k].trim()){el.value=r[k].trim();el.dataset.keep='1';n++}});
      toast(n?`Compilati ${n} campi: controllali e salva`:'Nessun campo vuoto da compilare dalle analisi')}
    catch(e){toast(e?.code==='rate_limited'?'Troppe richieste: riprova tra poco':'Lettura non riuscita, riprova')}
    S.realtaBusy=false;render()},
  chatOpen:()=>{S.chatOpen=true;S.chatScroll=true;renderChat();setTimeout(()=>document.getElementById('chatIn')?.focus(),0)},
  chatClose:()=>{S.chatOpen=false;renderChat();document.getElementById('fab').focus()},
  sugg:t=>chatSend(SUGG[Number(t.dataset.i)]),
  chatSend:()=>{const el=document.getElementById('chatIn');const v=el.value;el.value='';chatSend(v)},
  chatClear:()=>{S.chat=[];renderChat()},
  bdTool:t=>{BD.tool=t.dataset.k;BD.sel=null;document.querySelectorAll('#bdTools button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.k===BD.tool));drawBoard()},
  bdUndo:()=>{const h=BD.hist.pop();if(h){BD.sc=JSON.parse(h);BD.sel=null;drawBoard()}},
  bdClear:()=>{bdPush();BD.sc.el=[];BD.sel=null;drawBoard()},
  bdAi:()=>bdAi(),
  bdClose:()=>{const b=document.getElementById('board');if(b.open)b.close();BD=null},
  bdSave:()=>{const sc=normalizeSchema(BD.sc);const fn=BD.onSave;document.getElementById('board').close();BD=null;fn&&fn(sc)},
  bdEdit:()=>{const fn=BD.onEdit;document.getElementById('board').close();BD=null;fn&&fn()}
};
function updPres(){const l=document.getElementById('presList');const c=document.getElementById('presCount');if(l&&c)c.textContent=l.querySelectorAll('input:checked').length+' / '+l.querySelectorAll('input').length}
document.addEventListener('click',e=>{
  const t=e.target.closest('[data-act]');if(!t||t.disabled)return;
  if(t.dataset.confirm&&!t.classList.contains('armed')){e.preventDefault();t.classList.add('armed');t.dataset.orig=t.textContent;t.textContent=t.dataset.confirm;setTimeout(()=>{if(t.isConnected){t.classList.remove('armed');t.textContent=t.dataset.orig}},4000);return}
  const fn=ACT[t.dataset.act]||(window.TM_CLOUD&&String(t.dataset.act).startsWith('cloud')?(x=>window.TM_CLOUD.act(x)):null);if(fn){if(t.tagName!=='A')e.preventDefault();fn(t,e)}
});
document.addEventListener('change',e=>{
  const t=e.target;
  if(t.closest('#presList'))return updPres();
  if(t.id==='bdCampo'&&BD){bdPush();const k=t.value;const F=FIELDS[k];BD.sc.campo=k;if(k!=='rett'){BD.sc.w=F.w;BD.sc.h=F.h}document.getElementById('bdDims').hidden=k!=='rett';document.getElementById('bdW').value=BD.sc.w;document.getElementById('bdH').value=BD.sc.h;drawBoard();return}
  if((t.id==='bdW'||t.id==='bdH')&&BD){bdPush();const v=Number(t.value);if(v>0){if(t.id==='bdW')BD.sc.w=Math.min(110,v);else BD.sc.h=Math.min(75,v)}drawBoard();return}
  if(['dNome','dSpazio','dGioc'].includes(t.id))ddThumb();
  const a=t.dataset.actChange;if(!a)return;
  if(a==='weekField'){const w=getWeek(S.weekStart);let v=t.value;const k=t.dataset.k;
    if(k==='matchDay'){v=v===''?null:Number(v);const ss=(w.sessioni||[]).map(s=>({...s,md:mdLabel(s.giorno,v)}));saveWeek({...w,matchDay:v,sessioni:ss});return}
    if(k==='rpePartita')v=v===''?null:Number(v);
    saveWeek({...w,[k]:v})}
  if((a==='tmTeam'||a==='tmSub')&&ED&&ED.s.squadreSeduta){const T=ED.s.squadreSeduta;const pid=t.dataset.pid;const p=allPl().find(x=>x.id===pid);const row=t.closest('.row');const teamSel=row.querySelector('[data-act-change=tmTeam]');const subSel=row.querySelector('[data-act-change=tmSub]');
    T.squadre.forEach(x=>{x.ids=x.ids.filter(i=>i!==pid);x.sub.A=x.sub.A.filter(i=>i!==pid);x.sub.B=x.sub.B.filter(i=>i!==pid);x.portieri=(x.portieri||[]).filter(i=>i!==pid)});
    const k=Number(teamSel.value);if(k>=0){const tm=T.squadre[k];if(p&&p.ruolo==='POR')tm.portieri.push(pid);else{tm.ids.push(pid);tm.sub[subSel?subSel.value:'A'].push(pid)}}return}
  if(a==='exMode'&&ED){ED.s.esercizi[Number(t.dataset.i)].modoSquadre=t.value;persistED();drawEditor();return}
  if(t.id==='pPos1'){const r=repOf(t.value);const sel=document.getElementById('pRuolo');if(r&&sel)sel.value=r;return}
  if(a==='adSel'){if(ED&&ED.adapt){const l=document.getElementById('adList');ED.adapt.sel=[...l.querySelectorAll('input:checked')].map(x=>x.value);const c=adaptCounts(ED.adapt.sel);const el=document.getElementById('adCount');if(el)el.innerHTML=`<b>${c.m}</b> di movimento + <b>${c.p}</b> portieri`}return}
  if(a==='plStato'){const p=S.players.find(x=>x.id===t.dataset.id);if(p){markReturn(p,p.stato,t.value);p.stato=t.value;const {id,...rest}=p;put('giocatori',id,rest);render()}}
});
document.addEventListener('keydown',e=>{
  if(e.key==='Enter'&&!e.shiftKey&&e.target.id==='chatIn'){e.preventDefault();ACT.chatSend()}
  if(BD&&!BD.ro&&BD.sel!=null&&(e.key==='Delete'||e.key==='Backspace')&&!/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)){e.preventDefault();bdPush();BD.sc.el.splice(BD.sel,1);BD.sel=null;drawBoard()}
  if(e.key==='Escape'&&S.chatOpen&&!document.querySelector('dialog[open]')){ACT.chatClose()}
});
const bw=document.getElementById('board');
bw.addEventListener('pointerdown',e=>{if(e.target.closest('#bdWrap'))bdDown(e)});
bw.addEventListener('pointermove',e=>{if(BD&&BD.drag)bdMove(e)});
bw.addEventListener('pointerup',()=>bdUp());
bw.addEventListener('pointercancel',()=>bdUp());
bw.addEventListener('close',()=>{if(!bw.open)BD=null});
document.getElementById('dlg').addEventListener('close',e=>{if(!e.target.open){ED=null;DD=null}});
readHash();boot();
