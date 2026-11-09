/* DemiFond Scan v2 — interface.
   Parcours : Classes → Classe (séances / élèves) → Séance → Exercice → Scanner.
   Données : celles de la version 1, relues et enregistrées dans le même format. */
(function () {
"use strict";
const D = window.DF, APP_VERSION = "2.0";
const $ = s => document.querySelector(s);
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const sid = v => esc(String(v));
let db = D.loadDB();
const ui = { classTab: "seances", filter: "", onlyMissing: false, scanTarget: null };

/* ---------- Enregistrement ---------- */
let lastBackup = 0;
function save(reason) {
  db.settings.lastChangeAt = Date.now();
  const raw = JSON.stringify(db);
  try { localStorage.setItem(D.KEY, raw); localStorage.setItem(D.KEY + "-last-save", String(Date.now())); }
  catch (e) { alert("Impossible d’enregistrer sur cet iPad (mémoire pleine ?). Fais tout de suite une sauvegarde HTML depuis « Sauvegardes »."); }
  if (reason || Date.now() - lastBackup > 60000) { lastBackup = Date.now(); D.idbAdd(raw, reason || "auto"); }
}
try { navigator.storage?.persist?.(); } catch (e) {}

/* ---------- Accès aux données ---------- */
const groupById = id => db.groups.find(g => String(g.id) === String(id));
const exById = (g, id) => g?.sessions.find(e => String(e.id) === String(id));
const lessonOf = (g, lid) => D.lessons(g).find(l => String(l.id) === String(lid));
const typeOf = (g, ex) => D.effectiveType(db, g, ex);
const locked = ex => ex?.status === "locked";
const fmtDate = iso => { try { return new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }); } catch (e) { return iso; } };
const TYPE_CLASS = { ccf: "t-ccf", exam500: "t-500", training: "t-train", "": "t-none" };
const typeLabel = t => D.TYPES[t] || "À définir au premier scan";
function exSummary(g, ex) {
  const t = typeOf(g, ex);
  if (t === "training") { const rows = D.trainingRows(db, g, ex); return rows.length + " résultat" + (rows.length > 1 ? "s" : ""); }
  const n = ex.students.length;
  if (!n) return "Aucun résultat";
  const notes = ex.students.map(s => t === "exam500" ? D.score500(db, ex, s)?.total20 : D.noteCCF(s).final).filter(x => x != null);
  return n + " élève" + (n > 1 ? "s" : "") + (notes.length ? " · " + notes.length + " noté" + (notes.length > 1 ? "s" : "") + " · moy. " + D.pts(notes.reduce((a, b) => a + b, 0) / notes.length) : "");
}
function rosterMissing(g, ex) {
  const t = typeOf(g, ex);
  const has = t === "training" ? D.trainingRows(db, g, ex).map(r => ({ id: r.studentId, externalId: r.studentId })) : ex.students;
  return g.students.filter(s => !has.some(h => D.sameStudent(h, s)));
}

/* ---------- Navigation ---------- */
const go = h => { if (location.hash === h) render(); else location.hash = h; };
window.addEventListener("hashchange", () => { render(); window.scrollTo(0, 0); });
function route() {
  const p = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (p[0] === "sauvegardes") return { page: "backups" };
  if (p[0] === "c" && p[1]) {
    const g = groupById(decodeURIComponent(p[1]));
    if (!g) return { page: "home" };
    if (p[2] === "l") return { page: "lesson", g, lid: decodeURIComponent(p[3] || "") };
    if (p[2] === "e") return { page: "exercise", g, ex: exById(g, decodeURIComponent(p[3] || "")) };
    if (p[2] === "s") return { page: "student", g, stId: decodeURIComponent(p[3] || "") };
    return { page: "class", g };
  }
  return { page: "home" };
}
const hClass = g => "#/c/" + encodeURIComponent(g.id);
const hLesson = (g, lid) => hClass(g) + "/l/" + encodeURIComponent(lid);
const hEx = (g, ex) => hClass(g) + "/e/" + encodeURIComponent(ex.id);
const hStudent = (g, s) => hClass(g) + "/s/" + encodeURIComponent(s.externalId || s.id);

/* ---------- Rendu ---------- */
function render() {
  const r = route();
  if (r.page === "exercise" && !r.ex) return go(hClass(r.g));
  let html = "";
  if (r.page === "home") html = pageHome();
  else if (r.page === "class") html = pageClass(r.g);
  else if (r.page === "lesson") html = pageLesson(r.g, r.lid);
  else if (r.page === "exercise") { db.activeGroupId = r.g.id; db.activeSessionId = r.ex.id; html = pageExercise(r.g, r.ex); }
  else if (r.page === "student") html = pageStudent(r.g, r.stId);
  else if (r.page === "backups") html = pageBackups();
  $("#app").innerHTML = html;
  $("#crumbs").innerHTML = crumbs(r);
  if (r.page === "backups") fillBackups();
}
function crumbs(r) {
  const parts = ['<a href="#/">Mes classes</a>'];
  if (r.g) parts.push('<a href="' + hClass(r.g) + '">' + esc(r.g.name) + "</a>");
  if (r.page === "exercise" && r.ex) parts.push('<a href="' + hLesson(r.g, r.ex.lessonId || r.ex.id) + '">' + esc(fmtDate(r.ex.lessonDate) + " · " + (r.ex.lessonLabel || "Séance")) + "</a>");
  if (r.page === "backups") parts.push("<span>Sauvegardes</span>");
  return parts.join('<span class="sep">›</span>');
}

/* ---------- Accueil ---------- */
function pageHome() {
  const act = db.activeGroupId && groupById(db.activeGroupId), aex = act && exById(act, db.activeSessionId);
  const live = db.groups.filter(g => !g.archived), arch = db.groups.filter(g => g.archived);
  const card = g => {
    const ls = D.lessons(g), last = ls[0];
    return '<a class="classcard c' + (g.uiColor % 8) + '" href="' + hClass(g) + '"><strong>' + esc(g.name) + "</strong><span>" + g.students.length + " élève" + (g.students.length > 1 ? "s" : "") + " · " + ls.length + " séance" + (ls.length > 1 ? "s" : "") + "</span><small>" + (last ? "Dernière : " + esc(fmtDate(last.date)) + " · " + esc(last.label) : "Aucune séance") + "</small></a>";
  };
  return '<section class="hero"><div><h1>Mes classes</h1><p>Choisis une classe, puis une séance : le scan va toujours dans l’exercice ouvert.</p></div><div class="row">' +
    btn("+ Nouvelle classe", "new-class", "primary") + '<a class="btn" href="#/sauvegardes">🛡️ Sauvegardes</a></div></section>' +
    (aex ? '<a class="resume" href="' + hEx(act, aex) + '"><span>Reprendre</span><strong>' + esc(act.name) + " · " + esc(fmtDate(aex.lessonDate)) + " · " + esc(aex.label) + "</strong><b>›</b></a>" : "") +
    backupWarning() +
    (live.length ? '<div class="grid">' + live.map(card).join("") + "</div>" : '<div class="empty">Aucune classe. Crée ta première classe, ou restaure une sauvegarde HTML depuis « Sauvegardes ».</div>') +
    (arch.length ? '<details class="archived"><summary>Classes archivées (' + arch.length + ")</summary><div class=\"grid\">" + arch.map(card).join("") + "</div></details>" : "");
}
function backupWarning() {
  const last = Number(db.settings.lastHtmlExportAt || 0), change = Number(db.settings.lastChangeAt || 0);
  if (!db.groups.length || (last && last >= change)) return "";
  return '<a class="warnbar" href="#/sauvegardes">⚠️ ' + (last ? "Des modifications n’ont pas encore été sauvegardées en HTML" : "Aucune sauvegarde HTML faite depuis cette version") + " — <u>sauvegarder maintenant</u></a>";
}
const btn = (label, act, cls, extra) => '<button type="button" class="btn ' + (cls || "") + '" data-act="' + esc(act) + '"' + (extra || "") + ">" + label + "</button>";

/* ---------- Classe ---------- */
function pageClass(g) {
  const tab = ui.classTab;
  let html = '<section class="pagehead"><div><h1>' + esc(g.name) + '</h1><p class="muted">' + g.students.length + " élèves · " + D.lessons(g).length + " séances" + (g.archived ? " · archivée" : "") + "</p></div><div class=\"row\">" +
    btn("+ Nouvelle séance", "new-lesson:" + g.id, "primary") +
    '<details class="menu"><summary class="btn">⋯</summary><div>' + btn("Renommer", "rename-class:" + g.id) + btn(g.archived ? "Désarchiver" : "Archiver", "archive-class:" + g.id) + btn("Sauvegarder cette classe (HTML)", "export-class:" + g.id) + btn("Supprimer la classe", "delete-class:" + g.id, "danger") + "</div></details></div></section>" +
    '<div class="tabs">' + ["seances", "eleves"].map(t => '<button type="button" data-act="class-tab:' + t + '" aria-pressed="' + (tab === t) + '">' + (t === "seances" ? "Séances" : "Élèves (" + g.students.length + ")") + "</button>").join("") + "</div>";
  if (tab === "eleves") {
    const rows = [...g.students].sort((a, b) => D.studentName(a).localeCompare(D.studentName(b), "fr"));
    html += rows.length ? '<div class="list">' + rows.map(s => {
      const n = g.sessions.filter(e => e.students.some(x => D.sameStudent(x, s))).length + db.trainingScans.filter(r => String(r.groupId) === String(g.id) && String(r.studentId) === String(s.externalId || s.id)).length;
      return '<a class="listrow" href="' + hStudent(g, s) + '"><strong>' + esc(D.studentName(s)) + '</strong><span class="muted">' + esc(s.classroom || "") + " · " + esc(s.sex === "M" ? "Garçon" : s.sex === "F" ? "Fille" : "?") + '</span><span class="pill">' + n + " résultat" + (n > 1 ? "s" : "") + "</span><b>›</b></a>";
    }).join("") + "</div>" : '<div class="empty">Les élèves s’ajoutent automatiquement au premier scan de leur QR.</div>';
    return html;
  }
  const ls = D.lessons(g);
  html += ls.length ? '<div class="list">' + ls.map(l => '<a class="lessonrow" href="' + hLesson(g, l.id) + '"><div class="ldate"><b>' + esc(fmtDate(l.date).split(" ").slice(1).join(" ")) + "</b><small>" + esc(fmtDate(l.date).split(" ")[0]) + '</small></div><div class="lbody"><strong>' + esc(l.label) + '</strong><div class="chips">' +
    l.exercises.map(ex => { const t = typeOf(g, ex); return '<span class="chip ' + TYPE_CLASS[t] + '">' + esc(ex.label || typeLabel(t)) + " · " + esc(exSummary(g, ex)) + (locked(ex) ? " 🔒" : "") + "</span>"; }).join("") + "</div></div><b>›</b></a>").join("") + "</div>"
    : '<div class="empty">Aucune séance. Crée une séance pour commencer à scanner.</div>';
  return html;
}

/* ---------- Séance ---------- */
function pageLesson(g, lid) {
  const l = lessonOf(g, lid);
  if (!l) return '<div class="empty">Séance introuvable.</div>';
  return '<section class="pagehead"><div><h1>' + esc(l.label) + '</h1><p class="muted">' + esc(g.name) + " · " + esc(fmtDate(l.date)) + '</p></div><div class="row">' + btn("+ Ajouter un exercice", "new-ex:" + g.id + ":" + l.id, "primary") +
    '<details class="menu"><summary class="btn">⋯</summary><div>' + btn("Renommer / changer la date", "edit-lesson:" + g.id + ":" + l.id) + btn("Sauvegarder cette séance (HTML)", "export-lesson:" + g.id + ":" + l.id) + btn("Supprimer la séance", "delete-lesson:" + g.id + ":" + l.id, "danger") + "</div></details></div></section>" +
    '<div class="excards">' + l.exercises.map(ex => {
      const t = typeOf(g, ex);
      return '<a class="excard ' + TYPE_CLASS[t] + '" href="' + hEx(g, ex) + '"><span class="extype">' + esc(typeLabel(t)) + "</span><strong>" + esc(ex.label || typeLabel(t)) + "</strong><span>" + esc(exSummary(g, ex)) + "</span><small>" + (locked(ex) ? "🔒 Verrouillé" : ex.status === "closed" ? "Terminé" : "En cours") + "</small></a>";
    }).join("") + "</div>";
}

/* ---------- Exercice ---------- */
function pageExercise(g, ex) {
  const t = typeOf(g, ex), lk = locked(ex);
  let html = '<section class="pagehead exhead ' + TYPE_CLASS[t] + '"><div><span class="extype">' + esc(typeLabel(t)) + "</span><h1>" + esc(ex.label || typeLabel(t)) + '</h1><p class="muted">' + esc(g.name) + " · " + esc(fmtDate(ex.lessonDate)) + " · " + esc(ex.lessonLabel || "") + '</p></div><div class="row">' +
    (lk ? '<span class="lockinfo">🔒 Verrouillé : ni scan ni correction</span>' : btn("📷 Scanner dans cet exercice", "scan:" + g.id + ":" + ex.id, "primary big")) +
    '<details class="menu"><summary class="btn">⋯</summary><div>' + btn("Renommer", "rename-ex:" + g.id + ":" + ex.id) +
    ["open", "closed", "locked"].map(s => btn((ex.status === s ? "✓ " : "") + ({ open: "En cours", closed: "Terminé", locked: "Verrouiller" })[s], "ex-status:" + g.id + ":" + ex.id + ":" + s)).join("") +
    (t !== "training" ? btn("Exporter les notes (CSV)", "ex-csv:" + g.id + ":" + ex.id) : "") + btn("Supprimer l’exercice", "delete-ex:" + g.id + ":" + ex.id, "danger") + "</div></details></div></section>";
  html += '<div class="toolbar"><input class="search" id="filter" placeholder="Rechercher un élève…" value="' + esc(ui.filter) + '" autocomplete="off"><label class="toggle"><input type="checkbox" id="onlyMissing"' + (ui.onlyMissing ? " checked" : "") + "> À compléter seulement</label></div>";
  if (t === "ccf" || t === "") html += tableCCF(g, ex);
  else if (t === "exam500") html += table500(g, ex);
  else html += tableTraining(g, ex);
  const miss = rosterMissing(g, ex);
  if (miss.length) html += '<details class="missing"><summary>' + miss.length + " élève" + (miss.length > 1 ? "s" : "") + " de la classe sans résultat dans cet exercice</summary><p>" + miss.map(s => esc(D.studentName(s))).join(" · ") + "</p></details>";
  return html;
}
const match = s => !ui.filter || D.studentName(s).toLowerCase().includes(ui.filter.toLowerCase());
const sortSt = list => [...list].sort((a, b) => D.studentName(a).localeCompare(D.studentName(b), "fr"));
const lvlSelect = (act, cur, max, disabled) => '<select data-change="' + esc(act) + '"' + (disabled ? " disabled" : "") + '><option value="">—</option>' + [1, 2, 3, 4].map(n => '<option value="' + n + '"' + (String(cur) === String(n) ? " selected" : "") + ">N" + n + " · " + D.pts(D.levelPoints(max, n)) + "</option>").join("") + "</select>";
function tableCCF(g, ex) {
  const lk = locked(ex);
  const rows = sortSt(ex.students).filter(match).map(st => ({ st, n: D.noteCCF(st) })).filter(x => !ui.onlyMissing || x.n.final == null);
  if (!ex.students.length) return '<div class="empty big">Aucun résultat. Touche « 📷 Scanner » et présente les QR de Chrono Carnet.</div>';
  const race = (st, k) => { const r = st.races?.[k]; if (!r) return '<td class="miss">—</td>'; const med = D.medicalRace(r); return '<td class="' + (med ? "med" : "") + '">' + (med ? "✚ arrêt" : esc(D.time(r.totalMs))) + (r.editedAt ? ' <i title="corrigé à la main">✎</i>' : "") + "</td>"; };
  return '<div class="tablewrap"><table class="res"><thead><tr><th>Élève</th><th>800 n°1</th><th>800 n°2</th><th>Perf.<small>/6</small></th><th>Régularité<small>écart · /6</small></th><th>Estimation<small>écart · niveau</small></th><th>Choix<small>AFL2-AFL3</small></th><th>AFL2</th><th>AFL3</th><th>Note<small>/20</small></th></tr></thead><tbody>' +
    rows.map(({ st, n }) => {
      const id = esc(st.id), a = n.a;
      return '<tr class="' + (n.final != null ? "done" : "") + '"><td><button type="button" class="namebtn" data-act="edit-ccf:' + sid(g.id) + ":" + sid(ex.id) + ":" + id + '">' + esc(D.studentName(st)) + (n.medical ? ' <span class="med">✚</span>' : "") + '<small>Corriger ›</small></button></td>' +
        race(st, 1) + race(st, 2) +
        "<td><b>" + (n.sc ? D.pts(n.sc.pp) : "—") + "</b>" + (n.sc ? "<small>" + D.short(n.sc.best) + "</small>" : "") + "</td>" +
        "<td><b>" + (n.sc ? D.pts(n.sc.rp) : "—") + "</b>" + (n.sc ? "<small>" + D.pts(n.sc.spread / 1000) + " s</small>" : "") + "</td>" +
        "<td>" + (n.pm ? D.pts(n.pm.sum / 1000) + " s<small>niveau " + n.pm.level + " proposé</small>" : "—") + "</td>" +
        '<td><select data-change="ccf-alloc:' + sid(ex.id) + ":" + id + '"' + (lk ? " disabled" : "") + ">" + ["2-6", "4-4", "6-2"].map(k => '<option value="' + k + '"' + (a.key === k ? " selected" : "") + ">" + k.replace("-", " - ") + "</option>").join("") + "</select>" + (a.auto ? "<small>par défaut</small>" : "") + "</td>" +
        "<td>" + lvlSelect("ccf-afl2:" + ex.id + ":" + st.id, st.afl2Level, a.a2, lk) + "</td><td>" + lvlSelect("ccf-afl3:" + ex.id + ":" + st.id, st.afl3Level, a.a3, lk) + "</td>" +
        '<td class="note">' + (n.final != null ? D.pts(n.final) : n.sc ? "<small>AFL1 " + D.pts(n.sc.total) + "</small>" : "—") + "</td></tr>";
    }).join("") + "</tbody></table></div>";
}
function table500(g, ex) {
  const lk = locked(ex), pr = D.premiere500(ex), lab = D.labels500(ex);
  if (!ex.students.length) return '<div class="empty big">Aucun résultat. Touche « 📷 Scanner » et présente les QR 3 × 500.</div>';
  const rows = sortSt(ex.students).filter(match).map(st => ({ st, sc: D.score500(db, ex, st) })).filter(x => !ui.onlyMissing || x.sc?.total20 == null);
  const opt = (f, max, st) => '<select data-change="s500:' + sid(ex.id) + ":" + sid(st.id) + ":" + f + '"' + (lk ? " disabled" : "") + '><option value="">—</option>' + Array.from({ length: Math.round(max * 4) + 1 }, (_, i) => i / 4).map(v => '<option value="' + v + '"' + (st[f] !== "" && st[f] != null && Number(st[f]) === v ? " selected" : "") + ">" + D.pts(v) + "</option>").join("") + "</select>";
  const extra = pr ? [["exam500Warmup", 2, "Échauffement"], ["exam500Carnet", 2, "Carnet"], ["exam500Observation", 1, "Observation"]] : [["exam500Afl2", 2, lab.afl2], ["exam500Afl3", 4, lab.afl3]];
  const race = (st, i) => { const r = D.races500(st)[i]; return r ? "<td>" + esc(D.short(r.total500Ms)) + "<small>" + (r.projectMs ? "est. " + esc(D.short(r.projectMs)) : "") + "</small></td>" : '<td class="miss">—</td>'; };
  return '<p class="muted small">Barème ' + (pr ? "Première" : "Seconde") + " · régularité sur " + (D.indexMode500(ex) === "three" ? "les 3 courses" : "C1 et C2") + " · " + D.estimationCount500(ex) + " estimations</p>" +
    '<div class="tablewrap"><table class="res"><thead><tr><th>Élève</th><th>500 n°1</th><th>500 n°2</th><th>500 n°3</th><th>Perf.<small>/6</small></th><th>Régularité<small>écart · pts</small></th><th>Estimation<small>écart · pts</small></th>' + extra.map(([, m, l]) => "<th>" + esc(l) + "<small>/" + m + "</small></th>").join("") + "<th>Note<small>/20</small></th></tr></thead><tbody>" +
    rows.map(({ st, sc }) => '<tr class="' + (sc?.total20 != null ? "done" : "") + '"><td><button type="button" class="namebtn" data-act="edit-500:' + sid(g.id) + ":" + sid(ex.id) + ":" + sid(st.id) + '">' + esc(D.studentName(st)) + "<small>Corriger ›</small></button></td>" + race(st, 0) + race(st, 1) + race(st, 2) +
      "<td><b>" + (sc ? D.pts(sc.perf) : "—") + "</b>" + (sc ? "<small>" + D.short(sc.totalRaceMs) + "</small>" : "") + "</td><td><b>" + (sc ? D.pts(sc.effPts) : "—") + "</b>" + (sc?.eff != null ? "<small>" + sc.eff + " s</small>" : "") + "</td><td><b>" + (sc ? D.pts(sc.gapPts) : "—") + "</b>" + (sc?.gap != null ? "<small>" + D.pts(sc.gap) + " s</small>" : "") + "</td>" +
      extra.map(([f, m]) => "<td>" + opt(f, m, st) + "</td>").join("") + '<td class="note">' + (sc?.total20 != null ? D.pts(sc.total20) : sc ? "<small>AFL1 " + D.pts(sc.afl1) + "</small>" : "—") + "</td></tr>").join("") + "</tbody></table></div>";
}
function tableTraining(g, ex) {
  const rows = D.trainingRows(db, g, ex).filter(r => match(r)).sort((a, b) => D.studentName(a).localeCompare(D.studentName(b), "fr") || String(a.createdAt).localeCompare(String(b.createdAt)));
  if (!D.trainingRows(db, g, ex).length) return '<div class="empty big">Aucun résultat. Touche « 📷 Scanner » et présente les QR d’entraînement (chrono, minuteur, VMA).</div>';
  return '<div class="tablewrap"><table class="res"><thead><tr><th>Élève</th><th>Outil</th><th>Résultat</th><th>Heure</th><th></th></tr></thead><tbody>' + rows.map(r => {
    const med = D.medicalRace(r);
    return "<tr><td><strong>" + esc(D.studentName(r)) + "</strong></td><td>" + esc(r.planMode === "series" ? "Série / pyramide" : D.toolLabel(r.tool)) + (r.seriesLabel ? "<small>" + esc(r.seriesLabel) + "</small>" : "") + '</td><td class="' + (med ? "med" : "") + '">' + esc(r.result) + "</td><td>" + esc(new Date(r.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })) + "</td><td>" + btn("Détail", "train-detail:" + g.id + ":" + ex.id + ":" + r.id, "small") + "</td></tr>";
  }).join("") + "</tbody></table></div>";
}

/* ---------- Suivi d'un élève ---------- */
function pageStudent(g, stId) {
  const s = g.students.find(x => String(x.externalId || x.id) === String(stId)) || g.students.find(x => String(x.id) === String(stId));
  if (!s) return '<div class="empty">Élève introuvable.</div>';
  const items = [];
  for (const ex of g.sessions) {
    const t = typeOf(g, ex), r = ex.students.find(x => D.sameStudent(x, s));
    if (t === "ccf" && r) { const n = D.noteCCF(r), best = Math.min(...[1, 2].map(k => Number(r.races?.[k]?.totalMs)).filter(Number.isFinite)); items.push({ date: ex.lessonDate, ex, t, main: Number.isFinite(best) ? "Meilleur 800 : " + D.time(best) : "—", note: n.final, val: Number.isFinite(best) ? best : null }); }
    if (t === "exam500" && r) { const sc = D.score500(db, ex, r); items.push({ date: ex.lessonDate, ex, t, main: sc ? "3 × 500 : " + D.short(sc.totalRaceMs) : "Incomplet", note: sc?.total20, val: sc?.totalRaceMs }); }
    if (t === "training") D.trainingRows(db, g, ex).filter(x => String(x.studentId) === String(s.externalId || s.id)).forEach(x => items.push({ date: ex.lessonDate, ex, t, main: (x.planMode === "series" ? "Série" : D.toolLabel(x.tool)) + " : " + x.result, note: null }));
  }
  items.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const spark = (list, label) => {
    const pts = list.filter(i => i.val != null);
    if (pts.length < 2) return "";
    const v = pts.map(i => i.val), mn = Math.min(...v), mx = Math.max(...v), W = 320, H = 70, x = i => 10 + i * (W - 20) / (pts.length - 1), y = val => mx === mn ? H / 2 : 10 + (val - mn) / (mx - mn) * (H - 20);
    return '<figure class="spark"><figcaption>' + esc(label) + " (plus bas = plus rapide)</figcaption><svg viewBox=\"0 0 " + W + " " + H + '"><polyline points="' + pts.map((p, i) => x(i) + "," + y(p.val)).join(" ") + '"/>' + pts.map((p, i) => '<circle cx="' + x(i) + '" cy="' + y(p.val) + '" r="4"><title>' + esc(fmtDate(p.date) + " · " + D.time(p.val)) + "</title></circle>").join("") + "</svg></figure>";
  };
  return '<section class="pagehead"><div><h1>' + esc(D.studentName(s)) + '</h1><p class="muted">' + esc(g.name) + " · " + esc(s.classroom || "") + " · " + (s.sex === "M" ? "Garçon" : s.sex === "F" ? "Fille" : "sexe non renseigné") + '</p></div><div class="row">' + btn("Modifier l’identité", "edit-student:" + g.id + ":" + (s.externalId || s.id)) + "</div></section>" +
    '<div class="sparks">' + spark(items.filter(i => i.t === "ccf"), "Meilleur 800 m") + spark(items.filter(i => i.t === "exam500"), "Total 3 × 500") + "</div>" +
    (items.length ? '<div class="list">' + items.map(i => '<a class="listrow" href="' + hEx(g, i.ex) + '"><span class="chip ' + TYPE_CLASS[i.t] + '">' + esc(fmtDate(i.date)) + "</span><strong>" + esc(i.main) + '</strong><span class="muted">' + esc(i.ex.label || "") + "</span>" + (i.note != null ? '<span class="pill note">' + D.pts(i.note) + " / 20</span>" : "") + "<b>›</b></a>").join("") + "</div>" : '<div class="empty">Aucun résultat pour cet élève.</div>');
}

/* ---------- Fenêtres ---------- */
let modalSave = null;
function modal(title, body, onSave, opts) {
  opts = opts || {};
  $("#modal").innerHTML = '<div class="sheet' + (opts.wide ? " wide" : "") + '" role="dialog" aria-modal="true" aria-labelledby="mtitle"><h2 id="mtitle">' + esc(title) + "</h2>" + body + '<div class="row end">' + (opts.extra || "") + btn(onSave ? "Annuler" : "Fermer", "close") + (onSave ? btn(opts.saveLabel || "Enregistrer", "modal-save", "primary") : "") + "</div></div>";
  $("#modal").hidden = false; modalSave = onSave;
  setTimeout(() => $("#modal input:not([type=checkbox]),#modal select")?.focus(), 30);
}
function close() { $("#modal").hidden = true; $("#modal").innerHTML = ""; modalSave = null; }
const val = id => ($("#" + id)?.value || "").trim();
const field = (label, id, value, attrs) => '<label class="field">' + esc(label) + '<input id="' + id + '" value="' + esc(value ?? "") + '" ' + (attrs || "") + "></label>";
function toast(msg, kind) { const t = $("#toast"); t.textContent = msg; t.className = "show " + (kind || ""); clearTimeout(toast.t); toast.t = setTimeout(() => (t.className = ""), 2600); }

/* ---------- Création ---------- */
function newExercise(g, type, lesson) {
  const ex = { id: D.uid(), createdAt: Date.now(), lessonId: lesson.id, lessonDate: lesson.date, lessonLabel: lesson.label, label: D.TYPES[type], type, status: "open", students: [] };
  if (type === "exam500") { ex.exam500Bareme = D.copy(D.bareme500(db, null)); ex.exam500EvaluationLevel = "seconde"; ex.exam500IndexMode = "c1c2"; ex.exam500EstimationCount = 2; }
  g.sessions.push(ex); return ex;
}
const typePicker = (name, cur) => '<div class="typepick">' + Object.entries(D.TYPES).map(([k, l]) => '<label class="' + TYPE_CLASS[k] + '"><input type="radio" name="' + name + '" value="' + k + '"' + (cur === k ? " checked" : "") + "><span>" + esc(l) + "</span></label>").join("") + "</div>";

/* ---------- Correction 2 × 800 ---------- */
function editCCF(g, ex, stId) {
  const st = ex.students.find(s => String(s.id) === String(stId)); if (!st) return;
  const raceBlock = k => {
    const r = st.races?.[k] || {}, sp = Array.isArray(r.splits) ? r.splits : [];
    return '<fieldset class="raceedit"><legend>800 m n°' + k + "</legend>" + field("Estimation annoncée", "p" + k, st["project" + k] || r.project || "", 'placeholder="3:10" inputmode="decimal"') +
      '<div class="passes">' + [0, 1, 2, 3].map(i => field(["200 m", "400 m", "600 m", "800 m (temps final)"][i], "s" + k + i, sp[i] != null ? D.time(sp[i]) : "", 'placeholder="' + ["0:45", "1:32", "2:20", "3:08"][i] + '" inputmode="decimal"')).join("") + "</div>" +
      '<label class="check"><input type="checkbox" id="m' + k + '"' + (D.medicalRace(r) ? " checked" : "") + "> Inapte / arrêt médical</label>" + (st.races?.[k] ? btn("Effacer ce 800", "clear-race:" + k, "small danger") : "") + "</fieldset>";
  };
  modal("Corriger · " + D.studentName(st), '<p class="muted small">Temps cumulés (passages) : 0:45, 1:32… ou 45, 132. Le temps final est le passage à 800 m.</p><div class="raceedits">' + raceBlock(1) + raceBlock(2) + "</div>", () => {
    for (const k of [1, 2]) {
      if (ui.clearRace?.[k]) { delete st.races[k]; st["project" + k] = ""; continue; }
      const sp = [0, 1, 2, 3].map(i => D.parseTimeInput(val("s" + k + i)));
      const med = $("#m" + k).checked, filled = sp.filter(x => x != null);
      const proj = val("p" + k);
      if (!filled.length && !med) { if (proj) st["project" + k] = proj; continue; }
      if (!med && (filled.length !== 4)) { alert("800 n°" + k + " : il faut les 4 passages (200, 400, 600, 800 m)."); return false; }
      for (let i = 1; i < filled.length; i++) if (filled[i] <= filled[i - 1]) { alert("800 n°" + k + " : les passages doivent être croissants."); return false; }
      const prev = st.races?.[k] || {};
      const same = st.races?.[k] && JSON.stringify((prev.splits || []).map(Number)) === JSON.stringify(filled) && !!D.medicalRace(prev) === med && (proj || "") === (st["project" + k] || prev.project || "");
      if (same) continue;
      st.races = st.races || {};
      st.races[k] = { ...prev, totalMs: med ? (sp[3] ?? null) : sp[3], splits: filled, project: proj || prev.project || "", scannedAt: prev.scannedAt || Date.now(), editedAt: Date.now(), status: med ? "medical_stop" : null, statusLabel: med ? "Inapte / arrêt médical" : null };
      st["project" + k] = proj;
    }
    ui.clearRace = null; save("correction"); close(); render(); toast("Correction enregistrée.");
  }, { wide: true, extra: btn("Retirer l’élève de l’exercice", "remove-st:" + g.id + ":" + ex.id + ":" + st.id, "danger") });
  ui.clearRace = {};
}
/* ---------- Correction 3 × 500 ---------- */
function edit500(g, ex, stId) {
  const st = ex.students.find(s => String(s.id) === String(stId)); if (!st) return;
  const rs = D.races500(st);
  modal("Corriger · " + D.studentName(st), '<p class="muted small">Temps : 1:52.4 ou 112.4 (secondes). Estimation obligatoire pour les 500 n°1 et n°2.</p><div class="raceedits three">' + [0, 1, 2].map(i => {
    const r = rs[i] || {};
    return '<fieldset class="raceedit"><legend>500 m n°' + (i + 1) + "</legend>" + field("Estimation", "e" + i, r.projectMs ? D.time(r.projectMs) : r.project || "", 'inputmode="decimal"') + field("Passage 250 m", "a" + i, r.split250Ms ? D.time(r.split250Ms) : "", 'inputmode="decimal"') + field("Temps 500 m", "b" + i, r.total500Ms ? D.time(r.total500Ms) : "", 'inputmode="decimal"') + "</fieldset>";
  }).join("") + "</div>", () => {
    const races = [];
    for (let i = 0; i < 3; i++) {
      const e = D.parseTimeInput(val("e" + i)), a = D.parseTimeInput(val("a" + i)), b = D.parseTimeInput(val("b" + i));
      if (a == null && b == null && e == null) continue;
      if (a == null || b == null || b <= a) { alert("500 n°" + (i + 1) + " : passage 250 m et temps 500 m obligatoires (500 m > 250 m)."); return false; }
      races.push({ race: i + 1, project: e != null ? D.time(e).replace(/\.\d+$/, "") : null, projectMs: e, split250Ms: a, total500Ms: b });
    }
    st.exam500 = { ...(st.exam500 || {}), races, editedAt: Date.now(), scannedAt: st.exam500?.scannedAt || Date.now() };
    save("correction"); close(); render(); toast("Correction enregistrée.");
  }, { wide: true, extra: btn("Retirer l’élève de l’exercice", "remove-st:" + g.id + ":" + ex.id + ":" + st.id, "danger") });
}
function trainingDetail(g, ex, rid) {
  const r = D.trainingRows(db, g, ex).find(x => String(x.id) === String(rid)); if (!r) return;
  const races = (r.races || []).map(rc => "<h3>" + esc((rc.distance || "?") + " m") + " · " + esc(D.time(rc.totalMs)) + "</h3>" + (Array.isArray(rc.passes) && rc.passes.length ? '<table class="res compact"><thead><tr><th>Distance</th><th>Cumulé</th><th>Tour</th><th>Vitesse</th></tr></thead><tbody>' + rc.passes.map(p => "<tr><td>" + esc(p.distance) + " m</td><td>" + esc(D.time(p.cumulativeMs)) + "</td><td>" + esc(D.time(p.lapMs)) + "</td><td>" + (p.speed ? esc(Number(p.speed).toFixed(1)) + " km/h" : "—") + "</td></tr>").join("") + "</tbody></table>" : "")).join("");
  modal(D.studentName(r) + " · " + (r.planMode === "series" ? "Série" : D.toolLabel(r.tool)), "<p><strong>" + esc(r.result) + "</strong></p>" + races + (r.vma ? "<p>VMA : " + esc(Number(r.vma).toFixed(1)) + " km/h</p>" : "") + (r.totalDistance ? "<p>Distance : " + esc(Math.round(r.totalDistance)) + " m</p>" : ""), null,
    { wide: true, extra: locked(ex) ? "" : btn("Supprimer ce résultat", "del-train:" + g.id + ":" + ex.id + ":" + r.id, "danger") });
}

/* ---------- Scan ---------- */
const SC = { stream: null, timer: null, lastRaw: "", lastAt: 0, busy: false, pending: null, undo: null, video: null, canvas: null };
function openScanner(g, ex) {
  ui.scanTarget = { gid: g.id, eid: ex.id };
  const t = typeOf(g, ex);
  $("#scanner").hidden = false;
  $("#scanner").innerHTML = '<div class="scanbar"><div><small>Le scan va dans</small><strong>' + esc(g.name) + " · " + esc(fmtDate(ex.lessonDate)) + " · " + esc(ex.label || typeLabel(t)) + '</strong></div><button type="button" class="btn" data-act="scan-close">Terminer</button></div>' +
    '<div class="scanview"><video id="scanvideo" playsinline muted></video><div class="scanframe"></div><p id="scanstate">Démarrage de la caméra…</p></div>' +
    '<div id="scanresult" class="scanresult" aria-live="polite"></div><div id="scanlog" class="scanlog"></div>' +
    '<details class="scanmanual"><summary>Pas de caméra ? Coller le texte du QR</summary><textarea id="qrText" rows="3"></textarea>' + btn("Valider", "scan-text", "primary") + "</details>";
  startCamera();
}
async function startCamera() {
  const st = $("#scanstate");
  try {
    SC.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } }, audio: false });
    SC.video = $("#scanvideo"); SC.video.srcObject = SC.stream; await SC.video.play();
    SC.canvas = SC.canvas || document.createElement("canvas");
    st.textContent = "Présente un QR dans le cadre";
    loop();
  } catch (e) { st.textContent = "Caméra indisponible (" + (e.name || "erreur") + "). Autorise la caméra dans Réglages › Safari, ou colle le texte du QR ci-dessous."; }
}
function loop() {
  clearTimeout(SC.timer);
  if ($("#scanner").hidden || !SC.video) return;
  if (!SC.busy && !SC.pending && SC.video.readyState >= 2 && window.jsQR) {
    const v = SC.video, w = Math.min(960, v.videoWidth), h = Math.round(v.videoHeight * w / v.videoWidth);
    if (w && h) {
      SC.canvas.width = w; SC.canvas.height = h;
      const ctx = SC.canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(v, 0, 0, w, h);
      const code = window.jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "dontInvert" });
      if (code?.data) onRaw(code.data);
    }
  }
  SC.timer = setTimeout(loop, 160);
}
function stopScanner() {
  clearTimeout(SC.timer);
  SC.stream?.getTracks().forEach(t => t.stop()); SC.stream = null; SC.video = null; SC.pending = null;
  $("#scanner").hidden = true; $("#scanner").innerHTML = ""; render();
}
function beep(ok) { try { const a = new (window.AudioContext || window.webkitAudioContext)(), o = a.createOscillator(), gn = a.createGain(); o.frequency.value = ok ? 880 : 220; gn.gain.value = 0.08; o.connect(gn); gn.connect(a.destination); o.start(); o.stop(a.currentTime + (ok ? 0.12 : 0.3)); if (navigator.vibrate) navigator.vibrate(ok ? 40 : [80, 60, 80]); } catch (e) {} }
function scanShow(kind, html, actions) {
  const box = $("#scanresult"); if (!box) return;
  box.className = "scanresult " + kind; box.innerHTML = html + (actions ? '<div class="row">' + actions + "</div>" : "");
  if (kind === "ok") { const log = $("#scanlog"); log.insertAdjacentHTML("afterbegin", "<p>" + html.replace(/<[^>]+>/g, " ") + "</p>"); }
}
function onRaw(raw) {
  const now = Date.now();
  if (raw === SC.lastRaw && now - SC.lastAt < 4000) return;
  SC.lastRaw = raw; SC.lastAt = now;
  handleRaw(raw);
}
function handleRaw(raw) {
  const tg = ui.scanTarget, g = groupById(tg?.gid), ex0 = exById(g, tg?.eid);
  if (!g || !ex0) return scanShow("err", "Exercice introuvable.");
  if (locked(ex0)) { beep(false); return scanShow("err", "🔒 Exercice verrouillé : scan refusé."); }
  let data; try { data = typeof raw === "string" ? JSON.parse(raw) : raw; } catch (e) { beep(false); return scanShow("err", "QR illisible ou format inconnu."); }
  if (data?.type === "DF_TRAINING_RESULT") data = D.expandCompactChrono(data);
  const qt = D.qrType(data);
  if (!qt) { beep(false); return scanShow("err", "Ce QR n’est pas un résultat DemiFond / Chrono Carnet."); }
  const before = JSON.stringify(db);
  /* Chaque protocole a son exercice : on va dans celui de la séance qui correspond au QR. */
  let ex = ex0, moved = false;
  const t0 = typeOf(g, ex0), has = ex0.students.length || D.trainingRows(db, g, ex0).length;
  if (t0 && t0 !== qt) {
    if (!has) ex0.type = qt;
    else {
      ex = g.sessions.find(e => (e.lessonId || e.id) === (ex0.lessonId || ex0.id) && typeOf(g, e) === qt && !locked(e));
      if (!ex) ex = newExercise(g, qt, { id: ex0.lessonId || ex0.id, date: ex0.lessonDate, label: ex0.lessonLabel });
      moved = true;
    }
  }
  let res;
  if (qt === "ccf") res = applyCCF(g, ex, data);
  else if (qt === "exam500") res = apply500(g, ex, data);
  else res = applyTraining(g, ex, data);
  if (!res) return;
  if (res.ask) { SC.pending = { raw, before, g, ex, data, qt, moved }; beep(false); return scanShow("warn", res.ask, btn("Remplacer", "scan-replace", "primary") + btn("Garder l’ancien", "scan-keep")); }
  finishScan(before, res.msg + (moved ? "<br><small>→ rangé dans l’exercice « " + esc(ex.label) + " » de la même séance</small>" : ""));
}
function finishScan(before, msg) {
  SC.undo = before; save(); beep(true);
  scanShow("ok", "✓ " + msg, btn("Annuler ce scan", "scan-undo", "small"));
}
function err(m) { beep(false); scanShow("err", "QR refusé : " + esc(m)); return null; }
function findSt(ex, id) { return ex.students.find(s => s.externalId === id || s.id === id); }
function buildSt(d) { return { id: d.studentId || D.uid(), externalId: d.studentId || "", last: d.last || "Élève", first: d.first || "", classroom: String(d.classroom || "").toUpperCase(), sex: d.sex || "", project1: "", project2: "", races: {}, afl2: "", afl3: "" }; }
function identity(st, d) { if (d.last) st.last = d.last; if (d.first) st.first = d.first; if (d.classroom) st.classroom = String(d.classroom).toUpperCase(); if (d.sex) st.sex = d.sex; }
function master(g, src) { let s = g.students.find(x => x.externalId === src.externalId || x.id === src.id); if (!s) { s = { ...D.copy(src), races: {} }; delete s.exam500; g.students.push(s); } identity(s, src); }
function applyCCF(g, ex, raw, force) {
  const ck = D.validateCCF(raw); if (!ck.ok) return err(ck.message);
  const d = ck.data; ex.type = "ccf";
  let st = findSt(ex, d.studentId);
  if (st?.races?.[d.race] && !force) {
    const p = st.races[d.race];
    if (d.resultId && p.resultId && String(d.resultId) === String(p.resultId)) { beep(false); scanShow("info", esc(D.studentName(st)) + " · QR déjà scanné."); return null; }
    return { ask: "<strong>" + esc(D.studentName(st)) + "</strong><br>Le 800 n°" + d.race + " est déjà enregistré (" + esc(D.time(p.totalMs)) + ").<br>Remplacer par " + esc(D.time(d.totalMs)) + " ?" };
  }
  if (!st) { st = buildSt(d); ex.students.push(st); }
  identity(st, d); st.races ||= {};
  st.races[d.race] = { totalMs: Number(d.totalMs) || 0, splits: d.splits.map(Number), project: d.project || "", resultId: d.resultId || "", scannedAt: Date.now(), status: d.status || null, statusLabel: d.statusLabel || null, stoppedAt: d.stoppedAt || null };
  if (d.project) st["project" + d.race] = d.project;
  master(g, st);
  db.history.unshift({ at: Date.now(), groupId: g.id, sessionId: ex.id, studentId: st.id, race: d.race });
  return { msg: "<strong>" + esc(D.studentName(st)) + "</strong> · 800 n°" + d.race + " · " + (D.medicalRace(d) ? "✚ arrêt médical" : esc(D.time(d.totalMs))) };
}
function apply500(g, ex, raw, force) {
  const ck = D.validate500(raw); if (!ck.ok) return err(ck.message);
  const d = ck.data, cfg = d.evaluationConfig;
  if (cfg && typeof cfg === "object") {
    const level = ["seconde", "premiere"].includes(cfg.level) ? cfg.level : null, index = ["three", "c1c2"].includes(cfg.regularityMode) ? cfg.regularityMode : null, count = Number(cfg.estimationCount);
    if (!level || !index || ![2, 3].includes(count)) return err("paramètres d’évaluation du QR incorrects.");
    if (ex.exam500QrConfig) { const o = ex.exam500QrConfig; if (o.level !== level || o.index !== index || o.count !== count) return err("QR incompatible avec les réglages de cet exercice (niveau, régularité ou estimations)."); }
    else {
      ex.exam500QrConfig = { level, index, count }; ex.exam500EvaluationLevel = level; ex.exam500IndexMode = index; ex.exam500EstimationCount = count;
      if (!ex.students.some(s => s?.exam500?.races?.length) && !ex.exam500BaremeCustomized) ex.exam500Bareme = D.performancePreset500(level, db.settings.exam500Bareme || D.DEFAULT_BAREME);
    }
  }
  ex.type = "exam500";
  let st = findSt(ex, d.studentId);
  if (st?.exam500?.races?.length && !force) {
    if (d.resultId && st.exam500.resultId && String(d.resultId) === String(st.exam500.resultId)) { beep(false); scanShow("info", esc(D.studentName(st)) + " · QR déjà scanné."); return null; }
    return { ask: "<strong>" + esc(D.studentName(st)) + "</strong><br>Un 3 × 500 est déjà enregistré. Remplacer par ce nouveau relevé ?" };
  }
  if (!st) { st = buildSt(d); ex.students.push(st); }
  identity(st, d);
  st.exam500 = { resultId: d.resultId || "", projects: Array.isArray(d.projects) ? d.projects : [], races: d.races.map(r => ({ race: Number(r.race), project: r.project || null, projectMs: r.project ? D.parseTime500(r.project) : null, split250Ms: Number(r.split250Ms || 0), total500Ms: Number(r.total500Ms || 0) })), supervised: d.supervised === true, validation: Array.isArray(d.validation) ? d.validation : [], observerAudit: d.observerAudit || null, scannedAt: Date.now() };
  master(g, st);
  db.history.unshift({ at: Date.now(), groupId: g.id, sessionId: ex.id, studentId: st.id, type: "exam500" });
  const sc = D.score500(db, ex, st);
  return { msg: "<strong>" + esc(D.studentName(st)) + "</strong> · 3 × 500 · " + esc(D.short(sc?.totalRaceMs)) };
}
function applyTraining(g, ex, d) {
  if (!d.studentId || !d.last || !d.first) return err("QR entraînement incomplet.");
  ex.type = "training";
  const item = D.normalizeTraining(d, g.id, ex.id);
  const i = db.trainingScans.findIndex(x => String(x.id) === String(item.id) && String(x.groupId) === String(item.groupId) && String(x.sessionId) === String(item.sessionId));
  if (i >= 0) db.trainingScans[i] = item; else db.trainingScans.push(item);
  master(g, { id: item.studentId, externalId: item.studentId, last: item.last, first: item.first, classroom: item.classroom, sex: item.sex });
  db.history.unshift({ at: Date.now(), studentId: item.studentId, type: "training", tool: item.tool });
  return { msg: "<strong>" + esc(D.studentName(item)) + "</strong> · " + esc(item.planMode === "series" ? "Série" : D.toolLabel(item.tool)) + " · " + esc(item.result) };
}

/* ---------- Sauvegardes HTML (format v1 « demifond-class-backup ») ---------- */
function makeSelection(scope, gid, lid) {
  const groups = D.copy(db.groups.filter(g => scope === "all" || String(g.id) === String(gid)));
  if (scope === "lesson") groups.forEach(g => (g.sessions = g.sessions.filter(e => String(e.lessonId || e.id) === String(lid))));
  const scans = D.copy(db.trainingScans.filter(r => groups.some(g => String(g.id) === String(r.groupId) && g.sessions.some(e => String(e.id) === String(r.sessionId)))));
  return { format: "demifond-class-backup", version: 2, scope, exportedAt: new Date().toISOString(), groups, trainingScans: scans, history: scope === "all" ? D.copy(db.history) : [], settings: D.copy(db.settings), activeGroupId: null, activeSessionId: null };
}
function reportHTML(p) {
  const rows = [];
  for (const g of p.groups) {
    rows.push("<section><h2>" + esc(g.name) + "</h2>");
    for (const l of D.lessons(g)) {
      rows.push("<h3>" + esc(fmtDate(l.date) + " · " + l.label) + "</h3>");
      for (const ex of l.exercises) {
        const t = D.effectiveType(p, g, ex);
        rows.push("<h4>" + esc(ex.label || typeLabel(t)) + "</h4><table><tr><th>Élève</th><th>Résultat</th><th>Note /20</th></tr>");
        if (t === "training") p.trainingScans.filter(r => String(r.sessionId) === String(ex.id)).forEach(r => rows.push("<tr><td>" + esc(D.studentName(r)) + "</td><td>" + esc(r.result) + "</td><td></td></tr>"));
        else sortSt(ex.students).forEach(s => {
          if (t === "exam500") { const sc = D.score500(p, ex, s); rows.push("<tr><td>" + esc(D.studentName(s)) + "</td><td>" + esc(sc ? "3 × 500 : " + D.short(sc.totalRaceMs) : "incomplet") + "</td><td>" + (sc?.total20 != null ? D.pts(sc.total20) : "") + "</td></tr>"); }
          else { const n = D.noteCCF(s); rows.push("<tr><td>" + esc(D.studentName(s)) + "</td><td>" + [1, 2].map(k => s.races?.[k] ? "800 n°" + k + " : " + (D.medicalRace(s.races[k]) ? "arrêt" : D.time(s.races[k].totalMs)) : "").filter(Boolean).join(" · ") + "</td><td>" + (n.final != null ? D.pts(n.final) : "") + "</td></tr>"); }
        });
        rows.push("</table>");
      }
    }
    rows.push("</section>");
  }
  const data = JSON.stringify(p).replace(/</g, "\\u003c");
  return '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DemiFond · Sauvegarde</title><style>body{font:15px system-ui;background:#f3f6fb;color:#162033;margin:0;padding:20px}main{max-width:1000px;margin:auto}section{background:#fff;border:1px solid #dbe3ee;border-radius:14px;padding:16px;margin:16px 0}table{width:100%;border-collapse:collapse;margin-bottom:12px}th,td{padding:7px;border-bottom:1px solid #e3e8f0;text-align:left}h4{color:#1d4ed8;margin:14px 0 6px}</style></head><body><main><h1>DemiFond Scan · sauvegarde</h1><p>Exportée le ' + esc(new Date(p.exportedAt).toLocaleString("fr-FR")) + " · " + p.groups.length + " classe(s). Pour restaurer : DemiFond Scan › Sauvegardes › Importer un fichier HTML.</p>" + rows.join("") + '</main><script id="demifond-archive-data" type="application/json">' + data + "</script></body></html>";
}
function download(name, text, type) {
  const blob = new Blob([text], { type }), a = document.createElement("a"), url = URL.createObjectURL(blob);
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
}
function exportHTML(scope, gid, lid) {
  const p = makeSelection(scope, gid, lid);
  const name = ("DemiFond_" + (scope === "all" ? "Toutes_les_classes" : p.groups[0]?.name || "Classe") + (scope === "lesson" ? "_" + (D.lessons(p.groups[0])[0]?.date || "") : "") + "_" + D.dayOf()).replace(/[^a-zA-Z0-9_-]/g, "_") + ".html";
  download(name, reportHTML(p), "text/html;charset=utf-8");
  if (scope === "all") { db.settings.lastHtmlExportAt = Date.now(); const raw = JSON.stringify(db); try { localStorage.setItem(D.KEY, raw); } catch (e) {} }
  toast("Sauvegarde HTML téléchargée.", "ok"); render();
}
async function importFile(file) {
  let payload;
  try {
    const text = await file.text();
    if (text.trim().startsWith("<")) payload = JSON.parse(new DOMParser().parseFromString(text, "text/html").getElementById("demifond-archive-data")?.textContent || "null");
    else payload = JSON.parse(text);
  } catch (e) { return alert("Import impossible : fichier illisible."); }
  if (payload?.format === "demifond-scan-ccf-evaluation") return alert("Ce fichier est l’archive d’une seule évaluation (ancien format). Importe-le depuis l’ancienne version, puis refais une sauvegarde de la classe.");
  const valid = payload?.format === "demifond-class-backup" && Array.isArray(payload.groups) && payload.groups.every(g => Array.isArray(g.sessions)) && ["all", "class", "lesson"].includes(payload.scope);
  const legacy = !valid && Array.isArray(payload?.groups);
  if (!valid && !legacy) return alert("Import impossible : format non reconnu.");
  const all = legacy || payload.scope === "all";
  const n = payload.groups.length, when = payload.exportedAt ? new Date(payload.exportedAt).toLocaleString("fr-FR") : "date inconnue";
  if (!confirm(all ? "Restaurer TOUTES les classes de ce fichier (" + n + " classe(s), " + when + ") ?\n\nLes données actuelles de l’iPad seront remplacées. Une copie de secours est faite automatiquement juste avant." : "Importer ce fichier (" + n + " classe(s), " + when + ") ?\n\nLes séances du fichier remplacent leurs versions sur l’iPad ; le reste est conservé. Une copie de secours est faite juste avant.")) return;
  await D.idbAdd(JSON.stringify(db), "avant import");
  if (all) db = D.normalizeDB(payload);
  else {
    for (const inc of payload.groups) {
      const g = groupById(inc.id);
      if (!g) { db.groups.push(D.copy(inc)); continue; }
      g.name = inc.name; g.classroom = inc.classroom || g.classroom;
      const roster = new Map(g.students.map(s => [String(s.externalId || s.id), s]));
      for (const s of inc.students || []) roster.set(String(s.externalId || s.id), D.copy(s));
      g.students = [...roster.values()];
      const ids = new Set(inc.sessions.map(e => String(e.lessonId || e.id)));
      const removed = g.sessions.filter(e => ids.has(String(e.lessonId || e.id))).map(e => String(e.id));
      g.sessions = g.sessions.filter(e => !ids.has(String(e.lessonId || e.id))).concat(D.copy(inc.sessions));
      db.trainingScans = db.trainingScans.filter(r => !(String(r.groupId) === String(g.id) && removed.includes(String(r.sessionId))));
    }
    for (const row of payload.trainingScans || []) { const i = db.trainingScans.findIndex(r => r.id === row.id && r.groupId === row.groupId && r.sessionId === row.sessionId); if (i >= 0) db.trainingScans[i] = D.copy(row); else db.trainingScans.push(D.copy(row)); }
    db.settings = { ...db.settings, ...payload.settings, htmlExports: { ...db.settings.htmlExports, ...payload.settings?.htmlExports } };
    db = D.normalizeDB(db);
  }
  db.settings.lastHtmlExportAt = Date.now();
  save("import"); go("#/"); render(); toast("Sauvegarde restaurée.", "ok");
}
function pageBackups() {
  const last = db.settings.lastHtmlExportAt ? new Date(db.settings.lastHtmlExportAt).toLocaleString("fr-FR") : null;
  const nEx = db.groups.reduce((s, g) => s + g.sessions.length, 0);
  return '<section class="pagehead"><div><h1>Sauvegardes</h1><p class="muted">' + db.groups.length + " classe(s) · " + nEx + " exercice(s) sur cet iPad" + '</p></div></section><div class="bkgrid"><div class="bkcard ok"><h2>💾 Sauvegarder</h2><p>Télécharge un fichier HTML avec toutes tes classes. Range-le dans Fichiers ou iCloud Drive.</p>' + btn("Sauvegarder toutes les classes", "export-all", "primary big") + '<p class="muted small">' + (last ? "Dernière sauvegarde HTML : " + esc(last) : "Pas encore de sauvegarde HTML depuis cette version.") + '</p></div><div class="bkcard"><h2>📥 Restaurer</h2><p>Choisis un fichier HTML de DemiFond Scan (toutes les classes, une classe ou une séance).</p><label class="btn big">Importer un fichier HTML<input type="file" id="importFile" accept=".html,text/html,.json" hidden></label><p class="muted small">Une copie de secours de l’iPad est faite automatiquement avant chaque import.</p></div></div>' +
    '<section class="card"><h2>Copies de secours sur cet iPad</h2><p class="muted small">Faites automatiquement pendant le travail (les plus récentes, plus une par jour). Elles ne remplacent pas le fichier HTML.</p><div id="localBackups">Chargement…</div><p id="storageInfo" class="muted small"></p></section>';
}
async function fillBackups() {
  const list = await D.idbList(), box = $("#localBackups"); if (!box) return;
  box.innerHTML = list.length ? '<div class="list">' + list.slice(0, 20).map(b => { let n = "?"; try { n = JSON.parse(b.raw).groups.length; } catch (e) {} return '<div class="listrow"><strong>' + esc(new Date(b.at).toLocaleString("fr-FR")) + '</strong><span class="muted">' + esc(b.reason) + " · " + n + " classe(s)</span>" + btn("Revenir à cette version", "restore-local:" + b.at, "small") + "</div>"; }).join("") + "</div>" : "<p>Aucune copie pour l’instant.</p>";
  try { const est = await navigator.storage?.estimate?.(); const persisted = await navigator.storage?.persisted?.(); if (est) $("#storageInfo").textContent = "Place utilisée : " + Math.round(est.usage / 1024) + " Ko" + (persisted ? " · stockage protégé de l’effacement automatique" : ""); } catch (e) {}
}

/* ---------- CSV des notes ---------- */
function exCSV(g, ex) {
  const t = typeOf(g, ex), cell = v => { const s = String(v ?? ""); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  let rows;
  if (t === "exam500") rows = [["Nom", "Prénom", "Classe", "Sexe", "Total 3x500", "Perf", "Régularité", "Estimation", "AFL2", "AFL3", "Note /20"], ...sortSt(ex.students).map(s => { const sc = D.score500(db, ex, s); return [s.last, s.first, s.classroom, s.sex, sc ? D.time(sc.totalRaceMs) : "", sc ? D.pts(sc.perf) : "", sc ? D.pts(sc.effPts) : "", sc ? D.pts(sc.gapPts) : "", sc?.afl2 ?? "", sc?.afl3 ?? "", sc?.total20 != null ? D.pts(sc.total20) : ""]; })];
  else rows = [["Nom", "Prénom", "Classe", "Sexe", "800 n°1", "800 n°2", "AFL1 /12", "Choix AFL2-AFL3", "AFL2", "AFL3", "Note /20"], ...sortSt(ex.students).map(s => { const n = D.noteCCF(s); return [s.last, s.first, s.classroom, s.sex, s.races?.[1] ? D.time(s.races[1].totalMs) : "", s.races?.[2] ? D.time(s.races[2].totalMs) : "", n.sc ? D.pts(n.sc.total) : "", n.a.key.replace("-", " - "), n.p2 != null ? D.pts(n.p2) : "", n.p3 != null ? D.pts(n.p3) : "", n.final != null ? D.pts(n.final) : ""]; })];
  download(("notes_" + g.name + "_" + (ex.lessonDate || "") + "_" + (ex.label || "")).replace(/[^a-zA-Z0-9_-]/g, "_") + ".csv", "﻿" + rows.map(r => r.map(cell).join(";")).join("\r\n"), "text/csv;charset=utf-8");
}

/* ---------- Actions ---------- */
const ACT = {
  close,
  "modal-save"() { if (modalSave && modalSave() !== false) {} },
  "new-class"() { modal("Nouvelle classe", field("Nom de la classe", "fname", "", 'placeholder="Ex. 2A, Term lundi…"'), () => { const n = val("fname"); if (!n) return false; const g = { id: D.uid(), name: n, archived: false, sessions: [], students: [], uiColor: db.groups.length % 8 }; db.groups.push(g); save(); close(); go(hClass(g)); }); },
  "class-tab"(t) { ui.classTab = t; render(); },
  "rename-class"(gid) { const g = groupById(gid); modal("Renommer la classe", field("Nom", "fname", g.name), () => { const n = val("fname"); if (!n) return false; g.name = n; save(); close(); render(); }); },
  "archive-class"(gid) { const g = groupById(gid); g.archived = !g.archived; save(); render(); toast(g.archived ? "Classe archivée." : "Classe désarchivée."); },
  "delete-class"(gid) { const g = groupById(gid); const n = prompt("Supprimer définitivement « " + g.name + " » et tous ses résultats ?\nTape le nom de la classe pour confirmer :"); if (n === null) return; if (n.trim() !== g.name) return alert("Nom différent : rien n’a été supprimé."); D.idbAdd(JSON.stringify(db), "avant suppression"); db.groups = db.groups.filter(x => x !== g); db.trainingScans = db.trainingScans.filter(r => String(r.groupId) !== String(gid)); save(); go("#/"); toast("Classe supprimée (copie de secours faite)."); },
  "export-class"(gid) { exportHTML("class", gid); },
  "export-lesson"(gid, lid) { exportHTML("lesson", gid, lid); },
  "export-all"() { exportHTML("all"); },
  "new-lesson"(gid) {
    const g = groupById(gid);
    modal("Nouvelle séance", field("Date", "fdate", D.dayOf(), 'type="date"') + field("Intitulé", "flabel", "Séance", 'placeholder="Ex. Séance 3, CCF…"') + '<p class="fieldlabel">Premier exercice</p>' + typePicker("ftype", "ccf"), () => {
      const date = val("fdate") || D.dayOf(), label = val("flabel") || "Séance", type = document.querySelector('input[name="ftype"]:checked')?.value || "ccf";
      const ex = newExercise(g, type, { id: D.uid(), date, label }); save(); close(); go(hEx(g, ex));
    });
  },
  "new-ex"(gid, lid) { const g = groupById(gid), l = lessonOf(g, lid); modal("Ajouter un exercice", typePicker("ftype", "training"), () => { const type = document.querySelector('input[name="ftype"]:checked')?.value; if (!type) return false; const ex = newExercise(g, type, l); save(); close(); go(hEx(g, ex)); }); },
  "edit-lesson"(gid, lid) { const g = groupById(gid), l = lessonOf(g, lid); modal("Modifier la séance", field("Date", "fdate", l.date, 'type="date"') + field("Intitulé", "flabel", l.label), () => { l.exercises.forEach(e => { e.lessonDate = val("fdate") || l.date; e.lessonLabel = val("flabel") || l.label; }); save(); close(); render(); }); },
  "delete-lesson"(gid, lid) { const g = groupById(gid), l = lessonOf(g, lid); if (!confirm("Supprimer la séance « " + l.label + " » (" + fmtDate(l.date) + ") et ses " + l.exercises.length + " exercice(s) ?")) return; D.idbAdd(JSON.stringify(db), "avant suppression"); const ids = l.exercises.map(e => String(e.id)); g.sessions = g.sessions.filter(e => !ids.includes(String(e.id))); db.trainingScans = db.trainingScans.filter(r => !(String(r.groupId) === String(gid) && ids.includes(String(r.sessionId)))); save(); go(hClass(g)); toast("Séance supprimée (copie de secours faite)."); },
  "rename-ex"(gid, eid) { const g = groupById(gid), ex = exById(g, eid); modal("Renommer l’exercice", field("Nom", "fname", ex.label), () => { ex.label = val("fname") || ex.label; save(); close(); render(); }); },
  "ex-status"(gid, eid, s) { const ex = exById(groupById(gid), eid); ex.status = s; save(); render(); toast(s === "locked" ? "Exercice verrouillé." : s === "closed" ? "Exercice terminé." : "Exercice rouvert."); },
  "delete-ex"(gid, eid) { const g = groupById(gid), ex = exById(g, eid); if (locked(ex)) return alert("Exercice verrouillé : déverrouille-le d’abord."); if (!confirm("Supprimer l’exercice « " + ex.label + " » et ses résultats ?")) return; D.idbAdd(JSON.stringify(db), "avant suppression"); g.sessions = g.sessions.filter(e => e !== ex); db.trainingScans = db.trainingScans.filter(r => !(String(r.groupId) === String(gid) && String(r.sessionId) === String(eid))); save(); go(hLesson(g, ex.lessonId || ex.id)); },
  "ex-csv"(gid, eid) { const g = groupById(gid); exCSV(g, exById(g, eid)); },
  "edit-ccf"(gid, eid, stId) { const g = groupById(gid), ex = exById(g, eid); if (locked(ex)) return toast("Exercice verrouillé.", "err"); editCCF(g, ex, stId); },
  "edit-500"(gid, eid, stId) { const g = groupById(gid), ex = exById(g, eid); if (locked(ex)) return toast("Exercice verrouillé.", "err"); edit500(g, ex, stId); },
  "clear-race"(k, el) { ui.clearRace = ui.clearRace || {}; ui.clearRace[k] = true; el.closest("fieldset").classList.add("cleared"); el.textContent = "Sera effacé à l’enregistrement"; el.disabled = true; },
  "remove-st"(gid, eid, stId) { const g = groupById(gid), ex = exById(g, eid), st = ex.students.find(s => String(s.id) === String(stId)); if (!confirm("Retirer " + D.studentName(st) + " de cet exercice (tous ses résultats ici) ?")) return; const before = JSON.stringify(db); ex.students = ex.students.filter(s => s !== st); save("correction"); close(); render(); undoToast(before, D.studentName(st) + " retiré de l’exercice."); },
  "train-detail"(gid, eid, rid) { const g = groupById(gid); trainingDetail(g, exById(g, eid), rid); },
  "del-train"(gid, eid, rid) { if (!confirm("Supprimer ce résultat d’entraînement ?")) return; const before = JSON.stringify(db); db.trainingScans = db.trainingScans.filter(r => !(String(r.id) === String(rid) && String(r.groupId) === String(gid) && String(r.sessionId) === String(eid))); save("correction"); close(); render(); undoToast(before, "Résultat supprimé."); },
  "edit-student"(gid, key) {
    const g = groupById(gid), s = g.students.find(x => String(x.externalId || x.id) === String(key));
    modal("Identité de l’élève", field("Nom", "flast", s.last) + field("Prénom", "ffirst", s.first) + field("Classe", "fclass", s.classroom) + '<label class="field">Sexe (barème)<select id="fsex"><option value="F"' + (s.sex === "F" ? " selected" : "") + '>Fille</option><option value="M"' + (s.sex === "M" ? " selected" : "") + ">Garçon</option></select></label><p class=\"muted small\">Appliqué à l’élève dans tous les exercices de la classe.</p>", () => {
      const upd = { last: val("flast"), first: val("ffirst"), classroom: val("fclass").toUpperCase(), sex: val("fsex") };
      [s, ...g.sessions.flatMap(e => e.students.filter(x => D.sameStudent(x, s)))].forEach(x => Object.assign(x, upd));
      db.trainingScans.filter(r => String(r.groupId) === String(g.id) && String(r.studentId) === String(s.externalId || s.id)).forEach(r => Object.assign(r, upd));
      save("correction"); close(); render(); toast("Identité mise à jour.");
    });
  },
  scan(gid, eid) { const g = groupById(gid); openScanner(g, exById(g, eid)); },
  "scan-close": stopScanner,
  "scan-text"() { const t = $("#qrText").value.trim(); if (t) { SC.lastRaw = ""; handleRaw(t); $("#qrText").value = ""; } },
  "scan-undo"() { if (!SC.undo) return; db = D.normalizeDB(JSON.parse(SC.undo)); SC.undo = null; save("annulation"); scanShow("info", "Scan annulé."); SC.lastRaw = ""; },
  "scan-replace"() { const p = SC.pending; SC.pending = null; if (!p) return; const res = p.qt === "ccf" ? applyCCF(p.g, p.ex, p.data, true) : apply500(p.g, p.ex, p.data, true); if (res?.msg) finishScan(p.before, res.msg + " <small>(remplacé)</small>"); },
  "scan-keep"() { SC.pending = null; scanShow("info", "Ancien relevé conservé."); },
  "restore-local"(at) { D.idbList().then(list => { const b = list.find(x => String(x.at) === String(at)); if (!b || !confirm("Revenir à la version du " + new Date(b.at).toLocaleString("fr-FR") + " ?\nLa version actuelle est d’abord mise de côté dans les copies de secours.")) return; D.idbAdd(JSON.stringify(db), "avant retour arrière").then(() => { db = D.normalizeDB(JSON.parse(b.raw)); save(); go("#/"); toast("Version restaurée.", "ok"); }); }); },
  "undo"() { if (!ui.undo) return; db = D.normalizeDB(JSON.parse(ui.undo)); ui.undo = null; save("annulation"); render(); toast("Annulé."); }
};
function undoToast(before, msg) { ui.undo = before; const t = $("#toast"); t.innerHTML = esc(msg) + ' <button type="button" data-act="undo">Annuler</button>'; t.className = "show"; clearTimeout(toast.t); toast.t = setTimeout(() => { t.className = ""; ui.undo = null; }, 7000); }
document.addEventListener("click", e => {
  const el = e.target.closest("[data-act]"); if (!el) return;
  const [name, ...args] = el.dataset.act.split(":");
  const fn = ACT[name]; if (!fn) return;
  e.preventDefault(); el.closest("details.menu")?.removeAttribute("open");
  fn(...args, el);
});
document.addEventListener("change", e => {
  const el = e.target;
  if (el.id === "importFile" && el.files?.[0]) { importFile(el.files[0]); el.value = ""; return; }
  if (el.id === "onlyMissing") { ui.onlyMissing = el.checked; render(); return; }
  const c = el.dataset.change; if (!c) return;
  const [kind, eid, stId, f] = c.split(":"), r = route(), g = r.g, ex = exById(g, eid), st = ex?.students.find(s => String(s.id) === String(stId));
  if (!st || locked(ex)) return;
  if (kind === "ccf-alloc") st.aflAllocation = el.value;
  if (kind === "ccf-afl2") st.afl2Level = el.value;
  if (kind === "ccf-afl3") st.afl3Level = el.value;
  if (kind === "s500") st[f] = el.value;
  save(); render();
});
document.addEventListener("input", e => { if (e.target.id === "filter") { ui.filter = e.target.value; const pos = e.target.selectionStart; render(); const f = $("#filter"); f.focus(); f.setSelectionRange(pos, pos); } });
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("#modal").hidden) close(); if (e.key === "Enter" && !$("#modal").hidden && e.target.tagName === "INPUT" && modalSave) { e.preventDefault(); modalSave(); } });
document.addEventListener("visibilitychange", () => { if (document.hidden && SC.stream) stopScanner(); });

$("#version").textContent = "v" + APP_VERSION;
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw-v2.js").catch(() => {});
render();
})();
