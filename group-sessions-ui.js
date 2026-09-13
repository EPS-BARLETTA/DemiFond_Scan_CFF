(() => {
  "use strict";

  /*
   * DemiFond Scan CCF
   * Gestion visuelle :
   * Groupe permanent -> plusieurs évaluations
   * + archives des groupes
   *
   * Ce module ne remplace pas app.js.
   */

  let originalRender = null;

  function escHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatDate(timestamp) {
    if (!timestamp) {
      return "—";
    }

    try {
      return new Date(timestamp).toLocaleDateString("fr-FR");
    } catch (error) {
      return "—";
    }
  }

  function getStatus(session) {
    const allowed = ["open", "closed", "locked"];

    if (!allowed.includes(session.status)) {
      session.status = "open";
    }

    return session.status;
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

  function activeGroupSafe() {
    try {
      return typeof activeGroup === "function"
        ? activeGroup()
        : null;
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  function saveSafe() {
    try {
      if (typeof save === "function") {
        save();
      }
    } catch (error) {
      console.error(error);
    }
  }

  function renderApp() {
    if (typeof originalRender === "function") {
      originalRender();
    }

    ensureInterface();
    renderSessionManager();
    renderArchives();
  }

  function setActiveSession(sessionId) {
    const group = activeGroupSafe();

    if (!group) {
      return;
    }

    const session = group.sessions?.find(
      item => String(item.id) === String(sessionId)
    );

    if (!session) {
      return;
    }

    db.activeSessionId = session.id;

    try {
      filter = "ALL";
    } catch (error) {}

    saveSafe();
    renderApp();
  }

  function openSession(sessionId, page) {
    setActiveSession(sessionId);

    if (page && typeof showPage === "function") {
      showPage(page);
    }

    renderApp();
  }

  function createNewSession() {
    const group = activeGroupSafe();

    if (!group) {
      alert("Sélectionne ou crée d'abord un groupe.");
      return;
    }

    if (typeof createSession !== "function") {
      alert("Impossible de créer une évaluation.");
      return;
    }

    const session = createSession(group);

    if (!session) {
      return;
    }

    session.status = "open";

    saveSafe();
    renderApp();
  }

  function renameSession(sessionId) {
    const group = activeGroupSafe();

    if (!group) {
      return;
    }

    const session = group.sessions?.find(
      item => String(item.id) === String(sessionId)
    );

    if (!session) {
      return;
    }

    const value = prompt(
      "Nom de l'évaluation",
      session.label || ""
    );

    if (!value || !value.trim()) {
      return;
    }

    session.label = value.trim();

    saveSafe();
    renderApp();
  }

  function changeSessionStatus(sessionId, status) {
    const group = activeGroupSafe();

    if (!group) {
      return;
    }

    const session = group.sessions?.find(
      item => String(item.id) === String(sessionId)
    );

    if (!session) {
      return;
    }

    if (
      status === "locked" &&
      !confirm(
        "Verrouiller cette évaluation ?\n\n" +
        "Elle sera signalée comme finalisée."
      )
    ) {
      renderApp();
      return;
    }

    session.status = status;

    saveSafe();
    renderApp();
  }

  function archiveActiveGroup() {
    const group = activeGroupSafe();

    if (!group) {
      return;
    }

    if (
      !confirm(
        `Archiver le groupe "${group.name}" ?\n\n` +
        "Toutes ses évaluations et tous ses résultats seront conservés."
      )
    ) {
      return;
    }

    group.archived = true;

    db.activeGroupId = null;
    db.activeSessionId = null;

    saveSafe();
    renderApp();
  }

  function restoreGroup(groupId) {
    const group = db.groups?.find(
      item => String(item.id) === String(groupId)
    );

    if (!group) {
      return;
    }

    group.archived = false;

    db.activeGroupId = group.id;
    db.activeSessionId = null;

    try {
      filter = "ALL";
    } catch (error) {}

    saveSafe();
    renderApp();
  }

  function ensureInterface() {
    const groupPage = document.getElementById("group");

    if (!groupPage) {
      return;
    }

    let manager = document.getElementById(
      "groupSessionManager"
    );

    if (!manager) {
      manager = document.createElement("div");

      manager.id = "groupSessionManager";
      manager.className = "card session-manager";

      const studentCard = groupPage.querySelector(".card");

      if (studentCard) {
        studentCard.before(manager);
      } else {
        groupPage.appendChild(manager);
      }
    }

    let archivePanel = document.getElementById(
      "groupArchivesPanel"
    );

    if (!archivePanel) {
      archivePanel = document.createElement("div");

      archivePanel.id = "groupArchivesPanel";
      archivePanel.className =
        "card group-archives-panel hidden";

      manager.after(archivePanel);
    }

    /*
     * Le bouton Archiver existant devient
     * l'action d'archivage de la classe/groupe.
     */
    const archiveButton =
      document.getElementById("archive");

    if (
      archiveButton &&
      archiveButton.dataset.sessionUiBound !== "1"
    ) {
      archiveButton.dataset.sessionUiBound = "1";
      archiveButton.textContent = "Archiver le groupe";

      archiveButton.onclick = event => {
        event.preventDefault();
        archiveActiveGroup();
      };
    }
  }

  function renderSessionManager() {
    const manager = document.getElementById(
      "groupSessionManager"
    );

    if (!manager) {
      return;
    }

    const group = activeGroupSafe();

    if (!group) {
      manager.innerHTML = `
        <div class="session-manager-empty">

          <div>
            <h2>Évaluations demi-fond</h2>

            <p>
              Crée ou sélectionne un groupe pour
              retrouver toutes ses évaluations.
            </p>
          </div>

          <button
            type="button"
            id="showArchives"
          >
            Archives
          </button>

        </div>
      `;

      bindManagerButtons();
      return;
    }

    group.sessions = Array.isArray(group.sessions)
      ? group.sessions
      : [];

    const sessions = [...group.sessions].sort(
      (a, b) =>
        Number(b.createdAt || 0) -
        Number(a.createdAt || 0)
    );

    const activeId = db.activeSessionId;

    manager.innerHTML = `
      <div class="session-manager-header">

        <div>
          <div class="session-manager-eyebrow">
            GROUPE PERMANENT
          </div>

          <h2>
            ${escHtml(group.name)}
          </h2>

          <p>
            ${sessions.length}
            évaluation${sessions.length > 1 ? "s" : ""}
            enregistrée${sessions.length > 1 ? "s" : ""}
          </p>
        </div>

        <div class="session-manager-actions">

          <button
            type="button"
            id="newEvaluation"
            class="primary-action"
          >
            + Nouvelle évaluation
          </button>

          <button
            type="button"
            id="showArchives"
          >
            Archives
          </button>

        </div>

      </div>

      ${
        sessions.length
          ? `
            <div class="session-list">

              ${sessions
                .map(session => {
                  const status = getStatus(session);

                  const isActive =
                    String(session.id) ===
                    String(activeId);

                  const students =
                    Array.isArray(session.students)
                      ? session.students.length
                      : 0;

                  return `
                    <div
                      class="
                        session-row
                        ${isActive ? "active" : ""}
                      "
                      data-session-id="${escHtml(session.id)}"
                    >

                      <div class="session-main">

                        <div class="session-title-line">

                          <strong>
                            ${escHtml(
                              session.label ||
                              "Évaluation"
                            )}
                          </strong>

                          ${
                            isActive
                              ? `
                                <span class="session-active-badge">
                                  Active
                                </span>
                              `
                              : ""
                          }

                        </div>

                        <div class="session-meta">

                          <span>
                            ${formatDate(session.createdAt)}
                          </span>

                          <span>
                            ${students}
                            élève${students > 1 ? "s" : ""}
                          </span>

                          <span
                            class="
                              session-status
                              status-${status}
                            "
                          >
                            ${statusLabel(status)}
                          </span>

                        </div>

                      </div>

                      <div class="session-controls">

                        <select
                          class="session-status-select"
                          data-session-id="${escHtml(session.id)}"
                          aria-label="État de l'évaluation"
                        >

                          <option
                            value="open"
                            ${status === "open" ? "selected" : ""}
                          >
                            En cours
                          </option>

                          <option
                            value="closed"
                            ${status === "closed" ? "selected" : ""}
                          >
                            Terminée
                          </option>

                          <option
                            value="locked"
                            ${status === "locked" ? "selected" : ""}
                          >
                            Verrouillée
                          </option>

                        </select>

                        <button
                          type="button"
                          class="session-open"
                          data-session-id="${escHtml(session.id)}"
                        >
                          Ouvrir
                        </button>

                        <button
                          type="button"
                          class="session-scan"
                          data-session-id="${escHtml(session.id)}"
                        >
                          Scanner
                        </button>

                        <button
                          type="button"
                          class="session-results"
                          data-session-id="${escHtml(session.id)}"
                        >
                          Résultats
                        </button>

                        <button
                          type="button"
                          class="session-rename"
                          data-session-id="${escHtml(session.id)}"
                        >
                          Renommer
                        </button>

                      </div>

                    </div>
                  `;
                })
                .join("")}

            </div>
          `
          : `
            <div class="session-empty">

              <strong>
                Aucune évaluation pour ce groupe.
              </strong>

              <p>
                Crée par exemple :
                « Entraînement 1 »,
                « CCF blanc » ou
                « CCF final ».
              </p>

            </div>
          `
      }
    `;

    bindManagerButtons();
  }

  function bindManagerButtons() {
    document
      .querySelectorAll("#newEvaluation")
      .forEach(button => {
        button.onclick = createNewSession;
      });

    document
      .querySelectorAll("#showArchives")
      .forEach(button => {
        button.onclick = () => {
          const panel =
            document.getElementById(
              "groupArchivesPanel"
            );

          if (!panel) {
            return;
          }

          panel.classList.toggle("hidden");

          renderArchives();
        };
      });

    document
      .querySelectorAll(".session-open")
      .forEach(button => {
        button.onclick = () => {
          openSession(
            button.dataset.sessionId,
            "group"
          );
        };
      });

    document
      .querySelectorAll(".session-scan")
      .forEach(button => {
        button.onclick = () => {
          openSession(
            button.dataset.sessionId,
            "scan"
          );
        };
      });

    document
      .querySelectorAll(".session-results")
      .forEach(button => {
        button.onclick = () => {
          openSession(
            button.dataset.sessionId,
            "results"
          );
        };
      });

    document
      .querySelectorAll(".session-rename")
      .forEach(button => {
        button.onclick = () => {
          renameSession(
            button.dataset.sessionId
          );
        };
      });

    document
      .querySelectorAll(".session-status-select")
      .forEach(select => {
        select.onchange = () => {
          changeSessionStatus(
            select.dataset.sessionId,
            select.value
          );
        };
      });
  }

  function renderArchives() {
    const panel = document.getElementById(
      "groupArchivesPanel"
    );

    if (!panel) {
      return;
    }

    const archived = (db.groups || [])
      .filter(group => group.archived)
      .sort((a, b) =>
        String(a.name || "").localeCompare(
          String(b.name || ""),
          "fr",
          { sensitivity: "base" }
        )
      );

    panel.innerHTML = `
      <div class="archives-header">

        <div>
          <h2>Groupes archivés</h2>

          <p>
            Les évaluations et résultats sont
            conservés dans chaque groupe.
          </p>
        </div>

        <button
          type="button"
          id="closeArchives"
        >
          Fermer
        </button>

      </div>

      ${
        archived.length
          ? `
            <div class="archive-list">

              ${archived
                .map(group => {
                  const sessions =
                    Array.isArray(group.sessions)
                      ? group.sessions.length
                      : 0;

                  return `
                    <div class="archive-row">

                      <div>
                        <strong>
                          ${escHtml(group.name)}
                        </strong>

                        <div class="archive-meta">
                          ${sessions}
                          évaluation${sessions > 1 ? "s" : ""}
                        </div>
                      </div>

                      <button
                        type="button"
                        class="restore-group"
                        data-group-id="${escHtml(group.id)}"
                      >
                        Restaurer
                      </button>

                    </div>
                  `;
                })
                .join("")}

            </div>
          `
          : `
            <div class="session-empty">
              Aucun groupe archivé.
            </div>
          `
      }
    `;

    const close =
      document.getElementById("closeArchives");

    if (close) {
      close.onclick = () => {
        panel.classList.add("hidden");
      };
    }

    panel
      .querySelectorAll(".restore-group")
      .forEach(button => {
        button.onclick = () => {
          restoreGroup(
            button.dataset.groupId
          );

          panel.classList.add("hidden");
        };
      });
  }

  function install() {
    ensureInterface();

    if (
      typeof window.render === "function" &&
      window.render !== renderApp
    ) {
      originalRender = window.render;
      window.render = renderApp;
    }

    renderApp();
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
