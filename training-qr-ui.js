(() => {
  "use strict";

  function ensureStore() {
    if (!Array.isArray(db.trainingScans)) {
      db.trainingScans = [];
    }
    return db.trainingScans;
  }

  function currentContext() {
    return {
      groupId:
        db.activeGroupId || null,
      sessionId:
        db.activeSessionId || null
    };
  }

  function currentRows() {
    const context =
      currentContext();

    return ensureStore()
      .filter(
        item =>
          item.groupId ===
            context.groupId &&
          item.sessionId ===
            context.sessionId
      );
  }

  function formatTime(ms) {
    if (!Number.isFinite(Number(ms)) || Number(ms) <= 0) {
      return "—";
    }
    return typeof time === "function"
      ? time(Number(ms))
      : Math.round(Number(ms) / 10) / 100 + " s";
  }

  function toolLabel(tool) {
    if (tool === "simple") return "Chrono simple";
    if (tool === "timer") return "Minuteur";
    if (tool === "vma") return "Test VMA";
    if (tool === "chrono") return "Chrono performance";
    return "Résultat";
  }

  function resultLabel(data) {
    if (data.tool === "simple") {
      return formatTime(data.totalMs);
    }

    if (data.tool === "chrono") {
      if (
        Array.isArray(data.races) &&
        data.races.length
      ) {
        return data.races
          .map(
            race =>
              String(
                race.distance || "?"
              ) +
              " m · " +
              formatTime(
                race.totalMs
              )
          )
          .join(" · ");
      }

      return formatTime(data.totalMs);
    }

    if (data.tool === "timer") {
      const distance = Number(data.totalDistance);
      return Number.isFinite(distance)
        ? Math.round(distance) + " m"
        : "—";
    }

    if (data.tool === "vma") {
      const vma = Number(data.vma);
      const distance = Number(data.totalDistance);

      if (Number.isFinite(vma) && vma > 0) {
        return vma.toFixed(1) + " km/h";
      }

      if (Number.isFinite(distance)) {
        return Math.round(distance) + " m";
      }
    }

    return "—";
  }

  function normalizeTraining(data) {
    return {
      id:
        data.resultId ||
        data.studentId + "-" + Date.now(),
      studentId:
        String(data.studentId || ""),
      last:
        String(data.last || "").trim(),
      first:
        String(data.first || "").trim(),
      sex:
        String(data.sex || "").trim().toUpperCase(),
      classroom:
        String(data.classroom || "").trim().toUpperCase(),
      tool:
        data.tool || "unknown",
      planMode:
        data.planMode || null,
      seriesLabel:
        data.seriesLabel || null,
      races:
        Array.isArray(data.races)
          ? data.races
          : [],
      result:
        resultLabel(data),
      totalMs:
        Number(data.totalMs) || null,
      durationMs:
        Number(data.durationMs) || null,
      trackDistance:
        Number(data.trackDistance) || null,
      laps:
        Number(data.laps) || 0,
      partialDistance:
        Number(data.partialDistance) || 0,
      totalDistance:
        Number(data.totalDistance) || null,
      speed:
        Number(data.speed) || null,
      vma:
        data.vma == null ? null : Number(data.vma),
      createdAt:
        data.createdAt || new Date().toISOString(),
      groupId:
        db.activeGroupId || null,
      sessionId:
        db.activeSessionId || null
    };
  }

  function renderTrainingResults() {
    const card =
      document.getElementById(
        "trainingResultsCard"
      );

    if (!card) return;

    const rows =
      currentRows()
        .slice()
        .sort(
          (a, b) =>
            String(a.last || "").localeCompare(
              String(b.last || ""),
              "fr",
              { sensitivity: "base" }
            ) ||
            String(a.first || "").localeCompare(
              String(b.first || ""),
              "fr",
              { sensitivity: "base" }
            )
        );

    const session =
      typeof activeSession === "function"
        ? activeSession()
        : null;

    const distances =
      rows[0]?.races?.map(
        race => Number(race.distance) || 0
      ) || [];

    const raceDetail =
      item =>
        (Array.isArray(item.races) ? item.races : [])
          .map(
            (race,index) => {
              const passes =
                Array.isArray(race.passes)
                  ? race.passes
                  : [];

              const splitLine =
                passes.length > 1
                  ? passes
                      .map(
                        pass =>
                          '<span>' +
                          esc(
                            String(pass.distance) +
                            ' m · ' +
                            formatTime(
                              pass.cumulativeMs
                            )
                          ) +
                          '</span>'
                      )
                      .join('')
                  : '<span>Aucun intermédiaire</span>';

              return (
                '<section class="training-detail-race">' +
                  '<h4>Course ' +
                    (index + 1) +
                    ' · ' +
                    esc(
                      String(race.distance || '?') +
                      ' m'
                    ) +
                  '</h4>' +
                  '<strong>' +
                    esc(
                      formatTime(
                        race.totalMs
                      )
                    ) +
                  '</strong>' +
                  '<div class="training-splits">' +
                    splitLine +
                  '</div>' +
                '</section>'
              );
            }
          )
          .join('');

    const summaryHead =
      distances
        .map(
          (distance,index) =>
            '<th>Course ' +
            (index + 1) +
            '<small>' +
            esc(String(distance) + ' m') +
            '</small></th>'
        )
        .join('');

    const summaryRows =
      rows
        .map(
          item => {
            const races =
              Array.isArray(item.races)
                ? item.races
                : [];

            return (
              '<tr>' +
                '<td class="training-name"><b>' +
                  esc(
                    String(
                      item.last || ''
                    ).toUpperCase()
                  ) +
                  ' ' +
                  esc(item.first || '') +
                '</b></td>' +
                '<td>' +
                  esc(item.classroom || '—') +
                '</td>' +
                '<td>' +
                  esc(item.sex || '—') +
                '</td>' +
                distances
                  .map(
                    (_,index) =>
                      '<td class="training-time">' +
                        esc(
                          formatTime(
                            races[index]
                              ?.totalMs
                          )
                        ) +
                      '</td>'
                  )
                  .join('') +
              '</tr>'
            );
          }
        )
        .join('');

    const details =
      rows
        .map(
          item =>
            '<details class="training-student-detail">' +
              '<summary>' +
                '<span>' +
                  '<b>' +
                    esc(
                      String(
                        item.last || ''
                      ).toUpperCase()
                    ) +
                    ' ' +
                    esc(item.first || '') +
                  '</b>' +
                  '<small>' +
                    esc(item.classroom || '—') +
                    ' · ' +
                    esc(item.sex || '—') +
                  '</small>' +
                '</span>' +
                '<span class="training-summary-badge">' +
                  esc(
                    item.seriesLabel ||
                    toolLabel(item.tool)
                  ) +
                '</span>' +
              '</summary>' +
              '<div class="training-detail-grid">' +
                raceDetail(item) +
              '</div>' +
            '</details>'
        )
        .join('');

    card.innerHTML =
      '<div class="training-results-head">' +
        '<div>' +
          '<p class="eyebrow">CHRONO PERFORMANCE</p>' +
          '<h2>' +
            esc(
              session?.label ||
              'Évaluation active'
            ) +
          '</h2>' +
          '<p class="training-subtitle">' +
            rows.length +
            ' élève' +
            (rows.length > 1 ? 's' : '') +
            ' · ' +
            esc(
              rows[0]?.seriesLabel ||
              'Séance'
            ) +
          '</p>' +
        '</div>' +
      '</div>' +
      (
        rows.length
          ? '<h3 class="training-section-title">Vue synthétique</h3>' +
            '<div class="training-table-wrap">' +
              '<table class="training-summary-table">' +
                '<thead><tr>' +
                  '<th>Élève</th>' +
                  '<th>Classe</th>' +
                  '<th>Sexe</th>' +
                  summaryHead +
                '</tr></thead>' +
                '<tbody>' +
                  summaryRows +
                '</tbody>' +
              '</table>' +
            '</div>' +
            '<h3 class="training-section-title">Détail par élève</h3>' +
            '<div class="training-details-list">' +
              details +
            '</div>'
          : '<div class="training-empty">Aucun résultat scanné pour cette évaluation.</div>'
      );

    if (
      !document.getElementById(
        "trainingResultsStyles"
      )
    ) {
      const style =
        document.createElement(
          "style"
        );

      style.id =
        "trainingResultsStyles";

      style.textContent = `
        #trainingResultsCard{
          padding:20px;
          background:linear-gradient(180deg,#f8fbff 0%,#f4f7fb 100%);
        }
        .training-results-head{
          padding:18px 20px;
          background:white;
          border:1px solid #dce5f2;
          border-radius:18px;
          box-shadow:0 8px 24px rgba(31,61,120,.06);
          margin-bottom:18px;
        }
        .training-results-head h2{
          margin:2px 0 4px;
          font-size:28px;
        }
        .training-results-head .eyebrow{
          margin:0;
          font-size:12px;
          font-weight:800;
          letter-spacing:.14em;
          color:#3157d5;
        }
        .training-subtitle{
          margin:0;
          color:#667085;
        }
        .training-section-title{
          margin:20px 0 10px;
          font-size:20px;
        }
        .training-table-wrap{
          overflow:auto;
          background:white;
          border:1px solid #dce5f2;
          border-radius:16px;
          box-shadow:0 8px 24px rgba(31,61,120,.05);
        }
        .training-summary-table{
          width:100%;
          border-collapse:collapse;
          min-width:760px;
        }
        .training-summary-table th,
        .training-summary-table td{
          padding:11px 12px;
          border-bottom:1px solid #e8edf4;
          text-align:center;
          white-space:nowrap;
        }
        .training-summary-table th{
          background:#f6f8fc;
          color:#475467;
          font-size:12px;
          text-transform:uppercase;
          letter-spacing:.04em;
        }
        .training-summary-table th small{
          display:block;
          margin-top:2px;
          font-size:11px;
          text-transform:none;
          letter-spacing:0;
          color:#3157d5;
        }
        .training-summary-table .training-name{
          text-align:left;
        }
        .training-summary-table .training-time{
          font-weight:800;
          font-size:15px;
          color:#101828;
        }
        .training-details-list{
          display:grid;
          gap:10px;
        }
        .training-student-detail{
          background:white;
          border:1px solid #dce5f2;
          border-radius:14px;
          overflow:hidden;
          box-shadow:0 5px 16px rgba(31,61,120,.04);
        }
        .training-student-detail summary{
          cursor:pointer;
          list-style:none;
          display:flex;
          justify-content:space-between;
          align-items:center;
          gap:12px;
          padding:14px 16px;
        }
        .training-student-detail summary::-webkit-details-marker{
          display:none;
        }
        .training-student-detail summary b{
          font-size:16px;
        }
        .training-student-detail summary small{
          display:block;
          margin-top:3px;
          color:#667085;
        }
        .training-summary-badge{
          padding:7px 10px;
          border-radius:999px;
          background:#eef3ff;
          color:#3157d5;
          font-size:12px;
          font-weight:800;
          white-space:nowrap;
        }
        .training-detail-grid{
          display:grid;
          grid-template-columns:repeat(auto-fit,minmax(180px,1fr));
          gap:10px;
          padding:0 16px 16px;
        }
        .training-detail-race{
          padding:12px;
          border-radius:12px;
          background:#f8fafc;
          border:1px solid #e4e9f2;
        }
        .training-detail-race h4{
          margin:0 0 6px;
          color:#475467;
        }
        .training-detail-race strong{
          display:block;
          font-size:22px;
          margin-bottom:8px;
        }
        .training-splits{
          display:grid;
          gap:3px;
          color:#667085;
          font-size:12px;
        }
        .training-empty{
          padding:24px;
          border:1px dashed #c9d3e3;
          border-radius:16px;
          background:white;
          color:#667085;
          text-align:center;
        }
        @media(max-width:700px){
          #trainingResultsCard{padding:12px}
          .training-results-head h2{font-size:23px}
          .training-detail-grid{grid-template-columns:1fr}
        }
      `;

      document.head.appendChild(
        style
      );
    }
  }

  function expandCompactChrono(data) {
    if (
      !data ||
      data.type !== "DF_TRAINING_RESULT" ||
      data.tool !== "chrono" ||
      Number(data.v) < 3 ||
      !Array.isArray(data.r)
    ) {
      return data;
    }

    const races =
      data.r.map(
        (race,index) => {
          const cumul =
            Array.isArray(race.c)
              ? race.c.map(Number)
              : [];

          return {
            race: index + 1,
            distance: Number(race.d) || 0,
            splitDistance: Number(race.s) || 0,
            passes:
              cumul.map(
                (value,i) => {
                  const previous =
                    i > 0
                      ? cumul[i - 1]
                      : 0;

                  const lap =
                    value - previous;

                  const split =
                    Number(race.s) ||
                    Number(race.d) ||
                    0;

                  return {
                    distance:
                      Math.min(
                        Number(race.d) || 0,
                        (i + 1) * split
                      ),
                    cumulativeMs:
                      value,
                    lapMs:
                      lap,
                    speed:
                      lap > 0 && split > 0
                        ? split / (lap / 1000) * 3.6
                        : 0
                  };
                }
              ),
            totalMs:
              cumul.length
                ? cumul[cumul.length - 1]
                : null
          };
        }
      );

    return {
      type: data.type,
      v: data.v,
      tool: data.tool,
      resultId: data.id,
      studentId: data.sid,
      last: data.l,
      first: data.f,
      classroom: data.c,
      sex: data.x,
      planMode: data.m,
      seriesLabel:
        races
          .map(
            race =>
              race.distance + "m"
          )
          .join("-"),
      races,
      createdAt:
        new Date().toISOString()
    };
  }

  function handleTraining(data) {
    data =
      expandCompactChrono(data);

    if (!data || data.type !== "DF_TRAINING_RESULT") {
      return false;
    }

    if (!data.studentId || !data.last || !data.first) {
      scanError("QR entraînement incomplet.");
      return true;
    }

    const session =
      typeof activeSession === "function"
        ? activeSession()
        : null;

    if (!session) {
      scanError(
        "Ouvre d’abord une évaluation pour enregistrer ce résultat."
      );
      return true;
    }

    if (
      session.type &&
      session.type !== "training"
    ) {
      scanError(
        "Cette évaluation contient déjà un protocole CCF. Crée une évaluation séparée pour la pyramide."
      );
      return true;
    }

    session.type =
      "training";

    const item =
      normalizeTraining(data);

    const store =
      ensureStore();

    const existing =
      store.findIndex(
        x => String(x.id) === String(item.id)
      );

    if (existing >= 0) {
      store[existing] = item;
    } else {
      store.push(item);
    }

    db.history.unshift({
      at: Date.now(),
      studentId: item.studentId,
      type: "training",
      tool: item.tool
    });

    save();
    beep();

    if (
      typeof render === "function"
    ) {
      render();
    }

    const message =
      document.getElementById("scanMessage");

    if (message) {
      message.className = "scan-ok";
      message.innerHTML =
        "✓ " +
        esc(item.last.toUpperCase()) +
        " " +
        esc(item.first) +
        "<br>" +
        esc(item.sex) +
        " · " +
        esc(
          item.planMode === "series"
            ? "Série / pyramide"
            : toolLabel(item.tool)
        ) +
        " · " +
        esc(item.result) +
        "<br><br>" +
        '<button type="button" id="openTrainingResults" class="btn primary">Voir les résultats</button>';

      const openResults =
        document.getElementById(
          "openTrainingResults"
        );

      if (openResults) {
        openResults.onclick =
          () => {
            renderTrainingResults();

            if (
              typeof showPage ===
                "function"
            ) {
              showPage(
                "training-results"
              );
            }
          };
      }
    }

    toast?.("Résultat Chrono enregistré dans l’évaluation active");

    renderTrainingResults();

    return true;
  }

  function install() {
    /*
     * Route directe pour les QR Chrono / Minuteur / VMA.
     * On intercepte le bouton "Valider" utilisé aussi par scanner-ios
     * AVANT toute logique CCF, afin qu'un QR d'entraînement ne puisse
     * jamais créer ou sélectionner une évaluation CCF.
     */
    const readButton =
      document.getElementById(
        "readText"
      );

    if (readButton) {
      readButton.onclick =
        () => {
          const raw =
            document
              .getElementById(
                "qrText"
              )
              ?.value
              ?.trim();

          if (!raw) {
            scanError(
              "Aucun QR à lire."
            );
            return;
          }

          let data = null;

          try {
            data =
              JSON.parse(raw);
          } catch {}

          if (
            data?.type ===
              "DF_TRAINING_RESULT"
          ) {
            handleTraining(
              data
            );
            return;
          }

          if (
            typeof window.handleQR ===
              "function"
          ) {
            window.handleQR(
              raw
            );
          }
        };
    }

    /*
     * Garde aussi le pont global pour les autres chemins d'entrée.
     */
    if (
      typeof window.handleQR ===
        "function" &&
      !window.handleQR
        .__trainingBridge
    ) {
      const original =
        window.handleQR;

      const wrapped =
        function(raw) {
          let data = raw;

          try {
            if (
              typeof raw ===
                "string"
            ) {
              data =
                JSON.parse(raw);
            }
          } catch {}

          if (
            data?.type ===
              "DF_TRAINING_RESULT"
          ) {
            handleTraining(
              data
            );
            return;
          }

          return original(
            raw
          );
        };

      wrapped
        .__trainingBridge =
          true;

      window.handleQR =
        wrapped;
    }

    window
      .handleTrainingResult =
        handleTraining;

    window
      .renderTrainingResults =
        renderTrainingResults;

    renderTrainingResults();

    const observer =
      new MutationObserver(() => {
        if (
          document
            .querySelector(
              'nav button[data-page="training-results"].active'
            )
        ) {
          renderTrainingResults();
        }
      });

    observer.observe(
      document.body,
      {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class"]
      }
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      install
    );
  } else {
    install();
  }
})();