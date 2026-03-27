// public/sw.js
self.addEventListener('push', function(event) {
    const data = event.data ? event.data.json() : { title: 'New Notification', body: 'You have a new update!' };

    const options = {
        body: data.body,
        icon: '/images/logo.png', // Path to your cafe logo
        badge: '/images/badge.png', // Small icon for the status bar
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: '1'
        }
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Optional: Handle notification click
self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    event.waitUntil(
        clients.openWindow('/') // Opens your website when notification is clicked
    );
});