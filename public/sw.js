const CACHE_NAME = 'queenmovie-v1'
const API_CACHE_NAME = 'queenmovie-api-v1'
const IMAGE_CACHE_NAME = 'queenmovie-images-v1'

// Cache URLs
const CACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/shadcn.css'
]

// API endpoints to cache
const API_URLS = [
  '/api/content/trending',
  '/api/content/popular',
  '/api/user/profile',
  '/api/user/my-list'
]

// Image domains to cache
const IMAGE_DOMAINS = [
  'https://pub-cdn.sider.ai',
  'https://images.unsplash.com',
  'https://via.placeholder.com'
]

// Install event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CACHE_URLS))
      .then(() => self.skipWaiting())
  )
})

// Activate event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && 
              cacheName !== API_CACHE_NAME && 
              cacheName !== IMAGE_CACHE_NAME) {
            return caches.delete(cacheName)
          }
        })
      )
    }).then(() => self.clients.claim())
  )
})

// Fetch event
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  
  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      caches.open(API_CACHE_NAME)
        .then((cache) => cache.match(event.request))
        .then((response) => {
          if (response) {
            // Return cached response and fetch fresh data in background
            fetch(event.request)
              .then((freshResponse) => {
                if (freshResponse.ok) {
                  cache.put(event.request, freshResponse.clone())
                }
              })
            return response
          }
          
          // Fetch from network
          return fetch(event.request)
            .then((response) => {
              if (response.ok) {
                const responseClone = response.clone()
                caches.open(API_CACHE_NAME).then((cache) => {
                  cache.put(event.request, responseClone)
                })
              }
              return response
            })
            .catch(() => {
              // Return offline fallback for API requests
              return new Response(JSON.stringify({
                error: 'Offline',
                message: 'You are currently offline'
              }), {
                headers: { 'Content-Type': 'application/json' }
              })
            })
        })
    )
    return
  }

  // Handle image requests
  if (IMAGE_DOMAINS.some(domain => url.origin.includes(domain)) || 
      url.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
    event.respondWith(
      caches.open(IMAGE_CACHE_NAME)
        .then((cache) => cache.match(event.request))
        .then((response) => {
          if (response) {
            return response
          }
          
          return fetch(event.request)
            .then((response) => {
              if (response.ok) {
                const responseClone = response.clone()
                caches.open(IMAGE_CACHE_NAME).then((cache) => {
                  cache.put(event.request, responseClone)
                })
              }
              return response
            })
            .catch(() => {
              // Return placeholder image for failed image loads
              return caches.match('/placeholder.jpg')
            })
        })
    )
    return
  }

  // Handle other requests
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response
        }
        
        return fetch(event.request)
          .then((response) => {
            if (response.ok && event.request.method === 'GET') {
              const responseClone = response.clone()
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseClone)
              })
            }
            return response
          })
          .catch(() => {
            // Return offline page for navigation requests
            if (event.request.mode === 'navigate') {
              return caches.match('/offline.html')
            }
            
            // Return basic offline response
            return new Response('Offline', {
              status: 503,
              statusText: 'Service Unavailable'
            })
          })
      })
  )
})

// Background sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-watch-history') {
    event.waitUntil(syncWatchHistory())
  }
  
  if (event.tag === 'sync-my-list') {
    event.waitUntil(syncMyList())
  }
})

// Push notifications
self.addEventListener('push', (event) => {
  const options = {
    body: event.data?.text() || 'New content available on QueenMovie!',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      url: '/'
    },
    actions: [
      {
        action: 'explore',
        title: 'Explore Now'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  }

  event.waitUntil(
    self.registration.showNotification('QueenMovie', options)
  )
})

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    )
  }
})

// Sync watch history
async function syncWatchHistory() {
  try {
    // Get pending watch history from IndexedDB
    const pendingHistory = await getPendingWatchHistory()
    
    if (pendingHistory.length > 0) {
      // Sync with server
      const response = await fetch('/api/user/watch-history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(pendingHistory)
      })

      if (response.ok) {
        // Clear pending history
        await clearPendingWatchHistory()
      }
    }
  } catch (error) {
    console.error('Failed to sync watch history:', error)
  }
}

// Sync my list
async function syncMyList() {
  try {
    // Get pending my list changes from IndexedDB
    const pendingChanges = await getPendingMyListChanges()
    
    if (pendingChanges.length > 0) {
      // Sync with server
      const response = await fetch('/api/user/my-list/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(pendingChanges)
      })

      if (response.ok) {
        // Clear pending changes
        await clearPendingMyListChanges()
      }
    }
  } catch (error) {
    console.error('Failed to sync my list:', error)
  }
}

// Helper functions for IndexedDB operations
async function getPendingWatchHistory() {
  // Implementation for getting pending watch history
  return []
}

async function clearPendingWatchHistory() {
  // Implementation for clearing pending watch history
}

async function getPendingMyListChanges() {
  // Implementation for getting pending my list changes
  return []
}

async function clearPendingMyListChanges() {
  // Implementation for clearing pending my list changes
}