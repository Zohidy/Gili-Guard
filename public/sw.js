const CACHE_NAME = 'giliguard-cache-v2';
const OFFLINE_URL = '/';

const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/api/icon?size=192',
  '/api/icon?size=512',
  '/favicon.ico'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Skip cross-origin requests unless they are specific CDNs we use
  const isInternal = event.request.url.startsWith(self.location.origin);
  const isCdn = event.request.url.includes('picsum.photos') || 
                event.request.url.includes('google-analytics.com') ||
                event.request.url.includes('lucide-react') ||
                event.request.url.includes('fonts.googleapis.com') ||
                event.request.url.includes('fonts.gstatic.com') ||
                event.request.url.includes('gstatic.com');

  if (!isInternal && !isCdn) return;
  
  // Skip Firebase and other dynamic APIs
  if (event.request.url.includes('firestore.googleapis.com') || 
      event.request.url.includes('identitytoolkit.googleapis.com') ||
      event.request.url.includes('googletagmanager.com')) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch((error) => {
        if (cachedResponse) return cachedResponse;
        
        // If both fail and it's a navigation, return offline page (root)
        if (event.request.mode === 'navigate') {
          return caches.match(OFFLINE_URL);
        }
        throw error;
      });

      return cachedResponse || fetchPromise;
    })
  );
});
