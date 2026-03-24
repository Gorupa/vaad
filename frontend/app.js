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
let currentPlan = 'free'; 
let cycleStartDate = null; 

const limits = {
    free: { search: 1, pdf: 0 },
    pro: { search: 30, pdf: 0 },
    promax: { search: 100, pdf: 0 },
    supreme: { search: 150, pdf: 30 }
};

let activeTab = 'cnr';
let activeJurisdiction = 'india';

// --- BUTTON BINDINGS ---
document.addEventListener('click', async (e) => {
    const loginTarget = e.target.closest('#login-btn');
    const logoutTarget = e.target.closest('#logout-btn');
    const mobileLogin = e.target.closest('#drawer-login-btn');
    const mobileLogout = e.target.closest('#drawer-logout-btn');
    
    if (loginTarget || mobileLogin) {
        if (loginTarget) loginTarget.innerHTML = '<span>Connecting...</span>';
        if (mobileLogin) mobileLogin.innerHTML = '<span>Connecting...</span>';
        
        try {
            await signInWithPopup(auth, provider);
            if (mobileLogin) window.toggleMenu();
        } catch (error) {
            console.error("Login failed or cancelled:", error);
            if (loginTarget) loginTarget.innerText = "Sign In";
            if (mobileLogin) mobileLogin.innerText = "Sign In / Register";
        }
    }
    
    if (logoutTarget || mobileLogout) {
        if (mobileLogout) window.toggleMenu();
        signOut(auth).then(() => {
            window.location.reload(); 
        });
    }
});

onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    
    const limitText = document.getElementById('limit-text');
    if (limitText) limitText.innerText = "Loading limits..."; 

    if (user) {
        document.getElementById('login-btn').style.display = 'none';
        document.getElementById('user-menu').style.display = 'flex';
        document.getElementById('user-name').innerText = user.displayName.split(' ')[0];
        document.getElementById('user-avatar').src = user.photoURL;

        const drawerUnauth = document.getElementById('drawer-unauth');
        const drawerAuth = document.getElementById('drawer-auth');
        const drawerLogout = document.getElementById('drawer-logout-btn');
        if (drawerUnauth) drawerUnauth.style.display = 'none';
        if (drawerAuth) {
            drawerAuth.style.display = 'flex';
            document.getElementById('drawer-name').innerText = user.displayName;
            document.getElementById('drawer-avatar').src = user.photoURL;
        }
        if (drawerLogout) drawerLogout.style.display = 'block';

        const badge = document.getElementById('user-badge');
        if (badge) { badge.innerText = "..."; badge.style.background = "gray"; }

        try {
            const userRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists() && userSnap.data().plan) {
                let dbPlan = String(userSnap.data().plan).toLowerCase().replace(/[^a-z]/g, '');
                currentPlan = limits[dbPlan] ? dbPlan : 'free';
                cycleStartDate = userSnap.data().cycleStartDate || new Date().toISOString().split('T')[0];
            } else {
                const today = new Date().toISOString().split('T')[0];
                await setDoc(userRef, { name: user.displayName, email: user.email, plan: 'free', cycleStartDate: today, joinedAt: new Date().toISOString() });
                currentPlan = 'free';
                cycleStartDate = today;
            }
        } catch (error) {
            currentPlan = 'free';
            cycleStartDate = new Date().toISOString().split('T')[0];
        }
    } else {
        document.getElementById('login-btn').style.display = 'flex';
        document.getElementById('user-menu').style.display = 'none';
        
        const drawerUnauth = document.getElementById('drawer-unauth');
        const drawerAuth = document.getElementById('drawer-auth');
        const drawerLogout = document.getElementById('drawer-logout-btn');
        if (drawerUnauth) drawerUnauth.style.display = 'block';
        if (drawerAuth) drawerAuth.style.display = 'none';
        if (drawerLogout) drawerLogout.style.display = 'none';

        currentPlan = 'free';
        cycleStartDate = null;
    }
    
    window.currentUserPlan = currentPlan; 
    
    updateBadge();
    updateTabLocks();
    updateSearchLimitUI();
});

function checkFUP(actionType) {
    if (!currentUser) return { allowed: false, used: 0, limit: 0, remaining: 0, storageKey: null, expired: false, daysLeft: 0 };
    if (!currentPlan || !limits[currentPlan]) currentPlan = 'free';

    const cycleStart = new Date(cycleStartDate || new Date().toISOString().split('T')[0]);
    cycleStart.setHours(0,0,0,0);
    const today = new Date();
    today.setHours(0,0,0,0);
    
    const diffTime = today - cycleStart;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)); 

    let isExpired = false;
    let daysLeft = 0;

    if (currentPlan !== 'free') {
        if (diffDays >= 30) isExpired = true;
        else daysLeft = 30 - diffDays;
    }

    const storageKey = `vaad_${actionType}_${currentUser.uid}_cycle_${cycleStartDate}`;
    let used = parseInt(localStorage.getItem(storageKey) || 0);
    let planData = limits[currentPlan];
    let limit = planData ? planData[actionType] : 0; 
    let remaining = Math.max(0, limit - used);

    return { allowed: used < limit, used: used, limit: limit, remaining: remaining, storageKey: storageKey, expired: isExpired, daysLeft: daysLeft };
}

function updateBadge() {
    const badge = document.getElementById('user-badge');
    const drawerBadge = document.getElementById('drawer-badge');
    if (!badge) return;
    
    const fup = checkFUP('search');
    
    if (fup.expired) {
        badge.innerText = "EXPIRED"; badge.style.background = "#ef4444"; badge.style.color = "white";
    } else if (currentPlan === 'supreme') {
        badge.innerText = "SUPREME"; badge.style.background = "#8b5cf6"; badge.style.color = "white";
    } else if (currentPlan === 'promax') {
        badge.innerText = "PRO MAX"; badge.style.background = "#d4af37"; badge.style.color = "black";
    } else if (currentPlan === 'pro') {
        badge.innerText = "PRO"; badge.style.background = "var(--primary)"; badge.style.color = "white";
    } else {
        badge.innerText = "FREE"; badge.style.background = "var(--border)"; badge.style.color = "var(--text-muted)";
    }

    if (drawerBadge) {
        drawerBadge.innerText = badge.innerText; drawerBadge.style.background = badge.style.background; drawerBadge.style.color = badge.style.color;
    }
}

function updateTabLocks() {
    const cnrLock = document.getElementById('cnr-lock');
    const otherLocks = document.querySelectorAll('.tab:not(#tab-cnr) .lock-icon');

    if (currentPlan === 'supreme' || currentPlan === 'promax' || currentPlan === 'pro') {
        if (cnrLock) cnrLock.style.display = 'none';
        otherLocks.forEach(icon => icon.style.display = 'none');
    } else {
        if (cnrLock) cnrLock.style.display = 'none';
        otherLocks.forEach(icon => icon.style.display = 'inline');
        if (activeTab !== 'cnr' && activeTab !== 'us-case') window.switchTab('cnr');
    }
}

// --- JURISDICTION SWITCHING ---
window.switchJurisdiction = function(country) {
    activeJurisdiction = country;
    const indianTabs = document.querySelectorAll('.indian-tab');
    const indianPanels = document.querySelectorAll('.indian-panel');
    const usTabs = document.querySelectorAll('.us-tab');
    const usPanels = document.querySelectorAll('.us-panel');

    if (country === 'usa') {
        indianTabs.forEach(el => el.style.display = 'none');
        indianPanels.forEach(el => el.style.display = 'none');
        usTabs.forEach(el => el.style.display = 'block');
        window.switchTab('us-case');
    } else {
        indianTabs.forEach(el => el.style.display = 'block');
        usTabs.forEach(el => el.style.display = 'none');
        usPanels.forEach(el => el.style.display = 'none');
        window.switchTab('cnr');
    }
    window.clearResults();
};

window.switchTab = function(tab) {
    if (!currentUser && tab !== 'cnr' && tab !== 'us-case') {
        window.openModal(); return;
    }
    if (currentPlan === 'free' && tab !== 'cnr' && tab !== 'us-case') {
        window.openModal(); return;
    }

    activeTab = tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    document.querySelectorAll('.form-panel').forEach(p => p.style.display = 'none');
    
    const targetPanel = document.getElementById('panel-' + tab);
    if (targetPanel) targetPanel.style.display = 'block';
    
    window.clearResults();
};

window.toggleCnrMode = function() {
    if (currentPlan === 'free') {
        alert("Bulk CNR refresh requires a Paid Plan.");
        document.querySelector('input[name="cnr-mode"][value="single"]').checked = true;
        window.openModal(); return;
    }
    const mode = document.querySelector('input[name="cnr-mode"]:checked').value;
    document.getElementById('cnr-single-field').style.display = mode === 'single' ? 'block' : 'none';
    document.getElementById('cnr-bulk-field').style.display = mode === 'bulk' ? 'block' : 'none';
};

// --- MODALS & MENUS ---
window.toggleMenu = function() {
    const drawer = document.getElementById('side-drawer');
    const overlay = document.getElementById('drawer-overlay');
    drawer.classList.toggle('open');
    overlay.classList.toggle('open');
};

window.openDevModal = function() { document.getElementById('dev-modal').classList.add('active'); };
window.closeDevModal = function() { document.getElementById('dev-modal').classList.remove('active'); };
window.openWhatsNewModal = function() { document.getElementById('whats-new-modal').classList.add('active'); };
window.closeWhatsNewModal = function() { document.getElementById('whats-new-modal').classList.remove('active'); };
window.closeModal = function() { document.getElementById('upgrade-modal').style.display = 'none'; };

window.openModal = function() { 
    const modal = document.getElementById('upgrade-modal');
    if (!modal) return;
    if (!currentUser) { window.selectPlan('pro'); modal.style.display = 'flex'; return; }
    const fup = checkFUP('search');
    if (currentPlan === 'supreme' && !fup.expired) return;

    if (fup.expired) {
        window.selectPlan(currentPlan === 'free' ? 'pro' : currentPlan);
    } else {
        document.getElementById('pro-card').style.display = (currentPlan === 'free') ? 'block' : 'none';
        document.getElementById('promax-card').style.display = (currentPlan === 'free' || currentPlan === 'pro') ? 'block' : 'none';
        if (currentPlan === 'free') window.selectPlan('pro');
        else if (currentPlan === 'pro') window.selectPlan('promax');
        else if (currentPlan === 'promax') window.selectPlan('supreme');
    }
    modal.style.display = 'flex'; 
};

window.payWithRazorpay = function(planType, amountInINR) {
    if (!currentUser) {
        alert("Please sign in with Google to create your account before upgrading.");
        window.closeModal(); signInWithPopup(auth, provider); return;
    }
    const amountInPaise = amountInINR * 100;
    const options = {
        "key": "YOUR_LIVE_RAZORPAY_KEY_ID", 
        "amount": amountInPaise,
        "currency": "INR",
        "name": "Vaad",
        "description": `Upgrade to Vaad ${planType.toUpperCase()}`,
        "image": "https://vaad.pages.dev/icon-192.png",
        "handler": function (response) {
            const btn = document.getElementById('upi-btn-link');
            if (btn) btn.innerText = "Payment Successful! Upgrading...";
            setTimeout(() => window.location.reload(), 3000);
        },
        "prefill": { "name": currentUser.displayName || "", "email": currentUser.email || "" },
        "notes": { "userId": currentUser.uid, "planName": planType },
        "theme": { "color": "#8b5cf6" }
    };
    const rzp = new window.Razorpay(options);
    rzp.on('payment.failed', function (response){ alert(`Payment Failed: ${response.error.description}`); });
    rzp.open();
};

window.selectPlan = function(planType) {
    document.querySelectorAll('.pricing-card').forEach(el => el.style.border = '1px solid var(--border)');
    let amount = 99; let planName = "Pro";
    if (planType === 'pro') { document.getElementById('pro-card').style.border = '2px solid var(--primary)'; amount = 99; planName = "Pro"; }
    else if (planType === 'promax') { document.getElementById('promax-card').style.border = '2px solid #d4af37'; amount = 199; planName = "Pro Max"; }
    else if (planType === 'supreme') { document.getElementById('supreme-card').style.border = '2px solid #8b5cf6'; amount = 399; planName = "Supreme"; }

    const upgradeBtn = document.getElementById('upi-btn-link');
    if (upgradeBtn) {
        upgradeBtn.removeAttribute('href'); 
        upgradeBtn.innerText = `Pay ₹${amount} Securely`;
        upgradeBtn.onclick = (e) => { e.preventDefault(); upgradeBtn.innerText = "Opening Checkout..."; window.payWithRazorpay(planType, amount); };
    }
};

window.handleSearch = async function() {
    if (!currentUser) { signInWithPopup(auth, provider); return; }

    const fup = checkFUP('search');
    if (fup.expired) { showError(`Your ${currentPlan.toUpperCase()} cycle has expired. Please renew.`); window.openModal(); return; }
    if (!fup.allowed) { if (currentPlan === 'free') window.openModal(); else showError(`FUP Limit Reached.`); return; }

    let endpoint = ''; let bodyData = {}; let renderType = '';

    if (activeJurisdiction === 'usa' && activeTab === 'us-case') {
        const query = document.getElementById('us-query-input').value.trim();
        if (!query) return;
        endpoint = `${API}/us-cases`; 
        bodyData = { query: query }; 
        renderType = 'us-list';
    } else if (activeTab === 'cnr') {
        const mode = document.querySelector('input[name="cnr-mode"]:checked').value;
        if (mode === 'single') {
            const query = document.getElementById('cnr-input').value.trim();
            if (!query) return;
            endpoint = `${API}/cnr`; bodyData = { cnr: query }; renderType = 'cnr';
        } else {
            const bulkText = document.getElementById('cnr-bulk-input').value.trim();
            if (!bulkText) return;
            const cnrs = bulkText.split('\n').map(c => c.trim()).filter(c => c.length > 5);
            if (cnrs.length > 50) return alert("Maximum 50 CNRs allowed.");
            endpoint = `${API}/bulk-refresh`; bodyData = { cnrs: cnrs }; renderType = 'bulk';
        }
    } else if (activeTab === 'causelist') {
        const state = document.getElementById('causelist-state').value.trim().toUpperCase();
        const query = document.getElementById('causelist-query').value.trim();
        if (!state || !query) return alert("Provide State Code and Query.");
        endpoint = `${API}/causelist`; bodyData = { query: query, state: state, limit: 20 }; renderType = 'causelist';
    } else {
        let query = '';
        if (activeTab === 'litigant') query = document.getElementById('litigant-input').value.trim();
        if (activeTab === 'advocate') query = document.getElementById('advocate-input').value.trim();
        if (activeTab === 'judge') query = document.getElementById('judge-input').value.trim();
        if (!query) return;
        endpoint = `${API}/search`; bodyData = { query: query, type: activeTab }; renderType = 'list';
    }

    await performSearch(endpoint, bodyData, fup.storageKey, renderType);
};

async function performSearch(endpoint, bodyData, storageKey, renderType) {
    setLoading(true); window.clearResults();
    try {
        const res = await fetch(endpoint, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(bodyData) });
        const json = await res.json();
        
        if (!res.ok || !json.success) return showError(json.error || 'The official API failed to fetch records.');

        if (currentUser) {
            let currentCount = parseInt(localStorage.getItem(storageKey) || 0);
            localStorage.setItem(storageKey, currentCount + 1);
            updateSearchLimitUI();
        }

        if (renderType === 'cnr') renderCaseDetail(json.data);
        else if (renderType === 'list') renderCaseList(json.data);
        else if (renderType === 'us-list') renderUSCaseList(json.data);
        else if (renderType === 'causelist') {
             // ... Your existing causelist rendering ...
        }
        else if (renderType === 'bulk') {
             // ... Your existing bulk rendering ...
        }
    } catch (e) { showError(`Network Error: Cannot connect to backend. (${e.message})`); } finally { setLoading(false); }
}

function updateSearchLimitUI() {
    const limitText = document.getElementById('limit-text');
    const upgradeBtn = document.getElementById('nav-upgrade-btn');
    if (!currentUser) {
        if (limitText) limitText.innerText = "Sign in with Google to get 1 free search";
        if (upgradeBtn) upgradeBtn.style.display = 'none'; return;
    }
    const fup = checkFUP('search');
    if (fup.expired) {
        if (limitText) limitText.innerHTML = `<span style="color: #ef4444; font-weight:600;">Subscription Expired - Renew Now</span>`;
        if (upgradeBtn) { upgradeBtn.style.display = 'inline-block'; upgradeBtn.innerText = "⚡ Renew"; upgradeBtn.onclick = () => window.openModal(); }
        return;
    }
    let daysText = currentPlan !== 'free' ? `(${fup.daysLeft} days left) • ` : '';
    if (currentPlan === 'supreme') {
        if (limitText) limitText.innerHTML = `<span style="color: #8b5cf6; font-weight:600;">Supreme ${daysText}${fup.remaining}/${fup.limit} Searches</span>`;
        if (upgradeBtn) upgradeBtn.style.display = 'none'; 
    } else {
        if (limitText) limitText.innerHTML = `<span style="color: var(--primary); font-weight:600;">${currentPlan.toUpperCase()} ${daysText}${fup.remaining}/${fup.limit} Searches</span>`;
        if (upgradeBtn) { upgradeBtn.style.display = 'inline-block'; upgradeBtn.innerText = "⚡ Upgrade"; upgradeBtn.onclick = () => window.openModal(); }
    }
}

function setLoading(on) {
    const btn = document.getElementById('search-btn');
    if (!btn) return;
    btn.disabled = on;
    btn.innerHTML = on ? '<div class="spinner"></div><span>Fetching...</span>' : '<span id="btn-text">Search Cases</span>';
}

function renderCaseList(resultsArray) {
    if (!resultsArray || resultsArray.length === 0) { showError('No cases found for this search query.'); return; }
    let html = `<div style="margin-bottom: 15px; cursor: pointer; color: var(--text-muted); font-size: 14px; text-decoration: underline;" onclick="window.clearResults()">← Back to search</div><div style="font-size: 16px; font-weight: 600; margin-bottom: 15px; color: var(--text-main);">Found ${resultsArray.length} recent cases:</div>`;
    resultsArray.forEach(data => {
        const petitioner = (data.petitioners && data.petitioners.length > 0) ? data.petitioners[0] : 'Unknown Petitioner';
        const respondent = (data.respondents && data.respondents.length > 0) ? data.respondents[0] : 'Unknown Respondent';
        html += `<div style="background: var(--bg); padding: 15px; border-radius: 8px; border: 1px solid var(--border); margin-bottom: 10px;"><div style="display: flex; justify-content: space-between; align-items: start;"><div style="padding-right: 15px;"><div style="font-size: 15px; font-weight: 600; color: var(--text-main); margin-bottom: 4px; word-break: break-word;">${petitioner} vs ${respondent}</div><div style="font-size: 13px; color: var(--text-muted); margin-bottom: 8px;">CNR: ${data.cnr || '—'}</div></div><div style="font-size: 11px; font-weight: bold; background: var(--primary-bg); color: var(--primary); padding: 4px 8px; border-radius: 4px; white-space: nowrap;">${data.caseStatus || 'Pending'}</div></div></div>`;
    });
    document.getElementById('results').innerHTML = html;
}

// --- NEW US DATA RENDERER ---
function renderUSCaseList(resultsArray) {
    if (!resultsArray || resultsArray.length === 0) { showError('No US cases found for this query.'); return; }
    let html = `<div style="margin-bottom: 15px; cursor: pointer; color: var(--text-muted); font-size: 14px; text-decoration: underline;" onclick="window.clearResults()">← Back to search</div><div style="font-size: 16px; font-weight: 600; margin-bottom: 15px; color: var(--text-main);">Found ${resultsArray.length} US Opinions:</div>`;
    
    resultsArray.forEach(caseItem => {
        // Strip out HTML bold tags that CourtListener sends in snippets
        const cleanSnippet = caseItem.snippet ? caseItem.snippet.replace(/<\/?em>/g, '').substring(0, 150) + "..." : "No snippet available.";
        // Escape quotes to safely pass to the AI function
        const safeSnippetForAI = cleanSnippet.replace(/'/g, "\\'").replace(/"/g, '\\"');
        
        html += `
        <div style="background: var(--bg); padding: 15px; border-radius: 8px; border: 1px solid var(--border); margin-bottom: 10px;">
            <div style="font-size: 15px; font-weight: 600; color: var(--text-main); margin-bottom: 4px;">${caseItem.caseName || 'Unknown Case'}</div>
            <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 8px;">🏛 ${caseItem.court || 'US Court'} • 📅 ${caseItem.dateFiled || 'Unknown Date'}</div>
            <div style="font-size: 13px; color: var(--text-main); margin-bottom: 12px; font-style: italic; border-left: 2px solid var(--border); padding-left: 8px;">"${cleanSnippet}"</div>
            
            <button class="btn-action btn-ai" onclick="window.openAI('${safeSnippetForAI}')" style="font-size: 0.75rem; padding: 6px 12px;">
                ✨ Explain this in Plain English
            </button>
        </div>`;
    });
    document.getElementById('results').innerHTML = html;
}

function renderCaseDetail(payload) {
    // ... KEEP YOUR EXISTING RENDERCASEDETAIL FUNCTION ...
}

window.analyzeOrder = async (cnr, filename, type, buttonElement) => {
    // ... KEEP YOUR EXISTING ANALYZEORDER FUNCTION ...
};

window.downloadPDF = async function(event, cnr, filename) {
    // ... KEEP YOUR EXISTING DOWNLOADPDF FUNCTION ...
};

function showError(msg) {
    const resultsContainer = document.getElementById('results');
    if (resultsContainer) resultsContainer.innerHTML = `<div class="error-box"><span>⚠</span><span>${msg}</span></div>`;
}

window.clearResults = function() { 
    const resultsContainer = document.getElementById('results');
    if (resultsContainer) resultsContainer.innerHTML = ''; 
};

// ==========================================
// ✨ AI SIDEBAR LOGIC
// ==========================================
window.openAI = async function(legalText = null) {
    if (!currentUser) {
        alert("Please sign in to use the AI Assistant.");
        return;
    }
    const sidebar = document.getElementById('ai-sidebar');
    const overlay = document.getElementById('ai-overlay');
    const contentDiv = document.getElementById('ai-content');

    sidebar.classList.add('active');
    overlay.style.display = 'block';

    if (legalText) {
        contentDiv.innerHTML = `<div style="text-align: center; margin-top: 40px; color: var(--primary); font-weight: bold;">⏳ Translating to Plain English...</div>`;
        
        try {
            // Call your backend AI endpoint (You will need to create this in server.js)
            const response = await fetch(`${API}/ai-explain`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: legalText, context: "General Law" })
            });
            
            const data = await response.json();
            
            if (data.success) {
                contentDiv.innerHTML = `
                    <div style="background: var(--bg-alt); padding: 12px; border-radius: 8px; margin-bottom: 16px; font-style: italic; font-size: 0.85rem; border-left: 3px solid var(--border);">
                        "${legalText}"
                    </div>
                    <div style="font-weight: 600; margin-bottom: 8px; color: var(--primary);">Plain English Summary:</div>
                    <div style="font-size: 0.95rem; line-height: 1.6;">${data.explanation}</div>
                `;
            } else {
                contentDiv.innerHTML = `<div style="color: red;">Error: Could not fetch explanation. Make sure your backend API is set up.</div>`;
            }
        } catch (error) {
            contentDiv.innerHTML = `<div style="color: red;">Network error occurred.</div>`;
        }
    }
};

window.closeAI = function() {
    document.getElementById('ai-sidebar').classList.remove('active');
    document.getElementById('ai-overlay').style.display = 'none';
};

document.addEventListener('keydown', e => { if (e.key === 'Enter') window.handleSearch(); });

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => { console.log('Vaad PWA Active.'); })
            .catch((error) => { console.error('PWA Engine failed:', error); });
    });
}
