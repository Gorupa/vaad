// ── FIREBASE V12.10.0 SETUP ──
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-analytics.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";

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

// ── STATE ──
const API = 'https://vaad-wnul.onrender.com/api';
let currentUser = null;
let isPro = false; 
const maxFreeSearches = 5;
let activeTab = 'cnr';

// ── AUTH LISTENERS ──
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
        document.getElementById('login-btn').style.display = 'none';
        document.getElementById('modal-login-btn').style.display = 'none';
        document.getElementById('user-menu').style.display = 'flex';
        document.getElementById('user-name').innerText = user.displayName.split(' ')[0];
        document.getElementById('user-avatar').src = user.photoURL;
    } else {
        document.getElementById('login-btn').style.display = 'flex';
        document.getElementById('modal-login-btn').style.display = 'flex';
        document.getElementById('user-menu').style.display = 'none';
    }
    updateSearchLimitUI();
});

document.getElementById('login-btn').onclick = () => signInWithPopup(auth, provider);
document.getElementById('modal-login-btn').onclick = () => signInWithPopup(auth, provider);
document.getElementById('logout-btn').onclick = () => signOut(auth);

// ── UI LOGIC ──
window.switchTab = function(tab) {
    activeTab = tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    document.querySelectorAll('.form-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('panel-' + tab).classList.add('active');
    clearResults();
    document.getElementById('search-btn').disabled = (tab !== 'cnr');
};

window.closeModal = function() {
    document.getElementById('upgrade-modal').classList.remove('active');
};

window.handleSearch = async function() {
    if (activeTab !== 'cnr') return;
    
    const cnr = document.getElementById('cnr-input').value.trim();
    if (!cnr) return shake('cnr-input');

    if (!currentUser) {
        signInWithPopup(auth, provider);
        return;
    }

    let storageKey = `vaad_searches_${currentUser.uid}`;
    let searchesUsed = parseInt(localStorage.getItem(storageKey) || 0);

    if (searchesUsed >= maxFreeSearches && !isPro) {
        document.getElementById('upgrade-modal').classList.add('active');
        return;
    }

    if (!isPro) {
        searchesUsed++;
        localStorage.setItem(storageKey, searchesUsed);
        updateSearchLimitUI();
    }

    await searchCNR(cnr);
};

function updateSearchLimitUI() {
    if (!currentUser) {
        document.getElementById('limit-text').innerText = "Sign in with Google to get 5 free searches";
        return;
    }

    let storageKey = `vaad_searches_${currentUser.uid}`;
    let searchesUsed = parseInt(localStorage.getItem(storageKey) || 0);
    let remaining = Math.max(0, maxFreeSearches - searchesUsed);
    
    if (isPro) {
        document.getElementById('limit-text').innerHTML = '<span style="color: var(--primary); font-weight:600;">Pro Account Active - Unlimited Searches</span>';
    } else {
        document.getElementById('limit-text').innerText = `Free searches remaining: ${remaining}/${maxFreeSearches}`;
    }
}

// ── API LOGIC ──
function setLoading(on) {
    const btn = document.getElementById('search-btn');
    btn.disabled = on;
    btn.innerHTML = on ? '<div class="spinner"></div><span>Engine Fetching...</span>' : '<span id="btn-text">Search Cases</span>';
}

async function searchCNR(cnr) {
    setLoading(true); 
    clearResults();
    try {
        const res = await fetch(`${API}/cnr`, { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({cnr}) 
        });
        const json = await res.json();
        
        if (!res.ok || !json.success) {
            return showError(json.error || 'The ecourt.js engine failed to fetch this case. The government proxy might be blocking the request.');
        }
        renderCaseDetail(json.data);
    } catch (e) { 
        showError(`Network Error: Cannot connect to the Render backend. Engine might be sleeping. (${e.message})`); 
    } finally { 
        setLoading(false); 
    }
}

// ── RENDER HELPERS ──
function renderCaseDetail(data) {
    hidePlaceholder();
    if (!data) { showError('No case data returned from engine.'); return; }

    const title       = data.case_title||data.title||'Case Details';
    const cnr         = data.cnr_number||data.cnr||'—';
    const caseType    = data.case_type||'—';
    const courtName   = data.court_name||'—';
    const district    = data.district_name||data.district||'—';
    const filingDate  = data.filing_date||'—';
    const status      = data.case_status||data.status||'Pending';
    const stage       = data.case_stage||data.stage||'—';
    const petitioner  = data.petitioner||data.petitioner_name||'—';
    const respondent  = data.respondent||data.respondent_name||'—';
    const petAdv      = data.petitioner_advocate||'—';
    const resAdv      = data.respondent_advocate||'—';
    const nextHearing = data.next_hearing_date||data.next_date||null;
    const nextPurpose = data.next_hearing_purpose||'';

    const statusClass = status.toLowerCase().includes('dispos') ? 'status-disposed' : status.toLowerCase().includes('fresh') ? 'status-fresh' : 'status-pending';

    let html = `<span class="detail-back" onclick="window.clearResults()">← Back to search</span>
        <div class="detail-header"><div class="detail-title">${title}</div><div class="detail-cnr">CNR: ${cnr}</div></div>`;

    if (nextHearing) html += `<div class="next-hearing"><div class="nh-label">Next Hearing Date</div><div class="nh-date">${nextHearing}</div>${nextPurpose?`<div class="nh-purpose">${nextPurpose}</div>`:''}</div>`;

    html += `<div class="info-grid">
        <div class="info-row"><span class="info-key">Status</span><span class="info-val"><span class="status-badge ${statusClass}">${status}</span></span></div>
        <div class="info-row"><span class="info-key">Case Type</span><span class="info-val">${caseType}</span></div>
        <div class="info-row"><span class="info-key">Court</span><span class="info-val">${courtName}</span></div>
        <div class="info-row"><span class="info-key">District</span><span class="info-val">${district}</span></div>
        <div class="info-row"><span class="info-key">Filing Date</span><span class="info-val">${filingDate}</span></div>
        <div class="info-row"><span class="info-key">Stage</span><span class="info-val">${stage}</span></div>
        <div class="info-row"><span class="info-key">Petitioner</span><span class="info-val">${petitioner}</span></div>
        <div class="info-row"><span class="info-key">Respondent</span><span class="info-val">${respondent}</span></div>
        <div class="info-row"><span class="info-key">Pet. Advocate</span><span class="info-val">${petAdv}</span></div>
        <div class="info-row"><span class="info-key">Res. Advocate</span><span class="info-val">${resAdv}</span></div>
    </div>`;

    document.getElementById('results').innerHTML = html;
    document.getElementById('results').scrollIntoView({ behavior:'smooth', block:'start' });
}

function showError(msg) {
    hidePlaceholder();
    document.getElementById('results').innerHTML = `<div class="error-box"><span>⚠</span><span>${msg}</span></div>`;
}

// Make clearResults available to the window object so the "Back to search" button can click it
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
