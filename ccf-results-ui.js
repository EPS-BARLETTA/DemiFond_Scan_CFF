(() => {
  "use strict";

  /*
   * DemiFond Scan CCF
   * Interface complémentaire des résultats
   *
   * Objectifs :
   * - conserver le tableau détaillé existant ;
   * - ajouter une vue "Saisie rapide" ;
   * - ne pas modifier app.js ;
   * - utiliser les données AFL déjà gérées par evaluation-ccf.js.
   */

  const ALLOCATION_POINTS = {
    2: { 1: 0.5, 2: 1, 3: 1.5, 4: 2 },
    4: { 1: 1, 2: 2, 3: 3, 4: 4 },
    6: { 1: 1.5, 2: 3, 3: 4.5, 4: 6 }
  };

  let originalRenderResults = null;

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatPoints(value) {
    if (value == null || !Number.isFinite(Number(value))) {
      return "—";
    }

    return Number(value).toLocaleString("fr-FR", {
      maximumFractionDigits: 2
    });
  }

  function getAllocation(student) {
    const allowed = ["2-6", "4-4", "6-2"];

    const key = allowed.includes(student.aflAllocation)
      ? student.aflAllocation
      : "4-4";

    const parts = key.split("-").map(Number);

    return {
      key,
      afl2Max: parts[0],
      afl3Max: parts[1]
    };
  }

  function getLevelPoints(maxPoints, level) {
    const numericLevel = Number(level);

    if (!numericLevel) {
      return null;
    }

    return ALLOCATION_POINTS[maxPoints]?.[numericLevel] ?? null;
  }

  function getStudentById(id) {
    try {
      const session =
        typeof activeSession === "function"
          ? activeSession()
          : null;

      if (!session || !Array.isArray(session.students)) {
        return null;
      }

      return session.students.find(
        student => String(student.id) === String(id)
      );
    } catch (error) {
      console.error("Impossible de retrouver l'élève :", error);
      return null;
    }
  }

  function getVisibleStudentsAlphabetically() {
    let students = [];

    try {
      if (typeof visibleStudents === "function") {
        students = [...visibleStudents()];
      }
    } catch (error) {
      console.error("Impossible de récupérer les élèves :", error);
    }

    return students.sort((a, b) => {
      const nameA =
        `${a.last || ""} ${a.first || ""}`.trim();

      const nameB =
        `${b.last || ""} ${b.first || ""}`.trim();

      return nameA.localeCompare(nameB, "fr", {
        sensitivity: "base"
      });
    });
  }

  function getAFL1(student) {
    try {
      if (typeof score === "function") {
        return score(student);
      }
    } catch (error) {
      console.error("Erreur calcul AFL1 :", error);
    }

    return null;
  }

  function saveAndRefresh() {
    try {
      if (typeof save === "function") {
        save();
      }
    } catch (error) {
      console.error("Erreur sauvegarde :", error);
    }

    refreshViews();
  }

  /*
   * Création des deux onglets :
   * - Tableau détaillé
   * - Saisie rapide
   */
  function ensureResultsInterface() {
    const resultRows = document.getElementById("resultRows");

    if (!resultRows) {
      return;
    }

    const card = resultRows.closest(".card");

    if (!card) {
      return;
    }

    if (card.dataset.ccfResultsUi === "ready") {
      return;
    }

    card.dataset.ccfResultsUi = "ready";
    card.classList.add("ccf-results-card");

    const title = card.querySelector("h2");

    if (title) {
      title.textContent = "Résultats CCF demi-fond";
    }

    /*
     * Tableau détaillé existant.
     */
    const detailedContainer = resultRows.closest(".table");

    if (detailedContainer) {
      detailedContainer.id = "ccfDetailedView";
      detailedContainer.classList.add("ccf-detailed-view");
    }

    /*
     * Onglets.
     */
    const tabs = document.createElement("div");

    tabs.id = "ccfViewTabs";
    tabs.className = "ccf-view-tabs";

    tabs.innerHTML = `
      <button
        type="button"
        class="ccf-view-button active"
        data-ccf-view="detailed"
      >
        Tableau détaillé
      </button>

      <button
        type="button"
        class="ccf-view-button"
        data-ccf-view="quick"
      >
        Saisie rapide AFL2 / AFL3
      </button>
    `;

    const filters = document.getElementById("resultFilters");

    if (filters) {
      filters.before(tabs);
    } else if (detailedContainer) {
      detailedContainer.before(tabs);
    }

    /*
     * Second tableau : saisie rapide.
     */
    const quickView = document.createElement("div");

    quickView.id = "ccfQuickView";
    quickView.className = "ccf-quick-view hidden";

    quickView.innerHTML = `
      <div class="ccf-quick-header">

        <div>
          <h3>Saisie rapide des évaluations</h3>

          <p>
            AFL1 est calculé automatiquement.
            Choisis ensuite la répartition et les niveaux AFL2 / AFL3.
          </p>
        </div>

      </div>

      <div class="table ccf-quick-table-container">

        <table class="ccf-quick-table">

          <thead>
            <tr>
              <th>Nom / Prénom</th>
              <th>Classe</th>
              <th>AFL1 /12</th>
              <th>Choix</th>
              <th>AFL2</th>
              <th>AFL3</th>
              <th>Note /20</th>
            </tr>
          </thead>

          <tbody id="ccfQuickRows"></tbody>

        </table>

      </div>
    `;

    if (detailedContainer) {
      detailedContainer.after(quickView);
    } else {
      card.appendChild(quickView);
    }

    /*
     * Gestion des onglets.
     */
    tabs
      .querySelectorAll("[data-ccf-view]")
      .forEach(button => {
        button.addEventListener("click", () => {
          const view = button.dataset.ccfView;

          tabs
            .querySelectorAll("[data-ccf-view]")
            .forEach(item => {
              item.classList.toggle(
                "active",
                item === button
              );
            });

          if (detailedContainer) {
            detailedContainer.classList.toggle(
              "hidden",
              view !== "detailed"
            );
          }

          quickView.classList.toggle(
            "hidden",
            view !== "quick"
          );

          if (view === "quick") {
            renderQuickTable();
          }
        });
      });
  }

  /*
   * Tableau rapide.
   */
  function renderQuickTable() {
    const tbody = document.getElementById("ccfQuickRows");

    if (!tbody) {
      return;
    }

    const students = getVisibleStudentsAlphabetically();

    if (!students.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7">
            Aucun élève dans ce relevé.
          </td>
        </tr>
      `;

      return;
    }

    tbody.innerHTML = students
      .map(student => {
        const afl1 = getAFL1(student);

        const allocation = getAllocation(student);

        const afl2Level =
          student.afl2Level || "";

        const afl3Level =
          student.afl3Level || "";

        const afl2Points = getLevelPoints(
          allocation.afl2Max,
          afl2Level
        );

        const afl3Points = getLevelPoints(
          allocation.afl3Max,
          afl3Level
        );

        let finalScore = null;

        if (
          afl1 &&
          afl2Points != null &&
          afl3Points != null
        ) {
          finalScore = Math.min(
            20,
            Number(afl1.total) +
              Number(afl2Points) +
              Number(afl3Points)
          );
        }

        return `
          <tr data-student-id="${escapeHtml(student.id)}">

            <td class="ccf-quick-student">
              <strong>
                ${escapeHtml(
                  String(student.last || "").toUpperCase()
                )}
                ${escapeHtml(student.first || "")}
              </strong>
            </td>

            <td>
              ${escapeHtml(student.classroom || "")}
            </td>

            <td class="ccf-quick-afl1">
              <strong>
                ${
                  afl1
                    ? formatPoints(afl1.total)
                    : "—"
                }
              </strong>
            </td>

            <td>

              <select
                class="ccf-quick-allocation"
                data-student-id="${escapeHtml(student.id)}"
              >

                <option
                  value="2-6"
                  ${
                    allocation.key === "2-6"
                      ? "selected"
                      : ""
                  }
                >
                  2-6
                </option>

                <option
                  value="4-4"
                  ${
                    allocation.key === "4-4"
                      ? "selected"
                      : ""
                  }
                >
                  4-4
                </option>

                <option
                  value="6-2"
                  ${
                    allocation.key === "6-2"
                      ? "selected"
                      : ""
                  }
                >
                  6-2
                </option>

              </select>

            </td>

            <td>

              <select
                class="ccf-quick-level"
                data-student-id="${escapeHtml(student.id)}"
                data-field="afl2Level"
              >

                <option value="">—</option>

                ${[1, 2, 3, 4]
                  .map(
                    level => `
                      <option
                        value="${level}"
                        ${
                          String(afl2Level) ===
                          String(level)
                            ? "selected"
                            : ""
                        }
                      >
                        Niveau ${level}
                      </option>
                    `
                  )
                  .join("")}

              </select>

              <span class="ccf-quick-points">
                ${
                  afl2Points == null
                    ? "—"
                    : `${formatPoints(
                        afl2Points
                      )} / ${allocation.afl2Max}`
                }
              </span>

            </td>

            <td>

              <select
                class="ccf-quick-level"
                data-student-id="${escapeHtml(student.id)}"
                data-field="afl3Level"
              >

                <option value="">—</option>

                ${[1, 2, 3, 4]
                  .map(
                    level => `
                      <option
                        value="${level}"
                        ${
                          String(afl3Level) ===
                          String(level)
                            ? "selected"
                            : ""
                        }
                      >
                        Niveau ${level}
                      </option>
                    `
                  )
                  .join("")}

              </select>

              <span class="ccf-quick-points">
                ${
                  afl3Points == null
                    ? "—"
                    : `${formatPoints(
                        afl3Points
                      )} / ${allocation.afl3Max}`
                }
              </span>

            </td>

            <td class="ccf-quick-final">

              <strong>
                ${
                  finalScore == null
                    ? "—"
                    : formatPoints(finalScore)
                }
              </strong>

            </td>

          </tr>
        `;
      })
      .join("");

    /*
     * Modification de la répartition.
     */
    tbody
      .querySelectorAll(".ccf-quick-allocation")
      .forEach(select => {
        select.addEventListener("change", () => {
          const student = getStudentById(
            select.dataset.studentId
          );

          if (!student) {
            return;
          }

          student.aflAllocation = select.value;

          saveAndRefresh();
        });
      });

    /*
     * Modification AFL2 / AFL3.
     */
    tbody
      .querySelectorAll(".ccf-quick-level")
      .forEach(select => {
        select.addEventListener("change", () => {
          const student = getStudentById(
            select.dataset.studentId
          );

          if (!student) {
            return;
          }

          const field = select.dataset.field;

          student[field] =
            select.value === ""
              ? ""
              : Number(select.value);

          saveAndRefresh();
        });
      });
  }

  /*
   * Prépare le tableau détaillé pour le futur CSS.
   *
   * On ne modifie pas ici les calculs ni les données.
   */
  function decorateDetailedTable() {
    const table = document.querySelector(
      "#ccfDetailedView table"
    );

    if (!table) {
      return;
    }

    table.classList.add("ccf-detailed-table");

    const headers = table.querySelectorAll(
      "thead th"
    );

    headers.forEach((header, index) => {
      header.dataset.column = String(index);
    });
  }

  /*
   * Rafraîchit les deux vues.
   */
  function refreshViews() {
    if (typeof originalRenderResults === "function") {
      originalRenderResults();
    }

    ensureResultsInterface();
    decorateDetailedTable();
    renderQuickTable();
  }

  /*
   * Installation.
   *
   * evaluation-ccf.js doit être chargé AVANT ce fichier.
   */
  function install() {
    if (
      typeof window.renderResults === "function" &&
      window.renderResults !== refreshViews
    ) {
      originalRenderResults = window.renderResults;

      window.renderResults = refreshViews;
    }

    ensureResultsInterface();
    decorateDetailedTable();
    renderQuickTable();
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
