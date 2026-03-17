import localforage from 'localforage';

// Configure our local database instances
const cacheDb = localforage.createInstance({
  name: 'AutoVet-Cache',
  storeName: 'api_responses'
});

const outboxDb = localforage.createInstance({
  name: 'AutoVet-Outbox',
  storeName: 'mutation_queue'
});

/**
 * Custom fetch wrapper that implements Stale-While-Revalidate caching for GET requests,
 * and background syncing for POST/PUT/DELETE requests when offline.
 */
export async function apiFetch(url, options = {}) {
  const method = options.method || 'GET';
  const isReadOnly = method === 'GET';

  if (isReadOnly) {
    try {
      // 1. Try network first for fresh data
      const response = await fetch(url, options);
      if (response.ok) {
        const data = await response.clone().json();
        // Fire and forget cache update
        cacheDb.setItem(url, data).catch(console.error);
      }
      return response;
    } catch (error) {
      // 2. If network fails, serve from LocalForage cache
      const cachedData = await cacheDb.getItem(url);
      if (cachedData) {
        // Mock a fetch response object
        return new Response(JSON.stringify(cachedData), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'X-Offline-Cache': 'true' }
        });
      }
      throw error; // No cache and no network
    }
  } else {
    // Handling mutations (POST/PUT/DELETE)
    try {
      if (!navigator.onLine) {
         throw new Error("Offline mutation intercepted.");
      }
      return await fetch(url, options);
    } catch (error) {
      // 3. Network failed or offline, queue the mutation in the outbox
      const mutation = {
        id: crypto.randomUUID(),
        url,
        options: {
            ...options,
            // Ensure bodies are text for storage
            body: typeof options.body === 'string' ? options.body : JSON.stringify(options.body)
        },
        timestamp: Date.now()
      };
      
      const outbox = await outboxDb.getItem('queue') || [];
      outbox.push(mutation);
      await outboxDb.setItem('queue', outbox);
      
      // Attempt to register background sync if supported by SW
      if ('serviceWorker' in navigator && 'SyncManager' in window) {
        try {
            const registration = await navigator.serviceWorker.ready;
            await registration.sync.register('sync-outbox');
        } catch (syncErr) {
            console.error('Background sync registration failed:', syncErr);
        }
      }

      // Return a 202 Accepted mock response to let the UI continue optimistically
      return new Response(JSON.stringify({
          status: 'success',
          message: 'Saved offline. Will sync when connected.',
          offline: true,
          data: {} // Optimistic UI should rely on their own state updates
      }), {
          status: 202,
          headers: { 'Content-Type': 'application/json' }
      });
    }
  }
}

/**
 * Helper to manually process the outbox if background sync is unsupported
 */
export async function syncOutbox() {
    if (!navigator.onLine) return;
    
    const outbox = await outboxDb.getItem('queue') || [];
    if (outbox.length === 0) return;

    console.log(`Attempting to sync ${outbox.length} offline mutations...`);
    
    const remaining = [];
    for (const mutation of outbox) {
        try {
            const resp = await fetch(mutation.url, mutation.options);
            if (!resp.ok) {
                console.error('Failed to sync mutation:', mutation);
                // Keep it if it wasn't a 4xx client error
                if (resp.status >= 500) {
                   remaining.push(mutation);
                }
            }
        } catch (e) {
            console.error('Network still down during sync attempt', e);
            remaining.push(mutation);
            break; // Stop trying if the network is completely down
        }
    }
    
    await outboxDb.setItem('queue', remaining);
    if (remaining.length === 0 && outbox.length > 0) {
        console.log('Offline outbox synced successfully.');
        // Optional: Dispatch a custom event to notify the UI to refresh
        window.dispatchEvent(new CustomEvent('outbox-synced'));
    }
}

// Auto-sync when coming online
window.addEventListener('online', syncOutbox);
