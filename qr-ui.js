(() => {
  "use strict";

  /*
   * DemiFond Scan CCF
   *
   * Ce module conserve uniquement la construction
   * du payload d'identité élève.
   *
   * La génération graphique d'un QR n'est plus utilisée
   * dans le workflow principal de DemiFond Scan CCF.
   *
   * Cela évite de dépendre d'une bibliothèque QR externe
   * qui n'est plus chargée dans index.html.
   */

  function buildIdentityPayload(group, student) {
    if (!group || !student) {
      return null;
    }

    const studentId =
      student.externalId ||
      student.id ||
      "";

    return JSON.stringify({
      type: "DF_CCF_IDENTITY",
      v: 1,

      sessionId:
        group.sessionId ||
        group.id ||
        "",

      groupId:
        group.id ||
        "",

      studentId,

      last:
        student.last ||
        "",

      first:
        student.first ||
        "",

      classroom:
        student.classroom ||
        "",

      sex:
        student.sex ||
        "",

      project1:
        student.project1 ||
        "",

      project2:
        student.project2 ||
        ""
    });
  }

  window.DFQR = {

    identity(group, student) {
      return buildIdentityPayload(
        group,
        student
      );
    },

    show(group, student) {
      const raw =
        buildIdentityPayload(
          group,
          student
        );

      if (!raw) {
        alert(
          "Impossible de préparer les données de cet élève."
        );

        return null;
      }

      let dialog =
        document.getElementById(
          "studentQR"
        );

      if (!dialog) {
        dialog =
          document.createElement(
            "dialog"
          );

        dialog.id =
          "studentQR";

        dialog.innerHTML = `
          <div
            style="
              background:white;
              padding:22px;
              border-radius:20px;
              text-align:center;
              max-width:520px
            "
          >

            <h2 id="studentQRName"></h2>

            <p
              id="studentQRMeta"
              style="
                color:#64748b
              "
            ></p>

            <div
              style="
                margin:18px 0;
                padding:16px;
                border-radius:14px;
                background:#f8fafc;
                border:1px solid #e2e8f0
              "
            >

              <strong>
                Génération QR non utilisée
              </strong>

              <p
                style="
                  margin-bottom:0
                "
              >
                DemiFond Scan CCF récupère désormais
                les résultats directement depuis
                les QR générés par Chrono Carnet EPS.
              </p>

            </div>

            <details
              style="
                text-align:left;
                margin:14px 0
              "
            >

              <summary>
                Voir les données d'identité
              </summary>

              <textarea
                id="studentQRRaw"
                readonly
                style="
                  width:100%;
                  min-height:130px;
                  margin-top:10px
                "
              ></textarea>

            </details>

            <button
              id="studentQRClose"
              type="button"
            >
              Fermer
            </button>

          </div>
        `;

        document.body
          .appendChild(
            dialog
          );

        document
          .getElementById(
            "studentQRClose"
          )
          .onclick =
          () =>
            dialog.close();
      }

      document
        .getElementById(
          "studentQRName"
        )
        .textContent =
        (
          `${student.last || ""} ` +
          `${student.first || ""}`
        )
          .trim()
          .toUpperCase();

      document
        .getElementById(
          "studentQRMeta"
        )
        .textContent =
        `${student.classroom || ""}` +
        ` · Projet 1 ${
          student.project1 || "—"
        }` +
        ` · Projet 2 ${
          student.project2 || "—"
        }`;

      const rawBox =
        document.getElementById(
          "studentQRRaw"
        );

      if (rawBox) {
        rawBox.value =
          raw;
      }

      dialog.showModal();

      return raw;
    }

  };

})();
