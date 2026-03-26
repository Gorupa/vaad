window.onerror = function(msg, url, line) { 
    console.error("Script Error: " + msg + " (Line " + line + ")"); 
};

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithCredential, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

window.addEventListener('load', () => {
    if (typeof google !== 'undefined' && google.accounts) {
        google.accounts.id.initialize({
            client_id: "649989985981-u00i42pgr5taercoj5koqabm5aul58k0.apps.googleusercontent.com", 
            callback: handleCredentialResponse,
            use_fedcm_for_prompt: true 
        });
        console.log("[Auth] Google Credential Manager Initialized.");
    } else {
        console.error("[Auth] Google API script not found.");
    }
});

async function handleCredentialResponse(response) {
    try {
        const credential = GoogleAuthProvider.credential(response.credential);
        await signInWithCredential(auth, credential);
        window.closeLoginModal();
    } catch (error) {
        console.error("[Auth] Auth via Credential Manager failed:", error);
        resetLoginButtons();
    }
}

// ✨ NEW: Modal Control Functions
window.openLoginModal = function() {
    document.getElementById('login-modal').classList.add('active');
    document.getElementById('login-modal').style.display = 'flex';
};

window.closeLoginModal = function() {
    document.getElementById('login-modal').classList.remove('active');
    document.getElementById('login-modal').style.display = 'none';
    document.getElementById('auth-error').style.display = 'none';
    document.getElementById('auth-email').value = '';
    document.getElementById('auth-password').value = '';
    resetLoginButtons();
};

function resetLoginButtons() {
    const emailLoginBtn = document.getElementById('email-login-btn');
    const googleLoginBtn = document.getElementById('google-login-btn');
    
    if (emailLoginBtn) {
        emailLoginBtn.innerText = "Sign In / Register";
        emailLoginBtn.disabled = false;
    }
    if (googleLoginBtn) {
        googleLoginBtn.innerHTML = `<img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" style="width: 20px; margin-right: 10px;" alt="G"> Continue with Google`;
        googleLoginBtn.disabled = false;
    }
}

const API = 'https://vaad-wnul.onrender.com/api';
let currentUser = null;
let currentPlan = 'free'; 
let cycleStartDate = null; 
let activeTab = 'cnr';
let activeJurisdiction = 'india';
let syncPermission = true;

let practiceCases = JSON.parse(localStorage.getItem('vaad_dashboard_cases')) || []; 
let userConsent = localStorage.getItem('vaad_dpdp_consent');
let pendingSaveAction = null; 

const limits = {
    free: { search: 1, pdf: 0 },
    pro: { search: 30, pdf: 0 },
    promax: { search: 100, pdf: 0 },
    supreme: { search: 150, pdf: 30 }
};

// --- BUTTON BINDINGS ---
document.addEventListener('click', async (e) => {
    const logoutTarget = e.target.closest('#logout-btn') || e.target.closest('#drawer-logout-btn');
    const emailLoginBtn = e.target.closest('#email-login-btn');
    const googleLoginBtn = e.target.closest('#google-login-btn');

    // 1. Email & Password Authentication
    if (emailLoginBtn) {
        const email = document.getElementById('auth-email').value.trim();
        const password = document.getElementById('auth-password').value;
        const errorDiv = document.getElementById('auth-error');
        
        if (!email || !password) {
            errorDiv.innerText = "Please enter both email and password.";
            errorDiv.style.display = "block";
            return;
        }

        emailLoginBtn.innerHTML = '<div class="spinner" style="width:14px; height:14px; border-color:white; border-top-color:transparent; margin-right:8px;"></div> Connecting...';
        emailLoginBtn.disabled = true;
        errorDiv.style.display = "none";

        try {
            await signInWithEmailAndPassword(auth, email, password);
            window.closeLoginModal();
        } catch (error) {
            if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
                try {
                    await createUserWithEmailAndPassword(auth, email, password);
                    window.closeLoginModal();
                } catch (registerError) {
                    if (registerError.code === 'auth/email-already-in-use') {
                        errorDiv.innerText = "This email is registered to a Google account. Try clicking 'Continue with Google'.";
                    } else {
                        errorDiv.innerText = "Error: " + registerError.message.replace('Firebase: ', '');
                    }
                    errorDiv.style.display = "block";
                    resetLoginButtons();
                }
            } else {
                errorDiv.innerText = "Error: " + error.message.replace('Firebase: ', '');
                errorDiv.style.display = "block";
                resetLoginButtons();
            }
        }
        return;
    }
    
    // 2. Google Sign In Authentication
    if (googleLoginBtn) {
        googleLoginBtn.innerHTML = '<div class="spinner" style="width:16px; height:16px; border-color:var(--text-muted); border-top-color:transparent; margin-right:8px;"></div> Connecting...';
        googleLoginBtn.disabled = true;

        const executePopup = async () => {
            try {
                await signInWithPopup(auth, provider);
                window.closeLoginModal();
            } catch (error) {
                console.error("Popup error:", error);
                resetLoginButtons();
            }
        };
        
        try {
            document.cookie = "g_state=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
            
            if (typeof google === 'undefined' || !google.accounts) {
                await executePopup();
                return;
            }

            google.accounts.id.prompt(async (notification) => {
                if (notification.isDismissedMoment() || notification.isSkippedMoment() || notification.isNotDisplayed()) {
                    await executePopup();
                }
            });
        } catch (error) {
            await executePopup();
        }
    }
    
    if (logoutTarget) {
        if (e.target.closest('#drawer-logout-btn')) window.toggleMenu();
        signOut(auth).then(() => {
            window.location.reload(); 
        });
    }
});

// --- CLOUD SYNC HELPER ---
async function syncDashboardToCloud() {
    if (!currentUser) return; 
    if (userConsent !== 'true') return; 
    if (!syncPermission) return; 

    try {
        const userRef = doc(db, "users", currentUser.uid);
        await updateDoc(userRef, {
            practiceCases: practiceCases
        });
        console.log("[Cloud Sync] Dashboard saved to Firestore.");
    } catch (error) {
        console.error("Error syncing dashboard to cloud:", error);
    }
}

async function syncPermissionUI() {
    if (!currentUser) return;
    try {
        const userSnap = await getDoc(doc(db, 'users', currentUser.uid));
        if (userSnap.exists()) {
            const data = userSnap.data();
            if (data.permissions && data.permissions.cloudSync !== undefined) {
                syncPermission = data.permissions.cloudSync;
                const toggleEl = document.getElementById('syncPermissionToggle');
                if (toggleEl) toggleEl.checked = syncPermission;
            }
        }
    } catch (e) {
        console.error("Error syncing permission UI:", e);
    }
}

window.toggleCloudSyncPermission = async function() {
    const toggleEl = document.getElementById('syncPermissionToggle');
    const isChecked = toggleEl.checked; 
    
    if (!currentUser) {
        alert("Please sign in to change permissions.");
        toggleEl.checked = !isChecked; 
        return;
    }

    try {
        const userRef = doc(db, 'users', currentUser.uid);
        await setDoc(userRef, { permissions: { cloudSync: isChecked } }, { merge: true });
        syncPermission = isChecked;

        if (!isChecked) {
            if(confirm("Cloud Sync Revoked. Data remains locally on this device until you log out, but new changes won't backup. Without backup, data is lost if you use a new device or clear cache.")) {
                alert("Permission revoked successfully.");
            } else {
                toggleEl.checked = true; 
                await setDoc(userRef, { permissions: { cloudSync: true } }, { merge: true });
                syncPermission = true;
                return;
            }
        } else {
            alert("Secure Cloud Sync Enabled.");
            await syncDashboardToCloud(); 
        }

    } catch (error) {
        console.error("[Permission Layer] Error toggling permission:", error);
        alert("Network error. Check connection.");
        toggleEl.checked = !isChecked; 
    }
};

onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    const limitText = document.getElementById('limit-text');
    if (limitText) limitText.innerText = "Loading limits..."; 

    if (user) {
        document.getElementById('login-btn').style.display = 'none';
        document.getElementById('user-menu').style.display = 'flex';
        document.getElementById('user-name').innerText = user.displayName ? user.displayName.split(' ')[0] : user.email.split('@')[0];
        document.getElementById('user-avatar').src = user.photoURL || 'https://ui-avatars.com/api/?name=' + (user.displayName || user.email) + '&background=random';

        const drawerUnauth = document.getElementById('drawer-unauth');
        const drawerAuth = document.getElementById('drawer-auth');
        const drawerLogout = document.getElementById('drawer-logout-btn');
        const drawerDashboard = document.getElementById('drawer-dashboard-btn');
        
        if (drawerUnauth) drawerUnauth.style.display = 'none';
        if (drawerAuth) {
            drawerAuth.style.display = 'flex';
            document.getElementById('drawer-name').innerText = user.displayName || user.email.split('@')[0];
            document.getElementById('drawer-avatar').src = user.photoURL || 'https://ui-avatars.com/api/?name=' + (user.displayName || user.email) + '&background=random';
        }
        if (drawerLogout) drawerLogout.style.display = 'block';
        if (drawerDashboard) drawerDashboard.style.display = 'block';

        const badge = document.getElementById('user-badge');
        if (badge) { badge.innerText = "..."; badge.style.background = "gray"; }

        try {
            const userRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                const data = userSnap.data();
                let dbPlan = String(data.plan || 'free').toLowerCase().replace(/[^a-z]/g, '');
                currentPlan = limits[dbPlan] ? dbPlan : 'free';
                cycleStartDate = data.cycleStartDate || new Date().toISOString().split('T')[0];
                
                await syncPermissionUI();

                if (data.practiceCases) {
                    practiceCases = data.practiceCases;
                    localStorage.setItem('vaad_dashboard_cases', JSON.stringify(practiceCases));
                    console.log("[Cloud Sync] Dashboard loaded from Firestore.");
                }
            } else {
                const today = new Date().toISOString().split('T')[0];
                await setDoc(userRef, { 
                    name: user.displayName || user.email.split('@')[0], 
                    email: user.email, 
                    plan: 'free', 
                    cycleStartDate: today, 
                    joinedAt: new Date().toISOString(),
                    practiceCases: [],
                    permissions: { cloudSync: true }
                });
                currentPlan = 'free';
                cycleStartDate = today;
            }
        } catch (error) {
            console.error("Firebase read error:", error);
            currentPlan = 'free';
            cycleStartDate = new Date().toISOString().split('T')[0];
        }
        
        window.renderDashboard(); 
    } else {
        document.getElementById('login-btn').style.display = 'flex';
        document.getElementById('user-menu').style.display = 'none';
        
        const drawerUnauth = document.getElementById('drawer-unauth');
        const drawerAuth = document.getElementById('drawer-auth');
        const drawerLogout = document.getElementById('drawer-logout-btn');
        const drawerDashboard = document.getElementById('drawer-dashboard-btn');
        
        if (drawerUnauth) drawerUnauth.style.display = 'block';
        if (drawerAuth) {
            drawerAuth.style.display = 'none';
            document.getElementById('menu-btn').style.display = 'block';
        }
        if (drawerLogout) drawerLogout.style.display = 'none';
        if (drawerDashboard) drawerDashboard.style.display = 'none';

        currentPlan = 'free';
        cycleStartDate = null;
        
        practiceCases = [];
        localStorage.removeItem('vaad_dashboard_cases');
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
    const locks = document.querySelectorAll('.tab:not(#tab-cnr):not(#tab-lawyer):not(#tab-us-case) .lock-icon');
    if (currentPlan === 'supreme' || currentPlan === 'promax' || currentPlan === 'pro') {
        locks.forEach(icon => icon.style.display = 'none');
    } else {
        locks.forEach(icon => icon.style.display = 'inline');
        if (activeTab !== 'cnr' && activeTab !== 'us-case' && activeTab !== 'lawyer') window.switchTab('cnr');
    }
}

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
        window.openModal(); return;
    }
    if (currentPlan === 'free' && tab !== 'cnr' && tab !== 'us-case' && tab !== 'lawyer') {
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

window.toggleView = function(viewName) {
    const searchView = document.getElementById('view-search');
    const dashboardView = document.getElementById('view-dashboard');
    
    if (viewName === 'dashboard') {
        if (!currentUser) { alert("Please sign in access dashboard."); window.openModal(); return; }
        searchView.style.display = 'none';
        dashboardView.style.display = 'block';
        document.getElementById('menu-btn').style.display = 'block';
        window.renderDashboard();
    } else {
        dashboardView.style.display = 'none';
        searchView.style.display = 'block';
        document.getElementById('menu-btn').style.display = 'block';
    }
};

window.toggleMenu = function() {
    document.getElementById('side-drawer').classList.toggle('open');
    document.getElementById('drawer-overlay').classList.toggle('open');
};

window.openDevModal = function() { 
    const m = document.getElementById('dev-modal');
    m.classList.add('active'); m.style.display = ''; 
};
window.closeDevModal = function() { document.getElementById('dev-modal').classList.remove('active'); };

window.openWhatsNewModal = function() { 
    const m = document.getElementById('whats-new-modal');
    m.classList.add('active'); m.style.display = ''; 
};
window.closeWhatsNewModal = function() { document.getElementById('whats-new-modal').classList.remove('active'); };

window.openFaqModal = function() { 
    const m = document.getElementById('faq-modal');
    m.classList.add('active'); m.style.display = ''; 
};
window.closeFaqModal = function() { document.getElementById('faq-modal').classList.remove('active'); };

window.openAddCaseModal = function() { 
    const m = document.getElementById('add-case-modal');
    m.classList.add('active'); m.style.display = ''; 
};
window.closeAddCaseModal = function() { document.getElementById('add-case-modal').classList.remove('active'); };

window.openConsentModal = function() {
    const m = document.getElementById('consent-modal');
    m.classList.add('active'); m.style.display = ''; 
};
window.closeConsentModal = function() { document.getElementById('consent-modal').classList.remove('active'); };

window.acceptConsent = async function() {
    localStorage.setItem('vaad_dpdp_consent', 'true');
    userConsent = 'true';
    window.closeConsentModal();
    if (pendingSaveAction) { 
        await pendingSaveAction(); 
        pendingSaveAction = null; 
    } else {
        await syncDashboardToCloud();
    }
};

window.declineConsent = async function() {
    localStorage.setItem('vaad_dpdp_consent', 'false');
    userConsent = 'false';
    window.closeConsentModal();
    if (pendingSaveAction) { 
        await pendingSaveAction(); 
        pendingSaveAction = null; 
    }
};

window.openModal = function() { 
    const modal = document.getElementById('upgrade-modal');
    if (!modal) return;
    modal.style.display = ''; 

    if (!currentUser) {
        document.getElementById('pro-card').style.display = 'block';
        document.getElementById('promax-card').style.display = 'block';
        document.getElementById('supreme-card').style.display = 'block';
        window.selectPlan('pro');
        modal.classList.add('active');
        return;
    }

    const fup = checkFUP('search');
    if (currentPlan === 'supreme' && !fup.expired) return;

    if (fup.expired) {
        window.selectPlan(currentPlan === 'free' ? 'pro' : currentPlan);
    } else {
        document.getElementById('pro-card').style.display = (currentPlan === 'free') ? 'block' : 'none';
        document.getElementById('promax-card').style.display = (currentPlan === 'free' || currentPlan === 'pro') ? 'block' : 'none';
        document.getElementById('supreme-card').style.display = 'block'; 

        if (currentPlan === 'free') window.selectPlan('pro');
        else if (currentPlan === 'pro') window.selectPlan('promax');
        else if (currentPlan === 'promax') window.selectPlan('supreme');
    }
    modal.classList.add('active'); 
};
window.closeModal = function() { document.getElementById('upgrade-modal').classList.remove('active'); };

window.payWithRazorpay = function(planType, amountInINR) {
    if (!currentUser) {
        alert("Please sign in to create your account before upgrading.");
        window.closeModal(); 
        window.openLoginModal(); 
        return;
    }

    const options = {
        "key": "YOUR_LIVE_RAZORPAY_KEY_ID", 
        "amount": amountInINR * 100,
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
    document.querySelectorAll('.pricing-card').forEach(c => c.style.border = '1px solid var(--border)');
    let amount = 99; let planName = "Pro";
    if (planType === 'pro') { document.getElementById('pro-card').style.border = '2px solid var(--primary)'; amount = 99; }
    else if (planType === 'promax') { document.getElementById('promax-card').style.border = '2px solid #d4af37'; amount = 199; }
    else if (planType === 'supreme') { document.getElementById('supreme-card').style.border = '2px solid #8b5cf6'; amount = 399; }

    const upgradeBtn = document.getElementById('upi-btn-link');
    if (upgradeBtn) {
        upgradeBtn.removeAttribute('href'); 
        upgradeBtn.innerText = `Pay ₹${amount} Securely`;
        upgradeBtn.onclick = (e) => { e.preventDefault(); upgradeBtn.innerText = "Opening Checkout..."; window.payWithRazorpay(planType, amount); };
    }
};

window.openUniversalSearch = function() {
    if (!currentUser) { alert("Please sign in search your practice dashboard."); window.openModal(); return; }
    const modal = document.getElementById('universal-search-modal');
    modal.classList.add('active');
    modal.style.display = ''; 
    setTimeout(() => { document.getElementById('uni-search-input').focus(); }, 100);
};

window.closeUniversalSearch = function() {
    document.getElementById('universal-search-modal').classList.remove('active');
    document.getElementById('uni-search-input').value = '';
    document.getElementById('uni-search-results').innerHTML = '<div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 20px;">Type to search your Practice Dashboard records...</div>';
};

window.runUniversalSearch = function() {
    const query = document.getElementById('uni-search-input').value.toLowerCase().trim();
    const resultsContainer = document.getElementById('uni-search-results');
    
    if (!query) {
        resultsContainer.innerHTML = '<div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 20px;">Type to search your Practice Dashboard records...</div>';
        return;
    }

    const matches = practiceCases.filter(c => 
        c.title.toLowerCase().includes(query) || 
        (c.cnr && c.cnr.toLowerCase().includes(query)) ||
        c.totalFee.toString().includes(query)
    );

    if (matches.length === 0) {
        resultsContainer.innerHTML = `<div style="text-align: center; color: var(--warning-text); font-size: 0.9rem; padding: 20px; background: var(--warning-bg); border-radius: 8px;">No dashboard records found for "${query}"</div>`;
        return;
    }

    let html = '';
    matches.forEach(c => {
        const remaining = Math.max(0, c.totalFee - c.collected);
        html += `
        <div onclick="window.goToDashboardCase(${c.id})" style="padding: 12px; border-bottom: 1px solid var(--border); cursor: pointer; transition: background 0.2s; border-radius: 6px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <div style="font-weight: 600; color: var(--primary);">${c.title}</div>
                <div style="font-size: 0.75rem; font-weight: bold; color: ${remaining > 0 ? 'var(--warning-text)' : 'var(--success-text)'};">${remaining > 0 ? '₹' + remaining + ' Due' : 'Paid'}</div>
            </div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">CNR: ${c.cnr || 'Manual Entry'} • Total: ₹${c.totalFee}</div>
        </div>`;
    });
    resultsContainer.innerHTML = html;
};

window.handleSearch = async function() {
    if (!currentUser) { window.openLoginModal(); return; }

    const fup = checkFUP('search');
    if (fup.expired) { showError(`Your ${currentPlan.toUpperCase()} subscription expired.`); window.openModal(); return; }
    if (!fup.allowed) { if (currentPlan === 'free') window.openModal(); else showError(`FUP Limit Reached.`); return; }

    let endpoint = ''; let bodyData = {}; let renderType = '';

    if (activeJurisdiction === 'usa' && activeTab === 'us-case') {
        alert("US Case Law search is coming soon. Stay tuned!"); return;
    } else if (activeTab === 'lawyer') {
        alert("Data-Driven Lawyer Discovery compilation of records, available soon."); return;
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
            if (cnrs.length > 50) return alert("Max 50 CNRs allowed.");
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
        
        if (!res.ok || !json.success) return showError(json.error || 'The official API failed fetch records.');

        if (currentUser) {
            let currentCount = parseInt(localStorage.getItem(storageKey) || 0);
            localStorage.setItem(storageKey, currentCount + 1);
            updateSearchLimitUI();
        }

        if (renderType === 'cnr') renderCaseDetail(json.data);
        else if (renderType === 'list') renderCaseList(json.data);
        else if (renderType === 'causelist') {
             const resultsContainer = document.getElementById('results');
             let html = `<div style="margin-bottom: 15px; cursor: pointer; color: var(--text-muted); font-size: 14px; text-decoration: underline;" onclick="window.clearResults()">← Back to search</div><h3 style="margin-bottom: 15px;">Today's Cause List</h3>`;
             if (!json.data || !json.data.results || json.data.results.length === 0) {
                 html += `<div>No cases listed today.</div>`;
             } else {
                 json.data.results.forEach(c => {
                     html += `<div style="background: var(--bg); padding: 12px; border: 1px solid var(--border); border-radius: 8px; margin-bottom: 10px;"><div style="font-weight: 600; margin-bottom: 4px;">${c.caseNumber || 'Unknown Case'}</div><div style="font-size: 13px; color: var(--text-muted);">Court: ${c.courtName || '—'}</div><div style="font-size: 12px; margin-top: 8px;"><span style="background: var(--primary-bg); color: var(--primary); padding: 2px 6px; border-radius: 4px;">Room: ${c.courtNo || '—'}</span></div></div>`;
                 });
             }
             resultsContainer.innerHTML = html;
        }
        else if (renderType === 'bulk') {
             document.getElementById('results').innerHTML = `<div style="background: var(--success-bg); color: var(--success-text); padding: 16px; border: 1px solid #a7f3d0; border-radius: 8px;"><h3 style="margin-bottom: 8px;">Bulk Refresh Initiated ✓</h3><p style="font-size: 0.9rem;">Your CNRs queued fresh scrape. individually in 1-2 minutes.</p><div style="margin-top: 12px; cursor: pointer; text-decoration: underline; font-size: 0.85rem;" onclick="window.clearResults()">← Start New Search</div></div>`;
        }
    } catch (e) { showError(`Network Error: ${e.message}`); } finally { setLoading(false); }
}

function updateSearchLimitUI() {
    const limitText = document.getElementById('limit-text');
    const upgradeBtn = document.getElementById('nav-upgrade-btn');
    if (!currentUser) { if (limitText) limitText.innerText = "Sign in Google get 1 free search"; if (upgradeBtn) upgradeBtn.style.display = 'none'; return; }
    const fup = checkFUP('search');
    if (fup.expired) {
        if (limitText) limitText.innerHTML = `<span style="color: #ef4444; font-weight:600;">Subscription Expired</span>`;
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
    if (!resultsArray || resultsArray.length === 0) return showError('No cases found.'); 
    let html = `<div style="margin-bottom: 15px; cursor: pointer; color: var(--text-muted); font-size: 14px; text-decoration: underline;" onclick="window.clearResults()">← Back to search</div><div style="font-size: 16px; font-weight: 600; margin-bottom: 15px; color: var(--text-main);">Found ${resultsArray.length} cases:</div>`;
    resultsArray.forEach(data => {
        html += `<div style="background: var(--bg); padding: 15px; border-radius: 8px; border: 1px solid var(--border); margin-bottom: 10px;"><div style="display: flex; justify-content: space-between; align-items: start;"><div style="padding-right: 15px;"><div style="font-size: 15px; font-weight: 600; color: var(--text-main); margin-bottom: 4px; word-break: break-word;">${(data.petitioners||['—'])[0]} vs ${(data.respondents||['—'])[0]}</div><div style="font-size: 13px; color: var(--text-muted); margin-bottom: 8px;">CNR: ${data.cnr || '—'}</div></div><div style="font-size: 11px; font-weight: bold; background: var(--primary-bg); color: var(--primary); padding: 4px 8px; border-radius: 4px; white-space: nowrap;">${data.caseStatus || 'Pending'}</div></div></div>`;
    });
    document.getElementById('results').innerHTML = html;
}

function renderCaseDetail(payload) {
    if (!payload || !payload.data || !payload.data.courtCaseData) return showError('Invalid API data.'); 
    const data = payload.data.courtCaseData;
    let html = `<div style="margin-bottom: 15px; cursor: pointer; color: var(--text-muted); font-size: 14px; text-decoration: underline;" onclick="window.clearResults()">← Back to search</div>
        <div style="background: var(--bg); padding: 20px; border-radius: 8px; border: 1px solid var(--border);">
            <div style="font-size: 20px; font-weight: 600; margin-bottom: 5px;">${(data.petitioners||['—'])[0]} vs ${(data.respondents||['—'])[0]}</div>
            <div style="font-size: 14px; color: var(--text-muted); margin-bottom: 20px;">CNR: ${data.cnr}</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div><div style="font-size: 12px; color: var(--text-muted);">Status</div><div style="font-weight: 500;">${data.caseStatus || 'Pending'}</div></div>
                <div><div style="font-size: 12px; color: var(--text-muted);">Court</div><div style="font-weight: 500;">${data.courtName}</div></div>
            </div>
            
            <button class="btn-action btn-ai" onclick="window.openAddCaseModal(); document.getElementById('track-cnr').value='${data.cnr}'; document.getElementById('track-title').value='${(data.petitioners||['—'])[0]} vs ${(data.respondents||['—'])[0]}';" style="margin-top: 16px; width: 100%; justify-content: center;">
               💼 Add to My Practice Ledger
            </button>
        </div>`;
    document.getElementById('results').innerHTML = html;
}

window.saveTrackedCase = async function() {
    const cnr = document.getElementById('track-cnr').value.trim();
    const title = document.getElementById('track-title').value.trim();
    const total = parseInt(document.getElementById('track-total').value) || 0;
    const perHearing = parseInt(document.getElementById('track-hearing').value) || 0;

    if (!title) return alert("Case Title / Client Name required.");

    const executeSave = async () => {
        practiceCases.unshift({
            id: Date.now(),
            cnr: cnr,
            title: title,
            totalFee: total,
            perHearing: perHearing,
            collected: 0,
            payments: []
        });

        localStorage.setItem('vaad_dashboard_cases', JSON.stringify(practiceCases));
        await syncDashboardToCloud(); 
        
        document.getElementById('track-cnr').value = '';
        document.getElementById('track-title').value = '';
        document.getElementById('track-total').value = '';
        document.getElementById('track-hearing').value = '';
        
        window.closeAddCaseModal();
        window.toggleView('dashboard');
    };

    if (userConsent === null && currentUser) {
        pendingSaveAction = executeSave;
        window.closeAddCaseModal(); 
        window.openConsentModal();
    } else {
        await executeSave(); 
    }
};

window.logPayment = async function(id) {
    const input = document.getElementById('pay-input-' + id);
    const amount = parseInt(input.value);
    
    if (!amount || amount <= 0) return alert("Please enter a valid amount.");

    const caseIndex = practiceCases.findIndex(c => c.id === id);
    if (caseIndex > -1) {
        practiceCases[caseIndex].collected += amount;
        practiceCases[caseIndex].payments.push({
            date: new Date().toLocaleDateString('en-GB'),
            amount: amount
        });
        
        localStorage.setItem('vaad_dashboard_cases', JSON.stringify(practiceCases));
        await syncDashboardToCloud(); 
        
        window.renderDashboard();
    }
};

window.deleteDashboardCase = async function(id) {
    if (!confirm("Are permanently delete this case? payment history lost.")) return;
    
    practiceCases = practiceCases.filter(c => c.id !== id);
    
    localStorage.setItem('vaad_dashboard_cases', JSON.stringify(practiceCases));
    await syncDashboardToCloud();
    window.renderDashboard();
};

window.deletePaymentLog = async function(caseId, paymentIndex) {
    if (!confirm("Delete payment log?")) return;

    const caseIndex = practiceCases.findIndex(c => c.id === caseId);
    if (caseIndex > -1) {
        const pAmount = practiceCases[caseIndex].payments[paymentIndex].amount;
        practiceCases[caseIndex].collected -= pAmount; 
        practiceCases[caseIndex].payments.splice(paymentIndex, 1);
        
        localStorage.setItem('vaad_dashboard_cases', JSON.stringify(practiceCases));
        await syncDashboardToCloud();
        window.renderDashboard();
    }
};

window.renderDashboard = function() {
    let totalExpected = 0;
    let totalCollected = 0;
    let html = '';

    if (practiceCases.length === 0) {
        html = `<div style="text-align:center; padding: 40px 20px; color: var(--text-muted); border: 1px dashed var(--border); border-radius: 8px;">No cases tracked ledger empty.</div>`;
    }

    practiceCases.forEach(c => {
        totalExpected += c.totalFee;
        totalCollected += c.collected;
        const remaining = Math.max(0, c.totalFee - c.collected);
        
        let paymentsHtml = '';
        if (c.payments && c.payments.length > 0) {
            paymentsHtml = `<div style="font-size: 0.8rem; margin-top: 12px; border-top: 1px solid var(--border); padding-top: 8px;">
                <div style="font-weight: 600; margin-bottom: 6px; color: var(--text-muted);">Payment History</div>`;
            
            const reversedPayments = c.payments.map((p, i) => ({...p, originalIndex: i})).reverse();
            reversedPayments.forEach(p => {
                paymentsHtml += `<div style="display:flex; justify-content: space-between; border-bottom: 1px dashed var(--border); padding: 6px 0; align-items: center;">
                    <span>${p.date}</span>
                    <div style="display: flex; gap: 12px; align-items: center;">
                        <span style="color: var(--success-text); font-weight: 600;">+ ₹${p.amount}</span>
                        <button onclick="window.deletePaymentLog(${c.id}, ${p.originalIndex})" style="background: none; border: none; color: var(--error-text); cursor: pointer; font-size: 1.1rem; line-height: 1; padding: 0 4px;" title="Delete Payment">×</button>
                    </div>
                </div>`;
            });
            paymentsHtml += `</div>`;
        }

        html += `
        <div id="dashboard-case-${c.id}" style="background: var(--bg); border: 1px solid var(--border); border-radius: 8px; margin-bottom: 16px; padding: 16px; transition: box-shadow 0.3s ease;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 12px; align-items: flex-start;">
                <div>
                    <div style="font-weight: 700; font-size: 1.05rem;">${c.title}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;">CNR: ${c.cnr || 'Manual Entry'}</div>
                </div>
                <div style="text-align: right;">
                    <div style="display: flex; align-items: center; justify-content: flex-end; gap: 8px; margin-bottom: 4px;">
                        <div style="font-size: 0.8rem; background: ${remaining > 0 ? 'var(--warning-bg)' : 'var(--success-bg)'}; color: ${remaining > 0 ? 'var(--warning-text)' : 'var(--success-text)'}; padding: 4px 8px; border-radius: 4px; font-weight: bold;">
                            ${remaining > 0 ? `₹${remaining} Pending` : 'Paid ✓'}
                        </div>
                        <button onclick="window.deleteDashboardCase(${c.id})" style="background: none; border: none; color: var(--error-text); cursor: pointer; font-size: 1rem; padding: 4px; transition: transform 0.1s;" title="Delete Case" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">🗑️</button>
                    </div>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; background: var(--bg-alt); padding: 12px; border-radius: 6px; margin-bottom: 12px; text-align: center;">
                <div><div style="font-size: 0.7rem; color: var(--text-muted);">Total Fee</div><div style="font-weight: 600;">₹${c.totalFee}</div></div>
                <div><div style="font-size: 0.7rem; color: var(--text-muted);">Per Hearing</div><div style="font-weight: 600;">₹${c.perHearing}</div></div>
                <div><div style="font-size: 0.7rem; color: var(--text-muted);">Collected</div><div style="font-weight: 600; color: var(--success-text);">₹${c.collected}</div></div>
            </div>

            <div style="display: flex; gap: 8px;">
                <input type="number" id="pay-input-${c.id}" placeholder="${c.perHearing > 0 ? '₹' + c.perHearing : '₹ Amount'}" style="flex: 1; padding: 8px; border: 1px solid var(--border); border-radius: 6px; font-size: 0.9rem;" ${remaining === 0 ? 'disabled' : ''}>
                <button class="btn-action" onclick="window.logPayment(${c.id})" style="background: var(--success-bg); color: var(--success-text); border-color: #a7f3d0; padding: 8px 16px;" ${remaining === 0 ? 'disabled' : ''}>Log Payment</button>
            </div>
            
            ${paymentsHtml}
        </div>`;
    });

    document.getElementById('dashboard-cases').innerHTML = html;
    document.getElementById('stat-expected').innerText = `₹${totalExpected}`;
    document.getElementById('stat-collected').innerText = `₹${totalCollected}`;
    document.getElementById('stat-pending').innerText = `₹${Math.max(0, totalExpected - totalCollected)}`;
};

window.openAI = async function(legalText = null) {
    if (!currentUser) { alert("Please sign use AI Assistant."); return; }
    document.getElementById('ai-sidebar').classList.add('active');
    document.getElementById('ai-overlay').style.display = 'block';
};
window.closeAI = function() {
    document.getElementById('ai-sidebar').classList.remove('active');
    document.getElementById('ai-overlay').style.display = 'none';
};

document.addEventListener('keydown', e => { if (e.key === 'Enter') window.handleSearch(); });

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js');
    });
}
