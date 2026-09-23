(() => {
  "use strict";

  const DEFAULT_BAREME = {
    girls: [
      ["5:00",6],["5:30",6],["5:37",5.75],["5:44",5.5],["5:52",5.25],
      ["6:00",5],["6:08",4.75],["6:16",4.5],["6:24",4.25],["6:32",4],
      ["6:40",3.75],["6:48",3.5],["6:52",3.25],["7:00",3],["7:14",2.75],
      ["7:28",2.5],["7:42",2.25],["7:56",2],["8:10",1.75],["8:24",1.5],
      ["8:40",1.25],["8:56",1],["9:10",0.75],["9:26",0.5],["9:42",0.25]
    ],
    boys: [
      ["4:00",6],["4:45",6],["4:47",5.75],["4:49",5.5],["4:52",5.25],
      ["4:55",5],["4:58",4.75],["5:01",4.5],["5:05",4.25],["5:09",4],
      ["5:13",3.75],["5:17",3.5],["5:21",3.25],["5:25",3],["5:41",2.75],
      ["5:57",2.5],["6:13",2.25],["6:29",2],["6:45",1.75],["6:54",1.5],
      ["7:05",1.25],["7:20",1],["7:35",0.75],["7:50",0.5],["8:05",0.25]
    ],
    gap: [
      [26,0],[25,.25],[24,.5],[23,.5],[22,.5],[21,.5],[20,.5],[19,.75],
      [18,.75],[17,.75],[16,.75],[15,1],[14,1],[13,1],[12,1.25],[11,1.25],
      [10,1.5],[9,1.5],[8,2],[7,2],[6,2],[4,2],[3,2],[2,2],[1,2],[0,2]
    ],
    efficiency: [
      [24,0],[23,.25],[22,.5],[21,.5],[20,1],[19,1.25],[18,1.5],[17,1.75],
      [16,2],[15,2.25],[14,2.5],[13,2.75],[12,3],[11,3.5],[10,4],[9,4.5],
      [8,5],[7,5.5],[6,5.75],[5,6],[4,6],[3,6],[2,6],[1,6],[0,6]
    ]
  };

  function clone(v) {
    return JSON.parse(JSON.stringify(v));
  }

  function parseTime(text) {
    const raw = String(text || "").trim().replace(",", ".");
    if (!raw) return null;
    const p = raw.split(":");
    if (p.length === 2) {
      const m = Number(p[0]);
      const s = Number(p[1]);
      if (Number.isFinite(m) && Number.isFinite(s)) return (m * 60 + s) * 1000;
    }
    const n = Number(raw);
    return Number.isFinite(n) ? n * 1000 : null;
  }

  function timeLabel(ms) {
    if (ms == null) return "—";
    const total = Math.round(Number(ms) / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return m + "min " + String(s).padStart(2,"0") + "s";
  }

  function fmtPts(v) {
    return String(Math.round(Number(v || 0) * 100) / 100).replace(".", ",");
  }

  function settings() {
    db.settings = db.settings || {};
    db.settings.exam500Bareme =
      db.settings.exam500Bareme || clone(DEFAULT_BAREME);
    return db.settings.exam500Bareme;
  }

  function performancePoints(student) {
    const rows = student.sex === "M" ? settings().boys : settings().girls;
    const total = (student.exam500?.races || []).reduce((s,r) => s + Number(r.total500Ms || 0), 0);
    if (!total) return 0;

    const thresholds = rows
      .map(([t,p]) => ({ms:parseTime(t), p:Number(p)}))
      .filter(x => x.ms != null)
      .sort((a,b)=>a.ms-b.ms);

    let points = 0;
    for (const row of thresholds) {
      if (total <= row.ms) {
        points = row.p;
        break;
      }
    }

    return points;
  }

  function gapSeconds(student) {
    const races = student.exam500?.races || [];
    if (races.length < 2) return null;
    const a = races[0];
    const b = races[1];
    const e1 = a.projectMs ? Math.abs(Number(a.total500Ms)-Number(a.projectMs))/1000 : 0;
    const e2 = b.projectMs ? Math.abs(Number(b.total500Ms)-Number(b.projectMs))/1000 : 0;
    return Math.round(e1 + e2);
  }

  function tableScore(rows, seconds) {
    if (seconds == null) return 0;
    const sorted = rows.slice().sort((a,b)=>Number(b[0])-Number(a[0]));
    for (const [limit,pts] of sorted) {
      if (seconds >= Number(limit)) return Number(pts);
    }
    return 0;
  }

  function efficiencySeconds(student) {
    const races = student.exam500?.races || [];
    if (races.length < 3) return null;
    const vals = races.map(r=>Number(r.total500Ms||0)).filter(v=>v>0);
    if (vals.length < 3) return null;
    return Math.round((Math.max(...vals)-Math.min(...vals))/1000);
  }

  function score500(student) {
    if (!student?.exam500?.races?.length) return null;
    const perf = performancePoints(student);
    const gap = gapSeconds(student);
    const eff = efficiencySeconds(student);
    const gapPts = tableScore(settings().gap, gap);
    const effPts = tableScore(settings().efficiency, eff);

    return {
      perf,
      gap,
      gapPts,
      eff,
      effPts,
      afl1: perf + effPts,
      totalRaceMs: student.exam500.races.reduce((s,r)=>s+Number(r.total500Ms||0),0)
    };
  }

  function ensureBaremeButton() {
    const manager = document.getElementById("groupSessionManager");
    if (!manager || document.getElementById("exam500BaremeBtn")) return;

    const actions = manager.querySelector(".session-manager-actions");
    if (!actions) return;

    const button = document.createElement("button");
    button.id = "exam500BaremeBtn";
    button.type = "button";
    button.textContent = "⚙️ Barème 3 × 500";
    button.onclick = openBaremeDialog;
    actions.appendChild(button);
  }

  function openBaremeDialog() {
    let d = document.getElementById("exam500BaremeDialog");
    if (!d) {
      d = document.createElement("dialog");
      d.id = "exam500BaremeDialog";
      document.body.appendChild(d);
    }

    const b = settings();

    const rowsToText = rows => rows.map(r => r.join(" = ")).join("\n");

    d.innerHTML = `
      <div style="min-width:min(920px,94vw);max-height:86vh;overflow:auto;padding:8px">
        <h2>Barème 3 × 500</h2>
        <p>Modifie les valeurs puis enregistre. Les calculs seront immédiatement recalculés.</p>

        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px">
          <label><b>Performance filles /6</b><textarea id="b500Girls" style="width:100%;min-height:280px">${rowsToText(b.girls)}</textarea></label>
          <label><b>Performance garçons /6</b><textarea id="b500Boys" style="width:100%;min-height:280px">${rowsToText(b.boys)}</textarea></label>
          <label><b>Écart annonce /2</b><textarea id="b500Gap" style="width:100%;min-height:280px">${rowsToText(b.gap)}</textarea></label>
          <label><b>Indice efficacité /6</b><textarea id="b500Eff" style="width:100%;min-height:280px">${rowsToText(b.efficiency)}</textarea></label>
        </div>

        <p style="font-size:13px;color:#64748b">Format d'une ligne : <b>temps = points</b> pour la performance, ou <b>secondes = points</b> pour les écarts.</p>

        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px">
          <button id="b500Reset" type="button">Réinitialiser</button>
          <button id="b500Cancel" type="button">Annuler</button>
          <button id="b500Save" type="button">Enregistrer</button>
        </div>
      </div>
    `;

    const parseRows = (text, timeMode) =>
      String(text||"")
        .split(/\n+/)
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => {
          const parts = line.split("=").map(x=>x.trim());
          if (parts.length !== 2) return null;
          return [timeMode ? parts[0] : Number(parts[0]), Number(parts[1])];
        })
        .filter(Boolean);

    d.querySelector("#b500Cancel").onclick = () => d.close();

    d.querySelector("#b500Reset").onclick = () => {
      if (!confirm("Réinitialiser le barème 3 × 500 ?")) return;
      db.settings.exam500Bareme = clone(DEFAULT_BAREME);
      save();
      d.close();
      if (typeof render === "function") render();
      toast?.("Barème 3 × 500 réinitialisé");
    };

    d.querySelector("#b500Save").onclick = () => {
      const next = {
        girls: parseRows(d.querySelector("#b500Girls").value, true),
        boys: parseRows(d.querySelector("#b500Boys").value, true),
        gap: parseRows(d.querySelector("#b500Gap").value, false),
        efficiency: parseRows(d.querySelector("#b500Eff").value, false)
      };

      if (!next.girls.length || !next.boys.length || !next.gap.length || !next.efficiency.length) {
        alert("Le barème contient une zone vide ou mal formatée.");
        return;
      }

      db.settings.exam500Bareme = next;
      save();
      d.close();
      if (typeof render === "function") render();
      toast?.("Barème 3 × 500 enregistré");
    };

    d.showModal();
  }

  function handle500(data) {
    if (data.type !== "DF_3X500_RESULT") return false;

    let group = activeGroup();
    let session = activeSession();

    if (!group || !session) {
      const ok = prepareScanner();
      if (!ok) return true;
      group = activeGroup();
      session = activeSession();
    }

    if (session.status === "locked") {
      scanError("Évaluation verrouillée : scan refusé.");
      return true;
    }

    let student = findStudent(session, data.studentId);
    if (!student) {
      student = buildStudent(data);
      session.students.push(student);
    }

    updateIdentity(student,data);

    student.exam500 = {
      projects: Array.isArray(data.projects) ? data.projects : [],
      races: (data.races || []).map(r => ({
        race:Number(r.race),
        project:r.project || null,
        projectMs:r.project ? parseTime(r.project) : null,
        split250Ms:Number(r.split250Ms||0),
        total500Ms:Number(r.total500Ms||0)
      })),
      scannedAt:Date.now()
    };

    session.type = "exam500";
    updateMasterStudent(group,student);

    db.history.unshift({
      at:Date.now(),
      groupId:group.id,
      sessionId:session.id,
      studentId:student.id,
      type:"exam500"
    });

    save();
    beep();

    const sc = score500(student);
    const message = document.getElementById("scanMessage");
    if (message) {
      message.className = "scan-ok";
      message.innerHTML =
        "✓ " + esc(student.last.toUpperCase()) + " " + esc(student.first) +
        "<br>" + esc(student.classroom) +
        " · 3 × 500 · " + timeLabel(sc?.totalRaceMs);
    }

    toast?.("3 × 500 enregistré");
    if (typeof render === "function") render();
    return true;
  }

  function installBridge() {
    if (typeof window.handleQR !== "function" || window.handleQR.__exam500Bridge) return;
    const original = window.handleQR;

    const wrapped = function(raw) {
      let data = raw;
      try {
        if (typeof raw === "string") data = JSON.parse(raw);
      } catch {}

      if (data?.type === "DF_3X500_RESULT") {
        handle500(data);
        return;
      }

      return original(raw);
    };

    wrapped.__exam500Bridge = true;
    window.handleQR = wrapped;
  }

  function render500TableIfNeeded() {
    const session = activeSession();
    if (!session || session.type !== "exam500") return;

    const body = document.getElementById("students");
    if (!body) return;

    const rows = visibleStudents();

    body.innerHTML = rows.map(student => {
      const sc = score500(student);
      const r = student.exam500?.races || [];
      const t = n => r.find(x=>x.race===n)?.total500Ms;
      const p = n => r.find(x=>x.race===n)?.project;
      return `
        <tr>
          <td><b>${esc(String(student.last||"").toUpperCase())} ${esc(student.first||"")}</b></td>
          <td>${esc(student.classroom||"")}</td>
          <td>${esc(p(1)||"—")}</td>
          <td>${timeLabel(t(1))}</td>
          <td>${esc(p(2)||"—")}</td>
          <td>${timeLabel(t(2))}</td>
          <td><b>${sc ? fmtPts(sc.afl1)+"/12" : "—"}</b></td>
          <td><button type="button" class="student-edit" data-id="${esc(student.id)}">✏️ Corriger</button></td>
        </tr>
      `;
    }).join("");

    body.querySelectorAll(".student-edit").forEach(button => {
      button.onclick = () => openDetail?.(button.dataset.id);
    });

    const head = document.querySelector(".student-list-card thead tr");
    if (head) {
      head.innerHTML =
        "<th>Élève</th><th>Classe</th><th>Annonce C1</th><th>C1</th><th>Annonce C2</th><th>C2</th><th>AFL1</th><th>Action</th>";
    }
  }

  function render500ResultsIfNeeded() {
    const session = activeSession();
    if (!session || session.type !== "exam500") return;

    const body = document.getElementById("resultRows");
    if (!body) return;

    body.innerHTML = visibleStudents().map(student => {
      const sc = score500(student);
      const r = student.exam500?.races || [];
      const t = n => r.find(x=>x.race===n)?.total500Ms;
      return `
        <tr>
          <td><b>${esc(String(student.last||"").toUpperCase())} ${esc(student.first||"")}</b></td>
          <td>${esc(student.classroom||"")}</td>
          <td>${timeLabel(t(1))}</td>
          <td>${timeLabel(t(2))}</td>
          <td>${timeLabel(t(3))}</td>
          <td>${sc ? timeLabel(sc.totalRaceMs) : "—"}</td>
          <td>${sc ? fmtPts(sc.perf)+"/6" : "—"}</td>
          <td>${sc ? sc.eff+" s" : "—"}</td>
          <td>${sc ? fmtPts(sc.effPts)+"/6" : "—"}</td>
          <td>${sc ? sc.gap+" s" : "—"}</td>
          <td>${sc ? fmtPts(sc.gapPts)+"/2" : "—"}</td>
        </tr>
      `;
    }).join("");

    const head = document.querySelector("#results .table thead tr");
    if (head) {
      head.innerHTML =
        "<th>Élève</th><th>Classe</th><th>C1</th><th>C2</th><th>C3</th><th>Cumul</th><th>Perf /6</th><th>Indice</th><th>Efficacité /6</th><th>Écart annonces</th><th>/2</th>";
    }

    const title = document.querySelector("#results h2");
    if (title) title.textContent = "Résultats 3 × 500";
  }

  function installRenderHooks() {
    if (typeof window.render !== "function" || window.render.__exam500View) return;
    const original = window.render;

    const wrapped = function() {
      original();
      ensureBaremeButton();
      render500TableIfNeeded();
      render500ResultsIfNeeded();
    };

    wrapped.__exam500View = true;
    window.render = wrapped;
    wrapped();
  }

  function install() {
    settings();
    installBridge();
    installRenderHooks();
    ensureBaremeButton();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install);
  } else {
    install();
  }
})();