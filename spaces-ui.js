(() => {
  "use strict";

  let internalRender = false;
  let observerTimer = null;

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
        g =>
          String(g.id) ===
          String(db.activeGroupId)
      ) || null;
    } catch {
      return null;
    }
  }

  function activeEvaluation() {
    const space =
      activeSpace();

    if (!space) {
      return null;
    }

    return (space.sessions || []).find(
      s =>
        String(s.id) ===
        String(db.activeSessionId)
    ) || null;
  }

  function countStudents(space) {
    const ids =
      new Set();

    (space.sessions || []).forEach(
      session => {
        (session.students || []).forEach(
          student => {
            ids.add(
              student.externalId ||
              student.id ||
              `${student.last}-${student.first}`
            );
          }
        );
      }
    );

    return ids.size;
  }

  function ensureContainer() {
    const page =
      document.getElementById(
        "group"
      );

    if (!page) {
      return null;
    }

    let box =
      document.getElementById(
        "spacesOverview"
      );

    if (!box) {
      box =
        document.createElement(
          "div"
        );

      box.id =
        "spacesOverview";

      box.className =
        "card";

      const toolbar =
        page.querySelector(
          ".toolbar"
        );

      if (toolbar) {
        toolbar.after(
          box
        );
      } else {
        page.prepend(
          box
        );
      }
    }

    return box;
  }

  function selectSpace(id) {
    const space =
      getGroups().find(
        item =>
          String(item.id) ===
          String(id)
      );

    if (!space) {
      return;
    }

    db.activeGroupId =
      space.id;

    const sessions = [
      ...(space.sessions || [])
    ].sort(
      (a, b) =>
        Number(
          b.createdAt || 0
        ) -
        Number(
          a.createdAt || 0
        )
    );

    db.activeSessionId =
      sessions[0]?.id || null;

    try {
      filter =
        "ALL";
    } catch {}

    if (
      typeof save ===
      "function"
    ) {
      save();
    }

    if (
      typeof render ===
      "function"
    ) {
      render();
    }

    setTimeout(
      renderSpaces,
      0
    );
  }

  function deleteActiveSpace() {
    const space =
      activeSpace();

    if (!space) {
      alert(
        "Aucun espace sélectionné."
      );
      return;
    }

    const evaluationCount =
      Array.isArray(
        space.sessions
      )
        ? space.sessions.length
        : 0;

    const studentCount =
      countStudents(
        space
      );

    const firstConfirm =
      confirm(
        `Supprimer définitivement l’espace "${space.name}" ?\n\n` +
        `${evaluationCount} évaluation(s)\n` +
        `${studentCount} élève(s)\n\n` +
        `Toutes les évaluations et tous les résultats de cet espace seront supprimés.\n\n` +
        `Cette action est irréversible.`
      );

    if (!firstConfirm) {
      return;
    }

    const secondConfirm =
      confirm(
        `CONFIRMATION FINALE\n\n` +
        `Tu vas supprimer définitivement :\n` +
        `"${space.name}"\n\n` +
        `Impossible de récupérer cet espace ensuite.\n\n` +
        `Confirmer la suppression ?`
      );

    if (!secondConfirm) {
      return;
    }

    const index =
      db.groups.findIndex(
        group =>
          String(group.id) ===
          String(space.id)
      );

    if (index === -1) {
      return;
    }

    db.groups.splice(
      index,
      1
    );

    const remaining =
      db.groups.filter(
        group =>
          !group.archived
      );

    if (
      remaining.length
    ) {
      const next =
        remaining[0];

      db.activeGroupId =
        next.id;

      const sessions = [
        ...(next.sessions || [])
      ].sort(
        (a, b) =>
          Number(
            b.createdAt || 0
          ) -
          Number(
            a.createdAt || 0
          )
      );

      db.activeSessionId =
        sessions[0]?.id || null;

    } else {

      db.activeGroupId =
        null;

      db.activeSessionId =
        null;
    }

    try {
      filter =
        "ALL";
    } catch {}

    if (
      typeof save ===
      "function"
    ) {
      save();
    }

    if (
      typeof render ===
      "function"
    ) {
      render();
    }

    setTimeout(
      renderSpaces,
      0
    );

    if (
      typeof toast ===
      "function"
    ) {
      toast(
        "Espace supprimé"
      );
    }
  }

  function ensureDeleteButton() {
    const toolbar =
      document.querySelector(
        "#group .toolbar"
      );

    if (!toolbar) {
      return;
    }

    let button =
      document.getElementById(
        "deleteSpace"
      );

    if (!button) {
      button =
        document.createElement(
          "button"
        );

      button.id =
        "deleteSpace";

      button.type =
        "button";

      button.textContent =
        "Supprimer l’espace";

      button.style.background =
        "#b91c1c";

      button.style.color =
        "#ffffff";

      button.style.borderColor =
        "#991b1b";

      button.style.fontWeight =
        "800";

      toolbar.appendChild(
        button
      );
    }

    button.disabled =
      !activeSpace();

    button.onclick =
      deleteActiveSpace;
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
        <strong>
          Aucun espace sélectionné
        </strong>

        <span>
          Crée ou ouvre un espace avant de scanner.
        </span>
      `;

      return;
    }

    host.innerHTML = `
      <strong>
        Espace :
        ${esc(space.name)}
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
      document.getElementById(
        "scan"
      );

    if (!scanPage) {
      return;
    }

    let banner =
      document.getElementById(
        "activeContextBanner"
      );

    if (!banner) {
      banner =
        document.createElement(
          "div"
        );

      banner.id =
        "activeContextBanner";

      banner.className =
        "card active-context-banner";

      scanPage.prepend(
        banner
      );
    }
  }

  function styleArchiveButton() {
    const archiveButton =
      document.getElementById(
        "archive"
      );

    if (!archiveButton) {
      return;
    }

    archiveButton.style.background =
      "#f59e0b";

    archiveButton.style.color =
      "#ffffff";

    archiveButton.style.borderColor =
      "#d97706";

    archiveButton.style.fontWeight =
      "800";
  }

  function renderSpaces() {
    if (internalRender) {
      return;
    }

    const box =
      ensureContainer();

    if (!box) {
      return;
    }

    internalRender =
      true;

    try {

      ensureDeleteButton();
      ensureContextBanner();
      styleArchiveButton();

      const spaces =
        getGroups().filter(
          group =>
            !group.archived
        );

      const activeId =
        String(
          db?.activeGroupId ||
          ""
        );

      box.innerHTML = `
        <div
          class="spaces-overview-head"
        >

          <div>

            <div
              class="session-manager-eyebrow"
            >
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
              <div
                class="spaces-grid"
              >

                ${spaces.map(
                  space => {

                    const sessions =
                      Array.isArray(
                        space.sessions
                      )
                        ? space.sessions
                        : [];

                    const isActive =
                      String(
                        space.id
                      ) === activeId;

                    const students =
                      countStudents(
                        space
                      );

                    return `
                      <button
                        type="button"
                        class="
                          space-card
                          ${
                            isActive
                              ? "active"
                              : ""
                          }
                        "
                        data-space-id="${esc(
                          space.id
                        )}"
                      >

                        <strong>
                          ${esc(
                            space.name
                          )}
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
                  }
                ).join("")}

              </div>
            `
            : `
              <div
                class="empty"
              >
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
        .forEach(
          button => {
            button.onclick =
              () => {
                selectSpace(
                  button.dataset.spaceId
                );
              };
          }
        );

      document
        .querySelectorAll(
          ".session-manager-eyebrow"
        )
        .forEach(
          el => {
            if (
              el.textContent
                .trim()
                .toUpperCase() ===
              "GROUPE PERMANENT"
            ) {
              el.textContent =
                "ESPACE";
            }
          }
        );

      renderContext();

    } finally {

      requestAnimationFrame(
        () => {
          internalRender =
            false;
        }
      );
    }
  }

  const observer =
    new MutationObserver(
      () => {

        if (
          internalRender
        ) {
          return;
        }

        clearTimeout(
          observerTimer
        );

        observerTimer =
          setTimeout(
            () => {
              renderSpaces();
            },
            80
          );
      }
    );

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
      () => {
        renderSpaces();
      }
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
