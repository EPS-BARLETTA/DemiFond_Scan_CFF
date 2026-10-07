(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const copy = value => JSON.parse(JSON.stringify(value));
  const html = value => String(value ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const today = () => new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Luxembourg',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const dayOf = value => new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Luxembourg',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value || Date.now()));
  const dayLabel = value => value ? new Date(value + 'T12:00:00').toLocaleDateString('fr-FR') : 'Sans date';
  const protocol = type => ({training:'Entraînement', ccf:'2 × 800 · AFL', exam500:'3 × 500'}[type] || 'Protocole détecté au premier QR');
  const palette = ['#2563eb','#15803d','#a16207','#7c3aed','#0f766e','#be185d','#c2410c','#475569'];
  const classStyle = g => '--class-color:'+palette[(Number(g?.uiColor)||0)%palette.length]+';';
  let mode = 'classes', view = 'classes', classId = null, lessonId = null, currentPage = 'home', target = null;

  function normalizeLessons() {
    db.settings ||= {};
    db.settings.htmlExports ||= {};
    for (const [index, group] of (db.groups || []).entries()) {
      if (!Number.isInteger(group.uiColor) || group.uiColor < 0) group.uiColor=index%palette.length;
      for (const session of group.sessions || []) {
        // Existing evaluations remain separate lessons; their IDs and scores are preserved.
        session.lessonId ||= session.id;
        session.lessonDate ||= dayOf(session.createdAt);
        session.lessonLabel ||= session.label || 'Séance';
        if(session.type==='exam500'&&!session.exam500Bareme&&db.settings.exam500Bareme) session.exam500Bareme=copy(db.settings.exam500Bareme);
      }
    }
  }
  const groupById = id => (db.groups || []).find(g => String(g.id) === String(id));
  const chosenGroup = () => groupById(classId);
  function lessons(group) {
    const out = new Map();
    for (const exercise of group?.sessions || []) {
      const id = exercise.lessonId || exercise.id;
      if (!out.has(id)) out.set(id, {id, date:exercise.lessonDate || dayOf(exercise.createdAt), label:exercise.lessonLabel || exercise.label, exercises:[]});
      out.get(id).exercises.push(exercise);
    }
    return [...out.values()].sort((a,b) => b.date.localeCompare(a.date));
  }
  const chosenLesson = () => lessons(chosenGroup()).find(l => String(l.id) === String(lessonId));
  const rowsFor = (group, lesson) => (db.trainingScans || []).filter(r => String(r.groupId) === String(group.id) && lesson.exercises.some(e => String(e.id) === String(r.sessionId)));
  function stable(value) {
    if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
    if (value && typeof value === 'object') return '{' + Object.keys(value).filter(k => k !== 'htmlExports').sort().map(k => JSON.stringify(k)+':'+stable(value[k])).join(',') + '}';
    return JSON.stringify(value);
  }
  // Compact fingerprints keep HTML tracking small in the iPad's local storage.
  function digest(text) {
    const bytes=new TextEncoder().encode(text), size=Math.ceil((bytes.length+9)/64)*64;
    const data=new Uint8Array(size);data.set(bytes);data[bytes.length]=128;
    const dv=new DataView(data.buffer);dv.setUint32(size-4,bytes.length*8);dv.setUint32(size-8,Math.floor(bytes.length/0x20000000));
    const k=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
    const h=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19], w=new Uint32Array(64), rot=(x,n)=>(x>>>n)|(x<<(32-n));
    for(let offset=0;offset<size;offset+=64) {
      for(let i=0;i<16;i++)w[i]=dv.getUint32(offset+i*4);
      for(let i=16;i<64;i++){const a=w[i-15],b=w[i-2];w[i]=(w[i-16]+(rot(a,7)^rot(a,18)^(a>>>3))+w[i-7]+(rot(b,17)^rot(b,19)^(b>>>10)))>>>0;}
      let [a,b,c,d,e,f,g,j]=h;
      for(let i=0;i<64;i++){const t1=(j+(rot(e,6)^rot(e,11)^rot(e,25))+((e&f)^(~e&g))+k[i]+w[i])>>>0,t2=((rot(a,2)^rot(a,13)^rot(a,22))+((a&b)^(a&c)^(b&c)))>>>0;j=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;}
      [a,b,c,d,e,f,g,j].forEach((v,i)=>h[i]=(h[i]+v)>>>0);
    }
    return h.map(v=>v.toString(16).padStart(8,'0')).join('');
  }
  function snapshot(group, lesson) {
    return digest(stable({className:group.name, classroom:group.classroom || '', date:lesson.date, label:lesson.label, exercises:lesson.exercises, training:rowsFor(group, lesson), settings:db.settings}));
  }
  const stampKey = (group, lesson) => group.id + '/' + lesson.id;
  const backedUp = (group, lesson) => db.settings?.htmlExports?.[stampKey(group, lesson)]?.content === snapshot(group, lesson);
  const badge = (group, lesson) => backedUp(group, lesson) ? '✅ HTML à jour' : '⚠️ À sauvegarder';
  function classBadge(group) {
    const list = lessons(group);
    return list.length && list.every(l => backedUp(group, l)) ? '✅ HTML à jour' : '⚠️ À sauvegarder';
  }
  function activePair() {
    return {group:activeGroup(), exercise:activeSession()};
  }
  function refresh() {
    normalizeLessons();
    const status = $('scanNetworkStatus');
    if (status) status.textContent = (navigator.onLine ? 'En ligne' : 'Hors ligne') + ' · v61';
    const context = $('homeActiveContext');
    if (context) context.textContent = 'Les résultats restent enregistrés sur cet iPad. Le ✅ indique un fichier HTML téléchargé et à jour.';
    $('homeReturn')?.classList.toggle('hidden', currentPage === 'home');
    if (currentPage === 'workflow') renderWorkflow();
    if (currentPage === 'backups') renderBackups();
    if (currentPage === 'scan') renderDestination();
    if (['results','training-results','group'].includes(currentPage)) {
      const {group,exercise}=activePair();
      if(group&&exercise) {
        classId=group.id;lessonId=exercise.lessonId;
        const box=$(currentPage==='training-results'?'trainingResultContext':'examResultContext');
        if(box&&currentPage!=='group') { box.style.cssText=classStyle(group); box.innerHTML=header(group.name+' · '+dayLabel(exercise.lessonDate),exercise.label)+
          '<div class="flow-actions"><button type="button" data-action="return-lesson">← Séance et exercices</button><button type="button" data-action="edit-exercise">Corriger les résultats</button>'+
          '<button type="button" class="flow-scan" data-action="scan-exercise" data-id="'+html(exercise.id)+'" '+(exercise.status==='locked'?'disabled':'')+'>📷 Scanner cet exercice</button>'+
          '<button type="button" class="flow-primary" data-action="save-current-lesson">💾 Sauvegarder la séance en HTML</button>'+
          (exercise.type==='exam500'?'<button type="button" data-action="bareme">⚙️ Barème 3 × 500</button>':'')+'</div>'; }
        if(currentPage==='group') {
          document.querySelector('#group .student-list-card')?.classList.remove('hidden');
          document.querySelectorAll('.session-row').forEach(row=>row.classList.toggle('hidden',String(row.dataset.sessionId)!==String(exercise.id)));
        }
      }
    }
  }
  function goFlow(nextMode, nextView='classes') {
    mode = nextMode; view = nextView; target = null;
    showPage(nextMode === 'backups' ? 'backups' : 'workflow');
  }
  function header(title, subtitle, backAction) {
    return '<div class="workspace-title flow-heading">' + (backAction ? '<button type="button" data-action="'+backAction+'">← Retour</button>' : '') + '<div><h2>'+html(title)+'</h2><p>'+html(subtitle)+'</p></div></div>';
  }
  function renderWorkflow() {
    const box = $('workflowContent');
    if (!box) return;
    box.style.cssText = view==='classes' ? '' : classStyle(chosenGroup());
    if (view === 'classes') {
      const groups = db.groups || [];
      box.innerHTML = header(mode === 'results' ? 'Résultats · choisir une classe' : 'Mes classes', 'Une classe, ses séances, puis ses exercices.') +
        (mode === 'classes' ? '<button type="button" class="flow-primary" data-action="new-class">+ Créer une classe</button>' : '') +
        '<div class="flow-grid">' + groups.map(g => '<button type="button" class="flow-card" style="'+classStyle(g)+'" data-action="open-class" data-id="'+html(g.id)+'"><strong>'+html(g.name)+'</strong><span>'+lessons(g).length+' séance(s)</span><small>'+classBadge(g)+'</small></button>').join('') + '</div>' +
        (!groups.length ? '<div class="card empty">Aucune classe enregistrée. Crée ta première classe depuis « Mes classes ».</div>' : '');
      return;
    }
    const group = chosenGroup();
    if (!group) { view='classes'; renderWorkflow(); return; }
    if (view === 'lessons') {
      box.innerHTML = header(group.name, mode === 'results' ? 'Choisis la séance dont tu veux consulter les résultats.' : 'Crée la séance du jour ou reprends une séance existante.', 'class-list') +
        '<div class="flow-actions"><button type="button" class="flow-scan" data-action="quick-scan">📷 Scanner dans cette classe</button></div>'+
        (mode === 'classes' ? '<div class="flow-actions"><button type="button" class="flow-primary" data-action="new-lesson">+ Séance du jour</button><button type="button" data-action="rename-class">Renommer la classe</button></div>' : '') +
        '<div class="flow-grid">'+lessons(group).map(l => '<button type="button" class="flow-card" data-action="open-lesson" data-id="'+html(l.id)+'"><strong>'+html(dayLabel(l.date))+'</strong><span>'+html(l.label)+'</span><span>'+l.exercises.length+' exercice(s)</span><small>'+badge(group,l)+'</small></button>').join('')+'</div>'+
        (!lessons(group).length ? '<div class="card empty">Aucune séance pour cette classe.</div>' : '');
      return;
    }
    const lesson = chosenLesson();
    if (!lesson) { view='lessons'; renderWorkflow(); return; }
    box.innerHTML = header(group.name+' · '+dayLabel(lesson.date), lesson.label+' · '+badge(group,lesson), 'lesson-list') +
      (mode === 'classes' ? '<button type="button" class="flow-primary" data-action="new-exercise">+ Ajouter un exercice</button>' : '') +
      '<div class="flow-actions"><button type="button" class="flow-primary" data-action="save-current-lesson">💾 Sauvegarder la séance en HTML</button><button type="button" class="flow-danger" data-action="delete-lesson">Supprimer la séance</button></div>'+
      '<div class="flow-grid">'+lesson.exercises.map(e => '<div class="flow-card exercise-card"><strong>'+html(e.label)+'</strong><span>'+protocol(e.type)+'</span><div class="flow-actions">'+
        '<button type="button" class="flow-scan" data-action="scan-exercise" data-id="'+html(e.id)+'" '+(e.status==='locked'?'disabled':'')+'>📷 Scanner ici</button>' +
        '<button type="button" data-action="exercise-results" data-id="'+html(e.id)+'">Résultats</button></div>'+(e.status==='locked'?'<small>🔒 Épreuve verrouillée</small>':'')+'</div>').join('')+'</div>';
  }
  function quickScan() {
    if(['results','training-results','group','scan'].includes(currentPage)) {
      const {group,exercise}=activePair();
      if(group&&exercise){classId=group.id;lessonId=exercise.lessonId;openScan(exercise.id);return;}
    }
    if(currentPage==='workflow'&&chosenGroup()&&view!=='classes') {
      if(view==='exercises'&&chosenLesson()?.exercises.length===1){openScan(chosenLesson().exercises[0].id);return;}
      mode='classes';showPage('workflow');
      toast(view==='lessons'?'Choisis la séance à scanner ou crée celle du jour.':'Choisis l’exercice à scanner.');return;
    }
    goFlow('classes');toast('Choisis la classe, puis la séance à scanner.');
  }
  function selectExercise(id) {
    const group = chosenGroup();
    const exercise = group?.sessions?.find(e => String(e.id)===String(id));
    if (!group || !exercise) return null;
    db.activeGroupId = group.id; db.activeSessionId = exercise.id; filter='ALL'; save(); render();
    return exercise;
  }
  function openScan(id) {
    const exercise = selectExercise(id);
    if (!exercise) return;
    if (exercise.status === 'locked') return toast('Cette épreuve est verrouillée.');
    target = {groupId:db.activeGroupId, sessionId:exercise.id};
    $('qrText').value='';
    $('scanMessage').textContent='Prêt à recevoir les résultats de cet exercice.';
    showPage('scan');
  }
  function openResults(id) {
    const exercise = selectExercise(id);
    if (!exercise) return;
    showPage(exercise.type === 'training' ? 'training-results' : 'results');
    render();
    if (exercise.type === 'training') window.renderTrainingResults?.();
    if (exercise.type === 'exam500') window.renderExam500View?.();
  }
  function renderDestination() {
    const {group, exercise} = activePair();
    if (!group || !exercise) return;
    $('scanDestination').innerHTML = header(group.name+' · '+dayLabel(exercise.lessonDate), 'Exercice : '+exercise.label+' · '+protocol(exercise.type))+
      '<div class="flow-actions"><button type="button" data-action="finish-scan">Terminer les scans</button><button type="button" data-action="new-exercise">+ Ajouter un exercice à cette séance</button><button type="button" data-action="change-destination">Changer de classe / séance</button></div>'+
      '<p class="flow-note">Enregistrement automatique sur cet iPad après chaque scan. Le téléchargement HTML se fait depuis « Sauvegarder ».</p>';
    // These older banners say “évaluation”; the explicit destination above replaces them.
    $('activeContextBanner')?.classList.add('hidden');
    $('sessionBanner')?.classList.add('hidden');
  }
  function dialogForm(title, content, onSubmit) {
    let dialog = $('classFlowDialog');
    if (!dialog) { dialog=document.createElement('dialog'); dialog.id='classFlowDialog'; document.body.appendChild(dialog); }
    dialog.innerHTML='<form class="flow-form"><h2>'+html(title)+'</h2>'+content+'<div class="flow-actions"><button type="button" id="flowCancel">Annuler</button><button type="submit" class="flow-primary">Valider</button></div></form>';
    dialog.querySelector('#flowCancel').onclick=()=>dialog.close();
    dialog.querySelector('form').onsubmit=e=>{e.preventDefault(); if(onSubmit(new FormData(e.target))!==false)dialog.close();};
    dialog.showModal();
    dialog.querySelector('input')?.focus();
  }
  function exerciseFields() {
    return '<label>Nom de l’exercice<input name="exercise" value="Exercice 1" required maxlength="100"></label><p class="flow-note">Le type d’exercice est reconnu automatiquement au premier QR : entraînement, 2 × 800 ou 3 × 500.</p>';
  }
  function createClass() {
    dialogForm('Créer une classe','<label>Classe<input name="name" placeholder="Ex. 1E, 6B…" required maxlength="80"></label>',data=>{
      const name=String(data.get('name')||'').trim(); if(!name)return false;
      if(db.groups.some(g=>g.name.toLocaleLowerCase()===name.toLocaleLowerCase())) {toast('Cette classe existe déjà.');return false;}
      const group={id:uid(),name,classroom:name.toUpperCase(),sessions:[],students:[],archived:false};
      db.groups.push(group); classId=group.id; db.activeGroupId=group.id; db.activeSessionId=null;
      save(); view='lessons'; showPage('workflow');
    });
  }
  function createLesson() {
    const group=chosenGroup(); if(!group)return;
    dialogForm('Séance du jour · '+group.name,'<label>Classe<input value="'+html(group.name)+'" readonly></label><label>Date<input type="date" name="date" value="'+today()+'" required></label><label>Nom de la séance<input name="lesson" placeholder="Ex. Demi-fond" maxlength="100"></label>'+exerciseFields(),data=>{
      if(!String(data.get('exercise')||'').trim()){toast('Donne un nom à l’exercice.');return false;}
      const date=String(data.get('date')||''); const label=String(data.get('lesson')||'').trim()||'Séance du '+dayLabel(date);
      lessonId=uid(); const exercise={id:uid(),createdAt:Date.now(),lessonId,lessonDate:date,lessonLabel:label,label:String(data.get('exercise')).trim(),type:'',status:'open',students:[]};
      group.sessions.push(exercise); save(); view='exercises'; openScan(exercise.id);
    });
  }
  function addExercise() {
    $('cameraStop')?.click();
    const group=chosenGroup(),lesson=chosenLesson(); if(!group||!lesson)return;
    dialogForm('Ajouter un exercice · '+dayLabel(lesson.date),exerciseFields().replace('value="Exercice 1"','value="Exercice '+(lesson.exercises.length+1)+'"'),data=>{
      if(!String(data.get('exercise')||'').trim()){toast('Donne un nom à l’exercice.');return false;}
      const exercise={id:uid(),createdAt:Date.now(),lessonId:lesson.id,lessonDate:lesson.date,lessonLabel:lesson.label,label:String(data.get('exercise')).trim(),type:'',status:'open',students:[]};
      group.sessions.push(exercise); save(); openScan(exercise.id);
    });
  }
  function renameClass() {
    const group=chosenGroup(); if(!group)return;
    dialogForm('Renommer la classe','<label>Nom<input name="name" value="'+html(group.name)+'" required maxlength="80"></label>',data=>{
      const name=String(data.get('name')||'').trim();if(!name)return false;
      group.name=name; // Historical pupil identities and class codes are kept intact.
      save(); refresh();
    });
  }
  function renderBackups() {
    $('backupChoices').innerHTML='<p class="workspace-context">✅ Un HTML à jour a été téléchargé. ⚠️ Aucun HTML à jour pour cette séance.</p>'+
      (db.groups||[]).map(group=>'<details class="card backup-class" style="'+classStyle(group)+'"><summary><strong>'+html(group.name)+'</strong> · '+classBadge(group)+'</summary><button type="button" data-action="export-class" data-id="'+html(group.id)+'">Télécharger cette classe en HTML</button>'+lessons(group).map(l=>'<div class="backup-lesson"><span>'+html(dayLabel(l.date)+' · '+l.label)+'<small>'+badge(group,l)+'</small></span><button type="button" data-action="export-lesson" data-group="'+html(group.id)+'" data-id="'+html(l.id)+'">Sauvegarder la séance en HTML</button></div>').join('')+'</details>').join('');
    $('archiveFile')?.classList.add('hidden');
  }
  function makeSelection(scope, gid, lid) {
    const source=(db.groups||[]).filter(g=>scope==='all'||String(g.id)===String(gid));
    const groups=copy(source);
    if(scope==='lesson')groups.forEach(g=>g.sessions=g.sessions.filter(e=>String(e.lessonId||e.id)===String(lid)));
    const scans=copy((db.trainingScans||[]).filter(r=>groups.some(g=>String(g.id)===String(r.groupId)&&g.sessions.some(e=>String(e.id)===String(r.sessionId)))));
    return {format:'demifond-class-backup',version:2,scope,exportedAt:new Date().toISOString(),groups,trainingScans:scans,history:scope==='all'?copy(db.history||[]):[],settings:copy(db.settings),activeGroupId:null,activeSessionId:null};
  }
  function buildBundle(payload) {
    const reportStyles=new Set();
    const sections=payload.groups.map(group=>'<section><h2>'+html(group.name)+'</h2>'+lessons(group).map(lesson=>'<h3>'+html(dayLabel(lesson.date)+' · '+lesson.label)+'</h3>'+lesson.exercises.map(exercise=>{
      // The original grading reports use the active exercise's scale and AFL labels.
      const oldGroup=window.activeGroup,oldSession=window.activeSession;
      let report;
      try {window.activeGroup=()=>group;window.activeSession=()=>exercise;report=window.DFArchive.buildReport(group,exercise,{});}
      finally {window.activeGroup=oldGroup;window.activeSession=oldSession;}
      for(const match of report.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) reportStyles.add(match[1]);
      const content=report.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] || '<p>Aucun bilan disponible.</p>';
      return '<article class="exercise-report"><h4>'+html(exercise.label)+' · '+protocol(exercise.type)+'</h4>'+content.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'')+'</article>'; 
    }).join('')).join('')+'</section>').join('');
    const data=JSON.stringify(payload).replace(/</g,'\\u003c');
    return '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DemiFond · Sauvegarde</title><style>'+[...reportStyles].join('\n')+'\nbody{font:16px system-ui;background:#f3f6fb;color:#162033;margin:0}.archive-main{max-width:1200px;margin:auto;padding:24px}.archive-main>section{padding:20px;margin:24px 0;background:white;border:1px solid #dbe3ee;border-radius:16px}.exercise-report{padding:16px 0;border-top:2px solid #dbe3ee;margin-top:20px}.exercise-report h4{font-size:1.2rem;color:#1d4ed8}.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse}th,td{padding:10px;border-bottom:1px solid #dbe3ee;text-align:left}summary{cursor:pointer}p{line-height:1.5}@media(max-width:600px){.archive-main{padding:10px}.archive-main>section{padding:12px}}@media print{.archive-main{max-width:none;padding:0}}</style></head><body><main class="archive-main"><h1>DemiFond · Sauvegarde HTML</h1><p>'+html(payload.groups.length)+' classe(s) · Export du '+html(new Date(payload.exportedAt).toLocaleString('fr-FR'))+'</p><p>Les bilans sont visibles ci-dessous. Ouvre le nom d’un élève pour consulter son détail. Pour restaurer les résultats, sélectionne ce même fichier dans « Importer un fichier HTML » de DemiFond Scan.</p>'+sections+'<script id="demifond-archive-data" type="application/json">'+data+'</script></main></body></html>';

  }
  async function exportHTML(scope='all', gid=null, lid=null) {
    normalizeLessons();
    const payload=makeSelection(scope,gid,lid),stamps={};
    for(const g of payload.groups)for(const l of lessons(g)) stamps[stampKey(g,l)]={content:snapshot(g,l),downloadedAt:payload.exportedAt};
    payload.settings.htmlExports={...payload.settings.htmlExports,...stamps};
    const report=buildBundle(payload),blob=new Blob([report],{type:'text/html;charset=utf-8'});
    const name=('DemiFond_'+(scope==='all'?'Toutes_les_classes':payload.groups[0]?.name||'Classe')+(scope==='lesson'?'_'+lessons(payload.groups[0])[0]?.date:'')).replace(/[^a-zA-Z0-9_-]/g,'_')+'.html';
    try {
      if(window.showSaveFilePicker) {
        const handle=await window.showSaveFilePicker({suggestedName:name,types:[{description:'Sauvegarde HTML',accept:{'text/html':['.html']}}]});
        const stream=await handle.createWritable();await stream.write(blob);await stream.close();
      } else {
        const link=document.createElement('a');const url=URL.createObjectURL(blob);link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
      }
      // Stamp exactly the exported snapshot: edits during a save stay marked as pending.
      db.settings.htmlExports={...db.settings.htmlExports,...stamps};save();refresh();toast('Téléchargement HTML lancé.');
    } catch(error) { if(error.name!=='AbortError')alert('Impossible de télécharger le HTML : '+error.message); }
    return payload;
  }
  function mergePayload(payload) {
    if(payload.scope==='all') {
      if(!confirm('Restaurer toute l’application ? Les données locales seront remplacées par ce fichier.'))return false;
      db=normalizeDB(payload);
    } else {
      if(!confirm('Importer cette sauvegarde ? Les séances présentes dans ce fichier remplaceront leurs versions locales. Les autres classes et séances seront conservées.'))return false;
      for(const incoming of payload.groups) {
        let group=groupById(incoming.id);
        if(!group) {db.groups.push(copy(incoming));continue;}
        group.name=incoming.name;group.classroom=incoming.classroom||group.classroom;
        const roster=new Map((group.students||[]).map(s=>[String(s.externalId||s.id),s]));
        for(const student of incoming.students||[])roster.set(String(student.externalId||student.id),copy(student));
        group.students=[...roster.values()];
        const lessonIds=new Set(incoming.sessions.map(e=>String(e.lessonId||e.id)));
        const removed=group.sessions.filter(e=>lessonIds.has(String(e.lessonId||e.id))).map(e=>String(e.id));
        group.sessions=group.sessions.filter(e=>!lessonIds.has(String(e.lessonId||e.id))).concat(copy(incoming.sessions));
        db.trainingScans=(db.trainingScans||[]).filter(r=>!(String(r.groupId)===String(group.id)&&removed.includes(String(r.sessionId))));
      }
      for(const row of payload.trainingScans||[]) {
        const i=(db.trainingScans||[]).findIndex(r=>r.id===row.id&&r.groupId===row.groupId&&r.sessionId===row.sessionId);
        if(i>=0)db.trainingScans[i]=copy(row);else(db.trainingScans||=[]).push(copy(row));
      }
      db.settings={...db.settings,...payload.settings,htmlExports:{...db.settings.htmlExports,...payload.settings?.htmlExports}};
    }
    normalizeLessons();target=null;save();render();showPage('home');toast('Sauvegarde HTML restaurée.');return true;
  }
  async function importHTML(file) {
    try {
      const text=await file.text();let payload;
      if(text.trim().startsWith('<')) {const doc=new DOMParser().parseFromString(text,'text/html');payload=JSON.parse(doc.getElementById('demifond-archive-data')?.textContent||'null');}
      else payload=JSON.parse(text);
      if(payload?.format==='demifond-class-backup'&&Array.isArray(payload.groups)&&payload.groups.every(g=>Array.isArray(g.sessions))&&['all','class','lesson'].includes(payload.scope))mergePayload(payload);
      else if(payload?.format==='demifond-scan-ccf-evaluation') {window.DFArchive.restoreEvaluationArchive(payload);normalizeLessons();save();}
      else if(Array.isArray(payload?.groups)) {if(confirm('Restaurer cette sauvegarde complète et remplacer les données locales ?')){db=normalizeDB(payload);normalizeLessons();save();render();showPage('home');}}
      else throw new Error('Format non reconnu');
    } catch(error) {alert('Import impossible : '+error.message);}
  }
  function targetReady() {
    const {group,exercise}=activePair();
    return !!(target&&group&&exercise&&String(target.groupId)===String(group.id)&&String(target.sessionId)===String(exercise.id)&&exercise.status!=='locked');
  }
  function guardQR(raw) {
    if(!targetReady()) {scanError('Choisis explicitement la classe, la séance et l’exercice avant de scanner.');return false;}
    // The selected group is the destination. A pupil's class is descriptive:
    // groups may mix classes, and equivalent class names need not match.
    // Native confirmation dialogs also interrupt the camera on some iPads.
    return true;
  }
  function deleteLesson() {
    const group=chosenGroup(),lesson=chosenLesson();
    if(!group||!lesson)return;
    if(!confirm('Supprimer la séance « '+lesson.label+' » du '+dayLabel(lesson.date)+' pour '+group.name+' ?\nSes '+lesson.exercises.length+' exercice(s) et leurs résultats seront supprimés de cet iPad. Les fichiers HTML déjà téléchargés restent disponibles.'))return;
    const ids=new Set(lesson.exercises.map(e=>String(e.id)));
    if(target&&String(target.groupId)===String(group.id)&&ids.has(String(target.sessionId))){$('cameraStop')?.click();target=null;}
    group.sessions=group.sessions.filter(e=>!ids.has(String(e.id)));
    db.trainingScans=(db.trainingScans||[]).filter(r=>!(String(r.groupId)===String(group.id)&&ids.has(String(r.sessionId))));
    delete db.settings.htmlExports[stampKey(group,lesson)];
    if(String(db.activeGroupId)===String(group.id)&&ids.has(String(db.activeSessionId)))db.activeSessionId=null;
    lessonId=null;view='lessons';save();render();showPage('workflow');toast('Séance supprimée.');
  }
  function action(event) {
    const button=event.target.closest?.('[data-action]');if(!button)return;
    const a=button.dataset.action;
    if(a==='quick-scan')quickScan();
    else if(a==='new-class')createClass();
    else if(a==='open-class'){classId=button.dataset.id;view='lessons';refresh();}
    else if(a==='open-lesson'){lessonId=button.dataset.id;view='exercises';refresh();}
    else if(a==='class-list'){view='classes';refresh();}
    else if(a==='lesson-list'){view='lessons';refresh();}
    else if(a==='new-lesson')createLesson();
    else if(a==='new-exercise')addExercise();
    else if(a==='rename-class')renameClass();
    else if(a==='return-lesson'){mode='results';view='exercises';showPage('workflow');}
    else if(a==='save-current-lesson')exportHTML('lesson',classId,lessonId);
    else if(a==='delete-lesson')deleteLesson();
    else if(a==='edit-exercise'){showPage('group');render();}
    else if(a==='bareme')$('exam500BaremeBtn')?.click();
    else if(a==='scan-exercise')openScan(button.dataset.id);
    else if(a==='exercise-results')openResults(button.dataset.id);
    else if(a==='finish-scan'){target=null;mode='classes';view='exercises';showPage('workflow');}
    else if(a==='change-destination')goFlow('classes');
    else if(a==='export-class')exportHTML('class',button.dataset.id);
    else if(a==='export-lesson')exportHTML('lesson',button.dataset.group,button.dataset.id);
  }
  function install() {
    normalizeLessons();save();
    const originalShowPage=window.showPage;
    window.showPage=function(id) {
      if(id==='scan'&&!targetReady()){goFlow('classes');toast('Choisis la classe et la séance avant de scanner.');return;}
      if(currentPage==='scan'&&id!=='scan')$('cameraStop')?.click();
      originalShowPage(id);currentPage=id;document.body.dataset.workspacePage=id;
      refresh();
    };
    const originalRender=window.render;
    window.render=function(...args){const value=originalRender.apply(this,args);refresh();return value;};
    const originalQR=window.handleQR;
    window.handleQR=function(raw){if(guardQR(raw))return originalQR(raw);};
    // The camera uses this same button; intercept before the older direct training handler.
    $('readText').onclick=()=>window.handleQR($('qrText').value.trim());
    document.addEventListener('click',event=>{
      if(event.target.closest?.('#camera')&&!targetReady()){event.preventDefault();event.stopImmediatePropagation();goFlow('classes');}
    },true);
    document.addEventListener('click',action);
    document.querySelectorAll('[data-flow]').forEach(button=>button.onclick=()=>goFlow(button.dataset.flow));
    $('homeReturn').onclick=()=>{target=null;showPage('home');};
    if($('recoveryBackup'))$('localRecoverySlot')?.appendChild($('recoveryBackup'));
    $('backup').onclick=()=>exportHTML('all');
    $('restore').onchange=async event=>{const file=event.target.files?.[0];if(file)await importHTML(file);event.target.value='';};
    window.addEventListener('online',refresh);window.addEventListener('offline',refresh);
    window.DFClassFlow={digest,lessons,snapshot,backedUp,makeSelection,buildBundle,exportHTML,mergePayload,importHTML,deleteLesson,guardQR,openScan,quickScan,goFlow};
    showPage('home');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
