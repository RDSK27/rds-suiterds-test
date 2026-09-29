/* SuiteRDS - Service Worker */
var CACHE = 'suiterds-v14';
var ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './banner.jpg',
  './logo.png'
];

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(cache){
      // {cache:'reload'} evita que el precache use copias viejas del HTTP cache
      return cache.addAll(ASSETS.map(function(u){ return new Request(u, {cache:'reload'}); }));
    })
  );
});

self.addEventListener('message', function(e){
  if(e.data && e.data.action === 'skipWaiting'){ self.skipWaiting(); }
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){ if(k!==CACHE){ return caches.delete(k); } }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e){
  var req = e.request;
  if(req.method !== 'GET'){ return; }
  var url = new URL(req.url);
  var sameOrigin = (url.origin === self.location.origin);

  // NAVEGACION (HTML): network-first -> siempre la ultima version si hay red,
  // con la cache como respaldo offline. {cache:'no-store'} es imprescindible:
  // sin esto, fetch() puede devolver el index.html que el propio navegador
  // (no el SW) tenia guardado en su cache HTTP normal, y la app tarda varios
  // cierres/aperturas en "ponerse al dia" hasta que ese cache caduca solo.
  if(req.mode === 'navigate'){
    e.respondWith(
      fetch(req, {cache:'no-store'}).then(function(resp){
        var copy = resp.clone();
        caches.open(CACHE).then(function(cache){ try{ cache.put('./index.html', copy); }catch(err){} });
        return resp;
      }).catch(function(){
        return caches.match(req).then(function(cached){ return cached || caches.match('./index.html'); });
      })
    );
    return;
  }

  var isFbSdk = (url.hostname === 'www.gstatic.com' && url.pathname.indexOf('/firebasejs/') !== -1);
  // El resto de origenes (p. ej. firestore.googleapis.com) van directos a la red:
  // asi Firestore gestiona su propia persistencia offline.
  if(!sameOrigin && !isFbSdk){ return; }

  // ASSETS estaticos: cache-first.
  e.respondWith(
    caches.match(req).then(function(cached){
      if(cached){ return cached; }
      return fetch(req).then(function(resp){
        var copy = resp.clone();
        caches.open(CACHE).then(function(cache){ try{ cache.put(req, copy); }catch(err){} });
        return resp;
      }).catch(function(){
        if(req.mode === 'navigate'){ return caches.match('./index.html'); }
      });
    })
  );
});
