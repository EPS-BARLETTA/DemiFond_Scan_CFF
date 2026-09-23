(() => {
  "use strict";

  function ensureStore() {
    if (!Array.isArray(db.trainingScans)) {
      db.trainingScans = [];
    }
    return db.trainingScans;
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
    if (data.tool === "simple" || data.tool === "chrono") {
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
      tool:
        data.tool || "unknown",
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
        data.createdAt || new Date().toISOString()
    };
  }

  function renderTrainingResults() {
    const resultsPage =
      document.getElementById("results");

    if (!resultsPage) return;

    let card =
      document.getElementById("trainingResultsCard");

    if (!card) {
      card =
        document.createElement("div");

      card.id =
        "trainingResultsCard";

      card.className =
        "card";

      card.style.marginTop =
        "18px";

      resultsPage.appendChild(card);
    }

    const rows =
      ensureStore()
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

    card.innerHTML = `
      <h2>Résultats hors CCF</h2>
      <p style="margin-top:-6px;color:#64748b">
        Chrono, minuteur et tests d'entraînement scannés indépendamment du CCF.
      </p>

      <div class="table" style="margin-top:14px">
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Prénom</th>
              <th>Sexe</th>
              <th>Type</th>
              <th>Résultat</th>
            </tr>
          </thead>
          <tbody>
            ${
              rows.length
                ? rows.map(
                    item => `
                      <tr>
                        <td><b>${esc(String(item.last || "").toUpperCase())}</b></td>
                        <td>${esc(item.first || "")}</td>
                        <td>${esc(item.sex || "")}</td>
                        <td>${esc(toolLabel(item.tool))}</td>
                        <td><b>${esc(item.result || "—")}</b></td>
                      </tr>
                    `
                  ).join("")
                : `
                  <tr>
                    <td colspan="5">Aucun résultat hors CCF scanné.</td>
                  </tr>
                `
            }
          </tbody>
        </table>
      </div>
    `;
  }

  function handleTraining(data) {
    if (!data || data.type !== "DF_TRAINING_RESULT") {
      return false;
    }

    if (!data.studentId || !data.last || !data.first) {
      scanError("QR entraînement incomplet.");
      return true;
    }

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
        esc(toolLabel(item.tool)) +
        " · " +
        esc(item.result);
    }

    toast?.("Résultat hors CCF enregistré");

    renderTrainingResults();

    return true;
  }

  function install() {
    if (
      typeof window.handleQR !== "function" ||
      window.handleQR.__trainingBridge
    ) {
      renderTrainingResults();
      return;
    }

    const original =
      window.handleQR;

    const wrapped =
      function(raw) {
        let data = raw;

        try {
          if (typeof raw === "string") {
            data = JSON.parse(raw);
          }
        } catch {}

        if (data?.type === "DF_TRAINING_RESULT") {
          handleTraining(data);
          return;
        }

        return original(raw);
      };

    wrapped.__trainingBridge = true;
    window.handleQR = wrapped;

    renderTrainingResults();

    const observer =
      new MutationObserver(() => {
        if (
          document
            .querySelector(
              'nav button[data-page="results"].active'
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