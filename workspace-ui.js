(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  let currentPage = "home";
  let groupStage = "spaces";

  function context() {
    return { group: typeof activeGroup === "function" ? activeGroup() : null,
      session: typeof activeSession === "function" ? activeSession() : null };
  }

  function setText(id, value) {
    const node = $(id);
    if (node && node.textContent !== value) node.textContent = value;
  }

  function refreshContext() {
    const { group, session } = context();
    setText("homeActiveContext", group
      ? "Espace actif : " + group.name + (session ? " · " + session.label : " · Choisis une évaluation dans Mes espaces.")
      : "Pour commencer, crée ou ouvre un espace, puis choisis son évaluation.");
    setText("backupActiveContext", group && session
      ? "Évaluation à sauvegarder : " + group.name + " · " + session.label
      : "Aucune évaluation active. La sauvegarde complète et la restauration restent disponibles.");
    setText("groupFlowTitle", groupStage === "evaluations" && group ? group.name : "Mes espaces");
    setText("groupFlowHint", groupStage === "evaluations"
      ? "Ouvre une évaluation pour scanner, consulter ses élèves ou ses résultats."
      : "Choisis un espace pour afficher ses évaluations.");
    $("backToSpaces")?.classList.toggle("hidden", groupStage !== "evaluations");
    setText("scanNetworkStatus", (navigator.onLine ? "En ligne" : "Hors ligne") + " · v56");
  }

  function setStage(stage) {
    groupStage = stage;
    document.body.dataset.groupStage = stage;
    refreshContext();
  }

  function navigate(destination) {
    let page = destination;
    const { group, session } = context();
    if ((page === "results" || page === "scan") && (!group || !session)) {
      page = "group";
      setStage(group ? "evaluations" : "spaces");
      if (typeof toast === "function") toast("Choisis un espace et une évaluation pour continuer.");
    } else if (page === "group") {
      setStage("spaces");
    }
    if (page === "results" && session?.type === "training") page = "training-results";
    showPage(page);
    if (typeof render === "function") render();
    if (page === "training-results") window.renderTrainingResults?.();
    if (page === "results" && session?.type === "exam500") window.renderExam500View?.();
    refreshContext();
  }

  function install() {
    const originalShowPage = window.showPage;
    window.showPage = function(id) {
      if (currentPage === "scan" && id !== "scan") $("cameraStop")?.click();
      originalShowPage(id);
      currentPage = id;
      document.body.dataset.workspacePage = id;
      if (id === "training-results") document.querySelector('nav button[data-page="results"]')?.classList.add("active");
      refreshContext();
    };
    const originalRender = window.render;
    window.render = function(...args) {
      const value = originalRender.apply(this, args);
      refreshContext();
      return value;
    };
    document.querySelectorAll("nav button[data-page]").forEach(button => {
      button.onclick = () => navigate(button.dataset.page);
    });
    document.querySelectorAll("[data-destination]").forEach(button => {
      button.onclick = () => {
        // Use the existing navigation button so scan lock guards still apply.
        document.querySelector('nav button[data-page="' + button.dataset.destination + '"]')?.click();
      };
    });
    $("backToSpaces").onclick = () => setStage("spaces");
    document.addEventListener("click", event => {
      if (event.target.closest?.("[data-space-id]")) setStage("evaluations");
    });
    $("groups")?.addEventListener("change", () => setStage("evaluations"));
    window.addEventListener("online", refreshContext);
    window.addEventListener("offline", refreshContext);
    setStage("spaces");
    showPage("home");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install);
  else install();
})();
