// El instalador con aviso de ventana. Solo se registra en navegadores con
// Periodic Background Sync (Chrome de Android con la app instalada), que
// también entienden instaladores de tipo módulo; el resto usa sw.js tal cual.
// sw.js va dentro sin cambios: la caché y la versión son las suyas.

import './sw.js';
import { ETIQUETA, comprobarAvisos } from './src/app/aviso.js';

self.addEventListener('periodicsync', (e) => {
  if (e.tag === ETIQUETA) e.waitUntil(comprobarAvisos(self.registration).catch(() => {}));
});

// Tocar la notificación abre la app (o la trae delante si ya estaba abierta).
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ws) => (ws.length ? ws[0].focus() : self.clients.openWindow('./'))),
  );
});
