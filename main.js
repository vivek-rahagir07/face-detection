// Import Firebase Modules (Modular SDK 11.6.1)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, updateDoc, doc, getDoc, onSnapshot, increment, query, where, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Configuration & Setup

let db, auth, currentUser;
const COLL_USERS = 'users';
const COLL_SPACES = 'spaces';
const COLL_ATTENDANCE = 'attendance';

// DOM Elements: Portal
const viewPortal = document.getElementById('view-portal');
const tabJoin = document.getElementById('tab-join');
const tabCreate = document.getElementById('tab-create');
const formJoin = document.getElementById('form-join');
const formCreate = document.getElementById('form-create');
const portalJoinName = document.getElementById('portal-join-name');
const portalJoinPass = document.getElementById('portal-join-pass');
const portalCreateName = document.getElementById('portal-create-name');
const portalCreatePass = document.getElementById('portal-create-pass');
const btnPortalJoin = document.getElementById('btn-portal-join');
const btnPortalCreate = document.getElementById('btn-portal-create');
const portalError = document.getElementById('portal-error');

// DOM Elements: Operation
const viewOperation = document.getElementById('view-operation');
const currentSpaceTitle = document.getElementById('current-space-title');
const btnExitWorkspace = document.getElementById('btn-exit-workspace');
const video = document.getElementById('video');
const canvas = document.getElementById('overlay');
const statusBadge = document.getElementById('system-status');
const liveLogsContainer = document.getElementById('live-logs');
const todayListContainer = document.getElementById('today-list');
const todayCountDisplay = document.getElementById('today-count');
const dateDisplay = document.getElementById('display-date');
const loadingOverlay = document.getElementById('loading-overlay');
const loadingText = document.getElementById('loading-text');
const btnCapture = document.getElementById('btn-capture');
const btnCopyQrLink = document.getElementById('btn-copy-qr-link');
const btnUploadTrigger = document.getElementById('btn-upload-trigger');
const inputUploadPhoto = document.getElementById('input-upload-photo');
const regFeedback = document.getElementById('reg-feedback');
const btnExport = document.getElementById('btn-export');
const scanIndicator = document.getElementById('scan-indicator');
const dynamicFieldsContainer = document.getElementById('dynamic-fields-container');
const configForm = document.getElementById('config-form');
const attendInfo = document.getElementById('attend-info');
const regForm = document.getElementById('reg-form');
const btnHistory = document.getElementById('btn-history');
const historyModal = document.getElementById('history-modal');
const btnCloseHistory = document.getElementById('btn-close-history');
const historyDateSelector = document.getElementById('history-date-selector');
const historyTableBody = document.getElementById('history-table-body');
const historyStatus = document.getElementById('history-status');
const historySearchInput = document.getElementById('history-search');
const btnExportHistory = document.getElementById('btn-export-history');

// State
let currentHistoryRecords = [];
let currentHistoryDate = '';
// scanStatusOverlay and related elements removed as per request

// State
let currentMode = 'attendance';
let currentSpace = null;
let labeledDescriptors = [];
let faceMatcher = null;
let isModelsLoaded = false;
let nameToDocId = {};
const attendanceCooldowns = {};
let allUsersData = [];
let qrInterval = null;
let qrTimerInterval = null;
let currentNonce = null;

const qrModal = document.getElementById('qr-modal');
const btnQrPresence = document.getElementById('btn-qr-presence');
const btnCloseQr = document.getElementById('btn-close-qr');
const qrImage = document.getElementById('qr-image');
const qrTimerDisplay = document.getElementById('qr-timer');
const qrStatus = document.getElementById('qr-status');

// New Analytics & Geo Elements
const analyticsPanel = document.getElementById('analytics-panel');
const btnModeAnalytics = document.getElementById('btn-mode-analytics');
const configGeoEnabled = document.getElementById('config-geo-enabled');
const configGeoRadius = document.getElementById('config-geo-radius');
const btnSetLocation = document.getElementById('btn-set-location');
const geoStatus = document.getElementById('geo-status');

let dailyChart = null;
let hourlyChart = null;

// Advanced Detection State
const VALIDATION_THRESHOLD = 5;
const detectionHistory = {};

// Set Live Date & Time
function updateLiveDateTime() {
    const now = new Date();
    const options = { weekday: 'short', month: 'short', day: 'numeric' };
    if (dateDisplay) dateDisplay.innerText = now.toLocaleDateString('en-US', options);
}
setInterval(updateLiveDateTime, 60000);
updateLiveDateTime();

// Firebase Initialization

// Initialize Firebase
const firebaseConfig = {
    apiKey: "AIzaSyAf9xAmQtFZcvE8tvxpI-tU5teS89Dc6II",
    authDomain: "live-face-attendence-detection.firebaseapp.com",
    projectId: "live-face-attendence-detection",
    storageBucket: "live-face-attendence-detection.firebasestorage.app",
    messagingSenderId: "67072118378",
    appId: "1:67072118378:web:a988976e9233434b3fc413",
    measurementId: "G-RWGQV273WH"
};

try {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);

    // Ensure anonymous auth for connectivity
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            console.log("Authenticated as:", user.uid);
        } else {
            signInAnonymously(auth).catch(e => console.error("Auth Fail:", e));
        }
    });
} catch (e) {
    console.error("Firebase Init Error:", e);
}

// Portal Management

function showView(viewId) {
    [viewPortal, viewOperation].forEach(v => v ? v.classList.add('hidden') : null);
    const target = document.getElementById(viewId);
    if (target) target.classList.remove('hidden');
}

// Tab Switching
if (tabJoin) tabJoin.addEventListener('click', () => {
    tabJoin.classList.add('active');
    tabCreate.classList.remove('active');
    formJoin.classList.remove('hidden');
    formCreate.classList.add('hidden');
});

if (tabCreate) tabCreate.addEventListener('click', () => {
    tabCreate.classList.add('active');
    tabJoin.classList.remove('active');
    formCreate.classList.remove('hidden');
    formJoin.classList.add('hidden');
});

async function handleJoin() {
    const name = portalJoinName.value.trim();
    const password = portalJoinPass.value.trim();
    if (!name || !password) return alert("Enter name and password");

    const originalText = btnPortalJoin.innerText;
    btnPortalJoin.innerText = "Verifying...";
    btnPortalJoin.disabled = true;

    try {
        const q = query(collection(db, COLL_SPACES), where("name", "==", name));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            portalError.innerText = "Workspace not found.";
            btnPortalJoin.innerText = originalText;
            btnPortalJoin.disabled = false;
            return;
        }

        let found = false;
        querySnapshot.forEach((doc) => {
            if (doc.data().password === password) {
                found = true;
                enterSpace(doc.id, doc.data());
            }
        });

        if (!found) {
            portalError.innerText = "Incorrect Password.";
            btnPortalJoin.innerText = originalText;
            btnPortalJoin.disabled = false;
        }
    } catch (err) {
        portalError.innerText = "Error: " + err.message;
        btnPortalJoin.innerText = originalText;
        btnPortalJoin.disabled = false;
    }
}

async function handleCreate() {
    const name = portalCreateName.value.trim();
    const password = portalCreatePass.value.trim();
    if (!name || !password) return alert("Enter name and password");
    if (password.length < 4) return alert("Password too short (min 4)");

    const originalText = btnPortalCreate.innerText;
    btnPortalCreate.innerText = "Initialising...";
    btnPortalCreate.disabled = true;

    try {
        const q = query(collection(db, COLL_SPACES), where("name", "==", name));
        const snap = await getDocs(q);
        if (!snap.empty) {
            alert("Name already taken!");
            btnPortalCreate.innerText = originalText;
            btnPortalCreate.disabled = false;
            return;
        }

        const docRef = await addDoc(collection(db, COLL_SPACES), {
            name: name,
            password: password,
            createdAt: new Date(),
            config: { regNo: true, course: true, phone: false }
        });

        enterSpace(docRef.id, { name, password, config: { regNo: true, course: true, phone: false } });
    } catch (err) {
        portalError.innerText = "Create Error: " + err.message;
        btnPortalCreate.innerText = originalText;
        btnPortalCreate.disabled = false;
    }
}

function enterSpace(id, data) {
    currentSpace = { id, ...data };
    currentSpaceTitle.innerText = currentSpace.name;
    portalError.innerText = "";
    showView('view-operation');

    // Reset 3D view for new workspace
    const face3D = document.getElementById('face-3d-container');
    if (face3D) {
        face3D.classList.remove('fade-out');
        face3D.style.display = 'block';
    }

    initSystem();
    startDbListener();
    updateRegistrationForm();
    init3DFace('face-3d-container'); // Init operation view 3D
}

// QR Logic
async function startQRRotation() {
    if (!currentSpace) return;
    stopQRRotation();

    const refreshQR = async () => {
        currentNonce = Math.random().toString(36).substring(2, 12);
        const spaceRef = doc(db, COLL_SPACES, currentSpace.id);

        try {
            qrStatus.innerText = "Syncing with cloud...";
            qrImage.style.opacity = "0.5";

            // Update Firebase
            await updateDoc(spaceRef, { qrNonce: currentNonce });

            let baseUrl = window.location.href.split('?')[0].split('#')[0].replace('index.html', '');
            if (!baseUrl.endsWith('/')) baseUrl += '/';

            const attendanceUrl = `${baseUrl}qr.html?s=${currentSpace.id}&n=${currentNonce}`;

            // Helper to generate locally or fallback to API
            const generateQR = () => {
                const qrEngine = window.QRCode || (typeof QRCode !== 'undefined' ? QRCode : null);

                if (qrEngine && qrEngine.toDataURL) {
                    qrEngine.toDataURL(attendanceUrl, {
                        width: 250,
                        margin: 4,
                        errorCorrectionLevel: 'H', // High error correction to handle central logo
                        color: { dark: '#000000', light: '#ffffff' }
                    }, (err, url) => {
                        if (err) throw err;
                        qrImage.src = url;
                        qrImage.style.opacity = "1";
                        qrStatus.innerHTML = "[PRO] Code is live. Scan now.";
                        resetTimer(30);
                    });
                } else {
                    // Fallback to external API if local library missing
                    console.warn("QRCode library not found, using API fallback");
                    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(attendanceUrl)}`;
                    qrImage.src = qrApiUrl;
                    qrImage.onload = () => {
                        qrImage.style.opacity = "1";
                        qrStatus.innerHTML = "[PRO] Live (API Fallback)";
                        resetTimer(30);
                    };
                }
            };

            generateQR();

        } catch (e) {
            console.error("QR Error Stack:", e);
            qrStatus.innerHTML = `
                <span style="color:var(--danger); font-weight:800;">SYNC ERROR!</span><br>
                <small style="color:#ff6666;">Reason: ${e.message.split('(')[0]}</small><br>
                <button onclick="window.location.reload()" style="margin-top:10px; background:var(--accent); color:#000; border:none; padding:5px 10px; border-radius:5px; font-size:11px; cursor:pointer;">⚠️ Hard Refresh Page</button>
            `;
            // Do not auto-retry immediately to avoid loop if it's a permission error
            setTimeout(refreshQR, 10000);
        }
    };

    await refreshQR();
    qrInterval = setInterval(refreshQR, 30000);
}

function stopQRRotation() {
    if (qrInterval) clearInterval(qrInterval);
    if (qrTimerInterval) clearInterval(qrTimerInterval);
    qrInterval = null;
    qrTimerInterval = null;
}

function resetTimer(seconds) {
    if (qrTimerInterval) clearInterval(qrTimerInterval);
    let timeLeft = seconds;
    qrTimerDisplay.innerText = timeLeft;

    qrTimerInterval = setInterval(() => {
        timeLeft--;
        qrTimerDisplay.innerText = timeLeft;
        if (timeLeft <= 0) clearInterval(qrTimerInterval);
    }, 1000);
}

btnPortalJoin.addEventListener('click', handleJoin);
btnPortalCreate.addEventListener('click', handleCreate);
btnExitWorkspace.addEventListener('click', () => {
    stopQRRotation();
    currentSpace = null;
    showView('view-portal');
});

// QR Modal Controls
if (btnQrPresence) {
    btnQrPresence.addEventListener('click', () => {
        qrModal.classList.remove('hidden');
        startQRRotation();
    });
}

if (btnCloseQr) {
    btnCloseQr.addEventListener('click', () => {
        qrModal.classList.add('hidden');
        stopQRRotation();
    });
}

if (btnCopyQrLink) {
    btnCopyQrLink.addEventListener('click', () => {
        if (!currentSpace || !currentNonce) return alert("System not ready");
        let baseUrl = window.location.href.split('?')[0].split('#')[0].replace('index.html', '');
        if (!baseUrl.endsWith('/')) baseUrl += '/';
        const url = `${baseUrl}qr.html?s=${currentSpace.id}&n=${currentNonce}`;
        navigator.clipboard.writeText(url).then(() => {
            const originalText = btnCopyQrLink.innerText;
            btnCopyQrLink.innerText = "✅ Link Copied!";
            setTimeout(() => btnCopyQrLink.innerText = originalText, 2000);
        });
    });
}

// History Modal Controls
if (btnHistory) {
    btnHistory.addEventListener('click', openHistoryModal);
}

if (btnCloseHistory) {
    btnCloseHistory.addEventListener('click', () => {
        historyModal.classList.add('hidden');
    });
}

async function openHistoryModal() {
    if (!currentSpace) return;
    historyModal.classList.remove('hidden');
    historyDateSelector.innerHTML = '<div style="color:var(--accent)">Loading dates...</div>';
    historyTableBody.innerHTML = '';
    historyStatus.innerText = 'Select a date to view attendance';
    btnExportHistory.style.display = 'none';
    currentHistoryRecords = [];
    currentHistoryDate = '';

    try {
        const spaceSnap = await getDoc(doc(db, COLL_SPACES, currentSpace.id));
        const historyDates = spaceSnap.data().historyDates || {};
        const dates = Object.keys(historyDates).sort((a, b) => b.localeCompare(a)); // Sort desc

        if (dates.length === 0) {
            historyDateSelector.innerHTML = '<div style="color:var(--text-muted)">No history available yet.</div>';
            return;
        }

        historyDateSelector.innerHTML = '';
        dates.forEach(date => {
            const btn = document.createElement('button');
            btn.className = 'btn-date';

            // Format date for display: "14 Jan 2026"
            const d = new Date(date);
            const displayDate = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

            btn.innerText = displayDate;
            btn.onclick = () => loadHistoryForDate(date, btn);
            historyDateSelector.appendChild(btn);
        });

        // Load most recent date by default as requested "dates first then list"
        // But the user might want to see buttons first. I'll load the first one anyway for UX.
        if (dates.length > 0) {
            loadHistoryForDate(dates[0], historyDateSelector.firstChild);
        }
    } catch (err) {
        console.error("History Load Fail:", err);
        historyDateSelector.innerHTML = '<div style="color:var(--danger)">Failed to load dates.</div>';
    }
}

async function loadHistoryForDate(date, btnElement) {
    currentHistoryDate = date;
    // UI Update
    document.querySelectorAll('.btn-date').forEach(b => b.classList.remove('active'));
    if (btnElement) btnElement.classList.add('active');

    historyTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">Fetching records...</td></tr>';
    historyStatus.innerText = `Loading attendance for ${date}...`;
    btnExportHistory.style.display = 'none';

    try {
        const q = query(collection(db, COLL_ATTENDANCE),
            where("spaceId", "==", currentSpace.id),
            where("date", "==", date));
        const snap = await getDocs(q);
        const records = [];
        snap.forEach(doc => records.push(doc.data()));

        // Sort Alphabetically
        records.sort((a, b) => a.name.localeCompare(b.name));
        currentHistoryRecords = records;

        renderHistoryTable(records);
        btnExportHistory.style.display = records.length > 0 ? 'block' : 'none';

    } catch (err) {
        console.error("History Data Load Fail:", err);
        historyTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--danger);">Error loading data.</td></tr>';
    }
}

function renderHistoryTable(records) {
    if (records.length === 0) {
        historyTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:#888;">No records found.</td></tr>';
        historyStatus.innerText = `No data for this date.`;
        return;
    }

    // Deduplicate for UI display: one person once
    const uniqueRecords = [];
    const seenNames = new Set();

    // records are already sorted alphabetically by name
    records.forEach(r => {
        if (!seenNames.has(r.name)) {
            uniqueRecords.push(r);
            seenNames.add(r.name);
        }
    });

    historyTableBody.innerHTML = '';
    uniqueRecords.forEach(r => {
        const time = r.timestamp ? (r.timestamp.toDate ? r.timestamp.toDate() : new Date(r.timestamp)).toLocaleTimeString() : 'N/A';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${r.name}</strong></td>
            <td>${r.regNo || '-'}</td>
            <td>${r.course || '-'}</td>
            <td>${time}</td>
        `;
        historyTableBody.appendChild(tr);
    });

    historyStatus.innerText = `Showing ${uniqueRecords.length} unique people.`;
}

// History Search
if (historySearchInput) {
    historySearchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = currentHistoryRecords.filter(r =>
            r.name.toLowerCase().includes(term) ||
            (r.regNo && r.regNo.toLowerCase().includes(term)) ||
            (r.course && r.course.toLowerCase().includes(term))
        );
        renderHistoryTable(filtered);
    });
}

// History Export
if (btnExportHistory) {
    btnExportHistory.addEventListener('click', () => {
        if (currentHistoryRecords.length === 0) return;

        let csv = "Name,Registration Number,Course,Time\n";
        // Export ALL activities as requested
        currentHistoryRecords.forEach(r => {
            const time = r.timestamp ? (r.timestamp.toDate ? r.timestamp.toDate() : new Date(r.timestamp)).toLocaleTimeString() : 'N/A';
            csv += `"${r.name}","${r.regNo || ''}","${r.course || ''}","${time}"\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `attendance_${currentSpace.name.replace(/\s+/g, '_')}_${currentHistoryDate}.csv`;
        link.click();
    });
}

// ==========================================
// 4. FACE API & CAMERA
// ==========================================

const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';
// Fallback URL if the primary one fails
const FALLBACK_MODEL_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/';

async function loadModels(url) {
    try {
        statusBadge.innerText = "Loading Models...";
        loadingText.innerText = `Loading AI models from ${url.includes('github') ? 'GitHub' : 'CDN'}...`;

        await Promise.all([
            faceapi.nets.ssdMobilenetv1.loadFromUri(url),
            faceapi.nets.faceLandmark68Net.loadFromUri(url),
            faceapi.nets.faceRecognitionNet.loadFromUri(url)
        ]);

        console.log("Models Loaded successfully from", url);
        return true;
    } catch (err) {
        console.warn(`Failed to load models from ${url}:`, err);
        return false;
    }
}

async function initSystem() {
    if (isModelsLoaded) {
        if (!video.srcObject) startVideo();
        return;
    }
    console.log("Initializing Attendance SystemAI...");

    // Check if we are on file:// protocol, which often breaks modules/fetch
    if (window.location.protocol === 'file:') {
        console.warn("Running on file:// protocol. This may cause CORS issues with module imports and fetch requests.");
        // Try to explain to the user if it gets stuck
        setTimeout(() => {
            if (!isModelsLoaded) {
                loadingText.innerHTML = "Stuck Loading? <br><small>Browsers often block local file access. <br>Try opening this folder in VS Code and using 'Live Server'.</small>";
            }
        }, 8000);
    }

    let loaded = await loadModels(MODEL_URL);
    if (!loaded) {
        console.log("Trying fallback model URL...");
        loaded = await loadModels(FALLBACK_MODEL_URL);
    }

    if (loaded) {
        console.log("Models Loaded. Requesting camera access...");
        isModelsLoaded = true;
        loadingText.innerText = "Requesting Camera Access...";
        startVideo();
    } else {
        loadingText.innerHTML = "Error: Could not load AI models. <br><small>Please check your internet connection.</small>";
        statusBadge.innerText = "Load Error";
        statusBadge.className = "status-badge status-error";

        // Add a retry button to the UI
        const retryBtn = document.createElement('button');
        retryBtn.innerText = "Retry Loading";
        retryBtn.className = "btn-primary";
        retryBtn.style.marginTop = "10px";
        retryBtn.onclick = () => window.location.reload();
        loadingOverlay.appendChild(retryBtn);
    }
}

// System initialization will be triggered when entering a space
// initSystem();

function startVideo() {
    statusBadge.innerText = "Accessing Camera...";

    const constraints = {
        video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            aspectRatio: 1.777777778,
            facingMode: "user"
        }
    };

    navigator.mediaDevices.getUserMedia(constraints)
        .then(stream => {
            console.log("Camera access granted.");
            video.srcObject = stream;
            // Wait for video to actually start playing
            video.onloadedmetadata = () => {
                video.play().then(() => {
                    console.log("Video playing.");
                    loadingOverlay.style.display = "none";

                    // Fade out 3D face after video starts
                    const face3D = document.getElementById('face-3d-container');
                    if (face3D) {
                        face3D.classList.add('fade-out');
                        setTimeout(() => face3D.style.display = 'none', 800);
                    }

                    statusBadge.innerText = "System Active";
                    statusBadge.className = "status-badge status-ready";
                }).catch(err => {
                    console.error("Video Play Error:", err);
                    loadingText.innerHTML = "Click to Start Camera";
                    // Add a button since some browsers block auto-play
                    const startBtn = document.createElement('button');
                    startBtn.innerText = "Start Camera";
                    startBtn.className = "btn-primary";
                    startBtn.onclick = () => {
                        video.play();
                        loadingOverlay.style.display = "none";
                        statusBadge.innerText = "System Active";
                    };
                    loadingOverlay.appendChild(startBtn);
                });
            };
        })
        .catch(err => {
            console.error("Camera Error:", err);
            loadingText.innerHTML = "Camera Access Denied <br><small>Please enable camera in your browser settings.</small>";
            statusBadge.innerText = "Camera Error";
            statusBadge.className = "status-badge status-error";

            // Show overlay with error color
            loadingOverlay.style.background = "rgba(120, 0, 0, 0.9)";

            // Add a troubleshooting button
            const helpBtn = document.createElement('button');
            helpBtn.innerText = "How to fix?";
            helpBtn.className = "btn-secondary";
            helpBtn.style.marginTop = "10px";
            helpBtn.onclick = () => alert("1. Click the lock icon in the address bar.\n2. Ensure Camera is set to 'Allow'.\n3. Refresh the page.");
            loadingOverlay.appendChild(helpBtn);
        });
}


// Space Config & Form

function updateRegistrationForm() {
    if (!currentSpace) return;
    const config = currentSpace.config || {};
    dynamicFieldsContainer.innerHTML = '';

    // Always include Name
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.id = 'reg-name';
    nameInput.placeholder = 'Full Name';
    dynamicFieldsContainer.appendChild(nameInput);

    // Check for optional fields
    if (config.regNo) {
        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'reg-regNo';
        input.placeholder = 'Registration Number';
        dynamicFieldsContainer.appendChild(input);
    }
    if (config.course) {
        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'reg-course';
        input.placeholder = 'Course / Department';
        dynamicFieldsContainer.appendChild(input);
    }
    if (config.email) {
        const input = document.createElement('input');
        input.type = 'email';
        input.id = 'reg-email';
        input.placeholder = 'Email ID';
        dynamicFieldsContainer.appendChild(input);
    }
    if (config.bloodGroup) {
        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'reg-bloodGroup';
        input.placeholder = 'Blood Group';
        dynamicFieldsContainer.appendChild(input);
    }
    if (config.weight) {
        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'reg-weight';
        input.placeholder = 'Weight (kg)';
        dynamicFieldsContainer.appendChild(input);
    }
    if (config.phone) {
        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'reg-phone';
        input.placeholder = 'Phone Number';
        dynamicFieldsContainer.appendChild(input);
    }
}

async function saveSpaceConfig() {
    if (!currentSpace) return;
    const newConfig = {};
    document.querySelectorAll('.field-toggle').forEach(el => {
        if (!el.id.includes('geofence')) {
            newConfig[el.dataset.field] = el.checked;
        }
    });

    const geofenceEnabled = document.getElementById('geofence-enabled').checked;
    const geofenceRadius = parseFloat(document.getElementById('geofence-radius').value) || 100;
    const locText = document.getElementById('geofence-loc-status').innerText;
    let lat = null, lng = null;
    if (locText.includes('Lat:')) {
        const parts = locText.split(',');
        lat = parseFloat(parts[0].split(':')[1]);
        lng = parseFloat(parts[1].split(':')[1]);
    }

    try {
        await updateDoc(doc(db, COLL_SPACES, currentSpace.id), {
            config: newConfig,
            geofencing: {
                enabled: geofenceEnabled,
                radius: geofenceRadius,
                center: lat && lng ? { lat, lng } : null
            }
        });
        currentSpace.config = newConfig;
        currentSpace.geofencing = { enabled: geofenceEnabled, radius: geofenceRadius, center: lat && lng ? { lat, lng } : null };
        alert("Settings saved!");
        setMode('attendance');
    } catch (err) {
        alert(err.message);
    }
}

document.getElementById('btn-save-config').addEventListener('click', saveSpaceConfig);

// Handle toggle inputs initial state when entering Settings mode
function syncConfigToggles() {
    if (!currentSpace) return;
    const config = currentSpace.config || {};
    document.querySelectorAll('.field-toggle').forEach(el => {
        if (!el.id.includes('geofence')) {
            el.checked = !!config[el.dataset.field];
        }
    });

    const gf = currentSpace.geofencing || {};
    document.getElementById('geofence-enabled').checked = !!gf.enabled;
    document.getElementById('geofence-radius').value = gf.radius || 100;
    if (gf.center) {
        document.getElementById('geofence-loc-status').innerText = `Lat: ${gf.center.lat.toFixed(6)}, Lng: ${gf.center.lng.toFixed(6)}`;
    } else {
        document.getElementById('geofence-loc-status').innerText = "Location not set";
    }
}

// Database Listener

let unsubscribeUsers = null;

function startDbListener() {
    if (!currentSpace) return;
    if (unsubscribeUsers) unsubscribeUsers();

    // Clear previous detection data immediately to ensure isolation
    labeledDescriptors = [];
    faceMatcher = null;
    nameToDocId = {};
    allUsersData = [];
    todayListContainer.innerHTML = '<div style="padding:10px; text-align:center; color:#888;">Switching workspace...</div>';

    const q = query(collection(db, COLL_USERS), where("spaceId", "==", currentSpace.id));

    unsubscribeUsers = onSnapshot(q, (snapshot) => {
        const descriptors = [];
        const tempMap = {};
        const tempAllData = [];
        let presentTodayCount = 0;
        let todayAttendeesHTML = '';
        const todayStr = new Date().toDateString();

        snapshot.forEach(doc => {
            const data = doc.data();
            tempAllData.push(data);

            if (data.name && data.descriptor) {
                try {
                    const descFloat32 = new Float32Array(data.descriptor);
                    descriptors.push(new faceapi.LabeledFaceDescriptors(data.name, [descFloat32]));
                    tempMap[data.name] = doc.id;
                } catch (e) {
                    console.warn("Skipping corrupt face data", data.name);
                }
            }

            if (data.lastAttendance === todayStr) {
                presentTodayCount++;
                todayAttendeesHTML += `
                    <div class="list-item list-item-new">
                        <div>
                            <strong>${data.name}</strong>
                            <span class="badge-course">${data.course || data.regNo || ''}</span>
                        </div>
                        <div style="color:var(--success)">✔</div>
                    </div>
                `;
            }
        });

        labeledDescriptors = descriptors;
        nameToDocId = tempMap;
        allUsersData = tempAllData;

        if (labeledDescriptors.length > 0) {
            faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.4);
        }

        todayCountDisplay.innerText = presentTodayCount;
        todayListContainer.innerHTML = todayAttendeesHTML || '<div style="padding:10px; text-align:center; color:#888;">No attendance yet today</div>';
    });
}

// Drawing Utils

function drawCustomFaceBox(ctx, box, label, isMatch, confidence) {
    const { x, y, width, height } = box;
    const color = isMatch ? '#fbbf24' : '#ef4444'; // Yellow for match, Red for unknown/low
    const cornerSize = 25;

    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';

    // Add a subtle glow
    ctx.shadowBlur = 10;
    ctx.shadowColor = color;

    // Top Left
    ctx.beginPath();
    ctx.moveTo(x, y + cornerSize);
    ctx.lineTo(x, y);
    ctx.lineTo(x + cornerSize, y);
    ctx.stroke();

    // Top Right
    ctx.beginPath();
    ctx.moveTo(x + width - cornerSize, y);
    ctx.lineTo(x + width, y);
    ctx.lineTo(x + width, y + cornerSize);
    ctx.stroke();

    // Bottom Left
    ctx.beginPath();
    ctx.moveTo(x, y + height - cornerSize);
    ctx.lineTo(x, y + height);
    ctx.lineTo(x + cornerSize, y + height);
    ctx.stroke();

    // Bottom Right
    ctx.beginPath();
    ctx.moveTo(x + width - cornerSize, y + height);
    ctx.lineTo(x + width, y + height);
    ctx.lineTo(x + width, y + height - cornerSize);
    ctx.stroke();

    ctx.shadowBlur = 0; // Reset shadow

    // Draw Label Box (Corner Positioned)
    let labelText = '';
    if (isMatch) {
        labelText = `${label} (${confidence}%)`;
    } else if (label === 'unknown') {
        labelText = 'Unknown Face';
    } else {
        labelText = `Low Match (${confidence}%)`;
    }

    ctx.font = 'bold 12px Inter';
    const textWidth = ctx.measureText(labelText).width;
    const padding = 6;

    // Position at Bottom Right corner of box
    const labelX = x + width - textWidth - padding * 2;
    const labelY = y + height - 25;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(labelX, labelY, textWidth + padding * 2, 22, 4);
    ctx.fill();

    ctx.fillStyle = color;
    ctx.fillText(labelText, labelX + padding, labelY + 15);
}

function drawFaceMesh(ctx, landmarks) {
    const points = landmarks.positions;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 0.5;

    // Drawing a simplified mesh (connecting key points)
    // Jaw
    drawPath(ctx, points.slice(0, 17));
    // Eye brows
    drawPath(ctx, points.slice(17, 22));
    drawPath(ctx, points.slice(22, 27));
    // Nose bridge
    drawPath(ctx, points.slice(27, 31));
    drawPath(ctx, points.slice(31, 36));
    // Eyes
    drawPath(ctx, points.slice(36, 42), true);
    drawPath(ctx, points.slice(42, 48), true);
    // Lips
    drawPath(ctx, points.slice(48, 60), true);
    drawPath(ctx, points.slice(60, 68), true);

    // Draw little dots at landmarks
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    points.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.5, 0, 2 * Math.PI);
        ctx.fill();
    });
}

function drawPath(ctx, points, close = false) {
    if (points.length === 0) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }
    if (close) ctx.closePath();
    ctx.stroke();
}

// Main Loop

video.addEventListener('play', () => {
    // Responsive alignment: Use offsetWidth/Height to match the rendered video size
    const updateDisplaySize = () => {
        const displaySize = { width: video.offsetWidth, height: video.offsetHeight };
        faceapi.matchDimensions(canvas, displaySize);
        return displaySize;
    };

    let displaySize = updateDisplaySize();
    window.addEventListener('resize', () => { displaySize = updateDisplaySize(); });

    setInterval(async () => {
        if (!isModelsLoaded || !video.srcObject) return;

        // Skip processing if registering or if tab is hidden
        if (currentMode === 'registration' || document.hidden) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            return;
        }

        // Detect
        const detections = await faceapi.detectAllFaces(video)
            .withFaceLandmarks()
            .withFaceDescriptors();

        const resizedDetections = faceapi.resizeResults(detections, displaySize);

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // UI Feedback: Scanning indicator
        if (detections.length > 0) {
            if (scanIndicator) scanIndicator.style.display = 'block';
        } else {
            if (scanIndicator) scanIndicator.style.display = 'none';
        }

        if (!faceMatcher) return;

        const results = resizedDetections.map(d => faceMatcher.findBestMatch(d.descriptor));

        results.forEach((result, i) => {
            const detection = resizedDetections[i];
            const box = detection.detection.box;
            let { label, distance } = result;

            const confidence = Math.round((1 - distance) * 100);

            // Strict 20% Threshold logic
            const isMatch = label !== 'unknown' && confidence >= 20;

            // If below 20%, treat as unknown visually even if faceapi guessed a name
            const displayLabel = isMatch ? label : (label === 'unknown' ? 'unknown' : label);
            // Note: drawCustomFaceBox handles formatting based on isMatch

            // Draw Face Mesh Animation
            if (detection.landmarks) {
                drawFaceMesh(ctx, detection.landmarks);
            }


            // Draw custom box
            drawCustomFaceBox(ctx, box, displayLabel, isMatch, confidence);

            // Validation logic
            if (isMatch) {
                detectionHistory[label] = (detectionHistory[label] || 0) + 1;

                if (detectionHistory[label] >= VALIDATION_THRESHOLD) {
                    markAttendance(label);
                    detectionHistory[label] = 0;
                }
            }
        });

        // Cleanup detection history for people not in frame
        Object.keys(detectionHistory).forEach(name => {
            const isStillInFrame = results.some(r => r.label === name);
            if (!isStillInFrame) {
                detectionHistory[name] = Math.max(0, (detectionHistory[name] || 0) - 1);
            }
        });
    }, 100); // Check every 100ms
});


// Refactored Registration Logic
async function handleCameraRegistration() {
    if (!currentUser || !currentSpace) return alert("System not ready.");

    const nameEl = document.getElementById('reg-name');
    const name = nameEl ? nameEl.value.trim() : '';
    if (!name) return alert("Name is required.");

    const metadata = collectRegistrationMetadata();

    regFeedback.innerText = "Scanning Camera...";
    regFeedback.style.color = "var(--primary)";

    const detection = await faceapi.detectSingleFace(video)
        .withFaceLandmarks()
        .withFaceDescriptor();

    if (detection) {
        await finalizeRegistration(name, metadata, Array.from(detection.descriptor));
    } else {
        regFeedback.innerText = "No face detected in camera.";
        regFeedback.style.color = "var(--danger)";
    }
}

async function handlePhotoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const nameEl = document.getElementById('reg-name');
    const name = nameEl ? nameEl.value.trim() : '';
    if (!name) {
        alert("Please enter a name first.");
        e.target.value = '';
        return;
    }

    const metadata = collectRegistrationMetadata();
    regFeedback.innerText = "Processing Photo...";
    regFeedback.style.color = "var(--primary)";

    try {
        const img = await faceapi.bufferToImage(file);
        const detection = await faceapi.detectSingleFace(img)
            .withFaceLandmarks()
            .withFaceDescriptor();

        if (detection) {
            await finalizeRegistration(name, metadata, Array.from(detection.descriptor));
        } else {
            regFeedback.innerText = "No face detected in uploaded photo.";
            regFeedback.style.color = "var(--danger)";
        }
    } catch (err) {
        console.error("Upload Error:", err);
        regFeedback.innerText = "Error processing image.";
    }
    e.target.value = ''; // Reset input
}

function collectRegistrationMetadata() {
    const metadata = {};
    const fields = ['regNo', 'course', 'email', 'bloodGroup', 'weight', 'phone'];
    fields.forEach(f => {
        const el = document.getElementById(`reg-${f}`);
        if (el) metadata[f] = el.value.trim();
    });
    return metadata;
}

async function finalizeRegistration(name, metadata, descriptorArray) {
    if (nameToDocId[name]) {
        alert("A user with this name already exists.");
        regFeedback.innerText = "Name taken.";
        return;
    }

    try {
        await addDoc(collection(db, COLL_USERS), {
            spaceId: currentSpace.id,
            name: name,
            ...metadata,
            descriptor: descriptorArray,
            attendanceCount: 0,
            lastAttendance: null,
            createdAt: new Date()
        });

        alert(`Registered ${name} successfully!`);
        resetRegistrationForm();
        regFeedback.innerText = "Success!";
        regFeedback.style.color = "var(--success)";
    } catch (error) {
        console.error("Write Error:", error);
        alert("Failed to save: " + error.message);
    }
}

function resetRegistrationForm() {
    const inputs = regForm.querySelectorAll('input');
    inputs.forEach(i => i.value = "");
}

async function markAttendance(name) {
    const now = Date.now();
    const lastMarked = attendanceCooldowns[name] || 0;

    // 1 minute cooldown
    if (now - lastMarked < 60000) return;

    attendanceCooldowns[name] = now;
    const timeStr = new Date().toLocaleTimeString();

    addLiveLogEntry(name, timeStr);

    const docId = nameToDocId[name];
    if (!docId) return;

    try {
        const userDocRef = doc(db, COLL_USERS, docId);
        const todayDate = new Date().toDateString();

        await updateDoc(userDocRef, {
            lastAttendance: todayDate,
            attendanceCount: increment(1)
        });

        // Save to History Collection
        const dateId = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const userSnap = await getDoc(userDocRef);
        const userData = userSnap.data();

        await addDoc(collection(db, COLL_ATTENDANCE), {
            spaceId: currentSpace.id,
            userId: docId,
            name: name,
            regNo: userData.regNo || '',
            course: userData.course || '',
            date: dateId,
            timestamp: new Date()
        });

        // Track unique dates for this space
        await updateDoc(doc(db, COLL_SPACES, currentSpace.id), {
            [`historyDates.${dateId}`]: true
        });

        // Visual Success Feedback
        const wrapper = document.querySelector('.camera-wrapper');
        if (wrapper) {
            wrapper.classList.add('success-pulse');
            setTimeout(() => wrapper.classList.remove('success-pulse'), 400);
        }

    } catch (err) {
        console.error("Attendance Update Error:", err);
    }
}

// Geofencing: Get Current Location
if (btnSetLocation) {
    btnSetLocation.addEventListener('click', () => {
        if (!navigator.geolocation) {
            alert("Geolocation is not supported by your browser.");
            return;
        }

        geoStatus.innerText = "Finding you...";
        navigator.geolocation.getCurrentPosition((pos) => {
            const { latitude, longitude } = pos.coords;
            btnSetLocation.dataset.lat = latitude;
            btnSetLocation.dataset.lng = longitude;
            geoStatus.innerText = `Local Set: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
            geoStatus.style.color = "var(--success)";
        }, (err) => {
            console.error("Geo Error:", err);
            geoStatus.innerText = "Error: Permission denied / signal weak.";
            geoStatus.style.color = "var(--danger)";
        }, { enableHighAccuracy: true });
    });
}

// UI Handlers

document.getElementById('btn-mode-attend').addEventListener('click', () => setMode('attendance'));
document.getElementById('btn-mode-reg').addEventListener('click', () => setMode('registration'));
document.getElementById('btn-mode-analytics').addEventListener('click', () => setMode('analytics'));
document.getElementById('btn-mode-config').addEventListener('click', () => setMode('config'));

if (btnCapture) btnCapture.addEventListener('click', handleCameraRegistration);
if (btnUploadTrigger) btnUploadTrigger.addEventListener('click', () => inputUploadPhoto.click());
if (inputUploadPhoto) inputUploadPhoto.addEventListener('change', handlePhotoUpload);
if (btnExport) btnExport.addEventListener('click', exportToCSV);

function setMode(mode) {
    currentMode = mode;

    // UI elements update
    [regForm, attendInfo, configForm].forEach(el => el.classList.add('hidden'));
    [
        document.getElementById('btn-mode-attend'),
        document.getElementById('btn-mode-reg'),
        document.getElementById('btn-mode-config')
    ].forEach(btn => btn.classList.remove('active'));

    if (mode === 'registration') {
        regForm.classList.remove('hidden');
        document.getElementById('btn-mode-reg').classList.add('active');
        statusBadge.innerText = "Registration Mode";
        updateRegistrationForm(); // Ensure fields are fresh
    } else if (mode === 'config') {
        configForm.classList.remove('hidden');
        document.getElementById('btn-mode-config').classList.add('active');
        statusBadge.innerText = "Configuration Mode";
        syncConfigToggles();
    } else if (mode === 'analytics') {
        analyticsPanel.classList.remove('hidden');
        document.getElementById('btn-mode-analytics').classList.add('active');
        statusBadge.innerText = "Analytics Mode";
        renderAnalytics();
    } else {
        attendInfo.classList.remove('hidden');
        document.getElementById('btn-mode-attend').classList.add('active');
        statusBadge.innerText = "Attendance Mode";
    }
}

async function renderAnalytics() {
    if (!currentSpace) return;

    try {
        const q = query(collection(db, COLL_ATTENDANCE), where("spaceId", "==", currentSpace.id));
        const snap = await getDocs(q);
        const records = snap.docs.map(d => d.data());

        // Process Daily Data
        const dailyCounts = {};
        const hourlyCounts = Array(24).fill(0);

        records.forEach(r => {
            const date = r.date; // YYYY-MM-DD
            dailyCounts[date] = (dailyCounts[date] || 0) + 1;

            if (r.timestamp) {
                const ts = r.timestamp.toDate ? r.timestamp.toDate() : new Date(r.timestamp);
                const hour = ts.getHours();
                hourlyCounts[hour]++;
            }
        });

        const sortedDates = Object.keys(dailyCounts).sort();
        const dailyValues = sortedDates.map(d => dailyCounts[d]);

        // Draw Daily Chart
        const ctxDaily = document.getElementById('chart-daily').getContext('2d');
        if (dailyChart) dailyChart.destroy();
        dailyChart = new Chart(ctxDaily, {
            type: 'bar',
            data: {
                labels: sortedDates.map(d => d.split('-').slice(1).join('/')),
                datasets: [{
                    label: 'Attendance',
                    data: dailyValues,
                    backgroundColor: 'rgba(0, 242, 255, 0.5)',
                    borderColor: '#00f2ff',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#888' } },
                    x: { grid: { display: false }, ticks: { color: '#888' } }
                },
                plugins: { legend: { display: false } }
            }
        });

        // Draw Hourly Chart
        const ctxHourly = document.getElementById('chart-hourly').getContext('2d');
        if (hourlyChart) hourlyChart.destroy();
        hourlyChart = new Chart(ctxHourly, {
            type: 'line',
            data: {
                labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
                datasets: [{
                    label: 'Activity',
                    data: hourlyCounts,
                    borderColor: '#ff00f2',
                    backgroundColor: 'rgba(255, 0, 242, 0.1)',
                    fill: true,
                    tension: 0.4,
                    borderWidth: 2,
                    pointRadius: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#888' } },
                    x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#888', maxRotation: 0 } }
                },
                plugins: { legend: { display: false } }
            }
        });
    } catch (err) {
        console.error("Analytics Fail:", err);
    }
}

function addLiveLogEntry(name, time) {
    const div = document.createElement('div');
    div.className = 'list-item list-item-new';
    div.innerHTML = `
        <span><strong>${name}</strong></span>
        <span class="log-success">seen @ ${time}</span>
    `;
    liveLogsContainer.prepend(div);
    // Limit log entries to 50 for performance
    if (liveLogsContainer.children.length > 50) {
        liveLogsContainer.removeChild(liveLogsContainer.lastChild);
    }
}

function exportToCSV() {
    if (allUsersData.length === 0) {
        alert("No data available for this workspace.");
        return;
    }

    const headers = ["Name", "Reg No", "Course", "Phone", "Total Attendance", "Last Seen"];
    const rows = allUsersData.map(u => [
        `"${u.name || 'Unknown'}"`,
        `"${u.regNo || 'N/A'}"`,
        `"${u.course || 'N/A'}"`,
        `"${u.phone || 'N/A'}"`,
        u.attendanceCount || 0,
        `"${u.lastAttendance || 'Never'}"`
    ]);

    const csvContent = headers.join(",") + "\n" + rows.map(r => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `attendance_${currentSpace.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
}

setMode('attendance');

// 3D Animation Section
function init3DFace(containerId) {
    const container = document.getElementById(containerId);
    if (!container || container.dataset.initialized) return;

    let width = container.offsetWidth;
    let height = container.offsetHeight;

    if (width === 0 || height === 0) {
        width = 300; height = 400;
        setTimeout(() => { try { window.dispatchEvent(new Event('resize')); } catch (e) { } }, 500);
    }

    container.dataset.initialized = "true";

    const scene3D = new THREE.Scene();
    const camera3D = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera3D.position.z = 7;

    const renderer3D = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer3D.setSize(width, height);
    renderer3D.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer3D.domElement);

    // --- Advanced Procedural Head (Plexus Base) ---
    const geometry = new THREE.IcosahedronGeometry(2.5, 3); // Base density
    const positionAttribute = geometry.attributes.position;
    const vertex = new THREE.Vector3();

    for (let i = 0; i < positionAttribute.count; i++) {
        vertex.fromBufferAttribute(positionAttribute, i);

        // Advanced Shaping
        let x = vertex.x; let y = vertex.y; let z = vertex.z;

        y *= 1.35; // Height

        // Taper for jaw
        if (y < 0) {
            const taper = 1 - (Math.abs(y) * 0.25);
            x *= taper;
            z *= taper * 0.8;
        }

        // Eye Sockets (Simplified)
        if (y > 0.3 && y < 0.8 && Math.abs(x) > 0.4 && z > 1.5) {
            z -= 0.2;
        }

        // Nose Bridge
        if (y > -0.2 && y < 0.6 && Math.abs(x) < 0.3 && z > 1.8) {
            z += 0.25;
        }

        // Mouth area
        if (y > -1.0 && y < -0.5 && Math.abs(x) < 0.6 && z > 1.7) {
            z += 0.1;
        }

        positionAttribute.setXYZ(i, x, y, z);
    }
    positionAttribute.needsUpdate = true;

    const headGroup = new THREE.Group();
    scene3D.add(headGroup);

    // --- The Plexus Effect (Lines) ---
    const lineMaterial = new THREE.LineBasicMaterial({
        color: 0x0ea5e9,
        transparent: true,
        opacity: 0.3,
        blending: THREE.AdditiveBlending
    });

    const linesGeometry = new THREE.BufferGeometry();
    const linePositions = [];
    const pointsArray = [];

    for (let i = 0; i < positionAttribute.count; i++) {
        pointsArray.push(new THREE.Vector3().fromBufferAttribute(positionAttribute, i));
    }

    // Connect nearby vertices
    for (let i = 0; i < pointsArray.length; i++) {
        for (let j = i + 1; j < pointsArray.length; j++) {
            const dist = pointsArray[i].distanceTo(pointsArray[j]);
            if (dist < 0.9) {
                linePositions.push(pointsArray[i].x, pointsArray[i].y, pointsArray[i].z);
                linePositions.push(pointsArray[j].x, pointsArray[j].y, pointsArray[j].z);
            }
        }
    }
    linesGeometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
    const plexusLines = new THREE.LineSegments(linesGeometry, lineMaterial);
    headGroup.add(plexusLines);

    // --- Core Points ---
    const pointsMaterial = new THREE.PointsMaterial({
        color: 0x38bdf8,
        size: 0.05,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending
    });
    const corePoints = new THREE.Points(geometry, pointsMaterial);
    headGroup.add(corePoints);

    // --- Orbital Network ---
    const orbits = new THREE.Group();
    scene3D.add(orbits);

    const createOrbit = (radius, color, speed, axis) => {
        const curve = new THREE.EllipseCurve(0, 0, radius, radius * 1.2, 0, 2 * Math.PI, false, 0);
        const points = curve.getPoints(100);
        const orbitGeo = new THREE.BufferGeometry().setFromPoints(points);
        const orbitMat = new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: 0.2 });
        const orbitLine = new THREE.Line(orbitGeo, orbitMat);

        if (axis === 'x') orbitLine.rotation.x = Math.PI / 2;
        if (axis === 'z') orbitLine.rotation.y = Math.PI / 2;

        const orbitGroup = new THREE.Group();
        orbitGroup.add(orbitLine);

        // Add tiny nodes on orbit
        const nodeGeo = new THREE.SphereGeometry(0.04, 8, 8);
        const nodeMat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.6 });
        const node = new THREE.Mesh(nodeGeo, nodeMat);
        node.position.x = radius;
        orbitGroup.add(node);

        return { group: orbitGroup, speed: speed };
    };

    const orbitData = [
        createOrbit(4.5, 0x0ea5e9, 0.005, 'x'),
        createOrbit(5.0, 0x38bdf8, -0.007, 'y'),
        createOrbit(4.2, 0x818cf8, 0.004, 'z')
    ];
    orbitData.forEach(o => orbits.add(o.group));

    // --- Background Depth ---
    const bgCount = 500;
    const bgGeo = new THREE.BufferGeometry();
    const bgPos = new Float32Array(bgCount * 3);
    for (let i = 0; i < bgCount * 3; i++) bgPos[i] = (Math.random() - 0.5) * 25;
    bgGeo.setAttribute('position', new THREE.BufferAttribute(bgPos, 3));
    const bgPoints = new THREE.Points(bgGeo, new THREE.PointsMaterial({ color: 0x0ea5e9, size: 0.02, transparent: true, opacity: 0.2 }));
    scene3D.add(bgPoints);

    // --- Lighting (Subtle) ---
    scene3D.add(new THREE.AmbientLight(0xffffff, 0.2));
    const spotlight = new THREE.PointLight(0x0ea5e9, 1);
    spotlight.position.set(10, 10, 10);
    scene3D.add(spotlight);

    // --- Animation ---
    let time = 0;
    function animate() {
        requestAnimationFrame(animate);
        time += 0.01;

        headGroup.rotation.y = Math.sin(time * 0.2) * 0.4;
        headGroup.rotation.x = Math.cos(time * 0.15) * 0.1;

        // Pulse Plexus
        plexusLines.material.opacity = 0.2 + Math.sin(time * 2) * 0.1;
        corePoints.material.opacity = 0.6 + Math.sin(time * 3) * 0.2;

        // Animate Orbits
        orbitData.forEach(o => {
            o.group.rotation.y += o.speed;
            o.group.rotation.x += o.speed * 0.5;
        });

        // Rotate background
        bgPoints.rotation.y += 0.0005;

        renderer3D.render(scene3D, camera3D);
    }
    animate();

    const statusEl = document.getElementById('guide-status-text');
    if (statusEl && containerId === 'portal-guide-container') {
        // Portal guide status log logic removed
    }

    window.addEventListener('resize', () => {
        if (!container.offsetWidth) return;
        camera3D.aspect = container.offsetWidth / container.offsetHeight;
        camera3D.updateProjectionMatrix();
        renderer3D.setSize(container.offsetWidth, container.offsetHeight);
    });
}


