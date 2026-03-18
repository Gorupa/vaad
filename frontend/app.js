// ── FIREBASE V12.10.0 SETUP ──
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-analytics.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCW0rBn8YLGfYqdkj3DCn2RPUeYirIpreU",
    authDomain: "vaad-87fed.firebaseapp.com",
    projectId: "vaad-87fed",
    storageBucket: "vaad-87fed.firebasestorage.app",
    messagingSenderId: "649989985981",
    appId: "1:649989985981:web:6dcbcdd0babd45f2cb09d4",
    measurementId: "G-36J186LSR4"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getFirestore(app);

// ── STATE ──
const API = 'https://vaad-wnul.onrender.com/api';
let currentUser = null;
let isPro = false; 
const maxFreeSearches = 1; 
const maxProSearches = 30; // 🛑 The hidden stop-loss for Pro users
let activeTab = 'cnr';

// ── AUTH & DATABASE LISTENERS ──
onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
        document.getElementById('login-btn').style.display = 'none';
        document.getElementById('user-menu').style.display = 'flex';
        document.getElementById('user-name').innerText = user.displayName.split(' ')[0];
        document.getElementById('user-avatar').src = user.photoURL;

        try {
            const userRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                isPro = userSnap.data().isPro === true;
            } else {
                await setDoc(userRef, {
                    name: user.displayName,
                    email: user.email,
                    isPro: false,
                    joinedAt: new Date().toISOString()
                });
                isPro = false;
            }
        } catch (error) {
            console.error("Error fetching user data:", error);
            isPro = false; 
        }
    } else {
        document.getElementById('login-btn').style.display = 'flex';
        document.getElementById('user-menu').style.display = 'none';
        isPro = false;
    }
    
    updateSearchLimitUI();
});

document.getElementById('login-btn').onclick = () => signInWithPopup(auth, provider);
document.getElementById('logout-btn').onclick = () => signOut(auth);

// ── UI LOGIC ──
window.switchTab = function(tab) {
    activeTab = tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    document.querySelectorAll('.form-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('panel-' + tab).classList.add('active');
    window.clearResults();
    document.getElementById('search-btn').disabled = (tab !== 'cnr');
};

window.closeModal = function() { document.getElementById('upgrade-modal').classList.remove('active'); };
window.openModal = function() { document.getElementById('upgrade-modal').classList.add('active'); };

window.handleSearch = async function() {
    if (activeTab !== 'cnr') return;
    
    const cnr = document.getElementById('cnr-input').value.trim();
    if (!cnr) return shake('cnr-input');

    if (!currentUser) {
        signInWithPopup(auth, provider);
        return;
    }

    // Create a key that automatically resets on the 1st of every month
    const date = new Date();
    const monthKey = `${date.getFullYear()}_${date.getMonth()}`;
    const storageKey = `vaad_searches_${currentUser.uid}_${monthKey}`;
    
    let searchesUsed = parseInt(localStorage.getItem(storageKey) || 0);

    // Stop-loss for Free Users
    if (!isPro && searchesUsed >= maxFreeSearches) {
        window.openModal();
        return;
    }

    // Stop-loss for Pro Users (FUP limit reached)
    if (isPro && searchesUsed >= maxProSearches) {
        showError("Fair Usage Policy reached. You have used your 30 API searches for this month. Limits reset on the 1st.");
        return;
    }

    await searchCNR(cnr, storageKey);
};

function updateSearchLimitUI() {
    if (!currentUser) {
        document.getElementById('limit-text').innerText = "Sign in with Google to get 1 free search";
        document.getElementById('nav-upgrade-btn').style.display = 'none';
        return;
    }

    const date = new Date();
    const monthKey = `${date.getFullYear()}_${date.getMonth()}`;
    const storageKey = `vaad_searches_${currentUser.uid}_${monthKey}`;
    let searchesUsed = parseInt(localStorage.getItem(storageKey) || 0);
    
    if (isPro) {
        // Keeps the premium feel on the UI
        document.getElementById('limit-text').innerHTML = '<span style="color: var(--primary); font-weight:600;">Pro Account Active - Unlimited Searches*</span>';
        document.getElementById('nav-upgrade-btn').style.display = 'none';
    } else {
        let remaining = Math.max(0, maxFreeSearches - searchesUsed);
        document.getElementById('limit-text').innerText = `Free searches remaining: ${remaining}/${maxFreeSearches}`;
        document.getElementById('nav-upgrade-btn').style.display = 'flex';
    }
}

// ── API LOGIC ──
function setLoading(on) {
    const btn = document.getElementById('search-btn');
    btn.disabled = on;
    btn.innerHTML = on ? '<div class="spinner"></div><span>Engine Fetching...</span>' : '<span id="btn-text">Search Cases</span>';
}

async function searchCNR(cnr, storageKey) {
    setLoading(true); 
    window.clearResults();
    try {
        const res = await fetch(`${API}/cnr`, { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({cnr}) 
        });
        const json = await res.json();
        
        if (!res.ok || !json.success) {
            return showError(json.error || 'The official eCourts API failed to fetch this case. Please check the CNR number.');
        }

        // ONLY DEDUCT IF SUCCESSFUL
        if (currentUser) {
            let currentCount = parseInt(localStorage.getItem(storageKey) || 0);
            localStorage.setItem(storageKey, currentCount + 1);
            updateSearchLimitUI();
        }

        renderCaseDetail(json.data);
    } catch (e) { 
        showError(`Network Error: Cannot connect to the Render backend. (${e.message})`); 
    } finally { 
        setLoading(false); 
    }
}

// ── RAW DATA DEBUGGER ──
function renderCaseDetail(payload) {
    hidePlaceholder();
    if (!payload) { showError('No case data returned from engine.'); return; }

    // This dumps the raw JSON from the API onto your screen in a green hacker-style box
    let rawJSON = JSON.stringify(payload, null, 2);

    let html = `
        <span class="detail-back" onclick="window.clearResults()">← Back to search</span>
        <div class="detail-header"><div class="detail-title" style="color: #10b981;">RAW API DATA RECEIVED</div></div>
        <div style="background: #111827; color: #10b981; padding: 16px; border-radius: 8px; overflow-x: auto; font-family: monospace; font-size: 12px; white-space: pre-wrap; word-break: break-all;">
${rawJSON}
        </div>
    `;

    document.getElementById('results').innerHTML = html;
    document.getElementById('results').scrollIntoView({ behavior:'smooth', block:'start' });
}

function showError(msg) {
    hidePlaceholder();
    document.getElementById('results').innerHTML = `<div class="error-box"><span>⚠</span><span>${msg}</span></div>`;
}

window.clearResults = function() { document.getElementById('results').innerHTML = ''; document.getElementById('placeholder').style.display = 'block'; }
function hidePlaceholder() { document.getElementById('placeholder').style.display = 'none'; }
function shake(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.borderColor = 'var(--error-text)'; el.focus();
    setTimeout(() => { el.style.borderColor = ''; }, 1500);
}

document.addEventListener('keydown', e => { if (e.key === 'Enter') window.handleSearch(); });

fetch(`${API}/health`).catch(() => {});
updateSearchLimitUI();
