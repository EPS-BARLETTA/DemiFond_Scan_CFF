(()=>{
  const ALLOCATION_POINTS = {
    2: {1:0.5, 2:1, 3:1.5, 4:2},
    4: {1:1, 2:2, 3:3, 4:4},
    6: {1:1.5, 2:3, 3:4.5, 4:6}
  };

  function ccf200Laps(splits){
    if(!Array.isArray(splits) || splits.length < 4) return [];
    const values = splits.slice(0,4).map(Number);
    if(values.some(v=>!Number.isFinite(v))) return [];
    return values.map((v,i)=>i===0 ? v : v-values[i-1]);
  }

  function ccfPerformance(sec, sex){
    const female = [306,299,292,285,278,272,266,260,254,248,242,236,230,225,220,215,210,205,200,195,190,185,180,175];
    const male   = [242,237,232,227,222,217,212,207,202,197,192,188,184,180,176,172,168,165,162,159,156,153,150,147];
    const scale = String(sex||'').toUpperCase()==='M' ? male : female;
    let pts = 0;
    for(let i=0;i<scale.length;i++){
      if(sec <= scale[i]) pts = (i+1)*0.25;
    }
    return Math.min(6,pts);
  }

  function ccfEfficiency(spreadMs){
    if(spreadMs == null || !Number.isFinite(Number(spreadMs))) return 0;
    const s = Number(spreadMs)/1000;
    if(s > 21) return 0;
    if(s >= 20) return 0.5;
    if(s >= 18) return 1;
    if(s >= 16) return 1.5;
    if(s >= 14) return 2;
    if(s >= 12) return 2.5;
    if(s >= 10) return 3;
    if(s >= 9) return 3.5;
    if(s >= 8) return 4;
    if(s >= 7) return 4.5;
    if(s >= 6) return 5;
    if(s >= 5) return 5.5;
    if(s < 4) return 6;
    return 5.5;
  }

  function ccfScore(student){
    const r1 = student?.races?.[1];
    const r2 = student?.races?.[2];
    if(!r1 || !r2) return null;

    const laps1 = ccf200Laps(r1.splits);
    const laps2 = ccf200Laps(r2.splits);
    if(laps1.length!==4 || laps2.length!==4) return null;

    const total1 = Number(r1.totalMs);
    const total2 = Number(r2.totalMs);
    if(!Number.isFinite(total1) || !Number.isFinite(total2)) return null;

    const best = Math.min(total1,total2);
    const allLaps = [...laps1,...laps2];
    const fastest200 = Math.min(...allLaps);
    const slowest200 = Math.max(...allLaps);
    const spread = slowest200-fastest200;
    const pp = ccfPerformance(best/1000, student.sex);
    const rp = ccfEfficiency(spread);

    return {
      best,
      fastest200,
      slowest200,
      spread,
      pp,
      rp,
      total: pp+rp
    };
  }

  function allocation(student){
    const raw = student.aflAllocation || '4-4';
    const [a2,a3] = String(raw).split('-').map(Number);
    if(![2,4,6].includes(a2) || ![2,4,6].includes(a3) || a2+a3!==8){
      return {a2:4,a3:4,key:'4-4'};
    }
    return {a2,a3,key:`${a2}-${a3}`};
  }

  function levelPoints(maxPoints, level){
    const l = Number(level);
    return ALLOCATION_POINTS[maxPoints]?.[l] ?? null;
  }

  function fmtPts(v){
    if(v==null || !Number.isFinite(Number(v))) return '—';
    return Number(v).toLocaleString('fr-FR',{maximumFractionDigits:2});
  }

  function fmtSpread(ms){
    if(ms==null || !Number.isFinite(Number(ms))) return '—';
    return (Number(ms)/1000).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})+' s';
  }

  function escAttr(v){
    return String(v??'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  score = ccfScore;

  renderResults = function(){
    const body = $('resultRows');
    if(!body) return;

    const table = body.closest('table');
    const headRow = table?.querySelector('thead tr');
    if(headRow){
      headRow.innerHTML = `
        <th>Élève</th>
        <th>Classe</th>
        <th>C1</th>
        <th>C2</th>
        <th>Meilleur</th>
        <th>Perf /6</th>
        <th>Écart 200</th>
        <th>Eff. /6</th>
        <th>AFL1 /12</th>
        <th>Répartition</th>
        <th>AFL2</th>
        <th>AFL3</th>
        <th>/20</th>`;
    }

    body.innerHTML = visibleStudents().map(student=>{
      const sc = ccfScore(student);
      const alloc = allocation(student);
      const l2 = student.afl2Level || '';
      const l3 = student.afl3Level || '';
      const p2 = levelPoints(alloc.a2,l2);
      const p3 = levelPoints(alloc.a3,l3);
      const final = sc && p2!=null && p3!=null ? Math.min(20,sc.total+p2+p3) : null;

      return `
        <tr data-id="${escAttr(student.id)}">
          <td><b>${esc(String(student.last||'').toUpperCase())} ${esc(student.first||'')}</b></td>
          <td>${esc(student.classroom||'')}</td>
          <td>${time(student.races?.[1]?.totalMs)}</td>
          <td>${time(student.races?.[2]?.totalMs)}</td>
          <td>${sc ? time(sc.best) : '—'}</td>
          <td>${sc ? fmtPts(sc.pp) : '—'}</td>
          <td title="200 le plus rapide : ${sc?escAttr(time(sc.fastest200)):'—'} · 200 le plus lent : ${sc?escAttr(time(sc.slowest200)):'—'}">${sc ? fmtSpread(sc.spread) : '—'}</td>
          <td>${sc ? fmtPts(sc.rp) : '—'}</td>
          <td><b>${sc ? fmtPts(sc.total) : '—'}</b></td>
          <td>
            <select class="afl-allocation" data-id="${escAttr(student.id)}">
              <option value="2-6" ${alloc.key==='2-6'?'selected':''}>AFL2 /2 · AFL3 /6</option>
              <option value="4-4" ${alloc.key==='4-4'?'selected':''}>AFL2 /4 · AFL3 /4</option>
              <option value="6-2" ${alloc.key==='6-2'?'selected':''}>AFL2 /6 · AFL3 /2</option>
            </select>
          </td>
          <td>
            <select class="afl-level" data-id="${escAttr(student.id)}" data-key="afl2Level">
              <option value="">Niveau…</option>
              ${[1,2,3,4].map(n=>`<option value="${n}" ${String(l2)===String(n)?'selected':''}>Niv. ${n}</option>`).join('')}
            </select>
            <div class="afl-points">${p2==null?'—':fmtPts(p2)+' / '+alloc.a2}</div>
          </td>
          <td>
            <select class="afl-level" data-id="${escAttr(student.id)}" data-key="afl3Level">
              <option value="">Niveau…</option>
              ${[1,2,3,4].map(n=>`<option value="${n}" ${String(l3)===String(n)?'selected':''}>Niv. ${n}</option>`).join('')}
            </select>
            <div class="afl-points">${p3==null?'—':fmtPts(p3)+' / '+alloc.a3}</div>
          </td>
          <td><b>${final==null?'—':fmtPts(final)}</b></td>
        </tr>`;
    }).join('');

    body.querySelectorAll('.afl-allocation').forEach(select=>{
      select.onchange=()=>{
        const session = activeSession();
        const student = session?.students?.find(s=>String(s.id)===String(select.dataset.id));
        if(!student) return;
        student.aflAllocation = select.value;
        save();
        renderResults();
      };
    });

    body.querySelectorAll('.afl-level').forEach(select=>{
      select.onchange=()=>{
        const session = activeSession();
        const student = session?.students?.find(s=>String(s.id)===String(select.dataset.id));
        if(!student) return;
        student[select.dataset.key] = select.value==='' ? '' : Number(select.value);
        save();
        renderResults();
      };
    });
  };

  renderStudents = function(){
    const body = $('students');
    if(!body) return;
    body.innerHTML = visibleStudents().map(student=>{
      const sc = ccfScore(student);
      return `
        <tr>
          <td><b>${esc(String(student.last||'').toUpperCase())} ${esc(student.first||'')}</b></td>
          <td>${esc(student.classroom||'')}</td>
          <td>${esc(student.project1 || student.races?.[1]?.project || '')}</td>
          <td>${esc(student.project2 || student.races?.[2]?.project || '')}</td>
          <td>${time(student.races?.[1]?.totalMs)}</td>
          <td>${time(student.races?.[2]?.totalMs)}</td>
          <td><b>${sc ? fmtPts(sc.total)+'/12' : '—'}</b></td>
        </tr>`;
    }).join('');
  };

  try{ render(); }catch(e){ console.error('evaluation-ccf init',e); }
})();
