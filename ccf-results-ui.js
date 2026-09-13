(() => {
  "use strict";

  const ALLOCATION_POINTS = {
    2: {
      1: 0.5,
      2: 1,
      3: 1.5,
      4: 2
    },
    4: {
      1: 1,
      2: 2,
      3: 3,
      4: 4
    },
    6: {
      1: 1.5,
      2: 3,
      3: 4.5,
      4: 6
    }
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
    if (
      value == null ||
      !Number.isFinite(
        Number(value)
      )
    ) {
      return "—";
    }

    return Number(value)
      .toLocaleString(
        "fr-FR",
        {
          maximumFractionDigits: 2
        }
      );
  }

  function getAllocation(student) {
    const allowed = [
      "2-6",
      "4-4",
      "6-2"
    ];

    const key =
      allowed.includes(
        student.aflAllocation
      )
        ? student.aflAllocation
        : "4-4";

    const [
      afl2Max,
      afl3Max
    ] =
      key
        .split("-")
        .map(Number);

    return {
      key,
      afl2Max,
      afl3Max
    };
  }

  function getLevelPoints(
    maxPoints,
    level
  ) {
    const numericLevel =
      Number(level);

    if (!numericLevel) {
      return null;
    }

    return (
      ALLOCATION_POINTS[
        maxPoints
      ]?.[
        numericLevel
      ] ??
      null
    );
  }

  function getStudentById(id) {
    try {
      const session =
        typeof activeSession ===
        "function"
          ? activeSession()
          : null;

      if (
        !session ||
        !Array.isArray(
          session.students
        )
      ) {
        return null;
      }

      return session.students.find(
        student =>
          String(student.id) ===
          String(id)
      );
    } catch (error) {
      console.error(
        "Impossible de retrouver l'élève :",
        error
      );

      return null;
    }
  }

  function getVisibleStudentsAlphabetically() {
    let students = [];

    try {
      if (
        typeof visibleStudents ===
        "function"
      ) {
        students = [
          ...visibleStudents()
        ];
      }
    } catch (error) {
      console.error(
        "Impossible de récupérer les élèves :",
        error
      );
    }

    return students.sort(
      (a, b) => {
        const nameA =
          `${
            a.last || ""
          } ${
            a.first || ""
          }`.trim();

        const nameB =
          `${
            b.last || ""
          } ${
            b.first || ""
          }`.trim();

        return nameA.localeCompare(
          nameB,
          "fr",
          {
            sensitivity:
              "base"
          }
        );
      }
    );
  }

  function getAFL1(student) {
    try {
      if (
        typeof score ===
        "function"
      ) {
        return score(
          student
        );
      }
    } catch (error) {
      console.error(
        "Erreur calcul AFL1 :",
        error
      );
    }

    return null;
  }

  function isLocked() {
    try {
      const session =
        typeof activeSession ===
        "function"
          ? activeSession()
          : null;

      return (
        session?.status ===
        "locked"
      );
    } catch (error) {
      console.error(
        error
      );

      return false;
    }
  }

  function notifyLocked() {
    if (
      typeof toast ===
      "function"
    ) {
      toast(
        "Évaluation verrouillée"
      );
    }

    alert(
      "Cette évaluation est verrouillée.\n\n" +
      "Repasse-la en « En cours » pour modifier AFL2 ou AFL3."
    );
  }

  function saveAndRefresh() {
    if (isLocked()) {
      notifyLocked();
      refreshViews();
      return;
    }

    try {
      if (
        typeof save ===
        "function"
      ) {
        save();
      }
    } catch (error) {
      console.error(
        "Erreur sauvegarde :",
        error
      );
    }

    refreshViews();
  }

  function ensureResultsInterface() {
    const resultRows =
      document.getElementById(
        "resultRows"
      );

    if (!resultRows) {
      return;
    }

    const card =
      resultRows.closest(
        ".card"
      );

    if (!card) {
      return;
    }

    if (
      card.dataset
        .ccfResultsUi ===
      "ready"
    ) {
      return;
    }

    card.dataset.ccfResultsUi =
      "ready";

    card.classList.add(
      "ccf-results-card"
    );

    const title =
      card.querySelector(
        "h2"
      );

    if (title) {
      title.textContent =
        "Résultats CCF demi-fond";
    }

    const detailedContainer =
      resultRows.closest(
        ".table"
      );

    if (
      detailedContainer
    ) {
      detailedContainer.id =
        "ccfDetailedView";

      detailedContainer
        .classList
        .add(
          "ccf-detailed-view"
        );
    }

    const tabs =
      document.createElement(
        "div"
      );

    tabs.id =
      "ccfViewTabs";

    tabs.className =
      "ccf-view-tabs";

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

    const filters =
      document.getElementById(
        "resultFilters"
      );

    if (filters) {
      filters.before(
        tabs
      );
    } else if (
      detailedContainer
    ) {
      detailedContainer.before(
        tabs
      );
    }

    const quickView =
      document.createElement(
        "div"
      );

    quickView.id =
      "ccfQuickView";

    quickView.className =
      "ccf-quick-view hidden";

    quickView.innerHTML = `
      <div class="ccf-quick-header">

        <div>

          <h3>
            Saisie rapide des évaluations
          </h3>

          <p>
            AFL1 est calculé automatiquement.
            Choisis ensuite la répartition et
            les niveaux AFL2 / AFL3.
          </p>

        </div>

      </div>

      <div
        id="ccfQuickLockNotice"
        class="hidden"
        style="
          margin-bottom:14px;
          padding:12px 14px;
          border-radius:12px;
          background:#f1f5f9;
          border:1px solid #cbd5e1;
          color:#334155;
          font-weight:700
        "
      >
        🔒 Évaluation verrouillée —
        consultation uniquement.
      </div>

      <div
        class="
          table
          ccf-quick-table-container
        "
      >

        <table
          class="ccf-quick-table"
        >

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

          <tbody
            id="ccfQuickRows"
          ></tbody>

        </table>

      </div>
    `;

    if (
      detailedContainer
    ) {
      detailedContainer.after(
        quickView
      );
    } else {
      card.appendChild(
        quickView
      );
    }

    tabs
      .querySelectorAll(
        "[data-ccf-view]"
      )
      .forEach(
        button => {
          button.addEventListener(
            "click",
            () => {
              const view =
                button
                  .dataset
                  .ccfView;

              tabs
                .querySelectorAll(
                  "[data-ccf-view]"
                )
                .forEach(
                  item => {
                    item
                      .classList
                      .toggle(
                        "active",
                        item ===
                          button
                      );
                  }
                );

              if (
                detailedContainer
              ) {
                detailedContainer
                  .classList
                  .toggle(
                    "hidden",
                    view !==
                      "detailed"
                  );
              }

              quickView
                .classList
                .toggle(
                  "hidden",
                  view !==
                    "quick"
                );

              if (
                view ===
                "quick"
              ) {
                renderQuickTable();
              }
            }
          );
        }
      );
  }

  function renderQuickTable() {
    const tbody =
      document.getElementById(
        "ccfQuickRows"
      );

    if (!tbody) {
      return;
    }

    const locked =
      isLocked();

    const notice =
      document.getElementById(
        "ccfQuickLockNotice"
      );

    if (notice) {
      notice.classList.toggle(
        "hidden",
        !locked
      );
    }

    const students =
      getVisibleStudentsAlphabetically();

    if (
      !students.length
    ) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7">
            Aucun élève dans ce relevé.
          </td>
        </tr>
      `;

      return;
    }

    tbody.innerHTML =
      students
        .map(
          student => {
            const afl1 =
              getAFL1(
                student
              );

            const allocation =
              getAllocation(
                student
              );

            const afl2Level =
              student
                .afl2Level ||
              "";

            const afl3Level =
              student
                .afl3Level ||
              "";

            const afl2Points =
              getLevelPoints(
                allocation
                  .afl2Max,
                afl2Level
              );

            const afl3Points =
              getLevelPoints(
                allocation
                  .afl3Max,
                afl3Level
              );

            let finalScore =
              null;

            if (
              afl1 &&
              afl2Points != null &&
              afl3Points != null
            ) {
              finalScore =
                Math.min(
                  20,
                  Number(
                    afl1.total
                  ) +
                  Number(
                    afl2Points
                  ) +
                  Number(
                    afl3Points
                  )
                );
            }

            return `
              <tr
                data-student-id="${escapeHtml(
                  student.id
                )}"
              >

                <td
                  class="ccf-quick-student"
                >

                  <strong>
                    ${escapeHtml(
                      String(
                        student.last ||
                          ""
                      ).toUpperCase()
                    )}
                    ${escapeHtml(
                      student.first ||
                        ""
                    )}
                  </strong>

                </td>

                <td>
                  ${escapeHtml(
                    student.classroom ||
                      ""
                  )}
                </td>

                <td
                  class="ccf-quick-afl1"
                >

                  <strong>
                    ${
                      afl1
                        ? formatPoints(
                            afl1.total
                          )
                        : "—"
                    }
                  </strong>

                </td>

                <td>

                  <select
                    class="ccf-quick-allocation"
                    data-student-id="${escapeHtml(
                      student.id
                    )}"
                    ${
                      locked
                        ? "disabled"
                        : ""
                    }
                  >

                    <option
                      value="2-6"
                      ${
                        allocation.key ===
                        "2-6"
                          ? "selected"
                          : ""
                      }
                    >
                      2-6
                    </option>

                    <option
                      value="4-4"
                      ${
                        allocation.key ===
                        "4-4"
                          ? "selected"
                          : ""
                      }
                    >
                      4-4
                    </option>

                    <option
                      value="6-2"
                      ${
                        allocation.key ===
                        "6-2"
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
                    data-student-id="${escapeHtml(
                      student.id
                    )}"
                    data-field="afl2Level"
                    ${
                      locked
                        ? "disabled"
                        : ""
                    }
                  >

                    <option value="">
                      —
                    </option>

                    ${[
                      1,
                      2,
                      3,
                      4
                    ]
                      .map(
                        level => `
                          <option
                            value="${level}"
                            ${
                              String(
                                afl2Level
                              ) ===
                              String(
                                level
                              )
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

                  <span
                    class="ccf-quick-points"
                  >
                    ${
                      afl2Points ==
                      null
                        ? "—"
                        : `${formatPoints(
                            afl2Points
                          )} / ${
                            allocation
                              .afl2Max
                          }`
                    }
                  </span>

                </td>

                <td>

                  <select
                    class="ccf-quick-level"
                    data-student-id="${escapeHtml(
                      student.id
                    )}"
                    data-field="afl3Level"
                    ${
                      locked
                        ? "disabled"
                        : ""
                    }
                  >

                    <option value="">
                      —
                    </option>

                    ${[
                      1,
                      2,
                      3,
                      4
                    ]
                      .map(
                        level => `
                          <option
                            value="${level}"
                            ${
                              String(
                                afl3Level
                              ) ===
                              String(
                                level
                              )
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

                  <span
                    class="ccf-quick-points"
                  >
                    ${
                      afl3Points ==
                      null
                        ? "—"
                        : `${formatPoints(
                            afl3Points
                          )} / ${
                            allocation
                              .afl3Max
                          }`
                    }
                  </span>

                </td>

                <td
                  class="ccf-quick-final"
                >

                  <strong>
                    ${
                      finalScore ==
                      null
                        ? "—"
                        : formatPoints(
                            finalScore
                          )
                    }
                  </strong>

                </td>

              </tr>
            `;
          }
        )
        .join("");

    tbody
      .querySelectorAll(
        ".ccf-quick-allocation"
      )
      .forEach(
        select => {
          select.addEventListener(
            "change",
            () => {
              if (
                isLocked()
              ) {
                renderQuickTable();
                notifyLocked();
                return;
              }

              const student =
                getStudentById(
                  select
                    .dataset
                    .studentId
                );

              if (!student) {
                return;
              }

              student.aflAllocation =
                select.value;

              saveAndRefresh();
            }
          );
        }
      );

    tbody
      .querySelectorAll(
        ".ccf-quick-level"
      )
      .forEach(
        select => {
          select.addEventListener(
            "change",
            () => {
              if (
                isLocked()
              ) {
                renderQuickTable();
                notifyLocked();
                return;
              }

              const student =
                getStudentById(
                  select
                    .dataset
                    .studentId
                );

              if (!student) {
                return;
              }

              const field =
                select
                  .dataset
                  .field;

              student[field] =
                select.value ===
                ""
                  ? ""
                  : Number(
                      select.value
                    );

              saveAndRefresh();
            }
          );
        }
      );
  }

  function decorateDetailedTable() {
    const table =
      document.querySelector(
        "#ccfDetailedView table"
      );

    if (!table) {
      return;
    }

    table.classList.add(
      "ccf-detailed-table"
    );

    const headers =
      table.querySelectorAll(
        "thead th"
      );

    headers.forEach(
      (
        header,
        index
      ) => {
        header.dataset.column =
          String(index);
      }
    );
  }

  function refreshViews() {
    if (
      typeof originalRenderResults ===
      "function"
    ) {
      originalRenderResults();
    }

    ensureResultsInterface();
    decorateDetailedTable();
    renderQuickTable();
  }

  function install() {
    if (
      typeof window.renderResults ===
        "function" &&
      window.renderResults !==
        refreshViews
    ) {
      originalRenderResults =
        window.renderResults;

      window.renderResults =
        refreshViews;
    }

    ensureResultsInterface();
    decorateDetailedTable();
    renderQuickTable();
  }

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      install
    );
  } else {
    install();
  }

})();
