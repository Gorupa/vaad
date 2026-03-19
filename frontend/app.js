// ── MOBILE DEBUGGER ──
window.onerror = function(msg, url, line) { 
    alert("Script Error: " + msg + " (Line " + line + ")"); 
};

// ── FIREBASE V10.8.0 SETUP (Guaranteed Stable Version) ──
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getFirestore(app);

// ── STATE ──
const API = 'https://vaad-wnul.onrender.com/api';
let currentUser = null;
let isPro = false; 
const maxFreeSearches = 1; 
const maxProSearches = 30; 
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

// Attach Auth button listeners safely
setTimeout(() => {
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    if (loginBtn) loginBtn.onclick = () => signInWithPopup(auth, provider);
    if (logoutBtn) logoutBtn.onclick = () => signOut(auth);
}, 500);

// ── UI LOGIC (Attached to window for HTML access) ──
window.switchTab = function(tab) {
    activeTab = tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    // Since only CNR is active, we just visually switch. The locked ones trigger modals.
};

window.closeModal = function() { 
    const modal = document.getElementById('upgrade-modal');
    if (modal) modal.style.display = 'none'; 
};
window.openModal = function() { 
    const modal = document.getElementById('upgrade-modal');
    if (modal) modal.style.display = 'flex'; 
};

window.handleSearch = async function() {
    if (activeTab !== 'cnr') return;
    
    const cnrInput = document.getElementById('cnr-input');
    const cnr = cnrInput ? cnrInput.value.trim() : '';
    if (!cnr) {
        if (cnrInput) {
            cnrInput.style.borderColor = 'red';
            setTimeout(() => cnrInput.style.borderColor = '', 1500);
        }
        return;
    }

    if (!currentUser) {
        signInWithPopup(auth, provider);
        return;
    }

    const date = new Date();
    const monthKey = `${date.getFullYear()}_${date.getMonth()}`;
    const storageKey = `vaad_searches_${currentUser.uid}_${monthKey}`;
    
    let searchesUsed = parseInt(localStorage.getItem(storageKey) || 0);

    if (!isPro && searchesUsed >= maxFreeSearches) {
        window.openModal();
        return;
    }

    if (isPro && searchesUsed >= maxProSearches) {
        showError("Fair Usage Policy reached. You have used your 30 API searches for this month. Limits reset on the 1st.");
        return;
    }

    await searchCNR(cnr, storageKey);
};

function updateSearchLimitUI() {
    const limitText = document.getElementById('limit-text');
    const upgradeBtn = document.getElementById('nav-upgrade-btn');
    
    if (!currentUser) {
        if (limitText) limitText.innerText = "Sign in with Google to get 1 free search";
        if (upgradeBtn) upgradeBtn.style.display = 'none';
        return;
    }

    const date = new Date();
    const monthKey = `${date.getFullYear()}_${date.getMonth()}`;
    const storageKey = `vaad_searches_${currentUser.uid}_${monthKey}`;
    let searchesUsed = parseInt(localStorage.getItem(storageKey) || 0);
    
    if (isPro) {
        if (limitText) limitText.innerHTML = '<span style="color: var(--primary); font-weight:600;">Pro Account Active - Unlimited Searches*</span>';
        if (upgradeBtn) upgradeBtn.style.display = 'none';
    } else {
        let remaining = Math.max(0, maxFreeSearches - searchesUsed);
        if (limitText) limitText.innerText = `Free searches remaining: ${remaining}/${maxFreeSearches}`;
        if (upgradeBtn) upgradeBtn.style.display = 'flex';
    }
}

// ── API LOGIC ──
function setLoading(on) {
    const btn = document.getElementById('search-btn');
    if (!btn) return;
    btn.disabled = on;
    btn.innerHTML = on ? '<div class="spinner"></div><span>Fetching...</span>' : '<span id="btn-text">Search Cases</span>';
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

function renderCaseDetail(payload) {
    hidePlaceholder();
    if (!payload || !payload.data || !payload.data.courtCaseData) { 
        showError('Invalid case data returned from official API.'); 
        return; 
    }

    const data = payload.data.courtCaseData;
    const petitioner = (data.petitioners && data.petitioners.length > 0) ? data.petitioners.join(', ') : '—';
    const respondent = (data.respondents && data.respondents.length > 0) ? data.respondents.join(', ') : '—';
    const petAdv = (data.petitionerAdvocates && data.petitionerAdvocates.length > 0) ? data.petitionerAdvocates.join(', ') : '—';
    const resAdv = (data.respondentAdvocates && data.respondentAdvocates.length > 0) ? data.respondentAdvocates.join(', ') : '—';

    const title = `${petitioner.split(',')[0]} vs ${respondent.split(',')[0]}`;
    const cnr = data.cnr || '—';
    const caseType = data.caseTypeRaw || data.caseType || '—';
    const courtName = data.courtName || '—';
    const district = data.district || '—';
    const filingDate = data.filingDate || '—';
    const status = data.caseStatus || 'Pending';
    const stage = data.disposalTypeRaw || data.purpose || '—';
    
    let nextHearing = data.nextHearingDate || '—';
    const nextPurpose = data.purpose || '';

    let html = `<div style="margin-bottom: 15px; cursor: pointer; color: var(--text-muted); font-size: 14px; text-decoration: underline;" onclick="window.clearResults()">← Back to search</div>
        <div style="background: var(--bg-secondary); padding: 20px; border-radius: 8px; border: 1px solid var(--border-color);">
            <div style="font-size: 20px; font-weight: 600; color: var(--text-primary); margin-bottom: 5px;">${title}</div>
            <div style="font-size: 14px; color: var(--text-muted); margin-bottom: 20px;">CNR: ${cnr}</div>`;

    if (status.toUpperCase().includes('DISPOS')) {
        const decisionDate = data.decisionDate || data.lastHearingDate || nextHearing;
        html += `<div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); padding: 12px; border-radius: 6px; margin-bottom: 20px;">
            <div style="font-size: 12px; font-weight: 600; color: #10b981; text-transform: uppercase;">Decision / Disposed Date</div>
            <div style="font-size: 16px; color: #10b981;">${decisionDate}</div>
        </div>`;
    } else if (nextHearing !== '—') {
        html += `<div style="background: var(--primary-light); border: 1px solid var(--primary); padding: 12px; border-radius: 6px; margin-bottom: 20px;">
            <div style="font-size: 12px; font-weight: 600; color: var(--primary); text-transform: uppercase;">Next Hearing Date</div>
            <div style="font-size: 16px; color: var(--primary);">${nextHearing}</div>
            ${nextPurpose ? `<div style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">Purpose: ${nextPurpose}</div>` : ''}
        </div>`;
    }

    html += `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
        <div><div style="font-size: 12px; color: var(--text-muted);">Status</div><div style="font-weight: 500;">${status}</div></div>
        <div><div style="font-size: 12px; color: var(--text-muted);">Stage</div><div style="font-weight: 500;">${stage}</div></div>
        <div><div style="font-size: 12px; color: var(--text-muted);">Case Type</div><div style="font-weight: 500;">${caseType}</div></div>
        <div><div style="font-size: 12px; color: var(--text-muted);">Filing Date</div><div style="font-weight: 500;">${filingDate}</div></div>
        <div style="grid-column: span 2;"><div style="font-size: 12px; color: var(--text-muted);">Court</div><div style="font-weight: 500;">${courtName}, ${district}</div></div>
        <div style="grid-column: span 2;"><div style="font-size: 12px; color: var(--text-muted);">Petitioner(s)</div><div style="font-weight: 500;">${petitioner}</div></div>
        <div style="grid-column: span 2;"><div style="font-size: 12px; color: var(--text-muted);">Respondent(s)</div><div style="font-weight: 500;">${respondent}</div></div>
        <div><div style="font-size: 12px; color: var(--text-muted);">Pet. Advocate</div><div style="font-weight: 500;">${petAdv}</div></div>
        <div><div style="font-size: 12px; color: var(--text-muted);">Res. Advocate</div><div style="font-weight: 500;">${resAdv}</div></div>
    </div></div>`;

    document.getElementById('results').innerHTML = html;
    document.getElementById('results').scrollIntoView({ behavior:'smooth', block:'start' });
}

function showError(msg) {
    hidePlaceholder();
    document.getElementById('results').innerHTML = `<div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: #ef4444; padding: 15px; border-radius: 8px; display: flex; align-items: center; gap: 10px;"><span>⚠</span><span>${msg}</span></div>`;
}

window.clearResults = function() { 
    document.getElementById('results').innerHTML = ''; 
    document.getElementById('placeholder').style.display = 'block'; 
};
function hidePlaceholder() { 
    document.getElementById('placeholder').style.display = 'none'; 
}

document.addEventListener('keydown', e => { if (e.key === 'Enter') window.handleSearch(); });
