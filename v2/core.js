/* DemiFond Scan v2 — cœur : données, calculs et lecture des QR.
   Les calculs et les contrôles de QR sont repris À L'IDENTIQUE de la version 1
   (app.js, evaluation-ccf.js, exam500-ui.js, qr-validation.js, training-qr-ui.js),
   pour que les notes ne changent pas. Seule l'interface est nouvelle.
   Format des données inchangé : localStorage « df-scan-ccf-v2 ». */
(function () {
"use strict";
const KEY = "df-scan-ccf-v2";

/* ---------- Outils ---------- */
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now() + "-" + Math.random().toString(36).slice(2, 10));
const copy = v => JSON.parse(JSON.stringify(v));
const num = v => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const dayOf = value => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Luxembourg", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value || Date.now()));
function time(ms) {
  if (ms == null || !Number.isFinite(Number(ms))) return "—";
  ms = Number(ms);
  const min = Math.floor(ms / 60000), sec = Math.floor((ms % 60000) / 1000), cs = Math.floor((ms % 1000) / 10);
  return min + ":" + String(sec).padStart(2, "0") + "." + String(cs).padStart(2, "0");
}
const short = ms => { if (ms == null || !Number.isFinite(Number(ms))) return "—"; const t = Math.round(Number(ms) / 100) / 10, m = Math.floor(t / 60), s = t - m * 60; return (m ? m + "’" + (s < 10 ? "0" : "") : "") + s.toFixed(1).replace(".", ",") + (m ? "" : " s"); };
const pts = v => v == null || !Number.isFinite(Number(v)) ? "—" : String(Math.round(Number(v) * 100) / 100).replace(".", ",");
/* Saisie manuelle d'un temps : 3:12.45, 3'12, 3 12, 192.4 (secondes), 312 (= 3:12) */
function parseTimeInput(raw) {
  const s = String(raw || "").trim().replace(/[’']/g, ":").replace(/[”"]/g, "").replace(",", ".").replace(/\s+/g, ":");
  if (!s) return null;
  let m = s.match(/^(\d+):(\d{1,2})(?:[.:](\d{1,2}))?$/);
  if (m) { const sec = Number(m[2]); if (sec >= 60) return null; return Number(m[1]) * 60000 + sec * 1000 + (m[3] ? Number(m[3].padEnd(2, "0")) * 10 : 0); }
  m = s.match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!m) return null;
  if (!m[2] && m[1].length >= 3) { const sec = Number(m[1].slice(-2)); if (sec >= 60) return null; return Number(m[1].slice(0, -2)) * 60000 + sec * 1000; }
  return Math.round(Number(m[1] + (m[2] ? "." + m[2] : "")) * 1000);
}
const studentName = s => (String(s?.last || "").toUpperCase() + " " + String(s?.first || "")).trim() || "Élève";
const sameStudent = (a, b) => !!a && !!b && ((a.externalId && b.externalId && String(a.externalId) === String(b.externalId)) || String(a.id) === String(b.id) || (a.externalId && String(a.externalId) === String(b.id)) || (b.externalId && String(b.externalId) === String(a.id)));

/* ---------- Base de données ---------- */
function emptyDB() { return { groups: [], activeGroupId: null, activeSessionId: null, history: [], trainingScans: [], settings: {} }; }
function normalizeDB(data) {
  const out = {
    groups: Array.isArray(data?.groups) ? data.groups : [],
    activeGroupId: data?.activeGroupId || data?.active || null,
    activeSessionId: data?.activeSessionId || null,
    history: Array.isArray(data?.history) ? data.history : [],
    trainingScans: Array.isArray(data?.trainingScans) ? data.trainingScans : [],
    settings: data?.settings && typeof data.settings === "object" ? data.settings : {}
  };
  out.groups.forEach((g, i) => {
    g.sessions = Array.isArray(g.sessions) ? g.sessions : [];
    g.students = Array.isArray(g.students) ? g.students : [];
    g.archived = !!g.archived;
    if (!Number.isInteger(g.uiColor) || g.uiColor < 0) g.uiColor = i % 8;
    g.sessions.forEach(s => {
      s.students = Array.isArray(s.students) ? s.students : [];
      if (!["open", "closed", "locked"].includes(s.status)) s.status = "open";
      s.lessonId ||= s.id; s.lessonDate ||= dayOf(s.createdAt); s.lessonLabel ||= s.label || "Séance";
      if (s.type === "exam500" && !s.exam500Bareme && out.settings.exam500Bareme) s.exam500Bareme = copy(out.settings.exam500Bareme);
    });
  });
  out.settings.htmlExports ||= {};
  return out;
}
function loadDB() {
  try {
    const v2 = localStorage.getItem(KEY);
    if (v2) return normalizeDB(JSON.parse(v2));
    const old = localStorage.getItem("df-scan-ccf-v1");
    if (old) {
      const legacy = JSON.parse(old);
      return normalizeDB({ groups: (legacy.groups || []).map(g => ({ id: g.id, name: g.name, archived: !!g.archived, sessions: [], students: g.students || [] })), activeGroupId: legacy.active || null, history: legacy.history || [] });
    }
  } catch (e) { console.error(e); }
  return emptyDB();
}

/* ---------- Copies de secours dans IndexedDB (plus de place que localStorage) ---------- */
const IDB = { db: null };
function idbOpen() {
  if (IDB.db) return Promise.resolve(IDB.db);
  return new Promise((ok, ko) => {
    if (!window.indexedDB) return ko(new Error("IndexedDB indisponible"));
    const req = indexedDB.open("demifond-v2", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("backups", { keyPath: "at" });
    req.onsuccess = () => { IDB.db = req.result; ok(IDB.db); };
    req.onerror = () => ko(req.error);
  });
}
async function idbAdd(raw, reason) {
  try {
    const db = await idbOpen();
    await new Promise((ok, ko) => { const tx = db.transaction("backups", "readwrite"); tx.objectStore("backups").put({ at: Date.now(), reason: reason || "auto", raw }); tx.oncomplete = ok; tx.onerror = () => ko(tx.error); });
    const all = await idbList();
    /* On garde les 15 plus récentes, plus une par jour sur 30 jours. */
    const keep = new Set(all.slice(0, 15).map(b => b.at)), days = new Set();
    all.forEach(b => { const d = dayOf(b.at); if (!days.has(d) && days.size < 30) { days.add(d); keep.add(b.at); } if (b.reason !== "auto") keep.add(b.at); });
    const drop = all.filter(b => !keep.has(b.at));
    if (drop.length) await new Promise(ok => { const tx = db.transaction("backups", "readwrite"); drop.forEach(b => tx.objectStore("backups").delete(b.at)); tx.oncomplete = ok; tx.onerror = ok; });
  } catch (e) { console.warn("Copie de secours impossible", e); }
}
async function idbList() {
  try {
    const db = await idbOpen();
    return await new Promise((ok, ko) => { const req = db.transaction("backups").objectStore("backups").getAll(); req.onsuccess = () => ok(req.result.sort((a, b) => b.at - a.at)); req.onerror = () => ko(req.error); });
  } catch (e) { return []; }
}

/* ---------- Séances (leçons) et exercices ---------- */
function lessons(group) {
  const out = new Map();
  for (const ex of group?.sessions || []) {
    const id = ex.lessonId || ex.id;
    if (!out.has(id)) out.set(id, { id, date: ex.lessonDate || dayOf(ex.createdAt), label: ex.lessonLabel || ex.label, exercises: [] });
    out.get(id).exercises.push(ex);
  }
  return [...out.values()].sort((a, b) => String(b.date).localeCompare(String(a.date)) || 0);
}
const TYPES = { ccf: "2 × 800 (CCF)", exam500: "3 × 500", training: "Entraînement" };
function effectiveType(db, group, ex) {
  if (ex.type) return ex.type;
  if (ex.students?.some(s => s.exam500)) return "exam500";
  if (ex.students?.some(s => s.races && Object.keys(s.races).length)) return "ccf";
  if ((db.trainingScans || []).some(r => String(r.groupId) === String(group.id) && String(r.sessionId) === String(ex.id))) return "training";
  return "";
}
const trainingRows = (db, group, ex) => (db.trainingScans || []).filter(r => String(r.groupId) === String(group.id) && String(r.sessionId) === String(ex.id));

/* ========== 2 × 800 CCF (evaluation-ccf.js) ========== */
const ALLOCATION_POINTS = { 2: { 1: 0.5, 2: 1, 3: 1.5, 4: 2 }, 4: { 1: 1, 2: 2, 3: 3, 4: 4 }, 6: { 1: 1.5, 2: 3, 3: 4.5, 4: 6 } };
const PERF_F = [306, 299, 292, 285, 278, 272, 266, 260, 254, 248, 242, 236, 230, 225, 220, 215, 210, 205, 200, 195, 190, 185, 180, 175];
const PERF_M = [242, 237, 232, 227, 222, 217, 212, 207, 202, 197, 192, 188, 184, 180, 176, 172, 168, 165, 162, 159, 156, 153, 150, 147];
function laps200(splits) {
  if (!Array.isArray(splits) || splits.length < 4) return [];
  const v = splits.slice(0, 4).map(Number);
  if (v.some(x => !Number.isFinite(x))) return [];
  return v.map((x, i) => (i === 0 ? x : x - v[i - 1]));
}
function perf800(sec, sex) {
  const scale = String(sex || "").toUpperCase() === "M" ? PERF_M : PERF_F;
  let p = 0; scale.forEach((t, i) => { if (sec <= t) p = (i + 1) * 0.25; });
  return Math.min(6, p);
}
function efficiency800(ms) {
  if (!Number.isFinite(Number(ms))) return 0;
  const s = Number(ms) / 1000;
  if (s >= 21) return 0; if (s >= 20) return 0.5; if (s >= 18) return 1; if (s >= 16) return 1.5; if (s >= 14) return 2; if (s >= 12) return 2.5;
  if (s >= 10) return 3; if (s >= 9) return 3.5; if (s >= 8) return 4; if (s >= 7) return 4.5; if (s >= 6) return 5; if (s >= 5) return 5.5; if (s < 4) return 6;
  return 5.5;
}
function scoreCCF(st) {
  const r1 = st?.races?.[1], r2 = st?.races?.[2];
  if (!r1 || !r2) return null;
  const l1 = laps200(r1.splits), l2 = laps200(r2.splits);
  if (l1.length !== 4 || l2.length !== 4) return null;
  const t1 = Number(r1.totalMs), t2 = Number(r2.totalMs);
  if (!Number.isFinite(t1) || !Number.isFinite(t2)) return null;
  const all = [...l1, ...l2], best = Math.min(t1, t2), fastest200 = Math.min(...all), slowest200 = Math.max(...all), spread = slowest200 - fastest200;
  const pp = perf800(best / 1000, st.sex), rp = efficiency800(spread);
  return { best, fastest200, slowest200, spread, pp, rp, total: pp + rp, laps1: l1, laps2: l2 };
}
function allocation(st) {
  const key = ["2-6", "4-4", "6-2"].includes(st.aflAllocation) ? st.aflAllocation : "4-4";
  const [a2, a3] = key.split("-").map(Number);
  return { key, a2, a3, auto: !["2-6", "4-4", "6-2"].includes(st.aflAllocation) };
}
const levelPoints = (max, level) => ALLOCATION_POINTS[max]?.[Number(level)] ?? null;
function parseProject(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v).trim().replace(",", ".");
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s) * 1000;
  const m = s.match(/^(\d+):([0-5]?\d)(?:\.(\d{1,2}))?$/);
  if (!m) return null;
  return Number(m[1]) * 60000 + Number(m[2]) * 1000 + (m[3] ? Number(m[3].padEnd(2, "0")) : 0) * 10;
}
const projectOf = (st, race) => st[`project${race}`] || st?.races?.[race]?.project || "";
function projectMetrics(st) {
  const p1 = parseProject(projectOf(st, 1)), p2 = parseProject(projectOf(st, 2));
  const t1 = Number(st?.races?.[1]?.totalMs), t2 = Number(st?.races?.[2]?.totalMs);
  if (p1 == null || p2 == null || !Number.isFinite(t1) || !Number.isFinite(t2)) return null;
  const e1 = Math.abs(t1 - p1), e2 = Math.abs(t2 - p2), sum = e1 + e2, s = sum / 1000;
  const level = s < 8 ? 4 : s <= 15 ? 3 : s <= 24 ? 2 : 1;
  return { p1, p2, e1, e2, sum, level };
}
const medicalRace = r => r?.status === "medical_stop" || r?.statusLabel === "INAPTE_MEDICAL" || r?.statusLabel === "Inapte / arrêt médical";
const medicalCCF = st => medicalRace(st?.races?.[1]) || medicalRace(st?.races?.[2]);
function noteCCF(st) {
  const sc = scoreCCF(st), pm = projectMetrics(st), a = allocation(st);
  const p2 = levelPoints(a.a2, st.afl2Level), p3 = levelPoints(a.a3, st.afl3Level);
  const final = sc && p2 != null && p3 != null ? Math.min(20, sc.total + p2 + p3) : null;
  return { sc, pm, a, p2, p3, final, medical: medicalCCF(st) };
}

/* ========== 3 × 500 (exam500-ui.js) ========== */
const DEFAULT_BAREME = {
  girls: [], boys: [],
  gap: [[26, 0], [25, .25], [24, .5], [23, .5], [22, .5], [21, .5], [20, .5], [19, .75], [18, .75], [17, .75], [16, .75], [15, 1], [14, 1], [13, 1], [12, 1.25], [11, 1.25], [10, 1.5], [9, 1.5], [8, 2], [7, 2], [6, 2], [4, 2], [3, 2], [2, 2], [1, 2], [0, 2]],
  efficiency: [[24, 0], [23, .25], [22, .5], [21, .5], [20, 1], [19, 1.25], [18, 1.5], [17, 1.75], [16, 2], [15, 2.25], [14, 2.5], [13, 2.75], [12, 3], [11, 3.5], [10, 4], [9, 4.5], [8, 5], [7, 5.5], [6, 5.75], [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6]]
};
const LEGACY_PERFORMANCE_500 = {
  girls: [["5:00", 6], ["5:30", 6], ["5:37", 5.75], ["5:44", 5.5], ["5:52", 5.25], ["6:00", 5], ["6:08", 4.75], ["6:16", 4.5], ["6:24", 4.25], ["6:32", 4], ["6:40", 3.75], ["6:48", 3.5], ["6:52", 3.25], ["7:00", 3], ["7:14", 2.75], ["7:28", 2.5], ["7:42", 2.25], ["7:56", 2], ["8:10", 1.75], ["8:24", 1.5], ["8:40", 1.25], ["8:56", 1], ["9:10", 0.75], ["9:26", 0.5], ["9:42", 0.25]],
  boys: [["4:00", 6], ["4:45", 6], ["4:47", 5.75], ["4:49", 5.5], ["4:52", 5.25], ["4:55", 5], ["4:58", 4.75], ["5:01", 4.5], ["5:05", 4.25], ["5:09", 4], ["5:13", 3.75], ["5:17", 3.5], ["5:21", 3.25], ["5:25", 3], ["5:41", 2.75], ["5:57", 2.5], ["6:13", 2.25], ["6:29", 2], ["6:45", 1.75], ["6:54", 1.5], ["7:05", 1.25], ["7:20", 1], ["7:35", 0.75], ["7:50", 0.5], ["8:05", 0.25]]
};
const LEVEL_ANCHORS_500 = {
  seconde: { girls: [[6, 119], [5, 130], [4, 143], [3, 156], [2, 171], [1, 187]], boys: [[6, 100], [5, 109], [4, 119], [3, 131], [2, 144], [1, 158]] },
  premiere: { girls: [[6, 110], [5, 120], [4, 132], [3, 145], [2, 159], [1, 175]], boys: [[6, 90], [5, 96], [4, 104], [3, 115], [2, 126], [1, 139]] }
};
function makePerformanceRows500(anchors) {
  const rows = [];
  for (let q = 24; q >= 1; q--) {
    const p = q / 4; let seconds;
    if (p >= 1) {
      const top = Math.min(5, Math.floor(p)), low = top === 5 ? 5 : top, high = top + 1;
      const hs = anchors.find(x => x[0] === high)[1], ls = anchors.find(x => x[0] === low)[1];
      seconds = ls + (hs - ls) * (p - low);
    } else seconds = anchors.find(x => x[0] === 1)[1] + (1 - p) * 40;
    const sum = Math.round(seconds * 3);
    rows.push([Math.floor(sum / 60) + ":" + String(sum % 60).padStart(2, "0"), p]);
  }
  return rows;
}
function performancePreset500(level, existing) {
  const spec = LEVEL_ANCHORS_500[level];
  return { girls: makePerformanceRows500(spec.girls), boys: makePerformanceRows500(spec.boys), gap: copy(existing.gap), efficiency: copy(existing.efficiency) };
}
{ const o = performancePreset500("seconde", DEFAULT_BAREME); DEFAULT_BAREME.girls = o.girls; DEFAULT_BAREME.boys = o.boys; }
function upgradeLegacyPerformance500(b, level) {
  if (!b || !Array.isArray(b.girls) || !Array.isArray(b.boys)) return b;
  if (JSON.stringify(b.girls) !== JSON.stringify(LEGACY_PERFORMANCE_500.girls) || JSON.stringify(b.boys) !== JSON.stringify(LEGACY_PERFORMANCE_500.boys)) return b;
  const p = performancePreset500(level === "premiere" ? "premiere" : "seconde", b); b.girls = p.girls; b.boys = p.boys; return b;
}
function parseTime500(text) {
  const raw = String(text || "").trim().replace(",", ".");
  if (!raw) return null;
  const p = raw.split(":");
  if (p.length === 2) { const m = Number(p[0]), s = Number(p[1]); if (Number.isFinite(m) && Number.isFinite(s)) return (m * 60 + s) * 1000; }
  const n = Number(raw); return Number.isFinite(n) ? n * 1000 : null;
}
function bareme500(db, ex) {
  db.settings.exam500Bareme = upgradeLegacyPerformance500(db.settings.exam500Bareme || copy(DEFAULT_BAREME), "seconde");
  if (ex && ex.type === "exam500") {
    if (!ex.exam500Bareme) ex.exam500Bareme = copy(db.settings.exam500Bareme);
    return upgradeLegacyPerformance500(ex.exam500Bareme, ex.exam500EvaluationLevel);
  }
  return db.settings.exam500Bareme;
}
const premiere500 = ex => ex?.exam500EvaluationLevel === "premiere";
const extraScore = (st, f, max) => { const v = st[f]; if (v === "" || v == null) return null; const n = Number(v); return Number.isFinite(n) && n >= 0 && n <= max ? n : null; };
function races500(st) { const r = Array.isArray(st?.exam500?.races) ? st.exam500.races : []; return [1, 2, 3].map(n => r.find(x => Number(x.race) === n) || null); }
function complete500(st) {
  const [c1, c2, c3] = races500(st);
  if (!c1 || !c2 || !c3) return false;
  const ok = r => { const s = Number(r.split250Ms), t = Number(r.total500Ms); return Number.isFinite(s) && s > 0 && Number.isFinite(t) && t > s; };
  return ok(c1) && ok(c2) && ok(c3) && Number(c1.projectMs) > 0 && Number(c2.projectMs) > 0;
}
function performancePoints500(db, ex, st) {
  if (!complete500(st)) return 0;
  const b = bareme500(db, ex), rows = st.sex === "M" ? b.boys : b.girls;
  const total = races500(st).reduce((s, r) => s + Number(r.total500Ms), 0);
  const th = rows.map(([t, p]) => ({ ms: parseTime500(t), p: Number(p) })).filter(x => x.ms != null).sort((a, b) => a.ms - b.ms);
  if (!th.length) return 0;
  if (total < th[0].ms) return th[0].p;
  if (total > th[th.length - 1].ms) return 0;
  let p = 0; for (const r of th) { if (total >= r.ms) p = r.p; else break; } return p;
}
const estimationCount500 = ex => premiere500(ex) && ex?.exam500EstimationCount === 3 ? 3 : 2;
function estimationMetrics500(ex, st) {
  const n = estimationCount500(ex), races = races500(st).slice(0, n), w = 3 / n;
  const details = races.map((r, i) => {
    const a = Number(r?.projectMs), t = Number(r?.total500Ms);
    if (!r || !Number.isFinite(a) || a <= 0 || !Number.isFinite(t) || t <= 0) return { race: i + 1, errorMs: null, points: null };
    const e = Math.abs(t - a); return { race: i + 1, errorMs: e, points: e <= 3000 ? w : e <= 6000 ? w / 2 : 0 };
  });
  return { details, points: details.every(x => x.points !== null) ? Math.round(details.reduce((s, x) => s + x.points, 0) * 100) / 100 : null, errorMs: details.every(x => x.errorMs !== null) ? details.reduce((s, x) => s + x.errorMs, 0) : null };
}
function tableScore(rows, seconds) {
  if (seconds == null) return 0;
  for (const [lim, p] of rows.slice().sort((a, b) => Number(b[0]) - Number(a[0]))) if (seconds >= Number(lim)) return Number(p);
  return 0;
}
const indexMode500 = ex => ex?.exam500IndexMode === "three" ? "three" : "c1c2";
function efficiencySeconds500(ex, st) {
  const races = races500(st), sel = indexMode500(ex) === "three" ? races : races.slice(0, 2);
  if (sel.some(r => !r || !(Number(r.split250Ms) > 0) || !(Number(r.total500Ms) > Number(r.split250Ms)))) return null;
  const seg = sel.flatMap(r => [Number(r.split250Ms), Number(r.total500Ms) - Number(r.split250Ms)]);
  return Math.round((Math.max(...seg) - Math.min(...seg)) / 1000);
}
function score500(db, ex, st) {
  if (!complete500(st)) return null;
  const b = bareme500(db, ex), perf = performancePoints500(db, ex, st), em = estimationMetrics500(ex, st);
  const gap = em.errorMs == null ? null : em.errorMs / 1000, eff = efficiencySeconds500(ex, st);
  const gapPts = premiere500(ex) ? em.points : tableScore(b.gap, gap), effPts = tableScore(b.efficiency, eff);
  const afl2 = st.exam500Afl2 === "" || st.exam500Afl2 == null ? null : Number(st.exam500Afl2);
  const afl3 = st.exam500Afl3 === "" || st.exam500Afl3 == null ? null : Number(st.exam500Afl3);
  const warmup = extraScore(st, "exam500Warmup", 2), carnet = extraScore(st, "exam500Carnet", 2), observation = extraScore(st, "exam500Observation", 1);
  const totalPremiere = warmup == null || carnet == null || observation == null || gapPts == null ? null : Math.min(20, perf + effPts + gapPts + warmup + carnet + observation);
  const total20 = premiere500(ex) ? totalPremiere : afl2 == null || afl3 == null || gapPts == null ? null : Math.min(20, perf + effPts + gapPts + afl2 + afl3);
  return { perf, gap, gapPts, estimationDetails: em.details, eff, effPts, afl1: perf + effPts, afl2, afl3, warmup, carnet, observation, total20, totalRaceMs: races500(st).reduce((s, r) => s + Number(r.total500Ms), 0) };
}
const labels500 = ex => ({ afl2: String(ex?.exam500Afl2Label || "Carnet / échauffement").trim() || "Carnet / échauffement", afl3: String(ex?.exam500Afl3Label || "Partenaire / starter").trim() || "Partenaire / starter" });

/* ========== Entraînement (training-qr-ui.js) ========== */
function toolLabel(tool) { return tool === "simple" ? "Chrono simple" : tool === "timer" ? "Minuteur" : tool === "vma" ? "Test VMA" : tool === "chrono" ? "Chrono performance" : "Résultat"; }
const fmtTraining = ms => !Number.isFinite(Number(ms)) || Number(ms) <= 0 ? "—" : time(Number(ms));
function resultLabel(d) {
  if (d.status === "medical_stop" || d.statusLabel === "Inapte / arrêt médical") return "INAPTE / ARRÊT MÉDICAL";
  if (d.tool === "simple") return fmtTraining(d.totalMs);
  if (d.tool === "chrono") return Array.isArray(d.races) && d.races.length ? d.races.map(r => String(r.distance || "?") + " m · " + fmtTraining(r.totalMs)).join(" · ") : fmtTraining(d.totalMs);
  if (d.tool === "timer") { const x = Number(d.totalDistance); return Number.isFinite(x) ? Math.round(x) + " m" : "—"; }
  if (d.tool === "vma") { const v = Number(d.vma), x = Number(d.totalDistance); if (Number.isFinite(v) && v > 0) return v.toFixed(1) + " km/h"; if (Number.isFinite(x)) return Math.round(x) + " m"; }
  return "—";
}
function expandCompactChrono(d) {
  if (!d || d.type !== "DF_TRAINING_RESULT" || d.tool !== "chrono" || Number(d.v) < 3 || !Array.isArray(d.r)) return d;
  const races = d.r.map((r, i) => {
    const cumul = Array.isArray(r.c) ? r.c.map(Number) : [];
    return { race: i + 1, distance: Number(r.d) || 0, splitDistance: Number(r.s) || 0,
      passes: cumul.map((v, j) => { const lap = v - (j > 0 ? cumul[j - 1] : 0), split = Number(r.s) || Number(r.d) || 0; return { distance: Math.min(Number(r.d) || 0, (j + 1) * split), cumulativeMs: v, lapMs: lap, speed: lap > 0 && split > 0 ? split / (lap / 1000) * 3.6 : 0 }; }),
      totalMs: cumul.length ? cumul[cumul.length - 1] : null };
  });
  return { type: d.type, v: d.v, tool: d.tool, resultId: d.id, studentId: d.sid, last: d.l, first: d.f, classroom: d.c, sex: d.x, planMode: d.m, status: d.status || null, statusLabel: d.statusLabel || null, stoppedAt: d.stoppedAt || null, seriesLabel: races.map(r => r.distance + "m").join("-"), races, createdAt: new Date().toISOString() };
}
function normalizeTraining(d, groupId, sessionId) {
  return { id: d.resultId || d.studentId + "-" + Date.now(), studentId: String(d.studentId || ""), last: String(d.last || "").trim(), first: String(d.first || "").trim(),
    sex: String(d.sex || "").trim().toUpperCase(), classroom: String(d.classroom || "").trim().toUpperCase(), tool: d.tool || "unknown", planMode: d.planMode || null,
    seriesLabel: d.seriesLabel || null, races: Array.isArray(d.races) ? d.races : [], result: resultLabel(d), totalMs: Number(d.totalMs) || null, durationMs: Number(d.durationMs) || null,
    trackDistance: Number(d.trackDistance) || null, laps: Number(d.laps) || 0, partialDistance: Number(d.partialDistance) || 0, totalDistance: Number(d.totalDistance) || null,
    speed: Number(d.speed) || null, vma: d.vma == null ? null : Number(d.vma), createdAt: d.createdAt || new Date().toISOString(), status: d.status || null, statusLabel: d.statusLabel || null,
    stoppedAt: d.stoppedAt || null, groupId, sessionId };
}

/* ========== Contrôle des QR (qr-validation.js, exam500-ui.js) ========== */
function validateCCF(d) {
  const bad = m => ({ ok: false, message: m }), str = v => typeof v === "string" && v.trim().length > 0, pos = v => Number.isFinite(Number(v)) && Number(v) > 0;
  if (!d || typeof d !== "object" || Array.isArray(d)) return bad("format de données inconnu.");
  if (d.type !== "DF_CCF_RESULT") return bad("ce QR n'est pas un résultat DemiFond CCF.");
  if (Number(d.v) !== 1) return bad("version de QR incompatible.");
  if (!str(d.studentId)) return bad("identifiant élève absent.");
  if (!str(d.last) || !str(d.first)) return bad("nom ou prénom absent.");
  if (!str(d.classroom)) return bad("classe absente.");
  if (!["F", "M"].includes(String(d.sex).toUpperCase())) return bad("sexe F/M absent ou invalide.");
  if (!str(d.project)) return bad("projet de performance absent.");
  const race = Number(d.race); if (![1, 2].includes(race)) return bad("numéro de course invalide.");
  const medical = medicalRace(d);
  if (!medical && !pos(d.totalMs)) return bad("temps total invalide.");
  const totalMs = medical ? (pos(d.totalMs) ? Number(d.totalMs) : null) : Number(d.totalMs);
  if (!Array.isArray(d.splits)) return bad("temps intermédiaires absents.");
  const v = d.splits.map(Number);
  if (!medical && v.length !== 4) return bad("le QR doit contenir exactement 4 passages.");
  if (medical && v.length > 4) return bad("trop de passages dans le QR médical.");
  if (v.some(x => !Number.isFinite(x) || x <= 0)) return bad("un des temps intermédiaires est invalide.");
  for (let i = 1; i < v.length; i++) if (v[i] <= v[i - 1]) return bad("les temps intermédiaires ne sont pas croissants.");
  if (!medical && Math.abs(v[v.length - 1] - totalMs) > 2000) return bad("le temps total ne correspond pas au dernier passage.");
  return { ok: true, data: { ...d, race, totalMs, splits: v, sex: String(d.sex).toUpperCase(), classroom: String(d.classroom).trim().toUpperCase() } };
}
function validate500(d) {
  const bad = m => ({ ok: false, message: m });
  if (!d || typeof d !== "object" || d.type !== "DF_3X500_RESULT" || Number(d.v) !== 1) return bad("QR 3 × 500 invalide.");
  if (!d.studentId || !String(d.last || "").trim() || !String(d.first || "").trim() || !String(d.classroom || "").trim() || !["F", "M"].includes(String(d.sex || "").toUpperCase())) return bad("Identité élève incomplète dans le QR 3 × 500.");
  if (!Array.isArray(d.races) || d.races.length !== 3) return bad("Le QR doit contenir exactement les 3 courses de 500 m.");
  const ordered = [1, 2, 3].map(n => d.races.find(x => Number(x.race) === n));
  if (ordered.some(r => !r)) return bad("Les courses 1, 2 et 3 doivent toutes être présentes.");
  for (let i = 0; i < 3; i++) {
    const r = ordered[i], s = Number(r.split250Ms), t = Number(r.total500Ms);
    if (!Number.isFinite(s) || s <= 0 || !Number.isFinite(t) || t <= s) return bad("Temps 250 m / 500 m incohérents pour la course " + (i + 1) + ".");
    if (i < 2) { const p = parseTime500(r.project); if (!p || p < 20000 || p > 600000) return bad("Estimation obligatoire et invalide pour le 500 n°" + (i + 1) + "."); }
    else if (r.project != null && String(r.project).trim() !== "") { const p = parseTime500(r.project); if (!p || p < 20000 || p > 600000) return bad("Estimation C3 invalide."); }
  }
  return { ok: true, data: { ...d, sex: String(d.sex).toUpperCase(), classroom: String(d.classroom).trim().toUpperCase(), races: ordered } };
}
/* Type d'un QR : "ccf" | "exam500" | "training" | null */
function qrType(d) {
  if (d?.type === "DF_3X500_RESULT") return "exam500";
  if (d?.type === "DF_TRAINING_RESULT") return "training";
  if (d?.studentId && [1, 2].includes(Number(d.race))) return "ccf";
  return null;
}

window.DF = { KEY, uid, copy, num, dayOf, time, short, pts, parseTimeInput, studentName, sameStudent, emptyDB, normalizeDB, loadDB, idbAdd, idbList, lessons, TYPES, effectiveType, trainingRows,
  scoreCCF, noteCCF, projectMetrics, allocation, levelPoints, laps200, medicalRace, medicalCCF, parseProject,
  DEFAULT_BAREME, LEVEL_ANCHORS_500, perfRowsFromAnchors: makePerformanceRows500, performancePreset500, bareme500, premiere500, races500, complete500, score500, estimationCount500, labels500, parseTime500, indexMode500,
  toolLabel, resultLabel, expandCompactChrono, normalizeTraining, validateCCF, validate500, qrType };
})();
