(() => {
  "use strict";

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getGroups() {
    try {
      return Array.isArray(db?.groups)
        ? db.groups
        : [];
    } catch {
      return [];
    }
  }

  function activeSpace() {
    try {
      return getGroups().find(
        g => String(g.id) === String(db.activeGroupId)
      ) || null;
    } catch {
      return null;
    }
  }

  function activeEvaluation() {
    const space = activeSpace();

    if (!space) {
      return null;
    }

    return (space.sessions || []).find(
      s => String(s.id) === String(db.activeSessionId)
    ) || null;
  }

  function countStudents(space) {
    const ids = new Set();

    (space.sessions || []).forEach(session => {
      (session.students || []).forEach(student => {
        ids.add(
          student.externalId ||
          student.id ||
          `${student.last}-${student.first}`
        );
      });
    });

    return ids.size;
  }

  function ensureContainer() {
    const page =
      document.getElementById("group");

    if (!page) {
      return null;
    }

    let box =
      document.getElementById("spacesOverview");

    if (!box) {
      box =
        document.createElement("div");

      box.id = "spacesOverview";
      box.className = "card";

      const toolbar =
        page.querySelector(".toolbar");

      if (toolbar) {
        toolbar.after(box);
      } else {
        page.prepend(box);
      }
    }

    return box;
  }

  function selectSpace(id) {
    const space = getGroups().find(
      item =>
        String(item.id) ===
        String(id)
    );

    if (!space) {
      return;
    }

    db.activeGroupId = space.id;

    /*
     * On n'invente jamais une évaluation active.
     * Si l'espace possède des évaluations,
     * on ouvre la plus récente.
     */
    const sessions = [
      ...(space.sessions || [])
    ].sort(
      (a, b) =>
        Number(b.createdAt || 0) -
        Number(a.createdAt || 0)
    );

    db.activeSessionId =
      sessions[0]?.id || null;

    try {
      filter = "ALL";
    } catch {}

    if (typeof save === "function") {
      save();
    }

    if (typeof render === "function") {
      render();
    }

    setTimeout(renderSpaces, 0);
  }

  function renderContext() {
    const space =
      activeSpace();

    const evaluation =
      activeEvaluation();

    const host =
      document.getElementById(
        "activeContextBanner"
      );

    if (!host) {
      return;
    }

    if (!space) {
      host.innerHTML = `
        <strong>Aucun espace sélectionné</strong>
        <span>
          Crée ou ouvre un espace avant de scanner.
        </span>
      `;
      return;
    }

    host.innerHTML = `
      <strong>
        Espace : ${esc(space.name)}
      </strong>

      <span>
        Évaluation :
        ${
          evaluation
            ? esc(
                evaluation.label ||
                "Sans nom"
              )
            : "aucune"
        }
      </span>
    `;
  }

  function ensureContextBanner() {
    const scanPage =
      document.getElementById("scan");

    if (!scanPage) {
      return;
    }

    let banner =
      document.getElementById(
        "activeContextBanner"
      );

    if (!banner) {
      banner =
        document.createElement("div");

      banner.id =
        "activeContextBanner";

      banner.className =
        "card active-context-banner";

      scanPage.prepend(banner);
    }
  }

  function renderSpaces() {
    const box =
      ensureContainer();

    if (!box) {
      return;
    }

    ensureContextBanner();

    const spaces =
      getGroups().filter(
        group => !group.archived
      );

    const activeId =
      String(
        db?.activeGroupId || ""
      );

    box.innerHTML = `
      <div class="spaces-overview-head">

        <div>
          <div class="session-manager-eyebrow">
            MES ESPACES
          </div>

          <h2>
            Espaces d’évaluation
          </h2>

          <p>
            Chaque espace conserve ses propres
            évaluations et ses propres résultats.
          </p>
        </div>

      </div>

      ${
        spaces.length
          ? `
            <div class="spaces-grid">

              ${spaces.map(space => {

                const sessions =
                  Array.isArray(
                    space.sessions
                  )
                    ? space.sessions
                    : [];

                const isActive =
                  String(space.id) ===
                  activeId;

                const students =
                  countStudents(space);

                return `
                  <button
                    type="button"
                    class="
                      space-card
                      ${isActive ? "active" : ""}
                    "
                    data-space-id="${esc(space.id)}"
                  >

                    <strong>
                      ${esc(space.name)}
                    </strong>

                    <span>
                      ${sessions.length}
                      évaluation${
                        sessions.length > 1
                          ? "s"
                          : ""
                      }
                    </span>

                    <span>
                      ${students}
                      élève${
                        students > 1
                          ? "s"
                          : ""
                      }
                    </span>

                    ${
                      isActive
                        ? `
                          <b>
                            ✓ Espace actif
                          </b>
                        `
                        : `
                          <b>
                            Ouvrir
                          </b>
                        `
                    }

                  </button>
                `;
              }).join("")}

            </div>
          `
          : `
            <div class="empty">
              Aucun espace enregistré.
              Utilise « + Nouvel espace ».
            </div>
          `
      }
    `;

    box
      .querySelectorAll(
        "[data-space-id]"
      )
      .forEach(button => {
        button.onclick = () => {
          selectSpace(
            button.dataset.spaceId
          );
        };
      });

    /*
     * Harmonisation du vocabulaire
     * provenant de l'ancien module Groupe.
     */
    document
      .querySelectorAll(
        ".session-manager-eyebrow"
      )
      .forEach(el => {
        if (
          el.textContent
            .trim()
            .toUpperCase() ===
          "GROUPE PERMANENT"
        ) {
          el.textContent =
            "ESPACE";
        }
      });

    renderContext();
  }

  /*
   * Le module existant peut reconstruire
   * l'interface après un scan ou un changement
   * d'évaluation. On réactualise alors notre
   * vue sans modifier les données.
   */
  const observer =
    new MutationObserver(() => {
      clearTimeout(
        observer.timer
      );

      observer.timer =
        setTimeout(
          renderSpaces,
          50
        );
    });

  function init() {
    renderSpaces();

    observer.observe(
      document.body,
      {
        childList: true,
        subtree: true
      }
    );

    window.addEventListener(
      "storage",
      renderSpaces
    );
  }

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      init
    );
  } else {
    init();
  }
})();
