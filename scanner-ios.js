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
    900;


  function msg(text) {

    const element =
      $("scanMessage");

    if (!element) {
      return;
    }

    element.className =
      "scan-bad";

    element.textContent =
      text;

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
          video.videoHeight &&
          window.jsQR
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


          const code =
            jsQR(
              image.data,
              image.width,
              image.height,
              {
                inversionAttempts:
                  "dontInvert"
              }
            );


          if (
            code &&
            code.data &&
            code.data !==
              last
          ) {

            last =
              code.data;


            const textarea =
              $("qrText");


            if (textarea) {
              textarea.value =
                code.data;
            }


            const button =
              $("readText");


            if (button) {
              button.click();
            }


            setTimeout(
              () => {

                last =
                  "";

              },
              1400
            );

          }

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
        "Accès caméra refusé ou indisponible. Vérifie l’autorisation Caméra dans Safari."
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
