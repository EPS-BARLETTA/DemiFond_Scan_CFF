(() => {
  "use strict";

  const FORMAT = "demifond-scan-ccf-evaluation";
  const VERSION = 1;

  const ALLOCATION_POINTS = {
    2: {1: 0.5, 2: 1, 3: 1.5, 4: 2},
    4: {1: 1, 2: 2, 3: 3, 4: 4},
    6: {1: 1.5, 2: 3, 3: 4.5, 4: 6}
  };

  function html(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function safeName(value) {
    return String(value || "archive")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 70) || "archive";
  }

  function fmtTime(ms) {
    if (ms == null || !Number.isFinite(Number(ms))) {
      return "—";
    }

    const value = Number(ms);
    const min = Math.floor(value / 60000);
    const sec = Math.floor((value % 60000) / 1000);
    const cs = Math.floor((value % 1000) / 10);

    return min + ":" +
      String(sec).padStart(2, "0") + "." +
      String(cs).padStart(2, "0");
  }

  function fmtPts(value) {
    if (value == null || !Number.isFinite(Number(value))) {
      return "—";
    }

    return String(
      Math.round(Number(value) * 100) / 100
    ).replace(".", ",");
  }

  function projectOf(student, race) {
    return String(
      race === 1
        ? (
            student.project1 ||
            student.races?.[1]?.project ||
            ""
          )
        : (
            student.project2 ||
            student.races?.[2]?.project ||
            ""
          )
    );
  }

  function allocation(student) {
    const allowed = ["2-6", "4-4", "6-2"];
    const key = allowed.includes(student.aflAllocation)
      ? student.aflAllocation
      : "4-4";

    const parts = key.split("-").map(Number);

    return {
      key: key,
      a2: parts[0],
      a3: parts[1]
    };
  }

  function levelPoints(max, level) {
    const n = Number(level);

    if (!ALLOCATION_POINTS[max] || !ALLOCATION_POINTS[max][n]) {
      return null;
    }

    return ALLOCATION_POINTS[max][n];
  }

  function statusLabel(status) {
    if (status === "locked") {
      return "Verrouillée";
    }

    if (status === "closed") {
      return "Terminée";
    }

    return "En cours";
  }

  function splitLine(race) {
    const splits = Array.isArray(race?.splits)
      ? race.splits.slice(0, 4)
      : [];

    if (!splits.length) {
      return "—";
    }

    return splits
      .map(function(value, index) {
        return ((index + 1) * 200) + " m : " + fmtTime(value);
      })
      .join(" · ");
  }

  function studentRow(student) {
    const sc = typeof score === "function"
      ? score(student)
      : null;

    const alloc = allocation(student);
    const p2 = levelPoints(alloc.a2, student.afl2Level);
    const p3 = levelPoints(alloc.a3, student.afl3Level);

    const final =
      sc && p2 != null && p3 != null
        ? Math.min(20, sc.total + p2 + p3)
        : null;

    return {
      s: student,
      sc: sc,
      a: alloc,
      p2: p2,
      p3: p3,
      final: final
    };
  }

  function sortedStudents(session) {
    return [...(session?.students || [])]
      .sort(function(a, b) {
        return String(a.last || "").localeCompare(
          String(b.last || ""),
          "fr",
          {sensitivity: "base"}
        ) ||
        String(a.first || "").localeCompare(
          String(b.first || ""),
          "fr",
          {sensitivity: "base"}
        );
      });
  }

  function buildPayload(group, session) {
    return {
      format: FORMAT,
      version: VERSION,
      exportedAt: new Date().toISOString(),
      group: {
        id: group.id,
        name: group.name,
        archived: false,
        students: JSON.parse(JSON.stringify(group.students || []))
      },
      session: JSON.parse(JSON.stringify(session))
    };
  }

  function fmtExam500Time(ms) {
    if (ms == null || !Number.isFinite(Number(ms))) {
      return "—";
    }

    const total = Math.round(Number(ms) / 1000);
    const min = Math.floor(total / 60);
    const sec = total % 60;

    return min + "min " +
      String(sec).padStart(2, "0") +
      "s";
  }

  function exam500Races(student) {
    const races =
      Array.isArray(student?.exam500?.races)
        ? student.exam500.races
        : [];

    return [1,2,3].map(function(number) {
      return races.find(function(race) {
        return Number(race.race) === number;
      }) || null;
    });
  }

  function exam500CriterionLabels(session) {
    return {
      afl2:
        String(
          session?.exam500Afl2Label ||
          "Carnet / échauffement"
        ),
      afl3:
        String(
          session?.exam500Afl3Label ||
          "Partenaire / starter"
        )
    };
  }

  function exam500IndexMode(session) {
    return session?.exam500IndexMode === "three"
      ? "three"
      : "c1c2";
  }

  function buildExam500Report(group, session, payload) {
    const students = sortedStudents(session);
    const labels = exam500CriterionLabels(session);
    const mode = exam500IndexMode(session);

    const modeLabel =
      mode === "three"
        ? "Indice sur les 3 courses"
        : "Indice C1–C2";

    const scores =
      students.map(function(student) {
        const sc =
          typeof window.score500 === "function"
            ? window.score500(student)
            : null;

        return {
          student: student,
          score: sc,
          races: exam500Races(student)
        };
      });

    const complete =
      scores.filter(function(item) {
        return !!item.score;
      }).length;

    const graded =
      scores.filter(function(item) {
        return item.score?.total20 != null;
      }).length;

    const classes = [...new Set(
      students
        .map(function(student) {
          return student.classroom;
        })
        .filter(Boolean)
    )].sort();

    const bodyRows =
      scores.map(function(item) {
        const s = item.student;
        const sc = item.score;
        const c1 = item.races[0] || {};
        const c2 = item.races[1] || {};
        const c3 = item.races[2] || {};

        return "<tr>" +
          "<td class=\"student\">" +
            html(String(s.last || "").toUpperCase()) + " " +
            html(s.first || "") +
          "</td>" +
          "<td>" + html(s.classroom || "") + "</td>" +
          "<td>" + html(s.sex || "") + "</td>" +
          "<td class=\"c1\">" + fmtExam500Time(c1.projectMs) + "</td>" +
          "<td class=\"c1\">" + fmtExam500Time(c1.total500Ms) + "</td>" +
          "<td class=\"c2\">" + fmtExam500Time(c2.projectMs) + "</td>" +
          "<td class=\"c2\">" + fmtExam500Time(c2.total500Ms) + "</td>" +
          "<td class=\"c3\">" + fmtExam500Time(c3.total500Ms) + "</td>" +
          "<td>" + (sc ? fmtExam500Time(sc.totalRaceMs) : "—") + "</td>" +
          "<td>" + (sc ? fmtPts(sc.perf) : "—") + "</td>" +
          "<td>" + (sc?.eff == null ? "—" : sc.eff + " s") + "</td>" +
          "<td>" + (sc ? fmtPts(sc.effPts) : "—") + "</td>" +
          "<td>" + (sc?.gap == null ? "—" : sc.gap + " s") + "</td>" +
          "<td>" + (sc ? fmtPts(sc.gapPts) : "—") + "</td>" +
          "<td>" + (sc?.afl2 == null ? "—" : fmtPts(sc.afl2)) + "</td>" +
          "<td>" + (sc?.afl3 == null ? "—" : fmtPts(sc.afl3)) + "</td>" +
          "<td class=\"final\">" +
            (sc?.total20 == null ? "—" : fmtPts(sc.total20) + "/20") +
          "</td>" +
        "</tr>";
      }).join("");

    const details =
      scores.map(function(item) {
        const s = item.student;
        const sc = item.score;
        const c1 = item.races[0] || {};
        const c2 = item.races[1] || {};
        const c3 = item.races[2] || {};

        return "<details>" +
          "<summary>" +
            "<span>" +
              html(String(s.last || "").toUpperCase()) + " " +
              html(s.first || "") +
            "</span>" +
            "<span class=\"summary-note\">" +
              (sc?.total20 == null
                ? (sc ? fmtPts(sc.perf + sc.effPts + sc.gapPts) + "/14" : "incomplet")
                : fmtPts(sc.total20) + "/20") +
            "</span>" +
          "</summary>" +
          "<div class=\"detail-grid three\">" +
            "<section class=\"course c1box\">" +
              "<h3>Course 1</h3>" +
              "<p><b>Annonce :</b> " + fmtExam500Time(c1.projectMs) + "</p>" +
              "<p><b>250 m :</b> " + fmtExam500Time(c1.split250Ms) + "</p>" +
              "<p><b>500 m :</b> " + fmtExam500Time(c1.total500Ms) + "</p>" +
            "</section>" +
            "<section class=\"course c2box\">" +
              "<h3>Course 2</h3>" +
              "<p><b>Annonce :</b> " + fmtExam500Time(c2.projectMs) + "</p>" +
              "<p><b>250 m :</b> " + fmtExam500Time(c2.split250Ms) + "</p>" +
              "<p><b>500 m :</b> " + fmtExam500Time(c2.total500Ms) + "</p>" +
            "</section>" +
            "<section class=\"course c3box\">" +
              "<h3>Course 3 libre</h3>" +
              "<p><b>250 m :</b> " + fmtExam500Time(c3.split250Ms) + "</p>" +
              "<p><b>500 m :</b> " + fmtExam500Time(c3.total500Ms) + "</p>" +
            "</section>" +
            "<section>" +
              "<h3>Évaluation</h3>" +
              "<p><b>Total 3 × 500 :</b> " + (sc ? fmtExam500Time(sc.totalRaceMs) : "—") + "</p>" +
              "<p><b>Performance :</b> " + (sc ? fmtPts(sc.perf) + "/6" : "—") + "</p>" +
              "<p><b>Indice :</b> " + (sc?.eff == null ? "—" : sc.eff + " s") + "</p>" +
              "<p><b>Indice efficacité :</b> " + (sc ? fmtPts(sc.effPts) + "/6" : "—") + "</p>" +
              "<p><b>Écart annonces :</b> " + (sc?.gap == null ? "—" : sc.gap + " s") + "</p>" +
              "<p><b>Note écart :</b> " + (sc ? fmtPts(sc.gapPts) + "/2" : "—") + "</p>" +
              "<p><b>" + html(labels.afl2) + " :</b> " + (sc?.afl2 == null ? "—" : fmtPts(sc.afl2) + "/2") + "</p>" +
              "<p><b>" + html(labels.afl3) + " :</b> " + (sc?.afl3 == null ? "—" : fmtPts(sc.afl3) + "/4") + "</p>" +
              "<p><b>Note :</b> " + (sc?.total20 == null ? "—" : fmtPts(sc.total20) + "/20") + "</p>" +
            "</section>" +
          "</div>" +
        "</details>";
      }).join("");

    const dataJson =
      JSON.stringify(payload)
        .replace(/</g, "\\u003c");

    const exportDate =
      new Date().toLocaleString("fr-FR");

    const style = [
      ":root{font-family:-apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif;color:#172033;background:#eef2f7}",
      "*{box-sizing:border-box}",
      "body{margin:0;padding:24px;background:#eef2f7}",
      "main{max-width:1500px;margin:auto}",
      ".hero{background:#172554;color:#fff;padding:24px;border-radius:20px;margin-bottom:16px}",
      ".hero h1{margin:0 0 8px;font-size:28px}",
      ".hero p{margin:4px 0;color:#dbeafe}",
      ".cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:16px 0}",
      ".card{background:#fff;border-radius:16px;padding:16px;border:1px solid #d8e0ea}",
      ".card b{display:block;font-size:26px;margin-top:5px}",
      ".table-wrap{overflow:auto;background:#fff;border-radius:16px;border:1px solid #d8e0ea}",
      "table{border-collapse:collapse;width:100%;min-width:1250px;font-size:13px}",
      "th,td{padding:9px;border-bottom:1px solid #e5e7eb;text-align:center;white-space:nowrap}",
      "th{background:#f8fafc;position:sticky;top:0}",
      "td.student{text-align:left;font-weight:700}",
      "td.final{font-weight:900;font-size:15px}",
      "td.c1{background:#fff8dc}td.c2{background:#eef9ef}td.c3{background:#eef6ff}",
      "h2{margin:26px 0 12px}",
      "details{background:#fff;border:1px solid #d8e0ea;border-radius:14px;margin:10px 0;overflow:hidden}",
      "summary{padding:14px 16px;font-weight:800;cursor:pointer;display:flex;justify-content:space-between;gap:16px}",
      ".summary-note{color:#334155}",
      ".detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding:0 16px 16px}",
      ".detail-grid.three{grid-template-columns:repeat(4,minmax(0,1fr))}",
      ".detail-grid section{background:#f8fafc;border-radius:12px;padding:12px}",
      ".c1box{background:#fff8dc!important}.c2box{background:#eef9ef!important}.c3box{background:#eef6ff!important}",
      ".detail-grid h3{margin:0 0 8px}",
      ".detail-grid p{margin:6px 0;line-height:1.45}",
      ".note{font-size:13px;color:#64748b;margin-top:16px}",
      "@media(max-width:900px){body{padding:12px}.cards{grid-template-columns:repeat(2,1fr)}.detail-grid,.detail-grid.three{grid-template-columns:1fr}.hero h1{font-size:23px}}"
    ].join("");

    return "<!doctype html>" +
      "<html lang=\"fr\">" +
      "<head>" +
        "<meta charset=\"utf-8\">" +
        "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">" +
        "<title>Archive 3x500 — " + html(group.name) + "</title>" +
        "<style>" + style + "</style>" +
      "</head>" +
      "<body><main>" +
        "<section class=\"hero\">" +
          "<h1>Demi-fond 3 × 500</h1>" +
          "<p><b>" + html(group.name) + "</b></p>" +
          "<p>" + html(session.label || "") + " · " + html(statusLabel(session.status)) + "</p>" +
          "<p>" + html(modeLabel) + "</p>" +
          "<p>Archive créée le " + html(exportDate) + "</p>" +
        "</section>" +
        "<section class=\"cards\">" +
          "<div class=\"card\">Élèves<b>" + students.length + "</b></div>" +
          "<div class=\"card\">3 × 500 complets<b>" + complete + "</b></div>" +
          "<div class=\"card\">Notes /20 complètes<b>" + graded + "</b></div>" +
          "<div class=\"card\">Classes<b>" + html(classes.join(" · ") || "—") + "</b></div>" +
        "</section>" +
        "<h2>Vue synthétique</h2>" +
        "<div class=\"table-wrap\"><table>" +
          "<thead><tr>" +
            "<th>Élève</th><th>Classe</th><th>Sexe</th>" +
            "<th>Ann. C1</th><th>C1</th><th>Ann. C2</th><th>C2</th><th>C3 libre</th>" +
            "<th>Total</th><th>Perf /6</th><th>Indice</th><th>Indice /6</th>" +
            "<th>Écart ann.</th><th>Écart /2</th>" +
            "<th>" + html(labels.afl2) + " /2</th>" +
            "<th>" + html(labels.afl3) + " /4</th>" +
            "<th>Note</th>" +
          "</tr></thead>" +
          "<tbody>" + bodyRows + "</tbody>" +
        "</table></div>" +
        "<h2>Détail par élève</h2>" +
        details +
        "<p class=\"note\">Ce fichier est à la fois une archive lisible et une sauvegarde réimportable dans DemiFond Scan CCF.</p>" +
        "<script id=\"demifond-archive-data\" type=\"application/json\">" +
          dataJson +
        "<\/script>" +
      "</main></body></html>";
  }

  function buildReport(group, session, payload) {
    if (session?.type === "exam500") {
      return buildExam500Report(group, session, payload);
    }

    const rows = sortedStudents(session).map(studentRow);

    const complete = rows.filter(function(row) {
      return !!row.sc;
    }).length;

    const graded = rows.filter(function(row) {
      return row.final != null;
    }).length;

    const classes = [...new Set(
      rows.map(function(row) {
        return row.s.classroom;
      }).filter(Boolean)
    )].sort();

    const bodyRows = rows.map(function(row) {
      const s = row.s;
      const sc = row.sc;

      return "<tr>" +
        "<td class=\"student\">" +
          html(String(s.last || "").toUpperCase()) + " " +
          html(s.first || "") +
        "</td>" +
        "<td>" + html(s.classroom || "") + "</td>" +
        "<td>" + fmtTime(s.races?.[1]?.totalMs) + "</td>" +
        "<td>" + fmtTime(s.races?.[2]?.totalMs) + "</td>" +
        "<td>" + (sc ? fmtTime(sc.best) : "—") + "</td>" +
        "<td>" + (sc ? fmtPts(sc.pp) : "—") + "</td>" +
        "<td>" + (sc ? fmtTime(sc.fastest200) : "—") + "</td>" +
        "<td>" + (sc ? fmtTime(sc.slowest200) : "—") + "</td>" +
        "<td>" + (sc ? fmtPts(sc.rp) : "—") + "</td>" +
        "<td class=\"strong\">" +
          (sc ? fmtPts(sc.total) + "/12" : "—") +
        "</td>" +
        "<td>" + html(row.a.key) + "</td>" +
        "<td>" +
          (row.p2 == null ? "—" : fmtPts(row.p2) + "/" + row.a.a2) +
        "</td>" +
        "<td>" +
          (row.p3 == null ? "—" : fmtPts(row.p3) + "/" + row.a.a3) +
        "</td>" +
        "<td class=\"final\">" +
          (row.final == null ? "—" : fmtPts(row.final) + "/20") +
        "</td>" +
      "</tr>";
    }).join("");

    const details = rows.map(function(row) {
      const s = row.s;
      const sc = row.sc;
      const r1 = s.races?.[1];
      const r2 = s.races?.[2];

      const shortResult =
        row.final != null
          ? fmtPts(row.final) + "/20"
          : (
              sc
                ? fmtPts(sc.total) + "/12"
                : "incomplet"
            );

      return "<details>" +
        "<summary>" +
          "<span>" +
            html(String(s.last || "").toUpperCase()) + " " +
            html(s.first || "") +
          "</span>" +
          "<span class=\"summary-note\">" + shortResult + "</span>" +
        "</summary>" +
        "<div class=\"detail-grid\">" +
          "<section>" +
            "<h3>Course 1</h3>" +
            "<p><b>Estimation :</b> " +
              html(projectOf(s, 1) || "—") +
            "</p>" +
            "<p><b>Réalisé :</b> " +
              fmtTime(r1?.totalMs) +
            "</p>" +
            "<p><b>Passages :</b> " +
              splitLine(r1) +
            "</p>" +
          "</section>" +
          "<section>" +
            "<h3>Course 2</h3>" +
            "<p><b>Estimation :</b> " +
              html(projectOf(s, 2) || "—") +
            "</p>" +
            "<p><b>Réalisé :</b> " +
              fmtTime(r2?.totalMs) +
            "</p>" +
            "<p><b>Passages :</b> " +
              splitLine(r2) +
            "</p>" +
          "</section>" +
          "<section>" +
            "<h3>Évaluation</h3>" +
            "<p><b>AFL1 :</b> " +
              (sc ? fmtPts(sc.total) + "/12" : "—") +
            "</p>" +
            "<p><b>Performance :</b> " +
              (sc ? fmtPts(sc.pp) + "/6" : "—") +
            "</p>" +
            "<p><b>200 m le plus rapide :</b> " +
              (sc ? fmtTime(sc.fastest200) : "—") +
            "</p>" +
            "<p><b>200 m le plus lent :</b> " +
              (sc ? fmtTime(sc.slowest200) : "—") +
            "</p>" +
            "<p><b>Écart 200 :</b> " +
              (sc ? fmtTime(sc.spread) : "—") +
            "</p>" +
            "<p><b>Efficacité :</b> " +
              (sc ? fmtPts(sc.rp) + "/6" : "—") +
            "</p>" +
          "</section>" +
          "<section>" +
            "<h3>AFL2 / AFL3</h3>" +
            "<p><b>Répartition :</b> " + html(row.a.key) + "</p>" +
            "<p><b>AFL2 :</b> " +
              (row.p2 == null ? "—" : fmtPts(row.p2) + "/" + row.a.a2) +
            "</p>" +
            "<p><b>AFL3 :</b> " +
              (row.p3 == null ? "—" : fmtPts(row.p3) + "/" + row.a.a3) +
            "</p>" +
            "<p><b>Note :</b> " +
              (row.final == null ? "—" : fmtPts(row.final) + "/20") +
            "</p>" +
          "</section>" +
        "</div>" +
      "</details>";
    }).join("");

    const dataJson = JSON.stringify(payload).replace(/</g, "\\u003c");
    const exportDate = new Date().toLocaleString("fr-FR");

    const style = [
      ":root{font-family:-apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif;color:#172033;background:#eef2f7}",
      "*{box-sizing:border-box}",
      "body{margin:0;padding:24px;background:#eef2f7}",
      "main{max-width:1400px;margin:auto}",
      ".hero{background:#172554;color:#fff;padding:24px;border-radius:20px;margin-bottom:16px}",
      ".hero h1{margin:0 0 8px;font-size:28px}",
      ".hero p{margin:4px 0;color:#dbeafe}",
      ".cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:16px 0}",
      ".card{background:#fff;border-radius:16px;padding:16px;border:1px solid #d8e0ea}",
      ".card b{display:block;font-size:26px;margin-top:5px}",
      ".table-wrap{overflow:auto;background:#fff;border-radius:16px;border:1px solid #d8e0ea}",
      "table{border-collapse:collapse;width:100%;min-width:1050px;font-size:14px}",
      "th,td{padding:10px;border-bottom:1px solid #e5e7eb;text-align:center;white-space:nowrap}",
      "th{background:#f8fafc;position:sticky;top:0}",
      "td.student{text-align:left;font-weight:700}",
      "td.strong{font-weight:800}",
      "td.final{font-weight:900;font-size:15px}",
      "h2{margin:26px 0 12px}",
      "details{background:#fff;border:1px solid #d8e0ea;border-radius:14px;margin:10px 0;overflow:hidden}",
      "summary{padding:14px 16px;font-weight:800;cursor:pointer;display:flex;justify-content:space-between;gap:16px}",
      ".summary-note{color:#334155}",
      ".detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding:0 16px 16px}",
      ".detail-grid section{background:#f8fafc;border-radius:12px;padding:12px}",
      ".detail-grid h3{margin:0 0 8px}",
      ".detail-grid p{margin:6px 0;line-height:1.45}",
      ".note{font-size:13px;color:#64748b;margin-top:16px}",
      "@media(max-width:800px){body{padding:12px}.cards{grid-template-columns:repeat(2,1fr)}.detail-grid{grid-template-columns:1fr}.hero h1{font-size:23px}}"
    ].join("");

    return "<!doctype html>" +
      "<html lang=\"fr\">" +
      "<head>" +
        "<meta charset=\"utf-8\">" +
        "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">" +
        "<title>Archive DemiFond — " + html(group.name) + "</title>" +
        "<style>" + style + "</style>" +
      "</head>" +
      "<body><main>" +
        "<section class=\"hero\">" +
          "<h1>DemiFond Scan CCF</h1>" +
          "<p><b>" + html(group.name) + "</b></p>" +
          "<p>" + html(session.label || "") + " · " +
            html(statusLabel(session.status)) +
          "</p>" +
          "<p>Archive créée le " + html(exportDate) + "</p>" +
        "</section>" +
        "<section class=\"cards\">" +
          "<div class=\"card\">Élèves<b>" + rows.length + "</b></div>" +
          "<div class=\"card\">2 × 800 complets<b>" + complete + "</b></div>" +
          "<div class=\"card\">Notes /20 complètes<b>" + graded + "</b></div>" +
          "<div class=\"card\">Classes<b>" +
            html(classes.join(" · ") || "—") +
          "</b></div>" +
        "</section>" +
        "<h2>Vue synthétique</h2>" +
        "<div class=\"table-wrap\">" +
          "<table>" +
            "<thead><tr>" +
              "<th>Élève</th>" +
              "<th>Classe</th>" +
              "<th>C1</th>" +
              "<th>C2</th>" +
              "<th>Meilleur</th>" +
              "<th>Perf /6</th>" +
              "<th>200 + rapide</th>" +
              "<th>200 + lent</th>" +
              "<th>Eff. /6</th>" +
              "<th>AFL1 /12</th>" +
              "<th>Répart.</th>" +
              "<th>AFL2</th>" +
              "<th>AFL3</th>" +
              "<th>Note</th>" +
            "</tr></thead>" +
            "<tbody>" + bodyRows + "</tbody>" +
          "</table>" +
        "</div>" +
        "<h2>Détail par élève</h2>" +
        details +
        "<p class=\"note\">" +
          "Ce fichier est à la fois une archive lisible et une sauvegarde réimportable dans DemiFond Scan CCF." +
        "</p>" +
        "<script id=\"demifond-archive-data\" type=\"application/json\">" +
          dataJson +
        "<\/script>" +
      "</main></body></html>";
  }

  async function saveFile(blob, filename) {
    try {
      if (
        typeof File === "function" &&
        typeof navigator.share === "function"
      ) {
        const file = new File(
          [blob],
          filename,
          {type: "text/html"}
        );

        const canShare =
          typeof navigator.canShare !== "function" ||
          navigator.canShare({files: [file]});

        if (canShare) {
          await navigator.share({
            files: [file],
            title: "Archive DemiFond Scan CCF"
          });

          return;
        }
      }
    } catch (error) {
      if (error?.name === "AbortError") {
        return;
      }

      console.warn(
        "Partage iPad indisponible, téléchargement classique.",
        error
      );
    }

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(function() {
      URL.revokeObjectURL(link.href);
    }, 1000);
  }

  async function exportArchive() {
    try {
      const group = typeof activeGroup === "function"
        ? activeGroup()
        : null;

      const session = typeof activeSession === "function"
        ? activeSession()
        : null;

      if (!group || !session) {
        alert("Ouvre d’abord une évaluation à archiver.");
        return;
      }

      const payload = buildPayload(group, session);
      const report = buildReport(group, session, payload);

      if (!report || !String(report).trim()) {
        throw new Error("Le document d’archive est vide.");
      }

      const filename =
        "DemiFond_" +
        safeName(group.name) +
        "_" +
        safeName(session.label || "evaluation") +
        ".html";

      const blob = new Blob(
        [report],
        {type: "text/html;charset=utf-8"}
      );

      await saveFile(blob, filename);

      if (typeof toast === "function") {
        toast("Archive prête à enregistrer dans Fichiers");
      }
    } catch (error) {
      console.error("Archive DemiFond", error);

      alert(
        "Impossible de créer l’archive.\n\n" +
        (error?.message || "Erreur inconnue")
      );
    }
  }

  function mergeStudents(target, source) {
    const list = Array.isArray(target)
      ? target
      : [];

    (source || []).forEach(function(student) {
      const index = list.findIndex(function(existing) {
        return (
          String(existing.id || "") === String(student.id || "") ||
          (
            student.externalId &&
            existing.externalId === student.externalId
          )
        );
      });

      if (index >= 0) {
        list[index] = JSON.parse(JSON.stringify(student));
      } else {
        list.push(JSON.parse(JSON.stringify(student)));
      }
    });

    return list;
  }

  function restoreEvaluationArchive(payload) {
    if (
      !payload ||
      payload.format !== FORMAT ||
      !payload.group ||
      !payload.session
    ) {
      throw new Error("Format d’archive inconnu");
    }

    const importedGroup = payload.group;
    const importedSession = payload.session;

    let group = (db.groups || []).find(function(item) {
      return String(item.id) === String(importedGroup.id);
    });

    if (!group) {
      group = {
        id: importedGroup.id,
        name: importedGroup.name || "Groupe importé",
        archived: false,
        students: [],
        sessions: []
      };

      db.groups.push(group);
    }

    group.name = importedGroup.name || group.name;
    group.archived = false;
    group.students = mergeStudents(
      group.students,
      importedGroup.students
    );
    group.students = mergeStudents(
      group.students,
      importedSession.students
    );

    group.sessions = Array.isArray(group.sessions)
      ? group.sessions
      : [];

    const existingIndex = group.sessions.findIndex(function(item) {
      return String(item.id) === String(importedSession.id);
    });

    if (existingIndex >= 0) {
      const replace = confirm(
        "Cette évaluation existe déjà sur cet appareil.\n\n" +
        "Remplacer sa version locale par l’archive ?"
      );

      if (!replace) {
        return false;
      }

      group.sessions[existingIndex] =
        JSON.parse(JSON.stringify(importedSession));
    } else {
      group.sessions.push(
        JSON.parse(JSON.stringify(importedSession))
      );
    }

    db.activeGroupId = group.id;
    db.activeSessionId = importedSession.id;

    save();
    render();

    if (typeof showPage === "function") {
      showPage("results");
    }

    if (typeof toast === "function") {
      toast("Archive restaurée");
    }

    return true;
  }

  function parseArchiveText(text) {
    const trimmed = String(text || "").trim();

    if (!trimmed) {
      throw new Error("Fichier vide");
    }

    if (
      trimmed.startsWith("<!doctype") ||
      trimmed.startsWith("<html")
    ) {
      const documentArchive =
        new DOMParser().parseFromString(
          trimmed,
          "text/html"
        );

      const data =
        documentArchive.getElementById(
          "demifond-archive-data"
        );

      if (!data) {
        throw new Error("Données d’archive absentes");
      }

      return JSON.parse(
        data.textContent || ""
      );
    }

    return JSON.parse(trimmed);
  }

  async function importFile(file) {
    try {
      const text = await file.text();
      const payload = parseArchiveText(text);

      if (payload?.format === FORMAT) {
        restoreEvaluationArchive(payload);
        return;
      }

      if (Array.isArray(payload?.groups)) {
        const replace = confirm(
          "Cette sauvegarde complète va remplacer les données locales actuelles.\n\nContinuer ?"
        );

        if (!replace) {
          return;
        }

        db = normalizeDB(payload);
        save();
        render();

        if (typeof toast === "function") {
          toast("Sauvegarde complète restaurée");
        }

        return;
      }

      throw new Error("Format non reconnu");
    } catch (error) {
      console.error(error);
      alert(
        "Archive invalide ou non reconnue."
      );
    }
  }

  function install() {
    const button =
      document.getElementById(
        "archiveFile"
      );

    if (button) {
      button.onclick =
        async function(event) {
          event?.preventDefault?.();
          event?.stopPropagation?.();
          await exportArchive();
        };
    }

    const restore =
      document.getElementById(
        "restore"
      );

    if (restore) {
      restore.accept =
        ".html,.json,text/html,application/json";

      restore.onchange =
        async function(event) {
          const file =
            event.target.files?.[0];

          if (file) {
            await importFile(file);
          }

          event.target.value = "";
        };
    }
  }

  window.DemiFondArchive = {
    exportCurrent: exportArchive,
    importFile: importFile
  };

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      install
    );
  } else {
    install();
  }

  /*
   * Sécurité iPad/Safari :
   * certains rechargements restaurent le DOM depuis le cache.
   * On rebinde une fois au chargement complet.
   */
  window.addEventListener(
    "load",
    install,
    {once:true}
  );
})();
