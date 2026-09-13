(()=>{
const $=id=>document.getElementById(id);
const sessionStudents=g=>{
  if(!g)return[];
  g.sessions=g.sessions||[];
  const s=g.sessions.find(x=>x.id===db.activeSession);
  return s?s.students:[];
};
function migrate(){
  db.groups.forEach(g=>{g.sessions=g.sessions||[];g.students=g.students||[]});
  save();
}
function pickGroup(){
  if(!db.groups.filter(g=>!g.archived).length){
    const name=prompt('Nom du nouveau groupe (ex. Lundi 14h-16h)');
    if(!name)return null;
    const g={id:uid(),name,archived:false,students:[],sessions:[]};db.groups.push(g);db.active=g.id;save();return g;
  }
  const create=confirm('Créer un nouveau groupe ?\nOK = créer un groupe\nAnnuler = utiliser un groupe existant');
  if(create){
    const name=prompt('Nom du nouveau groupe');if(!name)return null;
    const g={id:uid(),name,archived:false,students:[],sessions:[]};db.groups.push(g);db.active=g.id;save();return g;
  }
  const live=db.groups.filter(g=>!g.archived);
  const menu=live.map((g,i)=>`${i+1}. ${g.name}`).join('\n');
  const n=Number(prompt('Choisis le groupe :\n'+menu, String(Math.max(1,live.findIndex(g=>g.id===db.active)+1))));
  const g=live[n-1];if(!g)return null;db.active=g.id;save();return g;
}
function pickSession(g){
  g.sessions=g.sessions||[];
  if(g.sessions.length){
    const create=confirm(`Groupe : ${g.name}\n\nCréer un nouveau relevé ?\nOK = nouveau relevé\nAnnuler = continuer un relevé existant`);
    if(!create){
      const menu=g.sessions.slice().sort((a,b)=>b.createdAt-a.createdAt).map((s,i)=>`${i+1}. ${s.label}`).join('\n');
      const ordered=g.sessions.slice().sort((a,b)=>b.createdAt-a.createdAt);
      const n=Number(prompt('Choisis le relevé :\n'+menu,'1'));
      const s=ordered[n-1];if(s){db.activeSession=s.id;save();return s}
    }
  }
  const d=new Date(),label=`${d.toLocaleDateString('fr-FR')} · ${d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}`;
  const s={id:uid(),createdAt:Date.now(),label,students:[]};g.sessions.push(s);db.activeSession=s.id;save();return s;
}
function ensureContext(){const g=pickGroup();if(!g)return null;const s=pickSession(g);render();renderSessionBanner();return s}
function renderSessionBanner(){
  const g=db.groups.find(x=>x.id===db.active),s=g?.sessions?.find(x=>x.id===db.activeSession);
  let b=$('sessionBanner');if(!b){b=document.createElement('div');b.id='sessionBanner';b.className='card';const page=$('scan');page?.prepend(b)}
  if(b)b.innerHTML=g&&s?`<strong>${esc(g.name)}</strong><br><span>Relevé : ${esc(s.label)} · ${(s.students||[]).length} élève(s)</span>`:'<strong>Aucun relevé sélectionné</strong>';
}
function normalizeStudent(d){
  return {id:d.studentId,externalId:d.studentId,last:d.last||'Élève',first:d.first||'',classroom:(d.classroom||'').toUpperCase(),sex:d.sex||'',project1:'',project2:'',races:{}};
}
function upsertMaster(g,stu){
  let m=g.students.find(x=>x.externalId===stu.externalId||x.id===stu.id);
  if(!m){m={...stu,races:{}};g.students.push(m)}
  ['last','first','classroom','sex'].forEach(k=>{if(stu[k])m[k]=stu[k]});
}
function newHandleQR(raw){
  let d;try{d=typeof raw==='string'?JSON.parse(raw):raw}catch(e){return scanError('QR illisible ou format inconnu.')}
  if(!d||!d.studentId||!d.race)return scanError('QR non conforme.');
  let g=db.groups.find(x=>x.id===db.active),s=g?.sessions?.find(x=>x.id===db.activeSession);
  if(!g||!s){s=ensureContext();g=db.groups.find(x=>x.id===db.active);if(!s||!g)return scanError('Sélection du groupe annulée.')}
  const race=Number(d.race);if(![1,2].includes(race))return scanError('Numéro de course invalide.');
  let stu=s.students.find(x=>x.externalId===d.studentId||x.id===d.studentId);
  if(!stu){stu=normalizeStudent(d);s.students.push(stu);upsertMaster(g,stu)}
  ['last','first','classroom','sex'].forEach(k=>{if(d[k])stu[k]=k==='classroom'?String(d[k]).toUpperCase():d[k]});
  if(stu.races?.[race]&&!confirm(`${stu.last} ${stu.first} · course ${race} déjà enregistrée. Remplacer ce relevé ?`))return;
  stu.races=stu.races||{};
  stu.races[race]={totalMs:Number(d.totalMs)||0,splits:(d.splits||[]).map(Number),project:d.project||'',scannedAt:Date.now()};
  if(race===1&&d.project)stu.project1=d.project;if(race===2&&d.project)stu.project2=d.project;
  upsertMaster(g,stu);db.history.unshift({at:Date.now(),groupId:g.id,sessionId:s.id,studentId:stu.id,race});save();beep();
  $('scanMessage').className='scan-ok';$('scanMessage').innerHTML=`✓ ${esc(stu.last.toUpperCase())} ${esc(stu.first)}<br>${esc(stu.classroom)} · Course ${race} · ${time(Number(d.totalMs)||0)}`;
  toast(stu.races[1]&&stu.races[2]?'Fiche élève complétée':'Élève créé et résultat enregistré');render();renderSessionBanner();
}
function patchRenderers(){
  renderStudents=function(g){let rows=sorted(sessionStudents(g)).filter(s=>filter==='ALL'||s.classroom===filter);$('students').innerHTML=rows.map(s=>{let sc=score(s);return`<tr data-id="${s.id}"><td><b>${esc(s.last.toUpperCase())} ${esc(s.first)}</b></td><td>${esc(s.classroom)}</td><td>${esc(s.project1||s.races?.[1]?.project||'')}</td><td>${esc(s.project2||s.races?.[2]?.project||'')}</td><td>${time(s.races?.[1]?.totalMs)}</td><td>${time(s.races?.[2]?.totalMs)}</td><td><b>${sc?sc.total.toFixed(2)+'/12':'—'}</b></td></tr>`}).join('')};
  renderResults=function(g){let rows=sorted(sessionStudents(g)).filter(s=>filter==='ALL'||s.classroom===filter);$('resultRows').innerHTML=rows.map(s=>{let sc=score(s),a2=s.afl2??'',a3=s.afl3??'',total=sc&&a2!==''&&a3!==''?Math.min(20,sc.total+Number(a2)+Number(a3)).toFixed(2):'—';return`<tr><td><b>${esc(s.last.toUpperCase())} ${esc(s.first)}</b></td><td>${esc(s.classroom)}</td><td>${time(s.races?.[1]?.totalMs)}</td><td>${time(s.races?.[2]?.totalMs)}</td><td>${sc?time(sc.best):'—'}</td><td>${sc?sc.pp.toFixed(2):'—'}</td><td>${sc?sc.rp.toFixed(2):'—'}</td><td><b>${sc?sc.total.toFixed(2):'—'}</b></td><td><input class="points" data-id="${s.id}" data-k="afl2" type="number" step="0.25" value="${a2}"></td><td><input class="points" data-id="${s.id}" data-k="afl3" type="number" step="0.25" value="${a3}"></td><td><b>${total}</b></td></tr>`}).join('');document.querySelectorAll('.points').forEach(i=>i.onchange=()=>{let st=sessionStudents(g).find(x=>x.id===i.dataset.id);st[i.dataset.k]=i.value===''?'':Number(i.value);save();renderResults(g)})};
}
function init(){migrate();patchRenderers();handleQR=newHandleQR;const read=$('readText');if(read)read.onclick=()=>newHandleQR($('qrText').value.trim());document.querySelectorAll('nav button[data-page="scan"]').forEach(b=>b.addEventListener('click',()=>setTimeout(()=>{ensureContext();renderSessionBanner()},0)));render();renderSessionBanner()}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();