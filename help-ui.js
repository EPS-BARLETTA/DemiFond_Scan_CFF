(() => {
  "use strict";

  function makeButton() {
    const headerActions =
      document.querySelector(
        "header > div:last-child"
      );

    if (!headerActions) {
      return;
    }

    if (
      document.getElementById(
        "helpButton"
      )
    ) {
      return;
    }

    const button =
      document.createElement(
        "button"
      );

    button.id =
      "helpButton";

    button.type =
      "button";

    button.className =
      "help-trigger";

    button.innerHTML =
      "❓ Mode d’emploi";

    button.onclick =
      openHelp;

    headerActions.prepend(
      button
    );
  }


  function helpContent() {
    return `
      <div
        class="help-overlay"
        id="helpOverlay"
      >

        <div
          class="help-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="helpTitle"
        >

          <div
            class="help-head"
          >

            <div>

              <h2
                id="helpTitle"
              >
                Mode d’emploi
              </h2>

              <p>
                DemiFond Scan CCF
              </p>

            </div>


            <button
              type="button"
              class="help-close"
              id="helpClose"
              aria-label="Fermer"
            >
              ×
            </button>

          </div>


          <div
            class="help-content"
          >

            <div
              class="help-note"
            >
              <strong>
                Sauvegarde automatique
              </strong>
              <br>
              Les données sont enregistrées
              automatiquement sur cet appareil.
              Il n’est pas nécessaire de télécharger
              une sauvegarde après chaque séance.
            </div>


            <div
              class="help-step"
            >

              <div
                class="help-number"
              >
                1
              </div>

              <div>

                <h3>
                  Créer un espace
                </h3>

                <p>
                  Dans
                  <strong>
                    Mes espaces
                  </strong>,
                  utilise
                  <strong>
                    + Nouvel espace
                  </strong>.
                  Le nom est totalement libre :
                  classe, groupe, créneau horaire,
                  groupe CCF, etc.
                </p>

                <p>
                  Exemple :
                  <strong>
                    Terminales ABCDE lundi 14h
                  </strong>
                </p>

              </div>

            </div>


            <div
              class="help-step"
            >

              <div
                class="help-number"
              >
                2
              </div>

              <div>

                <h3>
                  Créer une évaluation
                </h3>

                <p>
                  Ouvre l’espace concerné puis
                  utilise
                  <strong>
                    + Nouvelle évaluation
                  </strong>.
                </p>

                <p>
                  Exemple :
                  <strong>
                    CCF blanc
                  </strong>,
                  <strong>
                    CCF final
                  </strong>,
                  <strong>
                    Rattrapage
                  </strong>.
                </p>

                <p>
                  Chaque évaluation possède
                  ses propres élèves et
                  ses propres résultats.
                </p>

              </div>

            </div>


            <div
              class="help-step"
            >

              <div
                class="help-number"
              >
                3
              </div>

              <div>

                <h3>
                  Vérifier l’évaluation active
                </h3>

                <p>
                  Avant de scanner,
                  vérifie toujours le bandeau
                  affichant :
                </p>

                <p>
                  <strong>
                    Espace
                  </strong>
                  +
                  <strong>
                    Évaluation
                  </strong>.
                </p>

                <p>
                  Tous les scans suivants
                  seront enregistrés dans
                  cette évaluation.
                </p>

              </div>

            </div>


            <div
              class="help-step"
            >

              <div
                class="help-number"
              >
                4
              </div>

              <div>

                <h3>
                  Scanner les QR
                </h3>

                <p>
                  Va dans
                  <strong>
                    Scanner
                  </strong>
                  puis active la caméra.
                </p>

                <p>
                  Scanne le QR de la
                  <strong>
                    Course 1
                  </strong>
                  puis celui de la
                  <strong>
                    Course 2
                  </strong>.
                </p>

                <p>
                  Le même identifiant élève
                  permet de compléter
                  automatiquement la même fiche.
                </p>

              </div>

            </div>


            <div
              class="help-step"
            >

              <div
                class="help-number"
              >
                5
              </div>

              <div>

                <h3>
                  Consulter les résultats
                </h3>

                <p>
                  Dans
                  <strong>
                    Résultats
                  </strong>,
                  tu peux consulter
                  l’AFL1, les temps,
                  la performance,
                  la régularité
                  et la note finale.
                </p>

                <p>
                  Les vues détaillées permettent
                  également de renseigner
                  AFL2 et AFL3.
                </p>

              </div>

            </div>


            <div
              class="help-step"
            >

              <div
                class="help-number"
              >
                6
              </div>

              <div>

                <h3>
                  Statut d’une évaluation
                </h3>

                <p>
                  <strong>
                    En cours
                  </strong>
                  : les scans et modifications
                  restent autorisés.
                </p>

                <p>
                  <strong>
                    Terminée
                  </strong>
                  : permet d’identifier une
                  évaluation achevée.
                </p>

                <p>
                  <strong>
                    Verrouillée
                  </strong>
                  : consultation possible,
                  mais plus aucun scan
                  ni modification.
                </p>

              </div>

            </div>


            <div
              class="help-step"
            >

              <div
                class="help-number"
              >
                7
              </div>

              <div>

                <h3>
                  Archiver un espace
                </h3>

                <p>
                  Archiver un espace
                  <strong>
                    ne supprime pas ses données
                  </strong>.
                </p>

                <p>
                  Les évaluations et résultats
                  restent conservés et l’espace
                  peut être restauré ensuite.
                </p>

              </div>

            </div>


            <div
              class="help-step"
            >

              <div
                class="help-number"
              >
                8
              </div>

              <div>

                <h3>
                  Sauvegarde de sécurité
                </h3>

                <p>
                  L’application enregistre déjà
                  automatiquement les données
                  dans le stockage local.
                </p>

                <p>
                  Le bouton
                  <strong>
                    Sauvegarde de sécurité
                  </strong>
                  sert uniquement à créer
                  une copie externe JSON
                  en cas de changement d’appareil
                  ou pour une sauvegarde
                  supplémentaire.
                </p>

              </div>

            </div>


            <div
              class="help-step"
            >

              <div
                class="help-number"
              >
                9
              </div>

              <div>

                <h3>
                  Importer une sauvegarde
                </h3>

                <p>
                  Le bouton
                  <strong>
                    Importer une sauvegarde
                  </strong>
                  permet de recharger
                  un fichier JSON précédemment
                  exporté.
                </p>

                <p>
                  Cette fonction sera sécurisée
                  pour éviter les écrasements
                  accidentels.
                </p>

              </div>

            </div>


            <div
              class="help-step"
            >

              <div
                class="help-number"
              >
                10
              </div>

              <div>

                <h3>
                  Utilisation hors connexion
                </h3>

                <p>
                  Une fois l’application chargée
                  sur l’iPad, elle est conçue
                  pour continuer à fonctionner
                  autant que possible
                  sans connexion internet.
                </p>

                <p>
                  Les données restent stockées
                  localement sur l’appareil.
                </p>

              </div>

            </div>

          </div>

        </div>

      </div>
    `;
  }


  function openHelp() {
    if (
      document.getElementById(
        "helpOverlay"
      )
    ) {
      return;
    }

    const host =
      document.createElement(
        "div"
      );

    host.innerHTML =
      helpContent();

    const overlay =
      host.firstElementChild;

    document.body.appendChild(
      overlay
    );

    const close =
      document.getElementById(
        "helpClose"
      );

    close?.focus();

    close?.addEventListener(
      "click",
      closeHelp
    );

    overlay.addEventListener(
      "click",
      event => {
        if (
          event.target === overlay
        ) {
          closeHelp();
        }
      }
    );

    document.addEventListener(
      "keydown",
      escapeHandler
    );
  }


  function closeHelp() {
    const overlay =
      document.getElementById(
        "helpOverlay"
      );

    overlay?.remove();

    document.removeEventListener(
      "keydown",
      escapeHandler
    );

    document
      .getElementById(
        "helpButton"
      )
      ?.focus();
  }


  function escapeHandler(event) {
    if (
      event.key === "Escape"
    ) {
      closeHelp();
    }
  }


  function init() {
    makeButton();
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
