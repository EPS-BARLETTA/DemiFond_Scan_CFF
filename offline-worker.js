const VERSION =
  "df-ccf-40";


const FILES = [

  "/",

  "/index.html",

  "/app.css",

  "/modern-ui.css",

  "/app.js",

  "/qr-validation.js",

  "/storage-safety.js",

  "/evaluation-ccf.js",

  "/archive-ui.js",

  "/exam500-ui.js",

  "/training-qr-ui.js",

  "/hold-delete-ui.js",

  "/ccf-results-ui.js",

  "/group-sessions-ui.js",

  "/spaces-ui.js",

  "/help-ui.js",

  "/scanner-ios.js",

  "/groups.js",

  "/group-presets.js",

  "/qr-ui.js",

  "/jsQR.js",

  "/manifest.webmanifest"

];


/* =========================================
   INSTALLATION
========================================= */

self.addEventListener(
  "install",
  event => {

    event.waitUntil(

      caches
        .open(VERSION)

        .then(
          cache =>
            cache.addAll(
              FILES
            )
        )

        .then(
          () =>
            self.skipWaiting()
        )

    );

  }
);


/* =========================================
   ACTIVATION
========================================= */

self.addEventListener(
  "activate",
  event => {

    event.waitUntil(

      caches
        .keys()

        .then(
          keys =>
            Promise.all(

              keys

                .filter(
                  key =>
                    key !== VERSION
                )

                .map(
                  key =>
                    caches.delete(
                      key
                    )
                )

            )
        )

        .then(
          () =>
            self.clients.claim()
        )

    );

  }
);


/* =========================================
   RECHERCHE DANS LE CACHE
========================================= */

async function findCached(
  request
) {

  return caches.match(
    request,
    {
      ignoreSearch: true
    }
  );

}


/* =========================================
   MISE EN CACHE
========================================= */

async function cacheResponse(
  request,
  response
) {

  if (
    !response ||
    !response.ok
  ) {
    return;
  }


  const cache =
    await caches.open(
      VERSION
    );


  const url =
    new URL(
      request.url
    );


  const cleanRequest =
    new Request(
      url.origin +
      url.pathname,
      {
        method:
          "GET"
      }
    );


  await cache.put(
    cleanRequest,
    response.clone()
  );

}


/* =========================================
   FETCH
========================================= */

self.addEventListener(
  "fetch",
  event => {

    const request =
      event.request;


    if (
      request.method !==
      "GET"
    ) {
      return;
    }


    const url =
      new URL(
        request.url
      );


    const sameOrigin =
      url.origin ===
      self.location.origin;


    const networkFirst =
      sameOrigin &&
      (
        request.mode ===
          "navigate" ||

        request.destination ===
          "script" ||

        request.destination ===
          "style" ||

        request.destination ===
          "document"
      );


    if (
      networkFirst
    ) {

      event.respondWith(

        fetch(
          request
        )

          .then(
            async response => {

              await cacheResponse(
                request,
                response
              );

              return response;

            }
          )

          .catch(
            async () => {

              const cached =
                await findCached(
                  request
                );


              if (
                cached
              ) {
                return cached;
              }


              if (
                request.mode ===
                "navigate"
              ) {

                const fallback =
                  await caches.match(
                    "/index.html"
                  );


                if (
                  fallback
                ) {
                  return fallback;
                }

              }


              return new Response(
                "Application indisponible hors connexion.",
                {
                  status:
                    503,

                  statusText:
                    "Offline",

                  headers: {
                    "Content-Type":
                      "text/plain; charset=utf-8"
                  }
                }
              );

            }
          )

      );


      return;
    }


    event.respondWith(

      findCached(
        request
      )

        .then(
          cached => {

            if (
              cached
            ) {
              return cached;
            }


            return fetch(
              request
            )

              .then(
                async response => {

                  if (
                    sameOrigin
                  ) {

                    await cacheResponse(
                      request,
                      response
                    );

                  }


                  return response;

                }
              )

              .catch(
                () =>
                  new Response(
                    "",
                    {
                      status:
                        503,

                      statusText:
                        "Offline"
                    }
                  )
              );

          }
        )

    );

  }
);
