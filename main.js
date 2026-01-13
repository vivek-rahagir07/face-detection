// Import Firebase Modules (Modular SDK 11.6.1)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, updateDoc, doc, onSnapshot, increment, query, where, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Configuration & Setup

let db, auth, currentUser;
const COLL_USERS = 'users';
const COLL_SPACES = 'spaces';

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
const regFeedback = document.getElementById('reg-feedback');
const btnExport = document.getElementById('btn-export');
const scanIndicator = document.getElementById('scan-indicator');
const dynamicFieldsContainer = document.getElementById('dynamic-fields-container');
const configForm = document.getElementById('config-form');
const attendInfo = document.getElementById('attend-info');
const regForm = document.getElementById('reg-form');
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

btnPortalJoin.addEventListener('click', handleJoin);
btnPortalCreate.addEventListener('click', handleCreate);
btnExitWorkspace.addEventListener('click', () => {
    currentSpace = null;
    showView('view-portal');
});

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
        newConfig[el.dataset.field] = el.checked;
    });

    try {
        await updateDoc(doc(db, COLL_SPACES, currentSpace.id), { config: newConfig });
        currentSpace.config = newConfig; // Update local state
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


async function registerUser() {
    if (!currentUser || !currentSpace) {
        alert("System not ready.");
        return;
    }

    const nameEl = document.getElementById('reg-name');
    const name = nameEl ? nameEl.value.trim() : '';

    if (!name) {
        alert("Name is required.");
        return;
    }

    // Collect dynamic fields meta
    const metadata = {};
    if (document.getElementById('reg-regNo')) metadata.regNo = document.getElementById('reg-regNo').value.trim();
    if (document.getElementById('reg-course')) metadata.course = document.getElementById('reg-course').value.trim();
    if (document.getElementById('reg-email')) metadata.email = document.getElementById('reg-email').value.trim();
    if (document.getElementById('reg-bloodGroup')) metadata.bloodGroup = document.getElementById('reg-bloodGroup').value.trim();
    if (document.getElementById('reg-weight')) metadata.weight = document.getElementById('reg-weight').value.trim();
    if (document.getElementById('reg-phone')) metadata.phone = document.getElementById('reg-phone').value.trim();

    regFeedback.innerText = "Scanning...";
    regFeedback.style.color = "var(--primary)";

    const detection = await faceapi.detectSingleFace(video)
        .withFaceLandmarks()
        .withFaceDescriptor();

    if (detection) {
        // Check if name already exists in THIS SPACE
        if (nameToDocId[name]) {
            alert("A user with this name already exists in this workspace.");
            regFeedback.innerText = "Name taken.";
            return;
        }

        const descriptorArray = Array.from(detection.descriptor);

        try {
            await addDoc(collection(db, COLL_USERS), {
                spaceId: currentSpace.id,
                name: name,
                ...metadata, // Save course/regNo/phone at top level for compatibility
                descriptor: descriptorArray,
                attendanceCount: 0,
                lastAttendance: null,
                createdAt: new Date()
            });

            alert(`Registered ${name} successfully!`);
            nameEl.value = "";
            if (document.getElementById('reg-regNo')) document.getElementById('reg-regNo').value = "";
            if (document.getElementById('reg-course')) document.getElementById('reg-course').value = "";
            if (document.getElementById('reg-email')) document.getElementById('reg-email').value = "";
            if (document.getElementById('reg-bloodGroup')) document.getElementById('reg-bloodGroup').value = "";
            if (document.getElementById('reg-weight')) document.getElementById('reg-weight').value = "";
            if (document.getElementById('reg-phone')) document.getElementById('reg-phone').value = "";
            regFeedback.innerText = "Success!";
            regFeedback.style.color = "var(--success)";

        } catch (error) {
            console.error("Write Error:", error);
            alert("Failed to save data: " + error.message);
        }
    } else {
        regFeedback.innerText = "No face detected. Look at camera.";
        regFeedback.style.color = "var(--danger)";
    }
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

// UI Handlers

document.getElementById('btn-mode-attend').addEventListener('click', () => setMode('attendance'));
document.getElementById('btn-mode-reg').addEventListener('click', () => setMode('registration'));
document.getElementById('btn-mode-config').addEventListener('click', () => setMode('config'));

if (btnCapture) btnCapture.addEventListener('click', registerUser);
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
        width = 300;
        height = 400;
        setTimeout(() => {
            try { window.dispatchEvent(new Event('resize')); } catch (e) { }
        }, 500);
    }

    container.dataset.initialized = "true";

    const scene3D = new THREE.Scene();
    const camera3D = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera3D.position.z = 6.0;

    const renderer3D = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer3D.setSize(width, height);
    renderer3D.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer3D.domElement);

    // --- Procedural Head Generation (Enhanced) ---
    const geometry = new THREE.IcosahedronGeometry(2.2, 4); // Smoother, more tech-like
    const positionAttribute = geometry.attributes.position;
    const vertex = new THREE.Vector3();

    for (let i = 0; i < positionAttribute.count; i++) {
        vertex.fromBufferAttribute(positionAttribute, i);
        
        // Shape into a head
        vertex.y *= 1.3; // Elongate
        if (vertex.y < 0) {
            const taper = 1 - (Math.abs(vertex.y) * 0.2);
            vertex.x *= taper;
            vertex.z *= taper * 0.85;
        }
        vertex.x *= 0.95; // Cheeks

        positionAttribute.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }
    positionAttribute.needsUpdate = true;
    geometry.computeVertexNormals();

    // Material with high-end aesthetic
    const material = new THREE.MeshPhongMaterial({
        color: 0x6366f1, // Primary Indigo
        wireframe: true,
        transparent: true,
        opacity: 0.2,
        emissive: 0x4f46e5,
        emissiveIntensity: 0.5,
        side: THREE.DoubleSide
    });

    const headGroup = new THREE.Group();
    const headMesh = new THREE.Mesh(geometry, material);
    headGroup.add(headMesh);
    scene3D.add(headGroup);

    // --- Point Cloud (Skin Nodes) ---
    const pointsMaterial = new THREE.PointsMaterial({
        color: 0x818cf8,
        size: 0.04,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending
    });
    const pointCloud = new THREE.Points(geometry, pointsMaterial);
    headGroup.add(pointCloud);

    // --- Floating Particles (Environment) ---
    const partCount = 200;
    const partGeo = new THREE.BufferGeometry();
    const partPos = new Float32Array(partCount * 3);
    for (let i = 0; i < partCount * 3; i++) {
        partPos[i] = (Math.random() - 0.5) * 10;
    }
    partGeo.setAttribute('position', new THREE.BufferAttribute(partPos, 3));
    const partMat = new THREE.PointsMaterial({
        color: 0x818cf8,
        size: 0.02,
        transparent: true,
        opacity: 0.4
    });
    const particles = new THREE.Points(partGeo, partMat);
    scene3D.add(particles);

    // --- Lights (For Phong Material) ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene3D.add(ambientLight);
    const pointLight = new THREE.PointLight(0x818cf8, 1);
    pointLight.position.set(5, 5, 5);
    scene3D.add(pointLight);

    // --- Scanning Laser (Premium) ---
    const laserGroup = new THREE.Group();
    const laserGeo = new THREE.CylinderGeometry(3.5, 3.5, 0.05, 32, 1, true);
    const laserMat = new THREE.MeshBasicMaterial({
        color: 0x0ea5e9,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
    });
    const laserStrip = new THREE.Mesh(laserGeo, laserMat);
    laserStrip.rotation.x = Math.PI / 2;
    laserGroup.add(laserStrip);

    // Inner glow for laser
    const laserGlowGeo = new THREE.CylinderGeometry(3.55, 3.55, 0.2, 32, 1, true);
    const laserGlowMat = new THREE.MeshBasicMaterial({
        color: 0x0ea5e9,
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
    });
    const laserGlow = new THREE.Mesh(laserGlowGeo, laserGlowMat);
    laserGlow.rotation.x = Math.PI / 2;
    laserGroup.add(laserGlow);
    
    scene3D.add(laserGroup);

    // --- Viewfinder Box ---
    const boxGeo = new THREE.BoxGeometry(7, 9, 7);
    const edges = new THREE.EdgesGeometry(boxGeo);
    const boxMat = new THREE.LineBasicMaterial({ color: 0x818cf8, transparent: true, opacity: 0.1 });
    const wireframeBox = new THREE.LineSegments(edges, boxMat);
    scene3D.add(wireframeBox);

    // --- Animation Loop ---
    let frame = 0;
    function animate() {
        requestAnimationFrame(animate);
        frame += 0.01;

        // Rotate Head
        headGroup.rotation.y = Math.sin(frame * 0.5) * 0.3;
        headGroup.rotation.x = Math.cos(frame * 0.3) * 0.1;

        // Animate Laser
        const laserY = Math.sin(frame * 1.5) * 4.5;
        laserGroup.position.y = laserY;
        laserStrip.material.opacity = 0.4 + Math.sin(frame * 4) * 0.2;
        
        // Pulse effects
        headMesh.material.opacity = 0.15 + Math.sin(frame * 2) * 0.05;
        
        // Rotate environment
        particles.rotation.y += 0.001;
        particles.rotation.z += 0.0005;

        renderer3D.render(scene3D, camera3D);
    }
    animate();

    // Reset logic if container is 'portal-guide-container'
    if (containerId === 'portal-guide-container') {
        const statuses = ["ANALYZING BIOMETRICS", "STRUCTURAL MAPPING", "NEURAL SYNCING", "PROTOCOL READY"];
        let idx = 0;
        const statusEl = document.getElementById('guide-status-text');
        if (statusEl) {
            setInterval(() => {
                idx = (idx + 1) % statuses.length;
                statusEl.style.opacity = '0';
                setTimeout(() => {
                    statusEl.innerText = statuses[idx];
                    statusEl.style.opacity = '1';
                }, 400);
            }, 3500);
        }
    }

    window.addEventListener('resize', () => {
        if (!container.offsetWidth) return;
        camera3D.aspect = container.offsetWidth / container.offsetHeight;
        camera3D.updateProjectionMatrix();
        renderer3D.setSize(container.offsetWidth, container.offsetHeight);
    });
}

// Initial portal guide
init3DFace('portal-guide-container');
