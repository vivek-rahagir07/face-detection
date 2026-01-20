
export class SentryCore {
    constructor(video, canvas, HUDOptions = {}) {
        this.video = video;
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.HUD = HUDOptions;

        this.isSuspicious = false;
        this.currentBehavior = "SECURE";
        this.integrityScore = 100;
        this.surveillanceActive = false;
    }

    async initModels() {
        const WEIGHTS_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';
        await faceapi.nets.tinyFaceDetector.loadFromUri(WEIGHTS_URL);
        await faceapi.nets.faceLandmark68TinyNet.loadFromUri(WEIGHTS_URL);
    }

    async start() {
        this.surveillanceActive = true;
        this.detect();
    }

    stop() {
        this.surveillanceActive = false;
    }

    async detect() {
        if (!this.surveillanceActive) return;

        const displaySize = { width: this.video.videoWidth, height: this.video.videoHeight };
        if (displaySize.width === 0) {
            requestAnimationFrame(() => this.detect());
            return;
        }

        faceapi.matchDimensions(this.canvas, displaySize);
        const detection = await faceapi.detectSingleFace(this.video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks(true);

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        if (detection) {
            this.handleDetection(detection, displaySize);
        } else {
            this.handleMissingFace();
        }

        this.updateHUD();
        requestAnimationFrame(() => this.detect());
    }

    handleDetection(detection, displaySize) {
        const resizedLandmarks = faceapi.resizeResults(detection, displaySize).landmarks;
        this.ctx.strokeStyle = this.isSuspicious ? '#ef4444' : 'rgba(0, 242, 255, 0.4)';
        this.ctx.lineWidth = 1;

        const points = resizedLandmarks.positions;
        this.ctx.beginPath();
        points.forEach((p, i) => {
            if (i % 2 === 0) this.ctx.moveTo(p.x, p.y);
            else this.ctx.lineTo(p.x, p.y);
        });
        this.ctx.stroke();

        const landmarks = detection.landmarks.relativePositions;
        const nose = landmarks[30];
        const leftEye = landmarks[36];
        const rightEye = landmarks[45];
        const mouth = landmarks[66];

        const eyeDist = rightEye.x - leftEye.x;
        const noseOffset = nose.x - (leftEye.x + eyeDist / 2);
        const yaw = (noseOffset / eyeDist) * 100;

        const eyeLevel = (leftEye.y + rightEye.y) / 2;
        const noseToMouth = mouth.y - nose.y;
        const pitch = (nose.y - eyeLevel) / noseToMouth;

        let behaviorDetected = "SECURE";
        if (Math.abs(yaw) > 40) behaviorDetected = "ROTATING";
        if (pitch > 0.8 || pitch < 0.2) behaviorDetected = "DISTRACTED";

        if (behaviorDetected !== "SECURE") {
            this.isSuspicious = true;
            this.currentBehavior = behaviorDetected;
            this.integrityScore = Math.max(0, this.integrityScore - 0.8);
        } else {
            this.isSuspicious = false;
            this.currentBehavior = "SECURE";
            this.integrityScore = Math.min(100, this.integrityScore + 0.2);
        }
    }

    handleMissingFace() {
        this.isSuspicious = true;
        this.currentBehavior = "OFF-SCREEN";
        this.integrityScore = Math.max(0, this.integrityScore - 1);
    }

    updateHUD() {
        if (!this.HUD.badge) return;

        if (this.isSuspicious) {
            this.HUD.badge.innerText = "🚨 SUSPICIOUS: " + this.currentBehavior;
            this.HUD.badge.style.color = "#ff4444";
            if (this.HUD.overlay) this.HUD.overlay.style.display = 'block';
        } else {
            this.HUD.badge.innerText = "🛡️ AI LOCK: " + this.currentBehavior;
            this.HUD.badge.style.color = "var(--accent)";
            if (this.HUD.overlay) this.HUD.overlay.style.display = 'none';
        }

        if (this.HUD.bar) {
            this.HUD.bar.style.width = this.integrityScore + "%";
            this.HUD.bar.style.background = this.integrityScore < 50 ? '#ef4444' : (this.integrityScore < 80 ? '#fbbf24' : 'var(--accent)');
        }

        if (this.HUD.percent) {
            this.HUD.percent.innerText = Math.round(this.integrityScore) + "%";
        }
    }

    getState() {
        return {
            isSuspicious: this.isSuspicious,
            behavior: this.currentBehavior,
            integrity: Math.round(this.integrityScore)
        };
    }
}
