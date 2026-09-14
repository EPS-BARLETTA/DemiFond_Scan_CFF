(() => {
  "use strict";

  const EXPECTED_TYPE =
    "DF_CCF_RESULT";

  const EXPECTED_VERSION =
    1;


  function reject(message) {

    const text =
      `QR refusé : ${message}`;

    if (
      typeof scanError ===
      "function"
    ) {

      scanError(text);

    } else {

      alert(text);

    }

    console.warn(
      "[QR VALIDATION]",
      text
    );

    return false;
  }


  function isNonEmptyString(
    value
  ) {

    return (
      typeof value ===
        "string" &&
      value.trim().length >
        0
    );
  }


  function validNumber(
    value
  ) {

    const number =
      Number(value);

    return (
      Number.isFinite(
        number
      ) &&
      number > 0
    );
  }


  function validateSplits(
    splits,
    totalMs
  ) {

    if (
      !Array.isArray(
        splits
      )
    ) {

      return {
        ok: false,
        message:
          "temps intermédiaires absents."
      };
    }


    if (
      splits.length !==
      4
    ) {

      return {
        ok: false,
        message:
          "le QR doit contenir exactement 4 passages."
      };
    }


    const values =
      splits.map(Number);


    if (
      values.some(
        value =>
          !Number.isFinite(
            value
          ) ||
          value <= 0
      )
    ) {

      return {
        ok: false,
        message:
          "un des temps intermédiaires est invalide."
      };
    }


    for (
      let i = 1;
      i < values.length;
      i++
    ) {

      if (
        values[i] <=
        values[i - 1]
      ) {

        return {
          ok: false,
          message:
            "les temps intermédiaires ne sont pas croissants."
        };
      }
    }


    const finalSplit =
      values[
        values.length - 1
      ];


    /*
      Le dernier temps cumulé doit
      correspondre au temps total.

      Tolérance : 2 secondes.
    */

    if (
      Math.abs(
        finalSplit -
        Number(totalMs)
      ) >
      2000
    ) {

      return {
        ok: false,
        message:
          "le temps total ne correspond pas au dernier passage."
      };
    }


    return {
      ok: true,
      values
    };
  }


  function validatePayload(
    data
  ) {

    if (
      !data ||
      typeof data !==
        "object" ||
      Array.isArray(data)
    ) {

      return {
        ok: false,
        message:
          "format de données inconnu."
      };
    }


    if (
      data.type !==
      EXPECTED_TYPE
    ) {

      return {
        ok: false,
        message:
          "ce QR n'est pas un résultat DemiFond CCF."
      };
    }


    if (
      Number(
        data.v
      ) !==
      EXPECTED_VERSION
    ) {

      return {
        ok: false,
        message:
          "version de QR incompatible."
      };
    }


    if (
      !isNonEmptyString(
        data.studentId
      )
    ) {

      return {
        ok: false,
        message:
          "identifiant élève absent."
      };
    }


    if (
      !isNonEmptyString(
        data.last
      ) ||
      !isNonEmptyString(
        data.first
      )
    ) {

      return {
        ok: false,
        message:
          "nom ou prénom absent."
      };
    }


    if (
      !isNonEmptyString(
        data.classroom
      )
    ) {

      return {
        ok: false,
        message:
          "classe absente."
      };
    }


    if (
      ![
        "F",
        "M"
      ].includes(
        String(
          data.sex
        ).toUpperCase()
      )
    ) {

      return {
        ok: false,
        message:
          "sexe F/M absent ou invalide."
      };
    }


    const race =
      Number(
        data.race
      );


    if (
      ![
        1,
        2
      ].includes(
        race
      )
    ) {

      return {
        ok: false,
        message:
          "numéro de course invalide."
      };
    }


    if (
      !validNumber(
        data.totalMs
      )
    ) {

      return {
        ok: false,
        message:
          "temps total invalide."
      };
    }


    const totalMs =
      Number(
        data.totalMs
      );


    const splitCheck =
      validateSplits(
        data.splits,
        totalMs
      );


    if (
      !splitCheck.ok
    ) {

      return splitCheck;
    }


    return {

      ok: true,

      data: {

        ...data,

        race,

        totalMs,

        splits:
          splitCheck.values,

        sex:
          String(
            data.sex
          ).toUpperCase(),

        classroom:
          String(
            data.classroom
          )
            .trim()
            .toUpperCase()
      }
    };
  }


  function install() {

    if (
      typeof window.handleQR !==
        "function"
    ) {

      console.error(
        "[QR VALIDATION] handleQR introuvable."
      );

      return;
    }


    if (
      window.handleQR
        .__strictQrValidation
    ) {

      return;
    }


    const originalHandleQR =
      window.handleQR;


    function validatedHandleQR(
      raw
    ) {

      let data;


      try {

        data =
          typeof raw ===
            "string"
            ? JSON.parse(raw)
            : raw;

      } catch {

        return reject(
          "contenu illisible ou JSON invalide."
        );
      }


      const result =
        validatePayload(data);


      if (
        !result.ok
      ) {

        return reject(
          result.message
        );
      }


      return originalHandleQR(
        result.data
      );
    }


    validatedHandleQR
      .__strictQrValidation =
        true;


    window.handleQR =
      validatedHandleQR;


    console.info(
      "[QR VALIDATION] Protection active."
    );
  }


  install();

})();
