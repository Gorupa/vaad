// js/main.js
import { GIS_CLIENT_ID, API_URL } from "./config.js";
import { state, resetStateOnLogout, updatePracticeCases } from "./state.js";
import { auth, db } from "./services/firebase.js";
import { onAuthStateChanged, signInWithCredential, signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signOut, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import * as ui from "./utils/ui.js";
import * as dashboardRenderer from "./renderers/dashboard.js";
import * as searchRenderer from "./renderers/search.js";
import { updateSearchLimitUI, checkFUP } from "./services/fup.js";
import { selectPlan } from "./services/payments.js";

// FIX 1: "import * * * searchRenderer" -> "import * as searchRenderer"
// FIX 2: Removed all self-referencing window.X = window.X no-ops
// FIX 3: Fixed window.closeGenericModalCloser (was wrongly mapped to openGenericModalCloser)

window.addEventListener('load', () => {
    if (typeof google !== 'undefined' && google.accounts) {
        google.accounts.id.initialize({
            client_id: GIS_CLIENT_ID,
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
        ui.closeLoginModal();
    } catch (error) {
        console.error("[Auth] Auth via Credential Manager failed:", error);
        ui.resetLoginButtons();
    }
}

onAuthStateChanged(auth, async (user) => {
    state.currentUser = user;
    const limitText = document.getElementById('limit-text');
    if (limitText) limitText.innerText = "Loading limits...";

    if (user) {
        setDisplay('login-btn', 'none');
        setDisplay('user-menu', 'flex');
        setInnerText('user-name', user.displayName ? user.displayName.split(' ')[0] : user.email.split('@')[0]);
        setAvatarSrc('user-avatar', user, 40);

        setDisplay('drawer-unauth', 'none');
        setDisplay('drawer-auth', 'flex');
        setInnerText('drawer-name', user.displayName || user.email.split('@')[0]);
        setAvatarSrc('drawer-avatar', user, 60);
        setDisplay('drawer-logout-btn', 'block');
        setDisplay('drawer-dashboard-btn', 'block');

        const badge = document.getElementById('user-badge');
        if (badge) { badge.innerText = "..."; badge.style.background = "gray"; }

        try {
            const userRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                const data = userSnap.data();
                const dbPlan = String(data.plan || 'free').toLowerCase().replace(/[^a-z]/g, '');
                state.currentPlan = ui.PLAN_LIMITS ? (ui.PLAN_LIMITS[dbPlan] ? dbPlan : 'free') : 'free';
                state.cycleStartDate = data.cycleStartDate || new Date().toISOString().split('T')[0];
                await syncPermissionUI();
                if (data.practiceCases) {
                    updatePracticeCases(data.practiceCases);
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
                state.currentPlan = 'free';
                state.cycleStartDate = today;
            }
        } catch (error) {
            console.error("Firebase read error:", error);
            state.currentPlan = 'free';
            state.cycleStartDate = new Date().toISOString().split('T')[0];
        }

        dashboardRenderer.renderDashboard();
    } else {
        setDisplay('login-btn', 'flex');
        setDisplay('user-menu', 'none');
        setDisplay('drawer-unauth', 'block');
        setDisplay('drawer-auth', 'none');
        setDisplay('menu-btn', 'block');
        setDisplay('drawer-logout-btn', 'none');
        setDisplay('drawer-dashboard-btn', 'none');
        resetStateOnLogout();
    }

    window.currentUserPlan = state.currentPlan;
    updateBadge();
    updateTabLocks();
    updateSearchLimitUI();
});

window.acceptConsent = async function() {
    localStorage.setItem('vaad_dpdp_consent', 'true');
    state.userConsent = 'true';
    ui.createGenericModalCloser('consent-modal')();
    if (state.pendingSaveAction) {
        await state.pendingSaveAction();
        state.pendingSaveAction = null;
    }
};

window.declineConsent = function() {
    localStorage.setItem('vaad_dpdp_consent', 'false');
    state.userConsent = 'false';
    ui.createGenericModalCloser('consent-modal')();
    state.pendingSaveAction = null;
};

window.toggleCloudSyncPermission = async function() {
    const toggleEl = document.getElementById('syncPermissionToggle');
    if (!toggleEl) return;
    const isChecked = toggleEl.checked;
    if (!state.currentUser) {
        alert("Please sign in to change permissions.");
        toggleEl.checked = !isChecked;
        return;
    }
    try {
        const userRef = doc(db, 'users', state.currentUser.uid);
        await setDoc(userRef, { permissions: { cloudSync: isChecked } }, { merge: true });
        state.syncPermission = isChecked;
        if (!isChecked) {
            if (confirm("Cloud Sync Revoked. Data remains locally on this device. Confirm?")) {
                alert("Permission revoked successfully.");
            } else {
                toggleEl.checked = true;
                await setDoc(userRef, { permissions: { cloudSync: true } }, { merge: true });
                state.syncPermission = true;
            }
        } else {
            alert("Secure Cloud Sync Enabled.");
            const { syncDashboardToCloud } = await import("./renderers/dashboard.js");
            await syncDashboardToCloud();
        }
    } catch (error) {
        console.error("[Permission] Error toggling permission:", error);
        alert("Network error. Check connection.");
        toggleEl.checked = !isChecked;
    }
};

async function syncPermissionUI() {
    if (!state.currentUser) return;
    try {
        const userSnap = await getDoc(doc(db, 'users', state.currentUser.uid));
        if (userSnap.exists()) {
            const data = userSnap.data();
            if (data.permissions && data.permissions.cloudSync !== undefined) {
                state.syncPermission = data.permissions.cloudSync;
                const toggleEl = document.getElementById('syncPermissionToggle');
                if (toggleEl) toggleEl.checked = state.syncPermission;
            }
        }
    } catch (e) {
        console.error("Error syncing permission UI:", e);
    }
}

window.openUniversalSearch = function() {
    if (!state.currentUser) { alert("Please sign in to search your practice dashboard."); ui.openUpgradeModal(); return; }
    const modal = document.getElementById('universal-search-modal');
    if (!modal) return;
    modal.classList.add('active');
    modal.style.display = '';
    setTimeout(() => { const input = document.getElementById('uni-search-input'); if (input) input.focus(); }, 100);
};

window.closeUniversalSearch = function() {
    const modal = document.getElementById('universal-search-modal');
    if (!modal) return;
    modal.classList.remove('active');
    const input = document.getElementById('uni-search-input');
    if (input) input.value = '';
    const results = document.getElementById('uni-search-results');
    if (results) results.innerHTML = '<div style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:20px;">Type to search...</div>';
};

window.runUniversalSearch = function() {
    const query = document.getElementById('uni-search-input').value.toLowerCase().trim();
    const resultsContainer = document.getElementById('uni-search-results');
    if (!resultsContainer) return;
    if (!query) {
        resultsContainer.innerHTML = '<div style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:20px;">Type to search...</div>';
        return;
    }
    const matches = state.practiceCases.filter(c =>
        c.title.toLowerCase().includes(query) ||
        (c.cnr && c.cnr.toLowerCase().includes(query)) ||
        c.totalFee.toString().includes(query)
    );
    if (matches.length === 0) {
        resultsContainer.innerHTML = '<div style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:20px;">No records found for "' + query + '"</div>';
        return;
    }
    let html = '';
    matches.forEach(c => {
        const remaining = Math.max(0, c.totalFee - c.collected);
        html += '<div onclick="window.goToDashboardCase(' + c.id + ')" style="padding:12px; border:1px solid var(--border); border-radius:8px; margin-bottom:8px; cursor:pointer;">';
        html += '<div style="display:flex; justify-content:space-between; align-items:center;">';
        html += '<div style="font-weight:600; color:var(--primary);">' + c.title + '</div>';
        html += '<div style="font-size:0.75rem; font-weight:bold; color:' + (remaining > 0 ? 'var(--warning-text)' : 'var(--success-text)') + ';">' + (remaining > 0 ? '\u20b9' + remaining + ' Due' : 'Paid') + '</div></div>';
        html += '<div style="font-size:0.8rem; color:var(--text-muted);">CNR: ' + (c.cnr || 'Manual Entry') + ' \u2022 Total: \u20b9' + c.totalFee + '</div></div>';
    });
    resultsContainer.innerHTML = html;
};

window.toggleView = function(viewName) {
    const searchView = document.getElementById('view-search');
    const dashboardView = document.getElementById('view-dashboard');
    if (!searchView || !dashboardView) return;
    if (viewName === 'dashboard') {
        if (!state.currentUser) { alert("Please sign in to access the dashboard."); ui.openUpgradeModal(); return; }
        searchView.style.display = 'none';
        dashboardView.style.display = 'block';
        setDisplay('menu-btn', 'block');
        dashboardRenderer.renderDashboard();
    } else {
        dashboardView.style.display = 'none';
        searchView.style.display = 'block';
        setDisplay('menu-btn', 'block');
    }
};

window.switchJurisdiction = function(country) {
    state.activeJurisdiction = country;
    const indianTabs = document.querySelectorAll('.indian-tab');
    const indianPanels = document.querySelectorAll('.indian-panel');
    const usTabs = document.querySelectorAll('.us-tab');
    const usPanels = document.querySelectorAll('.us-panel');
    if (country === 'usa') {
        indianTabs.forEach(el => el.style.display = 'none');
        indianPanels.forEach(el => el.style.display = 'none');
        usTabs.forEach(el => el.style.display = 'block');
        ui.switchTab('us-case');
    } else {
        indianTabs.forEach(el => el.style.display = 'block');
        usTabs.forEach(el => el.style.display = 'none');
        usPanels.forEach(el => el.style.display = 'none');
        ui.switchTab('cnr');
    }
    ui.clearResults();
};

window.handleSearch = async function() {
    if (!state.currentUser) { ui.openLoginModal(); return; }
    const fup = checkFUP('search');
    if (fup.expired) { ui.showError('Your ' + state.currentPlan.toUpperCase() + ' subscription expired.'); window.openModal(); return; }
    if (!fup.allowed) { if (state.currentPlan === 'free') window.openModal(); else ui.showError('FUP Limit Reached.'); return; }

    let endpoint = '', bodyData = {}, renderType = '';

    if (state.activeJurisdiction === 'usa' && state.activeTab === 'us-case') {
        alert("US Case Law search is coming soon."); return;
    } else if (state.activeTab === 'lawyer') {
        alert("Available soon."); return;
    } else if (state.activeTab === 'cnr') {
        const modeInput = document.querySelector('input[name="cnr-mode"]:checked');
        const mode = modeInput ? modeInput.value : 'single';
        if (mode === 'single') {
            const query = document.getElementById('cnr-input').value.trim();
            if (!query) return;
            endpoint = API_URL + '/cnr'; bodyData = { cnr: query }; renderType = 'cnr';
        } else {
            const bulkText = document.getElementById('cnr-bulk-input').value.trim();
            if (!bulkText) return;
            const cnrs = bulkText.split('\n').map(c => c.trim()).filter(c => c.length > 5);
            if (cnrs.length > 50) return alert("Max 50 CNRs allowed.");
            endpoint = API_URL + '/bulk-refresh'; bodyData = { cnrs }; renderType = 'bulk';
        }
    } else if (state.activeTab === 'causelist') {
        const stateEl = document.getElementById('causelist-state');
        const queryEl = document.getElementById('causelist-query');
        if (!stateEl || !queryEl) return;
        const stateVal = stateEl.value.trim().toUpperCase();
        const queryVal = queryEl.value.trim();
        if (!stateVal || !queryVal) return alert("Provide State Code and Query.");
        endpoint = API_URL + '/causelist'; bodyData = { query: queryVal, state: stateVal, limit: 20 }; renderType = 'causelist';
    } else {
        let query = '';
        if (state.activeTab === 'litigant') query = (document.getElementById('litigant-input') || {}).value || '';
        if (state.activeTab === 'advocate') query = (document.getElementById('advocate-input') || {}).value || '';
        if (state.activeTab === 'judge') query = (document.getElementById('judge-input') || {}).value || '';
        query = query.trim();
        if (!query) return;
        endpoint = API_URL + '/search'; bodyData = { query, type: state.activeTab }; renderType = 'list';
    }

    await performSearch(endpoint, bodyData, fup.storageKey, renderType);
};

async function performSearch(endpoint, bodyData, storageKey, renderType) {
    ui.setLoading(true); ui.clearResults();
    try {
        const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bodyData) });
        const json = await res.json();
        if (!res.ok || !json.success) return ui.showError(json.error || 'The official API failed to fetch records.');

        if (state.currentUser) {
            let currentCount = parseInt(localStorage.getItem(storageKey) || 0);
            localStorage.setItem(storageKey, currentCount + 1);
            updateSearchLimitUI();
        }

        if (renderType === 'cnr') searchRenderer.renderCaseDetail(json.data);
        else if (renderType === 'list') searchRenderer.renderCaseList(json.data);
        else if (renderType === 'causelist') {
            const rc = document.getElementById('results');
            let html = '<div style="margin-bottom:15px; cursor:pointer; color:var(--text-muted); font-size:14px; text-decoration:underline;" onclick="window.clearResults()">\u2190 Back to search</div><h3 style="margin-bottom:15px;">Today\'s Cause List</h3>';
            if (!json.data || !json.data.results || json.data.results.length === 0) {
                html += '<div>No cases listed today.</div>';
            } else {
                json.data.results.forEach(c => {
                    html += '<div style="background:var(--bg); padding:12px; border:1px solid var(--border); border-radius:8px; margin-bottom:10px;"><div style="font-weight:600; margin-bottom:4px;">' + (c.caseNumber || 'Unknown Case') + '</div><div style="font-size:13px; color:var(--text-muted);">Court: ' + (c.courtName || '\u2014') + '</div><div style="font-size:12px; margin-top:8px;"><span style="background:var(--primary-bg); color:var(--primary); padding:2px 6px; border-radius:4px;">Room: ' + (c.courtNo || '\u2014') + '</span></div></div>';
                });
            }
            rc.innerHTML = html;
        } else if (renderType === 'bulk') {
            document.getElementById('results').innerHTML = '<div style="background:var(--success-bg); color:var(--success-text); padding:16px; border:1px solid #a7f3d0; border-radius:8px;"><h3 style="margin-bottom:8px;">Bulk Refresh Initiated \u2713</h3><p style="font-size:0.9rem;">Your CNRs queued... in 1-2 minutes.</p><div style="margin-top:12px; cursor:pointer; text-decoration:underline; font-size:0.85rem;" onclick="window.clearResults()">\u2190 Start New Search</div></div>';
        }
    } catch (e) { ui.showError('Network Error: ' + e.message); } finally { ui.setLoading(false); }
}

function setDisplay(id, style) { const el = document.getElementById(id); if (el) el.style.display = style; }
function setInnerText(id, text) { const el = document.getElementById(id); if (el) el.innerText = text; }
function setAvatarSrc(id, user, size) {
    const el = document.getElementById(id);
    if (el) el.src = user.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.displayName || user.email) + '&background=random&size=' + size;
}

function updateBadge() {
    const badge = document.getElementById('user-badge');
    const drawerBadge = document.getElementById('drawer-badge');
    if (!badge) return;
    const fup = checkFUP('search');
    let badgeText, badgeBg, badgeColor;
    if (fup.expired) { badgeText = "EXPIRED"; badgeBg = "#ef4444"; badgeColor = "white"; }
    else if (state.currentPlan === 'supreme') { badgeText = "SUPREME"; badgeBg = "#8b5cf6"; badgeColor = "white"; }
    else if (state.currentPlan === 'promax') { badgeText = "PRO MAX"; badgeBg = "#d4af37"; badgeColor = "black"; }
    else if (state.currentPlan === 'pro') { badgeText = "PRO"; badgeBg = "var(--primary)"; badgeColor = "white"; }
    else { badgeText = "FREE"; badgeBg = "var(--border)"; badgeColor = "var(--text-muted)"; }
    badge.innerText = badgeText; badge.style.background = badgeBg; badge.style.color = badgeColor;
    if (drawerBadge) { drawerBadge.innerText = badgeText; drawerBadge.style.background = badgeBg; drawerBadge.style.color = badgeColor; }
}

function updateTabLocks() {
    const locks = document.querySelectorAll('.tab:not(#tab-cnr):not(#tab-lawyer):not(#tab-us-case) .lock-icon');
    const hasPaidPlan = state.currentPlan === 'supreme' || state.currentPlan === 'promax' || state.currentPlan === 'pro';
    if (hasPaidPlan) {
        locks.forEach(icon => icon.style.display = 'none');
    } else {
        locks.forEach(icon => icon.style.display = 'inline');
        const requiresLock = state.activeTab !== 'cnr' && state.activeTab !== 'us-case' && state.activeTab !== 'lawyer';
        if (requiresLock) ui.switchTab('cnr');
    }
}

// --- Window Bindings ---
window.clearResults = ui.clearResults;
window.switchTab = ui.switchTab;
window.toggleMenu = ui.toggleMenu;
window.toggleCnrMode = ui.toggleCnrMode;
window.selectPlan = selectPlan;
window.saveTrackedCase = dashboardRenderer.saveTrackedCase;
window.logPayment = dashboardRenderer.logPayment;
window.deleteDashboardCase = dashboardRenderer.deleteDashboardCase;
window.deletePaymentLog = dashboardRenderer.deletePaymentLog;
window.renderDashboard = dashboardRenderer.renderDashboard;
window.openLoginModal = ui.openLoginModal;
window.closeLoginModal = ui.closeLoginModal;
window.openModal = ui.openUpgradeModal;
window.closeModal = ui.closeUpgradeModal;
window.openDevModal = ui.createGenericModalOpener('dev-modal');
window.closeDevModal = ui.createGenericModalCloser('dev-modal');
window.openWhatsNewModal = ui.createGenericModalOpener('whats-new-modal');
window.closeWhatsNewModal = ui.createGenericModalCloser('whats-new-modal');
window.openFaqModal = ui.createGenericModalOpener('faq-modal');
window.closeFaqModal = ui.createGenericModalCloser('faq-modal');
window.openAddCaseModal = ui.createGenericModalOpener('add-case-modal');
window.closeAddCaseModal = ui.createGenericModalCloser('add-case-modal');
window.openConsentModal = ui.createGenericModalOpener('consent-modal');
window.closeConsentModal = ui.createGenericModalCloser('consent-modal');

// --- Global Click Listener ---
document.addEventListener('click', async (e) => {
    const logoutTarget = e.target.closest('#logout-btn') || e.target.closest('#drawer-logout-btn');
    if (logoutTarget) {
        if (e.target.closest('#drawer-logout-btn')) ui.toggleMenu();
        signOut(auth).then(() => { window.location.reload(); });
        return;
    }

    const emailLoginBtn = e.target.closest('#email-login-btn');
    if (emailLoginBtn) {
        const email = document.getElementById('auth-email').value.trim();
        const password = document.getElementById('auth-password').value;
        const errorDiv = document.getElementById('auth-error');
        if (!errorDiv) return;
        if (!email || !password) { errorDiv.innerText = "Please enter both email and password."; errorDiv.style.display = "block"; return; }
        emailLoginBtn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-color:white;border-top-color:transparent;margin-right:8px;display:inline-block;"></div> Connecting...';
        emailLoginBtn.disabled = true; errorDiv.style.display = "none";
        try {
            await signInWithEmailAndPassword(auth, email, password);
            ui.closeLoginModal();
        } catch (error) {
            if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
                try {
                    await createUserWithEmailAndPassword(auth, email, password);
                    ui.closeLoginModal();
                } catch (registerError) {
                    errorDiv.innerText = registerError.code === 'auth/email-already-in-use' ? "Email registered to Google. Try 'Continue with Google'." : registerError.message;
                    errorDiv.style.display = "block"; ui.resetLoginButtons();
                }
            } else {
                errorDiv.innerText = error.message; errorDiv.style.display = "block"; ui.resetLoginButtons();
            }
        }
        return;
    }

    const googleLoginBtn = e.target.closest('#google-login-btn');
    if (googleLoginBtn) {
        googleLoginBtn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-color:var(--text-muted);border-top-color:transparent;margin-right:8px;display:inline-block;"></div> Connecting...';
        googleLoginBtn.disabled = true;
        const executePopup = async () => {
            try { await signInWithPopup(auth, new GoogleAuthProvider()); ui.closeLoginModal(); }
            catch (err) { console.error(err); ui.resetLoginButtons(); }
        };
        try {
            document.cookie = "g_state=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
            if (typeof google === 'undefined' || !google.accounts) { await executePopup(); return; }
            google.accounts.id.prompt(async (n) => {
                if (n.isDismissedMoment() || n.isSkippedMoment() || n.isNotDisplayed()) await executePopup();
            });
        } catch (e) { await executePopup(); }
    }
});

document.addEventListener('keydown', e => { if (e.key === 'Enter') window.handleSearch(); });

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js'); });
}
