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
    }
});

async function handleCredentialResponse(response) {
    try {
        const credential = GoogleAuthProvider.credential(response.credential);
        await signInWithCredential(auth, credential);
        window.closeLoginModal();
    } catch (error) { resetLoginButtons(); }
}

// ── Modal Control Functions ──
window.openLoginModal = () => { document.getElementById('login-modal').classList.add('active'); document.getElementById('login-modal').style.display = 'flex'; };
window.closeLoginModal = () => { document.getElementById('login-modal').classList.remove('active'); document.getElementById('login-modal').style.display = 'none'; document.getElementById('auth-error').style.display = 'none'; resetLoginButtons(); };

window.openDevModal = () => { document.getElementById('dev-modal').classList.add('active'); document.getElementById('dev-modal').style.display = 'flex'; };
window.closeDevModal = () => { document.getElementById('dev-modal').classList.remove('active'); document.getElementById('dev-modal').style.display = 'none';};

window.openWhatsNewModal = () => { document.getElementById('whats-new-modal').classList.add('active'); document.getElementById('whats-new-modal').style.display = 'flex'; };
window.closeWhatsNewModal = () => { document.getElementById('whats-new-modal').classList.remove('active'); document.getElementById('whats-new-modal').style.display = 'none';};

window.openFaqModal = () => { document.getElementById('faq-modal').classList.add('active'); document.getElementById('faq-modal').style.display = 'flex';};
window.closeFaqModal = () => { document.getElementById('faq-modal').classList.remove('active'); document.getElementById('faq-modal').style.display = 'none';};

window.openAddCaseModal = () => { document.getElementById('add-case-modal').classList.add('active'); document.getElementById('add-case-modal').style.display = 'flex';};
window.closeAddCaseModal = () => { document.getElementById('add-case-modal').classList.remove('active'); document.getElementById('add-case-modal').style.display = 'none';};

window.openConsentModal = () => { document.getElementById('consent-modal').classList.add('active'); document.getElementById('consent-modal').style.display = 'flex';};
window.closeConsentModal = () => { document.getElementById('consent-modal').classList.remove('active'); document.getElementById('consent-modal').style.display = 'none';};

// ✨ DYNAMIC PRICING MODAL ✨
window.openModal = () => { 
    const modal = document.getElementById('upgrade-modal');
    if (!modal) return;
    
    const proCard = document.getElementById('pro-card');
    const promaxCard = document.getElementById('promax-card');
    const supremeCard = document.getElementById('supreme-card');
    const upiBox = document.querySelector('.upi-box');
    const subtitle = document.getElementById('modal-subtitle');
    
    if (currentPlan === 'supreme') {
        if(proCard) proCard.style.display = 'none';
        if(promaxCard) promaxCard.style.display = 'none';
        if(supremeCard) { supremeCard.style.display = 'block'; supremeCard.style.border = '2px solid var(--primary)'; }
        if(upiBox) upiBox.style.display = 'none'; 
        if(subtitle) subtitle.innerText = "You are currently on the highest tier. Enjoy maximum limits and AI tools!";
    } else if (currentPlan === 'promax') {
        if(proCard) proCard.style.display = 'none';
        if(promaxCard) promaxCard.style.display = 'none';
        if(supremeCard) supremeCard.style.display = 'block';
        if(upiBox) upiBox.style.display = 'block';
        if(subtitle) subtitle.innerText = "Upgrade to Supreme for AI features and maximum limits.";
        window.selectPlan('supreme');
    } else if (currentPlan === 'pro') {
        if(proCard) proCard.style.display = 'none';
        if(promaxCard) promaxCard.style.display = 'block';
        if(supremeCard) supremeCard.style.display = 'block';
        if(upiBox) upiBox.style.display = 'block';
        if(subtitle) subtitle.innerText = "Select a plan to unlock more powerful tools.";
        window.selectPlan('promax');
    } else {
        if(proCard) proCard.style.display = 'block';
        if(promaxCard) promaxCard.style.display = 'block';
        if(supremeCard) supremeCard.style.display = 'block';
        if(upiBox) upiBox.style.display = 'block';
        if(subtitle) subtitle.innerText = "Powered by official eCourts API. You pay for secure, ad-free API access.";
        window.selectPlan('pro');
    }
    
    modal.style.display = 'flex'; 
    modal.classList.add('active'); 
};
window.closeModal = () => { document.getElementById('upgrade-modal').classList.remove('active'); document.getElementById('upgrade-modal').style.display = 'none';};

function resetLoginButtons() {
    const emailLoginBtn = document.getElementById('email-login-btn');
    const googleLoginBtn = document.getElementById('google-login-btn');
    if (emailLoginBtn) { emailLoginBtn.innerText = "Sign In / Register"; emailLoginBtn.disabled = false; }
    if (googleLoginBtn) { googleLoginBtn.innerHTML = `<img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" style="width: 20px; margin-right: 10px;" alt="G"> Continue with Google`; googleLoginBtn.disabled = false; }
}

const API = 'https://vaad-wnul.onrender.com/api';
let currentUser = null;
let currentPlan = 'free'; 
let activeTab = 'cnr';
let activeJurisdiction = 'india';
let syncPermission = true;

let practiceCases = JSON.parse(localStorage.getItem('vaad_dashboard_cases')) || []; 
let userConsent = localStorage.getItem('vaad_dpdp_consent');
let pendingSaveAction = null; 

// THE 3-WALLET PLAN LIMITS
const limits = {
    free: { search: 1, pdf: 0, ai: 0 },
    pro: { search: 30, pdf: 5, ai: 0 },
    promax: { search: 100, pdf: 20, ai: 0 },
    supreme: { search: 150, pdf: 50, ai: 20 }
};

document.addEventListener('click', async (e) => {
    const logoutTarget = e.target.closest('#logout-btn') || e.target.closest('#drawer-logout-btn');
    const emailLoginBtn = e.target.closest('#email-login-btn');
    const googleLoginBtn = e.target.closest('#google-login-btn');

    if (emailLoginBtn) {
        const email = document.getElementById('auth-email').value.trim();
        const password = document.getElementById('auth-password').value;
        const errorDiv = document.getElementById('auth-error');
        if (!email || !password) { errorDiv.innerText = "Please enter both email and password."; errorDiv.style.display = "block"; return; }
        emailLoginBtn.innerHTML = '<div class="spinner" style="margin-right:8px;"></div> Connecting...';
        emailLoginBtn.disabled = true; errorDiv.style.display = "none";
        try {
            await signInWithEmailAndPassword(auth, email, password);
            window.closeLoginModal();
        } catch (error) {
            if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
                try { await createUserWithEmailAndPassword(auth, email, password); window.closeLoginModal(); } 
                catch (registerError) { errorDiv.innerText = "Error: " + registerError.message.replace('Firebase: ', ''); errorDiv.style.display = "block"; resetLoginButtons(); }
            } else { errorDiv.innerText = "Error: " + error.message.replace('Firebase: ', ''); errorDiv.style.display = "block"; resetLoginButtons(); }
        }
        return;
    }
    
    if (googleLoginBtn) {
        googleLoginBtn.innerHTML = '<div class="spinner" style="border-color:var(--text-muted); border-top-color:transparent; margin-right:8px;"></div> Connecting...';
        googleLoginBtn.disabled = true;
        try { await signInWithPopup(auth, provider); window.closeLoginModal(); } 
        catch (error) { resetLoginButtons(); }
    }
    
    if (logoutTarget) {
        if (e.target.closest('#drawer-logout-btn')) window.toggleMenu();
        signOut(auth).then(() => { window.location.reload(); });
    }
});

// ── CLOUD SYNC HELPER ──
async function syncDashboardToCloud() {
    if (!currentUser || userConsent !== 'true' || !syncPermission) return; 
    try { await updateDoc(doc(db, "users", currentUser.uid), { practiceCases: practiceCases }); } 
    catch (error) { console.error("Sync error:", error); }
}

async function syncPermissionUI() {
    if (!currentUser) return;
    try {
        const snap = await getDoc(doc(db, 'users', currentUser.uid));
        if (snap.exists() && snap.data().permissions && snap.data().permissions.cloudSync !== undefined) {
            syncPermission = snap.data().permissions.cloudSync;
            const toggleEl = document.getElementById('syncPermissionToggle');
            if (toggleEl) toggleEl.checked = syncPermission;
        }
    } catch (e) { console.error(e); }
}

window.toggleCloudSyncPermission = async function() {
    const toggleEl = document.getElementById('syncPermissionToggle');
    const isChecked = toggleEl.checked; 
    if (!currentUser) { alert("Please sign in to change permissions."); toggleEl.checked = !isChecked; return; }
    try {
        await setDoc(doc(db, 'users', currentUser.uid), { permissions: { cloudSync: isChecked } }, { merge: true });
        syncPermission = isChecked;
        if (!isChecked) { alert("Permission revoked successfully."); } 
        else { alert("Secure Cloud Sync Enabled."); await syncDashboardToCloud(); }
    } catch (error) { alert("Network error."); toggleEl.checked = !isChecked; }
};

window.acceptConsent = async function() {
    localStorage.setItem('vaad_dpdp_consent', 'true'); userConsent = 'true'; window.closeConsentModal();
    if (pendingSaveAction) { await pendingSaveAction(); pendingSaveAction = null; } else { await syncDashboardToCloud(); }
};

window.declineConsent = async function() {
    localStorage.setItem('vaad_dpdp_consent', 'false'); userConsent = 'false'; window.closeConsentModal();
    if (pendingSaveAction) { await pendingSaveAction(); pendingSaveAction = null; }
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

        const dAuth = document.getElementById('drawer-auth'), dUnauth = document.getElementById('drawer-unauth');
        if (dUnauth) dUnauth.style.display = 'none';
        if (dAuth) {
            dAuth.style.display = 'flex';
            document.getElementById('drawer-name').innerText = user.displayName || user.email.split('@')[0];
            document.getElementById('drawer-avatar').src = user.photoURL || 'https://ui-avatars.com/api/?name=' + (user.displayName || user.email) + '&background=random';
        }
        document.getElementById('drawer-logout-btn').style.display = 'block';
        document.getElementById('drawer-dashboard-btn').style.display = 'block';

        try {
            const snap = await getDoc(doc(db, "users", user.uid));
            if (snap.exists()) {
                const data = snap.data();
                currentPlan = data.plan || 'free';
                await syncPermissionUI();
                if (data.practiceCases) {
                    practiceCases = data.practiceCases;
                    localStorage.setItem('vaad_dashboard_cases', JSON.stringify(practiceCases));
                }
            } else {
                await setDoc(doc(db, "users", user.uid), { 
                    name: user.displayName || user.email.split('@')[0], email: user.email, plan: 'free', 
                    cycleStartDate: new Date().toISOString().split('T')[0], joinedAt: new Date().toISOString(), practiceCases: [], permissions: { cloudSync: true }
                });
                currentPlan = 'free';
            }
        } catch (error) { currentPlan = 'free'; }
        window.renderDashboard(); 
    } else {
        document.getElementById('login-btn').style.display = 'flex'; document.getElementById('user-menu').style.display = 'none';
        document.getElementById('drawer-unauth').style.display = 'block'; document.getElementById('drawer-auth').style.display = 'none';
        document.getElementById('drawer-logout-btn').style.display = 'none'; document.getElementById('drawer-dashboard-btn').style.display = 'none';
        currentPlan = 'free'; practiceCases = []; localStorage.removeItem('vaad_dashboard_cases');
    }
    
    document.getElementById('user-badge').innerText = currentPlan.toUpperCase();
    document.getElementById('drawer-badge').innerText = currentPlan.toUpperCase();
    updateSearchLimitUI();
});

window.switchJurisdiction = function(country) {
    activeJurisdiction = country;
    document.querySelectorAll('.indian-tab, .indian-panel').forEach(el => el.style.display = country === 'usa' ? 'none' : 'block');
    document.querySelectorAll('.us-tab').forEach(el => el.style.display = country === 'usa' ? 'block' : 'none');
    document.querySelectorAll('.us-panel').forEach(el => el.style.display = country === 'usa' ? 'none' : 'none'); 
    window.switchTab(country === 'usa' ? 'us-case' : 'cnr');
    window.clearResults();
};

window.switchTab = function(tab) {
    if (!currentUser && tab !== 'cnr' && tab !== 'us-case' && tab !== 'lawyer') { window.openModal(); return; }
    if (currentPlan === 'free' && tab === 'causelist') { alert("Cause List requires a Pro plan."); window.openModal(); return; }
    activeTab = tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    document.querySelectorAll('.form-panel').forEach(p => p.style.display = 'none');
    const targetPanel = document.getElementById('panel-' + tab);
    if (targetPanel) targetPanel.style.display = 'block';
    window.clearResults();
};

window.toggleCnrMode = function() {
    if (currentPlan === 'free' || currentPlan === 'pro') {
        alert("Bulk refresh requires Pro Max or Supreme plan.");
        document.querySelector('input[name="cnr-mode"][value="single"]').checked = true;
        window.openModal(); return;
    }
    const mode = document.querySelector('input[name="cnr-mode"]:checked').value;
    document.getElementById('cnr-single-field').style.display = mode === 'single' ? 'block' : 'none';
    document.getElementById('cnr-bulk-field').style.display = mode === 'bulk' ? 'block' : 'none';
};

window.toggleView = function(viewName) {
    if (viewName === 'dashboard') {
        if (!currentUser) { alert("Please sign in access dashboard."); window.openLoginModal(); return; }
        document.getElementById('view-search').style.display = 'none';
        document.getElementById('view-dashboard').style.display = 'block';
        window.renderDashboard();
    } else {
        document.getElementById('view-dashboard').style.display = 'none';
        document.getElementById('view-search').style.display = 'block';
    }
};

window.toggleMenu = () => { document.getElementById('side-drawer').classList.toggle('open'); document.getElementById('drawer-overlay').classList.toggle('open'); };

window.selectPlan = function(planType) {
    document.querySelectorAll('.pricing-card').forEach(c => c.style.border = '1px solid var(--border)');
    const card = document.getElementById(planType + '-card');
    if(card) card.style.border = '2px solid var(--primary)';
    
    let amount = 99; 
    if (planType === 'promax') amount = 199;
    if (planType === 'supreme') amount = 399;

    const upgradeBtn = document.getElementById('upi-btn-link');
    if (upgradeBtn) {
        upgradeBtn.removeAttribute('href'); 
        upgradeBtn.innerText = `Pay ₹${amount} Securely`;
        upgradeBtn.onclick = (e) => { e.preventDefault(); upgradeBtn.innerText = "Opening Checkout..."; window.payWithRazorpay(planType, amount); };
    }
};

window.payWithRazorpay = function(planType, amountInINR) {
    if (!currentUser) { alert("Please sign in to create your account before upgrading."); window.closeModal(); window.openLoginModal(); return; }
    const options = {
        "key": "rzp_live_SYzqjL2QNwMNDE", 
        "amount": amountInINR * 100,
        "currency": "INR",
        "name": "Vaad",
        "description": `Upgrade to Vaad ${planType.toUpperCase()}`,
        "image": "https://vaad.pages.dev/icon-192.png",
        "handler": function (response) { setTimeout(() => window.location.reload(), 3000); },
        "prefill": { "name": currentUser.displayName || "", "email": currentUser.email || "" },
        "notes": { "userId": currentUser.uid, "planName": planType },
        "theme": { "color": "#1e40af" }
    };
    const rzp = new window.Razorpay(options);
    rzp.on('payment.failed', function (response){ alert(`Payment Failed: ${response.error.description}`); });
    rzp.open();
};

window.openUniversalSearch = function() {
    if (!currentUser) { alert("Please sign in search your practice dashboard."); window.openModal(); return; }
    const modal = document.getElementById('universal-search-modal');
    modal.classList.add('active'); modal.style.display = 'flex'; 
    setTimeout(() => { document.getElementById('uni-search-input').focus(); }, 100);
};

window.closeUniversalSearch = function() {
    document.getElementById('universal-search-modal').classList.remove('active');
    document.getElementById('universal-search-modal').style.display = 'none';
    document.getElementById('uni-search-input').value = '';
    document.getElementById('uni-search-results').innerHTML = '<div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 20px;">Type to search your Practice Dashboard records...</div>';
};

window.runUniversalSearch = function() {
    const query = document.getElementById('uni-search-input').value.toLowerCase().trim();
    const resultsContainer = document.getElementById('uni-search-results');
    if (!query) { resultsContainer.innerHTML = '<div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 20px;">Type to search your Practice Dashboard records...</div>'; return; }

    const matches = practiceCases.filter(c => c.title.toLowerCase().includes(query) || (c.cnr && c.cnr.toLowerCase().includes(query)) || c.totalFee.toString().includes(query));
    if (matches.length === 0) { resultsContainer.innerHTML = `<div style="text-align: center; color: var(--warning-text); font-size: 0.9rem; padding: 20px; background: var(--warning-bg); border-radius: 8px;">No dashboard records found</div>`; return; }

    let html = '';
    matches.forEach(c => {
        const remaining = Math.max(0, c.totalFee - c.collected);
        html += `<div onclick="window.goToDashboardCase(${c.id})" style="padding: 12px; border-bottom: 1px solid var(--border); cursor: pointer; transition: background 0.2s; border-radius: 6px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <div style="font-weight: 600; color: var(--primary);">${c.title}</div>
                <div style="font-size: 0.75rem; font-weight: bold; color: ${remaining > 0 ? 'var(--warning-text)' : 'var(--success-text)'};">${remaining > 0 ? '₹' + remaining + ' Due' : 'Paid'}</div>
            </div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">CNR: ${c.cnr || 'Manual Entry'} • Total: ₹${c.totalFee}</div>
        </div>`;
    });
    resultsContainer.innerHTML = html;
};

window.downloadPDF = async function(cnr, filename) {
    if (!currentUser) { alert("Please sign in to download PDFs."); window.openLoginModal(); return; }
    if (currentPlan === 'free') { alert("PDF Downloads are a Premium feature. Please upgrade your plan."); window.openModal(); return; }

    const btn = document.getElementById('btn-pdf-' + filename.replace(/[^a-zA-Z0-9]/g, ''));
    const originalText = btn ? btn.innerHTML : '📄 Download PDF';
    if (btn) { btn.disabled = true; btn.innerHTML = '⏳ Downloading...'; }

    try {
        const res = await fetch(`${API}/download`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cnr, filename, userId: currentUser.uid }) });
        if (res.status === 403) {
            const errorData = await res.json().catch(() => ({}));
            alert(errorData.message || "PDF download limit reached. Please upgrade your plan.");
            window.openModal();
            if (btn) { btn.disabled = false; btn.innerHTML = originalText; }
            return;
        }
        if (!res.ok) throw new Error("Could not fetch the document from eCourts.");

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a'); a.style.display = 'none'; a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(url);
        
        if (btn) { btn.disabled = false; btn.innerHTML = '✅ Downloaded'; setTimeout(() => btn.innerHTML = originalText, 3000); }
    } catch (e) { alert("Error downloading PDF: " + e.message); if (btn) { btn.disabled = false; btn.innerHTML = originalText; } }
};

window.handleSearch = async function() {
    if (!currentUser) { window.openLoginModal(); return; }
    let endpoint = '', bodyData = {}, renderType = '';

    if (activeJurisdiction === 'usa' && activeTab === 'us-case') { alert("US Case Law search is coming soon."); return; } 
    else if (activeTab === 'lawyer') { alert("Data-Driven Lawyer Discovery available soon."); return; } 
    else if (activeTab === 'cnr') {
        const mode = document.querySelector('input[name="cnr-mode"]:checked').value;
        if (mode === 'single') {
            const query = document.getElementById('cnr-input').value.trim();
            if (!query) return;
            endpoint = `${API}/cnr`; bodyData = { userId: currentUser.uid, cnr: query }; renderType = 'cnr';
        } else {
            const cnrs = document.getElementById('cnr-bulk-input').value.trim().split('\n').map(c => c.trim()).filter(c => c.length > 5);
            if (!cnrs.length) return;
            if (cnrs.length > 50) return alert("Max 50 CNRs allowed.");
            endpoint = `${API}/bulk-refresh`; bodyData = { userId: currentUser.uid, cnrs: cnrs }; renderType = 'bulk';
        }
    } else if (activeTab === 'causelist') {
        const state = document.getElementById('causelist-state').value.trim().toUpperCase();
        const query = document.getElementById('causelist-query').value.trim();
        if (!state || !query) return alert("Provide State Code and Query.");
        endpoint = `${API}/causelist`; bodyData = { userId: currentUser.uid, query: query, state: state, limit: 20 }; renderType = 'causelist';
    } else {
        let query = document.getElementById(activeTab + '-input').value.trim();
        if (!query) return;
        endpoint = `${API}/search`; bodyData = { userId: currentUser.uid, query: query, type: activeTab }; renderType = 'list';
    }

    await performSearch(endpoint, bodyData, renderType);
};

window.fetchCaseDetails = async function(cnr) {
    if (!cnr || cnr === '—') return showError("No CNR available for this case.");
    
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = `<div style="text-align:center; padding: 40px 20px;"><div class="spinner" style="margin: 0 auto 16px; border-color: var(--primary); border-top-color: transparent; width: 24px; height: 24px;"></div><div style="font-weight:600; color: var(--text-main);">Pulling full case records from eCourts...</div></div>`;
    
    try {
        const res = await fetch(`${API}/cnr`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: currentUser.uid, cnr: cnr }) });
        const json = await res.json();

        if (res.status === 403) { showError(json.message || 'Search limit reached. Please upgrade.'); window.openModal(); return; }
        if (!res.ok || !json.success) return showError(json.error || 'Failed to fetch details.');

        updateSearchLimitUI();
        renderCaseDetail(json.data);
    } catch (e) { showError(`Network Error: ${e.message}`); }
};

async function performSearch(endpoint, bodyData, renderType) {
    setLoading(true); window.clearResults();
    try {
        const res = await fetch(endpoint, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(bodyData) });
        const json = await res.json();

        if (res.status === 403) {
            if (json.error === 'subscription_expired') { showError(json.message || 'Your Pro subscription has expired. Please renew to continue.'); } 
            else { showError(json.message || json.error || 'Search limit reached. Please upgrade your plan.'); }
            window.openModal(); return;
        }
        if (res.status === 401) { showError('Please sign in to search.'); window.openLoginModal(); return; }
        if (!res.ok || !json.success) return showError(json.error || 'The official API failed to fetch records.');

        updateSearchLimitUI();

        if (renderType === 'cnr') renderCaseDetail(json.data);
        else if (renderType === 'list') renderCaseList(json.data);
        else if (renderType === 'causelist') {
             const resultsContainer = document.getElementById('results');
             let html = `<div style="margin-bottom: 15px; cursor: pointer; color: var(--text-muted); font-size: 14px; text-decoration: underline;" onclick="window.clearResults()">← Back to search</div><h3 style="margin-bottom: 15px;">Today's Cause List</h3>`;
             if (!json.data || !json.data.results || json.data.results.length === 0) html += `<div>No cases listed today.</div>`;
             else {
                 json.data.results.forEach(c => {
                     html += `<div style="background: var(--bg); padding: 16px; border: 1px solid var(--border); border-radius: 16px; margin-bottom: 12px; box-shadow: var(--shadow-sm);"><div style="font-weight: 600; margin-bottom: 4px;">${c.caseNumber || 'Unknown Case'}</div><div style="font-size: 13px; color: var(--text-muted);">Court: ${c.courtName || '—'}</div><div style="font-size: 12px; margin-top: 8px;"><span style="background: var(--primary-bg); color: var(--primary); padding: 4px 8px; border-radius: 6px; font-weight: 600;">Room: ${c.courtNo || '—'}</span></div></div>`;
                 });
             }
             resultsContainer.innerHTML = html;
        }
        else if (renderType === 'bulk') {
             document.getElementById('results').innerHTML = `<div style="background: var(--success-bg); color: var(--success-text); padding: 16px; border: 1px solid #a7f3d0; border-radius: 12px;"><h3 style="margin-bottom: 8px;">Bulk Refresh Initiated ✓</h3><p style="font-size: 0.9rem;">Your CNRs queued fresh scrape. individually in 1-2 minutes.</p><div style="margin-top: 12px; cursor: pointer; text-decoration: underline; font-size: 0.85rem;" onclick="window.clearResults()">← Start New Search</div></div>`;
        }
    } catch (e) { showError(`Network Error: ${e.message}`); } finally { setLoading(false); }
}

async function updateSearchLimitUI() {
    const limitText = document.getElementById('limit-text');
    const upgradeBtn = document.getElementById('nav-upgrade-btn');
    if (!currentUser) { if (limitText) limitText.innerText = "Sign in to get 1 free search"; if (upgradeBtn) upgradeBtn.style.display = 'none'; return; }

    const maxLimit = limits[currentPlan] ? limits[currentPlan].search : 1;
    if (limitText) limitText.innerHTML = `<span style="color:var(--text-muted); font-weight:600;">Loading...</span>`;

    try {
        const snap = await getDoc(doc(db, 'users', currentUser.uid));
        const data = snap.exists() ? snap.data() : {};
        const used = data.searchCount || 0;
        const remaining = Math.max(0, maxLimit - used);

        const cycleStart = data.cycleStartDate ? new Date(data.cycleStartDate) : new Date();
        const diffDays = Math.floor((new Date() - cycleStart) / (1000 * 60 * 60 * 24));
        const isExpired = currentPlan !== 'free' && diffDays >= 30;

        if (isExpired) {
            if (limitText) limitText.innerHTML = `<span style="color:#ef4444; font-weight:600;">Subscription Expired</span>`;
            if (upgradeBtn) { upgradeBtn.style.display = 'inline-block'; upgradeBtn.innerText = "⚡ Renew"; upgradeBtn.onclick = () => window.openModal(); }
            return;
        }
        const daysText = currentPlan !== 'free' ? `(${Math.max(0, 30 - diffDays)}d left) • ` : '';
        if (limitText) limitText.innerHTML = `<span style="color:var(--primary); font-weight:600;">${currentPlan.toUpperCase()} ${daysText}${remaining}/${maxLimit} Searches Left</span>`;
        if (currentPlan === 'supreme' && !isExpired && upgradeBtn) upgradeBtn.style.display = 'none';
        else if (upgradeBtn) { upgradeBtn.style.display = 'inline-block'; upgradeBtn.innerText = "⚡ Upgrade"; upgradeBtn.onclick = () => window.openModal(); }
    } catch (e) { console.error(e); }
}

window.clearResults = function() { const el = document.getElementById('results'); if (el) el.innerHTML = ''; };
function showError(message) { const el = document.getElementById('results'); if (el) el.innerHTML = `<div style="background: var(--warning-bg); color: var(--warning-text); padding: 16px; border-radius: 12px; border: 1px solid #fcd34d; font-size: 14px; display: flex; align-items: center; gap: 8px;">⚠️ ${message}</div>`; }

window.goToDashboardCase = function(id) {
    window.closeUniversalSearch(); window.toggleView('dashboard');
    setTimeout(() => { const el = document.getElementById('dashboard-case-' + id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 200);
};

function setLoading(on) {
    const btn = document.getElementById('search-btn'); if (!btn) return;
    btn.disabled = on;
    btn.innerHTML = on ? '<div class="spinner"></div><span style="margin-left: 8px;">Fetching...</span>' : '<span id="btn-text">Search Cases</span>';
}

function renderCaseList(resultsArray) {
    if (!resultsArray || resultsArray.length === 0) return showError('No cases found.'); 
    let html = `<div style="margin-bottom: 15px; cursor: pointer; color: var(--text-muted); font-size: 14px; text-decoration: underline;" onclick="window.clearResults()">← Back to search</div><div style="font-size: 16px; font-weight: 600; margin-bottom: 15px; color: var(--text-main);">Found ${resultsArray.length} cases (Click to view details):</div>`;
    resultsArray.forEach(data => {
        html += `<div onclick="window.fetchCaseDetails('${data.cnr}')" style="background: var(--bg); padding: 16px; border-radius: 16px; border: 1px solid var(--border); margin-bottom: 12px; box-shadow: var(--shadow-sm); cursor: pointer; transition: all 0.2s;" onmouseover="this.style.transform='translateY(-2px)'; this.style.borderColor='var(--primary)';" onmouseout="this.style.transform='translateY(0)'; this.style.borderColor='var(--border)';">
            <div style="display: flex; justify-content: space-between; align-items: start;">
                <div style="padding-right: 15px;">
                    <div style="font-size: 15px; font-weight: 700; color: var(--text-main); margin-bottom: 4px; word-break: break-word;">${(data.petitioners||['—'])[0]} vs ${(data.respondents||['—'])[0]}</div>
                    <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 8px; font-family: monospace;">CNR: ${data.cnr || '—'}</div>
                </div>
                <div style="font-size: 11px; font-weight: bold; background: var(--primary-bg); color: var(--primary); padding: 4px 10px; border-radius: 50px; white-space: nowrap;">${data.caseStatus || 'Pending'}</div>
            </div>
            <div style="margin-top: 8px; font-size: 12px; color: var(--primary); font-weight: 600;">View Full Docket & PDFs →</div>
        </div>`;
    });
    document.getElementById('results').innerHTML = html;
}

// ✨ UPGRADED COMPREHENSIVE CASE DETAILS UI ✨
function renderCaseDetail(payload) {
    if (!payload || !payload.data || !payload.data.courtCaseData) return showError('Invalid API data.'); 
    const data = payload.data.courtCaseData;
    
    let html = `
        <div style="margin-bottom: 15px; cursor: pointer; color: var(--text-muted); font-size: 14px; text-decoration: underline; display: inline-block; font-weight: 600;" onclick="window.clearResults()">← Back to search</div>
        <div style="background: var(--bg); padding: 24px; border-radius: 24px; border: 1px solid var(--border); box-shadow: var(--shadow-sm);">
            
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
                <div>
                    <div style="font-size: 22px; font-weight: 800; margin-bottom: 8px; color: var(--text-main); line-height: 1.3;">${(data.petitioners||['—'])[0]} <span style="color: var(--text-muted); font-size: 16px; font-weight: 600;">vs</span> ${(data.respondents||['—'])[0]}</div>
                    <div style="font-size: 15px; color: var(--primary); margin-bottom: 24px; font-family: monospace; font-weight: 600; background: var(--primary-bg); display: inline-block; padding: 4px 12px; border-radius: 8px;">CNR: ${data.cnr}</div>
                </div>
                <div style="font-size: 12px; font-weight: 700; background: ${data.caseStatus === 'Disposed' ? 'var(--success-bg)' : 'var(--warning-bg)'}; color: ${data.caseStatus === 'Disposed' ? 'var(--success-text)' : 'var(--warning-text)'}; padding: 6px 12px; border-radius: 50px; white-space: nowrap; text-transform: uppercase; letter-spacing: 0.05em;">
                    ${data.caseStatus || 'Pending'}
                </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px;">
                <div style="background: var(--bg-alt); padding: 16px; border-radius: 16px; border: 1px solid var(--border);">
                    <div style="font-size: 11px; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">Court Details</div>
                    <div style="font-weight: 600; margin-top: 6px; color: var(--text-main); font-size: 14px;">${data.courtName || '—'}</div>
                    <div style="color: var(--text-muted); font-size: 13px; margin-top: 4px;">Judge: ${data.judge || '—'}</div>
                </div>
                <div style="background: var(--bg-alt); padding: 16px; border-radius: 16px; border: 1px solid var(--border);">
                    <div style="font-size: 11px; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">Case Info</div>
                    <div style="font-weight: 600; margin-top: 6px; color: var(--text-main); font-size: 14px;">Type: ${data.caseType || '—'}</div>
                    <div style="color: var(--text-muted); font-size: 13px; margin-top: 4px;">Filing Date: ${data.filingDate || '—'}</div>
                    <div style="color: var(--text-muted); font-size: 13px; margin-top: 2px;">Next Hearing: ${data.nextHearingDate || '—'}</div>
                </div>
                ${data.acts && data.acts.length > 0 ? `
                <div style="background: var(--bg-alt); padding: 16px; border-radius: 16px; border: 1px solid var(--border);">
                    <div style="font-size: 11px; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">Acts & Sections</div>
                    <div style="font-weight: 600; margin-top: 6px; color: var(--text-main); font-size: 13px; line-height: 1.5;">${data.acts.map(a => `${a.act} (Sec: ${a.section})`).join('<br>')}</div>
                </div>` : ''}
            </div>`;

    if (data.history && data.history.length > 0) {
        html += `<div style="font-weight: 800; border-bottom: 2px solid var(--border); padding-bottom: 8px; margin-bottom: 16px; margin-top: 32px; color: var(--text-main); font-size: 1.1rem;">Case History & Orders</div>`;
        data.history.forEach(item => {
            const hasPdf = item.judgement || item.orderPdf || item.pdfFilename; 
            const filename = hasPdf ? (item.judgement || item.orderPdf || item.pdfFilename) : null;
            
            html += `
            <div style="background: var(--bg-alt); padding: 16px; border-radius: 16px; margin-bottom: 12px; border: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                <div style="flex: 1; min-width: 200px;">
                    <div style="font-weight: 700; font-size: 14px; color: var(--text-main); display: flex; align-items: center; gap: 8px;">
                        📅 ${item.dateOfOrder || item.hearingDate || 'N/A'}
                    </div>
                    <div style="color: var(--text-muted); font-size: 13px; margin-top: 6px;"><strong>Judge:</strong> ${item.judge || '—'}</div>
                    <div style="color: var(--text-muted); font-size: 13px; margin-top: 2px;"><strong>Purpose:</strong> ${item.purpose || '—'}</div>
                </div>`;
            
            if (filename) {
                const safeId = filename.replace(/[^a-zA-Z0-9]/g, '');
                html += `<div style="display: flex; gap: 8px;"><button id="btn-pdf-${safeId}" onclick="window.downloadPDF('${data.cnr}', '${filename}')" style="background: var(--primary); color: white; border: none; padding: 10px 16px; border-radius: 50px; font-size: 0.85rem; cursor: pointer; font-weight: 600; min-width: 140px; transition: all 0.2s; box-shadow: 0 4px 10px rgba(30, 64, 175, 0.2);">📄 Download PDF</button></div>`;
            } else {
                html += `<div style="font-size: 12px; color: var(--text-muted); font-style: italic; background: rgba(0,0,0,0.05); padding: 6px 12px; border-radius: 50px; font-weight: 600;">No Document Uploaded</div>`;
            }
            html += `</div>`;
        });
    }

    html += `<button class="btn-action btn-ai" onclick="window.openAddCaseModal(); document.getElementById('track-cnr').value='${data.cnr}'; document.getElementById('track-title').value='${(data.petitioners||['—'])[0]} vs ${(data.respondents||['—'])[0]}';" style="margin-top: 32px; width: 100%; justify-content: center; padding: 16px; font-size: 1rem; border-radius: 50px; background: var(--primary-bg); color: var(--primary); border: 2px dashed var(--primary); font-weight: 800; cursor: pointer; transition: all 0.2s;">
               💼 Track this Case in My Ledger
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
        practiceCases.unshift({ id: Date.now(), cnr: cnr, title: title, totalFee: total, perHearing: perHearing, collected: 0, payments: [] });
        localStorage.setItem('vaad_dashboard_cases', JSON.stringify(practiceCases));
        await syncDashboardToCloud(); 
        
        document.getElementById('track-cnr').value = ''; document.getElementById('track-title').value = ''; document.getElementById('track-total').value = ''; document.getElementById('track-hearing').value = '';
        window.closeAddCaseModal(); window.toggleView('dashboard');
    };

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
        await syncDashboardToCloud(); window.renderDashboard();
    }
};

window.deleteDashboardCase = async function(id) {
    if (!confirm("Are permanently delete this case? payment history lost.")) return;
    practiceCases = practiceCases.filter(c => c.id !== id);
    localStorage.setItem('vaad_dashboard_cases', JSON.stringify(practiceCases));
    await syncDashboardToCloud(); window.renderDashboard();
};

window.deletePaymentLog = async function(caseId, paymentIndex) {
    if (!confirm("Delete payment log?")) return;
    const caseIndex = practiceCases.findIndex(c => c.id === caseId);
    if (caseIndex > -1) {
        const pAmount = practiceCases[caseIndex].payments[paymentIndex].amount;
        practiceCases[caseIndex].collected -= pAmount; 
        practiceCases[caseIndex].payments.splice(paymentIndex, 1);
        localStorage.setItem('vaad_dashboard_cases', JSON.stringify(practiceCases));
        await syncDashboardToCloud(); window.renderDashboard();
    }
};

window.renderDashboard = function() {
    let totalExpected = 0, totalCollected = 0, html = '';

    if (practiceCases.length === 0) { html = `<div style="text-align:center; padding: 40px 20px; color: var(--text-muted); border: 1px dashed var(--border); border-radius: 16px;">No cases tracked ledger empty.</div>`; }

    practiceCases.forEach(c => {
        totalExpected += c.totalFee; totalCollected += c.collected;
        const remaining = Math.max(0, c.totalFee - c.collected);
        
        let paymentsHtml = '';
        if (c.payments && c.payments.length > 0) {
            paymentsHtml = `<div style="font-size: 0.85rem; margin-top: 16px; border-top: 1px solid var(--border); padding-top: 12px;">
                <div style="font-weight: 700; margin-bottom: 8px; color: var(--text-main);">Payment History</div>`;
            const reversedPayments = c.payments.map((p, i) => ({...p, originalIndex: i})).reverse();
            reversedPayments.forEach(p => {
                paymentsHtml += `<div style="display:flex; justify-content: space-between; border-bottom: 1px dashed var(--border); padding: 8px 0; align-items: center;">
                    <span style="color: var(--text-muted);">${p.date}</span>
                    <div style="display: flex; gap: 12px; align-items: center;">
                        <span style="color: var(--success-text); font-weight: 700;">+ ₹${p.amount}</span>
                        <button onclick="window.deletePaymentLog(${c.id}, ${p.originalIndex})" style="background: var(--bg-alt); border: none; color: var(--error-text); cursor: pointer; font-size: 1.1rem; line-height: 1; padding: 2px 6px; border-radius: 50%;" title="Delete Payment">×</button>
                    </div>
                </div>`;
            });
            paymentsHtml += `</div>`;
        }

        html += `
        <div id="dashboard-case-${c.id}" style="background: var(--bg); border: 1px solid var(--border); border-radius: 24px; margin-bottom: 20px; padding: 20px; box-shadow: var(--shadow-sm); transition: box-shadow 0.3s ease;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 16px; align-items: flex-start;">
                <div>
                    <div style="font-weight: 700; font-size: 1.1rem; color: var(--text-main);">${c.title}</div>
                    <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">CNR: ${c.cnr || 'Manual Entry'}</div>
                </div>
                <div style="text-align: right;">
                    <div style="display: flex; align-items: center; justify-content: flex-end; gap: 8px; margin-bottom: 4px;">
                        <div style="font-size: 0.75rem; background: ${remaining > 0 ? 'var(--warning-bg)' : 'var(--success-bg)'}; color: ${remaining > 0 ? 'var(--warning-text)' : 'var(--success-text)'}; padding: 4px 10px; border-radius: 50px; font-weight: 700;">
                            ${remaining > 0 ? `₹${remaining} Pending` : 'Paid ✓'}
                        </div>
                        <button onclick="window.deleteDashboardCase(${c.id})" style="background: var(--bg-alt); border: none; color: var(--error-text); cursor: pointer; font-size: 1rem; padding: 6px; border-radius: 50%; transition: background 0.2s;" title="Delete Case">🗑️</button>
                    </div>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; background: var(--bg-alt); padding: 16px; border-radius: 16px; margin-bottom: 16px; text-align: center; border: 1px solid var(--border);">
                <div><div style="font-size: 0.7rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Total Fee</div><div style="font-weight: 700; color: var(--text-main); margin-top: 4px;">₹${c.totalFee}</div></div>
                <div><div style="font-size: 0.7rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Per Hearing</div><div style="font-weight: 700; color: var(--text-main); margin-top: 4px;">₹${c.perHearing}</div></div>
                <div><div style="font-size: 0.7rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Collected</div><div style="font-weight: 700; color: var(--success-text); margin-top: 4px;">₹${c.collected}</div></div>
            </div>

            <div style="display: flex; gap: 8px;">
                <input type="number" id="pay-input-${c.id}" placeholder="${c.perHearing > 0 ? '₹' + c.perHearing : '₹ Amount'}" style="flex: 1; padding: 12px 16px; border: 1px solid var(--border); border-radius: 50px; font-size: 0.95rem; background: var(--bg-alt);" ${remaining === 0 ? 'disabled' : ''}>
                <button class="btn-action" onclick="window.logPayment(${c.id})" style="background: var(--success-text); color: white; border: none; padding: 12px 20px; border-radius: 50px; font-weight: 600;" ${remaining === 0 ? 'disabled' : ''}>Log Payment</button>
            </div>
            
            ${paymentsHtml}
        </div>`;
    });

    document.getElementById('dashboard-cases').innerHTML = html;
    document.getElementById('stat-expected').innerText = `₹${totalExpected}`;
    document.getElementById('stat-collected').innerText = `₹${totalCollected}`;
    document.getElementById('stat-pending').innerText = `₹${Math.max(0, totalExpected - totalCollected)}`;
};

window.openAI = async function() {
    if (!currentUser) { alert("Please sign in to use AI Assistant."); return; }
    document.getElementById('ai-sidebar').classList.add('active');
    document.getElementById('ai-overlay').style.display = 'block';
};
window.closeAI = function() {
    document.getElementById('ai-sidebar').classList.remove('active');
    document.getElementById('ai-overlay').style.display = 'none';
};

document.addEventListener('keydown', e => { if (e.key === 'Enter' && document.getElementById('view-search').style.display !== 'none') window.handleSearch(); });

if ('serviceWorker' in navigator) { window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js'); }); }
