/* Ayünka Studio · versión única de la app.
 *
 * ESTE NÚMERO ES LA ÚNICA FUENTE DE VERDAD DE LA VERSIÓN. Lo usan el service worker
 * (para nombrar el caché) y el pie de la app (para que se vea en pantalla cuál estás
 * corriendo). Súbelo en cada cambio de js/ o css/.
 *
 * Por qué existe este archivo: en la versión anterior el número del caché estaba escrito
 * a mano dentro de sw.js. Se cambió el código cinco veces sin tocarlo, y el navegador
 * siguió sirviendo la versión vieja durante horas — los campos nuevos existían en el
 * código y no aparecían en pantalla. Con un solo lugar y el número visible abajo a la
 * derecha, eso se detecta en tres segundos.
 */
self.AYUNKA_VERSION = '2.14.0';
