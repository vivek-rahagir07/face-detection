// Import Firebase Modules (Modular SDK 11.6.1)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, updateDoc, doc, getDoc, onSnapshot, increment, query, where, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";


// --- PWA Service Worker Registration ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('SW Registered', reg))
            .catch(err => console.error('SW Registration Fail', err));
    });
}

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
const btnPortalContinue = document.getElementById('btn-portal-continue');
const portalMobileStart = document.getElementById('portal-mobile-start');
const portalCard = document.querySelector('.portal-card');

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
const tabPresent = document.getElementById('tab-present');
const tabAbsent = document.getElementById('tab-absent');

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
let activeAttendanceTab = 'present';
let lastPresentHTML = '';
let lastAbsentHTML = '';

// Smoothing box state
const smoothBoxes = {}; // { label: { x, y, w, h } }
const LERP_FACTOR = 0.4;

const qrModal = document.getElementById('qr-modal');
const btnQrPresence = document.getElementById('btn-qr-presence');
const btnCloseQr = document.getElementById('btn-close-qr');
const qrImage = document.getElementById('qr-image');
const qrTimerDisplay = document.getElementById('qr-timer');
const qrStatus = document.getElementById('qr-status');

// New Analytics & Geo Elements
const analyticsPanel = document.getElementById('analytics-panel');
const peopleListContainer = document.getElementById('people-list-container');
const peopleSearchInput = document.getElementById('people-search');

// State for magic link session
let isMagicLinkSession = false;
let isAIPaused = false;
const btnModeAnalytics = document.getElementById('btn-mode-analytics');
const configGeoEnabled = document.getElementById('config-geo-enabled');
const configGeoRadius = document.getElementById('config-geo-radius');
const btnSetLocation = document.getElementById('btn-set-location');
const geoStatus = document.getElementById('geo-status');

// Individual Analytics & Management Elements
const editModal = document.getElementById('edit-modal');
const btnCloseEdit = document.getElementById('btn-close-edit');
const editNameInput = document.getElementById('edit-name');
const editRegNoInput = document.getElementById('edit-regNo');
const editCourseInput = document.getElementById('edit-course');
const btnSaveEdit = document.getElementById('btn-save-edit');
const btnDeletePerson = document.getElementById('btn-delete-person');
const editPersonNameTitle = document.getElementById('edit-person-name-title');

let editingPersonId = null;

// New UX Refinement Elements
const confirmModal = document.getElementById('confirm-modal');
const confirmMessage = document.getElementById('confirm-message');
const btnConfirmYes = document.getElementById('btn-confirm-yes');
const btnConfirmNo = document.getElementById('btn-confirm-no');
const toastContainer = document.getElementById('toast-container');

// Mobile Sidebar DOM Elements
const mobileSidebar = document.getElementById('mobile-sidebar');
const btnMobileMenu = document.getElementById('btn-mobile-menu');
const btnCloseSidebar = document.getElementById('btn-close-sidebar');
const sideNavItems = document.querySelectorAll('#mobile-sidebar .nav-item[data-mode]');
const sideBtnQr = document.getElementById('side-btn-qr');
const sideBtnHistory = document.getElementById('side-btn-history');
const sideBtnExport = document.getElementById('side-btn-export');

let confirmCallback = null;

// HUD Animation State
let hudScanCycle = 0; // 0 to 1
let hudScanDir = 1;
let hudRotation = 0; // Continuous rotation for rings
const lastSpoken = {};

// Device Detection for Performance
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
const DETECTION_INTERVAL = isMobile ? 250 : 100;

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

function speak(text, gender = 'male') {
    if (!currentSpace || !currentSpace.config || !currentSpace.config.voiceEnabled) return;

    const synth = window.speechSynthesis;

    // Create a new utterance
    const utterance = new SpeechSynthesisUtterance(text);

    const performSpeak = () => {
        if (synth.speaking) return;
        const voices = synth.getVoices();

        // Attempt to find cool/premium voices
        let selectedVoice = null;
        if (gender === 'female') {
            // Look for premium female voices
            selectedVoice = voices.find(v => v.name.includes('Samantha') || v.name.includes('Google US English') || v.name.includes('Victoria') || v.name.includes('Female'));
            utterance.pitch = 1.1; // Slightly higher for punchiness
            utterance.rate = 1.0;
        } else {
            // Look for premium male voices
            selectedVoice = voices.find(v => v.name.includes('Alex') || v.name.includes('Google UK English Male') || v.name.includes('Daniel') || v.name.includes('Male'));
            utterance.pitch = 0.9; // Deeper for male "cool" effect
            utterance.rate = 1.0;
        }

        if (selectedVoice) utterance.voice = selectedVoice;
        synth.speak(utterance);
    };

    // If voices aren't loaded yet, wait for them
    if (synth.getVoices().length === 0) {
        synth.onvoiceschanged = performSpeak;
    } else {
        performSpeak();
    }
}

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

    // Reset mobile state if needed
    if (window.innerWidth <= 1024) {
        portalCard.classList.add('mobile-hidden');
        portalMobileStart.classList.remove('hidden');
        viewPortal.classList.add('splash-active');
    }
});

// Mobile Splash Transition
if (btnPortalContinue) {
    btnPortalContinue.addEventListener('click', () => {
        portalMobileStart.classList.add('hidden');
        viewPortal.classList.remove('splash-active');
        portalCard.classList.remove('mobile-hidden');
        portalCard.style.animation = 'fadeInPortal 0.6s ease-out forwards';
    });
}

// Mobile Sidebar Logic
function toggleSidebar(show) {
    if (show) {
        mobileSidebar.classList.remove('hidden');
        // Create overlay if not exists
        if (!document.querySelector('.mobile-overlay')) {
            const overlay = document.createElement('div');
            overlay.className = 'mobile-overlay';
            overlay.addEventListener('click', () => toggleSidebar(false));
            document.body.appendChild(overlay);
        }
    } else {
        mobileSidebar.classList.add('hidden');
        const overlay = document.querySelector('.mobile-overlay');
        if (overlay) overlay.remove();
    }
}

if (btnMobileMenu) btnMobileMenu.addEventListener('click', () => toggleSidebar(true));
if (btnCloseSidebar) btnCloseSidebar.addEventListener('click', () => toggleSidebar(false));

// Sidebar Navigation
sideNavItems.forEach(item => {
    item.addEventListener('click', () => {
        const mode = item.dataset.mode;
        // Trigger the corresponding mode button click
        const targetBtn = document.getElementById(`btn-mode-${mode === 'attend' ? 'attend' : mode === 'reg' ? 'reg' : mode === 'analytics' ? 'analytics' : 'config'}`);
        if (targetBtn) targetBtn.click();

        // Update active state in sidebar
        sideNavItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');

        toggleSidebar(false);

        // On mobile, show the controls panel as an overlay when a mode is picked
        if (window.innerWidth <= 600) {
            const panel = document.querySelector('.controls-panel');
            if (panel) panel.classList.add('active');
        }
    });
});

if (sideBtnQr) sideBtnQr.addEventListener('click', () => {
    btnQrPresence.click();
    toggleSidebar(false);
});

if (sideBtnHistory) sideBtnHistory.addEventListener('click', () => {
    btnHistory.click();
    toggleSidebar(false);
});

if (sideBtnExport) sideBtnExport.addEventListener('click', () => {
    btnExport.click();
    toggleSidebar(false);
});

// Close controls panel on mobile when clicking outside or specific toggle
// We can add a "back" button to the panel later if needed, 
// for now users can switch modes via sidebar to reset or we can add a close handle.

// QR Modal Controls
if (btnQrPresence) {
    btnQrPresence.addEventListener('click', () => {
        isAIPaused = true;
        qrModal.classList.remove('hidden');
        startQRRotation();
    });
}

if (btnCloseQr) {
    btnCloseQr.addEventListener('click', () => {
        isAIPaused = false;
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

// Attendance Tab Switching
if (tabPresent && tabAbsent) {
    tabPresent.addEventListener('click', () => {
        activeAttendanceTab = 'present';
        tabPresent.classList.add('active');
        tabAbsent.classList.remove('active');
        renderAttendanceList();
    });
    tabAbsent.addEventListener('click', () => {
        activeAttendanceTab = 'absent';
        tabAbsent.classList.add('active');
        tabPresent.classList.remove('active');
        renderAttendanceList();
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

    // Always include Gender for Voice Customization
    const genderContainer = document.createElement('div');
    genderContainer.style.display = 'flex';
    genderContainer.style.gap = '8px';
    genderContainer.style.marginTop = '10px';

    const genderLabel = document.createElement('span');
    genderLabel.innerText = 'Gender: ';
    genderLabel.style.color = 'var(--text-muted)';
    genderLabel.style.fontSize = '0.8rem';
    genderContainer.appendChild(genderLabel);

    const genderSelect = document.createElement('select');
    genderSelect.id = 'reg-gender';
    genderSelect.style.flex = '1';
    genderSelect.style.background = 'rgba(255,255,255,0.05)';
    genderSelect.style.border = '1px solid var(--border)';
    genderSelect.style.color = 'white';
    genderSelect.style.borderRadius = '8px';
    genderSelect.style.padding = '5px';

    const optM = document.createElement('option');
    optM.value = 'male';
    optM.innerText = 'Male';
    genderSelect.appendChild(optM);

    const optF = document.createElement('option');
    optF.value = 'female';
    optF.innerText = 'Female';
    genderSelect.appendChild(optF);

    genderContainer.appendChild(genderSelect);
    dynamicFieldsContainer.appendChild(genderContainer);
}

async function saveSpaceConfig() {
    if (!currentSpace) return;
    const newConfig = {};
    document.querySelectorAll('.field-toggle').forEach(el => {
        newConfig[el.dataset.field] = el.checked;
    });

    const geofenceEnabled = configGeoEnabled.checked;
    const geofenceRadius = parseFloat(configGeoRadius.value) || 100;
    const locText = geoStatus.innerText;
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
        el.checked = !!config[el.dataset.field];
    });

    const gf = currentSpace.geofencing || {};
    configGeoEnabled.checked = !!gf.enabled;
    configGeoRadius.value = gf.radius || 100;
    if (gf.center) {
        geoStatus.innerText = `Lat: ${gf.center.lat.toFixed(6)}, Lng: ${gf.center.lng.toFixed(6)}`;
    } else {
        geoStatus.innerText = "Location not set";
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
        let presentAttendeesHTML = '';
        let absentAttendeesHTML = '';
        const todayStr = new Date().toDateString();

        snapshot.forEach(doc => {
            const data = doc.data();
            const uid = doc.id;
            tempAllData.push({ id: uid, ...data });

            // Only load approved users for face matching
            if (data.name && data.descriptor && data.approved !== false) {
                try {
                    const descFloat32 = new Float32Array(data.descriptor);
                    descriptors.push(new faceapi.LabeledFaceDescriptors(data.name, [descFloat32]));
                    tempMap[data.name] = uid;
                } catch (e) {
                    console.warn("Skipping corrupt face data", data.name);
                }
            }

            const itemHTML = `
                <div class="list-item list-item-new">
                    <div>
                        <strong>${data.name}</strong>
                        <span class="badge-course">${data.course || data.regNo || ''}</span>
                    </div>
                    ${data.lastAttendance === todayStr ? '<div style="color:var(--success)">✔</div>' : '<div style="color:var(--text-muted); font-size: 0.7rem;">Absent</div>'}
                </div>
            `;

            if (data.lastAttendance === todayStr) {
                presentTodayCount++;
                presentAttendeesHTML += itemHTML;
            } else {
                absentAttendeesHTML += itemHTML;
            }
        });

        labeledDescriptors = descriptors;
        nameToDocId = tempMap;
        allUsersData = tempAllData;

        if (labeledDescriptors.length > 0) {
            faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.4);
        }

        todayCountDisplay.innerText = presentTodayCount;
        lastPresentHTML = presentAttendeesHTML;
        lastAbsentHTML = absentAttendeesHTML;

        // Render based on active tab
        renderAttendanceList();
        renderPeopleManagement();
    });
}

function renderAttendanceList() {
    if (!todayListContainer) return;

    if (activeAttendanceTab === 'present') {
        todayListContainer.innerHTML = lastPresentHTML || '<div style="padding:10px; text-align:center; color:#888;">No attendance yet today</div>';
    } else {
        todayListContainer.innerHTML = lastAbsentHTML || '<div style="padding:10px; text-align:center; color:#888;">All registered users are present!</div>';
    }
}

function showToast(message, type = 'success') {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerText = message;
    toastContainer.appendChild(toast);

    // Haptic Feedback for Mobile
    if (navigator.vibrate) {
        if (type === 'error') navigator.vibrate([100, 50, 100]);
        else navigator.vibrate(50);
    }

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px)';
        setTimeout(() => toast.remove(), 500);
    }, 2600);
}

function showConfirm(message, callback) {
    if (!confirmModal) return;
    confirmMessage.innerText = message;
    confirmCallback = callback;
    confirmModal.classList.remove('hidden');
}

if (btnConfirmNo) {
    btnConfirmNo.onclick = () => {
        confirmModal.classList.add('hidden');
        confirmCallback = null;
    };
}

if (btnConfirmYes) {
    btnConfirmYes.onclick = () => {
        if (confirmCallback) confirmCallback();
        confirmModal.classList.add('hidden');
        confirmCallback = null;
    };
}

let peopleSearchQuery = '';
if (peopleSearchInput) {
    peopleSearchInput.addEventListener('input', (e) => {
        peopleSearchQuery = e.target.value.toLowerCase();
        renderPeopleManagement();
    });
}

async function renderPeopleManagement() {
    if (!peopleListContainer) return;

    // Filter by search query
    const filteredUsers = allUsersData.filter(user =>
        user.name.toLowerCase().includes(peopleSearchQuery) ||
        (user.regNo && user.regNo.toLowerCase().includes(peopleSearchQuery))
    );

    if (filteredUsers.length === 0) {
        peopleListContainer.innerHTML = `<div style="padding:20px; text-align:center; color:#888;">${allUsersData.length === 0 ? 'No registered users yet.' : 'No matches found.'}</div>`;
        return;
    }

    peopleListContainer.innerHTML = '';

    filteredUsers.sort((a, b) => a.name.localeCompare(b.name));

    // Get total days of attendance recorded for this space to calculate percentage
    const spaceRef = doc(db, COLL_SPACES, currentSpace.id);
    const spaceSnap = await getDoc(spaceRef);
    const historyDates = spaceSnap.data().historyDates || {};
    const totalDays = Object.keys(historyDates).length || 1;

    const fragment = document.createDocumentFragment();

    filteredUsers.forEach(user => {
        const attendanceCount = user.attendanceCount || 0;
        const percentage = Math.round((attendanceCount / totalDays) * 100);
        const isPending = user.approved === false;

        const card = document.createElement('div');
        card.className = 'management-person-card';
        card.innerHTML = `
            <div class="person-primary-info">
                <strong>${user.name} ${isPending ? '<span class="badge-pending">Pending Approval</span>' : ''}</strong>
                <small style="color:var(--text-muted)">${user.regNo || 'No Reg No'}</small>
            </div>
            <div class="person-stats-row">
                ${isPending ? `
                    <div class="approval-actions">
                        <button class="btn-approve" data-id="${user.id}">Approve</button>
                        <button class="btn-reject" data-id="${user.id}">Reject</button>
                    </div>
                ` : `
                    <div class="percentage-badge">${percentage}%</div>
                    <button class="btn-icon edit-btn" data-id="${user.id}">✏️</button>
                `}
            </div>
        `;

        if (isPending) {
            card.querySelector('.btn-approve').onclick = async () => {
                await updateDoc(doc(db, COLL_USERS, user.id), { approved: true });
                showToast(`Approved ${user.name}`);
            };
            card.querySelector('.btn-reject').onclick = () => {
                showConfirm(`Reject and delete ${user.name}?`, async () => {
                    await deleteDoc(doc(db, COLL_USERS, user.id));
                    showToast(`${user.name} rejected.`);
                });
            };
        } else {
            card.querySelector('.edit-btn').onclick = () => openEditModal(user.id, user);
        }
        fragment.appendChild(card);
    });

    peopleListContainer.appendChild(fragment);
}

function openEditModal(uid, userData) {
    editingPersonId = uid;
    editPersonNameTitle.innerText = userData.name;
    editNameInput.value = userData.name;
    editRegNoInput.value = userData.regNo || '';
    editCourseInput.value = userData.course || '';
    editModal.classList.remove('hidden');
}

if (btnCloseEdit) btnCloseEdit.onclick = () => editModal.classList.add('hidden');

if (btnSaveEdit) {
    btnSaveEdit.onclick = async () => {
        if (!editingPersonId) return;
        const newName = editNameInput.value.trim();
        const newReg = editRegNoInput.value.trim();
        const newCourse = editCourseInput.value.trim();

        if (!newName) return alert("Name cannot be empty");

        btnSaveEdit.innerText = "Saving...";
        btnSaveEdit.disabled = true;

        try {
            await updateDoc(doc(db, COLL_USERS, editingPersonId), {
                name: newName,
                regNo: newReg,
                course: newCourse
            });
            editModal.classList.add('hidden');
            showToast("Record updated successfully!");
        } catch (e) {
            showToast("Update fail: " + e.message, "error");
        } finally {
            btnSaveEdit.innerText = "Save Changes";
            btnSaveEdit.disabled = false;
        }
    };
}

if (btnDeletePerson) {
    btnDeletePerson.onclick = () => {
        if (!editingPersonId) return;

        showConfirm(`Are you sure you want to permanently delete ${editPersonNameTitle.innerText}? All biometric data will be lost.`, async () => {
            btnDeletePerson.innerText = "Deleting...";
            btnDeletePerson.disabled = true;

            try {
                await deleteDoc(doc(db, COLL_USERS, editingPersonId));
                editModal.classList.add('hidden');
                showToast("Person deleted successfully.");
            } catch (e) {
                showToast("Delete fail: " + e.message, "error");
            } finally {
                btnDeletePerson.innerText = "Delete Record";
                btnDeletePerson.disabled = false;
            }
        });
    };
}

// Drawing Utils

function drawCustomFaceBox(ctx, box, label, isMatch, confidence, resultLabel) {
    const { x, y, width, height } = box;
    const isUnknown = resultLabel === 'unknown';
    const color = isMatch ? '#22c55e' : (isUnknown ? '#ef4444' : '#10b981');
    const cornerSize = 30;
    const padding = 15;

    ctx.strokeStyle = color;
    ctx.lineWidth = 3;

    // TL/TR/BL/BR Corner brackets implementation...
    const drawCorner = (cx, cy, dx, dy) => {
        ctx.beginPath();
        ctx.moveTo(cx, cy + dy * cornerSize);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx + dx * cornerSize, cy);
        ctx.stroke();
        ctx.lineWidth = 1.5;
        const offset = 8;
        ctx.beginPath();
        ctx.moveTo(cx + dx * offset, cy + dy * (cornerSize - 5));
        ctx.lineTo(cx + dx * offset, cy + dy * offset);
        ctx.lineTo(cx + dx * (cornerSize - 5), cy + dy * offset);
        ctx.stroke();
        ctx.lineWidth = 3;
    };

    drawCorner(x - padding, y - padding, 1, 1);
    drawCorner(x + width + padding, y - padding, -1, 1);
    drawCorner(x - padding, y + height + padding, 1, -1);
    drawCorner(x + width + padding, y + height + padding, -1, -1);

    // Dynamic Data Rings (Rotating around the face)
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const baseRadius = Math.max(width, height) / 2 + 30;

    if (isMatch) {
        const userData = allUsersData.find(u => u.name === label);
        const dept = userData ? (userData.course || 'DEPT_01') : 'DEPT_01';
        const idNo = userData ? (userData.regNo || 'ID_000') : 'ID_000';

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.setLineDash([5, 15]);

        // Ring 1: Name
        ctx.rotate(hudRotation);
        ctx.beginPath();
        ctx.arc(0, 0, baseRadius + 10, 0, Math.PI * 1.5);
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.4;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.font = '800 10px Inter';
        ctx.fillStyle = color;
        ctx.fillText(label.toUpperCase(), baseRadius + 15, 0);

        // Ring 2: ID
        ctx.rotate(-hudRotation * 1.5);
        ctx.beginPath();
        ctx.arc(0, 0, baseRadius + 25, 0, Math.PI * 1.2);
        ctx.stroke();
        ctx.fillText(`ID: ${idNo}`, baseRadius + 30, 0);

        // Ring 3: Dept
        ctx.rotate(hudRotation * 0.8);
        ctx.beginPath();
        ctx.arc(0, 0, baseRadius + 40, 0, Math.PI * 1.8);
        ctx.stroke();
        ctx.fillText(dept.toUpperCase(), baseRadius + 45, 0);

        ctx.restore();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1.0;
    }

    // Biometric Barcode (Right Side)
    if (isMatch || isUnknown) {
        const barcodeX = x + width + padding + 40;
        const barcodeY = y;
        const barcodeHeight = height;

        ctx.save();
        ctx.globalAlpha = 0.6;
        ctx.translate(barcodeX, barcodeY);

        for (let i = 0; i < barcodeHeight; i += 4) {
            const bWidth = Math.random() > 0.5 ? 20 : 10;
            const flicker = Math.random() > 0.1 ? 1 : 0.2;
            ctx.fillStyle = color;
            ctx.globalAlpha = flicker * 0.6;
            ctx.fillRect(0, i, bWidth, 2);
        }

        // Vertical Rotating Bio-Tag
        ctx.rotate(Math.PI / 2);
        ctx.font = '900 9px monospace';
        ctx.fillStyle = color;
        const bioText = isMatch ? `BIOSEC_${label.slice(0, 3).toUpperCase()}_${Math.floor(Date.now() / 1000).toString().slice(-4)}` : "ENCRYPTION_ERROR";
        ctx.fillText(bioText, 0, -5);

        ctx.restore();
    }

    // Status Pill implementation remains...
    if (isMatch || isUnknown) {
        ctx.font = '900 13px Inter';
        const statusText = isMatch ? `${label.toUpperCase()} [${confidence}%]` : 'UNKNOWN_ACCESS_DENIED';
        const textWidth = ctx.measureText(statusText).width;
        const pillWidth = textWidth + 30;
        const pillHeight = 26;
        const pillX = x + (width / 2) - (pillWidth / 2);
        const pillY = y - padding - pillHeight - 5;

        ctx.shadowBlur = 20;
        ctx.shadowColor = color;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(pillX, pillY, pillWidth, pillHeight, 13);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#000';
        ctx.fillText(statusText, pillX + 15, pillY + 18);
    }
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

// Optimized Mesh Drawing
function drawFaceMesh(ctx, landmarks, color = '#10b981') {
    const points = landmarks.positions;
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.25; // Darker/Subtle mesh
    ctx.lineWidth = 0.5;

    // Plexus Network
    ctx.beginPath();
    points.forEach((p, i) => {
        // Connect to next few points to create a web/triangulation look
        for (let j = i + 1; j < i + 4 && j < points.length; j++) {
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(points[j].x, points[j].y);
        }
    });
    ctx.stroke();

    // Nodes (Emerald Glow)
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = color;
    points.forEach((p, i) => {
        if (i % 4 === 0) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 1, 0, Math.PI * 2);
            ctx.fill();
        }
    });
    ctx.globalAlpha = 1.0;
}

// Cyber Audio Engine (Synthesized sounds, no external files)
const CyberAudio = {
    ctx: null,
    init() {
        if (this.ctx) return;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn("Audio Context failed", e);
        }
    },
    async play(freq, type, duration, vol = 0.1) {
        this.init();
        if (!this.ctx) return;
        if (this.ctx.state === 'suspended') await this.ctx.resume();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    },
    playLock() { this.play(800, 'sine', 0.1, 0.05); },
    playMatch() {
        this.play(600, 'sine', 0.1, 0.05);
        setTimeout(() => this.play(900, 'sine', 0.15, 0.05), 60);
    },
    playError() { this.play(150, 'square', 0.2, 0.03); }
};

let wasFaceDetected = false;

// Main Loop

video.addEventListener('play', () => {
    // Responsive alignment: Use offsetWidth/Height to match the rendered video size
    const updateDisplaySize = () => {
        if (!video.videoWidth) return null;
        const dims = { width: video.videoWidth, height: video.videoHeight };
        canvas.width = dims.width;
        canvas.height = dims.height;
        // Important: Reset smoothing on resolution change
        for (let k in smoothBoxes) delete smoothBoxes[k];
        return dims;
    };

    let displaySize = updateDisplaySize();
    video.addEventListener('loadedmetadata', () => { displaySize = updateDisplaySize(); });
    window.addEventListener('resize', () => { displaySize = updateDisplaySize(); });

    setInterval(async () => {
        if (!isModelsLoaded || !video.srcObject || video.paused || video.ended || isAIPaused) return;
        if (currentMode === 'registration' || document.hidden) return;

        // Ensure dimensions are initialized (Fixes alignment drift)
        if (!canvas.width || canvas.width !== video.videoWidth) {
            updateDisplaySize();
        }
        const detection = await faceapi.detectSingleFace(video)
            .withFaceLandmarks()
            .withFaceDescriptor();

        if (detection) {
            const result = faceMatcher ? faceMatcher.findBestMatch(detection.descriptor) : { label: 'unknown', distance: 1.0 };

            // Audio Feedback: Lock Sound on first appearance
            if (!wasFaceDetected) {
                CyberAudio.playLock();
                wasFaceDetected = true;
            }

            window.lastDetection = detection;
            window.lastResult = result;

            if (scanIndicator) scanIndicator.style.display = 'block';

            // 2. Recognition Logic
            const isMatch = result.label !== 'unknown' && result.distance <= 0.6;
            if (isMatch) {
                detectionHistory[result.label] = (detectionHistory[result.label] || 0) + 1;
                if (detectionHistory[result.label] >= VALIDATION_THRESHOLD) {
                    markAttendance(result.label);
                    detectionHistory[result.label] = 0;
                }
            } else {
                // Clear history slowly if no match
                for (let k in detectionHistory) detectionHistory[k] = Math.max(0, detectionHistory[k] - 1);
            }
        } else {
            window.lastDetection = null;
            window.lastResult = null;
            wasFaceDetected = false; // Reset for next sound
            if (scanIndicator) scanIndicator.style.display = 'none';
        }
    }, DETECTION_INTERVAL);

    // --- Drawing Loop (requestAnimationFrame) ---
    function animate() {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (isAIPaused) {
            requestAnimationFrame(animate);
            return;
        }
        hudScanCycle += hudScanDir * (isMobile ? 0.02 : 0.04);
        if (hudScanCycle > 1 || hudScanCycle < 0) hudScanDir *= -1;
        hudRotation += 0.02; // Increment HUD rotation

        if (window.lastDetection && window.lastResult) {
            const detection = window.lastDetection;
            const result = window.lastResult;
            const box = detection.detection.box;
            const confidence = Math.round((1 - result.distance) * 100);
            const isMatch = result.label !== 'unknown' && result.distance <= 0.6;
            const displayLabel = isMatch ? result.label : 'SEARCHING...';

            const isUnknown = result.label === 'unknown';
            const statusColor = isMatch ? '#22c55e' : (isUnknown ? '#ef4444' : '#10b981');

            let drawBox = box;
            if (isMatch) {
                if (!smoothBoxes[displayLabel]) {
                    smoothBoxes[displayLabel] = { x: box.x, y: box.y, w: box.width, h: box.height };
                } else {
                    const sb = smoothBoxes[displayLabel];
                    sb.x += (box.x - sb.x) * LERP_FACTOR;
                    sb.y += (box.y - sb.y) * LERP_FACTOR;
                    sb.w += (box.width - sb.w) * LERP_FACTOR;
                    sb.h += (box.height - sb.h) * LERP_FACTOR;
                }
                drawBox = smoothBoxes[displayLabel];
            }

            if (detection.landmarks) drawFaceMesh(ctx, detection.landmarks, statusColor);
            drawCustomFaceBox(ctx, drawBox, displayLabel, isMatch, confidence, result.label);
        }

        requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
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
    const fields = ['regNo', 'course', 'email', 'bloodGroup', 'weight', 'phone', 'gender'];
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
            approved: !isMagicLinkSession, // Self-registered users need approval
            createdAt: new Date()
        });

        if (isMagicLinkSession) {
            alert(`Registration submitted! An admin will review your profile soon.`);
        } else {
            alert(`Registered ${name} successfully!`);
        }
        resetRegistrationForm();
        regFeedback.innerText = "Success!";
        regFeedback.style.color = "var(--success)";
    } catch (error) {
        console.error("Write Error:", error);
        alert("Failed to save: " + error.message);
    }
}

function resetRegistrationForm() {
    const inputs = regForm.querySelectorAll('input, select');
    inputs.forEach(i => i.value = "");
}

async function markAttendance(name) {
    const now = Date.now();
    const lastMarked = attendanceCooldowns[name] || 0;

    // 1 minute cooldown
    if (now - lastMarked < 60000) return;

    // Local feedback
    if (navigator.vibrate) navigator.vibrate(100);
    CyberAudio.playMatch(); // Play the success "chirp"
    showToast(`Attendance marked: ${name}`);

    attendanceCooldowns[name] = now;
    const timeStr = new Date().toLocaleTimeString();

    addLiveLogEntry(name, timeStr);

    // Voice Announcement
    const nowSpoken = Date.now();
    const lastTimeSpoken = lastSpoken[name] || 0;
    if (nowSpoken - lastTimeSpoken > 10000) { // 10s cooldown per person for voice
        const userData = allUsersData.find(u => u.name === name);
        const gender = (userData && userData.gender) ? userData.gender : 'male';
        speak(`Welcome ${name}`, gender);
        lastSpoken[name] = nowSpoken;
    }

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

// Magic Link Event Listeners
const btnGenerateMagic = document.getElementById('btn-generate-magic');
const magicLinkContainer = document.getElementById('magic-link-container');
const magicLinkInput = document.getElementById('magic-link-input');
const btnCopyMagic = document.getElementById('btn-copy-magic');

if (btnGenerateMagic) {
    btnGenerateMagic.addEventListener('click', () => {
        if (!currentSpace) return alert("Enter a workspace first");
        let baseUrl = window.location.href.split('?')[0].split('#')[0].replace('index.html', '');
        if (!baseUrl.endsWith('/')) baseUrl += '/';
        const expiresAt = Date.now() + (5 * 60 * 1000); // 5 min
        const url = `${baseUrl}register.html?s=${currentSpace.id}&exp=${expiresAt}`;
        magicLinkInput.value = url;
        magicLinkContainer.classList.remove('hidden');
        btnGenerateMagic.innerText = "🔄 Regenerated";
    });
}

if (btnCopyMagic) {
    btnCopyMagic.addEventListener('click', () => {
        magicLinkInput.select();
        document.execCommand('copy');
        btnCopyMagic.innerText = "✅ Copied!";
        setTimeout(() => btnCopyMagic.innerText = "Copy Link", 2000);
    });
}

window.addEventListener('load', async () => {
});


function setMode(mode) {
    currentMode = mode;

    // UI elements update
    [regForm, attendInfo, configForm, analyticsPanel].forEach(el => el.classList.add('hidden'));
    [
        document.getElementById('btn-mode-attend'),
        document.getElementById('btn-mode-reg'),
        document.getElementById('btn-mode-config'),
        document.getElementById('btn-mode-analytics')
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
        renderPeopleManagement();
    } else {
        attendInfo.classList.remove('hidden');
        document.getElementById('btn-mode-attend').classList.add('active');
        statusBadge.innerText = "Attendance Mode";
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


