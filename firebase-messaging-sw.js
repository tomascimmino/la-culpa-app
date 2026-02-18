// Firebase Messaging Service Worker - LA CULPA
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyAamBVJC48CtEd41HtvF5Ek0Bxui5TfsjA",
    authDomain: "la-culpa.firebaseapp.com",
    projectId: "la-culpa",
    storageBucket: "la-culpa.firebasestorage.app",
    messagingSenderId: "339936091040",
    appId: "1:339936091040:web:608ec8df925b088472a2c5"
});

const messaging = firebase.messaging();

// ── BACKGROUND: solo se ejecuta si la app NO está abierta ────
// Cuando la app está en foreground, Firebase suprime este handler
// automáticamente — así evitamos la notificación doble.
messaging.onBackgroundMessage(payload => {
    const { title, body, icon } = payload.notification || {};

    // Cerrar notificaciones anteriores con el mismo tag (evita acumulación)
    self.registration.getNotifications({ tag: 'la-culpa-notif' })
        .then(existing => existing.forEach(n => n.close()));

    self.registration.showNotification(title || '🎉 LA CULPA', {
        body:    body || 'Nueva juntada programada',
        icon:    icon || 'https://i.imgur.com/czObXpX.png',
        badge:   'https://i.imgur.com/czObXpX.png',
        vibrate: [200, 100, 200, 100, 200],
        tag:     'la-culpa-notif',   // mismo tag = reemplaza en vez de apilar
        renotify: true,
        requireInteraction: false,   // se cierra sola (no queda pegada)
        data: payload.data || {},
        actions: [
            { action: 'open', title: '👀 Ver juntada' },
            { action: 'close', title: '✕ Cerrar' }
        ]
    });
});

// ── Al tocar la notificación → abrir/enfocar la app ─────────
self.addEventListener('notificationclick', event => {
    event.notification.close();
    if (event.action === 'close') return;

    const url = 'https://tomascimmino.github.io/la-culpa-app/';
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(list => {
                // Si ya hay una pestaña/ventana abierta, la enfoca
                const existing = list.find(c => c.url.includes('la-culpa-app'));
                if (existing) return existing.focus();
                // Si no, abre una nueva
                return clients.openWindow(url);
            })
    );
});
