const KEY = 'df-scan-ccf-v2';

let db = loadDB();
let filter = 'ALL';

const $ = id => document.getElementById(id);

function emptyDB() {
  return {
    groups: [],
    activeGroupId: null,
    activeSessionId: null,
    history: [],
    trainingScans: [],
    settings: {}
  };
}

function loadDB() {
  try {
    const v2 = localStorage.getItem(KEY);

    if (v2) {
      const parsed = JSON.parse(v2);
      return normalizeDB(parsed);
    }

    const old = localStorage.getItem('df-scan-ccf-v1');

    if (old) {
      const legacy = JSON.parse(old);

      const migrated = {
        groups: (legacy.groups || []).map(g => ({
          id: g.id,
          name: g.name,
          archived: !!g.archived,
          sessions: [],
          students: g.students || []
        })),
        activeGroupId: legacy.active || null,
        activeSessionId: null,
        history: legacy.history || [],
        settings: {}
      };

      localStorage.setItem(
        KEY,
        JSON.stringify(migrated)
      );

      return normalizeDB(migrated);
    }

    return emptyDB();

  } catch (e) {
    console.error(e);
    return emptyDB();
  }
}

function normalizeDB(data) {
  const out = {
    groups: Array.isArray(data.groups)
      ? data.groups
      : [],
    activeGroupId:
      data.activeGroupId ||
      data.active ||
      null,
    activeSessionId:
      data.activeSessionId ||
      null,
    history: Array.isArray(data.history)
      ? data.history
      : [],
    trainingScans:
      Array.isArray(data.trainingScans)
        ? data.trainingScans
        : [],
    settings:
      data.settings &&
      typeof data.settings === 'object'
        ? data.settings
        : {}
  };

  out.groups.forEach(g => {
    g.sessions = Array.isArray(g.sessions)
      ? g.sessions
      : [];

    g.students = Array.isArray(g.students)
      ? g.students
      : [];

    g.archived = !!g.archived;

    g.sessions.forEach(s => {
      s.students = Array.isArray(s.students)
        ? s.students
        : [];

      if (!['open', 'closed', 'locked'].includes(s.status)) {
        s.status = 'open';
      }
    });
  });

  return out;
}

function save() {
  localStorage.setItem(
    KEY,
    JSON.stringify(db)
  );
}

function uid() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return (
    Date.now() +
    '-' +
    Math.random()
      .toString(36)
      .slice(2)
  );
}

function esc(value) {
  return String(value ?? '')
    .replace(
      /[&<>"']/g,
      c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[c])
    );
}

function time(ms) {
  if (ms == null) return '—';

  ms = Number(ms);

  const min =
    Math.floor(ms / 60000);

  const sec =
    Math.floor(
      (ms % 60000) / 1000
    );

  const cs =
    Math.floor(
      (ms % 1000) / 10
    );

  return (
    `${min}:` +
    `${String(sec).padStart(2,'0')}.` +
    `${String(cs).padStart(2,'0')}`
  );
}

function sorted(list) {
  return [...list].sort(
    (a,b) =>
      String(a.last || '')
        .localeCompare(
          String(b.last || ''),
          'fr',
          { sensitivity:'base' }
        ) ||
      String(a.first || '')
        .localeCompare(
          String(b.first || ''),
          'fr',
          { sensitivity:'base' }
        )
  );
}

/* =========================
   BARÈME CCF
========================= */

const PERF_F = [
  306,299,292,285,278,272,
  266,260,254,248,242,236,
  230,225,220,215,210,205,
  200,195,190,185,180,175
];

const PERF_M = [
  242,237,232,227,222,217,
  212,207,202,197,192,188,
  184,180,176,172,168,165,
  162,159,156,153,150,147
];

function perf(sec, sex) {
  const arr =
    sex === 'M'
      ? PERF_M
      : PERF_F;

  let p = 0;

  for (
    let i = 0;
    i < arr.length;
    i++
  ) {
    if (sec <= arr[i]) {
      p = (i + 1) * 0.25;
    }
  }

  return Math.min(6,p);
}

function reg(ms) {
  if (ms == null) return 0;

  const s = ms / 1000;

  if (s >= 21) return 0;
  if (s >= 20) return .5;
  if (s >= 18) return 1;
  if (s >= 16) return 1.5;
  if (s >= 14) return 2;
  if (s >= 12) return 2.5;
  if (s >= 10) return 3;
  if (s >= 9) return 3.5;
  if (s >= 8) return 4;
  if (s >= 7) return 4.5;
  if (s >= 6) return 5;
  if (s >= 5) return 5.5;
  if (s < 4) return 6;

  return 5.5;
}

function convertSplitsToLaps(splits) {
  if (
    !Array.isArray(splits) ||
    splits.length < 4
  ) {
    return [];
  }

  return splits.map(
    (v,i) =>
      i === 0
        ? v
        : v - splits[i-1]
  );
}

function score(student) {
  const r1 =
    student.races?.[1];

  const r2 =
    student.races?.[2];

  if (!r1 || !r2) {
    return null;
  }

  if (
    !Array.isArray(r1.splits) ||
    !Array.isArray(r2.splits) ||
    r1.splits.length < 4 ||
    r2.splits.length < 4
  ) {
    return null;
  }

  const best =
    Math.min(
      Number(r1.totalMs),
      Number(r2.totalMs)
    );

  const laps = [
    ...convertSplitsToLaps(r1.splits),
    ...convertSplitsToLaps(r2.splits)
  ];

  const spread =
    Math.max(...laps) -
    Math.min(...laps);

  const pp =
    perf(
      best / 1000,
      student.sex
    );

  const rp =
    reg(spread);

  return {
    best,
    spread,
    pp,
    rp,
    total: pp + rp
  };
}

/* =========================
   GROUPES / RELEVÉS
========================= */

function activeGroup() {
  return db.groups.find(
    g =>
      g.id ===
      db.activeGroupId
  ) || null;
}

function activeSession() {
  const g = activeGroup();

  if (!g) return null;

  return g.sessions.find(
    s =>
      s.id ===
      db.activeSessionId
  ) || null;
}

function newGroup() {
  const name = prompt(
    'Nom du groupe\n\n' +
    'Exemple : Terminales ABCDE ' +
    'lundi 14h–16h'
  );

  if (!name) return null;

  const g = {
    id: uid(),
    name: name.trim(),
    archived: false,
    students: [],
    sessions: []
  };

  db.groups.push(g);

  db.activeGroupId = g.id;
  db.activeSessionId = null;

  save();
  render();

  return g;
}

function chooseGroup() {
  const available =
    db.groups.filter(
      g => !g.archived
    );

  if (!available.length) {
    return newGroup();
  }

  const create = confirm(
    'Préparer le scanner\n\n' +
    'OK : créer un nouveau groupe\n' +
    'Annuler : choisir un groupe existant'
  );

  if (create) {
    return newGroup();
  }

  const list =
    available
      .map(
        (g,i) =>
          `${i+1}. ${g.name}`
      )
      .join('\n');

  const current =
    available.findIndex(
      g =>
        g.id ===
        db.activeGroupId
    );

  const response =
    prompt(
      'Choisis le groupe :\n\n' +
      list,
      String(
        current >= 0
          ? current + 1
          : 1
      )
    );

  if (response == null) {
    return null;
  }

  const index =
    Number(response) - 1;

  const selected =
    available[index];

  if (!selected) {
    alert(
      'Groupe invalide.'
    );
    return null;
  }

  db.activeGroupId =
    selected.id;

  db.activeSessionId = null;

  save();
  render();

  return selected;
}

function createSession(group) {
  const now = new Date();

  const defaultName =
    now.toLocaleDateString(
      'fr-FR'
    );

  const custom =
    prompt(
      'Nom du relevé',
      defaultName
    );

  if (!custom) {
    return null;
  }

  const session = {
    id: uid(),
    createdAt: Date.now(),
    label: custom.trim(),
    status: 'open',
    students: []
  };

  group.sessions.push(session);

  db.activeSessionId =
    session.id;

  save();
  render();

  return session;
}

function chooseSession(group) {
  group.sessions =
    group.sessions || [];

  if (!group.sessions.length) {
    return createSession(group);
  }

  const create = confirm(
    `Groupe : ${group.name}\n\n` +
    'OK : créer un nouveau relevé\n' +
    'Annuler : continuer un relevé existant'
  );

  if (create) {
    return createSession(group);
  }

  const ordered =
    [...group.sessions]
      .sort(
        (a,b) =>
          b.createdAt -
          a.createdAt
      );

  const list =
    ordered
      .map(
        (s,i) =>
          `${i+1}. ${s.label}`
      )
      .join('\n');

  const response =
    prompt(
      'Choisis le relevé :\n\n' +
      list,
      '1'
    );

  if (response == null) {
    return null;
  }

  const selected =
    ordered[
      Number(response) - 1
    ];

  if (!selected) {
    alert(
      'Relevé invalide.'
    );
    return null;
  }

  db.activeSessionId =
    selected.id;

  save();
  render();

  return selected;
}

function prepareScanner() {
  const group =
    chooseGroup();

  if (!group) {
    return false;
  }

  const session =
    chooseSession(group);

  if (!session) {
    return false;
  }

  render();

  return true;
}

/* =========================
   CRÉATION / MISE À JOUR
   ÉLÈVE PAR QR
========================= */

function buildStudent(data) {
  return {
    id:
      data.studentId ||
      uid(),

    externalId:
      data.studentId ||
      '',

    last:
      data.last ||
      'Élève',

    first:
      data.first ||
      '',

    classroom:
      String(
        data.classroom || ''
      ).toUpperCase(),

    sex:
      data.sex || '',

    project1: '',
    project2: '',

    races: {},

    afl2: '',
    afl3: ''
  };
}

function updateIdentity(
  student,
  data
) {
  if (data.last) {
    student.last =
      data.last;
  }

  if (data.first) {
    student.first =
      data.first;
  }

  if (data.classroom) {
    student.classroom =
      String(
        data.classroom
      ).toUpperCase();
  }

  if (data.sex) {
    student.sex =
      data.sex;
  }
}

function updateMasterStudent(
  group,
  source
) {
  let student =
    group.students.find(
      s =>
        s.externalId ===
          source.externalId ||
        s.id === source.id
    );

  if (!student) {
    student = {
      ...source,
      races: {}
    };

    group.students.push(
      student
    );
  }

  updateIdentity(
    student,
    source
  );
}

function findStudent(
  session,
  studentId
) {
  return session.students.find(
    s =>
      s.externalId ===
        studentId ||
      s.id === studentId
  );
}

/* =========================
   QR
========================= */

function handleQR(raw) {
  let data;

  try {
    data =
      typeof raw === 'string'
        ? JSON.parse(raw)
        : raw;

  } catch (e) {
    return scanError(
      'QR illisible ou format inconnu.'
    );
  }

  /*
   * Les QR Chrono / Minuteur / VMA doivent être routés
   * AVANT toute validation CCF. Cela sécurise aussi le
   * scan caméra iPad, même si un autre script a repris le
   * bouton de validation.
   */
  if (
    data?.type ===
      'DF_TRAINING_RESULT'
  ) {
    if (
      typeof window
        .handleTrainingResult ===
        'function'
    ) {
      return window
        .handleTrainingResult(
          data
        );
    }

    return scanError(
      'Module résultats entraînement indisponible.'
    );
  }

  if (
    !data ||
    !data.studentId ||
    !data.race
  ) {
    return scanError(
      'QR non conforme.'
    );
  }

  let group =
    activeGroup();

  let session =
    activeSession();

  if (!group || !session) {
    const ok =
      prepareScanner();

    if (!ok) {
      return scanError(
        'Sélection du groupe annulée.'
      );
    }

    group =
      activeGroup();

    session =
      activeSession();
  }

  if (
    session.status ===
    'locked'
  ) {
    return scanError(
      'Évaluation verrouillée : scan refusé.'
    );
  }

  /*
   * Une évaluation ne peut contenir qu'un seul protocole.
   * Le premier scan fixe le type de l'évaluation.
   */
  if (
    session.type &&
    session.type !== 'ccf'
  ) {
    return scanError(
      'Cette évaluation est configurée pour le 3 × 500. Crée une évaluation séparée pour le 2 × 800.'
    );
  }

  session.type = 'ccf';

  const race =
    Number(data.race);

  if (![1,2].includes(race)) {
    return scanError(
      'Numéro de course invalide.'
    );
  }

  let student =
    findStudent(
      session,
      data.studentId
    );

  const newStudent =
    !student;

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

  student.races =
    student.races || {};

  if (
    student.races[race]
  ) {
    const previous =
      student.races[race];

    const sameQR =
      data.resultId &&
      previous.resultId &&
      String(data.resultId) ===
        String(previous.resultId);

    if (sameQR) {
      scanError(
        `${student.last} ${student.first} · QR déjà scanné.`
      );
      return;
    }

    const replace =
      confirm(
        `${student.last} ` +
        `${student.first}\n\n` +
        `Le 800 n°${race} ` +
        'est déjà enregistré.\n\n' +
        'Remplacer ce relevé ?'
      );

    if (!replace) {
      return;
    }
  }

  student.races[race] = {
    totalMs:
      Number(
        data.totalMs
      ) || 0,

    splits:
      Array.isArray(
        data.splits
      )
        ? data.splits.map(Number)
        : [],

    project:
      data.project || '',

    resultId:
      data.resultId || '',

    scannedAt:
      Date.now()
  };

  if (
    race === 1 &&
    data.project
  ) {
    student.project1 =
      data.project;
  }

  if (
    race === 2 &&
    data.project
  ) {
    student.project2 =
      data.project;
  }

  updateMasterStudent(
    group,
    student
  );

  db.history.unshift({
    at: Date.now(),
    groupId:
      group.id,
    sessionId:
      session.id,
    studentId:
      student.id,
    race
  });

  save();

  beep();

  const message =
    $('scanMessage');

  if (message) {
    message.className =
      'scan-ok';

    message.innerHTML =
      `✓ ` +
      `${esc(
        student.last.toUpperCase()
      )} ` +
      `${esc(student.first)}` +
      `<br>` +
      `${esc(
        student.classroom
      )}` +
      ` · 800 n°${race}` +
      ` · ${time(
        Number(
          data.totalMs
        ) || 0
      )}`;
  }

  if (
    student.races[1] &&
    student.races[2]
  ) {
    toast(
      'Fiche élève complétée'
    );
  } else if (newStudent) {
    toast(
      'Élève créé automatiquement'
    );
  } else {
    toast(
      'Résultat ajouté'
    );
  }

  render();
}

/* =========================
   UI
========================= */

function classes(session) {
  return [
    ...new Set(
      (session?.students || [])
        .map(
          s => s.classroom
        )
        .filter(Boolean)
    )
  ].sort();
}

function renderGroupSelect() {
  const el =
    $('groups');

  if (!el) return;

  const groups =
    db.groups.filter(
      g => !g.archived
    );

  el.innerHTML =
    groups.map(
      g =>
        `<option ` +
        `value="${g.id}" ` +
        `${
          g.id ===
          db.activeGroupId
            ? 'selected'
            : ''
        }>` +
        `${esc(g.name)}` +
        `</option>`
    ).join('');
}

function renderSessionBanner() {
  const scan =
    $('scan');

  if (!scan) return;

  let banner =
    $('sessionBanner');

  if (!banner) {
    banner =
      document.createElement(
        'div'
      );

    banner.id =
      'sessionBanner';

    banner.className =
      'card';

    scan.prepend(
      banner
    );
  }

  const g =
    activeGroup();

  const s =
    activeSession();

  if (!g || !s) {
    banner.innerHTML =
      `<strong>` +
      `Aucun relevé actif` +
      `</strong><br>` +
      `<span>` +
      `Ouvre le scanner pour ` +
      `choisir un groupe.` +
      `</span>`;

    return;
  }

  banner.innerHTML =
    `<strong>` +
    `${esc(g.name)}` +
    `</strong><br>` +
    `<span>` +
    `Relevé : ` +
    `${esc(s.label)}` +
    ` · ` +
    `${s.students.length} ` +
    `élève(s)` +
    `</span>`;
}

function renderFilters() {
  const session =
    activeSession();

  const list =
    classes(session);

  const html =
    `<button ` +
    `class="filter ${
      filter === 'ALL'
        ? 'active'
        : ''
    }" ` +
    `data-filter="ALL">` +
    `Tous</button>` +

    list.map(
      c =>
        `<button ` +
        `class="filter ${
          filter === c
            ? 'active'
            : ''
        }" ` +
        `data-filter="${esc(c)}">` +
        `${esc(c)}` +
        `</button>`
    ).join('');

  [
    $('filters'),
    $('resultFilters')
  ]
  .filter(Boolean)
  .forEach(
    e => e.innerHTML = html
  );

  document
    .querySelectorAll(
      '[data-filter]'
    )
    .forEach(
      b => {
        b.onclick = () => {
          filter =
            b.dataset.filter;

          render();
        };
      }
    );
}

function visibleStudents() {
  const session =
    activeSession();

  if (!session) {
    return [];
  }

  return sorted(
    session.students
  ).filter(
    s =>
      filter === 'ALL' ||
      s.classroom === filter
  );
}

function renderStudents() {
  const body =
    $('students');

  if (!body) return;

  body.innerHTML =
    visibleStudents()
      .map(
        student => {
          const sc =
            score(student);

          return `
            <tr data-student-id="${esc(student.id)}">
              <td>
                <b>
                  ${esc(
                    student.last
                      .toUpperCase()
                  )}
                  ${esc(
                    student.first
                  )}
                </b>
              </td>

              <td>
                ${esc(
                  student.classroom
                )}
              </td>

              <td>
                ${esc(
                  student.project1 ||
                  student.races?.[1]
                    ?.project ||
                  ''
                )}
              </td>

              <td>
                ${esc(
                  student.project2 ||
                  student.races?.[2]
                    ?.project ||
                  ''
                )}
              </td>

              <td>
                ${time(
                  student.races?.[1]
                    ?.totalMs
                )}
              </td>

              <td>
                ${time(
                  student.races?.[2]
                    ?.totalMs
                )}
              </td>

              <td>
                <b>
                  ${
                    sc
                      ? sc.total
                          .toFixed(2)
                        + '/12'
                      : '—'
                  }
                </b>
              </td>

              <td>
                <button
                  type="button"
                  class="student-delete-hold"
                  data-student-id="${esc(student.id)}"
                  title="Maintenir pour supprimer"
                >
                  Supprimer
                </button>
              </td>
            </tr>
          `;
        }
      )
      .join('');
}

function renderResults() {
  const body =
    $('resultRows');

  if (!body) return;

  const locked =
    activeSession()?.status ===
    'locked';

  body.innerHTML =
    visibleStudents()
      .map(
        student => {
          const sc =
            score(student);

          const a2 =
            student.afl2 ?? '';

          const a3 =
            student.afl3 ?? '';

          const total =
            sc &&
            a2 !== '' &&
            a3 !== ''
              ? Math.min(
                  20,
                  sc.total +
                  Number(a2) +
                  Number(a3)
                ).toFixed(2)
              : '—';

          return `
            <tr>

              <td>
                <b>
                  ${esc(
                    student.last
                      .toUpperCase()
                  )}
                  ${esc(
                    student.first
                  )}
                </b>
              </td>

              <td>
                ${esc(
                  student.classroom
                )}
              </td>

              <td>
                ${time(
                  student.races?.[1]
                    ?.totalMs
                )}
              </td>

              <td>
                ${time(
                  student.races?.[2]
                    ?.totalMs
                )}
              </td>

              <td>
                ${
                  sc
                    ? time(sc.best)
                    : '—'
                }
              </td>

              <td>
                ${
                  sc
                    ? sc.pp.toFixed(2)
                    : '—'
                }
              </td>

              <td>
                ${
                  sc
                    ? sc.rp.toFixed(2)
                    : '—'
                }
              </td>

              <td>
                <b>
                  ${
                    sc
                      ? sc.total
                          .toFixed(2)
                      : '—'
                  }
                </b>
              </td>

              <td>
                <input
                  class="points"
                  data-id="${student.id}"
                  data-key="afl2"
                  type="number"
                  step="0.25"
                  value="${a2}"
                  ${locked ? 'disabled' : ''}
                >
              </td>

              <td>
                <input
                  class="points"
                  data-id="${student.id}"
                  data-key="afl3"
                  type="number"
                  step="0.25"
                  value="${a3}"
                  ${locked ? 'disabled' : ''}
                >
              </td>

              <td>
                <b>
                  ${total}
                </b>
              </td>

            </tr>
          `;
        }
      )
      .join('');

  document
    .querySelectorAll(
      '.points'
    )
    .forEach(
      input => {
        input.onchange = () => {
          const session =
            activeSession();

          if (!session) return;

          if (
            session.status ===
            'locked'
          ) {
            renderResults();

            return scanError(
              'Évaluation verrouillée.'
            );
          }

          const student =
            session.students.find(
              s =>
                s.id ===
                input.dataset.id
            );

          if (!student) return;

          student[
            input.dataset.key
          ] =
            input.value === ''
              ? ''
              : Number(
                  input.value
                );

          save();
          renderResults();
        };
      }
    );
}

function render() {
  renderGroupSelect();
  renderSessionBanner();
  renderFilters();
  renderStudents();
  renderResults();

  const archive =
    $('archive');

  if (archive) {
    archive.disabled =
      !activeGroup();
  }
}

/* =========================
   MESSAGES
========================= */

function toast(text) {
  const el =
    $('toast');

  if (!el) return;

  el.textContent =
    text;

  el.classList.remove(
    'hidden'
  );

  clearTimeout(
    toast.timer
  );

  toast.timer =
    setTimeout(
      () =>
        el.classList.add(
          'hidden'
        ),
      1800
    );
}

function scanError(text) {
  const msg =
    $('scanMessage');

  if (msg) {
    msg.className =
      'scan-bad';

    msg.textContent =
      text;
  }

  toast(text);
}

function beep() {
  try {
    const AC =
      window.AudioContext ||
      window.webkitAudioContext;

    const ctx =
      new AC();

    const osc =
      ctx.createOscillator();

    const gain =
      ctx.createGain();

    osc.connect(gain);

    gain.connect(
      ctx.destination
    );

    osc.frequency.value =
      880;

    gain.gain.value =
      .12;

    osc.start();

    osc.stop(
      ctx.currentTime +
      .12
    );

  } catch (e) {}

  navigator.vibrate?.(80);
}

/* =========================
   NAVIGATION
========================= */

function showPage(id) {
  document
    .querySelectorAll(
      '.page'
    )
    .forEach(
      p =>
        p.classList.add(
          'hidden'
        )
    );

  document
    .querySelectorAll(
      'nav button'
    )
    .forEach(
      b =>
        b.classList.remove(
          'active'
        )
    );

  $(id)?.classList.remove(
    'hidden'
  );

  document
    .querySelector(
      `nav button[data-page="${id}"]`
    )
    ?.classList.add(
      'active'
    );
}

/* =========================
   SAUVEGARDE
========================= */

function downloadBackup() {
  const blob =
    new Blob(
      [
        JSON.stringify(
          db,
          null,
          2
        )
      ],
      {
        type:
          'application/json'
      }
    );

  const a =
    document.createElement(
      'a'
    );

  a.href =
    URL.createObjectURL(
      blob
    );

  a.download =
    'DemiFond_Scan_CCF_sauvegarde.json';

  a.click();

  URL.revokeObjectURL(
    a.href
  );
}

async function restoreBackup(
  file
) {
  try {
    const content =
      await file.text();

    db =
      normalizeDB(
        JSON.parse(
          content
        )
      );

    save();
    render();

    toast(
      'Sauvegarde restaurée'
    );

  } catch (e) {
    alert(
      'Sauvegarde invalide.'
    );
  }
}

/* =========================
   INITIALISATION
========================= */

function init() {

  /* navigation */

  document
    .querySelectorAll(
      'nav button'
    )
    .forEach(
      button => {

        button.onclick =
          () => {

            const page =
              button.dataset.page;

            showPage(page);
            render();

            /*
             * Le rendu générique construit d'abord le tableau 2 × 800.
             * Pour une évaluation 3 × 500, le module dédié doit reprendre
             * immédiatement la vue au même clic, sans demander un 2e clic.
             */
            if (
              page === 'results' &&
              activeSession()?.type === 'exam500' &&
              typeof window.renderExam500View === 'function'
            ) {
              window.renderExam500View();
            }
          };
      }
    );

  /* groupes */

  if ($('addGroup')) {
    $('addGroup').onclick =
      newGroup;
  }

  if ($('groups')) {
    $('groups').onchange =
      e => {

        db.activeGroupId =
          e.target.value;

        db.activeSessionId =
          null;

        filter =
          'ALL';

        save();
        render();
      };
  }

  if ($('archive')) {
    $('archive').onclick =
      () => {

        const g =
          activeGroup();

        if (!g) return;

        if (
          confirm(
            `Archiver ${g.name} ?`
          )
        ) {
          g.archived =
            true;

          db.activeGroupId =
            null;

          db.activeSessionId =
            null;

          save();
          render();
        }
      };
  }

  /* ancien bouton ajouter élève :
     conservé seulement comme secours */

  if ($('addStudent')) {
    $('addStudent').onclick =
      () => {

        let g =
          activeGroup();

        if (!g) {
          g =
            newGroup();

          if (!g) return;
        }

        let session =
          activeSession();

        if (!session) {
          session =
            createSession(g);

          if (!session) return;
        }

        if (
          session.status ===
          'locked'
        ) {
          return scanError(
            'Évaluation verrouillée : modification impossible.'
          );
        }

        const last =
          $('last')
            ?.value
            .trim();

        const first =
          $('first')
            ?.value
            .trim();

        const classroom =
          $('classroom')
            ?.value
            .trim()
            .toUpperCase();

        if (
          !last ||
          !first ||
          !classroom
        ) {
          alert(
            'Nom, prénom et classe ' +
            'sont obligatoires.'
          );
          return;
        }

        const student = {
          id: uid(),
          externalId: '',
          last,
          first,
          classroom,
          sex:
            $('sex')?.value ||
            '',
          project1:
            $('p1')?.value
              .trim() ||
            '',
          project2:
            $('p2')?.value
              .trim() ||
            '',
          races: {},
          afl2: '',
          afl3: ''
        };

        session.students.push(
          student
        );

        updateMasterStudent(
          g,
          student
        );

        [
          'last',
          'first',
          'classroom',
          'p1',
          'p2'
        ].forEach(
          id => {
            if ($(id)) {
              $(id).value =
                '';
            }
          }
        );

        save();
        render();
      };
  }

  /* QR texte et scanner-ios */

  if ($('readText')) {
    $('readText').onclick =
      () => {
        const raw =
          $('qrText')
            ?.value
            .trim();

        if (!raw) {
          return scanError(
            'Aucun QR à lire.'
          );
        }

        handleQR(raw);
      };
  }

  /* sauvegarde */

  if ($('backup')) {
    $('backup').onclick =
      downloadBackup;
  }

  if ($('restore')) {
    $('restore').onchange =
      e => {

        const file =
          e.target.files?.[0];

        if (file) {
          restoreBackup(
            file
          );
        }
      };
  }

  render();
}

if (
  document.readyState ===
  'loading'
) {
  document.addEventListener(
    'DOMContentLoaded',
    init
  );
} else {
  init();
}
