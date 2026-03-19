window.onerror = function(msg, url, line) { 
    console.error("Script Error: " + msg + " (Line " + line + ")"); 
};

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

const API = 'https://vaad-wnul.onrender.com/api';
let currentUser = null;
let currentPlan = 'free'; // 'free', 'pro', or 'promax'
let isPro = false; 
let isProMax = false; 

const maxFreeSearches = 1; 
const maxProSearches = 30; 
const maxProMaxSearches = 100;
let activeTab = 'cnr';

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
                const data = userSnap.data();
                // Smart fallback: Check for 'plan', if not, look at old 'isPro' data
                currentPlan = data.plan || (data.isPro ? 'pro' : 'free');
                
            } else {
                // New user registration
                await setDoc(userRef, {
                    name: user.displayName,
                    email: user.email,
                    plan: 'free',
                    joinedAt: new Date().toISOString()
                });
                currentPlan = 'free';
            }
            
            // Set logic flags based on the single 'plan' string
            isProMax = (currentPlan === 'promax');
            isPro = (currentPlan === 'pro' || currentPlan === 'promax');

        } catch (error) {
            console.error("Error fetching user data:", error);
            currentPlan = 'free'; isPro = false; isProMax = false;
        }
    } else {
        document.getElementById('login-btn').style.display = 'flex';
        document.getElementById('user-menu').style.display = 'none';
        currentPlan = 'free'; isPro = false; isProMax = false;
    }
    
    updateSearchLimitUI();
    updateTabLocks();
});

setTimeout(() => {
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    if (loginBtn) loginBtn.onclick = () => signInWithPopup(auth, provider);
    if (logoutBtn) logoutBtn.onclick = () => signOut(auth);
}, 500);

function updateTabLocks() {
    const lockIcons = document.querySelectorAll('.lock-icon');
    if (isProMax) {
        lockIcons.forEach(icon => icon.style.display = 'none');
    } else {
        lockIcons.forEach(icon => icon.style.display = 'inline');
    }
}

window.switchTab = function(tab) {
    if (tab !== 'cnr' && !isProMax) {
        window.openModal(isPro ? 'promax-only' : 'both');
        return;
    }

    activeTab = tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    document.querySelectorAll('.form-panel').forEach(p => p.style.display = 'none');
    document.getElementById('panel-' + tab).style.display = 'block';
    
    window.clearResults();
};

window.closeModal = function() { 
    const modal = document.getElementById('upgrade-modal');
    if (modal) modal.style.display = 'none'; 
};

window.openModal = function(type = 'both') { 
    const modal = document.getElementById('upgrade-modal');
    if (!modal) return;

    const proCard = document.getElementById('pro-card');
    const modalTitle = document.getElementById('modal-title');
    const modalSubtitle = document.getElementById('modal-subtitle');

    if (type === 'promax-only') {
        proCard.style.display = 'none';
        modalTitle.innerText = "Upgrade to Pro Max";
        modalSubtitle.innerText = "Unlock advanced search filters and 100 API searches.";
    } else {
        proCard.style.display = 'block';
        modalTitle.innerText = "Upgrade to Vaad Pro";
        modalSubtitle.innerText = "Unlock official API searches and priority data loading.";
    }
    
    modal.style.display = 'flex'; 
};

window.handleSearch = async function() {
    let query = '';
    
    if (activeTab === 'cnr') query = document.getElementById('cnr-input').value.trim();
    if (activeTab === 'litigant') query = document.getElementById('litigant-input').value.trim();
    if (activeTab === 'advocate') query = document.getElementById('advocate-input').value.trim();
    if (activeTab === 'judge') query = document.getElementById('judge-input').value.trim();

    if (!query) return;

    if (!currentUser) {
        signInWithPopup(auth, provider);
        return;
    }

    const date = new Date();
    const monthKey = `${date.getFullYear()}_${date.getMonth()}`;
    const storageKey = `vaad_searches_${currentUser.uid}_${monthKey}`;
    
    let searchesUsed = parseInt(localStorage.getItem(storageKey) || 0);

    if (!isPro && searchesUsed >= maxFreeSearches) { window.openModal('both'); return; }
    if (isPro && !isProMax && searchesUsed >= maxProSearches) { showError("Fair Usage Policy reached for Pro plan. Limits reset on the 1st."); return; }
    if (isProMax && searchesUsed >= maxProMaxSearches) { showError("Fair Usage Policy reached for Pro Max plan. Limits reset on the 1st."); return; }

    if (activeTab !== 'cnr') {
        showError(`The ${activeTab} search filter is unlocked! (Next step: Update server.js to connect to the official API).`);
        return;
    }

    await searchCNR(query, storageKey);
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
    
    if (isProMax) {
        if (limitText) limitText.innerHTML = '<span style="color: #d4af37; font-weight:600;">Pro Max Active - 100 Searches</span>';
        if (upgradeBtn) upgradeBtn.style.display = 'none';
    } else if (isPro) {
        if (limitText) limitText.innerHTML = '<span style="color: var(--primary); font-weight:600;">Pro Account Active - 30 Searches</span>';
        if (upgradeBtn) { upgradeBtn.style.display = 'block'; upgradeBtn.innerText = "⚡ Get Pro Max"; upgradeBtn.onclick = () => window.openModal('promax-only'); }
    } else {
        let remaining = Math.max(0, maxFreeSearches - searchesUsed);
        if (limitText) limitText.innerText = `Free searches remaining: ${remaining}/${maxFreeSearches}`;
        if (upgradeBtn) { upgradeBtn.style.display = 'block'; upgradeBtn.innerText = "⚡ Upgrade"; upgradeBtn.onclick = () => window.openModal('both'); }
    }
}

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
