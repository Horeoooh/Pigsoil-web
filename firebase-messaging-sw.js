// Firebase Cloud Messaging Service Worker
// This file handles background notifications for PigSoil+ Web

importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-messaging-compat.js');

// Initialize Firebase
firebase.initializeApp({
  apiKey: "AIzaSyBebdbhEom7To58LFYMkbiI8Buzm7bXOeQ",
  authDomain: "manongcompost.firebaseapp.com",
  projectId: "manongcompost",
  storageBucket: "manongcompost.firebasestorage.app",
  messagingSenderId: "131673559254",
  appId: "1:131673559254:web:b1f2e35ce6cb5c6d21b977"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);

  const notificationTitle = payload.notification?.title || 'PigSoil+ Notification';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new notification',
    icon: '/images/pig logo.png',
    badge: '/images/pig logo.png',
    tag: payload.data?.notificationId || Date.now().toString(),
    data: payload.data || {},
    requireInteraction: false,
    vibrate: [200, 100, 200]
  };

  self.registration.showNotification(notificationTitle, notificationOptions);

  // Forward payload to all open clients so pages can persist it per-user
  try {
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      clientList.forEach((client) => {
        client.postMessage({ type: 'PIGSOIL_FCM', payload });
      });
    });
  } catch (err) {
    // Non-fatal: not all environments will support posting to clients
    console.warn('[firebase-messaging-sw.js] Unable to forward message to clients:', err);
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification click received:', event.notification);

  event.notification.close();

  const data = event.notification.data;
  let url = '/dashboard.html';

  // Determine URL based on notification type
  if (data.type === 'chat' && data.conversationId) {
    url = `/messages.html?conversation=${data.conversationId}`;
  } else if (data.type === 'subscription') {
    url = '/setting-subscription.html';
  }

  // Open or focus the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if app is already open
        for (const client of clientList) {
          if (client.url.includes(url) && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window if not open
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});
