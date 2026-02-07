const CACHE_NAME = 'cognito-attend-v1';
const ASSETS = [
    './',
    './index.html',
    './qr.html',
    './style.css',
    './main.js',
    './manifest.json',
    './folder/cognito attend.png',
    './folder/hacker2.png',
    'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.0/three.min.js',
    'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js',
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://justadudewhohacks.github.io/face-api.js/models/ssd_mobilenetv1_model-weights_manifest.json',
    'https://justadudewhohacks.github.io/face-api.js/models/ssd_mobilenetv1_model-shard1',
    'https://justadudewhohacks.github.io/face-api.js/models/ssd_mobilenetv1_model-shard2',
    'https://justadudewhohacks.github.io/face-api.js/models/face_landmark_68_model-weights_manifest.json',
    'https://justadudewhohacks.github.io/face-api.js/models/face_landmark_68_model-shard1',
    'https://justadudewhohacks.github.io/face-api.js/models/face_recognition_model-weights_manifest.json',
    'https://justadudewhohacks.github.io/face-api.js/models/face_recognition_model-shard1',
    'https://justadudewhohacks.github.io/face-api.js/models/face_recognition_model-shard2'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});