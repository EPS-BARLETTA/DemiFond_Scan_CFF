(() => {

  const BACKUP_COUNT = 3;

  const BACKUP_PREFIX =
    `${KEY}-auto-backup-`;

  const BACKUP_DATE_PREFIX =
    `${KEY}-auto-backup-date-`;

  const BEFORE_IMPORT_KEY =
    `${KEY}-before-import`;

  const BEFORE_IMPORT_DATE_KEY =
    `${KEY}-before-import-date`;


  /* ========================================
     OUTILS
  ======================================== */

  function clone(value) {
    return JSON.parse(
      JSON.stringify(value)
    );
  }


  function validDatabase(data) {
    return (
      data &&
      typeof data === "object" &&
      Array.isArray(data.groups)
    );
  }


  function studentKey(student) {
    return String(
      student?.externalId ||
      student?.id ||
      `${student?.last || ""}|${student?.first || ""}|${student?.classroom || ""}`
    );
  }


  function safeDate(timestamp) {
    if (!timestamp) {
      return "date inconnue";
    }

    try {
      return new Date(
        Number(timestamp)
      ).toLocaleString(
        "fr-FR"
      );
    } catch {
      return "date inconnue";
    }
  }


  /* ========================================
     ROTATION DES SAUVEGARDES
  ======================================== */

  function rotateBackups(
    currentRaw
  ) {

    if (!currentRaw) {
      return;
    }

    try {

      for (
        let i = BACKUP_COUNT;
        i >= 2;
        i--
      ) {

        const previousRaw =
          localStorage.getItem(
            BACKUP_PREFIX +
            (i - 1)
          );

        const previousDate =
          localStorage.getItem(
            BACKUP_DATE_PREFIX +
            (i - 1)
          );

        if (previousRaw) {
          localStorage.setItem(
            BACKUP_PREFIX + i,
            previousRaw
          );
        }

        if (previousDate) {
          localStorage.setItem(
            BACKUP_DATE_PREFIX + i,
            previousDate
          );
        }
      }


      localStorage.setItem(
        BACKUP_PREFIX + "1",
        currentRaw
      );

      localStorage.setItem(
        BACKUP_DATE_PREFIX + "1",
        String(Date.now())
      );

    } catch (error) {

      console.warn(
        "Sauvegarde automatique impossible :",
        error
      );

    }
  }


  /* ========================================
     NOUVELLE FONCTION SAVE
  ======================================== */

  function secureSave() {

    const nextRaw =
      JSON.stringify(db);

    const currentRaw =
      localStorage.getItem(KEY);


    /*
      On crée une version de secours
      uniquement si la base a réellement changé.
    */

    if (
      currentRaw &&
      currentRaw !== nextRaw
    ) {
      rotateBackups(
        currentRaw
      );
    }


    try {

      localStorage.setItem(
        KEY,
        nextRaw
      );

      localStorage.setItem(
        `${KEY}-last-save`,
        String(Date.now())
      );

    } catch (error) {

      console.error(
        "Erreur sauvegarde locale :",
        error
      );

      alert(
        "Impossible d’enregistrer les données sur cet appareil."
      );
    }
  }


  /* ========================================
     FUSION DES ÉLÈVES
  ======================================== */

  function mergeStudent(
    current,
    incoming
  ) {

    const result = {
      ...clone(incoming),
      ...clone(current)
    };


    result.races = {
      ...(incoming.races || {}),
      ...(current.races || {})
    };


    /*
      Si une information manque dans
      la version actuelle, on récupère
      celle de la sauvegarde.
    */

    [
      "last",
      "first",
      "classroom",
      "sex",
      "project1",
      "project2",
      "afl2",
      "afl3"
    ].forEach(field => {

      if (
        result[field] === "" ||
        result[field] == null
      ) {

        result[field] =
          incoming[field] ?? "";

      }

    });


    return result;
  }


  function mergeStudents(
    currentStudents = [],
    incomingStudents = []
  ) {

    const map =
      new Map();


    currentStudents.forEach(
      student => {

        map.set(
          studentKey(student),
          clone(student)
        );

      }
    );


    incomingStudents.forEach(
      student => {

        const key =
          studentKey(student);

        if (!map.has(key)) {

          map.set(
            key,
            clone(student)
          );

          return;
        }


        map.set(
          key,
          mergeStudent(
            map.get(key),
            student
          )
        );

      }
    );


    return Array.from(
      map.values()
    );
  }


  /* ========================================
     FUSION DES ÉVALUATIONS
  ======================================== */

  function mergeSessions(
    currentSessions = [],
    incomingSessions = []
  ) {

    const map =
      new Map();


    currentSessions.forEach(
      session => {

        map.set(
          String(session.id),
          clone(session)
        );

      }
    );


    incomingSessions.forEach(
      incoming => {

        const key =
          String(incoming.id);


        if (!map.has(key)) {

          map.set(
            key,
            clone(incoming)
          );

          return;
        }


        const current =
          map.get(key);


        map.set(
          key,
          {
            ...clone(incoming),
            ...clone(current),

            students:
              mergeStudents(
                current.students || [],
                incoming.students || []
              )
          }
        );

      }
    );


    return Array.from(
      map.values()
    );
  }


  /* ========================================
     FUSION DES ESPACES
  ======================================== */

  function mergeGroups(
    currentGroups = [],
    incomingGroups = []
  ) {

    const map =
      new Map();


    currentGroups.forEach(
      group => {

        map.set(
          String(group.id),
          clone(group)
        );

      }
    );


    incomingGroups.forEach(
      incoming => {

        const key =
          String(incoming.id);


        /*
          Espace absent :
          on récupère tout l’espace.
        */

        if (!map.has(key)) {

          map.set(
            key,
            clone(incoming)
          );

          return;
        }


        const current =
          map.get(key);


        map.set(
          key,
          {
            ...clone(incoming),
            ...clone(current),

            students:
              mergeStudents(
                current.students || [],
                incoming.students || []
              ),

            sessions:
              mergeSessions(
                current.sessions || [],
                incoming.sessions || []
              )
          }
        );

      }
    );


    return Array.from(
      map.values()
    );
  }


  /* ========================================
     FUSION HISTORIQUE
  ======================================== */

  function mergeHistory(
    current = [],
    incoming = []
  ) {

    const seen =
      new Set();

    const result =
      [];


    [
      ...current,
      ...incoming
    ].forEach(item => {

      const key =
        JSON.stringify(item);

      if (
        seen.has(key)
      ) {
        return;
      }

      seen.add(key);

      result.push(
        clone(item)
      );

    });


    return result;
  }


  /* ========================================
     FUSION COMPLÈTE
  ======================================== */

  function mergeDatabases(
    current,
    incoming
  ) {

    return normalizeDB({

      groups:
        mergeGroups(
          current.groups || [],
          incoming.groups || []
        ),

      activeGroupId:
        current.activeGroupId ||
        incoming.activeGroupId ||
        null,

      activeSessionId:
        current.activeSessionId ||
        incoming.activeSessionId ||
        null,

      history:
        mergeHistory(
          current.history || [],
          incoming.history || []
        )

    });
  }


  /* ========================================
     IMPORT SÉCURISÉ
  ======================================== */

  async function secureRestoreBackup(
    file
  ) {

    try {

      const content =
        await file.text();

      const parsed =
        JSON.parse(content);


      if (
        !validDatabase(parsed)
      ) {

        throw new Error(
          "Format invalide"
        );

      }


      const incoming =
        normalizeDB(parsed);


      /*
        On conserve toujours la base actuelle
        avant toute opération d’import.
      */

      const currentRaw =
        localStorage.getItem(KEY);

      if (currentRaw) {

        localStorage.setItem(
          BEFORE_IMPORT_KEY,
          currentRaw
        );

        localStorage.setItem(
          BEFORE_IMPORT_DATE_KEY,
          String(Date.now())
        );

      }


      const currentGroups =
        Array.isArray(db.groups)
          ? db.groups.length
          : 0;

      const importedGroups =
        Array.isArray(incoming.groups)
          ? incoming.groups.length
          : 0;


      const ok =
        confirm(
          "IMPORT SÉCURISÉ\n\n" +

          `Base actuelle : ${currentGroups} espace(s)\n` +
          `Sauvegarde importée : ${importedGroups} espace(s)\n\n` +

          "Les données importées vont être FUSIONNÉES avec les données actuelles.\n\n" +

          "Aucun espace actuellement enregistré ne sera supprimé.\n\n" +

          "Continuer ?"
        );


      if (!ok) {
        return;
      }


      db =
        mergeDatabases(
          db,
          incoming
        );


      secureSave();

      render();


      if (
        typeof toast ===
        "function"
      ) {

        toast(
          "Sauvegarde fusionnée"
        );

      }


    } catch (error) {

      console.error(
        error
      );

      alert(
        "Sauvegarde invalide ou impossible à importer."
      );

    }
  }


  /* ========================================
     RÉCUPÉRATION AUTOMATIQUE
  ======================================== */

  function availableBackups() {

    const list =
      [];


    for (
      let i = 1;
      i <= BACKUP_COUNT;
      i++
    ) {

      const raw =
        localStorage.getItem(
          BACKUP_PREFIX + i
        );

      if (!raw) {
        continue;
      }


      list.push({

        slot: i,

        raw,

        date:
          localStorage.getItem(
            BACKUP_DATE_PREFIX + i
          )

      });

    }


    const beforeImport =
      localStorage.getItem(
        BEFORE_IMPORT_KEY
      );


    if (beforeImport) {

      list.push({

        slot:
          "import",

        raw:
          beforeImport,

        date:
          localStorage.getItem(
            BEFORE_IMPORT_DATE_KEY
          ),

        beforeImport:
          true

      });

    }


    return list;
  }


  function recoverBackup() {

    const backups =
      availableBackups();


    if (!backups.length) {

      alert(
        "Aucune sauvegarde automatique disponible pour le moment."
      );

      return;
    }


    const text =
      backups
        .map(
          (backup, index) => {

            const label =
              backup.beforeImport
                ? "Avant le dernier import"
                : `Sauvegarde automatique ${backup.slot}`;

            return (
              `${index + 1}. ` +
              `${label}\n` +
              `${safeDate(backup.date)}`
            );

          }
        )
        .join(
          "\n\n"
        );


    const choice =
      prompt(
        "RÉCUPÉRATION\n\n" +
        text +
        "\n\n" +
        "Indique le numéro de la version à restaurer :",
        "1"
      );


    if (
      choice == null
    ) {
      return;
    }


    const selected =
      backups[
        Number(choice) - 1
      ];


    if (!selected) {

      alert(
        "Numéro de sauvegarde invalide."
      );

      return;
    }


    let recovered;

    try {

      recovered =
        normalizeDB(
          JSON.parse(
            selected.raw
          )
        );

    } catch {

      alert(
        "Cette sauvegarde est endommagée."
      );

      return;
    }


    const ok =
      confirm(
        "Restaurer cette version ?\n\n" +
        `${safeDate(selected.date)}\n\n` +
        "La base actuelle sera conservée comme sauvegarde de secours avant restauration."
      );


    if (!ok) {
      return;
    }


    /*
      On garde d’abord la situation actuelle.
    */

    const currentRaw =
      localStorage.getItem(KEY);

    if (currentRaw) {

      rotateBackups(
        currentRaw
      );

    }


    db =
      recovered;


    localStorage.setItem(
      KEY,
      JSON.stringify(db)
    );


    render();


    if (
      typeof toast ===
      "function"
    ) {

      toast(
        "Version restaurée"
      );

    }

  }


  /* ========================================
     BOUTON RÉCUPÉRATION
  ======================================== */

  function createRecoveryButton() {

    if (
      document.getElementById(
        "recoveryBackup"
      )
    ) {
      return;
    }


    const actions =
      document.querySelector(
        "header > div:last-child"
      );


    if (!actions) {
      return;
    }


    const button =
      document.createElement(
        "button"
      );


    button.id =
      "recoveryBackup";

    button.type =
      "button";

    button.textContent =
      "↶ Récupération";

    button.onclick =
      recoverBackup;


    actions.appendChild(
      button
    );
  }


  /* ========================================
     ACTIVATION
  ======================================== */

  /*
    On remplace uniquement les fonctions
    de stockage existantes.
    Le reste de app.js reste intact.
  */

  save =
    secureSave;

  restoreBackup =
    secureRestoreBackup;


  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      createRecoveryButton
    );

  } else {

    createRecoveryButton();

  }

})();
