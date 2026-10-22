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
    if (status) status.textContent = (navigator.onLine ? 'En ligne' : 'Hors ligne') + ' · v69';
    const context = $('homeActiveContext');
    if (context) context.textContent = 'Les résultats restent enregistrés sur cet iPad. Le ✅ indique un fichier HTML téléchargé et à jour.';
    $('homeReturn')?.classList.toggle('hidden', currentPage === 'home');
    if (currentPage === 'workflow') renderWorkflow();
    if (currentPage === 'backups') renderBackups();
    if (currentPage === 'results') renderResultsOverview();
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
      box.innerHTML = header('Mes classes', 'Retrouve rapidement tes séances et tes évaluations.') +
        '<div class="eps-classes-intro"><span class="eps-classes-intro-icon">🏃‍♂️</span><div><strong>Votre espace EPS</strong><span>Organisez vos classes, suivez les séances et retrouvez les performances en un clin d’œil.</span></div><span class="eps-classes-count">'+groups.length+' classe'+(groups.length>1?'s':'')+'</span></div>' +
        '<div class="flow-actions" style="align-items:center;flex-wrap:wrap">' +
        '<button type="button" class="flow-primary" data-action="new-class">+ Créer une classe</button>' +
        '<input id="flowClassSearch" type="search" aria-label="Rechercher une classe" placeholder="Rechercher une classe…" style="flex:1;min-width:170px;max-width:360px;padding:11px;border:1px solid #cbd5e1;border-radius:10px"></div>' +
        '<p class="eps-class-delete-hint">Astuce : maintenez une classe appuyée pour la supprimer intégralement (confirmation obligatoire).</p>' +
        '<div class="flow-grid" id="flowClassGrid">' +
        groups.map(g => '<div class="flow-card class-tile" style="'+classStyle(g)+'" data-class-name="'+html(g.name.toLocaleLowerCase())+'"><button type="button" class="class-tile-main" data-action="open-class" data-id="'+html(g.id)+'"><span class="eps-class-kicker">CLASSE · EPS</span><strong>'+html(g.name)+'</strong><span class="eps-class-session-count"><b>'+lessons(g).length+'</b> séance'+(lessons(g).length>1?'s':'')+'</span></button><button type="button" class="class-tile-results" data-action="class-results" data-id="'+html(g.id)+'">Résultats <span aria-hidden="true">→</span></button></div>').join('') + '</div>' +
        (!groups.length ? '<div class="card empty">Aucune classe enregistrée. Crée ta première classe depuis « Mes classes ».</div>' : '');
      const search=$('flowClassSearch');
      if(search) search.oninput=()=>{const query=search.value.trim().toLocaleLowerCase();box.querySelectorAll('[data-class-name]').forEach(card=>{card.hidden=!card.dataset.className.includes(query);});};
      return;
    }
    const group = chosenGroup();
    if (!group) { view='classes'; renderWorkflow(); return; }
    if (view === 'lessons') {
      box.innerHTML = header(group.name, 'Séances · scanner, consulter ou sauvegarder au même endroit.', 'class-list') +
        '<div class="flow-actions"><button type="button" class="flow-primary" data-action="new-lesson">+ Séance du jour</button><button type="button" data-action="rename-class">Renommer la classe</button><button type="button" data-action="export-class" data-id="'+html(group.id)+'">💾 Sauvegarder la classe</button></div>' +
        '<div class="eps-lessons-intro"><span class="eps-lessons-intro-icon">📅</span><div><strong>Vos séances, en un coup d’œil</strong><span>Retrouvez les exercices et accédez directement aux résultats.</span></div><span class="eps-lessons-count">'+lessons(group).length+' séance'+(lessons(group).length>1?'s':'')+'</span></div>' +
        '<div class="flow-grid eps-lessons-grid">'+lessons(group).map((l,i) => '<div class="flow-card eps-lesson-tile eps-lesson-color-'+(i%4)+'"><button type="button" class="eps-lesson-main" data-action="open-lesson" data-id="'+html(l.id)+'"><span class="eps-lesson-kicker">SÉANCE '+String(i+1).padStart(2,'0')+'</span><strong>'+html(dayLabel(l.date))+'</strong><span class="eps-lesson-label">'+html(l.label)+'</span><span class="eps-lesson-exercises"><b>'+l.exercises.length+'</b> exercice'+(l.exercises.length>1?'s':'')+'</span></button><button type="button" class="eps-lesson-results" data-action="lesson-results" data-id="'+html(l.id)+'">Voir les résultats <span aria-hidden="true">↗</span></button></div>').join('')+'</div>'+
        (!lessons(group).length ? '<div class="card empty">Aucune séance pour cette classe.</div>' : '');
      return;
    }
    const lesson = chosenLesson();
    if (!lesson) { view='lessons'; renderWorkflow(); return; }
    box.innerHTML = header(group.name+' · '+dayLabel(lesson.date), lesson.label+' · '+badge(group,lesson), 'lesson-list') +
      '<button type="button" class="flow-primary" data-action="new-exercise">+ Ajouter un exercice</button>' +
      '<div class="flow-actions"><button type="button" class="flow-primary" data-action="save-current-lesson">💾 Sauvegarder la séance</button><button type="button" class="flow-danger" data-action="delete-lesson">Supprimer la séance</button></div>'+
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
      const lesson=chosenLesson();

      if(view==='exercises'&&lesson?.exercises.length===1){
        openScan(lesson.exercises[0].id);
        return;
      }

      if(view==='lessons'){
        const classLessons=lessons(chosenGroup());
        if(classLessons.length===1&&classLessons[0].exercises.length===1){
          lessonId=classLessons[0].id;
          openScan(classLessons[0].exercises[0].id);
          return;
        }
        toast('Choisis la séance puis l’exercice à scanner.');
        return;
      }

      toast('Choisis l’exercice à scanner.');
      return;
    }

    goFlow('classes');
    toast('Choisis la classe, puis la séance et l’exercice à scanner.');
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
    renderResultsOverview();
  }
  // Compact, read-only overview above the existing results table.
  function renderResultsOverview() {
    if (currentPage !== 'results') return;
    const page = $('results');
    if (!page) return;
    let panel = $('sessionResultsOverview');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'sessionResultsOverview';
      panel.className = 'card';
      const tableCard = page.querySelector('.card');
      page.insertBefore(panel, tableCard || null);
    }
    const {group,exercise} = activePair();
    if (!group || !exercise) { panel.innerHTML=''; return; }
    const roster = Array.isArray(group.students) ? group.students : [];
    const students = Array.isArray(exercise.students) ? exercise.students : [];
    const fullName = s => [s.last || s.lastName || s.nom || '',s.first || s.firstName || s.prenom || ''].join(' ').trim() || s.name || '';
    const key = s => String(s || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').trim().toLowerCase();
    const counts = new Map();
    students.forEach(s=>{const name=key(fullName(s));if(name)counts.set(name,(counts.get(name)||0)+1);});
    const warnings = [];
    for(const [name,n] of counts) if(n>1) warnings.push('Nom en double : '+name);
    const missing = roster.filter(s=>!students.some(x=>(s.externalId||s.id) && String(x.externalId||x.id)===String(s.externalId||s.id) || (key(fullName(s)) && key(fullName(s))===key(fullName(x)))));
    if(missing.length) warnings.push(missing.length+' élève(s) de la classe sans résultat');
    if(exercise.type==='exam500') {
      const incomplete=students.filter(s=>s.exam500 && Array.isArray(s.exam500.races) && s.exam500.races.length<3);
      if(incomplete.length) warnings.push(incomplete.length+' résultat(s) 3 × 500 incomplet(s)');
    }
    const sorted=[...students].sort((a,b)=>fullName(a).localeCompare(fullName(b),'fr'));
    panel.innerHTML='<h2>Tableau de bord · '+html(exercise.label)+'</h2>'+
      '<div class="flow-grid eps-dashboard-metrics">'+
      [['Élèves de la classe',roster.length||students.length],['Résultats enregistrés',students.length],['Alertes à vérifier',warnings.length]].map(([label,value],i)=>'<div class="flow-card eps-metric eps-metric-'+i+'"><span class="eps-metric-symbol">'+['♙','✓','!'][i]+'</span><div class="eps-metric-copy"><strong>'+value+'</strong><span>'+label+'</span></div></div>').join('')+'</div>'+
      '<details style="margin:12px 0"><summary>Contrôles ('+warnings.length+' alerte(s))</summary>'+
      (warnings.length?'<ul>'+warnings.map(w=>'<li>'+html(w)+'</li>').join('')+'</ul>':'<p>Aucune anomalie détectée.</p>')+'</details>'+
      '<div class="eps-student-heading"><h3>Élèves · ordre alphabétique</h3><p class="flow-note">Touchez un élève pour ouvrir sa fiche et corriger ses résultats.</p></div>'+
      '<div class="student-picker-grid">'+sorted.map((student,i)=>
        '<button type="button" class="student-picker '+(i%2?'student-picker-alt':'')+'" data-student-index="'+i+'"><strong>'+html(fullName(student)||'Élève '+(i+1))+'</strong><span>Voir la fiche →</span></button>'
      ).join('')+'</div>';
    panel.querySelectorAll('[data-student-index]').forEach(button=>{
      button.onclick=()=>openStudentResultSheet(sorted[Number(button.dataset.studentIndex)]);
    });
  }
  function openStudentResultSheet(student) {
    const {exercise}=activePair();
    if(!exercise||!student)return;
    const fullName=[student.last||student.lastName||student.nom||'',student.first||student.firstName||student.prenom||''].join(' ').trim()||student.name||'Élève';
    let dialog=$('studentResultSheet');
    if(!dialog){dialog=document.createElement('dialog');dialog.id='studentResultSheet';document.body.appendChild(dialog);}
    const ms=value=>{
      const n=Number(value);
      if(!Number.isFinite(n)||n<=0)return '—';
      const minutes=Math.floor(n/60000),seconds=((n%60000)/1000).toFixed(2).padStart(5,'0');
      return minutes+':'+seconds;
    };
    const field=(label,value)=>'<div class="student-sheet-field'+(label==='Temps final'?' student-sheet-final':'')+'"><span>'+html(label)+'</span><strong>'+html(value==null||value===''?'—':value)+'</strong></div>';
    let content='';
    if(exercise.type==='exam500'){
      const races=student.exam500?.races||[];
      content=races.map((race,i)=>{
        const splits=Array.isArray(race.splits)?race.splits:[];
        return '<section class="student-sheet-race"><h4>500 m · course '+(i+1)+'</h4>'+
          field('Temps final',ms(race.total500Ms||race.totalMs))+
          field('Passage 250 m',ms(race.split250Ms))+
          (splits.length?field('Passages',splits.map(ms).join(' · ')):'')+
          field('Estimation',race.project||student['project'+(i+1)]||'—')+'</section>';
      }).join('');
      content+='<div class="student-sheet-evaluation"><h4>Évaluation</h4>'+field('AFL 2',student.exam500Afl2)+field('AFL 3',student.exam500Afl3);
      for(const [key,label] of [['exam500Warmup','Échauffement'],['exam500Carnet','Carnet'],['exam500Observation','Observation']]){
        if(student[key]!=null&&student[key]!=='')content+=field(label,student[key]);
      }
      content+='</div>';
    } else {
      for(const n of [1,2]){
        const race=student.races?.[n];if(!race)continue;
        content+='<section class="student-sheet-race"><h4>800 m · course '+n+'</h4>'+
          field('Temps final',ms(race.totalMs))+
          (Array.isArray(race.splits)?race.splits.map((v,i)=>field('Passage '+(i+1),ms(v))).join(''):'')+
          field('Estimation',race.project||student['project'+n]||'—')+'</section>';
      }
      content+='<div class="student-sheet-evaluation"><h4>Évaluation</h4>'+field('AFL 2',student.afl2)+field('AFL 3',student.afl3)+'</div>';
    }
    if(!content)content='<p>Aucun résultat individuel disponible.</p>';
    dialog.innerHTML='<div class="student-sheet"><div class="student-sheet-head"><div><small>FICHE ÉLÈVE</small><h2>'+html(fullName)+'</h2><p>'+html(exercise.label||'Résultats')+'</p></div><button type="button" class="student-sheet-close" aria-label="Fermer">✕</button></div>'+
      '<div class="student-sheet-content">'+content+'</div><div class="student-sheet-actions"><button type="button" class="student-sheet-close">Fermer</button>'+
      '<button type="button" class="student-sheet-annotation">📝 Annotations et suivi</button>'+ (exercise.status==='locked'?'': '<button type="button" class="student-sheet-edit">✏️ Modifier les résultats</button>')+'</div></div>';
    dialog.querySelectorAll('.student-sheet-close').forEach(button=>button.onclick=()=>dialog.close());
    dialog.querySelector('.student-sheet-annotation').onclick=()=>window.DFStudentFollowup?.open(student,()=>{dialog.close();openStudentResultSheet(student);},exercise.status==='locked');
    const edit=dialog.querySelector('.student-sheet-edit');
    if(edit)edit.onclick=()=>{
      dialog.close();
      const id=student.id||student.externalId;
      if(exercise.type==='exam500'){
        if(typeof window.openExam500StudentEditor==='function')window.openExam500StudentEditor(id);
        else toast('Éditeur indisponible.');
      }else openCcfStudentEditor(id);
    };
    dialog.showModal();
  }
  function openCcfStudentEditor(id) {
    const {exercise}=activePair();
    const student=exercise?.students?.find(s=>String(s.id||s.externalId)===String(id));
    if(!student)return toast('Élève introuvable.');
    if(exercise.status==='locked')return toast('Évaluation verrouillée.');
    let dialog=$('ccfPersonalEditor');
    if(!dialog){dialog=document.createElement('dialog');dialog.id='ccfPersonalEditor';document.body.appendChild(dialog);}
    const fmt=ms=>Number.isFinite(Number(ms))&&Number(ms)>0?(Number(ms)/1000).toFixed(2):'';
    const races=[1,2].map(n=>{
      const race=student.races?.[n],splits=race?.splits||[];
      return '<fieldset style="margin:10px 0;padding:12px;border:1px solid #cbd5e1;border-radius:10px"><legend>800 m · course '+n+'</legend>'+
        (race?'<label>Temps total (secondes)<input type="number" min="1" step=".01" data-race="'+n+'" data-field="total" value="'+fmt(race.totalMs)+'" required></label>'+
        splits.map((v,i)=>'<label>Passage '+(i+1)+' (secondes cumulées)<input type="number" min="0" step=".01" data-race="'+n+'" data-split="'+i+'" value="'+fmt(v)+'" required></label>').join('')+
        '<label>Estimation<input data-race="'+n+'" data-field="project" value="'+html(race.project||'')+'"></label>':'<p>Course non scannée.</p>')+'</fieldset>';
    }).join('');
    dialog.innerHTML='<form method="dialog" style="min-width:min(82vw,440px);max-height:80vh;overflow:auto;padding:18px"><h3>Corriger · '+html([student.last,student.first].filter(Boolean).join(' '))+'</h3>'+
      races+'<label>AFL 2<input type="number" step=".25" data-score="afl2" value="'+html(student.afl2??'')+'"></label><label>AFL 3<input type="number" step=".25" data-score="afl3" value="'+html(student.afl3??'')+'"></label>'+
      '<div class="flow-actions"><button type="button" id="ccfPersonalSave" class="flow-primary">Enregistrer</button><button type="button" id="ccfPersonalCancel">Annuler</button></div></form>';
    dialog.querySelectorAll('label').forEach(label=>{label.style.cssText='display:flex;flex-direction:column;gap:5px;margin:9px 0';});
    dialog.querySelectorAll('input').forEach(input=>{input.style.cssText='padding:9px;border:1px solid #cbd5e1;border-radius:7px';});
    dialog.querySelector('#ccfPersonalCancel').onclick=()=>dialog.close();
    dialog.querySelector('#ccfPersonalSave').onclick=()=>{
      const edits={};
      for(const n of [1,2]){
        const race=student.races?.[n];if(!race)continue;
        const total=dialog.querySelector('[data-race="'+n+'"][data-field="total"]');
        const splitInputs=[...dialog.querySelectorAll('[data-race="'+n+'"][data-split]')];
        const values=splitInputs.map(input=>Math.round(Number(input.value)*1000));
        const totalMs=Math.round(Number(total.value)*1000);
        if(!Number.isFinite(totalMs)||totalMs<=0||values.some((v,i)=>!Number.isFinite(v)||v<=0||(i>0&&v<=values[i-1]))||(values.length&&values[values.length-1]>totalMs)){
          alert('Vérifie les temps cumulés de la course '+n+'.');return;
        }
        edits[n]={totalMs,splits:values,project:dialog.querySelector('[data-race="'+n+'"][data-field="project"]').value};
      }
      const scores={};
      for(const field of ['afl2','afl3']){const input=dialog.querySelector('[data-score="'+field+'"]');const v=input.value.trim();if(v!==''&&!Number.isFinite(Number(v))){alert('Note invalide.');return;}scores[field]=v===''?'':Number(v);}
      for(const n of [1,2])if(edits[n])Object.assign(student.races[n],edits[n]);
      Object.assign(student,scores);
      save();dialog.close();render();renderResultsOverview();toast('Résultats corrigés et enregistrés.');
    };
    dialog.showModal();
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
    const groups=db.groups||[];
    const pending=groups.reduce((total,group)=>total+lessons(group).filter(lesson=>!backedUp(group,lesson)).length,0);
    $('backupChoices').innerHTML='<div class="card" style="padding:16px;margin-bottom:14px"><strong>'+groups.length+' classe(s) · '+pending+' séance(s) à exporter</strong><p style="margin:8px 0 0">Les données restent enregistrées sur cet iPad. Télécharge un HTML pour en conserver une copie extérieure. Pour exporter une seule classe ou séance, passe par « Mes classes ».</p></div>';
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
  function hasResults(group,exercise) {
    return !!(exercise.students?.length || (db.trainingScans||[]).some(r=>String(r.groupId)===String(group.id)&&String(r.sessionId)===String(exercise.id)));
  }
  function routeProtocol(raw,handler) {
    let data;try{data=typeof raw==='string'?JSON.parse(raw):raw;}catch{return handler(raw);}
    const type=data?.type==='DF_3X500_RESULT'?'exam500':data?.type==='DF_TRAINING_RESULT'?'training':data?.studentId&&[1,2].includes(Number(data.race))?'ccf':null;
    const {group,exercise}=activePair();
    if(!type||!group||!exercise)return handler(raw);
    const previousType=exercise.type;
    const effectiveType=exercise.type||(hasResults(group,exercise)?(exercise.students?.some(s=>s.exam500)?'exam500':exercise.students?.length?'ccf':'training'):'');
    if(!effectiveType||effectiveType===type)return handler(raw);
    const previousTarget=target,previousId=db.activeSessionId;
    let destination=exercise,created=false;
    if(!hasResults(group,exercise)) {
      // Old empty exercises may still have the former default "training" type.
      exercise.type='';
    } else {
      destination=group.sessions.find(e=>e.autoProtocol&&e.lessonId===exercise.lessonId&&e.type===type&&e.status!=='locked');
      if(!destination) {
        const base=({training:'Entraînement',ccf:'2 × 800',exam500:'3 × 500'})[type];
        let label=base,n=2;while(group.sessions.some(e=>e.lessonId===exercise.lessonId&&e.label===label))label=base+' ('+(n++)+')';
        destination={id:uid(),createdAt:Date.now(),lessonId:exercise.lessonId,lessonDate:exercise.lessonDate,lessonLabel:exercise.lessonLabel,label,type:'',status:'open',students:[],autoProtocol:true};
        group.sessions.push(destination);created=true;
      }
      db.activeSessionId=destination.id;target={groupId:group.id,sessionId:destination.id};
    }
    const rollback=()=>{
      if(created)group.sessions=group.sessions.filter(e=>e.id!==destination.id);
      if(destination===exercise)exercise.type=previousType;
      db.activeSessionId=previousId;target=previousTarget;save();render();
    };
    const finish=value=>{
      if(!hasResults(group,destination))rollback();
      else {save();refresh();if(created)toast(protocol(type)+' : exercice créé automatiquement dans cette séance.');}
      return value;
    };
    try {
      const value=handler(raw);
      return value&&typeof value.then==='function'?value.then(finish,error=>{rollback();throw error;}):finish(value);
    } catch(error){rollback();throw error;}
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
  // Long press on a class card: deliberate destructive action, with explicit name confirmation.
  function deleteClass(groupId) {
    const group=groupById(groupId);
    if(!group)return;
    const sessionIds=new Set((group.sessions||[]).map(e=>String(e.id)));
    const count=lessons(group).length;
    const answer=prompt('SUPPRESSION DÉFINITIVE\\n\\nClasse : '+group.name+'\\n'+count+' séance(s) et tous les résultats associés seront supprimés de cet appareil.\\n\\nSaisissez exactement le nom de la classe pour confirmer :');
    if(answer===null)return;
    if(answer!==group.name){alert('Suppression annulée : le nom saisi ne correspond pas.');return;}
    if(!confirm('Dernière confirmation : supprimer définitivement « '+group.name+' » et toutes ses données locales ?\\nCette opération est irréversible sans sauvegarde préalable.'))return;
    if(target&&String(target.groupId)===String(group.id)){$('cameraStop')?.click();target=null;}
    db.groups=(db.groups||[]).filter(g=>String(g.id)!==String(group.id));
    db.trainingScans=(db.trainingScans||[]).filter(r=>String(r.groupId)!==String(group.id)&&!sessionIds.has(String(r.sessionId)));
    for(const key of Object.keys(db.settings?.htmlExports||{}))if(key.startsWith(String(group.id)+'/'))delete db.settings.htmlExports[key];
    if(String(db.activeGroupId)===String(group.id)){db.activeGroupId=db.groups[0]?.id||null;db.activeSessionId=null;}
    if(String(classId)===String(group.id)){classId=null;lessonId=null;}
    view='classes';save();render();showPage('workflow');toast('Classe « '+group.name+' » supprimée.');
  }
  function installClassLongPress() {
    const root=$('workflowContent');
    if(!root)return;
    let timer=null,origin=null,held=false;
    const clear=()=>{if(timer!==null)clearTimeout(timer);timer=null;origin=null;};
    root.addEventListener('pointerdown',event=>{
      const card=event.target.closest?.('#flowClassGrid .class-tile');
      if(!card||event.button!==0)return;
      const button=card.querySelector('.class-tile-main');
      if(!button)return;
      clear();held=false;
      origin={x:event.clientX,y:event.clientY};
      const id=button.dataset.id;
      timer=setTimeout(()=>{timer=null;held=true;card.dataset.longPressed='yes';deleteClass(id);},800);
    });
    root.addEventListener('pointermove',event=>{if(origin&&Math.hypot(event.clientX-origin.x,event.clientY-origin.y)>12)clear();});
    for(const name of ['pointerup','pointercancel','pointerleave'])root.addEventListener(name,clear);
    root.addEventListener('click',event=>{
      const card=event.target.closest?.('#flowClassGrid .class-tile');
      if(!card)return;
      if(held||card.dataset.longPressed==='yes'){
        event.preventDefault();event.stopImmediatePropagation();held=false;delete card.dataset.longPressed;
      }
    },true);
    root.addEventListener('contextmenu',event=>{
      const card=event.target.closest?.('#flowClassGrid .class-tile');
      if(!card)return;
      event.preventDefault();clear();held=true;card.dataset.longPressed='yes';
      deleteClass(card.querySelector('.class-tile-main')?.dataset.id);
    });
  }
  function action(event) {
    const button=event.target.closest?.('[data-action]');if(!button)return;
    const a=button.dataset.action;
    if(a==='quick-scan')quickScan();
    else if(a==='new-class')createClass();
    else if(a==='switch-to-classes')goFlow('classes');
    else if(a==='open-class'){classId=button.dataset.id;view='lessons';refresh();}
    else if(a==='class-results'){classId=button.dataset.id;view='lessons';refresh();}
    else if(a==='open-lesson'){lessonId=button.dataset.id;view='exercises';refresh();}
    else if(a==='lesson-results'){lessonId=button.dataset.id;const lesson=chosenLesson();if(lesson?.exercises.length===1)openResults(lesson.exercises[0].id);else {view='exercises';refresh();}}
    else if(a==='class-list'){view='classes';refresh();}
    else if(a==='lesson-list'){view='lessons';refresh();}
    else if(a==='new-lesson')createLesson();
    else if(a==='new-exercise')addExercise();
    else if(a==='rename-class')renameClass();
    else if(a==='return-lesson'){mode='classes';view='exercises';showPage('workflow');}
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
    installClassLongPress();
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
    window.handleQR=function(raw){if(guardQR(raw))return routeProtocol(raw,value=>originalQR(value));};
    // The camera uses this same button; intercept before the older direct training handler.
    $('readText').onclick=()=>window.handleQR($('qrText').value.trim());
    document.addEventListener('click',event=>{
      if(event.target.closest?.('#camera')&&!targetReady()){event.preventDefault();event.stopImmediatePropagation();goFlow('classes');}
    },true);
    document.addEventListener('click',action);
    document.querySelectorAll('[data-flow]').forEach(button=>button.onclick=()=>goFlow(button.dataset.flow==='results'?'classes':button.dataset.flow));
    $('homeReturn').onclick=()=>{target=null;showPage('home');};
    if($('recoveryBackup'))$('localRecoverySlot')?.appendChild($('recoveryBackup'));
    $('backup').onclick=()=>exportHTML('all');
    $('restore').onchange=async event=>{const file=event.target.files?.[0];if(file)await importHTML(file);event.target.value='';};
    window.addEventListener('online',refresh);window.addEventListener('offline',refresh);
    window.DFClassFlow={deleteClass,digest,lessons,snapshot,backedUp,makeSelection,buildBundle,exportHTML,mergePayload,importHTML,deleteLesson,guardQR,routeProtocol,openScan,quickScan,goFlow};
    showPage('home');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
