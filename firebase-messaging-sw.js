// Firebase Messaging Service Worker - LA CULPA
// Este archivo debe estar en la RAÍZ del repositorio GitHub

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

// Maneja notificaciones en background (app cerrada o en segundo plano)
messaging.onBackgroundMessage(payload => {
    const { title, body, icon } = payload.notification || {};
    self.registration.showNotification(title || '🎉 LA CULPA', {
        body: body || 'Nueva actualización',
        icon: icon || 'https://i.imgur.com/czObXpX.png',
        badge: 'https://i.imgur.com/czObXpX.png',
        vibrate: [200, 100, 200],
        tag: 'la-culpa-notif',
        renotify: true,
        data: payload.data || {}
    });
});
