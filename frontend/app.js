window.onerror = function(msg, url, line) { 
    console.error("Script Error: " + msg + " (Line " + line + ")"); 
};

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
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

const API = 'https://vaad-wnul.onrender.com/api';
let currentUser = null;
let currentPlan = 'free'; 
let cycleStartDate = null; 

let activeTab = 'cnr';
let activeJurisdiction = 'india';

// Global state for permissions, initialized from defaults
let permissions = { cloudSync: true };

// Local storage array for dashboard data & DPDP Consent Status
let practiceCases = JSON.parse(localStorage.getItem('vaad_dashboard_cases')) || []; 
let userConsent = localStorage.getItem('vaad_dpdp_consent');
let pendingSaveAction = null; // Holds the save function if interrupted by consent prompt

const limits = {
    free: { search: 1, pdf: 0 },
    pro: { search: 30, pdf: 0 },
    promax: { search: 100, pdf: 0 },
    supreme: { search: 150, pdf: 30 }
};

// --- BUTTON BINDINGS (Mainly handling auth) ---
document.addEventListener('click', async (e) => {
    // Handling all possible login buttons including new drawer button
    const authTargets = [e.target.closest('#drawer-login-btn')];
    const logoutTargets = [e.target.closest('#drawer-logout-btn')];
    
    authTargets.forEach(target => {
        if (target) {
            target.innerHTML = '<span>Connecting with Google...</span>';
            try {
                signInWithPopup(auth, provider);
                window.toggleMenu(); // Close drawer on success
            } catch (error) {
                console.error("Login failed or cancelled:", error);
                target.innerText = "Sign In with Google";
            }
        }
    });
    
    logoutTargets.forEach(target => {
        if (target) {
            window.toggleMenu(); // Close drawer on success
            signOut(auth).then(() => {
                window.location.reload(); 
            });
        }
    });
});

// =============================================
// ✨ NEW: Cloud Sync & Permission Management
// =============================================

// Function to track active cloud sync based on DPDP and permission layer
async function syncDashboardToCloud() {
    // 1. MUST have logged-in user
    if (!currentUser) return; 
    
    // 2. DPDP Act Check (Original onboarding consent)
    if (userConsent !== 'true') {
        console.warn("[Cloud Sync] Locked. User has not given general DPDP Act consent.");
        return; 
    }
    
    // 3. New Permission Layer Check (Specific to Cloud Sync toggle)
    if (!permissions.cloudSync) {
        console.warn("[Cloud Sync] Locked. User has revoked Cloud Sync permission.");
        // Clear local data if revocation means "delete from device too" (optional, but good practice)
        // practiceCases = []; localStorage.removeItem('vaad_dashboard_cases');
        return;
    }

    try {
        const userRef = doc(db, "users", currentUser.uid);
        await updateDoc(userRef, {
            practiceCases: practiceCases
        });
        console.log("[Cloud Sync] Dashboard saved to Firestore.");
    } catch (error) {
        // If they revoked permission on another device, updateDoc will fail with a security rule error. 
        // We should handle that by disabling sync locally.
        console.error("Error syncing dashboard to cloud:", error);
    }
}

// Function to update Toggle UI based on Firestore state on app start
async function syncToggleUIWithFirestore() {
    if (!currentUser) return;
    try {
        const userSnap = await getDoc(doc(db, 'users', currentUser.uid));
        if (userSnap.exists()) {
            const data = userSnap.data();
            // Sync local permission state from Firestore
            if (data.permissions && data.permissions.cloudSync !== undefined) {
                permissions.cloudSync = data.permissions.cloudSync;
                // Update CSS toggle switch in the UI
                const toggleEl = document.getElementById('syncPermissionToggle');
                if (toggleEl) toggleEl.checked = permissions.cloudSync;
                console.log(`[Permission Layer] Synced CloudSync from Firestore: ${permissions.cloudSync}`);
            }
        }
    } catch (error) {
        console.error("[Permission Layer] Error syncing UI with Firestore:", error);
    }
}

// Global function to handle the Permission toggle in settings UI
window.toggleCloudSyncPermission = async function() {
    const toggleEl = document.getElementById('syncPermissionToggle');
    const isChecked = toggleEl.checked; // the state they are switching TO
    
    if (!currentUser) {
        alert("You must be logged in to change permissions.");
        toggleEl.checked = !isChecked; // revert the visual state
        return;
    }

    try {
        const userRef = doc(db, 'users', currentUser.uid);
        
        // 1. Save the new permission choice in the 'permissions' object in Firestore
        await setDoc(userRef, { 
            permissions: { cloudSync: isChecked } 
        }, { merge: true });

        // Update local memory state
        permissions.cloudSync = isChecked;

        // 2. Re-initialize Dashboard/Sync logic based on the new choice
        if (!isChecked) {
            // THEY REVOKED SYNC
            if(confirm("Cloud Sync Revoked. You will still have access to the Practice Dashboard locally on this device, but new changes will not be securely backed up to our servers. Your local data will remain until you log out.")) {
                alert("Permission revoked. Remember, without cloud sync, you will lose data if you log out or clear browser cache.");
                // We could also clear cloud data from server (optional premium feature)
            } else {
                toggleEl.checked = true; // revert UI
                await setDoc(userRef, { permissions: { cloudSync: true } }, { merge: true });
                permissions.cloudSync = true;
                return;
            }
        } else {
            // THEY ENABLED SYNC
            alert("Secure Cloud Sync Enabled. Your Practice Dashboard is now backed up safely.");
            await syncDashboardToCloud(); // Initiate an immediate sync
        }

    } catch (error) {
        console.error("[Permission Layer] Error toggling permission:", error);
        alert("Could not update permission. Please check internet connection.");
        toggleEl.checked = !isChecked; // Revert toggle UI
    }
};

// ==========================================
// 🛡️ AUTHENTICATION STATE HANDLING
// ==========================================
onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    const limitText = document.getElementById('limit-text');
    if (limitText) limitText.innerText = "Loading limits..."; 

    if (user) {
        // --- Populating Modern Clutter-Free Drawer ---
        const drawerUnauth = document.getElementById('drawer-unauth');
        const drawerAuth = document.getElementById('drawer-auth');
        const drawerLogout = document.getElementById('drawer-logout-btn');
        const drawerUpgrade = document.getElementById('drawer-upgrade-btn');
        
        if (drawerUnauth) drawerUnauth.style.display = 'none';
        if (drawerAuth) {
            drawerAuth.style.display = 'flex';
            document.getElementById('drawer-name').innerText = user.displayName;
            document.getElementById('drawer-avatar').src = user.photoURL;
        }
        if (drawerLogout) drawerLogout.style.display = 'block';
        if (drawerUpgrade) drawerUpgrade.style.display = 'inline-flex';

        const badge = document.getElementById('drawer-badge');
        if (badge) { badge.innerText = "..."; badge.style.background = "gray"; }

        // Fetch user plan/limit data from Firestore
        try {
            const userRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                const data = userSnap.data();
                let dbPlan = String(data.plan || 'free').toLowerCase().replace(/[^a-z]/g, '');
                currentPlan = limits[dbPlan] ? dbPlan : 'free';
                cycleStartDate = data.cycleStartDate || new Date().toISOString().split('T')[0];
                
                // --- Sync Permission UI state from Firestore ---
                await syncToggleUIWithFirestore();

                // --- FETCH DASHBOARD DATA FROM CLOUD (DPDP/Permission check inside helper) ---
                if (data.practiceCases) {
                    practiceCases = data.practiceCases;
                    localStorage.setItem('vaad_dashboard_cases', JSON.stringify(practiceCases));
                    console.log("[Cloud Sync] Dashboard loaded from Firestore.");
                }
            } else {
                // Initial Firestore user creation if not exists
                const today = new Date().toISOString().split('T')[0];
                await setDoc(userRef, { 
                    name: user.displayName, 
                    email: user.email, 
                    plan: 'free', 
                    cycleStartDate: today, 
                    joinedAt: new Date().toISOString(),
                    practiceCases: []
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
        // --- Unauthenticated State handling ---
        const drawerUnauth = document.getElementById('drawer-unauth');
        const drawerAuth = document.getElementById('drawer-auth');
        const drawerLogout = document.getElementById('drawer-logout-btn');
        
        if (drawerUnauth) drawerUnauth.style.display = 'block';
        if (drawerAuth) drawerAuth.style.display = 'none';
        if (drawerLogout) drawerLogout.style.display = 'none';

        currentPlan = 'free';
        cycleStartDate = null;
        
        // CLEAR LOCAL DATA ON LOGOUT FOR PRIVACY
        practiceCases = [];
        localStorage.removeItem('vaad_dashboard_cases');
    }
    
    updateBadge();
    updateTabLocks();
    updateSearchLimitUI();
});

// =============================================
// ✨ NEW: Modern Navigation Logic
// =============================================

// Universal Function to handle Tab switching in the glossy bottom nav
window.showTab = function(tabId, el) {
    // 1. Hide all main content views
    document.querySelectorAll('.main-view').forEach(tab => {
        tab.classList.remove('active-view');
    });

    // 2. Remove active class from all bottom nav items
    document.querySelectorAll('.bottom-nav .nav-item').forEach(nav => {
        nav.classList.remove('active');
    });

    // 3. Show selected view content and make the clicked nav item active
    const targetView = document.getElementById(tabId);
    if (targetView) targetView.classList.add('active-view');
    if (el) el.classList.add('active');

    // 4. Special Handling based on which tab is shown
    if (tabId === 'view-dashboard') {
        // Auth Check for My Practice tab
        if (!currentUser) { 
            // alert("Please sign in to access your Practice Dashboard."); window.openModal(); return; 
            // Instead of alert/modal, the HTML should just show a "Sign In required" message in the dashboard area. I updated this in step 4 index.html.
        } else {
            window.renderDashboard(); // Re-render if switching TO it
        }
    } else if (tabId === 'view-ai') {
        // Special check if AI assistant is stand-alone or paid tier (Optional logic here)
    }
    
    // Close side drawer if it was open (from 'Menu' click)
    document.getElementById('side-drawer').classList.remove('open');
    document.getElementById('drawer-overlay').classList.remove('open');
};

// Obsolete toggleView and closeAI sidebar logic removed. Replaced by showTab and summarizeJudgmentWithAI helper.

// ==========================================
// FUP LIMITS & UI HELPERS
// ==========================================
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
    const badge = document.getElementById('drawer-badge');
    if (!badge) return;
    const fup = checkFUP('search');
    
    if (fup.expired) {
        badge.innerText = "EXPIRED"; badge.style.background = "#ef4444"; badge.style.color = "white";
    } else if (currentPlan === 'supreme') {
        badge.innerText = "SUPREME PLAN"; badge.style.background = "#8b5cf6"; badge.style.color = "white";
    } else if (currentPlan === 'promax') {
        badge.innerText = "PRO MAX PLAN"; badge.style.background = "#d4af37"; badge.style.color = "black";
    } else if (currentPlan === 'pro') {
        badge.innerText = "PRO PLAN"; badge.style.background = "var(--primary)"; badge.style.color = "white";
    } else {
        badge.innerText = "FREE PLAN"; badge.style.background = "var(--border)"; badge.style.color = "var(--text-muted)";
    }
}

function updateTabLocks() {
    // Only locking advanced lists for free plan now. CNR and Lawyer stay free.
    const locks = document.querySelectorAll('.tab:not(#tab-cnr):not(#tab-lawyer):not(#tab-us-case) .lock-icon');
    if (currentPlan === 'supreme' || currentPlan === 'promax' || currentPlan === 'pro') {
        locks.forEach(icon => icon.style.display = 'none');
    } else {
        locks.forEach(icon => icon.style.display = 'inline');
        if (activeTab !== 'cnr' && activeTab !== 'us-case' && activeTab !== 'lawyer') window.switchTab('cnr');
    }
}

function updateSearchLimitUI() {
    const limitText = document.getElementById('limit-text');
    if (!limitText) return;
    if (!currentUser) { limitText.innerText = "Sign in with Google to get 1 free search"; return; }
    const fup = checkFUP('search');
    if (fup.expired) {
        limitText.innerHTML = `<span style="color: #ef4444; font-weight:600;">Subscription Expired</span>`;
        return;
    }
    let daysText = currentPlan !== 'free' ? `(${fup.daysLeft} days left) • ` : '';
    if (currentPlan === 'supreme') {
        limitText.innerHTML = `<span style="color: #8b5cf6; font-weight:600;">Supreme ${daysText}${fup.remaining}/${fup.limit} Searches</span>`;
    } else {
        limitText.innerHTML = `<span style="color: var(--primary); font-weight:600;">${currentPlan.toUpperCase()} ${daysText}${fup.remaining}/${fup.limit} Searches</span>`;
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
    // Lock advanced tabs even from non-logged users
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

// --- MODALS & MENUS TRIGGERING ---
window.toggleMenu = function() {
    document.getElementById('side-drawer').classList.toggle('open');
    document.getElementById('drawer-overlay').classList.toggle('open');
};

window.openDevModal = function() { 
    const m = document.getElementById('dev-modal'); m.classList.add('active'); m.style.display = ''; 
};
window.closeDevModal = function() { document.getElementById('dev-modal').classList.remove('active'); };

window.openWhatsNewModal = function() { 
    const m = document.getElementById('whats-new-modal'); m.classList.add('active'); m.style.display = ''; 
};
window.closeWhatsNewModal = function() { document.getElementById('whats-new-modal').classList.remove('active'); };

window.openFaqModal = function() { 
    const m = document.getElementById('faq-modal'); m.classList.add('active'); m.style.display = ''; 
};
window.closeFaqModal = function() { document.getElementById('faq-modal').classList.remove('active'); };

window.openAddCaseModal = function() { 
    const m = document.getElementById('add-case-modal'); m.classList.add('active'); m.style.display = ''; 
};
window.closeAddCaseModal = function() { document.getElementById('add-case-modal').classList.remove('active'); };

// ✨ DPDP CONSENT MODAL LOGIC (Untouched, critical core)
window.openConsentModal = function() {
    const m = document.getElementById('consent-modal'); m.classList.add('active'); m.style.display = ''; 
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

// PRICING MODAL (Untouched)
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
        window.closeModal(); signInWithPopup(auth, provider); return;
    }
    const options = {
        "key": "YOUR_LIVE_RAZORPAY_KEY_ID", "amount": amountInINR * 100, "currency": "INR", "name": "Vaad", "description": `Upgrade to Vaad ${planType.toUpperCase()}`,
        "image": "https://vaad.pages.dev/icon-192.png",
        "handler": function (response) { const btn = document.getElementById('upi-btn-link'); if (btn) btn.innerText = "Payment Successful! Upgrading..."; setTimeout(() => window.location.reload(), 3000); },
        "prefill": { "name": currentUser.displayName || "", "email": currentUser.email || "" }, "notes": { "userId": currentUser.uid, "planName": planType }, "theme": { "color": "#8b5cf6" }
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
    if (upgradeBtn) { upgradeBtn.removeAttribute('href'); upgradeBtn.innerText = `Pay ₹${amount} Securely`; upgradeBtn.onclick = (e) => { e.preventDefault(); upgradeBtn.innerText = "Opening Checkout..."; window.payWithRazorpay(planType, amount); }; }
};

// ✨ UNIVERSAL SEARCH LOGIC (Preserved, connected to menu)
window.openUniversalSearch = function() {
    if (!currentUser) { alert("Please sign in to search your Practice Dashboard."); window.openModal(); return; }
    const modal = document.getElementById('universal-search-modal'); m.classList.add('active'); m.style.display = ''; 
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
    if (!query) { resultsContainer.innerHTML = '<div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 20px;">Type to search your Practice Dashboard records...</div>'; return; }
    const matches = practiceCases.filter(c => c.title.toLowerCase().includes(query) || (c.cnr && c.cnr.toLowerCase().includes(query)) || c.totalFee.toString().includes(query));
    if (matches.length === 0) { resultsContainer.innerHTML = `<div style="text-align: center; color: var(--warning-text); font-size: 0.9rem; padding: 20px; background: var(--warning-bg); border-radius: 8px;">No dashboard records found for "${query}"</div>`; return; }
    let html = '';
    matches.forEach(c => {
        const remaining = Math.max(0, c.totalFee - c.collected);
        html += `<div onclick="window.goToDashboardCase(${c.id})" style="padding: 12px; border-bottom: 1px solid var(--border); cursor: pointer; transition: background 0.2s; border-radius: 6px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><div style="font-weight: 600; color: var(--primary);">${c.title}</div><div style="font-size: 0.75rem; font-weight: bold; color: ${remaining > 0 ? 'var(--warning-text)' : 'var(--success-text)'};">${remaining > 0 ? '₹' + remaining + ' Due' : 'Paid'}</div></div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">CNR: ${c.cnr || 'Manual Entry'} • Total: ₹${c.totalFee}</div>
        </div>`;
    });
    resultsContainer.innerHTML = html;
};

window.goToDashboardCase = function(caseId) {
    window.closeUniversalSearch();
    // Use the new showTab function to navigate to dashboard
    window.showTab('view-dashboard', document.getElementById('nav-dashboard'));
    setTimeout(() => {
        const caseElement = document.getElementById(`dashboard-case-${caseId}`);
        if (caseElement) {
            caseElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            caseElement.style.boxShadow = '0 0 0 2px var(--primary)';
            setTimeout(() => { caseElement.style.boxShadow = 'none'; }, 1500);
        }
    }, 100);
};

// ==========================================
// API SEARCH LOGIC (Preserved Core)
// ==========================================
window.handleSearch = async function() {
    if (!currentUser) { signInWithPopup(auth, provider); return; }
    const fup = checkFUP('search');
    if (fup.expired) { showError(`Your ${currentPlan.toUpperCase()} subscription expired.`); window.openModal(); return; }
    if (!fup.allowed) { if (currentPlan === 'free') window.openModal(); else showError(`FUP Limit Reached.`); return; }
    let endpoint = ''; let bodyData = {}; let renderType = '';
    if (activeJurisdiction === 'usa' && activeTab === 'us-case') { alert("US Case Law search is coming soon. Stay tuned!"); return; } 
    else if (activeTab === 'lawyer') { alert("Data-Driven Lawyer Discovery is compilation of records and available soon."); return; } 
    else if (activeTab === 'cnr') {
        const mode = document.querySelector('input[name="cnr-mode"]:checked').value;
        if (mode === 'single') {
            const query = document.getElementById('cnr-input').value.trim(); if (!query) return;
            endpoint = `${API}/cnr`; bodyData = { cnr: query }; renderType = 'cnr';
        } else {
            const bulkText = document.getElementById('cnr-bulk-input').value.trim(); if (!bulkText) return;
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
        if (!query) return; endpoint = `${API}/search`; bodyData = { query: query, type: activeTab }; renderType = 'list';
    }
    await performSearch(endpoint, bodyData, fup.storageKey, renderType);
};

// SEARCH PERFORM HELPER (Preserved)
async function performSearch(endpoint, bodyData, storageKey, renderType) {
    setLoading(true); window.clearResults();
    try {
        const res = await fetch(endpoint, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(bodyData) });
        const json = await res.json();
        if (!res.ok || !json.success) return showError(json.error || 'The official API failed to fetch records.');
        if (currentUser) {
            let currentCount = parseInt(localStorage.getItem(storageKey) || 0);
            localStorage.setItem(storageKey, currentCount + 1); updateSearchLimitUI();
        }
        if (renderType === 'cnr') renderCaseDetail(json.data);
        else if (renderType === 'list') renderCaseList(json.data);
        else if (renderType === 'causelist') {
             const resultsContainer = document.getElementById('results');
             let html = `<div style="margin-bottom: 15px; cursor: pointer; color: var(--text-muted); font-size: 14px; text-decoration: underline;" onclick="window.clearResults()">← Back to search</div><h3 style="margin-bottom: 15px;">Today's Cause List</h3>`;
             if (!json.data || !json.data.results || json.data.results.length === 0) { html += `<div>No cases listed today.</div>`; } 
             else { json.data.results.forEach(c => { html += `<div style="background: var(--bg); padding: 12px; border: 1px solid var(--border); border-radius: 8px; margin-bottom: 10px;"><div style="font-weight: 600; margin-bottom: 4px;">${c.caseNumber || 'Unknown Case'}</div><div style="font-size: 13px; color: var(--text-muted);">Court: ${c.courtName || '—'}</div><div style="font-size: 12px; margin-top: 8px;"><span style="background: var(--primary-bg); color: var(--primary); padding: 2px 6px; border-radius: 4px;">Room: ${c.courtNo || '—'}</span></div></div>`; }); }
             resultsContainer.innerHTML = html;
        }
        else if (renderType === 'bulk') { document.getElementById('results').innerHTML = `<div style="background: var(--success-bg); color: var(--success-text); padding: 16px; border: 1px solid #a7f3d0; border-radius: 8px;"><h3 style="margin-bottom: 8px;">Bulk Refresh Initiated ✓</h3><p style="font-size: 0.9rem;">Your CNRs are queued for a fresh scrape. Search them individually in 1-2 minutes.</p><div style="margin-top: 12px; cursor: pointer; text-decoration: underline; font-size: 0.85rem;" onclick="window.clearResults()">← Start New Search</div></div>`; }
    } catch (e) { showError(`Network Error: ${e.message}`); } finally { setLoading(false); }
}

function setLoading(on) {
    const btn = document.getElementById('search-btn'); if (!btn) return; btn.disabled = on;
    btn.innerHTML = on ? '<div class="spinner"></div><span>Fetching...</span>' : '<span id="btn-text">Search Cases</span>';
}

function renderCaseList(resultsArray) {
    if (!resultsArray || resultsArray.length === 0) return showError('No cases found.'); 
    let html = `<div style="margin-bottom: 15px; cursor: pointer; color: var(--text-muted); font-size: 14px; text-decoration: underline;" onclick="window.clearResults()">← Back to search</div><div style="font-size: 16px; font-weight: 600; margin-bottom: 15px; color: var(--text-main);">Found ${resultsArray.length} cases:</div>`;
    resultsArray.forEach(data => { html += `<div style="background: var(--bg); padding: 15px; border-radius: 8px; border: 1px solid var(--border); margin-bottom: 10px;"><div style="display: flex; justify-content: space-between; align-items: start;"><div style="padding-right: 15px;"><div style="font-size: 15px; font-weight: 600; color: var(--text-main); margin-bottom: 4px; word-break: break-word;">${(data.petitioners||['—'])[0]} vs ${(data.respondents||['—'])[0]}</div><div style="font-size: 13px; color: var(--text-muted); margin-bottom: 8px;">CNR: ${data.cnr || '—'}</div></div><div style="font-size: 11px; font-weight: bold; background: var(--primary-bg); color: var(--primary); padding: 4px 8px; border-radius: 4px; white-space: nowrap;">${data.caseStatus || 'Pending'}</div></div></div>`; });
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
            
            <button class="btn-action btn-ai" onclick="window.summarizeJudgmentWithAI('${data.cnr}')" style="margin-top: 16px; width: 100%; justify-content: center; gap: 8px;">
               ✨ Summarize Order with AI
            </button>
            <button class="btn-action" onclick="window.openAddCaseModal(); document.getElementById('track-cnr').value='${data.cnr}'; document.getElementById('track-title').value='${(data.petitioners||['—'])[0]} vs ${(data.respondents||['—'])[0]}';" style="margin-top: 10px; width: 100%; justify-content: center;">
               💼 Add to My Practice Ledger
            </button>
        </div>`;
    document.getElementById('results').innerHTML = html;
}

// ==========================================
// PRACITCE LEDGER / DASHBOARD LOGIC (Preserved Core)
// ==========================================
window.saveTrackedCase = async function() {
    const cnr = document.getElementById('track-cnr').value.trim();
    const title = document.getElementById('track-title').value.trim();
    const total = parseInt(document.getElementById('track-total').value) || 0;
    const perHearing = parseInt(document.getElementById('track-hearing').value) || 0;
    if (!title) return alert("Case Title / Client Name is required.");

    const executeSave = async () => {
        practiceCases.unshift({ id: Date.now(), cnr: cnr, title: title, totalFee: total, perHearing: perHearing, collected: 0, payments: [] });
        localStorage.setItem('vaad_dashboard_cases', JSON.stringify(practiceCases));
        // SAVE TO CLOUD (Helper performs DPDP/Permission checks)
        await syncDashboardToCloud(); 
        
        document.getElementById('track-cnr').value = ''; document.getElementById('track-title').value = ''; document.getElementById('track-total').value = ''; document.getElementById('track-hearing').value = '';
        window.closeAddCaseModal();
        // Use modern navigation helper
        window.showTab('view-dashboard', document.getElementById('nav-dashboard'));
    };

    // DPDP Check: If consent has never been asked, interrupt and ask.
    if (userConsent === null && currentUser) { pendingSaveAction = executeSave; window.closeAddCaseModal(); window.openConsentModal(); } 
    else { await executeSave(); }
};

window.logPayment = async function(id) {
    const input = document.getElementById('pay-input-' + id);
    const amount = parseInt(input.value);
    if (!amount || amount <= 0) return alert("Please enter a valid amount.");
    const caseIndex = practiceCases.findIndex(c => c.id === id);
    if (caseIndex > -1) {
        practiceCases[caseIndex].collected += amount;
        practiceCases[caseIndex].payments.push({ date: new Date().toLocaleDateString('en-GB'), amount: amount });
        localStorage.setItem('vaad_dashboard_cases', JSON.stringify(practiceCases));
        await syncDashboardToCloud(); 
        window.renderDashboard();
    }
};

window.deleteDashboardCase = async function(id) {
    if (!confirm("Are you sure permanently delete this case? payment history lost.")) return;
    practiceCases = practiceCases.filter(c => c.id !== id);
    localStorage.setItem('vaad_dashboard_cases', JSON.stringify(practiceCases));
    await syncDashboardToCloud(); window.renderDashboard();
};

window.deletePaymentLog = async function(caseId, paymentIndex) {
    if (!confirm("Delete this payment log?")) return;
    const caseIndex = practiceCases.findIndex(c => c.id === caseId);
    if (caseIndex > -1) {
        practiceCases[caseIndex].collected -= practiceCases[caseIndex].payments[paymentIndex].amount; 
        practiceCases[caseIndex].payments.splice(paymentIndex, 1);
        localStorage.setItem('vaad_dashboard_cases', JSON.stringify(practiceCases));
        await syncDashboardToCloud(); window.renderDashboard();
    }
};

function renderDashboard() {
    let totalExpected = 0; let totalCollected = 0; let html = '';
    if (practiceCases.length === 0) { html = `<div style="text-align:center; padding: 40px 20px; color: var(--text-muted); border: 1px dashed var(--border); border-radius: 8px;">No cases tracked yet. ledger empty.</div>`; }
    practiceCases.forEach(c => {
        totalExpected += c.totalFee; totalCollected += c.collected; const remaining = Math.max(0, c.totalFee - c.collected);
        let paymentsHtml = '';
        if (c.payments && c.payments.length > 0) {
            paymentsHtml = `<div style="font-size: 0.8rem; margin-top: 12px; border-top: 1px solid var(--border); padding-top: 8px;"><div style="font-weight: 600; margin-bottom: 6px; color: var(--text-muted);">Payment History</div>`;
            const reversedPayments = c.payments.map((p, i) => ({...p, originalIndex: i})).reverse();
            reversedPayments.forEach(p => { paymentsHtml += `<div style="display:flex; justify-content: space-between; border-bottom: 1px dashed var(--border); padding: 6px 0; align-items: center;"><span>${p.date}</span><div style="display: flex; gap: 12px; align-items: center;"><span style="color: var(--success-text); font-weight: 600;">+ ₹${p.amount}</span><button onclick="window.deletePaymentLog(${c.id}, ${p.originalIndex})" style="background: none; border: none; color: var(--error-text); cursor: pointer; font-size: 1.1rem; line-height: 1; padding: 0 4px;" title="Delete Payment">×</button></div></div>`; });
            paymentsHtml += `</div>`;
        }
        html += `<div id="dashboard-case-${c.id}" class="case-card">
            <div style="display: flex; justify-content: space-between; margin-bottom: 12px; align-items: flex-start;">
                <div><div style="font-weight: 700; font-size: 1.05rem;">${c.title}</div><div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;">CNR: ${c.cnr || 'Manual Entry'}</div></div>
                <div style="text-align: right;"><div style="display: flex; align-items: center; justify-content: flex-end; gap: 8px; margin-bottom: 4px;"><div style="font-size: 0.8rem; background: ${remaining > 0 ? 'var(--warning-bg)' : 'var(--success-bg)'}; color: ${remaining > 0 ? 'var(--warning-text)' : 'var(--success-text)'}; padding: 4px 8px; border-radius: 4px; font-weight: bold;">${remaining > 0 ? `₹${remaining} Pending` : 'Paid ✓'}</div><button onclick="window.deleteDashboardCase(${c.id})" style="background: none; border: none; color: var(--error-text); cursor: pointer; font-size: 1rem; padding: 4px; transition: transform 0.1s;" title="Delete Case" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">🗑️</button></div></div>
            </div>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; background: var(--bg-alt); padding: 12px; border-radius: 6px; margin-bottom: 12px; text-align: center;"><div><div style="font-size: 0.7rem; color: var(--text-muted);">Total Fee</div><div style="font-weight: 600;">₹${c.totalFee}</div></div><div><div style="font-size: 0.7rem; color: var(--text-muted);">Per Hearing</div><div style="font-weight: 600;">₹${c.perHearing}</div></div><div><div style="font-size: 0.7rem; color: var(--text-muted);">Collected</div><div style="font-weight: 600; color: var(--success-text);">₹${c.collected}</div></div></div>
            <div style="display: flex; gap: 8px;"><input type="number" id="pay-input-${c.id}" placeholder="${c.perHearing > 0 ? '₹' + c.perHearing : '₹ Amount'}" style="flex: 1; padding: 8px; border: 1px solid var(--border); border-radius: 6px; font-size: 0.9rem;" ${remaining === 0 ? 'disabled' : ''}><button class="btn-action" onclick="window.logPayment(${c.id})" style="background: var(--success-bg); color: var(--success-text); border-color: #a7f3d0; padding: 8px 16px;" ${remaining === 0 ? 'disabled' : ''}>Log Payment</button></div>
            ${paymentsHtml}
        </div>`;
    });
    const casesContainer = document.getElementById('dashboard-cases'); if (casesContainer) casesContainer.innerHTML = html;
    const expEl = document.getElementById('stat-expected'); if(expEl) expEl.innerText = `₹${totalExpected}`;
    const colEl = document.getElementById('stat-collected'); if(colEl) colEl.innerText = `₹${totalCollected}`;
    const penEl = document.getElementById('stat-pending'); if(penEl) penEl.innerText = `₹${Math.max(0, totalExpected - totalCollected)}`;
}

// ==========================================
// ✨ NEW: AI Legal Assistant (Tab Logic)
// ==========================================

// Helper function called from search results to summarize a specific judgment
window.summarizeJudgmentWithAI = async function(cnr) {
    if (!currentUser) { alert("Please sign in to use AI Legal Assistant."); return; }
    if (currentPlan === 'free') { alert("AI Judgment Summaries require a Supreme Plan."); window.openModal(); return; }

    // 1. Switch TO the AI Tab visually
    window.showTab('view-ai', document.getElementById('nav-ai'));

    const aiContentMain = document.getElementById('ai-content-main');
    if (!aiContentMain) return;

    // 2. Show loading state inside the AI tab
    aiContentMain.innerHTML = `<div style="text-align: center; padding: 60px 20px; color: var(--text-muted);"><div class="spinner"></div><p style="margin-top: 15px;">AI is reading judgment (CNR: ${cnr}). This usually takes 10-20 seconds...</p></div>`;

    try {
        // 3. Make API call to your backend for AI summarization (Assuming endpoint exists: API/ai-summarize)
        const response = await fetch(`${API}/ai-summarize`, { 
            method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ cnr: cnr }) 
        });
        const json = await response.json();

        // 4. Render the AI results inside the tab
        if (!response.ok || !json.success) {
            aiContentMain.innerHTML = `<div class="error-box" style="margin-top: 20px;"><span>⚠️</span>AI could not analyze this judgment. It may be too recent or technically unavailable. Error: ${json.error || 'API Error'}</div>`;
            return;
        }

        aiContentMain.innerHTML = `<h3 style="margin-bottom: 12px; color: var(--primary);">Case Summary (CNR: ${cnr})</h3>
            <div style="white-space: pre-wrap; color: var(--text-main); line-height: 1.8;">${json.summary}</div>
            <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 20px; border-top: 1px dashed var(--border); padding-top: 10px;">Disclaimer: This AI summary is generated for assistance only. Please refer to the official judgment text for legal purposes.</div>`;

    } catch (error) {
        console.error("AI Summarization Error:", error);
        aiContentMain.innerHTML = `<div class="error-box" style="margin-top: 20px;"><span>⚠️</span>Network Error. Could not connect to Vaad AI.</div>`;
    }
};

// Obsolete closeAI and sidebar overlay logic removed.

document.addEventListener('keydown', e => { if (e.key === 'Enter') window.handleSearch(); });

if ('serviceWorker' in navigator) { window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js'); }); }
