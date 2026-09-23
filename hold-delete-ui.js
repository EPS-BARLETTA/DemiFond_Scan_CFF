(() => {
  "use strict";

  const HOLD_MS = 800;

  function holdToConfirm(button, onConfirm) {
    if (!button || button.dataset.holdDeleteBound === "1") return;

    button.dataset.holdDeleteBound = "1";

    let timer = null;
    let done = false;

    const clear = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (!done) {
        button.classList.remove("holding-delete");
      }
    };

    const start = event => {
      if (event.type === "mousedown" && event.button !== 0) return;

      done = false;
      button.classList.add("holding-delete");

      timer = setTimeout(() => {
        done = true;
        button.classList.remove("holding-delete");
        navigator.vibrate?.(80);
        onConfirm();
      }, HOLD_MS);
    };

    ["pointerdown","touchstart","mousedown"].forEach(type => {
      button.addEventListener(type, start, {passive:true});
    });

    ["pointerup","pointercancel","touchend","touchcancel","mouseup","mouseleave"].forEach(type => {
      button.addEventListener(type, clear, {passive:true});
    });

    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();

      if (!done) {
        toast?.("Maintiens le bouton 1 seconde pour supprimer.");
      }

      done = false;
    });
  }

  function deleteSession(sessionId) {
    const group =
      typeof activeGroup === "function"
        ? activeGroup()
        : null;

    if (!group) return;

    const index =
      (group.sessions || []).findIndex(
        session => String(session.id) === String(sessionId)
      );

    if (index < 0) return;

    const session = group.sessions[index];
    const name = session.label || "Évaluation";

    if (!confirm(
      'Supprimer définitivement l’évaluation "' + name + '" ?\n\n' +
      'Tous les élèves et résultats de cette évaluation seront supprimés.'
    )) return;

    group.sessions.splice(index, 1);

    db.history =
      (db.history || []).filter(
        item => String(item.sessionId || "") !== String(sessionId)
      );

    if (String(db.activeSessionId) === String(sessionId)) {
      db.activeSessionId =
        group.sessions?.[0]?.id || null;
    }

    save();
    render();

    toast?.("Évaluation supprimée");
  }

  function deleteStudent(studentId) {
    const group =
      typeof activeGroup === "function"
        ? activeGroup()
        : null;

    const session =
      typeof activeSession === "function"
        ? activeSession()
        : null;

    if (!group || !session) return;

    const index =
      (session.students || []).findIndex(
        student =>
          String(student.id) === String(studentId) ||
          String(student.externalId) === String(studentId)
      );

    if (index < 0) return;

    const student = session.students[index];
    const label =
      ((student.last || "") + " " + (student.first || "")).trim() ||
      "cet élève";

    if (!confirm(
      "Supprimer " + label + " de cette évaluation ?\n\n" +
      "Ses résultats dans cette évaluation seront supprimés."
    )) return;

    session.students.splice(index, 1);

    db.history =
      (db.history || []).filter(
        item =>
          !(
            String(item.sessionId || "") === String(session.id) &&
            (
              String(item.studentId || "") === String(student.id) ||
              String(item.studentId || "") === String(student.externalId)
            )
          )
      );

    const stillUsed =
      (group.sessions || []).some(
        s =>
          (s.students || []).some(
            item =>
              String(item.id) === String(student.id) ||
              String(item.externalId) === String(student.externalId)
          )
      );

    if (!stillUsed && Array.isArray(group.students)) {
      group.students =
        group.students.filter(
          item =>
            !(
              String(item.id) === String(student.id) ||
              String(item.externalId) === String(student.externalId)
            )
        );
    }

    save();
    render();

    toast?.("Élève supprimé de l’évaluation");
  }

  function bind() {
    document
      .querySelectorAll(".session-delete-hold")
      .forEach(button => {
        holdToConfirm(
          button,
          () => deleteSession(button.dataset.sessionId)
        );
      });

    document
      .querySelectorAll(".student-delete-hold")
      .forEach(button => {
        holdToConfirm(
          button,
          () => deleteStudent(button.dataset.studentId)
        );
      });
  }

  const observer =
    new MutationObserver(
      () => bind()
    );

  function init() {
    bind();

    observer.observe(
      document.body,
      {
        childList: true,
        subtree: true
      }
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();