(() => {
  "use strict";

  const $ = selector => document.querySelector(selector);

  function contextRows() {
    const groupId = db.activeGroupId || null;
    const sessionId = db.activeSessionId || null;

    if (!Array.isArray(db.trainingScans)) {
      db.trainingScans = [];
    }

    return db.trainingScans.filter(
      item =>
        String(item.groupId || "") === String(groupId || "") &&
        String(item.sessionId || "") === String(sessionId || "")
    );
  }

  function findItem(id) {
    return contextRows().find(
      item => String(item.id) === String(id)
    ) || null;
  }

  function parseTime(value) {
    const raw = String(value || "").trim().replace(",", ".");
    if (!raw) return null;

    if (/^\d+(?:\.\d+)?$/.test(raw)) {
      const sec = Number(raw);
      return Number.isFinite(sec) && sec > 0
        ? Math.round(sec * 1000)
        : null;
    }

    const parts = raw.split(":");
    if (parts.length !== 2) return null;

    const min = Number(parts[0]);
    const sec = Number(parts[1]);

    if (
      !Number.isFinite(min) ||
      !Number.isFinite(sec) ||
      min < 0 ||
      sec < 0 ||
      sec >= 60
    ) {
      return null;
    }

    return Math.round((min * 60 + sec) * 1000);
  }

  function inputTime(ms) {
    const value = Number(ms);
    if (!Number.isFinite(value) || value <= 0) return "";

    const total = value / 1000;
    const min = Math.floor(total / 60);
    const sec = total - min * 60;

    return min + ":" + sec.toFixed(2).padStart(5, "0");
  }

  function deleteItem(id) {
    const item = findItem(id);
    if (!item) return;

    const label =
      ((item.last || "") + " " + (item.first || "")).trim() ||
      "cet élève";

    if (!confirm(
      "Supprimer " + label + " de cette évaluation ?\n\n" +
      "Le résultat scanné sera supprimé."
    )) return;

    db.trainingScans = db.trainingScans.filter(
      row =>
        !(
          String(row.id) === String(item.id) &&
          String(row.groupId || "") === String(item.groupId || "") &&
          String(row.sessionId || "") === String(item.sessionId || "")
        )
    );

    if (Array.isArray(db.history)) {
      db.history = db.history.filter(
        row =>
          !(
            row.type === "training" &&
            String(row.studentId || "") === String(item.studentId || "")
          )
      );
    }

    save();
    window.renderTrainingResults?.();
    toast?.("Résultat supprimé");
  }

  function openEditor(id) {
    const item = findItem(id);
    if (!item) {
      toast?.("Résultat introuvable.");
      return;
    }

    let dialog = document.getElementById("trainingEditDialog");

    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.id = "trainingEditDialog";
      document.body.appendChild(dialog);
    }

    const races = Array.isArray(item.races) ? item.races : [];

    const raceFields = races.map((race, index) =>
      '<label>Course ' + (index + 1) + ' · ' +
        esc(String(race.distance || "?")) + ' m' +
        '<input data-race-index="' + index + '" value="' +
          esc(inputTime(race.totalMs)) + '" placeholder="1:45.30">' +
      '</label>'
    ).join("");

    const extraField =
      races.length
        ? '<div class="training-edit-grid training-edit-times">' +
            raceFields +
          '</div>'
        : (
            item.tool === "timer" || item.tool === "vma"
              ? '<div class="training-edit-grid">' +
                  '<label>Distance totale (m)' +
                    '<input id="trainingEditDistance" type="number" min="0" step="1" value="' +
                      esc(item.totalDistance ?? "") + '">' +
                  '</label>' +
                  (
                    item.tool === "vma"
                      ? '<label>VMA (km/h)' +
                          '<input id="trainingEditVma" type="number" min="0" step="0.1" value="' +
                            esc(item.vma ?? "") + '">' +
                        '</label>'
                      : ''
                  ) +
                '</div>'
              : '<label>Temps' +
                  '<input id="trainingEditTotal" value="' +
                    esc(inputTime(item.totalMs)) + '" placeholder="3:20.00">' +
                '</label>'
          );

    dialog.innerHTML =
      '<form method="dialog" class="training-edit-dialog">' +
        '<div class="training-edit-head">' +
          '<div><p class="eyebrow">CORRIGER LE RÉSULTAT</p>' +
          '<h2>' +
            esc(String(item.last || "").toUpperCase() + " " + String(item.first || "")) +
          '</h2></div>' +
          '<button type="button" id="trainingEditClose">✕</button>' +
        '</div>' +
        '<div class="training-edit-grid">' +
          '<label>Nom<input id="trainingEditLast" value="' + esc(item.last || "") + '"></label>' +
          '<label>Prénom<input id="trainingEditFirst" value="' + esc(item.first || "") + '"></label>' +
          '<label>Classe<input id="trainingEditClass" value="' + esc(item.classroom || "") + '"></label>' +
          '<label>Sexe<select id="trainingEditSex">' +
            '<option value="F" ' + (item.sex === "F" ? "selected" : "") + '>Fille</option>' +
            '<option value="M" ' + (item.sex === "M" ? "selected" : "") + '>Garçon</option>' +
          '</select></label>' +
        '</div>' +
        extraField +
        '<div class="training-edit-actions">' +
          '<button type="button" id="trainingEditDelete" class="danger">Supprimer</button>' +
          '<span></span>' +
          '<button type="button" id="trainingEditCancel">Annuler</button>' +
          '<button type="button" id="trainingEditSave" class="primary-action">Enregistrer</button>' +
        '</div>' +
      '</form>';

    const close = () => dialog.close();

    $("#trainingEditClose").onclick = close;
    $("#trainingEditCancel").onclick = close;
    $("#trainingEditDelete").onclick = () => {
      close();
      deleteItem(item.id);
    };

    $("#trainingEditSave").onclick = () => {
      const last = $("#trainingEditLast").value.trim();
      const first = $("#trainingEditFirst").value.trim();
      const classroom = $("#trainingEditClass").value.trim().toUpperCase();

      if (!last || !first || !classroom) {
        alert("Nom, prénom et classe sont obligatoires.");
        return;
      }

      if (races.length) {
        const corrected = races.map((race, index) => ({
          race,
          index,
          value: parseTime(
            dialog.querySelector('[data-race-index="' + index + '"]')?.value
          )
        }));

        const invalid = corrected.find(row => !row.value);
        if (invalid) {
          alert("Temps invalide pour la course " + (invalid.index + 1) + ".");
          return;
        }

        corrected.forEach(row => {
          row.race.totalMs = row.value;

          if (Array.isArray(row.race.passes) && row.race.passes.length) {
            const lastPass = row.race.passes[row.race.passes.length - 1];
            const previous =
              row.race.passes.length > 1
                ? Number(row.race.passes[row.race.passes.length - 2].cumulativeMs) || 0
                : 0;

            lastPass.cumulativeMs = row.value;
            lastPass.lapMs = Math.max(0, row.value - previous);
          }
        });
      } else if (item.tool === "timer" || item.tool === "vma") {
        const distance = Number($("#trainingEditDistance")?.value);

        if (!Number.isFinite(distance) || distance < 0) {
          alert("Distance invalide.");
          return;
        }

        item.totalDistance = distance;

        if (item.tool === "vma") {
          const vma = Number($("#trainingEditVma")?.value);

          if (!Number.isFinite(vma) || vma < 0) {
            alert("VMA invalide.");
            return;
          }

          item.vma = vma;
        }
      } else {
        const totalMs = parseTime($("#trainingEditTotal")?.value);

        if (!totalMs) {
          alert("Temps invalide.");
          return;
        }

        item.totalMs = totalMs;
      }

      item.last = last;
      item.first = first;
      item.classroom = classroom;
      item.sex = $("#trainingEditSex").value;

      if (item.tool === "chrono" && races.length) {
        item.result = races
          .map(race =>
            String(race.distance || "?") +
            " m · " +
            (typeof time === "function" ? time(race.totalMs) : "")
          )
          .join(" · ");
      } else if (item.tool === "simple") {
        item.result =
          typeof time === "function"
            ? time(item.totalMs)
            : item.result;
      } else if (item.tool === "timer") {
        item.result = Math.round(item.totalDistance || 0) + " m";
      } else if (item.tool === "vma") {
        item.result =
          Number.isFinite(Number(item.vma))
            ? Number(item.vma).toFixed(1) + " km/h"
            : Math.round(item.totalDistance || 0) + " m";
      }

      save();
      close();
      window.renderTrainingResults?.();
      toast?.("Résultat corrigé");
    };

    dialog.showModal();
  }

  function decorate() {
    const table = document.querySelector(".training-summary-table");
    if (!table) return;

    const headRow = table.querySelector("thead tr");
    if (headRow && !headRow.querySelector(".training-action-head")) {
      const th = document.createElement("th");
      th.className = "training-action-head";
      th.textContent = "Action";
      headRow.appendChild(th);
    }

    const rows = contextRows()
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

    table.querySelectorAll("tbody tr").forEach((tr, index) => {
      if (tr.querySelector(".training-actions")) return;

      const item = rows[index];
      if (!item) return;

      const td = document.createElement("td");
      td.className = "training-actions";
      td.innerHTML =
        '<button type="button" class="training-edit">Corriger</button>' +
        '<button type="button" class="training-delete">Supprimer</button>';

      td.querySelector(".training-edit").onclick = () => openEditor(item.id);
      td.querySelector(".training-delete").onclick = () => deleteItem(item.id);

      tr.appendChild(td);
    });
  }

  function installStyles() {
    if (document.getElementById("trainingEditStyles")) return;

    const style = document.createElement("style");
    style.id = "trainingEditStyles";
    style.textContent = `
      .training-actions{display:flex;gap:6px;justify-content:center}
      .training-actions button{white-space:nowrap}
      .training-delete,.training-edit-actions .danger{
        color:#b42318;border-color:#f0b9b4;background:#fff7f6
      }
      #trainingEditDialog{
        border:0;border-radius:18px;padding:0;
        width:min(920px,94vw);max-height:90vh;
        box-shadow:0 24px 70px rgba(15,23,42,.28)
      }
      #trainingEditDialog::backdrop{background:rgba(15,23,42,.38)}
      .training-edit-dialog{padding:20px;overflow:auto;max-height:88vh}
      .training-edit-head{
        display:flex;justify-content:space-between;align-items:flex-start;
        gap:12px;margin-bottom:16px
      }
      .training-edit-head h2{margin:2px 0 0}
      .training-edit-grid{
        display:grid;grid-template-columns:repeat(4,minmax(0,1fr));
        gap:10px;margin-bottom:14px
      }
      .training-edit-dialog label{
        display:grid;gap:5px;font-weight:700;color:#344054
      }
      .training-edit-dialog input,.training-edit-dialog select{
        min-width:0;padding:10px 11px;border:1px solid #cfd8e6;
        border-radius:10px;background:white
      }
      .training-edit-actions{
        display:grid;grid-template-columns:auto 1fr auto auto;
        gap:10px;align-items:center;margin-top:18px
      }
      @media(max-width:700px){
        .training-edit-grid{grid-template-columns:1fr 1fr}
        .training-edit-actions{grid-template-columns:1fr 1fr}
        .training-edit-actions span{display:none}
      }
    `;
    document.head.appendChild(style);
  }

  const observer = new MutationObserver(() => decorate());

  function install() {
    installStyles();
    decorate();
    observer.observe(document.body, { childList:true, subtree:true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install);
  } else {
    install();
  }
})();