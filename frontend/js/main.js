// js/main.js
// Pure orchestrator: imports, auth observer, click/keydown listeners, window bindings.
// No feature logic lives here.

import { GIS_CLIENT_ID } from './config.js';
import { state, resetStateOnLogout, updatePracticeCases } from './state.js';
import { auth, db } from './services/firebase.js';
import {
    onAuthStateChanged, signInWithCredential, signInWithPopup, GoogleAuthProvider,
    signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

import * as ui from './utils/ui.js';
import { updateSearchLimitUI } from './services/fup.js';
import { selectPlan, payWithRazorpay } from './services/payments.js';
import {
    renderDashboard, syncDashboardToCloud,
    saveTrackedCase, logPayment, deleteDashboardCase, deletePaymentLog
} from './renderers/dashboard.js';
import { handleSearch } from './renderers/search.js';

// ─── Google Identity Services Init ───────────────────────────
window.addEventListener('load', () => {
    if (typeof google !== 'undefined' && google.accounts) {
        google.accounts.id.initialize({
            client_id: GIS_CLIENT_ID,
            callback:  handleCredentialResponse,
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
        ui.closeLoginModal();
    } catch (error) {
        console.error('[Auth] Credential Manager failed:', error);
        ui.resetLoginButtons();
    }
}

// ─── Auth State Observer ──────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
    state.currentUser = user;
    const limitText = document.getElementById('limit-text');
    if (limitText) limitText.innerText = 'Loading limits...';

    if (user) {
        // Nav UI
        const loginBtn      = document.getElementById('login-btn');
        const userMenu      = document.getElementById('user-menu');
        const userName      = document.getElementById('user-name');
        const userAvatar    = document.getElementById('user-avatar');
        const drawerUnauth  = document.getElementById('drawer-unauth');
        const drawerAuth    = document.getElementById('drawer-auth');
        const drawerName    = document.getElementById('drawer-name');
        const drawerAvatar  = document.getElementById('drawer-avatar');
        const drawerLogout  = document.getElementById('drawer-logout-btn');
        const drawerDash    = document.getElementById('drawer-dashboard-btn');
        const badge         = document.getElementById('user-badge');
        const avatarUrl     = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || user.email)}&background=random`;
        const displayName   = user.displayName ? user.displayName.split(' ')[0] : user.email.split('@')[0];

        if (loginBtn)     loginBtn.style.display    = 'none';
        if (userMenu)     userMenu.style.display     = 'flex';
        if (userName)     userName.innerText         = displayName;
        if (userAvatar)   userAvatar.src             = avatarUrl;
        if (drawerUnauth) drawerUnauth.style.display = 'none';
        if (drawerAuth)   { drawerAuth.style.display = 'flex'; }
        if (drawerName)   drawerName.innerText       = user.displayName || user.email.split('@')[0];
        if (drawerAvatar) drawerAvatar.src           = avatarUrl;
        if (drawerLogout) drawerLogout.style.display = 'block';
        if (drawerDash)   drawerDash.style.display   = 'block';
        if (badge)        { badge.innerText = '...'; badge.style.background = 'gray'; }

        // Load user data from Firestore
        try {
            const userRef  = doc(db, 'users', user.uid);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                const data   = userSnap.data();
                const dbPlan = String(data.plan || 'free').toLowerCase().replace(/[^a-z]/g, '');
                state.currentPlan    = ['free','pro','promax','supreme'].includes(dbPlan) ? dbPlan : 'free';
                state.cycleStartDate = data.cycleStartDate || new Date().toISOString().split('T')[0];

                await syncPermissionUI();

                if (data.practiceCases) {
                    updatePracticeCases(data.practiceCases);
                    console.log('[Cloud Sync] Dashboard loaded from Firestore.');
                }
            } else {
                // New user — create document
                const today = new Date().toISOString().split('T')[0];
                await setDoc(userRef, {
                    name:          user.displayName || user.email.split('@')[0],
                    email:         user.email,
                    plan:          'free',
                    cycleStartDate: today,
                    searchCount:   0,
                    joinedAt:      new Date().toISOString(),
                    practiceCases: [],
                    permissions:   { cloudSync: true }
                });
                state.currentPlan    = 'free';
                state.cycleStartDate = today;
            }
        } catch (error) {
            console.error('[Auth] Firebase read error:', error);
            state.currentPlan    = 'free';
            state.cycleStartDate = new Date().toISOString().split('T')[0];
        }

        renderDashboard();

    } else {
        // Guest nav UI
        const loginBtn     = document.getElementById('login-btn');
        const userMenu     = document.getElementById('user-menu');
        const drawerUnauth = document.getElementById('drawer-unauth');
        const drawerAuth   = document.getElementById('drawer-auth');
        const menuBtn      = document.getElementById('menu-btn');
        const drawerLogout = document.getElementById('drawer-logout-btn');
        const drawerDash   = document.getElementById('drawer-dashboard-btn');

        if (loginBtn)     loginBtn.style.display     = 'flex';
        if (userMenu)     userMenu.style.display      = 'none';
        if (drawerUnauth) drawerUnauth.style.display  = 'block';
        if (drawerAuth)   drawerAuth.style.display    = 'none';
        if (menuBtn)      menuBtn.style.display       = 'block';
        if (drawerLogout) drawerLogout.style.display  = 'none';
        if (drawerDash)   drawerDash.style.display    = 'none';

        resetStateOnLogout();
    }

    ui.updateBadge();
    ui.updateTabLocks();
    await updateSearchLimitUI();
});

// ─── Helpers (private, called only from this file) ───────────
async function syncPermissionUI() {
    if (!state.currentUser) return;
    try {
        const userSnap = await getDoc(doc(db, 'users', state.currentUser.uid));
        if (userSnap.exists()) {
            const data = userSnap.data();
            if (data.permissions?.cloudSync !== undefined) {
                state.syncPermission = data.permissions.cloudSync;
                const toggleEl = document.getElementById('syncPermissionToggle');
                if (toggleEl) toggleEl.checked = state.syncPermission;
            }
        }
    } catch (e) {
        console.error('[Permissions] syncPermissionUI error:', e);
    }
}

// ─── Consent Handlers ─────────────────────────────────────────
window.acceptConsent = async function() {
    localStorage.setItem('vaad_dpdp_consent', 'true');
    state.userConsent = 'true';
    ui.createGenericModalCloser('consent-modal')();
    if (state.pendingSaveAction) {
        await state.pendingSaveAction();
        state.pendingSaveAction = null;
    } else {
        await syncDashboardToCloud();
    }
};

window.declineConsent = async function() {
    localStorage.setItem('vaad_dpdp_consent', 'false');
    state.userConsent = 'false';
    ui.createGenericModalCloser('consent-modal')();
    if (state.pendingSaveAction) {
        await state.pendingSaveAction();
        state.pendingSaveAction = null;
    }
};

// ─── Cloud Sync Permission Toggle ────────────────────────────
window.toggleCloudSyncPermission = async function() {
    const toggleEl = document.getElementById('syncPermissionToggle');
    if (!toggleEl) return;
    const isChecked = toggleEl.checked;

    if (!state.currentUser) {
        alert('Please sign in to change permissions.');
        toggleEl.checked = !isChecked;
        return;
    }

    try {
        const userRef = doc(db, 'users', state.currentUser.uid);
        await setDoc(userRef, { permissions: { cloudSync: isChecked } }, { merge: true });
        state.syncPermission = isChecked;

        if (!isChecked) {
            if (confirm("Cloud Sync Revoked. Data stays local until you log out. Confirm?")) {
                alert('Permission revoked successfully.');
            } else {
                toggleEl.checked = true;
                await setDoc(userRef, { permissions: { cloudSync: true } }, { merge: true });
                state.syncPermission = true;
            }
        } else {
            alert('Secure Cloud Sync Enabled.');
            await syncDashboardToCloud();
        }
    } catch (error) {
        console.error('[Permissions] toggleCloudSyncPermission error:', error);
        alert('Network error. Check connection.');
        toggleEl.checked = !isChecked;
    }
};

// ─── Global Click Listener (auth buttons + logout) ───────────
document.addEventListener('click', async (e) => {
    // Logout
    const logoutTarget = e.target.closest('#logout-btn') || e.target.closest('#drawer-logout-btn');
    if (logoutTarget) {
        if (e.target.closest('#drawer-logout-btn')) ui.toggleMenu();
        signOut(auth).then(() => window.location.reload());
        return;
    }

    // Email login / register
    const emailLoginBtn = e.target.closest('#email-login-btn');
    if (emailLoginBtn) {
        const email    = document.getElementById('auth-email').value.trim();
        const password = document.getElementById('auth-password').value;
        const errorDiv = document.getElementById('auth-error');
        if (!errorDiv) return;

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
            ui.closeLoginModal();
        } catch (error) {
            if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
                try {
                    await createUserWithEmailAndPassword(auth, email, password);
                    ui.closeLoginModal();
                } catch (regErr) {
                    errorDiv.innerText = regErr.code === 'auth/email-already-in-use'
                        ? "This email is linked to a Google account. Try 'Continue with Google'."
                        : 'Error: ' + regErr.message.replace('Firebase: ', '');
                    errorDiv.style.display = 'block';
                    ui.resetLoginButtons();
                }
            } else {
                errorDiv.innerText = 'Error: ' + error.message.replace('Firebase: ', '');
                errorDiv.style.display = 'block';
                ui.resetLoginButtons();
            }
        }
        return;
    }

    // Google sign in
    const googleLoginBtn = e.target.closest('#google-login-btn');
    if (googleLoginBtn) {
        googleLoginBtn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-color:var(--text-muted);border-top-color:transparent;margin-right:8px;display:inline-block;"></div> Connecting...';
        googleLoginBtn.disabled  = true;

        const executePopup = async () => {
            try {
                await signInWithPopup(auth, new GoogleAuthProvider());
                ui.closeLoginModal();
            } catch (err) {
                console.error('[Auth] Popup error:', err);
                ui.resetLoginButtons();
            }
        };

        try {
            document.cookie = 'g_state=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
            if (typeof google === 'undefined' || !google.accounts) { await executePopup(); return; }
            google.accounts.id.prompt(async (n) => {
                if (n.isDismissedMoment() || n.isSkippedMoment() || n.isNotDisplayed()) await executePopup();
            });
        } catch (e) { await executePopup(); }
    }
});

// ─── Keydown Listener ─────────────────────────────────────────
document.addEventListener('keydown', e => { if (e.key === 'Enter') window.handleSearch(); });

// ─── Service Worker ───────────────────────────────────────────
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));
}

// ─── Window Bindings ──────────────────────────────────────────
// All onclick="window.X()" calls in HTML are resolved here.

// ui.js exports
window.clearResults        = ui.clearResults;
window.switchTab           = ui.switchTab;
window.switchJurisdiction  = ui.switchJurisdiction;
window.toggleMenu          = ui.toggleMenu;
window.toggleCnrMode       = ui.toggleCnrMode;
window.toggleView          = ui.toggleView;
window.openLoginModal      = ui.openLoginModal;
window.closeLoginModal     = ui.closeLoginModal;
window.openModal           = ui.openModal;
window.closeModal          = ui.closeModal;
window.openUniversalSearch = ui.openUniversalSearch;
window.closeUniversalSearch= ui.closeUniversalSearch;
window.runUniversalSearch  = ui.runUniversalSearch;
window.goToDashboardCase   = ui.goToDashboardCase;
window.openAI              = ui.openAI;
window.closeAI             = ui.closeAI;

// Generic modal pairs from ui.js factory
window.openDevModal        = ui.createGenericModalOpener('dev-modal');
window.closeDevModal       = ui.createGenericModalCloser('dev-modal');
window.openWhatsNewModal   = ui.createGenericModalOpener('whats-new-modal');
window.closeWhatsNewModal  = ui.createGenericModalCloser('whats-new-modal');
window.openFaqModal        = ui.createGenericModalOpener('faq-modal');
window.closeFaqModal       = ui.createGenericModalCloser('faq-modal');
window.openAddCaseModal    = ui.createGenericModalOpener('add-case-modal');
window.closeAddCaseModal   = ui.createGenericModalCloser('add-case-modal');
window.openConsentModal    = ui.createGenericModalOpener('consent-modal');
window.closeConsentModal   = ui.createGenericModalCloser('consent-modal');

// payments.js exports
window.selectPlan          = selectPlan;
window.payWithRazorpay     = payWithRazorpay;

// search.js exports
window.handleSearch        = handleSearch;

// dashboard.js exports
window.renderDashboard     = renderDashboard;
window.saveTrackedCase     = saveTrackedCase;
window.logPayment          = logPayment;
window.deleteDashboardCase = deleteDashboardCase;
window.deletePaymentLog    = deletePaymentLog;
