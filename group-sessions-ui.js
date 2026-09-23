(() => {
  "use strict";

  /*
   * DemiFond Scan CCF
   *
   * Gestion :
   * Groupe permanent
   * -> plusieurs évaluations
   * -> archives
   * -> statut En cours / Terminée / Verrouillée
   *
   * Une évaluation verrouillée reste consultable
   * mais ne peut plus être modifiée ou alimentée
   * par de nouveaux scans.
   */

  let originalRender = null;
  let originalHandleQR = null;

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
      return new Date(timestamp)
        .toLocaleDateString("fr-FR");
    } catch (error) {
      return "—";
    }
  }

  function getStatus(session) {
    const allowed = [
      "open",
      "closed",
      "locked"
    ];

    if (!allowed.includes(session?.status)) {
      if (session) {
        session.status = "open";
      }

      return "open";
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

  function activeSessionSafe() {
    try {
      return typeof activeSession === "function"
        ? activeSession()
        : null;
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  function isLocked(session = activeSessionSafe()) {
    return !!session &&
      getStatus(session) === "locked";
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

  function lockedMessage() {
    return (
      "Cette évaluation est verrouillée.\n\n" +
      "Repasse-la en « En cours » pour " +
      "ajouter ou modifier des résultats."
    );
  }

  function notifyLocked() {
    if (typeof toast === "function") {
      toast("Évaluation verrouillée");
    }

    alert(lockedMessage());
  }

  function studentPanel() {
    return document.querySelector(
      "#group .student-list-card"
    );
  }

  function setStudentPanelVisible(
    visible,
    session = activeSessionSafe()
  ) {
    const card =
      studentPanel();

    const filters =
      document.getElementById(
        "filters"
      );

    if (card) {
      card.classList.toggle(
        "hidden",
        !visible
      );

      const title =
        card.querySelector(
          ".student-list-head h2"
        );

      if (
        title &&
        visible &&
        session
      ) {
        title.textContent =
          "Élèves — " +
          (
            session.label ||
            "Évaluation"
          );
      }
    }

    if (filters) {
      filters.classList.toggle(
        "hidden",
        !visible
      );
    }
  }

  function activateSessionInline(
    sessionId
  ) {
    const session =
      setActiveSession(
        sessionId
      );

    if (!session) {
      return null;
    }

    document
      .querySelectorAll(
        ".session-row"
      )
      .forEach(row => {
        const active =
          String(
            row.dataset.sessionId
          ) ===
          String(
            session.id
          );

        row.classList.toggle(
          "active",
          active
        );

        if (!active) {
          row.open = false;
        }

        const badge =
          row.querySelector(
            ".session-active-badge"
          );

        if (badge) {
          badge.remove();
        }

        if (active) {
          const titleLine =
            row.querySelector(
              ".session-title-line"
            );

          if (
            titleLine &&
            !titleLine.querySelector(
              ".session-active-badge"
            )
          ) {
            const activeBadge =
              document.createElement(
                "span"
              );

            activeBadge.className =
              "session-active-badge";

            activeBadge.textContent =
              "Évaluation active";

            titleLine.appendChild(
              activeBadge
            );
          }
        }
      });

    if (
      typeof renderFilters ===
      "function"
    ) {
      renderFilters();
    }

    if (
      typeof renderStudents ===
      "function"
    ) {
      renderStudents();
    }

    applyLockState();

    setStudentPanelVisible(
      true,
      session
    );

    return session;
  }

  function renderApp() {
    if (typeof originalRender === "function") {
      originalRender();
    }

    ensureInterface();
    renderSessionManager();
    renderArchives();
    applyLockState();
    setStudentPanelVisible(
      false
    );
  }

  function setActiveSession(sessionId) {
    const group = activeGroupSafe();

    if (!group) {
      return null;
    }

    const session =
      group.sessions?.find(
        item =>
          String(item.id) ===
          String(sessionId)
      );

    if (!session) {
      return null;
    }

    db.activeSessionId = session.id;

    try {
      filter = "ALL";
    } catch (error) {}

    saveSafe();

    return session;
  }

  function openSession(sessionId, page) {
    const session =
      setActiveSession(sessionId);

    if (!session) {
      return;
    }

    if (
      page === "scan" &&
      isLocked(session)
    ) {
      renderApp();
      notifyLocked();
      return;
    }

    if (
      page &&
      typeof showPage === "function"
    ) {
      showPage(page);
    }

    renderApp();
  }

  function createNewSession() {
    const group =
      activeGroupSafe();

    if (!group) {
      alert(
        "Sélectionne ou crée d'abord un groupe."
      );
      return;
    }

    if (
      typeof createSession !==
      "function"
    ) {
      alert(
        "Impossible de créer une évaluation."
      );
      return;
    }

    const session =
      createSession(group);

    if (!session) {
      return;
    }

    session.status = "open";

    saveSafe();
    renderApp();
  }

  function renameSession(sessionId) {
    const group =
      activeGroupSafe();

    if (!group) {
      return;
    }

    const session =
      group.sessions?.find(
        item =>
          String(item.id) ===
          String(sessionId)
      );

    if (!session) {
      return;
    }

    if (isLocked(session)) {
      notifyLocked();
      return;
    }

    const value = prompt(
      "Nom de l'évaluation",
      session.label || ""
    );

    if (
      !value ||
      !value.trim()
    ) {
      return;
    }

    session.label =
      value.trim();

    saveSafe();
    renderApp();
  }

  function changeSessionStatus(
    sessionId,
    status
  ) {
    const group =
      activeGroupSafe();

    if (!group) {
      return;
    }

    const session =
      group.sessions?.find(
        item =>
          String(item.id) ===
          String(sessionId)
      );

    if (!session) {
      return;
    }

    const previous =
      getStatus(session);

    if (
      status === "locked" &&
      previous !== "locked"
    ) {
      const ok = confirm(
        "Verrouiller cette évaluation ?\n\n" +
        "Les scans et les modifications " +
        "seront bloqués.\n\n" +
        "Les résultats resteront consultables."
      );

      if (!ok) {
        renderApp();
        return;
      }
    }

    session.status = status;

    saveSafe();

    if (
      status === "locked" &&
      !document
        .getElementById("scan")
        ?.classList.contains("hidden")
    ) {
      const stop =
        document.getElementById(
          "cameraStop"
        );

      if (stop) {
        try {
          stop.click();
        } catch (error) {}
      }

      if (
        typeof showPage ===
        "function"
      ) {
        showPage("results");
      }
    }

    renderApp();
  }

  function archiveActiveGroup() {
    const group =
      activeGroupSafe();

    if (!group) {
      return;
    }

    if (
      !confirm(
        `Archiver le groupe "${group.name}" ?\n\n` +
        "Toutes ses évaluations et tous ses " +
        "résultats seront conservés."
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
    const group =
      db.groups?.find(
        item =>
          String(item.id) ===
          String(groupId)
      );

    if (!group) {
      return;
    }

    group.archived = false;

    db.activeGroupId =
      group.id;

    db.activeSessionId =
      null;

    try {
      filter = "ALL";
    } catch (error) {}

    saveSafe();
    renderApp();
  }

  function ensureInterface() {
    const groupPage =
      document.getElementById(
        "group"
      );

    if (!groupPage) {
      return;
    }

    let manager =
      document.getElementById(
        "groupSessionManager"
      );

    if (!manager) {
      manager =
        document.createElement(
          "div"
        );

      manager.id =
        "groupSessionManager";

      manager.className =
        "card session-manager";

      const studentCard =
        groupPage.querySelector(
          ".card"
        );

      if (studentCard) {
        studentCard.before(manager);
      } else {
        groupPage.appendChild(manager);
      }
    }

    let archivePanel =
      document.getElementById(
        "groupArchivesPanel"
      );

    if (!archivePanel) {
      archivePanel =
        document.createElement(
          "div"
        );

      archivePanel.id =
        "groupArchivesPanel";

      archivePanel.className =
        "card group-archives-panel hidden";

      manager.after(
        archivePanel
      );
    }

    const archiveButton =
      document.getElementById(
        "archive"
      );

    if (
      archiveButton &&
      archiveButton
        .dataset
        .sessionUiBound !== "1"
    ) {
      archiveButton
        .dataset
        .sessionUiBound = "1";

      archiveButton.textContent =
        "Archiver le groupe";

      archiveButton.onclick =
        event => {
          event.preventDefault();
          archiveActiveGroup();
        };
    }
  }

  function renderSessionManager() {
    const manager =
      document.getElementById(
        "groupSessionManager"
      );

    if (!manager) {
      return;
    }

    const group =
      activeGroupSafe();

    if (!group) {
      manager.innerHTML = `
        <div class="session-manager-empty">

          <div>

            <h2>
              Évaluations demi-fond
            </h2>

            <p>
              Crée ou sélectionne un groupe
              pour retrouver toutes ses
              évaluations.
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

    group.sessions =
      Array.isArray(
        group.sessions
      )
        ? group.sessions
        : [];

    const sessions =
      [...group.sessions]
        .sort(
          (a, b) =>
            Number(
              b.createdAt || 0
            ) -
            Number(
              a.createdAt || 0
            )
        );

    const activeId =
      db.activeSessionId;

    manager.innerHTML = `
      <div class="session-manager-header">

        <div>

          <div
            class="session-manager-eyebrow"
          >
            GROUPE PERMANENT
          </div>

          <h2>
            ${escHtml(group.name)}
          </h2>

          <p>
            ${sessions.length}
            évaluation${
              sessions.length > 1
                ? "s"
                : ""
            }
            enregistrée${
              sessions.length > 1
                ? "s"
                : ""
            }
          </p>

        </div>

        <div
          class="session-manager-actions"
        >

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
                  const status =
                    getStatus(session);

                  const locked =
                    status === "locked";

                  const isActive =
                    String(session.id) ===
                    String(activeId);

                  const students =
                    Array.isArray(
                      session.students
                    )
                      ? session.students.length
                      : 0;

                  return `
                    <details
                      class="
                        session-row
                        ${isActive ? "active" : ""}
                      "
                      data-session-id="${escHtml(session.id)}"
                    >
                      <summary class="session-summary">

                      <div class="session-main">

                        <div
                          class="session-title-line"
                        >

                          <strong>
                            ${
                              escHtml(
                                session.label ||
                                "Évaluation"
                              )
                            }
                          </strong>

                          ${
                            isActive
                              ? `
                                <span
                                  class="session-active-badge"
                                >
                                  Évaluation active
                                </span>
                              `
                              : ""
                          }

                        </div>

                        <div
                          class="session-meta"
                        >

                          <span>
                            ${
                              formatDate(
                                session.createdAt
                              )
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

                          <span
                            class="
                              session-status
                              status-${status}
                            "
                          >
                            ${
                              statusLabel(status)
                            }
                          </span>

                        </div>

                      </div>

                      </summary>

                      <div
                        class="session-controls"
                      >

                        <select
                          class="session-status-select"
                          data-session-id="${escHtml(session.id)}"
                          aria-label="État de l'évaluation"
                        >

                          <option
                            value="open"
                            ${
                              status === "open"
                                ? "selected"
                                : ""
                            }
                          >
                            En cours
                          </option>

                          <option
                            value="closed"
                            ${
                              status === "closed"
                                ? "selected"
                                : ""
                            }
                          >
                            Terminée
                          </option>

                          <option
                            value="locked"
                            ${
                              status === "locked"
                                ? "selected"
                                : ""
                            }
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
                          ${locked ? "disabled" : ""}
                        >
                          ${
                            locked
                              ? "Scan verrouillé"
                              : "Scanner"
                          }
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
                          ${locked ? "disabled" : ""}
                        >
                          Renommer
                        </button>

                        <button
                          type="button"
                          class="session-collapse"
                        >
                          Replier
                        </button>

                      </div>

                    </details>
                  `;
                })
                .join("")}

            </div>
          `
          : `
            <div
              class="session-empty"
            >

              <strong>
                Aucune évaluation
                pour ce groupe.
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
      .querySelectorAll(
        ".session-row"
      )
      .forEach(details => {
        details.addEventListener(
          "toggle",
          () => {
            if (details.open) {
              activateSessionInline(
                details.dataset.sessionId
              );
            } else if (
              String(
                db.activeSessionId
              ) ===
              String(
                details.dataset.sessionId
              )
            ) {
              const anyOpen =
                document.querySelector(
                  ".session-row[open]"
                );

              if (!anyOpen) {
                setStudentPanelVisible(
                  false
                );
              }
            }
          }
        );
      });

    document
      .querySelectorAll(
        "#newEvaluation"
      )
      .forEach(button => {
        button.onclick =
          createNewSession;
      });

    document
      .querySelectorAll(
        "#showArchives"
      )
      .forEach(button => {
        button.onclick =
          () => {
            const panel =
              document.getElementById(
                "groupArchivesPanel"
              );

            if (!panel) {
              return;
            }

            panel.classList.toggle(
              "hidden"
            );

            renderArchives();
          };
      });

    document
      .querySelectorAll(
        ".session-open"
      )
      .forEach(button => {
        button.onclick =
          () => {
            openSession(
              button.dataset.sessionId,
              "group"
            );
          };
      });

    document
      .querySelectorAll(
        ".session-scan"
      )
      .forEach(button => {
        button.onclick =
          () => {
            openSession(
              button.dataset.sessionId,
              "scan"
            );
          };
      });

    document
      .querySelectorAll(
        ".session-results"
      )
      .forEach(button => {
        button.onclick =
          () => {
            openSession(
              button.dataset.sessionId,
              "results"
            );
          };
      });

    document
      .querySelectorAll(
        ".session-rename"
      )
      .forEach(button => {
        button.onclick =
          () => {
            renameSession(
              button.dataset.sessionId
            );
          };
      });

    document
      .querySelectorAll(
        ".session-collapse"
      )
      .forEach(button => {
        button.onclick =
          event => {
            event.preventDefault();
            event.stopPropagation();

            const details =
              button.closest(
                ".session-row"
              );

            if (details) {
              details.open = false;
              setStudentPanelVisible(
                false
              );
            }
          };
      });

    document
      .querySelectorAll(
        ".session-status-select"
      )
      .forEach(select => {
        select.onchange =
          () => {
            changeSessionStatus(
              select.dataset.sessionId,
              select.value
            );
          };
      });
  }

  function renderArchives() {
    const panel =
      document.getElementById(
        "groupArchivesPanel"
      );

    if (!panel) {
      return;
    }

    const archived =
      (db.groups || [])
        .filter(
          group =>
            group.archived
        )
        .sort(
          (a, b) =>
            String(
              a.name || ""
            ).localeCompare(
              String(
                b.name || ""
              ),
              "fr",
              {
                sensitivity: "base"
              }
            )
        );

    panel.innerHTML = `
      <div class="archives-header">

        <div>

          <h2>
            Groupes archivés
          </h2>

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
                    Array.isArray(
                      group.sessions
                    )
                      ? group.sessions.length
                      : 0;

                  return `
                    <div
                      class="archive-row"
                    >

                      <div>

                        <strong>
                          ${
                            escHtml(
                              group.name
                            )
                          }
                        </strong>

                        <div
                          class="archive-meta"
                        >
                          ${sessions}
                          évaluation${
                            sessions > 1
                              ? "s"
                              : ""
                          }
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
            <div
              class="session-empty"
            >
              Aucun groupe archivé.
            </div>
          `
      }
    `;

    const close =
      document.getElementById(
        "closeArchives"
      );

    if (close) {
      close.onclick =
        () => {
          panel.classList.add(
            "hidden"
          );
        };
    }

    panel
      .querySelectorAll(
        ".restore-group"
      )
      .forEach(button => {
        button.onclick =
          () => {
            restoreGroup(
              button.dataset.groupId
            );

            panel.classList.add(
              "hidden"
            );
          };
      });
  }

  function applyLockState() {
    const session =
      activeSessionSafe();

    const locked =
      isLocked(session);

    const camera =
      document.getElementById(
        "camera"
      );

    const qrText =
      document.getElementById(
        "qrText"
      );

    const readText =
      document.getElementById(
        "readText"
      );

    if (camera) {
      camera.disabled = locked;
    }

    if (qrText) {
      qrText.disabled = locked;
    }

    if (readText) {
      readText.disabled = locked;
    }

    [
      "last",
      "first",
      "classroom",
      "sex",
      "p1",
      "p2",
      "addStudent"
    ].forEach(id => {
      const element =
        document.getElementById(id);

      if (element) {
        element.disabled =
          locked;
      }
    });

    /*
     * Éléments réellement modifiables.
     *
     * IMPORTANT :
     * .ccf-detail reste volontairement actif
     * afin de pouvoir consulter le détail
     * d'un élève même lorsque l'évaluation
     * est verrouillée.
     */
    document
      .querySelectorAll(
        [
          ".afl-allocation",
          ".afl-level",
          ".points",
          ".ccf-quick-allocation",
          ".ccf-quick-level"
        ].join(",")
      )
      .forEach(element => {
        element.disabled =
          locked;
      });

    let notice =
      document.getElementById(
        "lockedEvaluationNotice"
      );

    if (locked) {
      const results =
        document.getElementById(
          "results"
        );

      const card =
        results
          ?.querySelector(
            ".card"
          );

      if (
        card &&
        !notice
      ) {
        notice =
          document.createElement(
            "div"
          );

        notice.id =
          "lockedEvaluationNotice";

        notice.style.cssText =
          [
            "margin:0 0 14px",
            "padding:12px 14px",
            "border-radius:12px",
            "background:#f1f5f9",
            "border:1px solid #cbd5e1",
            "color:#334155",
            "font-weight:700"
          ].join(";");

        const h2 =
          card.querySelector(
            "h2"
          );

        if (h2) {
          h2.after(
            notice
          );
        } else {
          card.prepend(
            notice
          );
        }
      }

      if (notice) {
        notice.textContent =
          "🔒 Évaluation verrouillée — " +
          "consultation et exports uniquement.";
      }
    } else if (notice) {
      notice.remove();
    }
  }

  function installNavigationGuard() {
    document.addEventListener(
      "click",
      event => {
        const scanButton =
          event.target
            ?.closest?.(
              'nav button[data-page="scan"]'
            );

        if (
          !scanButton ||
          !isLocked()
        ) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        notifyLocked();
      },
      true
    );
  }

  function installEditGuard() {
    const editableSelector = [
      ".afl-allocation",
      ".afl-level",
      ".points",
      ".ccf-quick-allocation",
      ".ccf-quick-level",
      "#saveCCFDetail",
      "#addStudent",
      "#readText",
      "#camera"
    ].join(",");

    document.addEventListener(
      "click",
      event => {
        const target =
          event.target
            ?.closest?.(
              editableSelector
            );

        if (
          !target ||
          !isLocked()
        ) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        notifyLocked();
      },
      true
    );

    document.addEventListener(
      "change",
      event => {
        const target =
          event.target;

        if (
          !target ||
          !target.matches?.(
            [
              ".afl-allocation",
              ".afl-level",
              ".points",
              ".ccf-quick-allocation",
              ".ccf-quick-level"
            ].join(",")
          ) ||
          !isLocked()
        ) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        renderApp();
        notifyLocked();
      },
      true
    );
  }

  function installQRGuard() {
    if (
      typeof window.handleQR !==
      "function"
    ) {
      return;
    }

    if (
      window.handleQR
        .__lockedGuardInstalled
    ) {
      return;
    }

    originalHandleQR =
      window.handleQR;

    const guardedHandleQR =
      function(raw) {
        if (isLocked()) {
          if (
            typeof scanError ===
            "function"
          ) {
            scanError(
              "Évaluation verrouillée : " +
              "scan refusé."
            );
          } else {
            notifyLocked();
          }

          return;
        }

        return originalHandleQR(
          raw
        );
      };

    guardedHandleQR
      .__lockedGuardInstalled =
      true;

    window.handleQR =
      guardedHandleQR;
  }

  function install() {
    ensureInterface();

    if (
      typeof window.render ===
        "function" &&
      window.render !==
        renderApp
    ) {
      originalRender =
        window.render;

      window.render =
        renderApp;
    }

    installQRGuard();
    installNavigationGuard();
    installEditGuard();

    renderApp();
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
