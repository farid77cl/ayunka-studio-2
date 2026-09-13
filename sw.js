const CACHE = 'ayunka-studio-v1';
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => self.clients.claim());
self.addEventListener('fetch', e => {}); // red primero por defecto: no interceptar
