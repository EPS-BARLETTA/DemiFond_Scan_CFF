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


  // Barèmes pédagogiques par niveau : allures moyennes en secondes au 500 m.
  const LEVEL_ANCHORS_500 = {
    seconde: {
      girls: [[6,119],[5,130],[4,143],[3,156],[2,171],[1,187]],
      boys: [[6,100],[5,109],[4,119],[3,131],[2,144],[1,158]]
    },
    premiere: {
      girls: [[6,110],[5,120],[4,132],[3,145],[2,159],[1,175]],
      boys: [[6,90],[5,96],[4,104],[3,115],[2,126],[1,139]]
    }
  };

  function makePerformanceRows500(anchors) {
    const rows = [];
    for (let q = 24; q >= 1; q--) {
      const points = q / 4;
      let seconds;
      if (points >= 1) {
        const top = Math.min(5, Math.floor(points));
        const low = top === 5 ? 5 : top;
        const high = top + 1;
        const highSeconds = anchors.find(x => x[0] === high)[1];
        const lowSeconds = anchors.find(x => x[0] === low)[1];
        seconds = lowSeconds + (highSeconds - lowSeconds) * (points - low);
      } else {
        seconds = anchors.find(x => x[0] === 1)[1] + (1 - points) * 40;
      }
      const sum = Math.round(seconds * 3);
      rows.push([Math.floor(sum / 60) + ":" + String(sum % 60).padStart(2,"0"),points]);
    }
    return rows;
  }

  function performancePreset500(level, existing) {
    const spec = LEVEL_ANCHORS_500[level];
    if (!spec) throw Error("Niveau inconnu");
    return {
      girls:makePerformanceRows500(spec.girls),
      boys:makePerformanceRows500(spec.boys),
      gap:clone(existing.gap),
      efficiency:clone(existing.efficiency)
    };
  }

  // The performance table stores the SUM of three 500 m races, not one lap.
  // Keep the official per-500 anchors as the single source of truth.
  const LEGACY_PERFORMANCE_500 = {
    girls: clone(DEFAULT_BAREME.girls),
    boys: clone(DEFAULT_BAREME.boys)
  };
  const officialSeconde500 = performancePreset500("seconde", DEFAULT_BAREME);
  DEFAULT_BAREME.girls = officialSeconde500.girls;
  DEFAULT_BAREME.boys = officialSeconde500.boys;

  function upgradeLegacyPerformance500(bareme, level) {
    if (!bareme || !Array.isArray(bareme.girls) || !Array.isArray(bareme.boys)) return bareme;
    // Upgrade only the untouched legacy performance values; never erase custom scales.
    if (JSON.stringify(bareme.girls) !== JSON.stringify(LEGACY_PERFORMANCE_500.girls) ||
        JSON.stringify(bareme.boys) !== JSON.stringify(LEGACY_PERFORMANCE_500.boys)) return bareme;
    const preset = performancePreset500(level === "premiere" ? "premiere" : "seconde", bareme);
    bareme.girls = preset.girls;
    bareme.boys = preset.boys;
    return bareme;
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
      upgradeLegacyPerformance500(db.settings.exam500Bareme || clone(DEFAULT_BAREME), "seconde");

    const session =
      typeof activeSession === "function"
        ? activeSession()
        : null;

    /*
     * Chaque évaluation 3 × 500 conserve son propre barème.
     * Le barème global sert uniquement de modèle pour une nouvelle évaluation.
     * Ainsi, une archive HTML réimportée retrouve exactement son barème.
     */
    if (
      session &&
      session.type === "exam500"
    ) {
      if (!session.exam500Bareme) {
        session.exam500Bareme =
          clone(
            db.settings.exam500Bareme
          );
      }

      return upgradeLegacyPerformance500(session.exam500Bareme, session.exam500EvaluationLevel);
    }

    return db.settings.exam500Bareme;
  }

  function criterionLabels() {
    const session =
      typeof activeSession === "function"
        ? activeSession()
        : null;

    return {
      afl2:
        String(
          session?.exam500Afl2Label ||
          "Carnet / échauffement"
        ).trim() ||
        "Carnet / échauffement",
      afl3:
        String(
          session?.exam500Afl3Label ||
          "Partenaire / starter"
        ).trim() ||
        "Partenaire / starter"
    };
  }

  function premiereMode() {
    return activeSession()?.exam500EvaluationLevel === "premiere";
  }

  function extraScore(student, field, max) {
    const v = student[field];
    if (v === "" || v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 && n <= max ? n : null;
  }

  function scoreOptions(max, current) {
    let html =
      '<option value="">—</option>';

    for (
      let value = 0;
      value <= max + 0.001;
      value += 0.25
    ) {
      const rounded =
        Math.round(value * 100) / 100;

      const selected =
        current != null &&
        current !== "" &&
        Number(current) === rounded
          ? " selected"
          : "";

      html +=
        '<option value="' +
        rounded +
        '"' +
        selected +
        '>' +
        fmtPts(rounded) +
        '</option>';
    }

    return html;
  }

  function normalizedRaces(student) {
    const races =
      Array.isArray(
        student?.exam500?.races
      )
        ? student.exam500.races
        : [];

    return [1,2,3].map(
      race =>
        races.find(
          r =>
            Number(r.race) === race
        ) || null
    );
  }

  function complete500(student) {
    const [c1,c2,c3] =
      normalizedRaces(student);

    if (!c1 || !c2 || !c3) {
      return false;
    }

    const validRace =
      race => {
        const split =
          Number(race.split250Ms);

        const total =
          Number(race.total500Ms);

        return (
          Number.isFinite(split) &&
          split > 0 &&
          Number.isFinite(total) &&
          total > split
        );
      };

    return (
      validRace(c1) &&
      validRace(c2) &&
      validRace(c3) &&
      Number.isFinite(Number(c1.projectMs)) &&
      Number(c1.projectMs) > 0 &&
      Number.isFinite(Number(c2.projectMs)) &&
      Number(c2.projectMs) > 0
    );
  }

  function performancePoints(student) {
    if (!complete500(student)) {
      return 0;
    }

    const rows =
      student.sex === "M"
        ? settings().boys
        : settings().girls;

    const total =
      normalizedRaces(student)
        .reduce(
          (sum,race) =>
            sum +
            Number(race.total500Ms),
          0
        );

    const thresholds = rows
      .map(([t,p]) => ({ms:parseTime(t), p:Number(p)}))
      .filter(x => x.ms != null)
      .sort((a,b)=>a.ms-b.ms);

    if (!thresholds.length) return 0;

    if (total < thresholds[0].ms) {
      return thresholds[0].p;
    }

    if (
      total >
      thresholds[
        thresholds.length - 1
      ].ms
    ) {
      return 0;
    }

    let points = 0;

    for (const row of thresholds) {
      if (total >= row.ms) {
        points = row.p;
      } else {
        break;
      }
    }

    return points;
  }

  function estimationCount() {
    const session = typeof activeSession === "function" ? activeSession() : null;
    return premiereMode() && session?.exam500EstimationCount === 3 ? 3 : 2;
  }

  // 0–3 s : totalité ; >3–6 s : moitié ; >6 s : zéro.
  // Comparaison sans arrondi intermédiaire, pour respecter les seuils.
  function estimationMetrics(student) {
    const races = normalizedRaces(student).slice(0, estimationCount());
    const weight = 3 / estimationCount();
    const details = races.map((race, i) => {
      const announced = Number(race?.projectMs);
      const actual = Number(race?.total500Ms);
      if (!race || !Number.isFinite(announced) || announced <= 0 ||
          !Number.isFinite(actual) || actual <= 0) {
        return { race:i+1, errorMs:null, points:null };
      }
      const errorMs = Math.abs(actual-announced);
      return { race:i+1, errorMs,
        points:errorMs <= 3000 ? weight : errorMs <= 6000 ? weight/2 : 0 };
    });
    return {
      details,
      points:details.every(x => x.points !== null)
        ? Math.round(details.reduce((sum,x)=>sum+x.points,0)*100)/100 : null,
      errorMs:details.every(x => x.errorMs !== null)
        ? details.reduce((sum,x)=>sum+x.errorMs,0) : null
    };
  }

  function gapSeconds(student) {
    const ms = estimationMetrics(student).errorMs;
    return ms == null ? null : ms / 1000;
  }

  function tableScore(rows, seconds) {
    if (seconds == null) return 0;
    const sorted = rows.slice().sort((a,b)=>Number(b[0])-Number(a[0]));
    for (const [limit,pts] of sorted) {
      if (seconds >= Number(limit)) return Number(pts);
    }
    return 0;
  }

  function indexMode() {
    const session =
      typeof activeSession === "function"
        ? activeSession()
        : null;

    return session?.exam500IndexMode === "three"
      ? "three"
      : "c1c2";
  }

  // Première : chaque 500 m fournit deux portions de 250 m.
  // On compare la plus rapide et la plus lente de toutes les portions retenues.
  function efficiencySeconds(student) {
    const races = normalizedRaces(student);
    const selected = indexMode() === "three" ? races : races.slice(0, 2);
    if (selected.some(r => !r || !(Number(r.split250Ms) > 0) ||
      !(Number(r.total500Ms) > Number(r.split250Ms)))) return null;
    const segments = selected.flatMap(r => [
      Number(r.split250Ms),
      Number(r.total500Ms) - Number(r.split250Ms)
    ]);
    return Math.round((Math.max(...segments) - Math.min(...segments)) / 1000);
  }

  function score500(student) {
    if (!complete500(student)) {
      return null;
    }
    const perf = performancePoints(student);
    const gap = gapSeconds(student);
    const eff = efficiencySeconds(student);
    const gapPts = premiereMode() ? estimationMetrics(student).points : tableScore(settings().gap, gap);
    const effPts = tableScore(settings().efficiency, eff);

    const afl2 =
      student.exam500Afl2 === "" ||
      student.exam500Afl2 == null
        ? null
        : Number(student.exam500Afl2);

    const afl3 =
      student.exam500Afl3 === "" ||
      student.exam500Afl3 == null
        ? null
        : Number(student.exam500Afl3);

    const warmup = extraScore(student, "exam500Warmup", 2);
    const carnet = extraScore(student, "exam500Carnet", 2);
    const observation = extraScore(student, "exam500Observation", 1);
    const totalPremiere = warmup == null || carnet == null ||
      observation == null || gapPts == null ? null :
      Math.min(20, perf + effPts + gapPts + warmup + carnet + observation);

    const total20 =
      premiereMode() ? totalPremiere :
      afl2 == null ||
      afl3 == null ||
      gapPts == null
        ? null
        : Math.min(
            20,
            perf +
            effPts +
            gapPts +
            afl2 +
            afl3
          );

    return {
      perf,
      gap,
      gapPts,
      estimationDetails: estimationMetrics(student).details,
      eff,
      effPts,
      afl1: perf + effPts,
      afl2,
      afl3,
      warmup,
      carnet,
      observation,
      total20,
      totalRaceMs:
        normalizedRaces(student)
          .reduce(
            (sum,race) =>
              sum +
              Number(race.total500Ms),
            0
          )
    };
  }

  // Acces rapide depuis l'accueil, sans evaluation active.
  // Le code 57 est un verrou d'interface, pas une authentification serveur.
  function requestBaremeAccess(globalOnly) {
    const code = window.prompt("Code d'acces au bareme 3 x 500 :");
    if (code === null) return;
    if (code.trim() !== "57") {
      window.alert("Code incorrect.");
      return;
    }
    openBaremeDialog(globalOnly);
  }

  function ensureHomeBaremeButton() {
    const home = document.getElementById("home");
    if (!home || document.getElementById("homeBareme500Btn")) return;
    const grid = home.querySelector(".scan-home-grid");
    if (!grid) return;
    const button = document.createElement("button");
    button.type = "button";
    button.id = "homeBareme500Btn";
    button.className = "scan-home-card";
    button.innerHTML = '<span class="home-card-step">PARAMETRER LES EVALUATIONS</span><strong>⚙️ Barème 3 × 500</strong><span>Consulter et modifier les références Seconde / Première. Accès par code.</span><b>Ouvrir le barème →</b>';
    button.addEventListener("click", () => requestBaremeAccess(true));
    grid.appendChild(button);
  }

  function ensureBaremeButton() {
    const manager =
      document.getElementById(
        "groupSessionManager"
      );

    const existing =
      document.getElementById(
        "exam500BaremeBtn"
      );

    const session =
      typeof activeSession ===
        "function"
        ? activeSession()
        : null;

    const isExam500 =
      session?.type ===
        "exam500";

    /*
     * Le barème 3 × 500 ne doit jamais être visible
     * dans une évaluation 2 × 800.
     */
    if (!isExam500) {
      existing?.remove();
      return;
    }

    if (
      !manager ||
      existing
    ) {
      return;
    }

    const actions =
      manager.querySelector(
        ".session-manager-actions"
      );

    if (!actions) return;

    const button =
      document.createElement(
        "button"
      );

    button.id =
      "exam500BaremeBtn";

    button.type =
      "button";

    button.textContent =
      "⚙️ Barème 3 × 500";

    button.onclick =
      () => requestBaremeAccess(false);

    actions.appendChild(
      button
    );
  }

  function openBaremeDialog(globalOnly = false) {
    let d = document.getElementById("exam500BaremeDialog");
    if (!d) {
      d = document.createElement("dialog");
      d.id = "exam500BaremeDialog";
      document.body.appendChild(d);
    }

    const b = globalOnly ? (db.settings.exam500Bareme || clone(DEFAULT_BAREME)) : settings();

    const rowsToText = rows => rows.map(r => r.join(" = ")).join("\n");

    d.innerHTML = `
      <div style="min-width:min(920px,94vw);max-height:86vh;overflow:auto;padding:8px">
        <h2>Barème 3 × 500</h2>
        <p>Modifie les valeurs puis enregistre. Les calculs seront immédiatement recalculés.</p>

        <div style="margin:14px 0;padding:12px;border:1px solid #d8e1f3;border-radius:12px">
          <label>
            <b>Calcul de la régularité /6 · portions de 250 m</b>
            <select id="b500IndexMode" style="display:block;width:100%;margin-top:8px">
              <option value="c1c2" ${indexMode()==="c1c2" ? "selected" : ""}>4 segments de 250 m · C1 et C2</option>
              <option value="three" ${indexMode()==="three" ? "selected" : ""}>6 segments de 250 m · C1, C2 et C3</option>
            </select>
          </label>
          <p style="margin:8px 0 0;font-size:13px;color:#64748b">
            Ce choix s’applique à toute l’évaluation.
          </p>
        </div>

        <div style="margin:14px 0;padding:12px;border:1px solid #d8e1f3;border-radius:12px">
          <label><b>Estimation /3 · nombre d'annonces</b>
            <select id="b500EstimationCount" style="display:block;width:100%;margin-top:8px">
              <option value="2" ${estimationCount()===2?"selected":""}>2 annonces · C1 et C2 · 1,5 point chacune</option>
              <option value="3" ${estimationCount()===3?"selected":""}>3 annonces · C1, C2 et C3 · 1 point chacune</option>
            </select>
          </label>
          <p style="font-size:13px">0 à 3 s d'écart : 100 % ; plus de 3 à 6 s : 50 % ; plus de 6 s : 0.</p>
          <b>Intitulés des critères complémentaires (hors Première)</b>
          <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:8px">
            <label>Critère /2
              <input id="b500Afl2Label" style="width:100%" value="${esc(criterionLabels().afl2)}">
            </label>
            <label>Critère /4
              <input id="b500Afl3Label" style="width:100%" value="${esc(criterionLabels().afl3)}">
            </label>
          </div>
        </div>

        <div style="margin:14px 0;padding:12px;border:1px solid #d8e1f3;border-radius:12px">
          <b>Référentiel de performance : Seconde ou Première</b>
          <p style="font-size:13px;color:#64748b">Sélectionne un niveau, puis enregistre pour l'appliquer à cette évaluation. Les autres critères restent inchangés.</p>
          <div style="display:flex;flex-wrap:wrap;gap:10px">
            <button id="b500PresetSeconde" type="button">Seconde</button>
            <button id="b500PresetPremiere" type="button">Première</button>
          </div>
          <small id="b500SelectedLevel" aria-live="polite">Barème actuel affiché (personnalisable).</small>
        </div>

        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px">
          <label><b>Performance filles /6</b><textarea id="b500Girls" style="width:100%;min-height:280px">${rowsToText(b.girls)}</textarea></label>
          <label><b>Performance garçons /6</b><textarea id="b500Boys" style="width:100%;min-height:280px">${rowsToText(b.boys)}</textarea></label>
          <p><b>Estimation /3</b><br>Barème fixe par annonce, défini ci-dessus.</p>
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

    for (const [id,level,label] of [
      ["b500PresetSeconde","seconde","Seconde"],
      ["b500PresetPremiere","premiere","Première"]
    ]) {
      d.querySelector("#" + id).onclick = () => {
        const preset = performancePreset500(level,b);
        d.dataset.selectedLevel = level;
        d.querySelector("#b500Girls").value = rowsToText(preset.girls);
        d.querySelector("#b500Boys").value = rowsToText(preset.boys);
        d.querySelector("#b500SelectedLevel").textContent =
          "Barème " + label + " chargé. Clique sur Enregistrer pour l'appliquer.";
      };
    }

    d.querySelector("#b500Cancel").onclick = () => d.close();

    d.querySelector("#b500Reset").onclick = () => {
      if (!confirm("Réinitialiser le barème 3 × 500 ?")) return;
      db.settings.exam500Bareme = clone(DEFAULT_BAREME);

      const session =
        !globalOnly && typeof activeSession === "function"
          ? activeSession()
          : null;

      if (session) {
        session.exam500Bareme =
          clone(DEFAULT_BAREME);

        session.exam500EvaluationLevel = "seconde";
        session.exam500IndexMode = "c1c2";
        session.exam500EstimationCount = 2;
        session.exam500Afl2Label =
          "Carnet / échauffement";
        session.exam500Afl3Label =
          "Partenaire / starter";
      }

      save();
      d.close();

      ensureHomeBaremeButton();
      ensureBaremeButton();
      render500TableIfNeeded();
      render500ResultsIfNeeded();

      toast?.("Barème 3 × 500 réinitialisé");
    };

    d.querySelector("#b500Save").onclick = () => {
      const sessionBefore =
        !globalOnly && typeof activeSession === "function"
          ? activeSession()
          : null;

      const studentCountBefore =
        Array.isArray(sessionBefore?.students)
          ? sessionBefore.students.length
          : 0;

      const next = {
        girls: parseRows(d.querySelector("#b500Girls").value, true),
        boys: parseRows(d.querySelector("#b500Boys").value, true),
        gap: clone(b.gap),
        efficiency: parseRows(d.querySelector("#b500Eff").value, false)
      };

      if (!next.girls.length || !next.boys.length || !next.gap.length || !next.efficiency.length) {
        alert("Le barème contient une zone vide ou mal formatée.");
        return;
      }

      db.settings.exam500Bareme =
        clone(next);

      const session =
        !globalOnly && typeof activeSession === "function"
          ? activeSession()
          : null;

      if (session) {
        session.exam500Bareme =
          clone(next);
        if (d.dataset.selectedLevel) {
          session.exam500EvaluationLevel = d.dataset.selectedLevel;
        }
        session.exam500IndexMode =
          d.querySelector("#b500IndexMode").value === "three"
            ? "three"
            : "c1c2";

        session.exam500EstimationCount = Number(d.querySelector("#b500EstimationCount").value) === 3 ? 3 : 2;
        session.exam500Afl2Label =
          d.querySelector("#b500Afl2Label").value.trim() ||
          "Carnet / échauffement";

        session.exam500Afl3Label =
          d.querySelector("#b500Afl3Label").value.trim() ||
          "Partenaire / starter";
      }

      /*
       * Important : modifier le mode d'indice ou le barème
       * ne doit jamais repasser par le rendu CCF générique,
       * qui peut momentanément masquer les données 3 × 500.
       * On ne rafraîchit ici que les vues 3 × 500.
       */
      save();
      d.close();

      ensureBaremeButton();
      render500TableIfNeeded();
      render500ResultsIfNeeded();

      toast?.("Barème 3 × 500 enregistré");
    };

    d.showModal();
  }

  function validate500Payload(data) {
    if (
      !data ||
      typeof data !== "object" ||
      data.type !== "DF_3X500_RESULT" ||
      Number(data.v) !== 1
    ) {
      return {
        ok:false,
        message:"QR 3 × 500 invalide."
      };
    }

    if (
      !data.studentId ||
      !String(data.last || "").trim() ||
      !String(data.first || "").trim() ||
      !String(data.classroom || "").trim() ||
      !["F","M"].includes(
        String(data.sex || "").toUpperCase()
      )
    ) {
      return {
        ok:false,
        message:"Identité élève incomplète dans le QR 3 × 500."
      };
    }

    if (
      !Array.isArray(data.races) ||
      data.races.length !== 3
    ) {
      return {
        ok:false,
        message:"Le QR doit contenir exactement les 3 courses de 500 m."
      };
    }

    const ordered =
      [1,2,3].map(
        race =>
          data.races.find(
            item =>
              Number(item.race) === race
          )
      );

    if (ordered.some(race => !race)) {
      return {
        ok:false,
        message:"Les courses 1, 2 et 3 doivent toutes être présentes."
      };
    }

    for (
      let index = 0;
      index < ordered.length;
      index++
    ) {
      const race =
        ordered[index];

      const split =
        Number(race.split250Ms);

      const total =
        Number(race.total500Ms);

      if (
        !Number.isFinite(split) ||
        split <= 0 ||
        !Number.isFinite(total) ||
        total <= split
      ) {
        return {
          ok:false,
          message:
            "Temps 250 m / 500 m incohérents pour la course " +
            (index + 1) +
            "."
        };
      }

      if (index < 2) {
        const project =
          parseTime(race.project);

        if (
          !project ||
          project < 20000 ||
          project > 600000
        ) {
          return {
            ok:false,
            message:
              "Estimation obligatoire et invalide pour le 500 n°" +
              (index + 1) +
              "."
          };
        }
      } else if (
        race.project != null &&
        String(race.project).trim() !== ""
      ) {
        const project = parseTime(race.project);
        if (!project || project < 20000 || project > 600000) {
          return { ok:false, message:"Estimation C3 invalide." };
        }
      }
    }

    return {
      ok:true,
      data:{
        ...data,
        sex:
          String(data.sex).toUpperCase(),
        classroom:
          String(data.classroom)
            .trim()
            .toUpperCase(),
        races:ordered
      }
    };
  }

  function handle500(data) {
    if (
      data?.type !==
        "DF_3X500_RESULT"
    ) {
      return false;
    }

    const checked =
      validate500Payload(data);

    if (!checked.ok) {
      scanError(checked.message);
      return true;
    }

    data = checked.data;

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

    /*
     * Ne jamais mélanger 2 × 800 et 3 × 500 dans la même évaluation.
     */
    if (
      session.type &&
      session.type !== "exam500"
    ) {
      scanError(
        "Cette évaluation est configurée pour le 2 × 800. Crée une évaluation séparée pour le 3 × 500."
      );
      return true;
    }

    // Les réglages du QR pilotent la nouvelle évaluation sans écraser
    // les modifications manuelles d'un barème déjà personnalisé.
    const cfg = data.evaluationConfig;
    if (cfg && typeof cfg === "object") {
      const level = cfg.level === "seconde" ? "seconde" :
        cfg.level === "premiere" ? "premiere" : null;
      const index = cfg.regularityMode === "three" ? "three" :
        cfg.regularityMode === "c1c2" ? "c1c2" : null;
      const count = Number(cfg.estimationCount);
      if (!level || !index || ![2,3].includes(count)) {
        scanError("Paramètres d'évaluation QR incorrects."); return true;
      }
      if (session.exam500QrConfig) {
        const old = session.exam500QrConfig;
        if (old.level !== level || old.index !== index || old.count !== count) {
          scanError("QR incompatible avec les réglages de cette évaluation."); return true;
        }
      } else {
        session.exam500QrConfig = {level,index,count};
        session.exam500EvaluationLevel = level;
        session.exam500IndexMode = index;
        session.exam500EstimationCount = count;
        // Une nouvelle évaluation adopte le référentiel du niveau scanné.
        // Une évaluation déjà renseignée garde son barème et ses corrections.
        const hasScannedResults = (session.students || []).some(
          student => Array.isArray(student?.exam500?.races) && student.exam500.races.length > 0
        );
        if (!hasScannedResults && !session.exam500BaremeCustomized) {
          session.exam500Bareme = performancePreset500(level,
            db.settings?.exam500Bareme || DEFAULT_BAREME);
        }
      }
    }

    session.type = "exam500";

    let student =
      findStudent(
        session,
        data.studentId
      );

    if (
      student?.exam500?.races?.length
    ) {
      const sameQR =
        data.resultId &&
        student.exam500.resultId &&
        String(data.resultId) ===
          String(student.exam500.resultId);

      if (sameQR) {
        scanError(
          String(student.last || "").toUpperCase() +
          " " +
          String(student.first || "") +
          " · QR déjà scanné."
        );
        return true;
      }

      const replace =
        confirm(
          String(student.last || "").toUpperCase() +
          " " +
          String(student.first || "") +
          "\n\nUn résultat 3 × 500 est déjà enregistré.\n\nRemplacer ce relevé ?"
        );

      if (!replace) {
        return true;
      }
    }

    if (!student) {
      student =
        buildStudent(data);

      session.students.push(
        student
      );
    }

    updateIdentity(
      student,
      data
    );

    student.exam500 = {
      resultId:data.resultId || "",
      projects: Array.isArray(data.projects) ? data.projects : [],
      races: data.races.map(r => ({
        race:Number(r.race),
        project:r.project || null,
        projectMs:r.project ? parseTime(r.project) : null,
        split250Ms:Number(r.split250Ms||0),
        total500Ms:Number(r.total500Ms||0)
      })),
      supervised:data.supervised===true,
      validation:Array.isArray(data.validation)?data.validation:[],
      observerAudit:data.observerAudit||null,
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

  function open500Editor(studentId, visibleIndex = null) {
    const session = activeSession();

    let student = null;

    if (
      visibleIndex != null &&
      Number.isInteger(
        Number(visibleIndex)
      )
    ) {
      student =
        visibleStudents()[
          Number(visibleIndex)
        ] || null;
    }

    if (!student) {
      student =
        session?.students?.find(
          s =>
            String(s.id) ===
              String(studentId) ||
            String(s.externalId) ===
              String(studentId)
        ) || null;
    }

    if (!student) {
      toast?.("Élève introuvable dans cette évaluation.");
      return;
    }

    let d =
      document.getElementById(
        "exam500EditDialog"
      );

    if (!d) {
      d =
        document.createElement(
          "dialog"
        );

      d.id =
        "exam500EditDialog";

      document.body.appendChild(
        d
      );
    }

    const races =
      student.exam500?.races || [];

    const race =
      n =>
        races.find(
          r =>
            Number(r.race) === n
        ) || {
          race:n,
          project:null,
          projectMs:null,
          split250Ms:0,
          total500Ms:0
        };

    const c1 = race(1);
    const c2 = race(2);
    const c3 = race(3);

    const inputTime =
      ms =>
        ms
          ? timeLabel(ms)
              .replace("min ",":")
              .replace("s","")
          : "";

    d.innerHTML = `
      <div style="min-width:min(900px,94vw);max-height:88vh;overflow:auto;padding:8px">
        <h2>Corriger — ${esc(String(student.last||"").toUpperCase())} ${esc(student.first||"")}</h2>

        <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:16px;padding:12px;border-radius:14px;background:#f3f6fb">
          <label>Nom<input id="e500Last" value="${esc(student.last||"")}"></label>
          <label>Prénom<input id="e500First" value="${esc(student.first||"")}"></label>
          <label>Classe<input id="e500Class" value="${esc(student.classroom||"")}"></label>
          <label>Sexe
            <select id="e500Sex">
              <option value="F" ${student.sex==="F"?"selected":""}>Fille</option>
              <option value="M" ${student.sex==="M"?"selected":""}>Garçon</option>
            </select>
          </label>
        </div>

        <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px">
          ${[c1,c2,c3].map((r,index)=>`
            <section style="border:1px solid #d8e1f3;border-radius:14px;padding:12px;background:${index===0 ? "#fff8dc" : index===1 ? "#eef9ef" : "#eef6ff"}">
              <h3>Course ${index+1}</h3>

              ${index < 2 || estimationCount() === 3 ? `
                <label>Annonce
                  <input id="e500Project${index+1}" value="${esc(r.project||"")}" placeholder="2:00">
                </label>
              ` : ""}

              <label>250 m
                <input id="e500Split${index+1}" value="${inputTime(r.split250Ms)}" placeholder="0:55">
              </label>

              <label>500 m
                <input id="e500Total${index+1}" value="${inputTime(r.total500Ms)}" placeholder="1:50">
              </label>
            </section>
          `).join("")}
        </div>

        ${premiereMode() ? `
        <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:16px">
          <label>Échauffement /2<input id="e500Warmup" type="number" min="0" max="2" step="0.25" value="${student.exam500Warmup ?? ""}"></label>
          <label>Carnet / investissement /2<input id="e500Carnet" type="number" min="0" max="2" step="0.25" value="${student.exam500Carnet ?? ""}"></label>
          <label>Observation /1<input id="e500Observation" type="number" min="0" max="1" step="0.25" value="${student.exam500Observation ?? ""}"></label>
        </div>
        ` : `
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:16px">
          <label>AFL2 · Carnet / échauffement /2
            <input id="e500Afl2" type="number" min="0" max="2" step="0.25" value="${student.exam500Afl2 ?? ""}">
          </label>

          <label>AFL3 · Partenaire / starter /4
            <input id="e500Afl3" type="number" min="0" max="4" step="0.25" value="${student.exam500Afl3 ?? ""}">
          </label>
        </div>

        `}
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:18px">
          <button id="e500Cancel" type="button">Annuler</button>
          <button id="e500Save" type="button">Enregistrer et recalculer</button>
        </div>
      </div>
    `;

    d.querySelector("#e500Cancel").onclick =
      () => d.close();

    d.querySelector("#e500Save").onclick =
      () => {
        const last =
          d.querySelector("#e500Last").value.trim();

        const first =
          d.querySelector("#e500First").value.trim();

        const classroom =
          d.querySelector("#e500Class").value.trim().toUpperCase();

        if (!last || !first || !classroom) {
          alert("Nom, prénom et classe sont obligatoires.");
          return;
        }

        const previewRaces =
          [1,2,3].map(n => {
            const projectInput =
              d.querySelector("#e500Project" + n);

            const project =
              projectInput
                ? projectInput.value.trim()
                : null;

            return {
              race:n,
              project,
              projectMs:
                project
                  ? parseTime(project)
                  : null,
              split250Ms:
                parseTime(
                  d.querySelector("#e500Split" + n).value
                ) || 0,
              total500Ms:
                parseTime(
                  d.querySelector("#e500Total" + n).value
                ) || 0
            };
          });

        for (let i = 0; i < 3; i++) {
          const race = previewRaces[i];

          if (
            !race.split250Ms ||
            !race.total500Ms ||
            race.total500Ms <= race.split250Ms
          ) {
            alert(
              "Vérifie les temps 250 m et 500 m de la course " +
              (i + 1) +
              "."
            );
            return;
          }

          if (
            i < estimationCount() &&
            (
              !race.projectMs ||
              race.projectMs < 20000 ||
              race.projectMs > 600000
            )
          ) {
            alert(
              "Une estimation valide est obligatoire pour les courses retenues."
            );
            return;
          }
        }

        if (premiereMode()) {
          const items = [["exam500Warmup","e500Warmup",2],
            ["exam500Carnet","e500Carnet",2],
            ["exam500Observation","e500Observation",1]];
          for (const [field,id,max] of items) {
            const raw = d.querySelector("#"+id).value;
            const n = raw === "" ? "" : Number(raw);
            if (n !== "" && (!Number.isFinite(n) || n < 0 || n > max)) {
              alert("Note invalide : "+id+" (0 à "+max+").");
              return;
            }
            student[field] = n;
          }
        }
        const afl2Raw =
          d.querySelector("#e500Afl2")?.value ?? "";

        const afl3Raw =
          d.querySelector("#e500Afl3")?.value ?? "";

        const afl2 =
          afl2Raw === ""
            ? ""
            : Number(afl2Raw);

        const afl3 =
          afl3Raw === ""
            ? ""
            : Number(afl3Raw);

        if (
          afl2 !== "" &&
          (
            !Number.isFinite(afl2) ||
            afl2 < 0 ||
            afl2 > 2
          )
        ) {
          alert(
            "Carnet / échauffement doit être compris entre 0 et 2."
          );
          return;
        }

        if (
          afl3 !== "" &&
          (
            !Number.isFinite(afl3) ||
            afl3 < 0 ||
            afl3 > 4
          )
        ) {
          alert(
            "Partenaire / starter doit être compris entre 0 et 4."
          );
          return;
        }

        student.last =
          last;

        student.first =
          first;

        student.classroom =
          classroom;

        student.sex =
          d.querySelector("#e500Sex").value;

        student.exam500.races =
          previewRaces;

        if (!premiereMode()) student.exam500Afl2 =
          afl2;

        if (!premiereMode()) student.exam500Afl3 =
          afl3;

        save();
        d.close();

        if (
          typeof render ===
            "function"
        ) {
          render();
        }

        toast?.(
          "3 × 500 recalculé"
        );
      };

    d.showModal();
  }

  function render500TableIfNeeded() {
    const session = activeSession();
    if (!session || session.type !== "exam500") return;

    const body = document.getElementById("students");
    if (!body) return;

    const rows = visibleStudents();

    body.innerHTML = rows.map((student,rowIndex) => {
      const sc = score500(student);
      const r = student.exam500?.races || [];
      const t = n => r.find(x=>x.race===n)?.total500Ms;
      const p = n => r.find(x=>x.race===n)?.project;
      return `
        <tr data-student-id="${esc(student.id)}">
          <td><b>${esc(String(student.last||"").toUpperCase())} ${esc(student.first||"")}</b></td>
          <td>${esc(student.classroom||"")}</td>
          <td>${esc(p(1)||"—")}</td>
          <td>${timeLabel(t(1))}</td>
          <td>${esc(p(2)||"—")}</td>
          <td>${timeLabel(t(2))}</td>
          <td>${estimationCount()===3 ? esc(p(3)||"—")+" / "+timeLabel(t(3)) : timeLabel(t(3))}</td>
          <td><b>${sc ? fmtPts(sc.afl1)+"/12" : "—"}</b></td>
          <td>
            <button type="button" class="student-edit" data-id="${esc(student.id)}" data-visible-index="${rowIndex}">✏️ Corriger</button>
            <button type="button" class="student-delete-hold" data-student-id="${esc(student.id)}" title="Maintenir pour supprimer">Supprimer</button>
          </td>
        </tr>
      `;
    }).join("");

    body.querySelectorAll(".student-edit").forEach(button => {
      button.onclick = event => {
        event.preventDefault();
        event.stopPropagation();

        open500Editor(
          button.dataset.id,
          button.dataset.visibleIndex
        );
      };
    });

    const head = document.querySelector(".student-list-card thead tr");
    if (head) {
      head.innerHTML =
        "<th>Élève</th><th>Classe</th><th>Annonce C1</th><th>C1</th><th>Annonce C2</th><th>C2</th><th>"+(estimationCount()===3?"Annonce C3":"C3 libre")+"</th><th>AFL1</th><th>Action</th>";
    }
  }

  function render500ResultsIfNeeded() {
    const session = activeSession();
    if (!session || session.type !== "exam500") return;

    const body = document.getElementById("resultRows");
    if (!body) return;

    body.innerHTML = visibleStudents().map(student => {
      const sc = score500(student);
      const audit=student.exam500?.validation||[];
      const correctionDetail=audit.filter(v=>Array.isArray(v)&&v[1]==="C").map(v=>{
        const race=Number(v[0]),record=student.exam500?.races?.find(r=>r.race===race);
        const raw=v[3]!=null?timeLabel(Number(v[3])):"non disponible";
        return "500 m n°"+race+" : élève "+raw+" → professeur "+timeLabel(record?.total500Ms);
      });
      const correctionLabel=correctionDetail.length
        ? '<button type="button" class="exam500-correction-detail" title="'+esc(correctionDetail.join("\n"))+'" style="background:#ffedd5;color:#9a3412;border:1px solid #fdba74;border-radius:6px;padding:3px 6px;cursor:pointer">✏️ '+correctionDetail.length+' corrigé(s)</button>'
        : student.exam500?.supervised ? '<span style="color:#15803d">✓ Validé</span>' : "—";
      // Validation du chrono du coureur, indépendamment de la note et de l'observateur.
      const validations=audit.filter(v=>Array.isArray(v)&&[1,2,3].includes(Number(v[0])));
      const accepted=validations.filter(v=>v[1]==="O").length;
      const validationLabel=student.exam500?.supervised && validations.length
        ? '<strong style="color:'+(accepted===3?'#15803d':'#9a3412')+'">'+accepted+'/3</strong>'
        : "—";
      return `
        <tr>
          <td>
            <b>
              ${esc(String(student.last||"").toUpperCase())}
              ${esc(student.first||"")}
            </b>
          </td>
          <td>${esc(student.sex||"")}</td>
          <td>${sc ? timeLabel(sc.totalRaceMs) : "—"}</td>
          <td><b>${sc ? fmtPts(sc.perf) : "—"}</b></td>
          <td>${sc?.eff == null ? "—" : sc.eff+" s"}</td>
          <td><b>${sc ? fmtPts(sc.effPts) : "—"}</b></td>
          <td>${sc?.gap == null ? "—" : fmtPts(sc.gap)+" s"}</td>
          <td><b>${sc ? fmtPts(sc.gapPts) : "—"}</b></td>
          ${premiereMode() ? `
          ${[["exam500Warmup",2],["exam500Carnet",2],["exam500Observation",1]]
            .map(([field,max])=>`<td><select class="exam500-inline-score" data-student-id="${esc(student.id)}" data-field="${field}" aria-label="${field} / ${max}">${scoreOptions(max,student[field])}</select></td>`).join("")}
          ` : `
          <td>
            <select class="exam500-inline-score" data-student-id="${esc(student.id)}" data-field="exam500Afl2" aria-label="${esc(criterionLabels().afl2)} sur 2">
              ${scoreOptions(2, student.exam500Afl2)}
            </select>
          </td>
          <td>
            <select class="exam500-inline-score" data-student-id="${esc(student.id)}" data-field="exam500Afl3" aria-label="${esc(criterionLabels().afl3)} sur 4">
              ${scoreOptions(4, student.exam500Afl3)}
            </select>
          </td>
          `}
          <td>${correctionLabel}</td>
          <td>${validationLabel}</td>
          <td><b>${sc?.total20 == null ? "—" : fmtPts(sc.total20)}</b></td>
        </tr>
      `;
    }).join("");

    // Liste alphabétique compacte : un élève ouvert à la fois.
    const resultsCard = body.closest(".card");
    if (resultsCard) {
      let summary = document.getElementById("exam500Summary");
      if (!summary) {
        summary = document.createElement("section");
        summary.id = "exam500Summary";
        summary.style.cssText = "margin:16px 0;max-width:100%";
        body.closest(".table")?.before(summary);
      }
      const sorted = visibleStudents().slice().sort((a,b)=>
        (String(a.last||"")+" "+String(a.first||"")).localeCompare(
          String(b.last||"")+" "+String(b.first||""),"fr",{sensitivity:"base"}));
      const opened = summary.querySelector("details[open]")?.dataset.studentId || "";
      const fields = premiereMode()
        ? [["exam500Warmup","Échauffement",2],["exam500Carnet","Carnet / investissement",2],["exam500Observation","Observation",1]]
        : [["exam500Afl2",criterionLabels().afl2,2],["exam500Afl3",criterionLabels().afl3,4]];
      summary.innerHTML = '<h3 style="margin:0 0 10px">Élèves · synthèse des notes /20</h3>'+
        '<div class="exam500-student-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,270px),1fr));gap:10px;align-items:start">'+
        sorted.map((student,index)=>{
          const sc=score500(student), id=String(student.id);
          const line=(label,value,max)=>'<div style="display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-bottom:1px solid #e2e8f0"><span>'+esc(label)+'</span><b>'+(value==null?"—":fmtPts(value))+'/'+max+'</b></div>';
          return '<details class="exam500-summary-student" data-student-id="'+esc(id)+'" '+(opened===id?'open':'')+' style="border:2px solid '+(opened===id?'#2563eb':'#cbd5e1')+';border-radius:11px;margin:0;background:'+(index%2===0?'#eff6ff':'#f1f5f9')+'">'+
            '<summary style="cursor:pointer;padding:13px;font-weight:750;display:flex;justify-content:space-between;gap:12px;align-items:center"><span>'+esc(String(student.last||"").toUpperCase()+' '+(student.first||""))+'</span><b>'+(sc?.total20==null?"—":fmtPts(sc.total20))+'/20</b></summary>'+
            '<div style="padding:0 13px 13px">'+line("Performance",sc?.perf,6)+line("Régularité",sc?.effPts,6)+line("Estimation",sc?.gapPts,3)+
            fields.map(([field,label,max])=>'<label style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:7px 0"><span>'+esc(label)+' /'+max+'</span><select class="exam500-summary-score" data-id="'+esc(id)+'" data-field="'+field+'" style="min-width:90px;padding:7px">'+scoreOptions(max,student[field])+'</select></label>').join("")+
            '<button type="button" class="exam500-summary-edit" data-id="'+esc(id)+'" style="margin-top:10px;padding:10px;border:1px solid #2563eb;border-radius:9px;color:#1d4ed8;background:#eff6ff;font-weight:700">✏️ Corriger chronos et annonces</button></div></details>';
        }).join("")+'</div>';
      summary.querySelectorAll("details").forEach(detail=>{
        detail.addEventListener("toggle",()=>{
          if(detail.open) summary.querySelectorAll("details").forEach(other=>{if(other!==detail)other.open=false;});
        });
      });
      summary.querySelectorAll(".exam500-summary-score").forEach(select=>{
        select.onchange=()=>{
          const student=activeSession()?.students?.find(x=>String(x.id)===select.dataset.id);
          if(!student)return;
          student[select.dataset.field]=select.value===""?"":Number(select.value);
          save();
          render500ResultsIfNeeded();
        };
      });
      summary.querySelectorAll(".exam500-summary-edit").forEach(button=>{
        button.onclick=()=>open500Editor(button.dataset.id);
      });
    }

    const head = document.querySelector("#results .table thead tr");
    if (head) {
      head.innerHTML =
        "<th>Nom / prénom</th>" +
        "<th>Sexe</th>" +
        "<th>Performance 3 × 500</th>" +
        "<th>Performance /6</th>" +
        "<th>" +
        (
          indexMode() === "three"
            ? "Écart max–min des 6 × 250 m"
            : "Écart max–min des 4 × 250 m"
        ) +
        "</th>" +
        "<th>Régularité /6</th>" +
        "<th>Écart cumulé des annonces</th>" +
        "<th>Estimation /3</th>" +
        (premiereMode()
          ? "<th>Échauffement /2</th><th>Carnet /2</th><th>Observation /1</th>"
          : "<th>" + esc(criterionLabels().afl2) + " /2</th>" +
            "<th>" + esc(criterionLabels().afl3) + " /4</th>") +
        "<th>Validation professeur</th>" +
        "<th>Validation</th>" +
        "<th>Note /20</th>";

      body.querySelectorAll(".exam500-correction-detail").forEach(button=>{
        button.onclick=()=>window.alert(button.title);
      });
      body.querySelectorAll(".exam500-inline-score").forEach(select => {
        select.onchange = () => {
          const currentSession =
            activeSession();

          const student =
            currentSession?.students?.find(
              item =>
                String(item.id) ===
                String(select.dataset.studentId)
            );

          if (!student) return;

          const field =
            select.dataset.field;

          student[field] =
            select.value === ""
              ? ""
              : Number(select.value);

          save();

          if (typeof render === "function") {
            render();
          }
        };
      });
    }

    const title = document.querySelector("#results h2");
    if (title) {
      title.textContent =
        "Fiche d’évaluation · Demi-fond 3 × 500 · Régularité sur " +
        (indexMode() === "three" ? "6" : "4") + " portions de 250 m";
    }

    const tabs =
      document.getElementById("ccfViewTabs");
    if (tabs) {
      tabs.classList.add("hidden");
    }

    const quick =
      document.getElementById("ccfQuickView");
    if (quick) {
      quick.classList.add("hidden");
    }
  }

  function print500PDF() {
    const group = activeGroup();
    const session = activeSession();

    if (!session || session.type !== "exam500") {
      toast?.("Ouvre une évaluation 3 × 500 avant d’imprimer.");
      return;
    }

    const students = visibleStudents();
    const labels = criterionLabels();
    const modeLabel =
      indexMode() === "three"
        ? "3 courses (meilleur ↔ moins bon)"
        : "C1 ↔ C2";

    const fmtMs = ms =>
      ms == null || !Number.isFinite(Number(ms))
        ? "—"
        : timeLabel(Number(ms));

    const fmtProject = ms =>
      ms == null || !Number.isFinite(Number(ms))
        ? "—"
        : timeLabel(Number(ms));

    const rows = students.map(student => {
      const sc = score500(student);
      const races = normalizedRaces(student);
      const c1 = races[0] || {};
      const c2 = races[1] || {};
      const c3 = races[2] || {};

      return `
        <tr>
          <td><b>${esc(String(student.last||"").toUpperCase())} ${esc(student.first||"")}</b></td>
          <td>${esc(student.classroom||"")}</td>
          <td>${esc(student.sex||"")}</td>
          <td>${fmtProject(c1.projectMs)}</td>
          <td>${fmtMs(c1.split250Ms)}</td>
          <td>${fmtMs(c1.total500Ms)}</td>
          <td>${fmtProject(c2.projectMs)}</td>
          <td>${fmtMs(c2.split250Ms)}</td>
          <td>${fmtMs(c2.total500Ms)}</td>
          <td>${fmtMs(c3.split250Ms)}</td>
          <td>${fmtMs(c3.total500Ms)}</td>
          <td>${sc ? timeLabel(sc.totalRaceMs) : "—"}</td>
          <td>${sc ? fmtPts(sc.perf) : "—"}</td>
          <td>${sc?.eff == null ? "—" : sc.eff+" s"}</td>
          <td>${sc ? fmtPts(sc.effPts) : "—"}</td>
          <td>${sc?.gap == null ? "—" : sc.gap+" s"}</td>
          <td>${sc ? fmtPts(sc.gapPts) : "—"}</td>
          ${premiereMode()
            ? `<td>${sc?.warmup == null ? "—" : fmtPts(sc.warmup)}</td>
                 <td>${sc?.carnet == null ? "—" : fmtPts(sc.carnet)}</td>
                 <td>${sc?.observation == null ? "—" : fmtPts(sc.observation)}</td>`
            : `<td>${sc?.afl2 == null ? "—" : fmtPts(sc.afl2)}</td>
                 <td>${sc?.afl3 == null ? "—" : fmtPts(sc.afl3)}</td>`}
          <td><b>${sc?.total20 == null ? "—" : fmtPts(sc.total20)}</b></td>
        </tr>`;
    }).join("");

    const w = window.open("", "_blank");
    if (!w) {
      alert("Autorise les fenêtres surgissantes pour générer le PDF.");
      return;
    }

    w.document.write(`<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Demi-fond 3 × 500</title>
<style>
  @page{size:A4 landscape;margin:8mm}
  body{font-family:Arial,sans-serif;color:#111;margin:0;font-size:10px}
  h1{font-size:20px;margin:0 0 4px}
  .meta{margin:0 0 10px;color:#444;font-size:11px}
  table{width:100%;border-collapse:collapse;table-layout:auto}
  th,td{border:1px solid #aaa;padding:4px 3px;text-align:center;white-space:nowrap}
  th{background:#e9eef7;font-size:9px}
  td:first-child,th:first-child{text-align:left}
  .c1{background:#fff8dc}.c2{background:#eef9ef}.c3{background:#eef6ff}
  .score{background:#f4efff}
  .note{background:#fff3c7}
  .legend{margin-top:8px;font-size:9px;color:#555}
  @media print{button{display:none}}
</style>
</head>
<body>
<h1>Fiche d’évaluation · Demi-fond 3 × 500</h1>
<p class="meta">
  <b>${esc(group?.name||"")}</b>
  · ${esc(session.label||"")}
  · Indice : ${esc(modeLabel)}
  · ${students.length} élève${students.length>1?"s":""}
</p>
<table>
<thead>
<tr>
  <th rowspan="2">Élève</th><th rowspan="2">Classe</th><th rowspan="2">Sexe</th>
  <th colspan="3" class="c1">Course 1</th>
  <th colspan="3" class="c2">Course 2</th>
  <th colspan="2" class="c3">Course 3 libre</th>
  <th colspan="6" class="score">Évaluation</th>
  ${premiereMode() ? '<th rowspan="2">Échauffement<br>/2</th><th rowspan="2">Carnet<br>/2</th><th rowspan="2">Observation<br>/1</th>' :
    `<th rowspan="2">${esc(labels.afl2)}<br>/2</th><th rowspan="2">${esc(labels.afl3)}<br>/4</th>`}
  <th rowspan="2" class="note">Note<br>/20</th>
</tr>
<tr>
  <th class="c1">Annonce</th><th class="c1">250</th><th class="c1">500</th>
  <th class="c2">Annonce</th><th class="c2">250</th><th class="c2">500</th>
  <th class="c3">250</th><th class="c3">500</th>
  <th>Total 3×500</th><th>Perf /6</th><th>Indice</th><th>Indice /6</th><th>Écart annonces</th><th>Écart /2</th>
</tr>
</thead>
<tbody>${rows}</tbody>
</table>
<p class="legend">
  Indice utilisé : ${esc(modeLabel)}. C1 et C2 sont annoncées ; C3 est libre.
</p>
<script>window.onload=()=>window.print();<\/script>
</body>
</html>`);
    w.document.close();
  }

  function install500PrintButton() {
    const button =
      document.getElementById("exportPdfCCF");

    if (!button) return;

    const session =
      typeof activeSession === "function"
        ? activeSession()
        : null;

    if (session?.type !== "exam500") return;

    button.onclick = event => {
      event.preventDefault();
      event.stopPropagation();
      print500PDF();
    };
  }

  window.score500 = score500;

  window.renderExam500View =
    function() {
      ensureBaremeButton();
      render500TableIfNeeded();
      render500ResultsIfNeeded();
      install500PrintButton();
    };

  function installRenderHooks() {
    if (typeof window.render !== "function" || window.render.__exam500View) return;
    const original = window.render;

    const wrapped = function() {
      original();
      ensureHomeBaremeButton();
      ensureBaremeButton();
      render500TableIfNeeded();
      render500ResultsIfNeeded();
      install500PrintButton();
    };

    wrapped.__exam500View = true;
    window.render = wrapped;
    wrapped();
  }

  window.openExam500StudentEditor = studentId => open500Editor(studentId);

  function install() {
    settings();
    installBridge();
    ensureHomeBaremeButton();
    installRenderHooks();
    ensureBaremeButton();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install);
  } else {
    install();
  }
})();