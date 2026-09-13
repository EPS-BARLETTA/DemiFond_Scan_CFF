(()=>{
  const ALLOCATION_POINTS={2:{1:0.5,2:1,3:1.5,4:2},4:{1:1,2:2,3:3,4:4},6:{1:1.5,2:3,3:4.5,4:6}};
  const PERF_F=[306,299,292,285,278,272,266,260,254,248,242,236,230,225,220,215,210,205,200,195,190,185,180,175];
  const PERF_M=[242,237,232,227,222,217,212,207,202,197,192,188,184,180,176,172,168,165,162,159,156,153,150,147];

  function laps200(splits){
    if(!Array.isArray(splits)||splits.length<4)return[];
    const a=splits.slice(0,4).map(Number);
    if(a.some(v=>!Number.isFinite(v)))return[];
    return a.map((v,i)=>i===0?v:v-a[i-1]);
  }

  function perf(sec,sex){
    const scale=String(sex||'').toUpperCase()==='M'?PERF_M:PERF_F;
    let p=0;
    scale.forEach((t,i)=>{if(sec<=t)p=(i+1)*0.25;});
    return Math.min(6,p);
  }

  function efficiency(ms){
    if(!Number.isFinite(Number(ms)))return 0;

    const s=Number(ms)/1000;

    if(s>=21)return 0;
    if(s>=20)return.5;
    if(s>=18)return 1;
    if(s>=16)return 1.5;
    if(s>=14)return 2;
    if(s>=12)return 2.5;
    if(s>=10)return 3;
    if(s>=9)return 3.5;
    if(s>=8)return 4;
    if(s>=7)return 4.5;
    if(s>=6)return 5;
    if(s>=5)return 5.5;
    if(s<4)return 6;

    return 5.5;
  }

  function scoreCCF(student){
    const r1=student?.races?.[1],r2=student?.races?.[2];

    if(!r1||!r2)return null;

    const l1=laps200(r1.splits),l2=laps200(r2.splits);

    if(l1.length!==4||l2.length!==4)return null;

    const t1=Number(r1.totalMs),t2=Number(r2.totalMs);

    if(!Number.isFinite(t1)||!Number.isFinite(t2))return null;

    const all=[...l1,...l2],
      best=Math.min(t1,t2),
      fast=Math.min(...all),
      slow=Math.max(...all),
      spread=slow-fast;

    const pp=perf(best/1000,student.sex),
      rp=efficiency(spread);

    return{
      best,
      fastest200:fast,
      slowest200:slow,
      spread,
      pp,
      rp,
      total:pp+rp,
      laps1:l1,
      laps2:l2
    };
  }

  function allocation(student){
    const key=['2-6','4-4','6-2'].includes(student.aflAllocation)
      ?student.aflAllocation
      :'4-4';

    const[a2,a3]=key.split('-').map(Number);

    return{key,a2,a3};
  }

  function levelPoints(max,level){
    return ALLOCATION_POINTS[max]?.[Number(level)]??null;
  }

  function parseProject(v){
    if(v==null||v==='')return null;

    if(typeof v==='number'&&Number.isFinite(v))return v;

    const s=String(v).trim().replace(',', '.');

    if(/^\d+(\.\d+)?$/.test(s))
      return Number(s)*1000;

    const m=s.match(/^(\d+):([0-5]?\d)(?:\.(\d{1,2}))?$/);

    if(!m)return null;

    const cs=m[3]
      ?Number(m[3].padEnd(2,'0'))
      :0;

    return Number(m[1])*60000+
      Number(m[2])*1000+
      cs*10;
  }

  function projectOf(student,race){
    return student[`project${race}`]||
      student?.races?.[race]?.project||
      '';
  }

  function projectMetrics(student){
    const p1=parseProject(projectOf(student,1)),
      p2=parseProject(projectOf(student,2));

    const t1=Number(student?.races?.[1]?.totalMs),
      t2=Number(student?.races?.[2]?.totalMs);

    if(
      p1==null||
      p2==null||
      !Number.isFinite(t1)||
      !Number.isFinite(t2)
    )return null;

    const e1=Math.abs(t1-p1),
      e2=Math.abs(t2-p2),
      sum=e1+e2,
      s=sum/1000;

    let level=1;

    if(s<8)level=4;
    else if(s<=15)level=3;
    else if(s<=24)level=2;

    return{
      p1,
      p2,
      e1,
      e2,
      sum,
      level
    };
  }

  function fmtPts(v){
    return v==null||!Number.isFinite(Number(v))
      ?'—'
      :Number(v).toLocaleString(
        'fr-FR',
        {maximumFractionDigits:2}
      );
  }

  function fmtSec(ms){
    return ms==null||!Number.isFinite(Number(ms))
      ?'—'
      :(Number(ms)/1000).toLocaleString(
        'fr-FR',
        {
          minimumFractionDigits:2,
          maximumFractionDigits:2
        }
      )+' s';
  }

  function fmtTime(ms){
    return ms==null||!Number.isFinite(Number(ms))
      ?'—'
      :time(Number(ms));
  }

  function escAttr(v){
    return String(v??'')
      .replace(/&/g,'&amp;')
      .replace(/"/g,'&quot;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;');
  }

  function q(v){
    return '"'+String(v??'')
      .replace(/"/g,'""')+'"';
  }

  function currentStudent(id){
    return activeSession()?.students?.find(
      s=>String(s.id)===String(id)
    );
  }

  score=scoreCCF;

  function ensureTools(){
    const card=$('resultRows')?.closest('.card');

    if(!card)return;

    if(!document.getElementById('ccfTools')){
      const d=document.createElement('div');

      d.id='ccfTools';
      d.className='toolbar';

      d.innerHTML=
        '<button id="exportCsvCCF">Exporter CSV</button>'+
        '<button id="exportPdfCCF">PDF / Imprimer</button>';

      const filters=$('resultFilters');

      filters?.before(d);

      d.querySelector('#exportCsvCCF').onclick=exportCSV;
      d.querySelector('#exportPdfCCF').onclick=printPDF;
    }

    if(!document.getElementById('ccfDetailDialog')){
      const dlg=document.createElement('dialog');

      dlg.id='ccfDetailDialog';

      dlg.innerHTML=
        '<div id="ccfDetailBox" '+
        'style="min-width:min(980px,92vw);'+
        'max-height:85vh;overflow:auto;'+
        'background:#fff;padding:18px;'+
        'border-radius:16px"></div>';

      document.body.appendChild(dlg);
    }
  }

  renderResults=function(){
    ensureTools();

    const body=$('resultRows');

    if(!body)return;

    const h=body
      .closest('table')
      ?.querySelector('thead tr');

    if(h)h.innerHTML=
      '<th>Élève</th>'+
      '<th>Classe</th>'+
      '<th>Est. C1</th>'+
      '<th>C1</th>'+
      '<th>Écart</th>'+
      '<th>Est. C2</th>'+
      '<th>C2</th>'+
      '<th>Écart</th>'+
      '<th>Écart cum.</th>'+
      '<th>Niv. estim.</th>'+
      '<th>Meilleur</th>'+
      '<th>Perf /6</th>'+
      '<th>Écart 200</th>'+
      '<th>Eff. /6</th>'+
      '<th>AFL1 /12</th>'+
      '<th>Répart.</th>'+
      '<th>AFL2</th>'+
      '<th>AFL3</th>'+
      '<th>/20</th>'+
      '<th>Détails</th>';

    body.innerHTML=
      visibleStudents()
        .map(student=>{

          const sc=scoreCCF(student),
            pm=projectMetrics(student),
            a=allocation(student),
            l2=student.afl2Level||'',
            l3=student.afl3Level||'',
            p2=levelPoints(a.a2,l2),
            p3=levelPoints(a.a3,l3),
            final=sc&&p2!=null&&p3!=null
              ?Math.min(20,sc.total+p2+p3)
              :null;

          return `
            <tr data-id="${escAttr(student.id)}">

              <td>
                <b>
                  ${esc(String(student.last||'').toUpperCase())}
                  ${esc(student.first||'')}
                </b>
              </td>

              <td>${esc(student.classroom||'')}</td>

              <td>${esc(projectOf(student,1))}</td>

              <td>
                ${fmtTime(student.races?.[1]?.totalMs)}
              </td>

              <td>
                ${pm?fmtSec(pm.e1):'—'}
              </td>

              <td>${esc(projectOf(student,2))}</td>

              <td>
                ${fmtTime(student.races?.[2]?.totalMs)}
              </td>

              <td>
                ${pm?fmtSec(pm.e2):'—'}
              </td>

              <td>
                ${pm?fmtSec(pm.sum):'—'}
              </td>

              <td>
                ${pm?'Niv. '+pm.level:'—'}
              </td>

              <td>
                ${sc?fmtTime(sc.best):'—'}
              </td>

              <td>
                ${sc?fmtPts(sc.pp):'—'}
              </td>

              <td>
                ${sc?fmtSec(sc.spread):'—'}
              </td>

              <td>
                ${sc?fmtPts(sc.rp):'—'}
              </td>

              <td>
                <b>
                  ${sc?fmtPts(sc.total):'—'}
                </b>
              </td>

              <td>

                <select
                  class="afl-allocation"
                  data-id="${escAttr(student.id)}"
                >

                  <option
                    value="2-6"
                    ${a.key==='2-6'?'selected':''}
                  >
                    2-6
                  </option>

                  <option
                    value="4-4"
                    ${a.key==='4-4'?'selected':''}
                  >
                    4-4
                  </option>

                  <option
                    value="6-2"
                    ${a.key==='6-2'?'selected':''}
                  >
                    6-2
                  </option>

                </select>

              </td>

              <td>

                <select
                  class="afl-level"
                  data-id="${escAttr(student.id)}"
                  data-key="afl2Level"
                >

                  <option value="">—</option>

                  ${[1,2,3,4]
                    .map(n=>`
                      <option
                        value="${n}"
                        ${
                          String(l2)===String(n)
                            ?'selected'
                            :''
                        }
                      >
                        N${n}
                      </option>
                    `)
                    .join('')
                  }

                </select>

                <div>
                  ${
                    p2==null
                      ?'—'
                      :fmtPts(p2)+'/'+a.a2
                  }
                </div>

              </td>

              <td>

                <select
                  class="afl-level"
                  data-id="${escAttr(student.id)}"
                  data-key="afl3Level"
                >

                  <option value="">—</option>

                  ${[1,2,3,4]
                    .map(n=>`
                      <option
                        value="${n}"
                        ${
                          String(l3)===String(n)
                            ?'selected'
                            :''
                        }
                      >
                        N${n}
                      </option>
                    `)
                    .join('')
                  }

                </select>

                <div>
                  ${
                    p3==null
                      ?'—'
                      :fmtPts(p3)+'/'+a.a3
                  }
                </div>

              </td>

              <td>
                <b>
                  ${
                    final==null
                      ?'—'
                      :fmtPts(final)
                  }
                </b>
              </td>

              <td>

                <button
                  class="ccf-detail"
                  data-id="${escAttr(student.id)}"
                >
                  Voir / modifier
                </button>

              </td>

            </tr>
          `;
        })
        .join('');

    body
      .querySelectorAll('.afl-allocation')
      .forEach(x=>{
        x.onchange=()=>{
          const s=currentStudent(x.dataset.id);

          if(!s)return;

          s.aflAllocation=x.value;

          save();
          renderResults();
        };
      });

    body
      .querySelectorAll('.afl-level')
      .forEach(x=>{
        x.onchange=()=>{
          const s=currentStudent(x.dataset.id);

          if(!s)return;

          s[x.dataset.key]=
            x.value===''
              ?''
              :Number(x.value);

          save();
          renderResults();
        };
      });

    body
      .querySelectorAll('.ccf-detail')
      .forEach(
        b=>b.onclick=
          ()=>openDetail(b.dataset.id)
      );
  };

  renderStudents=function(){
    const body=$('students');

    if(!body)return;

    body.innerHTML=
      visibleStudents()
        .map(s=>{

          const sc=scoreCCF(s),
            pm=projectMetrics(s);

          return `
            <tr>

              <td>
                <b>
                  ${esc(String(s.last||'').toUpperCase())}
                  ${esc(s.first||'')}
                </b>
              </td>

              <td>
                ${esc(s.classroom||'')}
              </td>

              <td>
                ${esc(projectOf(s,1))}
                ${pm?' · '+fmtSec(pm.e1):''}
              </td>

              <td>
                ${esc(projectOf(s,2))}
                ${pm?' · '+fmtSec(pm.e2):''}
              </td>

              <td>
                ${fmtTime(s.races?.[1]?.totalMs)}
              </td>

              <td>
                ${fmtTime(s.races?.[2]?.totalMs)}
              </td>

              <td>
                <b>
                  ${sc?fmtPts(sc.total)+'/12':'—'}
                </b>
              </td>

            </tr>
          `;
        })
        .join('');
  };

  function field(label,id,value,type='text'){
    return `
      <label
        style="
          display:flex;
          flex-direction:column;
          gap:4px
        "
      >

        <span>${label}</span>

        <input
          id="${id}"
          type="${type}"
          value="${escAttr(value??'')}"
        >

      </label>
    `;
  }

  function openDetail(id){
    const s=currentStudent(id);

    if(!s)return;

    const dlg=$('ccfDetailDialog'),
      box=$('ccfDetailBox');

    const r1=s.races?.[1]||{splits:[]},
      r2=s.races?.[2]||{splits:[]},
      sc=scoreCCF(s),
      pm=projectMetrics(s);

    box.innerHTML=`

      <div
        style="
          display:flex;
          justify-content:space-between;
          gap:12px;
          align-items:center
        "
      >

        <h2>
          ${esc(String(s.last||'').toUpperCase())}
          ${esc(s.first||'')}
        </h2>

        <button id="closeCCFDetail">
          Fermer
        </button>

      </div>

      <p>
        ${esc(s.classroom||'')}
        ·
        ${esc(s.sex||'')}
      </p>

      <div
        style="
          display:grid;
          grid-template-columns:
            repeat(2,minmax(280px,1fr));
          gap:18px
        "
      >

        <section>

          <h3>Course 1</h3>

          ${field(
            'Estimation',
            'e_p1',
            projectOf(s,1)
          )}

          ${field(
            'Temps total (ms)',
            'e_t1',
            r1.totalMs,
            'number'
          )}

          ${[0,1,2,3]
            .map(i=>
              field(
                `${(i+1)*200} m cumulé (ms)`,
                `e_s1_${i}`,
                r1.splits?.[i]??'',
                'number'
              )
            )
            .join('')
          }

        </section>

        <section>

          <h3>Course 2</h3>

          ${field(
            'Estimation',
            'e_p2',
            projectOf(s,2)
          )}

          ${field(
            'Temps total (ms)',
            'e_t2',
            r2.totalMs,
            'number'
          )}

          ${[0,1,2,3]
            .map(i=>
              field(
                `${(i+1)*200} m cumulé (ms)`,
                `e_s2_${i}`,
                r2.splits?.[i]??'',
                'number'
              )
            )
            .join('')
          }

        </section>

      </div>

      <hr>

      <div
        style="
          display:grid;
          grid-template-columns:
            repeat(4,minmax(120px,1fr));
          gap:10px
        "
      >

        <div>
          <b>AFL1</b><br>
          ${sc?fmtPts(sc.total)+'/12':'—'}
        </div>

        <div>
          <b>Perf.</b><br>
          ${sc?fmtPts(sc.pp)+'/6':'—'}
        </div>

        <div>
          <b>Efficacité</b><br>
          ${sc?fmtPts(sc.rp)+'/6':'—'}
        </div>

        <div>
          <b>Écart 200</b><br>
          ${sc?fmtSec(sc.spread):'—'}
        </div>

      </div>

      ${
        sc
          ?`
            <p>
              <b>Fractions C1 :</b>
              ${sc.laps1.map(fmtTime).join(' · ')}
            </p>

            <p>
              <b>Fractions C2 :</b>
              ${sc.laps2.map(fmtTime).join(' · ')}
            </p>

            <p>
              <b>200 le plus rapide :</b>
              ${fmtTime(sc.fastest200)}
              ·
              <b>200 le plus lent :</b>
              ${fmtTime(sc.slowest200)}
            </p>
          `
          :''
      }

      ${
        pm
          ?`
            <p>
              <b>Estimation/régulation :</b>
              écart cumulé ${fmtSec(pm.sum)}
              → niveau indicatif ${pm.level}
            </p>
          `
          :''
      }

      <div
        style="
          display:flex;
          gap:10px;
          justify-content:flex-end
        "
      >

        <button id="saveCCFDetail">
          Enregistrer et recalculer
        </button>

      </div>
    `;

    $('closeCCFDetail').onclick=
      ()=>dlg.close();

    $('saveCCFDetail').onclick=()=>{

      s.project1=
        $('e_p1').value.trim();

      s.project2=
        $('e_p2').value.trim();

      s.races=s.races||{};

      [1,2].forEach(r=>{

        s.races[r]=
          s.races[r]||{};

        s.races[r].project=
          s[`project${r}`];

        s.races[r].totalMs=
          Number(
            $(`e_t${r}`).value
          )||0;

        s.races[r].splits=
          [0,1,2,3]
            .map(
              i=>
                Number(
                  $(`e_s${r}_${i}`).value
                )||0
            );
      });

      save();

      dlg.close();

      render();
    };

    dlg.showModal();
  }

  function exportRows(){
    return visibleStudents()
      .map(s=>{

        const sc=scoreCCF(s),
          pm=projectMetrics(s),
          a=allocation(s),
          p2=levelPoints(
            a.a2,
            s.afl2Level
          ),
          p3=levelPoints(
            a.a3,
            s.afl3Level
          ),
          final=
            sc&&p2!=null&&p3!=null
              ?Math.min(
                20,
                sc.total+p2+p3
              )
              :null;

        return{
          s,
          sc,
          pm,
          a,
          p2,
          p3,
          final
        };
      });
  }

  function exportCSV(){

    const headers=[
      'Nom',
      'Prénom',
      'Classe',
      'Sexe',
      'Estimation C1',
      'Temps C1',
      'Écart C1',
      'C1 200',
      'C1 400',
      'C1 600',
      'C1 800',
      'Estimation C2',
      'Temps C2',
      'Écart C2',
      'C2 200',
      'C2 400',
      'C2 600',
      'C2 800',
      'Écart estimation cumulé',
      'Niveau estimation',
      'Meilleur 800',
      'Performance /6',
      '200 plus rapide',
      '200 plus lent',
      'Écart 200',
      'Efficacité /6',
      'AFL1 /12',
      'Répartition',
      'AFL2',
      'AFL3',
      'Note /20'
    ];

    const rows=
      exportRows()
        .map(
          ({
            s,
            sc,
            pm,
            a,
            p2,
            p3,
            final
          })=>[

            s.last,
            s.first,
            s.classroom,
            s.sex,

            projectOf(s,1),

            fmtTime(
              s.races?.[1]?.totalMs
            ),

            pm
              ?fmtSec(pm.e1)
              :'',

            ...(s.races?.[1]?.splits||[])
              .slice(0,4)
              .map(fmtTime),

            projectOf(s,2),

            fmtTime(
              s.races?.[2]?.totalMs
            ),

            pm
              ?fmtSec(pm.e2)
              :'',

            ...(s.races?.[2]?.splits||[])
              .slice(0,4)
              .map(fmtTime),

            pm
              ?fmtSec(pm.sum)
              :'',

            pm
              ?pm.level
              :'',

            sc
              ?fmtTime(sc.best)
              :'',

            sc
              ?fmtPts(sc.pp)
              :'',

            sc
              ?fmtTime(sc.fastest200)
              :'',

            sc
              ?fmtTime(sc.slowest200)
              :'',

            sc
              ?fmtSec(sc.spread)
              :'',

            sc
              ?fmtPts(sc.rp)
              :'',

            sc
              ?fmtPts(sc.total)
              :'',

            a.key,

            p2==null
              ?''
              :`${fmtPts(p2)}/${a.a2}`,

            p3==null
              ?''
              :`${fmtPts(p3)}/${a.a3}`,

            final==null
              ?''
              :fmtPts(final)

          ]
        );

    const csv=
      '\ufeff'+
      [headers,...rows]
        .map(
          r=>
            r.map(q)
              .join(';')
        )
        .join('\n');

    const blob=
      new Blob(
        [csv],
        {
          type:
            'text/csv;charset=utf-8'
        }
      );

    const a=
      document.createElement('a');

    a.href=
      URL.createObjectURL(blob);

    a.download=
      `${
        activeGroup()?.name||
        'groupe'
      }_${
        activeSession()?.label||
        'releve'
      }_CCF.csv`
        .replace(
          /[^a-z0-9_.-]+/gi,
          '_'
        );

    a.click();

    setTimeout(
      ()=>URL.revokeObjectURL(a.href),
      1000
    );
  }

  function printPDF(){

    const g=activeGroup(),
      sess=activeSession(),
      rows=exportRows();

    const detail=
      rows.map(
        ({
          s,
          sc,
          pm,
          a,
          p2,
          p3,
          final
        })=>`

          <tr>

            <td>
              ${esc(String(s.last||'').toUpperCase())}
              ${esc(s.first||'')}
            </td>

            <td>
              ${esc(s.classroom||'')}
            </td>

            <td>
              ${sc?fmtPts(sc.total)+'/12':'—'}
            </td>

            <td>
              ${esc(a.key)}
            </td>

            <td>
              ${
                p2==null
                  ?'—'
                  :fmtPts(p2)+'/'+a.a2
              }
            </td>

            <td>
              ${
                p3==null
                  ?'—'
                  :fmtPts(p3)+'/'+a.a3
              }
            </td>

            <td>
              ${
                final==null
                  ?'—'
                  :fmtPts(final)+'/20'
              }
            </td>

          </tr>
        `
      )
      .join('');

    const full=
      rows.map(
        ({
          s,
          sc,
          pm
        })=>`

          <section>

            <h3>
              ${esc(String(s.last||'').toUpperCase())}
              ${esc(s.first||'')}
              ·
              ${esc(s.classroom||'')}
            </h3>

            <p>
              C1 :
              estimation
              ${esc(projectOf(s,1))||'—'}
              · réalisé
              ${fmtTime(s.races?.[1]?.totalMs)}
              · écart
              ${pm?fmtSec(pm.e1):'—'}
            </p>

            <p>
              Passages C1 :
              ${
                (s.races?.[1]?.splits||[])
                  .slice(0,4)
                  .map(fmtTime)
                  .join(' · ')
                ||
                '—'
              }
            </p>

            <p>
              C2 :
              estimation
              ${esc(projectOf(s,2))||'—'}
              · réalisé
              ${fmtTime(s.races?.[2]?.totalMs)}
              · écart
              ${pm?fmtSec(pm.e2):'—'}
            </p>

            <p>
              Passages C2 :
              ${
                (s.races?.[2]?.splits||[])
                  .slice(0,4)
                  .map(fmtTime)
                  .join(' · ')
                ||
                '—'
              }
            </p>

            <p>
              Écart estimation cumulé :
              ${
                pm
                  ?fmtSec(pm.sum)+
                    ' · niveau indicatif '+
                    pm.level
                  :'—'
              }
            </p>

            <p>
              AFL1 :
              ${
                sc
                  ?fmtPts(sc.total)+
                    '/12 · performance '+
                    fmtPts(sc.pp)+
                    '/6 · efficacité '+
                    fmtPts(sc.rp)+
                    '/6 · écart 200 '+
                    fmtSec(sc.spread)
                  :'—'
              }
            </p>

          </section>
        `
      )
      .join('');

    const w=
      window.open(
        '',
        '_blank'
      );

    if(!w)
      return alert(
        'Autorise les fenêtres surgissantes pour générer le PDF.'
      );

    w.document.write(
      `<!doctype html>
      <html>

      <head>

        <meta charset="utf-8">

        <title>
          CCF Demi-fond
        </title>

        <style>

          body{
            font-family:Arial,sans-serif;
            padding:24px;
            color:#111
          }

          h1{
            margin-bottom:4px
          }

          table{
            width:100%;
            border-collapse:collapse;
            margin:20px 0
          }

          th,
          td{
            border:1px solid #bbb;
            padding:6px;
            font-size:12px
          }

          th{
            background:#eee
          }

          section{
            break-inside:avoid;
            border-top:1px solid #ccc;
            padding:10px 0
          }

          p{
            margin:5px 0
          }

          @media print{
            button{
              display:none
            }
          }

        </style>

      </head>

      <body>

        <h1>
          Demi-fond CCF
        </h1>

        <p>
          <b>
            ${esc(g?.name||'')}
          </b>
          ·
          ${esc(sess?.label||'')}
        </p>

        <h2>
          Récapitulatif par élève
        </h2>

        <table>

          <thead>

            <tr>
              <th>Élève</th>
              <th>Classe</th>
              <th>AFL1</th>
              <th>Répartition</th>
              <th>AFL2</th>
              <th>AFL3</th>
              <th>Note</th>
            </tr>

          </thead>

          <tbody>
            ${detail}
          </tbody>

        </table>

        <h2>
          Détail AFL1 et courses
        </h2>

        ${full}

        <script>
          window.onload=()=>window.print()
        <\/script>

      </body>

      </html>`
    );

    w.document.close();
  }

  try{
    render();
  }catch(e){
    console.error(
      'evaluation-ccf init',
      e
    );
  }

})();
