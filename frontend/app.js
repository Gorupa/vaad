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

let activeTab = 'cnr';
let activeJurisdiction = 'india';

const limits = {
    free: { search: 1, pdf: 0 },
    pro: { search: 30, pdf: 0 },
    promax: { search: 100, pdf: 0 },
    supreme: { search: 150, pdf: 30 }
};

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
        const drawerDashboard = document.getElementById('drawer-dashboard-btn');
        
        if (drawerUnauth) drawerUnauth.style.display = 'none';
        if (drawerAuth) {
            drawerAuth.style.display = 'flex';
            document.getElementById('drawer-name').innerText = user.displayName;
            document.getElementById('drawer-avatar').src = user.photoURL;
        }
        if (drawerLogout) drawerLogout.style.display = 'block';
        if (drawerDashboard) drawerDashboard.style.display = 'block';

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
            console.error("Firebase read error:", error);
            currentPlan = 'free';
            cycleStartDate = new Date().toISOString().split('T')[0];
        }
    } else {
        document.getElementById('login-btn').style.display = 'flex';
        document.getElementById('user-menu').style.display = 'none';
        
        const drawerUnauth = document.getElementById('drawer-unauth');
        const drawerAuth = document.getElementById('drawer-auth');
        const drawerLogout = document.getElementById('drawer-logout-btn');
        const drawerDashboard = document.getElementById('drawer-dashboard-btn');
        
        if (drawerUnauth) drawerUnauth.style.display = 'block';
        if (drawerAuth) drawerAuth.style.display = 'none';
        if (drawerLogout) drawerLogout.style.display = 'none';
        if (drawerDashboard) drawerDashboard.style.display = 'none';

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
        if (diffDays >= 30) {
            isExpired = true;
        } else {
            daysLeft = 30 - diffDays;
        }
    }

    const storageKey = `vaad_${actionType}_${currentUser.uid}_cycle_${cycleStartDate}`;
    let used = parseInt(localStorage.getItem(storageKey) || 0);
    
    let planData = limits[currentPlan];
    let limit = planData ? planData[actionType] : 0; 
    let remaining = Math.max(0, limit - used);

    return {
        allowed: used < limit,
        used: used,
        limit: limit,
        remaining: remaining,
        storageKey: storageKey,
        expired: isExpired,
        daysLeft: daysLeft
    };
}

function updateBadge() {
    const badge = document.getElementById('user-badge');
    const drawerBadge = document.getElementById('drawer-badge');
    
    if (!badge) return;
    
    const fup = checkFUP('search');
    
    if (fup.expired) {
        badge.innerText = "EXPIRED";
        badge.style.background = "#ef4444"; 
        badge.style.color = "white";
    } else if (currentPlan === 'supreme') {
        badge.innerText = "SUPREME";
        badge.style.background = "#8b5cf6";
        badge.style.color = "white";
    } else if (currentPlan === 'promax') {
        badge.innerText = "PRO MAX";
        badge.style.background = "#d4af37";
        badge.style.color = "black";
    } else if (currentPlan === 'pro') {
        badge.innerText = "PRO";
        badge.style.background = "var(--primary)";
        badge.style.color = "white";
    } else {
        badge.innerText = "FREE";
        badge.style.background = "var(--border)";
        badge.style.color = "var(--text-muted)";
    }

    if (drawerBadge) {
        drawerBadge.innerText = badge.innerText;
        drawerBadge.style.background = badge.style.background;
        drawerBadge.style.color = badge.style.color;
    }
}

function updateTabLocks() {
    const cnrLock = document.getElementById('cnr-lock');
    const otherLocks = document.querySelectorAll('.tab:not(#tab-cnr):not(#tab-lawyer):not(#tab-us-case) .lock-icon');

    if (currentPlan === 'supreme' || currentPlan === 'promax' || currentPlan === 'pro') {
        if (cnrLock) cnrLock.style.display = 'none';
        otherLocks.forEach(icon => icon.style.display = 'none');
    } else {
        if (cnrLock) cnrLock.style.display = 'none';
        otherLocks.forEach(icon => icon.style.display = 'inline');
        if (activeTab !== 'cnr' && activeTab !== 'us-case' && activeTab !== 'lawyer') window.switchTab('cnr');
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
    if (!currentUser && tab !== 'cnr' && tab !== 'us-case' && tab !== 'lawyer') {
        window.openModal();
        return;
    }

    if (currentPlan === 'free' && tab !== 'cnr' && tab !== 'us-case' && tab !== 'lawyer') {
        window.openModal();
        return;
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
        window.openModal();
        return;
    }
    const mode = document.querySelector('input[name="cnr-mode"]:checked').value;
    document.getElementById('cnr-single-field').style.display = mode === 'single' ? 'block' : 'none';
    document.getElementById('cnr-bulk-field').style.display = mode === 'bulk' ? 'block' : 'none';
};

// --- VIEW SWITCHING LOGIC (Search vs Dashboard) ---
window.toggleView = function(viewName) {
    const searchView = document.getElementById('view-search');
    const dashboardView = document.getElementById('view-dashboard');
    
    if (viewName === 'dashboard') {
        if (!currentUser) {
            alert("Please sign in to access your Practice Dashboard.");
            window.openModal();
            return;
        }
        searchView.style.display = 'none';
        dashboardView.style.display = 'block';
    } else {
        dashboardView.style.display = 'none';
        searchView.style.display = 'block';
    }
};

// --- MODALS & MENUS ---
window.toggleMenu = function() {
    const drawer = document.getElementById('side-drawer');
    const overlay = document.getElementById('drawer-overlay');
    if (drawer.classList.contains('open')) {
        drawer.classList.remove('open');
        overlay.classList.remove('open');
    } else {
        drawer.classList.add('open');
        overlay.classList.add('open');
    }
};

window.openDevModal = function() {
    const modal = document.getElementById('dev-modal');
    if (modal) modal.classList.add('active');
};

window.closeDevModal = function() {
    const modal = document.getElementById('dev-modal');
    if (modal) modal.classList.remove('active');
};

window.openWhatsNewModal = function() {
    const modal = document.getElementById('whats-new-modal');
    if (modal) modal.classList.add('active');
};

window.closeWhatsNewModal = function() {
    const modal = document.getElementById('whats-new-modal');
    if (modal) modal.classList.remove('active');
};

window.closeModal = function() { 
    const modal = document.getElementById('upgrade-modal');
    if (modal) modal.style.display = 'none'; 
};

window.openModal = function() { 
    const modal = document.getElementById('upgrade-modal');
    if (!modal) return;

    if (!currentUser) {
        document.getElementById('pro-card').style.display = 'block';
        document.getElementById('promax-card').style.display = 'block';
        document.getElementById('supreme-card').style.display = 'block';
        window.selectPlan('pro');
        modal.style.display = 'flex';
        return;
    }

    const fup = checkFUP('search');

    if (currentPlan === 'supreme' && !fup.expired) return;

    if (fup.expired) {
        document.getElementById('pro-card').style.display = 'block';
        document.getElementById('promax-card').style.display = 'block';
        document.getElementById('supreme-card').style.display = 'block';
        window.selectPlan(currentPlan === 'free' ? 'pro' : currentPlan);
    } else {
        document.getElementById('pro-card').style.display = (currentPlan === 'free') ? 'block' : 'none';
        document.getElementById('promax-card').style.display = (currentPlan === 'free' || currentPlan === 'pro') ? 'block' : 'none';
        document.getElementById('supreme-card').style.display = 'block'; 

        if (currentPlan === 'free') window.selectPlan('pro');
        else if (currentPlan === 'pro') window.selectPlan('promax');
        else if (currentPlan === 'promax') window.selectPlan('supreme');
    }

    modal.style.display = 'flex'; 
};

window.payWithRazorpay = function(planType, amountInINR) {
    if (!currentUser) {
        alert("Please sign in with Google to create your account before upgrading.");
        window.closeModal();
        signInWithPopup(auth, provider);
        return;
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
            
            setTimeout(() => {
                window.location.reload();
            }, 3000);
        },
        
        "prefill": {
            "name": currentUser.displayName || "",
            "email": currentUser.email || ""
        },
        
        "notes": {
            "userId": currentUser.uid,
            "planName": planType
        },
        
        "theme": {
            "color": "#8b5cf6"
        }
    };

    const rzp = new window.Razorpay(options);
    
    rzp.on('payment.failed', function (response){
        alert(`Payment Failed: ${response.error.description}`);
    });
    
    rzp.open();
};

window.selectPlan = function(planType) {
    document.getElementById('pro-card').style.border = '1px solid var(--border)';
    document.getElementById('promax-card').style.border = '1px solid var(--border)';
    document.getElementById('supreme-card').style.border = '1px solid var(--border)';

    let amount = 99;
    let planName = "Pro";

    if (planType === 'pro') {
        document.getElementById('pro-card').style.border = '2px solid var(--primary)';
        amount = 99;
        planName = "Pro";
    } else if (planType === 'promax') {
        document.getElementById('promax-card').style.border = '2px solid #d4af37';
        amount = 199;
        planName = "Pro Max";
    } else if (planType === 'supreme') {
        document.getElementById('supreme-card').style.border = '2px solid #8b5cf6';
        amount = 399;
        planName = "Supreme";
    }

    const upgradeBtn = document.getElementById('upi-btn-link');
    if (upgradeBtn) {
        upgradeBtn.removeAttribute('href'); 
        upgradeBtn.innerText = `Pay ₹${amount} Securely`;
        upgradeBtn.onclick = (e) => {
            e.preventDefault();
            upgradeBtn.innerText = "Opening Checkout...";
            window.payWithRazorpay(planType, amount);
        };
    }
};

window.handleSearch = async function() {
    if (!currentUser) {
        signInWithPopup(auth, provider);
        return;
    }

    const fup = checkFUP('search');
    if (fup.expired) {
        showError(`Your ${currentPlan.toUpperCase()} subscription cycle has expired. Please renew.`);
        window.openModal();
        return;
    }
    if (!fup.allowed) { 
        if (currentPlan === 'free') window.openModal();
        else showError(`FUP Limit Reached. You have used all ${fup.limit} searches for this cycle.`);
        return; 
    }

    let endpoint = '';
    let bodyData = {};
    let renderType = '';

    if (activeJurisdiction === 'usa' && activeTab === 'us-case') {
        alert("US Case Law search is coming soon. Stay tuned!");
        return;
    } else if (activeTab === 'lawyer') {
        alert("Data-Driven Lawyer Discovery is currently compiling local records and will be available soon.");
        return;
    } else if (activeTab === 'cnr') {
        const mode = document.querySelector('input[name="cnr-mode"]:checked').value;
        if (mode === 'single') {
            const query = document.getElementById('cnr-input').value.trim();
            if (!query) return;
            endpoint = `${API}/cnr`;
            bodyData = { cnr: query };
            renderType = 'cnr';
        } else {
            const bulkText = document.getElementById('cnr-bulk-input').value.trim();
            if (!bulkText) return;
            const cnrs = bulkText.split('\n').map(c => c.trim()).filter(c => c.length > 5);
            if (cnrs.length > 50) return alert("Maximum 50 CNRs allowed per bulk request.");
            if (cnrs.length === 0) return alert("Please enter valid CNRs.");
            
            endpoint = `${API}/bulk-refresh`;
            bodyData = { cnrs: cnrs };
            renderType = 'bulk';
        }
    } else if (activeTab === 'causelist') {
        const state = document.getElementById('causelist-state').value.trim().toUpperCase();
        const query = document.getElementById('causelist-query').value.trim();
        if (!state || !query) return alert("Please provide both State Code and Search Query.");
        
        endpoint = `${API}/causelist`;
        bodyData = { query: query, state: state, limit: 20 };
        renderType = 'causelist';
    } else {
        let query = '';
        if (activeTab === 'litigant') query = document.getElementById('litigant-input').value.trim();
        if (activeTab === 'advocate') query = document.getElementById('advocate-input').value.trim();
        if (activeTab === 'judge') query = document.getElementById('judge-input').value.trim();
        if (!query) return;

        endpoint = `${API}/search`;
        bodyData = { query: query, type: activeTab };
        renderType = 'list';
    }

    await performSearch(endpoint, bodyData, fup.storageKey, renderType);
};

async function performSearch(endpoint, bodyData, storageKey, renderType) {
    setLoading(true); 
    window.clearResults();
    try {
        const res = await fetch(endpoint, { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify(bodyData) 
        });
        const json = await res.json();
        
        if (!res.ok || !json.success) {
            return showError(json.error || 'The official API failed to fetch records.');
        }

        if (currentUser) {
            let currentCount = parseInt(localStorage.getItem(storageKey) || 0);
            localStorage.setItem(storageKey, currentCount + 1);
            updateSearchLimitUI();
        }

        if (renderType === 'cnr') renderCaseDetail(json.data);
        else if (renderType === 'list') renderCaseList(json.data);
        else if (renderType === 'causelist') {
             const resultsContainer = document.getElementById('results');
             let html = `<div style="margin-bottom: 15px; cursor: pointer; color: var(--text-muted); font-size: 14px; text-decoration: underline;" onclick="window.clearResults()">← Back to search</div>
                         <h3 style="margin-bottom: 15px;">Today's Cause List</h3>`;
             
             if (!json.data || !json.data.results || json.data.results.length === 0) {
                 html += `<div>No cases listed today for this query.</div>`;
             } else {
                 json.data.results.forEach(c => {
                     html += `<div style="background: var(--bg); padding: 12px; border: 1px solid var(--border); border-radius: 8px; margin-bottom: 10px;">
                        <div style="font-weight: 600; margin-bottom: 4px;">${c.caseNumber || 'Unknown Case'}</div>
                        <div style="font-size: 13px; color: var(--text-muted);">Court: ${c.courtName || '—'}</div>
                        <div style="font-size: 12px; margin-top: 8px;"><span style="background: var(--primary-bg); color: var(--primary); padding: 2px 6px; border-radius: 4px;">Room: ${c.courtNo || '—'}</span></div>
                     </div>`;
                 });
             }
             resultsContainer.innerHTML = html;
        }
        else if (renderType === 'bulk') {
             const resultsContainer = document.getElementById('results');
             resultsContainer.innerHTML = `<div style="background: var(--success-bg); color: var(--success-text); padding: 16px; border: 1px solid #a7f3d0; border-radius: 8px;">
                <h3 style="margin-bottom: 8px;">Bulk Refresh Initiated ✓</h3>
                <p style="font-size: 0.9rem;">Your CNRs have been queued for a fresh scrape from the eCourts server. Please wait 1-2 minutes and search for them individually to see updated dates and orders.</p>
                <div style="margin-top: 12px; cursor: pointer; text-decoration: underline; font-size: 0.85rem;" onclick="window.clearResults()">← Start New Search</div>
             </div>`;
        }
    } catch (e) { 
        showError(`Network Error: Cannot connect to backend. (${e.message})`); 
    } finally { 
        setLoading(false); 
    }
}

function updateSearchLimitUI() {
    const limitText = document.getElementById('limit-text');
    const upgradeBtn = document.getElementById('nav-upgrade-btn');
    
    if (!currentUser) {
        if (limitText) limitText.innerText = "Sign in with Google to get 1 free search";
        if (upgradeBtn) upgradeBtn.style.display = 'none';
        return;
    }

    const fup = checkFUP('search');

    if (fup.expired) {
        if (limitText) limitText.innerHTML = `<span style="color: #ef4444; font-weight:600;">Subscription Expired - Renew Now</span>`;
        if (upgradeBtn) { 
            upgradeBtn.style.display = 'inline-block'; 
            upgradeBtn.innerText = "⚡ Renew"; 
            upgradeBtn.onclick = () => window.openModal(); 
        }
        return;
    }

    let daysText = currentPlan !== 'free' ? `(${fup.daysLeft} days left) • ` : '';

    if (currentPlan === 'supreme') {
        if (limitText) limitText.innerHTML = `<span style="color: #8b5cf6; font-weight:600;">Supreme ${daysText}${fup.remaining}/${fup.limit} Searches</span>`;
        if (upgradeBtn) upgradeBtn.style.display = 'none'; 
    } else if (currentPlan === 'promax') {
        if (limitText) limitText.innerHTML = `<span style="color: #d4af37; font-weight:600;">Pro Max ${daysText}${fup.remaining}/${fup.limit} Searches</span>`;
        if (upgradeBtn) { 
            upgradeBtn.style.display = 'inline-block'; 
            upgradeBtn.innerText = "⚡ Get Supreme"; 
            upgradeBtn.onclick = () => window.openModal(); 
        }
    } else if (currentPlan === 'pro') {
        if (limitText) limitText.innerHTML = `<span style="color: var(--primary); font-weight:600;">Pro Active ${daysText}${fup.remaining}/${fup.limit} Searches</span>`;
        if (upgradeBtn) { 
            upgradeBtn.style.display = 'inline-block'; 
            upgradeBtn.innerText = "⚡ Get Pro Max"; 
            upgradeBtn.onclick = () => window.openModal(); 
        }
    } else {
        if (limitText) limitText.innerHTML = `<span style="color: var(--text-muted); font-weight:600;">Free Plan • ${fup.remaining}/${fup.limit} Searches</span>`;
        if (upgradeBtn) { 
            upgradeBtn.style.display = 'inline-block'; 
            upgradeBtn.innerText = "⚡ Upgrade to Pro"; 
            upgradeBtn.onclick = () => window.openModal(); 
        }
    }
}

function setLoading(on) {
    const btn = document.getElementById('search-btn');
    if (!btn) return;
    btn.disabled = on;
    btn.innerHTML = on ? '<div class="spinner"></div><span>Fetching...</span>' : '<span id="btn-text">Search Cases</span>';
}

function renderCaseList(resultsArray) {
    if (!resultsArray || resultsArray.length === 0) { 
        showError('No cases found for this search query.'); 
        return; 
    }

    let html = `<div style="margin-bottom: 15px; cursor: pointer; color: var(--text-muted); font-size: 14px; text-decoration: underline;" onclick="window.clearResults()">← Back to search</div>
                <div style="font-size: 16px; font-weight: 600; margin-bottom: 15px; color: var(--text-main);">Found ${resultsArray.length} recent cases:</div>`;

    resultsArray.forEach(data => {
        const petitioner = (data.petitioners && data.petitioners.length > 0) ? data.petitioners[0] : 'Unknown Petitioner';
        const respondent = (data.respondents && data.respondents.length > 0) ? data.respondents[0] : 'Unknown Respondent';
        const cnr = data.cnr || '—';
        const status = data.caseStatus || 'Pending';
        
        html += `
        <div style="background: var(--bg); padding: 15px; border-radius: 8px; border: 1px solid var(--border); margin-bottom: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: start;">
                <div style="padding-right: 15px;">
                    <div style="font-size: 15px; font-weight: 600; color: var(--text-main); margin-bottom: 4px; word-break: break-word;">${petitioner} vs ${respondent}</div>
                    <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 8px;">CNR: ${cnr}</div>
                </div>
                <div style="font-size: 11px; font-weight: bold; background: var(--primary-bg); color: var(--primary); padding: 4px 8px; border-radius: 4px; white-space: nowrap;">${status}</div>
            </div>
        </div>`;
    });
    
    const resultsContainer = document.getElementById('results');
    if (resultsContainer) resultsContainer.innerHTML = html;
}

function renderCaseDetail(payload) {
    if (!payload || !payload.data || !payload.data.courtCaseData) return showError('Invalid API data.'); 

    const data = payload.data.courtCaseData;
    const title = `${(data.petitioners||['—'])[0]} vs ${(data.respondents||['—'])[0]}`;
    const status = data.caseStatus || 'Pending';
    
    let html = `<div style="margin-bottom: 15px; cursor: pointer; color: var(--text-muted); font-size: 14px; text-decoration: underline;" onclick="window.clearResults()">← Back to search</div>
        <div style="background: var(--bg); padding: 20px; border-radius: 8px; border: 1px solid var(--border);">
            <div style="font-size: 20px; font-weight: 600; color: var(--text-main); margin-bottom: 5px;">${title}</div>
            <div style="font-size: 14px; color: var(--text-muted); margin-bottom: 20px;">CNR: ${data.cnr}</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div><div style="font-size: 12px; color: var(--text-muted);">Status</div><div style="font-weight: 500;">${status}</div></div>
                <div><div style="font-size: 12px; color: var(--text-muted);">Court</div><div style="font-weight: 500;">${data.courtName}</div></div>
                <div style="grid-column: span 2;"><div style="font-size: 12px; color: var(--text-muted);">Advocates</div><div style="font-weight: 500;">P: ${(data.petitionerAdvocates||['—']).join(', ')} <br> R: ${(data.respondentAdvocates||['—']).join(', ')}</div></div>
            </div>
        </div>`;

    const history = data.historyOfCaseHearings || [];
    const orders = [...(data.interimOrders || []), ...(data.judgmentOrders || [])];

    if (currentPlan !== 'supreme') {
        if (history.length > 0 || orders.length > 0) {
            html += `<div style="margin-top: 20px; background: rgba(139, 92, 246, 0.05); border: 1px dashed #8b5cf6; padding: 15px; border-radius: 8px; text-align: center; cursor: pointer;" onclick="window.openModal()">
                <div style="font-size: 16px; margin-bottom: 8px;">🔒 <b>This case has ${history.length} historical hearings and ${orders.length} orders.</b></div>
                <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 12px;">Upgrade to the ₹399 Supreme Plan to analyze AI summaries and download certified PDFs.</div>
                <button class="btn-primary-intent" style="background: #8b5cf6; border: none; padding: 8px 16px; border-radius: 6px; color: white; font-weight: 600; cursor: pointer;">Unlock Case History & AI</button>
            </div>`;
        }
    } else {
        if (history.length > 0) {
            html += `<h3 style="margin-top:25px; margin-bottom: 10px; font-size: 1.1rem;">Hearing History</h3>
            <div style="overflow-x: auto; background: var(--bg); border-radius: 8px; border: 1px solid var(--border);">
                <table style="width: 100%; text-align: left; border-collapse: collapse; font-size: 13px;">
                    <tr style="background: var(--bg-alt); border-bottom: 1px solid var(--border);">
                        <th style="padding: 10px;">Date</th><th style="padding: 10px;">Purpose</th><th style="padding: 10px;">Judge</th>
                    </tr>`;
            history.forEach(h => {
                html += `<tr style="border-bottom: 1px solid var(--border);">
                    <td style="padding: 10px;">${h.hearingDate || h.businessOnDate}</td>
                    <td style="padding: 10px;">${h.purposeOfListing || '—'}</td>
                    <td style="padding: 10px;">${h.judge || '—'}</td>
                </tr>`;
            });
            html += `</table></div>`;
        }

        if (orders.length > 0) {
            html += `<h3 style="margin-top:25px; margin-bottom: 10px; font-size: 1.1rem;">Case Orders & Judgments</h3>
            <div style="display: flex; flex-direction: column; gap: 12px;">`;

            orders.forEach(o => {
                const orderDate = o.orderDate || 'Order';
                const description = o.description || 'Order Document';
                const filename = o.orderUrl || 'unknown.pdf';
                
                html += `<div style="background: var(--bg); padding: 16px; border: 1px solid var(--border); border-radius: 8px;">
                    <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">${orderDate}</div>
                    <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 12px;">${description}</div>
                    
                    <div class="order-actions" id="order-card-${filename.replace(/\./g, '-')}">
                        <button class="btn-action" onclick="window.downloadPDF(event, '${data.cnr}', '${filename}')">
                            📄 Download PDF
                        </button>
                        
                        <button class="btn-action" onclick="window.analyzeOrder('${data.cnr}', '${filename}', 'markdown', this)">
                            📝 Extract Text
                        </button>

                        <button class="btn-action btn-ai" onclick="window.analyzeOrder('${data.cnr}', '${filename}', 'summary', this)">
                            <svg viewBox="0 0 24 24"><path d="M12 2L15 9L22 12L15 15L12 22L9 15L2 12L9 9L12 2Z"></path></svg>
                            AI Summary
                        </button>
                    </div>
                </div>`;
            });
            html += `</div>`;
        }
    }

    const resultsContainer = document.getElementById('results');
    if (resultsContainer) resultsContainer.innerHTML = html;
}

window.analyzeOrder = async (cnr, filename, type, buttonElement) => {
    if (type === 'summary' && window.currentUserPlan !== 'supreme') {
        alert("AI Summaries are only available on the Supreme Plan. Please upgrade.");
        window.openModal();
        return;
    }
    if (type === 'markdown' && (window.currentUserPlan === 'free' || window.currentUserPlan === 'pro')) {
        alert("Text extraction requires Pro Max or Supreme Plan.");
        window.openModal();
        return;
    }

    const orderDiv = buttonElement.closest('div[id^="order-card-"]');
    let aiBox = orderDiv.querySelector('.ai-box');
    
    if (!aiBox) {
        aiBox = document.createElement('div');
        aiBox.className = 'ai-box active';
        orderDiv.appendChild(aiBox);
    } else {
        aiBox.classList.add('active');
    }

    aiBox.innerHTML = `<div class="ai-loading"><div class="ai-spinner"></div> Fetching ${type === 'summary' ? 'AI Analysis' : 'Text'} (10-30s)...</div>`;

    try {
        const response = await fetch(`${API}/order/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cnr, filename, type: type === 'summary' ? 'summary' : 'markdown' })
        });

        const data = await response.json();

        if (data.success) {
            if (type === 'summary') {
                const analysis = data.data.aiAnalysis;
                if (!analysis) {
                    aiBox.innerHTML = `<strong>Notice:</strong> Analysis is still generating on the government server. Please click analyze again in 30 seconds.`;
                    return;
                }
                
                const summary = analysis.intelligent_insights_analytics?.order_significance_and_impact_assessment?.ai_generated_executive_summary || "Summary not available.";
                const outcome = analysis.foundational_metadata?.procedural_details_from_order?.disposition_outcome_if_disposed || "Pending / Interim";
                const statutesObj = analysis.deep_legal_substance_context?.core_legal_content_analysis?.statutes_cited_and_applied || [];
                
                let actsHtml = '';
                if (statutesObj.length > 0) {
                    actsHtml = `<strong>Key Statutes Cited:</strong><ul style="margin-top: 4px; padding-left: 16px;">`;
                    statutesObj.forEach(act => {
                        actsHtml += `<li>${act.act_name} (${act.section_article_rule})</li>`;
                    });
                    actsHtml += `</ul>`;
                }

                aiBox.innerHTML = `
                    <h4>✨ AI Executive Summary</h4>
                    <p style="margin-bottom: 12px;">${summary}</p>
                    ${actsHtml}
                    <div style="margin-top: 10px; border-top: 1px dashed #ddd6fe; padding-top: 10px;"><strong>Outcome:</strong> <span style="background: var(--success-bg); color: var(--success-text); padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 0.75rem;">${outcome}</span></div>
                `;
            } else if (type === 'markdown') {
                const text = data.data.extractedText || data.data.markdownContent || "Text not found.";
                aiBox.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <h4 style="margin: 0; color: var(--text-main);">📄 Extracted Order Text</h4>
                        <button class="btn-action" onclick="navigator.clipboard.writeText(this.parentElement.nextElementSibling.value); this.innerText='Copied!'; setTimeout(()=>this.innerText='Copy Text', 2000);" style="padding: 4px 8px; font-size: 0.75rem;">Copy Text</button>
                    </div>
                    <textarea readonly style="width: 100%; height: 200px; font-family: monospace; font-size: 12px; padding: 12px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg); color: var(--text-main);">${text}</textarea>
                `;
            }
        } else {
            aiBox.innerHTML = `<div style="color: var(--error-text);">Error: ${data.error}</div>`;
        }
    } catch (err) {
        aiBox.innerHTML = `<div style="color: var(--error-text);">Connection failed. Please try again.</div>`;
    }
};

window.downloadPDF = async function(event, cnr, filename) {
    const fup = checkFUP('pdf');

    if (fup.expired) {
        alert("Your subscription has expired. Please renew to download PDFs.");
        window.openModal();
        return;
    }

    if (!fup.allowed) {
        alert(`Strict FUP Reached: You have used all ${fup.limit} of your PDF downloads for this cycle.`);
        return;
    }

    const btn = event.target;
    const originalText = btn.innerText;
    btn.innerText = "Downloading...";
    btn.style.opacity = "0.7";
    btn.disabled = true;

    try {
        const res = await fetch(`${API}/download`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ cnr, filename })
        });

        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const json = await res.json();
            alert(json.error || 'Failed to download PDF.');
            btn.innerText = "Error";
            return;
        }

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);

        localStorage.setItem(fup.storageKey, fup.used + 1);
        btn.innerText = "Downloaded ✓";
        btn.style.background = "#10b981"; 
        btn.style.color = "white";
        btn.style.opacity = "1";

    } catch (e) {
        alert(`Network error: ${e.message}`);
        btn.innerText = originalText;
        btn.disabled = false;
        btn.style.opacity = "1";
    }
};

function showError(msg) {
    const resultsContainer = document.getElementById('results');
    if (resultsContainer) {
        resultsContainer.innerHTML = `<div class="error-box"><span>⚠</span><span>${msg}</span></div>`;
    }
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
            .then((registration) => {
                console.log('Vaad PWA Active.');
            })
            .catch((error) => {
                console.error('PWA Engine failed:', error);
            });
    });
}
