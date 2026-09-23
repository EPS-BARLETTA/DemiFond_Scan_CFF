(() => {
  "use strict";

  function ensureArray(value) {
    return Array.isArray(value)
      ? value
      : [];
  }

  function handleTraining(data) {
    if (
      !data ||
      data.type !==
        "DF_TRAINING_RESULT"
    ) {
      return false;
    }

    let group =
      activeGroup();

    let session =
      activeSession();

    if (
      !group ||
      !session
    ) {
      const ok =
        prepareScanner();

      if (!ok) {
        return true;
      }

      group =
        activeGroup();

      session =
        activeSession();
    }

    if (
      session.status ===
        "locked"
    ) {
      scanError(
        "Évaluation verrouillée : scan refusé."
      );

      return true;
    }

    let student =
      findStudent(
        session,
        data.studentId
      );

    if (!student) {
      student =
        buildStudent(
          data
        );

      session.students.push(
        student
      );
    }

    updateIdentity(
      student,
      data
    );

    student.trainingResults =
      ensureArray(
        student.trainingResults
      );

    const result = {
      id:
        data.resultId ||
        (
          data.studentId +
          "-" +
          Date.now()
        ),

      tool:
        data.tool ||
        "unknown",

      totalMs:
        Number(
          data.totalMs
        ) ||
        null,

      durationMs:
        Number(
          data.durationMs
        ) ||
        null,

      trackDistance:
        Number(
          data.trackDistance
        ) ||
        null,

      laps:
        Number(
          data.laps
        ) ||
        null,

      partialDistance:
        Number(
          data.partialDistance
        ) ||
        null,

      totalDistance:
        Number(
          data.totalDistance
        ) ||
        null,

      speed:
        Number(
          data.speed
        ) ||
        null,

      vma:
        data.vma == null
          ? null
          : Number(
              data.vma
            ),

      createdAt:
        data.createdAt ||
        new Date()
          .toISOString()
    };

    const existing =
      student
        .trainingResults
        .findIndex(
          x =>
            x.id ===
              result.id
        );

    if (existing >= 0) {
      student
        .trainingResults[
          existing
        ] =
          result;
    } else {
      student
        .trainingResults
        .push(
          result
        );
    }

    session.type =
      session.type ||
      "training";

    updateMasterStudent(
      group,
      student
    );

    db.history.unshift({
      at:
        Date.now(),
      groupId:
        group.id,
      sessionId:
        session.id,
      studentId:
        student.id,
      type:
        "training",
      tool:
        result.tool
    });

    save();
    beep();

    const message =
      document
        .getElementById(
          "scanMessage"
        );

    if (message) {
      message.className =
        "scan-ok";

      const detail =
        result.tool ===
          "simple"
          ? time(
              result.totalMs
            )
          : result.totalDistance
            ? result.totalDistance +
              " m"
            : "Résultat reçu";

      message.innerHTML =
        "✓ " +
        esc(
          String(
            student.last ||
            ""
          ).toUpperCase()
        ) +
        " " +
        esc(
          student.first ||
          ""
        ) +
        "<br>" +
        esc(
          student.classroom ||
          ""
        ) +
        " · " +
        esc(
          result.tool
        ) +
        " · " +
        esc(
          detail
        );
    }

    toast?.(
      "Résultat d’entraînement enregistré"
    );

    if (
      typeof render ===
        "function"
    ) {
      render();
    }

    return true;
  }

  function install() {
    if (
      typeof window.handleQR !==
        "function" ||
      window.handleQR
        .__trainingBridge
    ) {
      return;
    }

    const original =
      window.handleQR;

    const wrapped =
      function(raw) {
        let data =
          raw;

        try {
          if (
            typeof raw ===
              "string"
          ) {
            data =
              JSON.parse(
                raw
              );
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

  if (
    document.readyState ===
      "loading"
  ) {
    document
      .addEventListener(
        "DOMContentLoaded",
        install
      );
  } else {
    install();
  }
})();