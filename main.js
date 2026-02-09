// Imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, updateDoc, doc, getDoc, onSnapshot, increment, query, where, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";



// PWA
if ('serviceWorker' in navigator) {
    // Digital ID Card Logic
    function showIdCard(userData) {
        idCardName.textContent = userData.name || 'Student';
        idCardReg.textContent = userData.regNo || 'REG_HIDDEN';
        idCardCourse.textContent = userData.course || 'COGNITO_MEMBER';
        idCardPhoto.src = userData.photo || 'folder/placeholder.png';

        // Generate QR for back side
        idCardQrContent.innerHTML = '';
        const qrData = JSON.stringify({
            n: userData.name,
            r: userData.regNo,
            t: new Date().toISOString()
        });
        new QRCode(idCardQrContent, {
            text: qrData,
            width: 128,
            height: 128,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });

        idCardModal.classList.remove('hidden');
        idCardScene.classList.remove('is-flipped');
    }

    // Initializers
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('SW Registered', reg))
            .catch(err => console.error('SW Registration Fail', err));
    });
}

// Setup

let db, auth, currentUser;
const COLL_USERS = 'users';
const COLL_SPACES = 'spaces';
const COLL_ATTENDANCE = 'attendance';


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
const idCardModal = document.getElementById('id-card-modal');
const btnCloseIdCard = document.getElementById('btn-close-id-card');
const idCardScene = document.getElementById('id-card-scene');
const btnSaveWallet = document.getElementById('btn-save-wallet');
let terminalHistory = [];
const idCardPhoto = document.getElementById('id-card-photo');
const idCardName = document.getElementById('id-card-name');
const idCardReg = document.getElementById('id-card-reg');
const idCardCourse = document.getElementById('id-card-course');
const idCardQrContent = document.getElementById('id-card-qr');
const historyDateSelector = document.getElementById('history-date-selector');
const historyTableBody = document.getElementById('history-table-body');
const historyStatus = document.getElementById('history-status');
const historySearchInput = document.getElementById('history-search');
const btnExportHistory = document.getElementById('btn-export-history');
const tabPresent = document.getElementById('tab-present');
const tabAbsent = document.getElementById('tab-absent');


let currentHistoryRecords = [];
let currentHistoryDate = '';



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

const smoothBoxes = {};

const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights/';
const FALLBACK_MODEL_URL = 'https://cdn.jsdelivr.net/gh/vladmandic/face-api@master/model/';

const LERP_FACTOR = 0.4;

const qrModal = document.getElementById('qr-modal');
const btnQrPresence = document.getElementById('btn-qr-presence');
const btnCloseQr = document.getElementById('btn-close-qr');
const qrImage = document.getElementById('qr-image');
const qrTimerDisplay = document.getElementById('qr-timer');
const qrStatus = document.getElementById('qr-status');
const qrScanCountDisplay = document.getElementById('qr-scan-count');
const configQrRefresh = document.getElementById('config-qr-refresh');
// Status Bar Updates
function updateStatusBars() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour12: false });
    const loadStr = (Math.random() * 5 + 1).toFixed(1) + '%';
    const aiStr = isModelsLoaded ? 'ONLINE' : 'BOOTING...';

    ['about', 'contact'].forEach(prefix => {
        const timeEl = document.getElementById(`${prefix}-status-time`);
        const loadEl = document.getElementById(`${prefix}-status-load`);
        const aiEl = document.getElementById(`${prefix}-status-ai`);
        if (timeEl) timeEl.innerText = timeStr;
        if (loadEl) loadEl.innerText = loadStr;
        if (aiEl) {
            aiEl.innerText = aiStr;
            aiEl.className = isModelsLoaded ? 'status-value' : 'status-value status-online';
        }
    });
}
setInterval(updateStatusBars, 1000);

// Holographic Glitch Trigger
function triggerRandomGlitch() {
    const lines = document.querySelectorAll('.terminal-content div, .terminal-line');
    if (lines.length === 0) return;

    const randomLine = lines[Math.floor(Math.random() * lines.length)];
    const originalText = randomLine.innerText;
    if (!originalText || originalText.length < 5) return;

    randomLine.classList.add('glitch-effect');
    randomLine.setAttribute('data-text', originalText);

    setTimeout(() => {
        randomLine.classList.remove('glitch-effect');
        randomLine.removeAttribute('data-text');
    }, 1500);
}
setInterval(triggerRandomGlitch, 5000);

// Matrix Rain Effect
function initMatrixRain(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => {
        canvas.width = canvas.parentElement.offsetWidth;
        canvas.height = canvas.parentElement.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const charStr = '01ABCDEFGHIJKLMNOPQRSTUVWXYZ$@#&%*';
    const characters = charStr.split('');
    const fontSize = 10;
    const columns = canvas.width / fontSize;
    const drops = [];

    for (let x = 0; x < columns; x++) drops[x] = 1;

    function draw() {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#00ff41'; // Matrix Green
        ctx.font = fontSize + 'px monospace';

        for (let i = 0; i < drops.length; i++) {
            const text = characters[Math.floor(Math.random() * characters.length)];
            ctx.fillText(text, i * fontSize, drops[i] * fontSize);

            if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
                drops[i] = 0;
            }
            drops[i]++;
        }
    }
    setInterval(draw, 50);
}
const aboutModal = document.getElementById('about-modal');
const contactModal = document.getElementById('contact-modal');
const qrExpiredOverlay = document.getElementById('qr-expired-overlay');

const btnToggleCamera = document.getElementById('btn-toggle-camera');
const btnRestartCamera = document.getElementById('btn-restart-camera');
const cameraOfflineOverlay = document.getElementById('camera-offline-overlay');
let isCameraOff = false;
const btnRefreshQr = document.getElementById('btn-refresh-qr');


const analyticsPanel = document.getElementById('analytics-panel');
const peopleListContainer = document.getElementById('people-list-container');
const peopleSearchInput = document.getElementById('people-search');


let isMagicLinkSession = false;
let isAIPaused = false;
const btnModeAnalytics = document.getElementById('btn-mode-analytics');
const configGeoEnabled = document.getElementById('config-geo-enabled');
const configGeoRadius = document.getElementById('config-geo-radius');
const btnSetLocation = document.getElementById('btn-set-location');
const geoStatus = document.getElementById('geo-status');


const editModal = document.getElementById('edit-modal');
const btnCloseEdit = document.getElementById('btn-close-edit');
const editNameInput = document.getElementById('edit-name');
const editRegNoInput = document.getElementById('edit-regNo');
const editCourseInput = document.getElementById('edit-course');
const btnSaveEdit = document.getElementById('btn-save-edit');
const btnDeletePerson = document.getElementById('btn-delete-person');
const editPersonNameTitle = document.getElementById('edit-person-name-title');

const profileModal = document.getElementById('profile-modal');
const btnCloseProfile = document.getElementById('btn-close-profile');
const profilePhoto = document.getElementById('profile-photo');
const profilePhotoPlaceholder = document.getElementById('profile-photo-placeholder');
const profileName = document.getElementById('profile-name');
const profileRegNo = document.getElementById('profile-regNo');
const profileCourse = document.getElementById('profile-course');
const profileHistoryList = document.getElementById('profile-history-list');
const profileHistoryStatus = document.getElementById('profile-history-status');

let editingPersonId = null;


const confirmModal = document.getElementById('confirm-modal');
const confirmMessage = document.getElementById('confirm-message');
const btnConfirmYes = document.getElementById('btn-confirm-yes');
const btnConfirmNo = document.getElementById('btn-confirm-no');
const toastContainer = document.getElementById('toast-container');


const mobileSidebar = document.getElementById('mobile-sidebar');
const btnMobileMenu = document.getElementById('btn-mobile-menu');
const btnCloseSidebar = document.getElementById('btn-close-sidebar');
const sideNavItems = document.querySelectorAll('#mobile-sidebar .nav-item[data-mode]');
const sideBtnQr = document.getElementById('side-btn-qr');
const sideBtnHistory = document.getElementById('side-btn-history');
const sideBtnExport = document.getElementById('side-btn-export');
const btnAbout = document.getElementById('btn-about');
const btnCloseAbout = document.getElementById('btn-close-about');
const btnContact = document.getElementById('btn-contact');
const btnCloseContact = document.getElementById('btn-close-contact');

let confirmCallback = null;

// HUD Animation State
let hudScanCycle = 0; // 0 to 1
let hudScanDir = 1;
let hudRotation = 0; // Continuous rotation for rings
const lastSpoken = {};

// Terminal State
let terminalHistoryIndex = -1;
const COMMANDS = ['help', 'about developer', 'why cognito', 'clear', 'mission', 'vision', 'privacy', 'history', 'features', 'faqs', 'documentation', 'cat about.txt', 'cat contact.txt', 'ls', 'whoami'];

// Synthetic Audio Engine
class TerminalAudio {
    constructor() {
        this.ctx = null;
        this.enabled = true;
    }

    init() {
        if (this.ctx) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }

    playTone(freq, duration, type = 'square', volume = 0.1) {
        if (!this.enabled || !this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        gain.gain.setValueAtTime(volume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.00001, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    playLineStrike() {
        if (!this.enabled || !this.ctx) return;
        const f = 400 + Math.random() * 100; // Deeper "thud/click"
        this.playTone(f, 0.04, 'sine', 0.02);
    }


    playBoot() {
        const now = this.ctx.currentTime;
        [200, 300, 400, 600].forEach((f, i) => {
            setTimeout(() => this.playTone(f, 0.1, 'square', 0.05), i * 100);
        });
    }

    playError() {
        this.playTone(150, 0.3, 'sawtooth', 0.1);
    }
}

const termAudio = new TerminalAudio();

// Ambience Engine for Global Immersion
class AmbienceEngine {
    constructor() {
        this.ctx = null;
        this.osc = null;
        this.gain = null;
        this.filter = null;
        this.active = false;
    }

    init() {
        if (this.ctx) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.gain = this.ctx.createGain();
        this.filter = this.ctx.createBiquadFilter();

        this.gain.gain.setValueAtTime(0, this.ctx.currentTime);
        this.filter.type = 'lowpass';
        this.filter.frequency.setValueAtTime(150, this.ctx.currentTime);
        this.filter.Q.setValueAtTime(5, this.ctx.currentTime);

        this.gain.connect(this.filter);
        this.filter.connect(this.ctx.destination);
    }

    start() {
        if (this.active) return;
        this.init();
        this.osc = this.ctx.createOscillator();
        this.osc.type = 'sawtooth';
        this.osc.frequency.setValueAtTime(55, this.ctx.currentTime); // Low A hum

        this.osc.connect(this.gain);
        this.gain.gain.linearRampToValueAtTime(0.02, this.ctx.currentTime + 2);

        this.osc.start();
        this.active = true;
    }

    stop() {
        if (!this.active) return;
        this.gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1);
        setTimeout(() => {
            if (this.osc) this.osc.stop();
            this.active = false;
        }, 1200);
    }
}

const ambience = new AmbienceEngine();



let configLeafletMap = null;
let configMarker = null;
let configRadiusCircle = null;

// Device Detection for Performance
const isMobile = /Android|webOS|iPhone|iPad|IEMobile|Opera Mini/i.test(navigator.userAgent);
const DETECTION_INTERVAL = isMobile ? 250 : 100;

let hourlyChart = null;

// Advanced Detection State
const VALIDATION_THRESHOLD = 6; // Requires 6 frames of verification (Increased from 3 to prevent false positives)
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



        let selectedVoice = null;
        if (gender === 'female') {
            selectedVoice = voices.find(v => v.name.includes('Samantha') || v.name.includes('Google US English') || v.name.includes('Victoria') || v.name.includes('Female'));
            utterance.pitch = 1.1;
            utterance.rate = 1.0;
        } else {
            selectedVoice = voices.find(v => v.name.includes('Alex') || v.name.includes('Google UK English Male') || v.name.includes('Daniel') || v.name.includes('Male'));
            utterance.pitch = 0.9;
            utterance.rate = 1.0;
        }

        if (selectedVoice) utterance.voice = selectedVoice;
        synth.speak(utterance);
    };


    if (synth.getVoices().length === 0) {
        synth.onvoiceschanged = performSpeak;
    } else {
        performSpeak();
    }
}


// Firebase


try {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);


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
    document.body.classList.add('glitch-active');
    setTimeout(() => document.body.classList.remove('glitch-active'), 250);

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
            config: { regNo: true, course: true, phone: false, voiceEnabled: true }
        });

        enterSpace(docRef.id, { name, password, config: { regNo: true, course: true, phone: false, voiceEnabled: true } });
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
    ambience.start();

    const face3D = document.getElementById('face-3d-container');
    if (face3D) {
        face3D.classList.remove('fade-out');
        face3D.style.display = 'block';
    }

    initSystem();
    setMode('attendance');
    startDbListener();
    updateRegistrationForm();
    init3DFace('face-3d-container');
}

// QR
async function startQRRotation() {
    if (!currentSpace) return;
    stopQRRotation();

    const refreshQR = async () => {
        if (!currentSpace) return;
        currentNonce = Math.random().toString(36).substring(2, 12);
        const spaceRef = doc(db, COLL_SPACES, currentSpace.id);
        const refreshMs = parseInt(currentSpace.config.qrRefreshInterval || 30000);

        try {
            qrStatus.innerText = "Syncing with cloud...";
            qrImage.style.opacity = "0.5";
            qrExpiredOverlay.classList.add('hidden');
            btnRefreshQr.classList.add('hidden');

            await updateDoc(spaceRef, { qrNonce: currentNonce, qrScanCount: 0 });

            let baseUrl = window.location.href.split('?')[0].split('#')[0].replace('index.html', '');
            if (!baseUrl.endsWith('/')) baseUrl += '/';

            const expiryTime = Date.now() + refreshMs;
            const attendanceUrl = `${baseUrl}qr.html?s=${currentSpace.id}&n=${currentNonce}&exp=${expiryTime}`;

            const generateQR = () => {
                const qrEngine = window.QRCode || (typeof QRCode !== 'undefined' ? QRCode : null);

                if (qrEngine && qrEngine.toDataURL) {
                    qrEngine.toDataURL(attendanceUrl, {
                        width: 250,
                        margin: 4,
                        errorCorrectionLevel: 'H',
                        color: { dark: '#000000', light: '#ffffff' }
                    }, (err, url) => {
                        if (err) throw err;
                        qrImage.src = url;
                        qrImage.style.opacity = "1";
                        qrStatus.innerHTML = "[PRO] Code is live. Scan now.";
                        resetTimer(refreshMs / 1000);
                    });
                } else {
                    console.warn("QRCode library not found, using API fallback");
                    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(attendanceUrl)}`;
                    qrImage.src = qrApiUrl;
                    qrImage.onload = () => {
                        qrImage.style.opacity = "1";
                        qrStatus.innerHTML = "[PRO] Live (API Fallback)";
                        resetTimer(refreshMs / 1000);
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
        }
    };

    // Store refresh function on the button
    btnRefreshQr.onclick = refreshQR;

    await refreshQR();

    // Remove automatic setInterval refresh
    // const intervalMs = parseInt(currentSpace.config.qrRefreshInterval || 30000);
    // qrInterval = setInterval(refreshQR, intervalMs);

    // Listen for scan count updates
    const unsubscribeQr = onSnapshot(doc(db, COLL_SPACES, currentSpace.id), (doc) => {
        if (doc.exists()) {
            const data = doc.data();
            if (qrScanCountDisplay) qrScanCountDisplay.innerText = data.qrScanCount || 0;
        }
    });

    // ID Card Events
    btnCloseIdCard.addEventListener('click', () => {
        idCardModal.classList.add('hidden');
    });

    idCardScene.addEventListener('click', () => {
        idCardScene.classList.toggle('is-flipped');
    });

    btnSaveWallet.addEventListener('click', () => {
        if ('BeforeInstallPromptEvent' in window) {
            showToast('Ready for Wallet Integration (PWA)', 'success');
        } else {
            showToast('Pin to Home Screen to save to Wallet', 'info');
        }
    });

    // Close logic
    // Store unsubscribe to clean up later
    qrModal._unsubscribe = unsubscribeQr;
}

function stopQRRotation() {
    if (qrInterval) clearInterval(qrInterval);
    if (qrTimerInterval) clearInterval(qrTimerInterval);
    qrInterval = null;
    qrTimerInterval = null;
    if (qrModal._unsubscribe) {
        qrModal._unsubscribe();
        qrModal._unsubscribe = null;
    }
}

function resetTimer(seconds) {
    if (qrTimerInterval) clearInterval(qrTimerInterval);
    let timeLeft = seconds;
    qrTimerDisplay.innerText = timeLeft;

    qrTimerInterval = setInterval(() => {
        timeLeft--;
        qrTimerDisplay.innerText = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(qrTimerInterval);
            qrStatus.innerHTML = "<span style='color:var(--danger); font-weight:700;'>QR CODE EXPIRED</span>";
            qrExpiredOverlay.classList.remove('hidden');
            btnRefreshQr.classList.remove('hidden');
            qrImage.style.opacity = "0.3";
        }
    }, 1000);
}

btnPortalJoin.addEventListener('click', handleJoin);
btnPortalCreate.addEventListener('click', handleCreate);
btnExitWorkspace.addEventListener('click', () => {
    stopQRRotation();
    ambience.stop();
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

if (btnCloseContact) {
    btnCloseContact.addEventListener('click', () => {
        isAIPaused = false;
        contactModal.classList.add('hidden');
    });
}


async function typeText(element, text, speed = 18) {
    // Regex for URLs, markdown links, and tags
    const combinedRegex = /(https?:\/\/[^\s]+|discord\.gg\/[^\s]+|github\.com\/[^\s]+|linkedin\.com\/[^\s]+|\[\[.*?\]\]|\{\{.*?\}\}|<<.*?>>|\(\(.*?\)\)|\*\*.*?\*\*|\[.*?\]\(.*?\))/g;
    const parts = text.split(combinedRegex);
    element.innerHTML = '';

    for (let part of parts) {
        if (!part || !isAIPaused) continue;

        if (part.match(/^(https?:\/\/[^\s]+|discord\.gg\/[^\s]+|github\.com\/[^\s]+|linkedin\.com\/[^\s]+)$/)) {
            const link = document.createElement('a');
            link.href = part.startsWith('http') ? part : 'https://' + part;
            link.target = '_blank';
            link.className = 'terminal-link';
            link.style.color = 'var(--accent)';
            link.style.textDecoration = 'none';
            link.style.borderBottom = '1px dashed var(--accent)';

            if (part.toLowerCase().endsWith('.pdf') || part.toLowerCase().endsWith('.zip')) {
                link.setAttribute('download', 'CognitoAttend_Documentation.pdf');
            }

            for (let char of part) {
                if (!isAIPaused) break;
                link.textContent += char;
                element.appendChild(link);
                const terminalBody = element.closest('.terminal-body');
                if (terminalBody) terminalBody.scrollTop = terminalBody.scrollHeight;
                await new Promise(r => setTimeout(r, speed));
            }
        } else if (part.startsWith('[') && part.includes('](') && part.endsWith(')')) {
            // Markdown Link [text](url)
            const label = part.match(/\[(.*?)\]/)[1];
            const url = part.match(/\((.*?)\)/)[1];

            const link = document.createElement('a');
            link.href = url;
            link.target = '_blank';
            link.className = 'terminal-link';
            link.style.color = 'var(--accent)';
            link.style.textDecoration = 'none';
            link.style.borderBottom = '1px dashed var(--accent)';

            if (url.toLowerCase().endsWith('.pdf') || url.toLowerCase().endsWith('.zip')) {
                link.setAttribute('download', 'CognitoAttend_Documentation.pdf');
            }

            for (let char of label) {
                if (!isAIPaused) break;
                link.textContent += char;
                element.appendChild(link);
                const terminalBody = element.closest('.terminal-body');
                if (terminalBody) terminalBody.scrollTop = terminalBody.scrollHeight;
                await new Promise(r => setTimeout(r, speed));
            }
        } else if (part.startsWith('[[') && part.endsWith(']]')) {
            const cleanText = part.slice(2, -2);
            await typeSpan(element, cleanText, 'hl-accent', speed);
        } else if (part.startsWith('{{') && part.endsWith('}}')) {
            const cleanText = part.slice(2, -2);
            await typeSpan(element, cleanText, 'hl-pink', speed);
        } else if (part.startsWith('<<') && part.endsWith('>>')) {
            const cleanText = part.slice(2, -2);
            await typeSpan(element, cleanText, 'hl-gold', speed);
        } else if (part.startsWith('((') && part.endsWith('))')) {
            const cleanText = part.slice(2, -2);
            await typeSpan(element, cleanText, 'hl-blue', speed);
        } else if (part.startsWith('**') && part.endsWith('**')) {
            const cleanText = part.slice(2, -2);
            await typeSpan(element, cleanText, 'hl-green', speed);
        } else {
            for (let char of part) {
                if (!isAIPaused) break;
                if (char === '\n') termAudio.playLineStrike();
                element.innerHTML += char === '\n' ? '<br>' : char;
                const terminalBody = element.closest('.terminal-body');
                if (terminalBody) terminalBody.scrollTop = terminalBody.scrollHeight;
                await new Promise(r => setTimeout(r, speed));
            }
        }
    }
}

async function typeSpan(element, text, className, speed) {
    const span = document.createElement('span');
    span.className = className;
    element.appendChild(span);
    for (let char of text) {
        if (!isAIPaused) break;
        span.textContent += char;
        const terminalBody = element.closest('.terminal-body');
        if (terminalBody) terminalBody.scrollTop = terminalBody.scrollHeight;
        await new Promise(r => setTimeout(r, speed));
    }
}


async function bootTerminal(contentId) {
    const contentDiv = document.getElementById(contentId);
    if (!contentDiv) return;

    contentDiv.innerHTML = '';
    const lines = [
        "INITIALIZING COGNITO_CORE...",
        "LOADING BIOMETRIC_MODULES... [OK]",
        "CONNECTING TO FIRESTORE_GRID... [OK]",
        "ESTABLISHING SECURE_SHELL... [OK]",
        "WELCOME TO COGNITO_ATTEND TERMINAL v1.0.0",
        "------------------------------------------"
    ];

    for (const line of lines) {
        if (!isAIPaused) break;
        const p = document.createElement('div');
        p.className = 'boot-line';
        p.innerText = line;
        contentDiv.appendChild(p);
        termAudio.playTone(400 + Math.random() * 100, 0.05, 'sine', 0.02);
        await new Promise(r => setTimeout(r, 100));
    }
}


// Terminal System Logic
async function processTerminalCommand(e, contentId) {
    const inputEl = e.target;
    const contentDiv = document.getElementById(contentId);

    // Audio Init on first interaction
    termAudio.init();

    if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (terminalHistory.length > 0) {
            terminalHistoryIndex = Math.min(terminalHistoryIndex + 1, terminalHistory.length - 1);
            inputEl.innerText = terminalHistory[terminalHistory.length - 1 - terminalHistoryIndex];
            placeCaretAtEnd(inputEl);
        }
        return;
    }
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (terminalHistoryIndex > 0) {
            terminalHistoryIndex--;
            inputEl.innerText = terminalHistory[terminalHistory.length - 1 - terminalHistoryIndex];
        } else {
            terminalHistoryIndex = -1;
            inputEl.innerText = '';
        }
        placeCaretAtEnd(inputEl);
        return;
    }

    if (e.key === 'Tab') {
        e.preventDefault();
        const current = inputEl.innerText.trim();
        if (!current) return;
        const matches = COMMANDS.filter(c => c.startsWith(current));
        if (matches.length === 1) {
            inputEl.innerText = matches[0];
            placeCaretAtEnd(inputEl);
        } else if (matches.length > 1) {
            const matchesLine = document.createElement('div');
            matchesLine.style.color = '#888';
            matchesLine.innerText = matches.join('  ');
            contentDiv.appendChild(matchesLine);
        }
        return;
    }

    if (e.key === 'Enter') {
        e.preventDefault();
        const command = inputEl.innerText.trim().toLowerCase();

        if (!command) return;

        terminalHistoryIndex = -1;
        // Add user command to history
        const historyLine = document.createElement('div');
        historyLine.className = 'terminal-line';
        historyLine.innerHTML = `<span class="prompt">guest@cognito:~$</span> <span class="command">${command}</span>`;
        contentDiv.appendChild(historyLine);

        if (terminalHistory[terminalHistory.length - 1] !== command) {
            terminalHistory.push(command);
        }

        // Show Loading State
        const loadingLine = document.createElement('div');
        loadingLine.className = 'status-online';
        loadingLine.style.margin = '5px 0';
        loadingLine.innerText = "Processing...";
        contentDiv.appendChild(loadingLine);

        await new Promise(r => setTimeout(r, 200));

        let responseText = "";
        let isError = false;
        let useHtml = false;

        if (command === 'help') {
            responseText = `AVAILABLE COMMANDS:
- about developer : Learn about Vivek (Rahagir)
- why cognito   : System development philosophy
- help          : Display this command list
- clear         : Wipe terminal clean
- mission       : Our purpose
- vision        : Future roadmap
- privacy       : Data sovereignty statement
- history       : View recent commands
- features      : Core capabilities
- faqs          : Frequently Asked Questions
- documentation : Download system documentation PDF
- cat [file]    : Read file contents (e.g., cat about.txt)
- ls            : List available files
- whoami        : Current session identity`;
        } else if (command === 'clear') {
            contentDiv.innerHTML = '';
            inputEl.innerText = '';
            return;
        } else if (command === 'ls') {
            responseText = `about.txt
contact.txt
faq.txt
features.txt
mission.txt
philosophy.txt
privacy.txt
vision.txt`;
        } else if (command === 'whoami') {
            responseText = `USER: Guest_Access_Node_${Math.floor(Math.random() * 9999)}
ACCESS_LEVEL: Unauthorized (Public)
IP: 127.0.0.1 (Masked)
STATUS: Viewing Project Documentation`;
        } else if (command === 'mission' || command.includes('mission')) {
            try {
                const res = await fetch('about/mission.txt');
                responseText = await res.text();
            } catch (err) { responseText = "Error fetching mission info."; isError = true; }
        } else if (command === 'vision' || command.includes('vision')) {
            try {
                const res = await fetch('about/vision.txt');
                responseText = await res.text();
            } catch (err) { responseText = "Error fetching vision info."; isError = true; }
        } else if (command === 'privacy') {
            try {
                const res = await fetch('about/privacy.txt');
                responseText = await res.text();
            } catch (err) { responseText = "Error reading privacy statement."; isError = true; }
        } else if (command === 'history') {
            responseText = terminalHistory.length > 0 ? terminalHistory.join('\n') : "No command history found.";
        } else if (command === 'features') {
            try {
                const res = await fetch('about/features.txt');
                responseText = await res.text();
            } catch (err) { responseText = "Error fetching features list."; isError = true; }
        } else if (command === 'documentation') {
            window.open('folder/documentation.pdf', '_blank');
            responseText = "OPENING_SYSTEM_DOCS: [[CognitoAttend Documentation v1.0]]\nLaunching document viewer...\n\n(If it didn't open, please check your popup blocker.)";
        } else if (command === 'about developer') {
            try {
                const res = await fetch('about/developer.txt');
                responseText = await res.text();
            } catch (err) { responseText = "Error fetching developer info."; isError = true; }
        } else if (command === 'why cognito' || command === 'why cognito attend?') {
            try {
                const res = await fetch('about/why.txt');
                responseText = await res.text();
            } catch (err) { responseText = "Error fetching philosophy info."; isError = true; }
        } else if (command === 'cat about.txt' || command === 'cat content.txt') {
            try {
                const res = await fetch('about/content.txt');
                responseText = await res.text();
            } catch (err) { responseText = "Error reading about.txt"; isError = true; }
        } else if (command === 'cat contact.txt') {
            try {
                const res = await fetch('about/contact.txt');
                responseText = await res.text();
            } catch (err) { responseText = "Error reading contact.txt"; isError = true; }
        } else if (command === 'faqs') {
            try {
                const res = await fetch('about/faq.txt');
                responseText = await res.text();
            } catch (err) { responseText = "Error fetching FAQs."; isError = true; }
        } else {
            responseText = `Command not found: ${command}. Type 'help' for available options.`;
            isError = true;
            termAudio.playError();
        }

        // Remove loading state
        contentDiv.removeChild(loadingLine);

        const responseLine = document.createElement('div');
        responseLine.className = isError ? 'status-error' : 'glow-text';
        responseLine.style.whiteSpace = 'pre-wrap';
        responseLine.style.margin = '10px 0';
        contentDiv.appendChild(responseLine);

        inputEl.innerText = '';

        if (isError) {
            responseLine.innerText = responseText;
        } else if (useHtml) {
            responseLine.innerHTML = responseText;
        } else {
            await typeText(responseLine, responseText);
        }

        const terminalBody = inputEl.closest('.terminal-body');
        if (terminalBody) terminalBody.scrollTop = terminalBody.scrollHeight;
    }
}

function placeCaretAtEnd(el) {
    el.focus();
    if (typeof window.getSelection != "undefined" && typeof document.createRange != "undefined") {
        var range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    }
}


// Global Terminal Event Delegation
document.addEventListener('keydown', (e) => {
    if (e.target.classList.contains('terminal-input')) {
        const contentId = e.target.id === 'about-input' ? 'about-terminal-content' : 'contact-terminal-content';
        processTerminalCommand(e, contentId);
    }
});

document.addEventListener('click', (e) => {
    const terminalBody = e.target.closest('.terminal-body');
    if (terminalBody) {
        const input = terminalBody.querySelector('.terminal-input');
        if (input) input.focus();
    }
});

// Modal Triggers
if (document.getElementById('btn-about')) {
    document.getElementById('btn-about').addEventListener('click', async () => {
        isAIPaused = true;
        termAudio.init();
        termAudio.playBoot();
        document.getElementById('about-modal').classList.remove('hidden');

        const contentDiv = document.getElementById('about-terminal-content');
        if (contentDiv) {
            await bootTerminal('about-terminal-content');

            try {
                const response = await fetch('about/content.txt');
                const text = await response.text();
                const responseLine = document.createElement('div');
                responseLine.className = 'glow-text';
                contentDiv.appendChild(responseLine);
                await typeText(responseLine, text);
            } catch (e) { contentDiv.innerHTML += '<p class="status-error">Error loading system info.</p>'; }
        }

        setTimeout(() => {
            const input = document.getElementById('about-input');
            if (input) input.focus();
        }, 150);
    });
}


if (document.getElementById('btn-contact')) {
    document.getElementById('btn-contact').addEventListener('click', async () => {
        isAIPaused = true;
        termAudio.init();
        termAudio.playBoot();
        document.getElementById('contact-modal').classList.remove('hidden');

        const contentDiv = document.getElementById('contact-terminal-content');
        if (contentDiv) {
            await bootTerminal('contact-terminal-content');

            try {
                const response = await fetch('about/contact.txt');
                const text = await response.text();
                const responseLine = document.createElement('div');
                responseLine.className = 'glow-text';
                contentDiv.appendChild(responseLine);
                await typeText(responseLine, text);
            } catch (e) { contentDiv.innerHTML += '<p class="status-error">Error loading contact portal.</p>'; }
        }

        setTimeout(() => {
            const input = document.getElementById('contact-input');
            if (input) input.focus();
        }, 150);
    });
}

// Window Controls Logic
function setupTerminalControls(modalId, redId, yellowId, greenId, closeBtnId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    const container = modal.querySelector('.terminal-container');

    const closeModal = () => {
        modal.classList.add('hidden');
        isAIPaused = false;
        container.classList.remove('minimized', 'maximized');
    };

    if (document.getElementById(redId)) document.getElementById(redId).onclick = closeModal;
    if (document.getElementById(closeBtnId)) document.getElementById(closeBtnId).onclick = closeModal;

    if (document.getElementById(yellowId)) {
        document.getElementById(yellowId).onclick = () => {
            container.classList.toggle('minimized');
        };
    }

    document.getElementById(greenId).onclick = () => {
        container.classList.toggle('maximized');
    };
}

// Initialize Terminal Controls
document.addEventListener('DOMContentLoaded', () => {
    setupTerminalControls('about-modal', 'btn-close-about-dot', 'btn-min-about', 'btn-max-about', 'btn-close-about');
    setupTerminalControls('contact-modal', 'btn-close-contact-dot', 'btn-min-contact', 'btn-max-contact', 'btn-close-contact');

    // Tier 2: Matrix Rain
    initMatrixRain('about-terminal-bg');
    initMatrixRain('contact-terminal-bg');
});

// Close modals when clicking outside
window.addEventListener('click', (e) => {
    if (e.target === aboutModal) {
        isAIPaused = false;
        aboutModal.classList.add('hidden');
    }
    if (e.target === contactModal) {
        isAIPaused = false;
        contactModal.classList.add('hidden');
    }
    if (e.target === qrModal) {
        isAIPaused = false;
        qrModal.classList.add('hidden');
        stopQRRotation();
    }
    if (e.target === historyModal) {
        historyModal.classList.add('hidden');
    }
    if (e.target === editModal) {
        editModal.classList.add('hidden');
    }
    if (e.target === profileModal) {
        profileModal.classList.add('hidden');
    }
    if (e.target === magicQrModal) {
        magicQrModal.classList.add('hidden');
    }
    if (e.target === idCardModal) {
        idCardModal.classList.add('hidden');
    }
});

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
    const btnExportHistoryPdf = document.getElementById('btn-export-history-pdf');
    if (btnExportHistoryPdf) btnExportHistoryPdf.style.display = 'none';
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
            // Use manual split to avoid UTC shift issues with new Date(date)
            const parts = date.split('-');
            const d = new Date(parts[0], parts[1] - 1, parts[2]);
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
    const btnExportHistoryPdf = document.getElementById('btn-export-history-pdf');
    if (btnExportHistoryPdf) btnExportHistoryPdf.style.display = 'none';

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
        const showBtns = records.length > 0 ? 'block' : 'none';
        btnExportHistory.style.display = showBtns;
        if (btnExportHistoryPdf) btnExportHistoryPdf.style.display = showBtns;

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
        link.download = `attendance_${currentSpace.name.replace(/\s+/g, '_')}_${currentHistoryDate || getLocalYYYYMMDD()}.csv`;
        link.click();
    });
}

// Models

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

    // Start everything in parallel
    const modelsPromise = (async () => {
        let loaded = await loadModels(MODEL_URL);
        if (!loaded) {
            console.log("Trying fallback model URL...");
            loaded = await loadModels(FALLBACK_MODEL_URL);
        }
        return loaded;
    })();

    // Initialize camera immediately
    const cameraPromise = startVideo();

    try {
        const [modelsLoaded, cameraStarted] = await Promise.all([modelsPromise, cameraPromise]);

        if (modelsLoaded) {
            console.log("Models and Hardware ready.");
            isModelsLoaded = true;
            // Reveal UI immediately when both are ready
            loadingOverlay.style.display = "none";
            const face3D = document.getElementById('face-3d-container');
            if (face3D) {
                face3D.classList.add('fade-out');
                setTimeout(() => face3D.style.display = 'none', 800);
            }
            statusBadge.innerText = "System Active";
            statusBadge.className = "status-badge status-ready";
        } else {
            throw new Error("Could not load AI models.");
        }
    } catch (err) {
        console.error("System Init Error:", err);
        loadingText.innerHTML = `Error: ${err.message} <br><small>Troubleshoot your connection or camera permissions.</small>`;
        statusBadge.innerText = "Init Error";
        statusBadge.className = "status-badge status-error";

        // Add a retry button to the UI if not already there
        if (!loadingOverlay.querySelector('.btn-retry')) {
            const retryBtn = document.createElement('button');
            retryBtn.innerText = "Retry Loading";
            retryBtn.className = "btn-primary btn-retry";
            retryBtn.style.marginTop = "10px";
            retryBtn.onclick = () => window.location.reload();
            loadingOverlay.appendChild(retryBtn);
        }
    }
}

// Init

function startVideo() {
    return new Promise((resolve, reject) => {
        isCameraOff = false;
        if (cameraOfflineOverlay) cameraOfflineOverlay.classList.add('hidden');
        if (btnToggleCamera) {
            btnToggleCamera.classList.remove('offline');
            const statusText = btnToggleCamera.querySelector('.cam-status-text');
            if (statusText) statusText.innerText = "CAMERA ON";
        }

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            loadingText.innerHTML = `<span style="color:#ef4444; font-weight:800;">Secure Context Required</span><br><small>Camera access requires HTTPS or localhost.</small>`;
            statusBadge.innerText = "Security Error";
            reject(new Error("Secure context required"));
            return;
        }

        statusBadge.innerText = "Accessing Camera...";

        const constraints = {
            video: {
                facingMode: "user",
                width: { ideal: isMobile ? 640 : 1280 },
                height: { ideal: isMobile ? 480 : 720 }
            }
        };

        navigator.mediaDevices.getUserMedia(constraints)
            .then(stream => {
                console.log("Camera access granted.");
                video.srcObject = stream;
                video.onloadedmetadata = () => {
                    video.play().then(() => {
                        console.log("Video playing.");
                        // We don't hide loading overlay here anymore; initSystem handles complete ready state
                        resolve(true);

                        // If models are already loaded, we can actually hide it
                        if (isModelsLoaded || !loadingOverlay.style.display || loadingOverlay.style.display === "none") {
                            loadingOverlay.style.display = "none";
                            const face3D = document.getElementById('face-3d-container');
                            if (face3D) {
                                face3D.classList.add('fade-out');
                                setTimeout(() => face3D.style.display = 'none', 800);
                            }
                            statusBadge.innerText = "System Active";
                            statusBadge.className = "status-badge status-ready";
                        }
                    }).catch(err => {
                        console.error("Video Play Error:", err);
                        reject(err);
                    });
                };
            })
            .catch(err => {
                console.error("Camera Error:", err);
                reject(err);
            });
    });
}

function stopVideo() {
    if (video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
        video.srcObject = null;
    }
    isCameraOff = true;
    if (cameraOfflineOverlay) cameraOfflineOverlay.classList.remove('hidden');
    if (btnToggleCamera) {
        btnToggleCamera.classList.add('offline');
        const statusText = btnToggleCamera.querySelector('.cam-status-text');
        if (statusText) statusText.innerText = "CAMERA OFF";
    }
    statusBadge.innerText = "Camera Offline";
    statusBadge.className = "status-badge status-loading";
}

function toggleCamera() {
    if (isCameraOff) {
        startVideo();
    } else {
        stopVideo();
    }
}

if (btnToggleCamera) btnToggleCamera.addEventListener('click', toggleCamera);
if (btnRestartCamera) btnRestartCamera.addEventListener('click', startVideo);


// Config

function updateRegistrationForm() {
    if (!currentSpace) return;
    const config = currentSpace.config || {};
    dynamicFieldsContainer.innerHTML = '';

    // Always include Name
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.id = 'reg-name';
    nameInput.placeholder = 'Full Name';
    nameInput.setAttribute('aria-label', 'Full Name');
    dynamicFieldsContainer.appendChild(nameInput);

    // Check for optional fields
    if (config.regNo) {
        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'reg-regNo';
        input.placeholder = 'Registration Number';
        input.setAttribute('aria-label', 'Registration Number');
        dynamicFieldsContainer.appendChild(input);
    }
    if (config.course) {
        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'reg-course';
        input.placeholder = 'Course / Department';
        input.setAttribute('aria-label', 'Course or Department');
        dynamicFieldsContainer.appendChild(input);
    }
    if (config.email) {
        const input = document.createElement('input');
        input.type = 'email';
        input.id = 'reg-email';
        input.placeholder = 'Email ID';
        input.setAttribute('aria-label', 'Email Address');
        dynamicFieldsContainer.appendChild(input);
    }
    if (config.bloodGroup) {
        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'reg-bloodGroup';
        input.placeholder = 'Blood Group';
        input.setAttribute('aria-label', 'Blood Group');
        dynamicFieldsContainer.appendChild(input);
    }
    if (config.weight) {
        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'reg-weight';
        input.placeholder = 'Weight (kg)';
        input.setAttribute('aria-label', 'Weight in kilograms');
        dynamicFieldsContainer.appendChild(input);
    }
    if (config.phone) {
        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'reg-phone';
        input.placeholder = 'Phone Number';
        input.setAttribute('aria-label', 'Phone Number');
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
    const btnSave = document.getElementById('btn-save-config');
    const originalText = btnSave.innerText;

    // UI Feedback
    btnSave.innerText = "Saving...";
    btnSave.disabled = true;

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

    const examMode = document.getElementById('config-exam-mode').checked;

    try {
        await updateDoc(doc(db, COLL_SPACES, currentSpace.id), {
            config: { ...newConfig, examMode: examMode },
            geofencing: {
                enabled: geofenceEnabled,
                radius: geofenceRadius,
                center: lat && lng ? { lat, lng } : null
            },
            qrRefreshInterval: configQrRefresh.value
        });

        // Update local state
        currentSpace.config = { ...newConfig, examMode: examMode };
        currentSpace.config.qrRefreshInterval = configQrRefresh.value;
        currentSpace.geofencing = { enabled: geofenceEnabled, radius: geofenceRadius, center: lat && lng ? { lat, lng } : null };

        showToast("Settings saved successfully!");
        setMode('attendance');
    } catch (err) {
        console.error("Save Settings Error:", err);
        showToast("Failed to save: " + err.message, "error");
    } finally {
        btnSave.innerText = originalText;
        btnSave.disabled = false;
    }
}

document.getElementById('btn-save-config').addEventListener('click', saveSpaceConfig);

// Handle toggle inputs initial state when entering Settings mode
function syncConfigToggles() {
    if (!currentSpace) return;
    const config = currentSpace.config || {};
    document.querySelectorAll('.field-toggle').forEach(el => {
        const field = el.dataset.field;
        if (field === 'biometricEnabled' || field === 'voiceEnabled') {
            el.checked = config[field] !== false;
        } else {
            el.checked = !!config[field];
        }
    });

    const gf = currentSpace.geofencing || {};
    configGeoEnabled.checked = !!gf.enabled;
    configGeoRadius.value = gf.radius || 100;
    if (gf.center) {
        geoStatus.innerText = `Lat: ${gf.center.lat.toFixed(6)}, Lng: ${gf.center.lng.toFixed(6)}`;
        updateConfigMapPreview(gf.center.lat, gf.center.lng, gf.radius || 100);
    } else {
        geoStatus.innerText = "Location not set";
        document.getElementById('config-map-container').style.display = 'none';
    }

    if (currentSpace.config && currentSpace.config.examMode) {
        document.getElementById('config-exam-mode').checked = true;
    } else {
        document.getElementById('config-exam-mode').checked = false;
    }

    if (configQrRefresh) {
        configQrRefresh.value = config.qrRefreshInterval || "30000";
    }
}

function updateConfigMapPreview(lat, lng, radius, accuracy = null) {
    const container = document.getElementById('config-map-container');
    container.style.display = 'block';

    if (!configLeafletMap) {
        configLeafletMap = L.map('config-map', { zoomControl: false, attributionControl: false }).setView([lat, lng], 18);
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 19
        }).addTo(configLeafletMap);

        // Apply Tactical Tint
        const mapEl = document.getElementById('config-map');
        mapEl.style.filter = 'brightness(0.6) contrast(1.2) sepia(100%) hue-rotate(140deg) saturate(3)';
    } else {
        configLeafletMap.setView([lat, lng]);
    }

    if (configMarker) configLeafletMap.removeLayer(configMarker);
    if (configRadiusCircle) configLeafletMap.removeLayer(configRadiusCircle);

    // Tactical Radar Pulse Marker
    const radarIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div class="radar-pulse"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });

    configMarker = L.marker([lat, lng], { icon: radarIcon }).addTo(configLeafletMap);

    configRadiusCircle = L.circle([lat, lng], {
        radius: radius,
        color: "var(--accent)",
        fillColor: "var(--accent)",
        fillOpacity: 0.1,
        weight: 1,
        dashArray: '5, 5'
    }).addTo(configLeafletMap);

    if (accuracy) {
        geoStatus.innerHTML += `<br><span style="color:var(--accent)">Accuracy: ±${accuracy.toFixed(1)}m</span>`;
    }

    configLeafletMap.invalidateSize();
}

// DB

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
        const localToday = getLocalYYYYMMDD();

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

            if (data.lastAttendance === todayStr) {
                const itemHTML = `
                    <div class="list-item list-item-new" data-uid="${uid}" data-name="${data.name}">
                        <div class="item-main-content">
                            ${data.photo ? `<img src="${data.photo}" class="student-avatar" alt="${data.name}">` : `<div class="student-avatar-placeholder">${data.name.charAt(0)}</div>`}
                            <div>
                                <strong>${data.name}</strong>
                                <span class="badge-course">${data.course || data.regNo || ''}</span>
                            </div>
                        </div>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <div style="color:var(--success)">✔</div>
                            <button class="btn-undo-attendance" title="Undo Attendance" style="padding: 2px 6px; font-size: 0.6rem; background: rgba(255, 71, 87, 0.2); color: var(--danger); border: 1px solid var(--danger); border-radius: 4px; cursor: pointer;">Undo</button>
                        </div>
                    </div>
                `;
                presentTodayCount++;
                presentAttendeesHTML += itemHTML;
            } else {
                const itemHTML = `
                    <div class="list-item list-item-new" data-uid="${uid}" data-name="${data.name}">
                        <div class="item-main-content">
                            ${data.photo ? `<img src="${data.photo}" class="student-avatar" alt="${data.name}">` : `<div class="student-avatar-placeholder">${data.name.charAt(0)}</div>`}
                            <div>
                                <strong>${data.name}</strong>
                                <span class="badge-course">${data.course || data.regNo || ''}</span>
                            </div>
                        </div>
                        <button class="btn-mark-present" style="padding: 4px 8px; font-size: 0.7rem; background: var(--accent); color: #000; border: none; border-radius: 4px; cursor: pointer;">Mark</button>
                    </div>
                `;
                absentAttendeesHTML += itemHTML;
            }
        });

        // Add click delegation for opening profile from list items
        if (!todayListContainer._profileListenerAdded) {
            todayListContainer.addEventListener('click', (e) => {
                const listItem = e.target.closest('.list-item');
                if (listItem && !e.target.closest('button')) {
                    const uid = listItem.dataset.uid;
                    if (uid) openProfileModal(uid);
                }
            });
            todayListContainer._profileListenerAdded = true;
        }

        labeledDescriptors = descriptors;
        nameToDocId = tempMap;
        allUsersData = tempAllData;

        if (labeledDescriptors.length > 0) {
            faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.45); // Stricter match threshold (Decreased from 0.6)
        }

        todayCountDisplay.innerText = presentTodayCount;
        lastPresentHTML = presentAttendeesHTML;
        lastAbsentHTML = absentAttendeesHTML;

        // Automatically update history if we are viewing today's records
        if (currentHistoryDate === localToday) {
            // Filter allUsersData for today's records based on lastAttendance
            const todayRecords = tempAllData.filter(u => u.lastAttendance === todayStr);
            // Sort by name as done in loadHistoryForDate
            todayRecords.sort((a, b) => a.name.localeCompare(b.name));
            currentHistoryRecords = todayRecords;
            renderHistoryTable(todayRecords);

            const btnExportHistoryPdf = document.getElementById('btn-export-history-pdf');
            const showBtns = todayRecords.length > 0 ? 'block' : 'none';
            btnExportHistory.style.display = showBtns;
            if (btnExportHistoryPdf) btnExportHistoryPdf.style.display = showBtns;
        }

        // Proactive check: Ensure today's date exists in historyDates if there's presence
        if (presentTodayCount > 0 && currentSpace) {
            const spaceRef = doc(db, COLL_SPACES, currentSpace.id);
            getDoc(spaceRef).then(snap => {
                if (snap.exists()) {
                    const historyDates = snap.data().historyDates || {};
                    if (!historyDates[localToday]) {
                        console.log("Fixing missing history date:", localToday);
                        updateDoc(spaceRef, { [`historyDates.${localToday}`]: true });
                    }
                }
            });
        }

        // Run one-time sync for this session if not already done
        if (!currentSpace._historySynced) {
            syncHistoryDates();
            currentSpace._historySynced = true;
        }

        // Render based on active tab
        renderAttendanceList();
        renderPeopleManagement();
    });
}

function getLocalYYYYMMDD() {
    const d = new Date();
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
}

async function syncHistoryDates() {
    if (!currentSpace) return;
    console.log("Starting History Sync for:", currentSpace.name);
    try {
        const q = query(collection(db, COLL_ATTENDANCE), where("spaceId", "==", currentSpace.id));
        const snap = await getDocs(q);
        const uniqueDates = new Set();
        snap.forEach(doc => {
            const data = doc.data();
            if (data.date) uniqueDates.add(data.date);
        });

        if (uniqueDates.size === 0) return;

        const spaceRef = doc(db, COLL_SPACES, currentSpace.id);
        const spaceSnap = await getDoc(spaceRef);
        if (!spaceSnap.exists()) return;

        const historyDates = spaceSnap.data().historyDates || {};
        let needsUpdate = false;
        const updates = {};

        uniqueDates.forEach(date => {
            if (!historyDates[date]) {
                console.log("Found missing history date:", date);
                updates[`historyDates.${date}`] = true;
                needsUpdate = true;
            }
        });

        if (needsUpdate) {
            await updateDoc(spaceRef, updates);
            console.log("History Index Repaired successfully.");
        } else {
            console.log("History Index is already healthy.");
        }
    } catch (err) {
        console.error("History Sync Failed:", err);
    }
}
// Add event delegation for manual marking
if (!todayListContainer._listenerAdded) {
    todayListContainer.addEventListener('click', (e) => {
        const btnMark = e.target.closest('.btn-mark-present');
        const btnUndo = e.target.closest('.btn-undo-attendance');

        if (btnMark) {
            const item = btnMark.closest('.list-item');
            const uid = item.dataset.uid;
            const name = item.dataset.name;
            if (uid && name) {
                markAttendance(name);
            }
        } else if (btnUndo) {
            const item = btnUndo.closest('.list-item');
            const uid = item.dataset.uid;
            const name = item.dataset.name;
            if (uid && name) {
                unmarkAttendance(uid, name);
            }
        }
    });
    todayListContainer._listenerAdded = true;
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
    const fragment = document.createDocumentFragment();

    filteredUsers.sort((a, b) => a.name.localeCompare(b.name));

    // Get total days of attendance recorded for this space to calculate percentage
    const spaceRef = doc(db, COLL_SPACES, currentSpace.id);
    const spaceSnap = await getDoc(spaceRef);
    const historyDates = spaceSnap.data().historyDates || {};
    // Calculate max attendance among all users to normalize percentages
    const maxAttendance = Math.max(...allUsersData.map(u => u.attendanceCount || 0), 0);
    const denominator = maxAttendance || 1;

    filteredUsers.forEach(user => {
        const attendanceCount = user.attendanceCount || 0;
        const percentage = Math.round((attendanceCount / denominator) * 100);
        const isPending = user.approved === false;

        const card = document.createElement('div');
        card.className = 'management-person-card';
        card.innerHTML = `
            <div class="item-main-content">
                ${user.photo ? `<img src="${user.photo}" class="student-avatar" alt="${user.name}">` : `<div class="student-avatar-placeholder">${user.name.charAt(0)}</div>`}
                <div class="person-primary-info">
                    <strong>${user.name} ${isPending ? '<span class="badge-pending">Pending Approval</span>' : ''}</strong>
                    <small style="color:var(--text-muted)">${user.regNo || 'No Reg No'}</small>
                </div>
            </div>
            <div class="person-stats-row">
                ${isPending ? `
                    <div class="approval-actions">
                        <button class="btn-approve" data-id="${user.id}">Approve</button>
                        <button class="btn-reject" data-id="${user.id}">Reject</button>
                    </div>
                ` : `
                    <div class="percentage-badge" aria-label="Attendance Percentage: ${percentage}%">${percentage}%</div>
                    <div style="display: flex; gap: 4px;">
                        ${user.lastAttendance !== new Date().toDateString() ? `<button class="btn-icon mark-present-today-btn" data-id="${user.id}" data-name="${user.name}" title="Mark Present Today">✅</button>` : ''}
                        <button class="btn-icon edit-btn" data-id="${user.id}" aria-label="Edit details for ${user.name}">✏️</button>
                    </div>
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
            const markBtn = card.querySelector('.mark-present-today-btn');
            if (markBtn) {
                markBtn.onclick = () => markAttendance(user.name);
            }
        }
        fragment.appendChild(card);
    });

    peopleListContainer.appendChild(fragment);

    // Add click event for details popup
    peopleListContainer.querySelectorAll('.management-person-card').forEach(card => {
        card.addEventListener('click', (e) => {
            // Don't open profile if clicking on buttons
            if (e.target.closest('button')) return;

            const avatar = card.querySelector('.student-avatar, .student-avatar-placeholder');
            const uid = card.querySelector('.edit-btn')?.dataset.id || card.querySelector('.btn-approve')?.dataset.id;

            if (uid) openProfileModal(uid);
        });
    });
}

async function openProfileModal(uid) {
    const userData = allUsersData.find(u => u.id === uid);
    if (!userData) return;

    profileName.innerText = userData.name;
    profileRegNo.innerText = userData.regNo || 'No Reg No';
    profileCourse.innerText = userData.course || 'No Course';

    if (userData.photo) {
        profilePhoto.src = userData.photo;
        profilePhoto.classList.remove('hidden');
        profilePhotoPlaceholder.classList.add('hidden');
    } else {
        profilePhoto.classList.add('hidden');
        profilePhotoPlaceholder.innerText = userData.name.charAt(0).toUpperCase();
        profilePhotoPlaceholder.classList.remove('hidden');
    }

    profileHistoryList.innerHTML = '';
    profileHistoryStatus.innerText = 'Fetching records...';
    profileHistoryStatus.classList.remove('hidden');
    profileModal.classList.remove('hidden');

    try {
        const q = query(
            collection(db, COLL_ATTENDANCE),
            where("spaceId", "==", currentSpace.id),
            where("userId", "==", uid)
        );

        const querySnapshot = await getDocs(q);
        const records = [];
        querySnapshot.forEach(doc => records.push(doc.data()));

        // Sort by timestamp desc
        records.sort((a, b) => {
            const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.date);
            const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.date);
            return dateB - dateA;
        });

        if (records.length === 0) {
            profileHistoryStatus.innerText = 'No attendance history found.';
        } else {
            profileHistoryStatus.classList.add('hidden');
            records.forEach(rec => {
                const date = new Date(rec.date).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
                const time = rec.timestamp?.toDate ? rec.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A';

                const item = document.createElement('div');
                item.className = 'history-item-minimal';
                item.innerHTML = `
                    <span class="date">${date}</span>
                    <span class="time">${time}</span>
                `;
                profileHistoryList.appendChild(item);
            });
        }
    } catch (err) {
        console.error("Profile History Error:", err);
        profileHistoryStatus.innerText = 'Failed to load history.';
    }
}

if (btnCloseProfile) btnCloseProfile.onclick = () => profileModal.classList.add('hidden');

// Close profile modal on outside click
profileModal.addEventListener('click', (e) => {
    if (e.target === profileModal) profileModal.classList.add('hidden');
});

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

// Drawing

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

        // Dark Green for matches, original color (red) for unknown
        const bgColor = isMatch ? '#064e3b' : color;
        const textColor = isMatch ? '#fff' : '#000';

        ctx.shadowBlur = 15;
        ctx.shadowColor = bgColor;
        ctx.fillStyle = bgColor;
        ctx.beginPath();
        ctx.roundRect(pillX, pillY, pillWidth, pillHeight, 13);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = textColor;
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


function drawFaceMesh(ctx, landmarks, color = '#10b981') {
    const points = landmarks.positions;
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = 0.5;


    ctx.beginPath();
    points.forEach((p, i) => {

        for (let j = i + 1; j < i + 4 && j < points.length; j++) {
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(points[j].x, points[j].y);
        }
    });
    ctx.stroke();


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

// Audio
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

// Main

video.addEventListener('play', () => {

    const updateDisplaySize = () => {
        if (!video.videoWidth) return null;
        const dims = { width: video.videoWidth, height: video.videoHeight };
        canvas.width = dims.width;
        canvas.height = dims.height;

        for (let k in smoothBoxes) delete smoothBoxes[k];
        return dims;
    };

    let displaySize = updateDisplaySize();
    video.addEventListener('loadedmetadata', () => { displaySize = updateDisplaySize(); });
    window.addEventListener('resize', () => { displaySize = updateDisplaySize(); });

    async function detectionLoop() {
        if (!isModelsLoaded || !video.srcObject || video.paused || video.ended || isAIPaused || isCameraOff || currentMode === 'registration' || document.hidden) {
            setTimeout(detectionLoop, DETECTION_INTERVAL);
            return;
        }

        try {
            if (!canvas.width || canvas.width !== video.videoWidth) {
                updateDisplaySize();
            }

            const detections = await faceapi.detectAllFaces(video)
                .withFaceLandmarks()
                .withFaceDescriptors();

            if (detections && detections.length > 0) {
                const results = detections.map(d => {
                    return faceMatcher ? faceMatcher.findBestMatch(d.descriptor) : { label: 'unknown', distance: 1.0 };
                });

                if (!wasFaceDetected) {
                    CyberAudio.playLock();
                    wasFaceDetected = true;
                }

                window.lastDetections = detections;
                window.lastResults = results;

                if (scanIndicator) {
                    scanIndicator.innerHTML = `🛰️ SCANNING`;
                    scanIndicator.style.display = 'block';
                }

                detections.forEach((detection, i) => {
                    const result = results[i];
                    const isAttendanceMatch = result.label !== 'unknown' && result.distance <= 0.45;
                    if (isAttendanceMatch) {
                        detectionHistory[result.label] = (detectionHistory[result.label] || 0) + 1;
                        if (detectionHistory[result.label] >= VALIDATION_THRESHOLD) {
                            markAttendance(result.label);
                            detectionHistory[result.label] = 0;
                        }
                    }
                });

                const activeMatchLabels = results.filter(r => r.label !== 'unknown').map(r => r.label);
                for (let k in detectionHistory) {
                    if (!activeMatchLabels.includes(k)) {
                        detectionHistory[k] = Math.max(0, detectionHistory[k] - 1);
                    }
                }
            } else {
                window.lastDetections = [];
                window.lastResults = [];
                wasFaceDetected = false;
                if (scanIndicator) scanIndicator.style.display = 'none';

                // Slowly decay history only when nothing is detected to keep it stable
                for (let k in detectionHistory) {
                    detectionHistory[k] = Math.max(0, detectionHistory[k] - 0.5);
                }
            }
        } catch (err) {
            console.warn("Detection cycle skipped:", err);
        }

        setTimeout(detectionLoop, DETECTION_INTERVAL);
    }

    detectionLoop();

    // Animate
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

        if (window.lastDetections && window.lastDetections.length > 0) {
            window.lastDetections.forEach((detection, i) => {
                const result = window.lastResults[i];
                if (!result) return;

                const box = detection.detection.box;
                const confidence = Math.round((1 - result.distance) * 100);
                const isAttendanceMatch = result.label !== 'unknown' && result.distance <= 0.6;
                const isPotentialMatch = result.label !== 'unknown' && result.distance <= 0.6;
                const displayLabel = isPotentialMatch ? result.label : 'SEARCHING...';

                const isUnknown = result.label === 'unknown';
                const statusColor = isAttendanceMatch ? '#22c55e' : (isUnknown ? '#ef4444' : '#10b981');

                let drawBox = box;
                if (isPotentialMatch) {
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
                drawCustomFaceBox(ctx, drawBox, displayLabel, isPotentialMatch, confidence, result.label);
            });
        }

        requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
});



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
        const photoBase64 = captureFacePhoto(video, detection.detection.box);
        await finalizeRegistration(name, metadata, Array.from(detection.descriptor), photoBase64);
    } else {
        alert("No face detected in camera. Please align your face and try again.");
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
            const photoBase64 = captureFacePhoto(img, detection.detection.box);
            await finalizeRegistration(name, metadata, Array.from(detection.descriptor), photoBase64);
        } else {
            alert("No face detected in uploaded photo. Please try another image.");
            regFeedback.innerText = "No face detected in uploaded photo.";
            regFeedback.style.color = "var(--danger)";
        }
    } catch (err) {
        console.error("Upload Error:", err);
        alert("Error processing image: " + err.message);
    }
    e.target.value = '';
}

function captureFacePhoto(source, box) {
    try {
        const canvas = document.createElement('canvas');
        const buffer = 0.2; // 20% margin
        const ctx = canvas.getContext('2d');
        canvas.width = 150;
        canvas.height = 150;

        const { x, y, width, height } = box;
        const bx = Math.max(0, x - width * buffer);
        const by = Math.max(0, y - height * buffer);
        const bw = width * (1 + buffer * 2);
        const bh = height * (1 + buffer * 2);

        ctx.drawImage(source, bx, by, bw, bh, 0, 0, 150, 150);
        return canvas.toDataURL('image/jpeg', 0.8);
    } catch (e) {
        console.error("Capture Error:", e);
        return null;
    }
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
async function finalizeRegistration(name, metadata, descriptorArray, photoBase64) {
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
            photo: photoBase64,
            attendanceCount: 0,
            lastAttendance: null,
            approved: !isMagicLinkSession,
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
    const docId = nameToDocId[name];
    if (!docId) return;

    const now = Date.now();
    const lastMarked = attendanceCooldowns[name] || 0;
    // 1 minute cooldown to prevent duplicate triggers
    if (now - lastMarked < 60000) return;

    try {
        const userDocRef = doc(db, COLL_USERS, docId);
        const todayDate = new Date().toDateString();
        const userSnap = await getDoc(userDocRef);

        if (!userSnap.exists()) return;
        const userData = userSnap.data();

        // 1. Always log sightings (Live Activity)
        const timeStr = new Date().toLocaleTimeString();
        addLiveLogEntry(name, timeStr);

        // 2. ONLY mark attendance if not already marked today
        if (userData.lastAttendance === todayDate) {
            // Silently return for DB update, but we still log the sighting above
            return;
        }

        // Save to History Collection
        const dateId = getLocalYYYYMMDD();

        // Push both updates - order matters: ensure history exists before or with user update
        await Promise.all([
            addDoc(collection(db, COLL_ATTENDANCE), {
                spaceId: currentSpace.id,
                userId: docId,
                name: name,
                regNo: userData.regNo || '',
                course: userData.course || '',
                date: dateId,
                timestamp: new Date()
            }),
            updateDoc(doc(db, COLL_SPACES, currentSpace.id), {
                [`historyDates.${dateId}`]: true
            }),
            updateDoc(userDocRef, {
                lastAttendance: todayDate,
                attendanceCount: increment(1)
            })
        ]);

        // ONLY AFTER SUCCESS: Mark cooldown and perform side effects
        attendanceCooldowns[name] = now;

        if (navigator.vibrate) navigator.vibrate(100);
        showToast(`Attendance marked: ${name}`, 'success');

        // Trigger Digital ID Card
        showIdCard(userData);

        const nowSpoken = Date.now();
        const lastTimeSpoken = lastSpoken[name] || 0;
        // 2 second buffer for the same person to avoid accidental double-speak
        if (nowSpoken - lastTimeSpoken > 2000) {
            const gender = userData.gender || 'male';
            speak(`${name} present`, gender);
            lastSpoken[name] = nowSpoken;
        }

        const wrapper = document.querySelector('.camera-wrapper');
        if (wrapper) {
            wrapper.classList.add('success-pulse');
            setTimeout(() => wrapper.classList.remove('success-pulse'), 400);
        }

    } catch (err) {
        console.error("Attendance Update Error:", err);
    }
}

async function unmarkAttendance(uid, name) {
    if (!currentSpace) return;

    showConfirm(`Remove attendance for ${name}?`, async () => {
        try {
            const userDocRef = doc(db, COLL_USERS, uid);
            const todayDate = new Date().toDateString();

            // Revert user status
            await updateDoc(userDocRef, {
                lastAttendance: "removed", // or null, using "removed" to distinguish from never attended
                attendanceCount: increment(-1)
            });

            // Remove from History Collection for today
            const dateId = getLocalYYYYMMDD();
            const q = query(
                collection(db, COLL_ATTENDANCE),
                where("spaceId", "==", currentSpace.id),
                where("userId", "==", uid),
                where("date", "==", dateId)
            );

            const querySnapshot = await getDocs(q);
            const deletePromises = [];
            querySnapshot.forEach((doc) => {
                deletePromises.push(deleteDoc(doc.ref));
            });
            await Promise.all(deletePromises);

            showToast(`Attendance removed for ${name}`);

            // Clean up cooldown so they can be marked again immediately if needed
            delete attendanceCooldowns[name];

        } catch (err) {
            console.error("Unmark Attendance Error:", err);
            showToast("Failed to remove attendance", "error");
        }
    });
}

// Geo
if (btnSetLocation) {
    btnSetLocation.addEventListener('click', () => {
        if (!navigator.geolocation) {
            alert("Geolocation is not supported by your browser.");
            return;
        }

        geoStatus.innerText = "Finding you...";
        navigator.geolocation.getCurrentPosition((pos) => {
            const { latitude, longitude, accuracy } = pos.coords;
            btnSetLocation.dataset.lat = latitude;
            btnSetLocation.dataset.lng = longitude;
            geoStatus.innerText = `Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)}`;
            geoStatus.style.color = "var(--success)";

            const radius = parseFloat(configGeoRadius.value) || 100;
            updateConfigMapPreview(latitude, longitude, radius, accuracy);

            if (accuracy > 20) {
                showToast("GPS signal weak. Try moving to a window for better 10m precision.", "error");
            }
        }, (err) => {
            console.error("Geo Error:", err);
            geoStatus.innerText = "Error: Permission denied / signal weak.";
            geoStatus.style.color = "var(--danger)";
        }, { enableHighAccuracy: true });
    });
}

if (configGeoRadius) {
    configGeoRadius.addEventListener('input', () => {
        const radius = parseFloat(configGeoRadius.value) || 100;
        const locText = geoStatus.innerText;
        if (locText.includes('Lat:') && configLeafletMap) {
            const parts = locText.split(',');
            const lat = parseFloat(parts[0].split(':')[1]);
            const lng = parseFloat(parts[1].split(':')[1]);
            updateConfigMapPreview(lat, lng, radius);
        }
    });
}

// UI

document.getElementById('btn-mode-attend').addEventListener('click', () => setMode('attendance'));
document.getElementById('btn-mode-reg').addEventListener('click', () => setMode('registration'));
document.getElementById('btn-mode-analytics').addEventListener('click', () => setMode('analytics'));
document.getElementById('btn-mode-config').addEventListener('click', () => setMode('config'));

const mobileNavItems = document.querySelectorAll('.nav-item');
mobileNavItems.forEach(item => {
    item.addEventListener('click', () => {
        const mode = item.dataset.mode;
        setMode(mode);
    });
});

if (btnCapture) btnCapture.addEventListener('click', handleCameraRegistration);
if (btnUploadTrigger) btnUploadTrigger.addEventListener('click', () => inputUploadPhoto.click());
if (inputUploadPhoto) inputUploadPhoto.addEventListener('change', handlePhotoUpload);

if (btnExport) btnExport.addEventListener('click', exportToExcel);
const btnExportPdf = document.getElementById('btn-export-pdf');
if (btnExportPdf) btnExportPdf.addEventListener('click', exportToPDF);
const btnExportHistoryPdf = document.getElementById('btn-export-history-pdf');
if (btnExportHistoryPdf) btnExportHistoryPdf.addEventListener('click', exportHistoryToPDF);

// Magic Link Event Listeners
const btnGenerateMagic = document.getElementById('btn-generate-magic');
const btnProjectMagic = document.getElementById('btn-project-magic');
const magicLinkContainer = document.getElementById('magic-link-container');
const magicLinkInput = document.getElementById('magic-link-input');
const btnCopyMagic = document.getElementById('btn-copy-magic');

const magicQrModal = document.getElementById('magic-qr-modal');
const btnCloseMagicQr = document.getElementById('btn-close-magic-qr');
const magicQrImage = document.getElementById('magic-qr-image');
const magicQrTimer = document.getElementById('magic-qr-timer');
const magicQrSpaceName = document.getElementById('magic-qr-space-name');

let magicQrInterval = null;

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

if (btnProjectMagic) {
    btnProjectMagic.addEventListener('click', showMagicQR);
}

if (btnCloseMagicQr) {
    btnCloseMagicQr.addEventListener('click', () => {
        magicQrModal.classList.add('hidden');
        if (magicQrInterval) clearInterval(magicQrInterval);
    });
}

async function showMagicQR() {
    if (!currentSpace) return alert("Space ID not found");

    magicQrSpaceName.innerText = currentSpace.name || "Workspace";
    let baseUrl = window.location.href.split('?')[0].split('#')[0].replace('index.html', '');
    if (!baseUrl.endsWith('/')) baseUrl += '/';

    const duration = 5 * 60 * 1000;
    const expiresAt = Date.now() + duration;
    const url = `${baseUrl}register.html?s=${currentSpace.id}&exp=${expiresAt}`;

    // Generate QR
    const qrEngine = window.QRCode || (typeof QRCode !== 'undefined' ? QRCode : null);
    if (qrEngine && qrEngine.toDataURL) {
        qrEngine.toDataURL(url, {
            width: 500,
            margin: 2,
            errorCorrectionLevel: 'H'
        }, (err, dataUrl) => {
            if (err) console.error(err);
            magicQrImage.src = dataUrl;
        });
    } else {
        magicQrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(url)}`;
    }

    magicQrModal.classList.remove('hidden');

    // Timer
    if (magicQrInterval) clearInterval(magicQrInterval);

    const updateTimer = () => {
        const remaining = Math.max(0, expiresAt - Date.now());
        const mins = Math.floor(remaining / 60000);
        const secs = Math.floor((remaining % 60000) / 1000);
        magicQrTimer.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

        if (remaining <= 0) {
            clearInterval(magicQrInterval);
            magicQrTimer.style.color = "var(--danger)";
        }
    };

    updateTimer();
    magicQrInterval = setInterval(updateTimer, 1000);
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
    [regForm, attendInfo, configForm, analyticsPanel].forEach(el => el && el.classList.add('hidden'));
    [
        document.getElementById('btn-mode-attend'),
        document.getElementById('btn-mode-reg'),
        document.getElementById('btn-mode-config'),
        document.getElementById('btn-mode-analytics')
    ].forEach(btn => btn && btn.classList.remove('active'));

    if (mode === 'registration') {
        regForm.classList.remove('hidden');
        document.getElementById('btn-mode-reg').classList.add('active');
        statusBadge.innerText = "Student Registration";
        updateRegistrationForm();
    } else if (mode === 'config') {
        configForm.classList.remove('hidden');
        document.getElementById('btn-mode-config').classList.add('active');
        statusBadge.innerText = "Configuration";
        syncConfigToggles();
    } else if (mode === 'analytics') {
        analyticsPanel.classList.remove('hidden');
        document.getElementById('btn-mode-analytics').classList.add('active');
        statusBadge.innerText = "Analytics & Logs";
        renderPeopleManagement();
    } else {
        isAIPaused = false; // Reactivate background processing
        attendInfo.classList.remove('hidden');
        document.getElementById('btn-mode-attend').classList.add('active');
        statusBadge.innerText = "Attendance Monitor";
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

async function exportToExcel() {
    if (allUsersData.length === 0) {
        alert("No data available for this workspace.");
        return;
    }

    try {
        showToast("Generating Master Report...", "info");

        // 1. Fetch all attendance records for this space
        const attendQuery = query(
            collection(db, COLL_ATTENDANCE),
            where("spaceId", "==", currentSpace.id)
        );
        const attendSnap = await getDocs(attendQuery);

        // 2. Map data: userId -> date -> time
        const attendanceMap = {};
        const uniqueDates = new Set();
        const dateTotals = {};

        attendSnap.forEach(snap => {
            const data = snap.data();
            if (!attendanceMap[data.userId]) attendanceMap[data.userId] = {};

            const timeStr = data.timestamp ? new Date(data.timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'P';

            if (!attendanceMap[data.userId][data.date]) {
                attendanceMap[data.userId][data.date] = `P (${timeStr})`;
                dateTotals[data.date] = (dateTotals[data.date] || 0) + 1;
            }
            uniqueDates.add(data.date);
        });

        const sortedDates = Array.from(uniqueDates).sort();
        const totalDatesCount = sortedDates.length;

        // 3. Build CSV Header
        const headers = ["Name", "Reg No", "Course", "Phone", "Days Present", "Attendance %", ...sortedDates];
        let csvContent = headers.map(h => `"${h}"`).join(",") + "\n";

        // 4. Build CSV Rows (Students - Sorted Alphabetically)
        const sortedUsers = [...allUsersData].sort((a, b) => {
            const nameA = (a.name || '').toLowerCase();
            const nameB = (b.name || '').toLowerCase();
            return nameA.localeCompare(nameB);
        });

        sortedUsers.forEach(user => {
            const presentDays = Object.keys(attendanceMap[user.id] || {}).length;
            const percentage = totalDatesCount > 0 ? ((presentDays / totalDatesCount) * 100).toFixed(1) + '%' : '0%';

            const row = [
                user.name || 'Unknown',
                user.regNo || 'N/A',
                user.course || 'N/A',
                user.phone || 'N/A',
                presentDays,
                percentage
            ];

            sortedDates.forEach(date => {
                row.push(attendanceMap[user.id]?.[date] || '-');
            });

            csvContent += row.map(cell => `"${cell}"`).join(",") + "\n";
        });

        // Summary
        const summaryRow = ["DAILY TOTALS", "", "", "", "", ""];
        sortedDates.forEach(date => {
            summaryRow.push(dateTotals[date] || 0);
        });
        csvContent += summaryRow.map(cell => `"${cell}"`).join(",") + "\n";

        // 6. Trigger Download as .csv (Excel compatible)
        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `Master_Attendance_${currentSpace.name.replace(/\s+/g, '_')}_${getLocalYYYYMMDD()}.csv`;
        link.click();

        showToast("Master Report Exported!");
    } catch (err) {
        console.error("Export Error:", err);
        alert("Failed to export: " + err.message);
    }
}

async function exportToPDF() {
    if (allUsersData.length === 0) {
        alert("No data available for this workspace.");
        return;
    }

    try {
        showToast("Generating Master PDF Report...", "info");

        // 1. Fetch all attendance records
        const attendQuery = query(
            collection(db, COLL_ATTENDANCE),
            where("spaceId", "==", currentSpace.id)
        );
        const attendSnap = await getDocs(attendQuery);

        // 2. Map data
        const attendanceMap = {};
        const uniqueDates = new Set();
        attendSnap.forEach(snap => {
            const data = snap.data();
            if (!attendanceMap[data.userId]) attendanceMap[data.userId] = {};
            attendanceMap[data.userId][data.date] = true;
            uniqueDates.add(data.date);
        });

        const sortedDates = Array.from(uniqueDates).sort();
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('l', 'mm', 'a4'); // Landscape for more space

        // 3. Document Setup
        doc.setFontSize(20);
        doc.text("CognitoAttend Master Report", 14, 22);
        doc.setFontSize(10);
        doc.text(`Workspace: ${currentSpace.name}`, 14, 30);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 36);

        // Table
        const tableHeaders = ["Name", "Reg No", "Course", "Present", "Pct", ...sortedDates.map(d => d.split('-').slice(1).reverse().join('/'))];
        const tableData = [];

        const sortedUsers = [...allUsersData].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        sortedUsers.forEach(user => {
            const presentDays = Object.keys(attendanceMap[user.id] || {}).length;
            const percentage = sortedDates.length > 0 ? ((presentDays / sortedDates.length) * 100).toFixed(0) + '%' : '0%';

            const row = [
                user.name || 'Unknown',
                user.regNo || '-',
                user.course || '-',
                presentDays,
                percentage
            ];

            sortedDates.forEach(date => {
                row.push(attendanceMap[user.id]?.[date] ? "P" : "-");
            });
            tableData.push(row);
        });

        doc.autoTable({
            startY: 45,
            head: [tableHeaders],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [0, 242, 255], textColor: [0, 0, 0] },
            styles: { fontSize: 7, cellPadding: 1 },
            columnStyles: { 0: { cellWidth: 35 } }
        });

        doc.save(`Master_Attendance_${currentSpace.name.replace(/\s+/g, '_')}.pdf`);
        showToast("PDF Exported!");

    } catch (err) {
        console.error("PDF Export Error:", err);
        showToast("Failed to export PDF", "error");
    }
}

async function exportHistoryToPDF() {
    if (currentHistoryRecords.length === 0) return;

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        doc.setFontSize(20);
        doc.text("Attendance Report", 14, 22);
        doc.setFontSize(11);
        doc.text(`Workspace: ${currentSpace.name}`, 14, 30);
        doc.text(`Date: ${currentHistoryDate}`, 14, 36);

        const tableHeaders = ["Name", "Reg No", "Course", "Time"];
        const tableData = currentHistoryRecords.map(r => [
            r.name,
            r.regNo || '-',
            r.course || '-',
            r.timestamp ? (r.timestamp.toDate ? r.timestamp.toDate() : new Date(r.timestamp)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'
        ]);

        doc.autoTable({
            startY: 45,
            head: [tableHeaders],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: [0, 242, 255], textColor: [0, 0, 0] }
        });

        doc.save(`Attendance_${currentSpace.name}_${currentHistoryDate}.pdf`);
        showToast("History PDF Exported!");
    } catch (err) {
        console.error("History PDF Export Error:", err);
        showToast("Failed to export PDF", "error");
    }
}

setMode('attendance');

// 3D
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

    const geometry = new THREE.IcosahedronGeometry(2.5, 3);

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


    const pointsMaterial = new THREE.PointsMaterial({
        color: 0x38bdf8,
        size: 0.05,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending
    });
    const corePoints = new THREE.Points(geometry, pointsMaterial);
    headGroup.add(corePoints);


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


    const bgCount = 500;
    const bgGeo = new THREE.BufferGeometry();
    const bgPos = new Float32Array(bgCount * 3);
    for (let i = 0; i < bgCount * 3; i++) bgPos[i] = (Math.random() - 0.5) * 25;
    bgGeo.setAttribute('position', new THREE.BufferAttribute(bgPos, 3));
    const bgPoints = new THREE.Points(bgGeo, new THREE.PointsMaterial({ color: 0x0ea5e9, size: 0.02, transparent: true, opacity: 0.2 }));
    scene3D.add(bgPoints);


    scene3D.add(new THREE.AmbientLight(0xffffff, 0.2));
    const spotlight = new THREE.PointLight(0x0ea5e9, 1);
    spotlight.position.set(10, 10, 10);
    scene3D.add(spotlight);

    // Animation
    let time = 0;
    function animate() {
        requestAnimationFrame(animate);
        time += 0.01;

        headGroup.rotation.y = Math.sin(time * 0.2) * 0.4;
        headGroup.rotation.x = Math.cos(time * 0.15) * 0.1;


        plexusLines.material.opacity = 0.2 + Math.sin(time * 2) * 0.1;
        corePoints.material.opacity = 0.6 + Math.sin(time * 3) * 0.2;


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
// Dynamic Glow Trail
document.addEventListener('mousemove', (e) => {
    if (Math.random() > 0.15) return; // Rate limiting
    const p = document.createElement('div');
    p.className = 'mouse-trail-particle';
    p.style.left = e.clientX + 'px';
    p.style.top = e.clientY + 'px';
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 800);
});
