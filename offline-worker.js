const VERSION='df-ccf-3';
const FILES=['/','/index.html','/app.css','/app.js','/evaluation-ccf.js','/scanner-ios.js','/groups.js','/group-presets.js','/qr-ui.js','/manifest.webmanifest'];

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(VERSION)
      .then(cache=>cache.addAll(FILES))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key!==VERSION).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;

  const request=event.request;
  const url=new URL(request.url);
  const sameOrigin=url.origin===self.location.origin;
  const networkFirst=sameOrigin && (
    request.mode==='navigate' ||
    request.destination==='script' ||
    request.destination==='style' ||
    request.destination==='document'
  );

  if(networkFirst){
    event.respondWith(
      fetch(request)
        .then(response=>{
          const copy=response.clone();
          caches.open(VERSION).then(cache=>cache.put(request,copy));
          return response;
        })
        .catch(()=>caches.match(request).then(cached=>cached||caches.match('/index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(request)
      .then(cached=>cached||fetch(request).then(response=>{
        const copy=response.clone();
        caches.open(VERSION).then(cache=>cache.put(request,copy));
        return response;
      }))
  );
});
