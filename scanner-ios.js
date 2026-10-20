(() => {
  "use strict";

  const $ =
    id =>
      document.getElementById(id);

  let stream =
    null;

  let raf =
    null;

  let last =
    "";

  let lastScanAt =
    0;

  const SCAN_INTERVAL =
    120;

  const MAX_WIDTH =
    1600;

  let detector = null;
  let decoding = false;
  let frames = 0;


  function msg(text,kind="info") {
    const element=$("scanMessage");
    if (!element) return;
    // Ne jamais écraser un résultat confirmé ni une erreur d'import
    // avec le message périodique de recherche caméra.
    if (kind==="info" && (element.classList.contains("scan-ok") ||
                          element.dataset.scanOutcome==="error")) return;
    element.className=kind==="error"?"scan-bad":"scan-info";
    element.textContent=text;
  }


  function isScanPageVisible() {

    const page =
      document.getElementById(
        "scan"
      );

    return (
      page &&
      !page.classList.contains(
        "hidden"
      )
    );

  }


  function acceptCode(value) {
    if (!value || value===last) return;
    last=value;
    const textarea=$("qrText");
    if (textarea) textarea.value=value;
    const button=$("readText");
    if (button) button.click();
    // handleQR / handle500 écrit déjà le nom de l'élève (scan-ok)
    // ou la cause du rejet (scan-bad). Ne pas effacer ce retour.
    const feedback=$("scanMessage");
    if (feedback?.classList.contains("scan-bad")) {
      feedback.dataset.scanOutcome="error";
    } else if (feedback?.classList.contains("scan-ok")) {
      delete feedback.dataset.scanOutcome;
    }
    setTimeout(()=>{last="";},1400);
  }

  async function start() {

    try {

      if (stream) {
        stop();
      }


      stream =
        await navigator
          .mediaDevices
          .getUserMedia({

            video: {

              facingMode: {
                ideal:
                  "environment"
              }

            },

            audio:
              false

          });


      const video =
        $("video");


      if (!video) {

        stop();

        return;

      }


      video.srcObject =
        stream;


      await video.play();

      if (typeof BarcodeDetector !== "undefined") {
        try { detector = new BarcodeDetector({formats:["qr_code"]}); }
        catch (_) { detector = null; }
      }
      if (!detector && typeof window.jsQR !== "function") {
        msg("Lecteur QR non chargé. Actualise la page puis réessaie.","error");
        stop();
        return;
      }
      msg("Caméra active : place le QR dans le cadre. Recherche en cours…");


      const canvas =
        document.createElement(
          "canvas"
        );


      const ctx =
        canvas.getContext(
          "2d",
          {
            willReadFrequently:
              true
          }
        );


      function loop(
        now
      ) {

        if (!stream) {
          return;
        }


        /*
          Si on quitte la page Scanner,
          on coupe automatiquement
          la caméra.
        */

        if (
          !isScanPageVisible()
        ) {

          stop();

          return;

        }


        /*
          On ne tente pas un décodage
          QR à chaque image vidéo.
        */

        if (
          now -
          lastScanAt <
          SCAN_INTERVAL
        ) {

          raf =
            requestAnimationFrame(
              loop
            );

          return;

        }


        lastScanAt =
          now;


        if (
          video.readyState >= 2 &&
          video.videoWidth &&
          video.videoHeight
        ) {

          const scale =
            Math.min(
              1,
              MAX_WIDTH /
                video.videoWidth
            );


          canvas.width =
            Math.round(
              video.videoWidth *
              scale
            );


          canvas.height =
            Math.round(
              video.videoHeight *
              scale
            );


          ctx.drawImage(
            video,
            0,
            0,
            canvas.width,
            canvas.height
          );


          const image =
            ctx.getImageData(
              0,
              0,
              canvas.width,
              canvas.height
            );


          let code = null;
          if (typeof window.jsQR === "function") {
            try {
              code = window.jsQR(image.data,image.width,image.height,
                {inversionAttempts:"attemptBoth"});
            } catch (error) {
              console.error("Décodage QR",error);
              msg("Erreur de lecture QR : "+error.message,"error");
            }
          }
          frames++;
          if (frames % 25 === 0 && !code) {
            const feedback=$("scanMessage");
            if (feedback && !feedback.classList.contains("scan-ok") &&
                feedback.dataset.scanOutcome!=="error") {
              msg("Recherche QR en cours… Centre le code dans le cadre.");
            }
          }
          if (!code && detector && !decoding) {
            decoding=true;
            detector.detect(video).then(codes=>{
              const value=codes?.[0]?.rawValue;
              if (value) acceptCode(value);
            }).catch(error=>console.warn("BarcodeDetector",error))
              .finally(()=>{decoding=false;});
          }

          if (code && code.data) acceptCode(code.data);

        }


        raf =
          requestAnimationFrame(
            loop
          );

      }


      raf =
        requestAnimationFrame(
          loop
        );


    } catch (error) {

      console.error(
        error
      );


      msg(
        "Accès caméra refusé ou indisponible. Vérifie l’autorisation Caméra dans Safari.","error"
      );

    }

  }


  function stop() {

    if (raf) {

      cancelAnimationFrame(
        raf
      );

    }


    raf =
      null;


    if (stream) {

      stream
        .getTracks()
        .forEach(
          track =>
            track.stop()
        );

    }


    stream =
      null;
    detector = null;
    decoding = false;
    frames = 0;

    const video =
      $("video");


    if (video) {

      video.srcObject =
        null;

    }

  }


  function initButtons() {

    const startButton =
      $("camera");

    const stopButton =
      $("cameraStop");


    if (startButton) {

      startButton.onclick =
        start;

    }


    if (stopButton) {

      stopButton.onclick =
        stop;

    }

  }


  function installNavigationGuard() {

    document.addEventListener(
      "click",
      event => {

        const navButton =
          event.target
            ?.closest?.(
              "nav button[data-page]"
            );


        if (!navButton) {
          return;
        }


        const destination =
          navButton.dataset.page;


        if (
          destination !==
          "scan"
        ) {

          stop();

        }

      }
    );

  }


  function installVisibilityGuard() {

    document.addEventListener(
      "visibilitychange",
      () => {

        if (
          document.hidden
        ) {

          stop();

        }

      }
    );

  }


  function installPageHideGuard() {

    window.addEventListener(
      "pagehide",
      () => {

        stop();

      }
    );

  }


  function init() {

    initButtons();

    installNavigationGuard();

    installVisibilityGuard();

    installPageHideGuard();

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
