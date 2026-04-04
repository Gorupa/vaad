// ═══════════════════════════════════════════════════════════════
//  VAAD — THE DHARMA UPDATE v2.1
//  Self-contained monolith main.js
//  Loaded as: <script type="module" src="js/main.js">
// ═══════════════════════════════════════════════════════════════

window.onerror = function(msg, url, line) {
    console.error('Script Error: ' + msg + ' (Line ' + line + ')');
};

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth, signInWithCredential, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// ── Firebase Init ──────────────────────────────────────────────
const firebaseConfig = {
    apiKey:            'AIzaSyCW0rBn8YLGfYqdkj3DCn2RPUeYirIpreU',
    authDomain:        'vaad-87fed.firebaseapp.com',
    projectId:         'vaad-87fed',
    storageBucket:     'vaad-87fed.firebasestorage.app',
    messagingSenderId: '649989985981',
    appId:             '1:649989985981:web:6dcbcdd0babd45f2cb09d4',
    measurementId:     'G-36J186LSR4'
};

const app      = initializeApp(firebaseConfig);
const auth     = getAuth(app);
const provider = new GoogleAuthProvider();
const db       = getFirestore(app);

// ── Google Identity Services Init ─────────────────────────────
window.addEventListener('load', () => {
    if (typeof google !== 'undefined' && google.accounts) {
        google.accounts.id.initialize({
            client_id:            '649989985981-u00i42pgr5taercoj5koqabm5aul58k0.apps.googleusercontent.com',
            callback:             handleCredentialResponse,
            use_fedcm_for_prompt: true
        });
        console.log('[Auth] Google Credential Manager Initialized.');
    } else {
        console.error('[Auth] Google API script not found.');
    }
});

async function handleCredentialResponse(response) {
    try {
        const credential = GoogleAuthProvider.credential(response.credential);
        await signInWithCredential(auth, credential);
        window.closeLoginModal();
    } catch (error) {
        console.error('[Auth] Credential Manager failed:', error);
        resetLoginButtons();
    }
}

// ── App State ──────────────────────────────────────────────────
const API = 'https://vaad-wnul.onrender.com/api';

let currentUser    = null;
let currentPlan    = 'free';
let cycleStartDate = null;
let activeTab      = 'cnr';
let activeJurisdiction = 'india';
let syncPermission = true;

let practiceCases    = JSON.parse(localStorage.getItem('vaad_dashboard_cases')) || [];
let userConsent      = localStorage.getItem('vaad_dpdp_consent');
let pendingSaveAction = null;

const limits = {
    free:    { search: 1,   pdf: 0  },
    pro:     { search: 30,  pdf: 0  },
    promax:  { search: 100, pdf: 0  },
    supreme: { search: 150, pdf: 30 }
};

// ══════════════════════════════════════════════════════════════
//  AUTH
// ══════════════════════════════════════════════════════════════

window.openLoginModal = function() {
    document.getElementById('login-modal').classList.add('active');
    document.getElementById('login-modal').style.display = 'flex';
};

window.closeLoginModal = function() {
    document.getElementById('login-modal').classList.remove('active');
    document.getElementById('login-modal').style.display = 'none';
    const e = document.getElementById('auth-error');
    if (e) e.style.display = 'none';
    const em = document.getElementById('auth-email');
    if (em) em.value = '';
    const pw = document.getElementById('auth-password');
    if (pw) pw.value = '';
    resetLoginButtons();
};

function resetLoginButtons() {
    const emailBtn  = document.getElementById('email-login-btn');
    const googleBtn = document.getElementById('google-login-btn');
    if (emailBtn) {
        emailBtn.innerText = 'Sign In / Register';
        emailBtn.disabled  = false;
    }
    if (googleBtn) {
        googleBtn.innerHTML = `<img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" style="width:20px;margin-right:10px;" alt="G"> Continue with Google`;
        googleBtn.disabled  = false;
    }
}

// Global click — login buttons + logout
document.addEventListener('click', async (e) => {
    const logoutTarget   = e.target.closest('#logout-btn') || e.target.closest('#drawer-logout-btn');
    const emailLoginBtn  = e.target.closest('#email-login-btn');
    const googleLoginBtn = e.target.closest('#google-login-btn');

    // Email / Password
    if (emailLoginBtn) {
        const email    = document.getElementById('auth-email').value.trim();
        const password = document.getElementById('auth-password').value;
        const errorDiv = document.getElementById('auth-error');
        if (!email || !password) {
            errorDiv.innerText = 'Please enter both email and password.';
            errorDiv.style.display = 'block';
            return;
        }
        emailLoginBtn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-color:white;border-top-color:transparent;margin-right:8px;display:inline-block;"></div> Connecting...';
        emailLoginBtn.disabled  = true;
        errorDiv.style.display  = 'none';
        try {
            await signInWithEmailAndPassword(auth, email, password);
            window.closeLoginModal();
        } catch (error) {
            if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
                try {
                    await createUserWithEmailAndPassword(auth, email, password);
                    window.closeLoginModal();
                } catch (regErr) {
                    errorDiv.innerText = regErr.code === 'auth/email-already-in-use'
                        ? "This email is linked to a Google account. Try 'Continue with Google'."
                        : 'Error: ' + regErr.message.replace('Firebase: ', '');
                    errorDiv.style.display = 'block';
                    resetLoginButtons();
                }
            } else {
                errorDiv.innerText = 'Error: ' + error.message.replace('Firebase: ', '');
                errorDiv.style.display = 'block';
                resetLoginButtons();
            }
        }
        return;
    }

    // Google Sign In
    if (googleLoginBtn) {
        googleLoginBtn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-color:var(--text-muted);border-top-color:transparent;margin-right:8px;display:inline-block;"></div> Connecting...';
        googleLoginBtn.disabled  = true;
        const executePopup = async () => {
            try {
                await signInWithPopup(auth, provider);
                window.closeLoginModal();
            } catch (err) {
                console.error('Popup error:', err);
                resetLoginButtons();
            }
        };
        try {
            document.cookie = 'g_state=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
            if (typeof google === 'undefined' || !google.accounts) { await executePopup(); return; }
            google.accounts.id.prompt(async (n) => {
                if (n.isDismissedMoment() || n.isSkippedMoment() || n.isNotDisplayed()) await executePopup();
            });
        } catch (err) { await executePopup(); }
    }

    // Logout
    if (logoutTarget) {
        if (e.target.closest('#drawer-logout-btn')) window.toggleMenu();
        signOut(auth).then(() => window.location.reload());
    }
});

// ── Auth State Observer ────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    const limitText = document.getElementById('limit-text');
    if (limitText) limitText.innerText = 'Loading limits...';

    if (user) {
        const avatarUrl   = user.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.displayName || user.email) + '&background=1a3a8a&color=fff';
        const displayName = user.displayName ? user.displayName.split(' ')[0] : user.email.split('@')[0];

        const set = (id, prop, val) => { const el = document.getElementById(id); if (el) el[prop] = val; };
        const setStyle = (id, prop, val) => { const el = document.getElementById(id); if (el) el.style[prop] = val; };

        setStyle('login-btn', 'display', 'none');
        setStyle('user-menu', 'display', 'flex');
        set('user-name', 'innerText', displayName);
        set('user-avatar', 'src', avatarUrl);
        setStyle('drawer-unauth', 'display', 'none');

        const drawerAuth = document.getElementById('drawer-auth');
        if (drawerAuth) drawerAuth.style.display = 'flex';
        set('drawer-name', 'innerText', user.displayName || user.email.split('@')[0]);
        set('drawer-avatar', 'src', avatarUrl);
        setStyle('drawer-logout-btn', 'display', 'block');
        setStyle('drawer-dashboard-btn', 'display', 'block');

        const badge = document.getElementById('user-badge');
        if (badge) { badge.innerText = '...'; badge.style.background = 'gray'; }

        try {
            const userRef  = doc(db, 'users', user.uid);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                const data   = userSnap.data();
                const dbPlan = String(data.plan || 'free').toLowerCase().replace(/[^a-z]/g, '');
                currentPlan    = limits[dbPlan] ? dbPlan : 'free';
                cycleStartDate = data.cycleStartDate || new Date().toISOString().split('T')[0];
                await syncPermissionUI();
                if (data.practiceCases) {
                    practiceCases = data.practiceCases;
                    localStorage.setItem('vaad_dashboard_cases', JSON.stringify(practiceCases));
                    console.log('[Cloud Sync] Dashboard loaded from Firestore.');
                }
            } else {
                const today = new Date().toISOString().split('T')[0];
                await setDoc(userRef, {
                    name:           user.displayName || user.email.split('@')[0],
                    email:          user.email,
                    plan:           'free',
                    cycleStartDate: today,
                    searchCount:    0,
                    joinedAt:       new Date().toISOString(),
                    practiceCases:  [],
                    permissions:    { cloudSync: true }
                });
                currentPlan    = 'free';
                cycleStartDate = today;
            }
        } catch (error) {
            console.error('Firebase read error:', error);
            currentPlan    = 'free';
            cycleStartDate = new Date().toISOString().split('T')[0];
        }

        window.renderDashboard();

    } else {
        const setStyle = (id, prop, val) => { const el = document.getElementById(id); if (el) el.style[prop] = val; };
        setStyle('login-btn',          'display', 'flex');
        setStyle('user-menu',          'display', 'none');
        setStyle('drawer-unauth',      'display', 'block');
        setStyle('drawer-logout-btn',  'display', 'none');
        setStyle('drawer-dashboard-btn','display','none');
        setStyle('menu-btn',           'display', 'block');
        const da = document.getElementById('drawer-auth');
        if (da) da.style.display = 'none';

        currentPlan    = 'free';
        cycleStartDate = null;
        practiceCases  = [];
        localStorage.removeItem('vaad_dashboard_cases');
    }

    window.currentUserPlan = currentPlan;
    updateBadge();
    updateTabLocks();
    updateSearchLimitUI();
});

// ── Cloud Sync ─────────────────────────────────────────────────
async function syncDashboardToCloud() {
    if (!currentUser)           return;
    if (userConsent !== 'true') return;
    if (!syncPermission)        return;
    try {
        await updateDoc(doc(db, 'users', currentUser.uid), { practiceCases });
        console.log('[Cloud Sync] Dashboard saved.');
    } catch (err) {
        console.error('Cloud sync error:', err);
    }
}

async function syncPermissionUI() {
    if (!currentUser) return;
    try {
        const snap = await getDoc(doc(db, 'users', currentUser.uid));
        if (snap.exists()) {
            const data = snap.data();
            if (data.permissions && data.permissions.cloudSync !== undefined) {
                syncPermission = data.permissions.cloudSync;
                const toggle = document.getElementById('syncPermissionToggle');
                if (toggle) toggle.checked = syncPermission;
            }
        }
    } catch (e) { console.error('syncPermissionUI error:', e); }
}

window.toggleCloudSyncPermission = async function() {
    const toggle = document.getElementById('syncPermissionToggle');
    if (!toggle) return;
    const isChecked = toggle.checked;
    if (!currentUser) {
        alert('Please sign in to change permissions.');
        toggle.checked = !isChecked;
        return;
    }
    try {
        const userRef = doc(db, 'users', currentUser.uid);
        await setDoc(userRef, { permissions: { cloudSync: isChecked } }, { merge: true });
        syncPermission = isChecked;
        if (!isChecked) {
            if (confirm("Cloud Sync disabled. Data stays local until you log out. Confirm?")) {
                alert('Permission revoked.');
            } else {
                toggle.checked = true;
                await setDoc(userRef, { permissions: { cloudSync: true } }, { merge: true });
                syncPermission = true;
            }
        } else {
            alert('Secure Cloud Sync Enabled.');
            await syncDashboardToCloud();
        }
    } catch (err) {
        console.error('[Permissions] toggle error:', err);
        alert('Network error. Check connection.');
        toggle.checked = !isChecked;
    }
};

// ══════════════════════════════════════════════════════════════
//  FUP — CLIENT SIDE (for badge/modal display only)
//  Actual enforcement is server-side via Firebase Admin
// ══════════════════════════════════════════════════════════════

function checkFUP(actionType) {
    if (!currentUser) return { allowed: false, used: 0, limit: 0, remaining: 0, storageKey: null, expired: false, daysLeft: 0 };
    if (!currentPlan || !limits[currentPlan]) currentPlan = 'free';

    const cycleStart = new Date(cycleStartDate || new Date().toISOString().split('T')[0]);
    cycleStart.setHours(0, 0, 0, 0);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((today - cycleStart) / (1000 * 60 * 60 * 24));

    const isExpired = currentPlan !== 'free' && diffDays >= 30;
    const daysLeft  = currentPlan !== 'free' ? Math.max(0, 30 - diffDays) : 0;
    const limit     = (limits[currentPlan] || limits.free)[actionType] || 0;

    return { expired: isExpired, daysLeft, limit };
}

// Reads live searchCount from Firestore for accurate display
async function updateSearchLimitUI() {
    const limitText  = document.getElementById('limit-text');
    const upgradeBtn = document.getElementById('nav-upgrade-btn');

    if (!currentUser) {
        if (limitText)  limitText.innerText = 'Sign in to get your free search';
        if (upgradeBtn) upgradeBtn.style.display = 'none';
        return;
    }

    if (limitText) limitText.innerHTML = `<span style="color:var(--text-subtle);font-weight:600;">Loading...</span>`;

    try {
        const snap  = await getDoc(doc(db, 'users', currentUser.uid));
        const data  = snap.exists() ? snap.data() : {};
        const used  = data.searchCount || 0;
        const plan  = currentPlan || 'free';
        const limit = (limits[plan] || limits.free).search;
        const rem   = Math.max(0, limit - used);

        const cycleStart = cycleStartDate ? new Date(cycleStartDate) : new Date();
        const diffDays   = Math.floor((new Date() - cycleStart) / (1000 * 60 * 60 * 24));
        const isExpired  = plan !== 'free' && diffDays >= 30;
        const daysLeft   = plan !== 'free' ? Math.max(0, 30 - diffDays) : 0;

        if (isExpired) {
            if (limitText)  limitText.innerHTML = `<span style="color:#ef4444;font-weight:600;">Subscription Expired</span>`;
            if (upgradeBtn) { upgradeBtn.style.display = 'inline-block'; upgradeBtn.innerText = '⚡ Renew'; upgradeBtn.onclick = () => window.openModal(); }
            return;
        }

        const daysText = plan !== 'free' ? `(${daysLeft}d left) · ` : '';
        const color    = plan === 'supreme' ? '#8b5cf6' : 'var(--primary)';
        if (limitText) limitText.innerHTML = `<span style="color:${color};font-weight:600;">${plan.toUpperCase()} ${daysText}${rem}/${limit} Searches</span>`;

        if (plan === 'supreme') {
            if (upgradeBtn) upgradeBtn.style.display = 'none';
        } else {
            if (upgradeBtn) { upgradeBtn.style.display = 'inline-block'; upgradeBtn.innerText = '⚡ Upgrade'; upgradeBtn.onclick = () => window.openModal(); }
        }
    } catch (e) {
        console.error('updateSearchLimitUI error:', e);
        if (limitText) limitText.innerHTML = `<span style="color:var(--primary);font-weight:600;">${(currentPlan || 'free').toUpperCase()} Plan</span>`;
    }
}

// ══════════════════════════════════════════════════════════════
//  BADGE & TAB LOCKS
// ══════════════════════════════════════════════════════════════

function updateBadge() {
    const badge       = document.getElementById('user-badge');
    const drawerBadge = document.getElementById('drawer-badge');
    if (!badge) return;

    const fup = checkFUP('search');
    let text, bg, color;

    if (fup.expired) {
        text = 'EXPIRED'; bg = '#ef4444'; color = 'white';
    } else if (currentPlan === 'supreme') {
        text = 'SUPREME'; bg = '#1a3a8a'; color = 'white';
    } else if (currentPlan === 'promax') {
        text = 'PRO MAX'; bg = '#9c6b1e'; color = 'white';
    } else if (currentPlan === 'pro') {
        text = 'PRO'; bg = 'var(--primary)'; color = 'white';
    } else {
        text = 'FREE'; bg = 'var(--border)'; color = 'var(--text-muted)';
    }

    badge.innerText = text; badge.style.background = bg; badge.style.color = color;
    if (drawerBadge) { drawerBadge.innerText = text; drawerBadge.style.background = bg; drawerBadge.style.color = color; }
}

function updateTabLocks() {
    const locks   = document.querySelectorAll('.tab:not(#tab-cnr):not(#tab-lawyer):not(#tab-us-case) .lock-icon');
    const hasPaid = ['pro', 'promax', 'supreme'].includes(currentPlan);
    if (hasPaid) {
        locks.forEach(icon => icon.style.display = 'none');
    } else {
        locks.forEach(icon => icon.style.display = 'inline');
        if (!['cnr', 'us-case', 'lawyer'].includes(activeTab)) window.switchTab('cnr');
    }
}

// ══════════════════════════════════════════════════════════════
//  NAVIGATION & VIEWS
// ══════════════════════════════════════════════════════════════

window.toggleMenu = function() {
    document.getElementById('side-drawer').classList.toggle('open');
    document.getElementById('drawer-overlay').classList.toggle('open');
};

window.toggleView = function(viewName) {
    const searchView    = document.getElementById('view-search');
    const dashboardView = document.getElementById('view-dashboard');
    if (!searchView || !dashboardView) return;

    if (viewName === 'dashboard') {
        if (!currentUser) { alert('Please sign in to access the dashboard.'); window.openModal(); return; }
        searchView.style.display    = 'none';
        dashboardView.style.display = 'block';
        const mb = document.getElementById('menu-btn');
        if (mb) mb.style.display = 'block';
        window.renderDashboard();
    } else {
        dashboardView.style.display = 'none';
        searchView.style.display    = 'block';
        const mb = document.getElementById('menu-btn');
        if (mb) mb.style.display = 'block';
    }
};

window.switchJurisdiction = function(country) {
    activeJurisdiction = country;
    const indianTabs   = document.querySelectorAll('.indian-tab');
    const indianPanels = document.querySelectorAll('.indian-panel');
    const usTabs       = document.querySelectorAll('.us-tab');
    const usPanels     = document.querySelectorAll('.us-panel');

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
    const panel = document.getElementById('panel-' + tab);
    if (panel) panel.style.display = 'block';
    window.clearResults();
};

window.toggleCnrMode = function() {
    if (currentPlan === 'free') {
        alert('Bulk CNR refresh requires a Paid Plan.');
        const r = document.querySelector('input[name="cnr-mode"][value="single"]');
        if (r) r.checked = true;
        window.openModal(); return;
    }
    const modeInput = document.querySelector('input[name="cnr-mode"]:checked');
    const mode = modeInput ? modeInput.value : 'single';
    const sf = document.getElementById('cnr-single-field');
    const bf = document.getElementById('cnr-bulk-field');
    if (sf) sf.style.display = mode === 'single' ? 'block' : 'none';
    if (bf) bf.style.display = mode === 'bulk'   ? 'block' : 'none';
};

// ══════════════════════════════════════════════════════════════
//  MODALS
// ══════════════════════════════════════════════════════════════

function openGenericModal(id)  { const m = document.getElementById(id); if (m) { m.classList.add('active'); m.style.display = ''; } }
function closeGenericModal(id) { const m = document.getElementById(id); if (m) m.classList.remove('active'); }

window.openDevModal      = () => openGenericModal('dev-modal');
window.closeDevModal     = () => closeGenericModal('dev-modal');
window.openWhatsNewModal = () => openGenericModal('whats-new-modal');
window.closeWhatsNewModal= () => closeGenericModal('whats-new-modal');
window.openFaqModal      = () => openGenericModal('faq-modal');
window.closeFaqModal     = () => closeGenericModal('faq-modal');
window.openAddCaseModal  = () => openGenericModal('add-case-modal');
window.closeAddCaseModal = () => closeGenericModal('add-case-modal');
window.openConsentModal  = () => openGenericModal('consent-modal');
window.closeConsentModal = () => closeGenericModal('consent-modal');

window.openModal = function() {
    const modal = document.getElementById('upgrade-modal');
    if (!modal) return;
    modal.style.display = '';

    if (!currentUser) {
        ['pro-card','promax-card','supreme-card'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'block'; });
        window.selectPlan('pro');
        modal.classList.add('active');
        return;
    }

    const fup = checkFUP('search');
    if (currentPlan === 'supreme' && !fup.expired) return;

    if (fup.expired) {
        window.selectPlan(currentPlan === 'free' ? 'pro' : currentPlan);
    } else {
        const show = (id, vis) => { const el = document.getElementById(id); if (el) el.style.display = vis; };
        show('pro-card',     currentPlan === 'free'                          ? 'block' : 'none');
        show('promax-card',  currentPlan === 'free' || currentPlan === 'pro' ? 'block' : 'none');
        show('supreme-card', 'block');
        if (currentPlan === 'free')    window.selectPlan('pro');
        else if (currentPlan === 'pro') window.selectPlan('promax');
        else                            window.selectPlan('supreme');
    }
    modal.classList.add('active');
};

window.closeModal = () => closeGenericModal('upgrade-modal');

window.acceptConsent = async function() {
    localStorage.setItem('vaad_dpdp_consent', 'true');
    userConsent = 'true';
    window.closeConsentModal();
    if (pendingSaveAction) { await pendingSaveAction(); pendingSaveAction = null; }
    else                   { await syncDashboardToCloud(); }
};

window.declineConsent = async function() {
    localStorage.setItem('vaad_dpdp_consent', 'false');
    userConsent = 'false';
    window.closeConsentModal();
    if (pendingSaveAction) { await pendingSaveAction(); pendingSaveAction = null; }
};

// ══════════════════════════════════════════════════════════════
//  PAYMENTS (Order-based flow — triggers webhook)
// ══════════════════════════════════════════════════════════════

window.selectPlan = function(planType) {
    document.querySelectorAll('.pricing-card').forEach(c => c.style.border = '2px solid var(--border-soft)');
    let amount = 99;
    if (planType === 'pro')     { const c = document.getElementById('pro-card');    if (c) c.style.border = '2px solid var(--primary)';    amount = 99;  }
    if (planType === 'promax')  { const c = document.getElementById('promax-card'); if (c) c.style.border = '2px solid var(--gold-light)'; amount = 199; }
    if (planType === 'supreme') { const c = document.getElementById('supreme-card');if (c) c.style.border = '2px solid var(--primary)';    amount = 399; }

    const btn = document.getElementById('upi-btn-link');
    if (btn) {
        btn.removeAttribute('href');
        btn.innerText = `Pay ₹${amount} Securely`;
        btn.onclick = (e) => {
            e.preventDefault();
            btn.innerText = 'Opening Checkout...';
            window.payWithRazorpay(planType, amount);
        };
    }
};

window.payWithRazorpay = async function(planType, amountInINR) {
    if (!currentUser) {
        alert('Please sign in before upgrading.');
        window.closeModal();
        window.openLoginModal();
        return;
    }

    const btn = document.getElementById('upi-btn-link');

    try {
        if (btn) btn.innerText = 'Creating order...';

        // Step 1: Create verified order on backend
        const orderRes  = await fetch(`${API}/initiate-payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ userId: currentUser.uid, plan: planType, amount: amountInINR })
        });
        const orderData = await orderRes.json();

        if (!orderRes.ok || !orderData.success) {
            alert('Could not initiate payment: ' + (orderData.error || 'Server error.'));
            if (btn) btn.innerText = `Pay ₹${amountInINR} Securely`;
            return;
        }

        const order = orderData.data.order;

        // Step 2: Open Razorpay with order_id — webhook fires on success
        const options = {
            key:         'rzp_live_SYzqjL2QNwMNDE',
            amount:      order.amount,
            currency:    order.currency,
            order_id:    order.id,
            name:        'Vaad',
            description: `Upgrade to Vaad ${planType.toUpperCase()}`,
            image:       'https://vaad.pages.dev/icon-192.png',
            handler: function(response) {
                if (btn) btn.innerText = 'Payment Successful! Upgrading...';
                setTimeout(() => window.location.reload(), 3000);
            },
            prefill: { name: currentUser.displayName || '', email: currentUser.email || '' },
            notes:   { userId: currentUser.uid, planName: planType },
            theme:   { color: '#1a3a8a' },
            modal:   { ondismiss: () => { if (btn) btn.innerText = `Pay ₹${amountInINR} Securely`; } }
        };

        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', (r) => {
            alert(`Payment Failed: ${r.error.description}`);
            if (btn) btn.innerText = `Pay ₹${amountInINR} Securely`;
        });
        rzp.open();

    } catch (err) {
        console.error('[Payment] Error:', err);
        alert('Network error. Please try again.');
        if (btn) btn.innerText = `Pay ₹${amountInINR} Securely`;
    }
};

// ══════════════════════════════════════════════════════════════
//  UNIVERSAL SEARCH
// ══════════════════════════════════════════════════════════════

window.openUniversalSearch = function() {
    if (!currentUser) { alert('Please sign in to search your dashboard.'); window.openModal(); return; }
    const modal = document.getElementById('universal-search-modal');
    if (!modal) return;
    modal.classList.add('active');
    modal.style.display = '';
    setTimeout(() => { const i = document.getElementById('uni-search-input'); if (i) i.focus(); }, 100);
};

window.closeUniversalSearch = function() {
    const modal = document.getElementById('universal-search-modal');
    if (modal) modal.classList.remove('active');
    const i = document.getElementById('uni-search-input');
    const r = document.getElementById('uni-search-results');
    if (i) i.value = '';
    if (r) r.innerHTML = '<div style="text-align:center;color:var(--text-subtle);font-size:0.85rem;padding:24px;">Type to search your Practice Dashboard…</div>';
};

window.runUniversalSearch = function() {
    const query = document.getElementById('uni-search-input').value.toLowerCase().trim();
    const rc    = document.getElementById('uni-search-results');
    if (!rc) return;

    if (!query) {
        rc.innerHTML = '<div style="text-align:center;color:var(--text-subtle);font-size:0.85rem;padding:24px;">Type to search your Practice Dashboard…</div>';
        return;
    }

    const matches = practiceCases.filter(c =>
        c.title.toLowerCase().includes(query) ||
        (c.cnr && c.cnr.toLowerCase().includes(query)) ||
        c.totalFee.toString().includes(query)
    );

    if (matches.length === 0) {
        rc.innerHTML = `<div style="text-align:center;padding:20px;background:var(--warning-bg);color:var(--warning-text);border-radius:var(--radius);font-size:0.87rem;">No records found for "${query}"</div>`;
        return;
    }

    let html = '';
    matches.forEach(c => {
        const rem = Math.max(0, c.totalFee - c.collected);
        html += `
        <div onclick="window.goToDashboardCase(${c.id})" style="padding:12px 4px;border-bottom:1px solid var(--border-soft);cursor:pointer;border-radius:var(--radius-sm);">
            <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                <div style="font-weight:700;font-size:0.9rem;color:var(--primary);">${c.title}</div>
                <div style="font-size:0.75rem;font-weight:700;color:${rem > 0 ? 'var(--warning-text)' : 'var(--success-text)'};">${rem > 0 ? '₹' + rem + ' Due' : 'Paid ✓'}</div>
            </div>
            <div style="font-size:0.78rem;color:var(--text-muted);">CNR: ${c.cnr || 'Manual Entry'} · Total: ₹${c.totalFee}</div>
        </div>`;
    });
    rc.innerHTML = html;
};

window.goToDashboardCase = function(id) {
    window.closeUniversalSearch();
    window.toggleView('dashboard');
    setTimeout(() => {
        const el = document.getElementById('dashboard-case-' + id);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 200);
};

// ══════════════════════════════════════════════════════════════
//  SEARCH — injects userId for server-side FUP enforcement
// ══════════════════════════════════════════════════════════════

window.handleSearch = async function() {
    if (!currentUser) { window.openLoginModal(); return; }

    let endpoint = '', bodyData = {}, renderType = '';

    if (activeJurisdiction === 'usa' && activeTab === 'us-case') {
        alert('US Case Law search is coming soon!'); return;
    } else if (activeTab === 'lawyer') {
        alert('Lawyer Discovery is coming soon.'); return;
    } else if (activeTab === 'cnr') {
        const modeInput = document.querySelector('input[name="cnr-mode"]:checked');
        const mode = modeInput ? modeInput.value : 'single';
        if (mode === 'single') {
            const query = document.getElementById('cnr-input').value.trim();
            if (!query) return;
            endpoint   = `${API}/cnr`;
            bodyData   = { userId: currentUser.uid, cnr: query };
            renderType = 'cnr';
        } else {
            const bulkText = document.getElementById('cnr-bulk-input').value.trim();
            if (!bulkText) return;
            const cnrs = bulkText.split('\n').map(c => c.trim()).filter(c => c.length > 5);
            if (cnrs.length > 50) return alert('Max 50 CNRs allowed.');
            endpoint   = `${API}/bulk-refresh`;
            bodyData   = { userId: currentUser.uid, cnrs };
            renderType = 'bulk';
        }
    } else if (activeTab === 'causelist') {
        const stateEl = document.getElementById('causelist-state');
        const queryEl = document.getElementById('causelist-query');
        if (!stateEl || !queryEl) return;
        const stateVal = stateEl.value.trim().toUpperCase();
        const queryVal = queryEl.value.trim();
        if (!stateVal || !queryVal) return alert('Provide State Code and Name.');
        endpoint   = `${API}/causelist`;
        bodyData   = { userId: currentUser.uid, query: queryVal, state: stateVal, limit: 20 };
        renderType = 'causelist';
    } else {
        let query = '';
        const litigantEl = document.getElementById('litigant-input');
        const advocateEl = document.getElementById('advocate-input');
        const judgeEl    = document.getElementById('judge-input');
        if (activeTab === 'litigant' && litigantEl) query = litigantEl.value.trim();
        if (activeTab === 'advocate' && advocateEl) query = advocateEl.value.trim();
        if (activeTab === 'judge'    && judgeEl)    query = judgeEl.value.trim();
        if (!query) return;
        endpoint   = `${API}/search`;
        bodyData   = { userId: currentUser.uid, query, type: activeTab };
        renderType = 'list';
    }

    await performSearch(endpoint, bodyData, renderType);
};

async function performSearch(endpoint, bodyData, renderType) {
    setLoading(true);
    window.clearResults();
    try {
        const res  = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bodyData) });
        const json = await res.json();

        // Server-side FUP responses
        if (res.status === 403) { showError(json.error || 'Search limit reached. Please upgrade your plan.'); window.openModal(); return; }
        if (res.status === 401) { showError('Please sign in to search.'); window.openLoginModal(); return; }
        if (!res.ok || !json.success) return showError(json.error || 'The official API failed to fetch records.');

        // Refresh limit display (server already incremented Firestore count)
        updateSearchLimitUI();

        if      (renderType === 'cnr')  renderCaseDetail(json.data);
        else if (renderType === 'list') renderCaseList(json.data);
        else if (renderType === 'causelist') {
            const rc = document.getElementById('results');
            let html = `<button class="back-link" onclick="window.clearResults()">← New Search</button>
                <div style="font-family:'DM Serif Display',serif;font-size:1.2rem;color:var(--text-main);margin-bottom:16px;">Today's Cause List</div>`;
            if (!json.data?.results?.length) {
                html += `<div class="empty-state"><div class="empty-state-icon">📅</div><div class="empty-state-text">No cases listed for today.</div></div>`;
            } else {
                json.data.results.forEach((c, i) => {
                    html += `
                    <div class="case-card" style="animation-delay:${i * 0.04}s;">
                        <div class="case-card-header">
                            <div style="flex:1;">
                                <div class="case-court-name">${c.courtName || 'Court'}</div>
                                <div class="case-parties">${c.caseNumber || 'Unknown Case'}</div>
                            </div>
                            <span class="case-meta-chip" style="background:var(--primary-bg);color:var(--primary);">Room ${c.courtNo || '—'}</span>
                        </div>
                    </div>`;
                });
            }
            rc.innerHTML = html;
        }
        else if (renderType === 'bulk') {
            document.getElementById('results').innerHTML = `
            <div style="background:var(--success-bg);color:var(--success-text);padding:20px;border:1px solid var(--success-border);border-radius:var(--radius-lg);animation:fadeIn 0.3s ease;">
                <div style="font-weight:700;font-size:1rem;margin-bottom:6px;">✓ Bulk Refresh Initiated</div>
                <p style="font-size:0.88rem;opacity:0.85;">Your CNRs are queued. Check individually in 1–2 minutes.</p>
                <button class="back-link" onclick="window.clearResults()" style="margin-top:12px;">← Start New Search</button>
            </div>`;
        }
    } catch (e) {
        showError(`Network Error: ${e.message}`);
    } finally {
        setLoading(false);
    }
}

// ══════════════════════════════════════════════════════════════
//  UTILITY FUNCTIONS
// ══════════════════════════════════════════════════════════════

window.clearResults = function() {
    const el = document.getElementById('results');
    if (el) el.innerHTML = '';
};

function showError(message) {
    const el = document.getElementById('results');
    if (el) el.innerHTML = `
    <div style="background:var(--error-bg);color:var(--error-text);padding:16px 18px;border-radius:var(--radius-lg);border:1px solid var(--error-border);font-size:0.88rem;display:flex;align-items:flex-start;gap:10px;animation:fadeIn 0.2s ease;">
        <span style="flex-shrink:0;font-size:1rem;">⚠️</span>
        <span>${message}</span>
    </div>`;
}

function setLoading(on) {
    const btn = document.getElementById('search-btn');
    if (!btn) return;
    btn.disabled  = on;
    btn.innerHTML = on
        ? '<div class="spinner"></div><span>Fetching…</span>'
        : '<span id="btn-text">Search Cases</span>';
}

window.openAI = function() {
    if (!currentUser) { alert('Please sign in to use the AI Assistant.'); return; }
    document.getElementById('ai-sidebar').classList.add('active');
    document.getElementById('ai-overlay').style.display = 'block';
};
window.closeAI = function() {
    document.getElementById('ai-sidebar').classList.remove('active');
    document.getElementById('ai-overlay').style.display = 'none';
};

// ══════════════════════════════════════════════════════════════
//  RENDERING — Case List (M3 Cards)
// ══════════════════════════════════════════════════════════════

function renderCaseList(resultsArray) {
    if (!resultsArray || resultsArray.length === 0) return showError('No cases found for your search.');

    let html = `
    <button class="back-link" onclick="window.clearResults()">← New Search</button>
    <div style="font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:0.09em;color:var(--text-subtle);margin-bottom:14px;">${resultsArray.length} case${resultsArray.length !== 1 ? 's' : ''} found</div>`;

    resultsArray.forEach((data, i) => {
        const petitioner  = (data.petitioners || ['—'])[0];
        const respondent  = (data.respondents  || ['—'])[0];
        const status      = data.caseStatus || 'Pending';
        const isDisposed  = /dispos|decided/i.test(status);

        html += `
        <div class="case-card" style="animation-delay:${i * 0.05}s;">
            <div class="case-card-header">
                <div style="flex:1;min-width:0;">
                    <div class="case-court-name">${data.courtName || 'Indian Court'}</div>
                    <div class="case-parties">${petitioner} <span style="color:var(--text-subtle);font-weight:400;">vs</span> ${respondent}</div>
                </div>
                <span class="case-status-pill ${isDisposed ? 'status-disposed' : 'status-pending'}">${status}</span>
            </div>
            <div class="case-meta">
                <span class="case-meta-chip">CNR: ${data.cnr || '—'}</span>
                ${data.caseType   ? `<span class="case-meta-chip">${data.caseType}</span>` : ''}
                ${data.filingDate ? `<span class="case-meta-chip">Filed: ${data.filingDate}</span>` : ''}
            </div>
        </div>`;
    });

    document.getElementById('results').innerHTML = html;
}

// ══════════════════════════════════════════════════════════════
//  RENDERING — Case Detail (Document Vault)
// ══════════════════════════════════════════════════════════════

function renderCaseDetail(payload) {
    if (!payload || !payload.data || !payload.data.courtCaseData) return showError('Invalid API response. Please try again.');

    const data       = payload.data.courtCaseData;
    const petitioner = (data.petitioners || ['—'])[0];
    const respondent = (data.respondents || ['—'])[0];
    const title      = `${petitioner} vs ${respondent}`;
    const status     = data.caseStatus || 'Pending';
    const isDisposed = /dispos|decided/i.test(status);

    // Orders / Document Vault
    const orders = data.orders || data.orderDetails || [];
    let ordersHtml = '';
    if (orders.length > 0) {
        ordersHtml = `<div class="orders-section-title">📁 Orders & Judgments</div>`;
        orders.forEach(order => {
            const date     = order.orderDate || order.date     || '—';
            const filename = order.orderDoc  || order.filename || order.file || 'document.pdf';
            ordersHtml += `
            <div class="order-item">
                <div class="order-doc-icon">📄</div>
                <div class="order-meta">
                    <div class="order-date">${date}</div>
                    <div class="order-filename">${filename}</div>
                </div>
                <button class="order-download-btn"
                    onclick="window.downloadOrder('${data.cnr || ''}','${filename}')">
                    ↓ PDF
                </button>
            </div>`;
        });
    }

    // Hearing History
    const hearings = data.hearings || data.caseHistory || [];
    let hearingsHtml = '';
    if (hearings.length > 0) {
        hearingsHtml = `<div class="orders-section-title" style="margin-top:18px;">📅 Hearing History</div>`;
        hearings.slice(0, 5).forEach(h => {
            hearingsHtml += `
            <div style="display:flex;justify-content:space-between;padding:9px 12px;background:var(--bg-alt);border-radius:var(--radius);margin-bottom:6px;font-size:0.82rem;">
                <span style="color:var(--text-muted);font-weight:500;">${h.hearingDate || h.date || '—'}</span>
                <span style="color:var(--text-main);font-weight:600;max-width:60%;text-align:right;">${h.purposeOfHearing || h.purpose || h.nextHearingPurpose || '—'}</span>
            </div>`;
        });
    }

    // Next Hearing Banner
    const nextDate = data.nextHearingDate || data.nextHearing || null;
    const nextHtml = nextDate ? `
    <div style="display:flex;align-items:center;gap:10px;background:var(--gold-bg);border:1px solid var(--gold-border);border-radius:var(--radius);padding:12px 14px;margin-bottom:14px;">
        <span style="font-size:1.1rem;">📆</span>
        <div>
            <div style="font-size:0.65rem;font-weight:800;text-transform:uppercase;letter-spacing:0.09em;color:var(--gold);">Next Hearing</div>
            <div style="font-weight:700;font-size:0.92rem;color:var(--text-main);">${nextDate}</div>
        </div>
    </div>` : '';

    // Escaped title for onclick attribute
    const escapedTitle = title.replace(/'/g, "\\'");
    const escapedCnr   = (data.cnr || '').replace(/'/g, "\\'");

    const html = `
    <button class="back-link" onclick="window.clearResults()">← Back to Results</button>

    <div class="case-detail-card">
        <div class="case-detail-header">
            <div class="case-detail-court">${data.courtName || 'Indian Court'}</div>
            <div class="case-detail-title">${title}</div>
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                <span class="case-detail-cnr">${data.cnr || '—'}</span>
                <span class="case-status-pill ${isDisposed ? 'status-disposed' : 'status-pending'}">${status}</span>
            </div>
        </div>

        <div class="case-info-grid">
            <div class="case-info-cell">
                <div class="case-info-label">Case Type</div>
                <div class="case-info-value">${data.caseType || '—'}</div>
            </div>
            <div class="case-info-cell">
                <div class="case-info-label">Filing Date</div>
                <div class="case-info-value">${data.filingDate || data.dateOfFiling || '—'}</div>
            </div>
            <div class="case-info-cell">
                <div class="case-info-label">Petitioner</div>
                <div class="case-info-value">${petitioner}</div>
            </div>
            <div class="case-info-cell">
                <div class="case-info-label">Respondent</div>
                <div class="case-info-value">${respondent}</div>
            </div>
        </div>

        <div class="case-detail-body">
            ${nextHtml}
            ${ordersHtml}
            ${hearingsHtml}
            <button class="add-ledger-btn"
                onclick="window.openAddCaseModal(); document.getElementById('track-cnr').value='${escapedCnr}'; document.getElementById('track-title').value='${escapedTitle}';">
                💼 Add to Practice Ledger
            </button>
        </div>
    </div>`;

    document.getElementById('results').innerHTML = html;
}

// ── PDF Download (Pro Max / Supreme only) ─────────────────────
window.downloadOrder = async function(cnr, filename) {
    if (!currentUser) { window.openLoginModal(); return; }
    if (currentPlan !== 'supreme' && currentPlan !== 'promax') {
        window.openModal(); return;
    }

    // Find the clicked button via event
    const btn = event && event.currentTarget ? event.currentTarget : null;
    const origHTML = btn ? btn.innerHTML : '';
    if (btn) { btn.innerHTML = '<div class="spinner" style="width:12px;height:12px;border-width:2px;"></div>'; btn.disabled = true; }

    try {
        const res = await fetch(`${API}/download`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ cnr, filename })
        });
        if (!res.ok) { alert('Could not download this order. Please try again.'); return; }
        const blob = await res.blob();
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
    } catch (e) {
        alert('Network error. Check your connection.');
    } finally {
        if (btn) { btn.innerHTML = origHTML; btn.disabled = false; }
    }
};

// ══════════════════════════════════════════════════════════════
//  RENDERING — Dashboard (M3 Fee Ledger Cards)
// ══════════════════════════════════════════════════════════════

window.renderDashboard = function() {
    let totalExpected  = 0;
    let totalCollected = 0;
    let html           = '';

    const container = document.getElementById('dashboard-cases');
    if (!container) return;

    if (practiceCases.length === 0) {
        container.innerHTML = `
        <div class="empty-state">
            <div class="empty-state-icon">💼</div>
            <div class="empty-state-text">Your ledger is empty.<br>Add your first case to begin tracking.</div>
        </div>`;
        const s = (id, v) => { const el = document.getElementById(id); if (el) el.innerText = v; };
        s('stat-expected', '₹0'); s('stat-collected', '₹0'); s('stat-pending', '₹0');
        return;
    }

    practiceCases.forEach(c => {
        totalExpected  += c.totalFee;
        totalCollected += c.collected;
        const remaining = Math.max(0, c.totalFee - c.collected);

        // Payment history rows
        let historyHtml = '';
        if (c.payments && c.payments.length > 0) {
            const reversed = c.payments.map((p, i) => ({ ...p, originalIndex: i })).reverse();
            historyHtml = `
            <div class="payment-history">
                <div class="payment-history-title">Payment Log</div>
                ${reversed.map(p => `
                <div class="payment-row">
                    <span class="payment-date">${p.date}</span>
                    <span class="payment-amount">+ ₹${p.amount}</span>
                    <button class="payment-delete" onclick="window.deletePaymentLog(${c.id},${p.originalIndex})" title="Delete">×</button>
                </div>`).join('')}
            </div>`;
        }

        html += `
        <div class="dash-case-card" id="dashboard-case-${c.id}">
            <div class="dash-case-header">
                <div style="flex:1;min-width:0;">
                    <div class="dash-case-title">${c.title}</div>
                    <div class="dash-case-cnr">${c.cnr ? 'CNR: ' + c.cnr : 'Manual Entry'}</div>
                </div>
                <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
                    <span class="dash-pending-pill ${remaining > 0 ? 'status-pending' : 'status-disposed'}">
                        ${remaining > 0 ? '₹' + remaining + ' Due' : 'Paid ✓'}
                    </span>
                    <button class="dash-delete-btn" onclick="window.deleteDashboardCase(${c.id})" title="Delete Case">🗑️</button>
                </div>
            </div>

            <div class="dash-stats-row">
                <div class="dash-stat-cell">
                    <div class="dash-stat-label">Total Fee</div>
                    <div class="dash-stat-val">₹${c.totalFee}</div>
                </div>
                <div class="dash-stat-cell">
                    <div class="dash-stat-label">Per Hearing</div>
                    <div class="dash-stat-val">₹${c.perHearing}</div>
                </div>
                <div class="dash-stat-cell">
                    <div class="dash-stat-label">Collected</div>
                    <div class="dash-stat-val" style="color:var(--success-text);">₹${c.collected}</div>
                </div>
            </div>

            <div class="dash-payment-row">
                <input type="number" id="pay-input-${c.id}" class="dash-payment-input"
                    placeholder="${c.perHearing > 0 ? '₹' + c.perHearing : '₹ Amount'}"
                    ${remaining === 0 ? 'disabled' : ''}>
                <button class="dash-log-btn" onclick="window.logPayment(${c.id})" ${remaining === 0 ? 'disabled' : ''}>
                    Log Payment
                </button>
            </div>

            ${historyHtml}
        </div>`;
    });

    container.innerHTML = html;

    const s = (id, v) => { const el = document.getElementById(id); if (el) el.innerText = v; };
    s('stat-expected',  '₹' + totalExpected);
    s('stat-collected', '₹' + totalCollected);
    s('stat-pending',   '₹' + Math.max(0, totalExpected - totalCollected));
};

// ══════════════════════════════════════════════════════════════
//  DASHBOARD CRUD
// ══════════════════════════════════════════════════════════════

window.saveTrackedCase = async function() {
    const cnr        = document.getElementById('track-cnr').value.trim();
    const title      = document.getElementById('track-title').value.trim();
    const total      = parseInt(document.getElementById('track-total').value)   || 0;
    const perHearing = parseInt(document.getElementById('track-hearing').value) || 0;

    if (!title) return alert('Case Title / Client Name required.');

    const executeSave = async () => {
        practiceCases.unshift({
            id: Date.now(), cnr, title,
            totalFee: total, perHearing, collected: 0, payments: []
        });
        localStorage.setItem('vaad_dashboard_cases', JSON.stringify(practiceCases));
        await syncDashboardToCloud();

        ['track-cnr','track-title','track-total','track-hearing'].forEach(id => {
            const el = document.getElementById(id); if (el) el.value = '';
        });
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
    const input  = document.getElementById('pay-input-' + id);
    const amount = parseInt(input ? input.value : 0);
    if (!amount || amount <= 0) return alert('Please enter a valid amount.');

    const idx = practiceCases.findIndex(c => c.id === id);
    if (idx > -1) {
        practiceCases[idx].collected += amount;
        practiceCases[idx].payments.push({ date: new Date().toLocaleDateString('en-GB'), amount });
        localStorage.setItem('vaad_dashboard_cases', JSON.stringify(practiceCases));
        await syncDashboardToCloud();
        window.renderDashboard();
    }
};

window.deleteDashboardCase = async function(id) {
    if (!confirm('Permanently delete this case? Payment history will be lost.')) return;
    practiceCases = practiceCases.filter(c => c.id !== id);
    localStorage.setItem('vaad_dashboard_cases', JSON.stringify(practiceCases));
    await syncDashboardToCloud();
    window.renderDashboard();
};

window.deletePaymentLog = async function(caseId, paymentIndex) {
    if (!confirm('Delete this payment log entry?')) return;
    const idx = practiceCases.findIndex(c => c.id === caseId);
    if (idx > -1) {
        practiceCases[idx].collected -= practiceCases[idx].payments[paymentIndex].amount;
        practiceCases[idx].payments.splice(paymentIndex, 1);
        localStorage.setItem('vaad_dashboard_cases', JSON.stringify(practiceCases));
        await syncDashboardToCloud();
        window.renderDashboard();
    }
};

// ══════════════════════════════════════════════════════════════
//  GLOBAL LISTENERS & SERVICE WORKER
// ══════════════════════════════════════════════════════════════

document.addEventListener('keydown', e => { if (e.key === 'Enter') window.handleSearch(); });

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));
}
