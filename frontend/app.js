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
const maxFreeSearches = 1; // Updated to 1 free search
let activeTab = 'cnr';

// ── AUTH & DATABASE LISTENERS ──
onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
        document.getElementById('login-btn').style.display = 'none';
        document.getElementById('user-menu').style.display = 'flex';
        document.getElementById('user-name').innerText = user.displayName.split(' ')[0];
        document.getElementById('user-avatar').src = user.photoURL;

        // Check Firestore database for Pro status
        try {
            const userRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                isPro = userSnap.data().isPro === true;
            } else {
                // First time login! Create them in the database
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
            isPro = false; // default to free on error
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

    let storageKey = `vaad_searches_${currentUser.uid}`;
    let searchesUsed = parseInt(localStorage.getItem(storageKey) || 0);

    if (searchesUsed >= maxFreeSearches && !isPro) {
        window.openModal();
        return;
    }

    await searchCNR(cnr);
};

function updateSearchLimitUI() {
    if (!currentUser) {
        document.getElementById('limit-text').innerText = "Sign in with Google to get 1 free search";
        document.getElementById('nav-upgrade-btn').style.display = 'none';
        return;
    }

    let storageKey = `vaad_searches_${currentUser.uid}`;
    let searchesUsed = parseInt(localStorage.getItem(storageKey) || 0);
    let remaining = Math.max(0, maxFreeSearches - searchesUsed);
    
    if (isPro) {
        document.getElementById('limit-text').innerHTML = '<span style="color: var(--primary); font-weight:600;">Pro Account Active - Unlimited Searches</span>';
        document.getElementById('nav-upgrade-btn').style.display = 'none';
    } else {
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

async function searchCNR(cnr) {
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
        if (currentUser && !isPro) {
            let storageKey = `vaad_searches_${currentUser.uid}`;
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

// ── RENDER HELPERS (Updated for Official API) ──
function renderCaseDetail(payload) {
    hidePlaceholder();
    if (!payload) { showError('No case data returned from engine.'); return; }

    // Unpack the official API's double-data wrapper
    const data = payload.data || payload;

    // Create a dynamic title if one isn't provided
    const dynamicTitle = (data.petitioners && data.petitioners[0]) 
        ? `${data.petitioners[0]} vs ${data.respondents ? data.respondents[0] : 'State'}` 
        : 'Case Details';

    const title       = data.title || dynamicTitle;
    const cnr         = data.cnr || data.cnr_number || '—';
    const caseType    = data.caseType || data.case_type || '—';
    const courtName   = data.court || data.courtName || data.court_name || '—';
    const district    = data.district || data.districtName || data.district_name || '—';
    const filingDate  = data.filingDate || data.filing_date || '—';
    const status      = data.caseStatus || data.case_status || data.status || 'Pending';
    const stage       = data.caseStage || data.case_stage || data.stage || '—';
    
    // Safely join Arrays (lists of names) into comma-separated text
    const petitioner  = Array.isArray(data.petitioners) ? data.petitioners.join(', ') : (data.petitioners || '—');
    const respondent  = Array.isArray(data.respondents) ? data.respondents.join(', ') : (data.respondents || '—');
    const petAdv      = Array.isArray(data.petitionerAdvocates) ? data.petitionerAdvocates.join(', ') : (data.petitionerAdvocates || '—');
    const resAdv      = Array.isArray(data.respondentAdvocates) ? data.respondentAdvocates.join(', ') : (data.respondentAdvocates || '—');
    
    const nextHearing = data.nextHearingDate || data.next_hearing_date || null;
    const nextPurpose = data.nextHearingPurpose || data.next_hearing_purpose || '';

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
