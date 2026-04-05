window.onerror = function(msg, url, line) { console.error("Script Error:", msg, line); };

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithCredential, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCW0rBn8YLGfYqdkj3DCn2RPUeYirIpreU",
    authDomain: "vaad-87fed.firebaseapp.com",
    projectId: "vaad-87fed",
    storageBucket: "vaad-87fed.firebasestorage.app",
    messagingSenderId: "649989985981",
    appId: "1:649989985981:web:6dcbcdd0babd45f2cb09d4"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getFirestore(app);

function escapeHtml(str) {
    if (typeof str !== 'string') return String(str || '');
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function getAuthHeaders() {
    if (!currentUser) return { 'Content-Type': 'application/json' };
    const token = await currentUser.getIdToken();
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
}

async function safeFetch(endpoint, options) {
    const res = await fetch(endpoint, options);
    let json;
    try {
        json = await res.json();
    } catch (parseError) {
        throw new Error(`Server returned a non-JSON response (HTTP ${res.status}). The API may be temporarily down.`);
    }
    return { res, json };
}

window.addEventListener('load', () => {
    if (typeof google !== 'undefined' && google.accounts) {
        google.accounts.id.initialize({ client_id: "649989985981-u00i42pgr5taercoj5koqabm5aul58k0.apps.googleusercontent.com", callback: handleCredentialResponse, use_fedcm_for_prompt: true });
    }
});

async function handleCredentialResponse(response) {
    try { await signInWithCredential(auth, GoogleAuthProvider.credential(response.credential)); window.closeLoginModal(); } 
    catch (error) { resetLoginButtons(); }
}

window.openLoginModal = () => { document.getElementById('login-modal').classList.add('active'); };
window.closeLoginModal = () => { document.getElementById('login-modal').classList.remove('active'); document.getElementById('auth-error').style.display = 'none'; resetLoginButtons(); };
window.openWhatsNewModal = () => { document.getElementById('whats-new-modal').classList.add('active'); };
window.closeWhatsNewModal = () => { document.getElementById('whats-new-modal').classList.remove('active'); };
window.openAddCaseModal = () => { document.getElementById('add-case-modal').classList.add('active'); };
window.closeAddCaseModal = () => { document.getElementById('add-case-modal').classList.remove('active'); };
window.openConsentModal = () => { document.getElementById('consent-modal').classList.add('active'); };
window.closeConsentModal = () => { document.getElementById('consent-modal').classList.remove('active'); };
window.openDevModal = () => { const m = document.getElementById('dev-modal'); if(m) m.classList.add('active'); };
window.closeDevModal = () => { const m = document.getElementById('dev-modal'); if(m) m.classList.remove('active'); };
window.openFaqModal = () => { const m = document.getElementById('faq-modal'); if(m) m.classList.add('active'); };
window.closeFaqModal = () => { const m = document.getElementById('faq-modal'); if(m) m.classList.remove('active'); };

window.openModal = () => { 
    const modal = document.getElementById('upgrade-modal');
    if (!modal) return;
    const subtitle = document.getElementById('modal-subtitle');
    ['pro', 'promax', 'supreme'].forEach(p => { const el = document.getElementById(p+'-card'); if(el) el.style.display = 'none'; });
    const upiBox = document.querySelector('.upi-box');
    
    if (currentPlan === 'supreme') {
        document.getElementById('supreme-card').style.display = 'block';
        document.getElementById('supreme-card').style.borderColor = 'var(--primary)';
        if(upiBox) upiBox.style.display = 'none'; 
        if(subtitle) subtitle.innerText = "You are on the highest tier.";
    } else if (currentPlan === 'promax') {
        document.getElementById('supreme-card').style.display = 'block';
        if(upiBox) upiBox.style.display = 'block';
        if(subtitle) subtitle.innerText = "Upgrade to Supreme.";
        window.selectPlan('supreme');
    } else if (currentPlan === 'pro') {
        document.getElementById('promax-card').style.display = 'block';
        document.getElementById('supreme-card').style.display = 'block';
        if(upiBox) upiBox.style.display = 'block';
        if(subtitle) subtitle.innerText = "Select a plan to unlock more.";
        window.selectPlan('promax');
    } else {
        document.getElementById('pro-card').style.display = 'block';
        document.getElementById('promax-card').style.display = 'block';
        document.getElementById('supreme-card').style.display = 'block';
        if(upiBox) upiBox.style.display = 'block';
        if(subtitle) subtitle.innerText = "Pay for secure API access.";
        window.selectPlan('pro');
    }
    modal.classList.add('active'); 
};
window.closeModal = () => { document.getElementById('upgrade-modal').classList.remove('active'); };

function resetLoginButtons() {
    const emailLoginBtn = document.getElementById('email-login-btn');
    if (emailLoginBtn) { emailLoginBtn.innerText = "Sign In / Register"; emailLoginBtn.disabled = false; }
}

const API = 'https://vaad-wnul.onrender.com/api';
let currentUser = null, currentPlan = 'free', activeTab = 'cnr', activeJurisdiction = 'india', syncPermission = true;
let practiceCases = JSON.parse(localStorage.getItem('vaad_dashboard_cases')) || []; 
let userConsent = localStorage.getItem('vaad_dpdp_consent');
let pendingSaveAction = null; 

const limits = { 
    free: { search: 1, pdf: 0, ai: 5 }, 
    pro: { search: 30, pdf: 5, ai: 20 }, 
    promax: { search: 100, pdf: 20, ai: 50 }, 
    supreme: { search: 150, pdf: 50, ai: 100 } 
};

document.addEventListener('click', async (e) => {
    const logoutTarget = e.target.closest('#logout-btn') || e.target.closest('#drawer-logout-btn');
    const emailLoginBtn = e.target.closest('#email-login-btn');
    const googleLoginBtn = e.target.closest('#google-login-btn');

    if (emailLoginBtn) {
        const email = document.getElementById('auth-email').value.trim();
        const password = document.getElementById('auth-password').value;
        const errorDiv = document.getElementById('auth-error');
        if (!email || !password) { errorDiv.innerText = "Please enter both fields."; errorDiv.style.display = "block"; return; }
        emailLoginBtn.innerHTML = '<div class="spinner"></div>'; emailLoginBtn.disabled = true; errorDiv.style.display = "none";
        try {
            await signInWithEmailAndPassword(auth, email, password);
            window.closeLoginModal();
        } catch (error) {
            if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
                try { await createUserWithEmailAndPassword(auth, email, password); window.closeLoginModal(); } 
                catch (registerError) { errorDiv.innerText = registerError.message.replace('Firebase: ', ''); errorDiv.style.display = "flex"; resetLoginButtons(); }
            } else { errorDiv.innerText = error.message.replace('Firebase: ', ''); errorDiv.style.display = "flex"; resetLoginButtons(); }
        }
        return;
    }
    
    if (googleLoginBtn) {
        googleLoginBtn.innerHTML = '<div class="spinner" style="border-top-color:var(--primary);"></div>';
        try { await signInWithPopup(auth, provider); window.closeLoginModal(); } catch (e) { resetLoginButtons(); }
    }
    
    if (logoutTarget) {
        if (e.target.closest('#drawer-logout-btn')) window.toggleMenu();
        signOut(auth).then(() => { window.location.reload(); });
    }
});

async function bulkUploadLocalCases() {
    if (!currentUser || userConsent !== 'true' || !syncPermission) return;
    try {
        for (const c of practiceCases) {
            await setDoc(doc(db, "users", currentUser.uid, "cases", c.id.toString()), c);
        }
    } catch (e) { console.error("Bulk upload failed:", e); }
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
    } catch (e) {
        console.error('[syncPermissionUI] Failed to read permissions:', e);
    }
}

window.toggleCloudSyncPermission = async function() {
    const toggleEl = document.getElementById('syncPermissionToggle');
    const isChecked = toggleEl.checked; 
    if (!currentUser) { alert("Please sign in."); toggleEl.checked = !isChecked; return; }
    try {
        await setDoc(doc(db, 'users', currentUser.uid), { permissions: { cloudSync: isChecked } }, { merge: true });
        syncPermission = isChecked;
        if (!isChecked) {
            alert("Permission revoked. New cases will only save locally.");
        } else {
            alert("Sync Enabled. Backing up local cases...");
            await bulkUploadLocalCases();
        }
    } catch (e) { alert("Network error."); toggleEl.checked = !isChecked; }
};

window.acceptConsent = async function() {
    localStorage.setItem('vaad_dpdp_consent', 'true'); userConsent = 'true'; window.closeConsentModal();
    if (pendingSaveAction) { await pendingSaveAction(); pendingSaveAction = null; } 
    else { await bulkUploadLocalCases(); }
};

window.declineConsent = async function() {
    localStorage.setItem('vaad_dpdp_consent', 'false'); userConsent = 'false'; window.closeConsentModal();
    if (pendingSaveAction) { await pendingSaveAction(); pendingSaveAction = null; }
};

onAuthStateChanged(auth, async (user) => {
    currentUser = user;
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
        document.getElementById('drawer-dashboard-btn').style.display = 'flex';

        try {
            const snap = await getDoc(doc(db, "users", user.uid));
            if (snap.exists()) {
                const data = snap.data();
                currentPlan = data.plan || 'free';
                await syncPermissionUI();
                
                if (userConsent === 'true') {
                    const casesSnap = await getDocs(collection(db, "users", user.uid, "cases"));
                    if (!casesSnap.empty) {
                        practiceCases = casesSnap.docs.map(d => d.data());
                        practiceCases.sort((a, b) => b.id - a.id); 
                        localStorage.setItem('vaad_dashboard_cases', JSON.stringify(practiceCases)); 
                    }
                }
            } else {
                await setDoc(doc(db, "users", user.uid), { name: user.displayName || user.email.split('@')[0], email: user.email, plan: 'free', cycleStartDate: new Date().toISOString().split('T')[0], joinedAt: new Date().toISOString(), permissions: { cloudSync: true }});
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
        if (!currentUser) { window.openLoginModal(); return; }
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
    document.querySelectorAll('.pricing-card').forEach(c => c.style.border = '2px solid var(--border-soft)');
    const card = document.getElementById(planType + '-card');
    if(card) card.style.border = '2px solid var(--primary)';
    
    let amount = 99; 
    if (planType === 'promax') amount = 199;
    if (planType === 'supreme') amount = 399;

    const upgradeBtn = document.getElementById('upi-btn-link');
    if (upgradeBtn) {
        upgradeBtn.removeAttribute('href'); 
        upgradeBtn.innerText = `Pay ₹${amount} Securely`;
        upgradeBtn.onclick = (e) => { e.preventDefault(); window.payWithRazorpay(planType, amount); };
    }
};

window.payWithRazorpay = async function(planType, amountInINR) {
    if (!currentUser) { window.closeModal(); window.openLoginModal(); return; }
    
    const btn = document.getElementById('upi-btn-link');
    const originalText = btn ? btn.innerText : `Pay Securely`;
    if (btn) btn.innerHTML = '<div class="spinner"></div>';

    try {
        const headers = await getAuthHeaders();
        const { res, json: orderData } = await safeFetch(`${API}/initiate-payment`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ plan: planType })
        });

        if (!res.ok || !orderData.success) {
            alert('Could not start payment: ' + (orderData.error || 'Server error'));
            if (btn) btn.innerText = originalText;
            return;
        }

        const order = orderData.data.order;

        const rzp = new window.Razorpay({
            key: "rzp_live_SYzqjL2QNwMNDE", 
            amount: order.amount, 
            currency: order.currency, 
            order_id: order.id,
            name: "Vaad",
            description: `Upgrade to Vaad ${planType.toUpperCase()}`, 
            image: "https://vaad.pages.dev/icon-192.png",
            handler: function (response) { 
                window.closeModal(); 
                document.getElementById('success-modal').classList.add('active'); 
                setTimeout(() => window.location.reload(), 3500); 
            },
            prefill: { name: currentUser.displayName || "", email: currentUser.email || "" },
            notes: { userId: currentUser.uid, planName: planType }, 
            theme: { color: "#1a3a8a" },
            modal: { ondismiss: () => { if (btn) btn.innerText = originalText; } }
        });
        
        rzp.on('payment.failed', function (r){ 
            alert(`Failed: ${r.error.description}`); 
            if (btn) btn.innerText = originalText; 
        });
        
        rzp.open();
    } catch (err) {
        alert('Network error initializing payment. Please try again.');
        if (btn) btn.innerText = originalText;
    }
};

window.openUniversalSearch = function() {
    if (!currentUser) { window.openModal(); return; }
    document.getElementById('universal-search-modal').classList.add('active');
    setTimeout(() => { document.getElementById('uni-search-input').focus(); }, 100);
};
window.closeUniversalSearch = function() {
    document.getElementById('universal-search-modal').classList.remove('active');
    document.getElementById('uni-search-input').value = '';
    document.getElementById('uni-search-results').innerHTML = '<div class="empty-state" style="padding:20px;"><div class="empty-state-text">Type to search your Dashboard...</div></div>';
};

window.runUniversalSearch = function() {
    const query = document.getElementById('uni-search-input').value.toLowerCase().trim();
    const resultsContainer = document.getElementById('uni-search-results');
    if (!query) { resultsContainer.innerHTML = '<div class="empty-state" style="padding:20px;"><div class="empty-state-text">Type to search your Dashboard...</div></div>'; return; }

    const matches = practiceCases.filter(c => c.title.toLowerCase().includes(query) || (c.cnr && c.cnr.toLowerCase().includes(query)) || c.totalFee.toString().includes(query));
    if (matches.length === 0) { resultsContainer.innerHTML = `<div class="error-box" style="margin-top:16px;">⚠️ No dashboard records found</div>`; return; }

    let html = '';
    matches.forEach(c => {
        const remaining = Math.max(0, c.totalFee - c.collected);
        html += `<div class="dash-case-card" onclick="window.goToDashboardCase(${c.id})" style="cursor:pointer; margin-bottom:8px; padding:12px;">
            <div class="dash-case-title" style="color:var(--primary);">${escapeHtml(c.title)}</div>
            <div style="font-size:0.8rem; color:var(--text-muted); display:flex; justify-content:space-between;">
                <span>CNR: ${escapeHtml(c.cnr) || 'Manual Entry'}</span>
                <span style="color:${remaining>0?'var(--warning-text)':'var(--success-text)'}; font-weight:700;">${remaining>0?'₹'+remaining+' Due':'Paid'}</span>
            </div>
        </div>`;
    });
    resultsContainer.innerHTML = html;
};

window.downloadPDF = async function(cnr, filename) {
    if (!currentUser) { window.openLoginModal(); return; }
    if (currentPlan === 'free') { alert("PDF Downloads are a Premium feature."); window.openModal(); return; }

    const btn = document.getElementById('btn-pdf-' + filename.replace(/[^a-zA-Z0-9]/g, ''));
    const originalText = btn ? btn.innerHTML : '📄 Download';
    if (btn) { btn.disabled = true; btn.innerHTML = '<div class="spinner"></div>'; }

    try {
        const headers = await getAuthHeaders();
        const res = await fetch(`${API}/download`, { method: 'POST', headers: headers, body: JSON.stringify({ cnr, filename }) });
        if (res.status === 403) {
            const errorData = await res.json().catch(() => ({}));
            alert(errorData.message || "PDF download limit reached. Please upgrade.");
            window.openModal();
            if (btn) { btn.disabled = false; btn.innerHTML = originalText; }
            return;
        }
        if (!res.ok) throw new Error("Could not fetch the document.");

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

    if (activeTab === 'cnr') {
        const mode = document.querySelector('input[name="cnr-mode"]:checked').value;
        if (mode === 'single') {
            const query = document.getElementById('cnr-input').value.trim();
            if (!query) return;
            endpoint = `${API}/cnr`; bodyData = { cnr: query }; renderType = 'cnr';
        } else {
            const cnrs = document.getElementById('cnr-bulk-input').value.trim().split('\n').map(c => c.trim()).filter(c => c.length > 5);
            if (!cnrs.length) return;
            if (cnrs.length > 50) return alert("Max 50 CNRs allowed.");
            endpoint = `${API}/bulk-refresh`; bodyData = { cnrs: cnrs }; renderType = 'bulk';
        }
    } else if (activeTab === 'causelist') {
        const state = document.getElementById('causelist-state').value.trim().toUpperCase();
        const query = document.getElementById('causelist-query').value.trim();
        if (!state || !query) return alert("Provide State Code and Query.");
        endpoint = `${API}/causelist`; bodyData = { query: query, state: state, limit: 20 }; renderType = 'causelist';
    } else {
        let query = document.getElementById(activeTab + '-input').value.trim();
        if (!query) return;
        endpoint = `${API}/search`; bodyData = { query: query, type: activeTab }; renderType = 'list';
    }

    await performSearch(endpoint, bodyData, renderType);
};

// ✨ NEW: Handle Statutes Search
window.handleStatuteSearch = async function() {
    if (!currentUser) { window.openLoginModal(); return; }
    
    const query = document.getElementById('statute-input').value.trim().toLowerCase();
    if (!query) return alert("Please enter an Act or Section.");

    window.clearResults();
    document.getElementById('results').innerHTML = `<div class="empty-state"><div class="spinner" style="border-top-color:var(--primary); width:30px; height:30px; margin-bottom:16px;"></div><div class="empty-state-text">Searching India Code database...</div></div>`;

    try {
        // Fetching from the static GitHub JSON file we discussed
        const res = await fetch('https://raw.githubusercontent.com/gaurav-kalal/vaad/main/api/laws.json');
        if (!res.ok) throw new Error("Database unavailable. Ensure laws.json is uploaded to GitHub.");
        
        const lawsData = await res.json();
        
        // Find a matching statute
        const match = lawsData.find(law => 
            law.act.toLowerCase().includes(query) || 
            law.section.toLowerCase().includes(query) || 
            law.title.toLowerCase().includes(query)
        );

        if (match) {
            renderStatuteCard(match);
        } else {
            document.getElementById('results').innerHTML = `<div class="error-box">⚠️ No matching statutes found in database. Try searching 'BNS' or 'Divorce'.</div>`;
        }

    } catch (e) {
        document.getElementById('results').innerHTML = `<div class="error-box">⚠️ Error fetching statute: ${escapeHtml(e.message)}</div>`;
    }
};

function renderStatuteCard(data) {
    const html = `
        <button class="back-link" onclick="window.clearResults()">← Back to search</button>
        <div class="case-detail-card" style="margin-top: 16px;">
            <div class="case-detail-header" style="background: var(--bg-alt); border-bottom: 1px solid var(--border-soft); padding: 20px;">
                <div style="font-size: 0.75rem; color: var(--text-subtle); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">${escapeHtml(data.chapter)}</div>
                <div class="case-detail-title" style="font-size: 1.25rem; color: var(--text-main);">${escapeHtml(data.act)}</div>
                <div class="case-detail-cnr" style="color: var(--primary); font-weight: 600; margin-top: 8px;">${escapeHtml(data.section)}: ${escapeHtml(data.title)}</div>
            </div>
            
            <div style="padding: 24px; font-size: 0.95rem; line-height: 1.8; color: var(--text-main); font-family: 'Georgia', serif;">
                ${escapeHtml(data.text).replace(/\n/g, '<br><br>')}
            </div>
            
            <div style="padding: 16px 24px; background: var(--bg-alt); border-top: 1px solid var(--border-soft); display: flex; gap: 12px;">
                <button class="add-ledger-btn" style="margin: 0; background: var(--bg-main); color: var(--text-main); border-color: var(--border);" onclick="window.print()">
                   🖨️ Print Section
                </button>
            </div>
        </div>
    `;
    document.getElementById('results').innerHTML = html;
}

window.fetchCaseDetails = async function(cnr) {
    if (!cnr || cnr === '—') return showError("No CNR available for this case.");
    document.getElementById('results').innerHTML = `<div class="empty-state"><div class="spinner" style="border-top-color:var(--primary); width:30px; height:30px; margin-bottom:16px;"></div><div class="empty-state-text">Pulling full case records from eCourts...</div></div>`;
    
    try {
        const headers = await getAuthHeaders();
        const { res, json } = await safeFetch(`${API}/cnr`, { method: 'POST', headers: headers, body: JSON.stringify({ cnr: cnr }) });
        
        if (res.status === 403) { showError(json.message || 'Search limit reached. Please upgrade.'); window.openModal(); return; }
        if (!res.ok || !json.success) return showError(json.error || 'Failed to fetch details.');

        updateSearchLimitUI();
        renderCaseDetail(json.data);
    } catch (e) { showError(`Error: ${e.message}`); }
};

async function performSearch(endpoint, bodyData, renderType) {
    setLoading(true); window.clearResults();
    try {
        const headers = await getAuthHeaders();
        const { res, json } = await safeFetch(endpoint, { method: 'POST', headers: headers, body: JSON.stringify(bodyData) });

        if (res.status === 403) {
            if (json.error === 'subscription_expired') { showError(json.message || 'Your Pro subscription has expired. Please renew.'); } 
            else { showError(json.message || json.error || 'Search limit reached. Please upgrade your plan.'); }
            window.openModal(); return;
        }
        if (res.status === 401) { showError('Please sign in to search.'); window.openLoginModal(); return; }
        if (!res.ok || !json.success) return showError(json.error || 'The official API failed to fetch records.');

        updateSearchLimitUI();

        if (renderType === 'cnr') renderCaseDetail(json.data);
        else if (renderType === 'list') renderCaseList(json.data);
        else if (renderType === 'causelist') {
             let html = `<button class="back-link" onclick="window.clearResults()">← Back to search</button><div class="orders-section-title" style="margin-top:10px;">Today's Cause List</div>`;
             if (!json.data || !json.data.results || json.data.results.length === 0) html += `<div class="empty-state"><div class="empty-state-text">No cases listed today.</div></div>`;
             else {
                 json.data.results.forEach(c => {
                     html += `<div class="case-card">
                         <div class="case-parties">${escapeHtml(c.caseNumber || 'Unknown Case')}</div>
                         <div class="case-meta"><span class="case-meta-chip">${escapeHtml(c.courtName || '—')}</span><span class="case-status-pill status-pending">Room: ${escapeHtml(c.courtNo || '—')}</span></div>
                     </div>`;
                 });
             }
             document.getElementById('results').innerHTML = html;
        }
        else if (renderType === 'bulk') {
             document.getElementById('results').innerHTML = `<div class="case-card" style="border-left: 4px solid var(--success-text);"><div class="case-parties" style="color:var(--success-text);">Bulk Refresh Initiated ✓</div><p style="font-size:0.9rem; margin-top:8px;">Your CNRs are queued for a fresh scrape.</p><button class="back-link" style="margin-top:16px;" onclick="window.clearResults()">← Start New Search</button></div>`;
        }
    } catch (e) { showError(`Error: ${e.message}`); } finally { setLoading(false); }
}

async function updateSearchLimitUI() {
    const limitText = document.getElementById('limit-text');
    if (!currentUser) { if (limitText) limitText.innerText = "Sign in to search"; return; }

    const maxLimit = limits[currentPlan] ? limits[currentPlan].search : 1;
    if (limitText) limitText.innerHTML = `<span style="color:var(--text-subtle);">Loading...</span>`;

    try {
        const snap = await getDoc(doc(db, 'users', currentUser.uid));
        const data = snap.exists() ? snap.data() : {};
        const used = data.searchCount || 0;
        const remaining = Math.max(0, maxLimit - used);

        const cycleStart = data.cycleStartDate ? new Date(data.cycleStartDate) : new Date();
        const diffDays = Math.floor((new Date() - cycleStart) / (1000 * 60 * 60 * 24));
        const isExpired = currentPlan !== 'free' && diffDays >= 30;

        if (isExpired) {
            if (limitText) limitText.innerHTML = `<span style="color:var(--error-text); font-weight:700;">Subscription Expired</span>`;
            return;
        }
        if (limitText) limitText.innerHTML = `<span style="color:var(--text-main); font-weight:600;">${currentPlan.toUpperCase()} • ${remaining}/${maxLimit} Searches</span>`;
    } catch (e) { console.error(e); }
}

window.clearResults = function() { const el = document.getElementById('results'); if (el) el.innerHTML = ''; };
function showError(message) { const el = document.getElementById('results'); if (el) el.innerHTML = `<div class="error-box">⚠️ ${escapeHtml(message)}</div>`; }

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
    let html = `<button class="back-link" onclick="window.clearResults()">← Back to search</button>`;
    html += `<div class="orders-section-title" style="margin-top:10px; margin-bottom: 16px;">Found ${resultsArray.length} cases</div>`;
    
    resultsArray.forEach(data => {
        const isDisposed = data.caseStatus === 'Disposed' || data.caseStatus === 'DISPOSED';
        const statusClass = isDisposed ? 'status-disposed' : 'status-pending';
        
        html += `
        <div class="case-card" onclick="window.fetchCaseDetails('${escapeHtml(data.cnr)}')">
            <div class="case-card-header">
                <div>
                    <div class="case-parties">${escapeHtml((data.petitioners||['—'])[0])} <span style="color:var(--text-subtle); font-weight:500;">vs</span> ${escapeHtml((data.respondents||['—'])[0])}</div>
                </div>
                <div class="case-status-pill ${statusClass}">${escapeHtml(data.caseStatus || 'Pending')}</div>
            </div>
            <div class="case-meta">
                <span class="case-meta-chip">CNR: ${escapeHtml(data.cnr || '—')}</span>
            </div>
        </div>`;
    });
    document.getElementById('results').innerHTML = html;
}

function renderCaseDetail(payload) {
    if (!payload || !payload.data || !payload.data.courtCaseData) return showError('Invalid API data.'); 
    const data = payload.data.courtCaseData;
    
    const pet = data.petitioners && data.petitioners.length > 0 ? data.petitioners.map(escapeHtml).join('<br>') : '—';
    const res = data.respondents && data.respondents.length > 0 ? data.respondents.map(escapeHtml).join('<br>') : '—';
    const petAdvs = data.petitionerAdvocates && data.petitionerAdvocates.length > 0 ? data.petitionerAdvocates.map(escapeHtml).join(', ') : '—';
    const resAdvs = data.respondentAdvocates && data.respondentAdvocates.length > 0 ? data.respondentAdvocates.map(escapeHtml).join(', ') : '—';
    const disposalNature = escapeHtml(data.natureOfDisposal || data.disposalTypeRaw || '—');

    let html = `<button class="back-link" onclick="window.clearResults()">← Back to search</button>
        <div class="case-detail-card" id="printable-docket">
            
            <div class="case-detail-header">
                <div class="case-detail-court">${escapeHtml(data.courtName || '—')}</div>
                <div class="case-detail-title">${escapeHtml((data.petitioners||['—'])[0])} vs ${escapeHtml((data.respondents||['—'])[0])}</div>
                <div class="case-detail-cnr">CNR: ${escapeHtml(data.cnr)}</div>
            </div>

            <div class="case-info-grid">
                <div class="case-info-cell">
                    <div class="case-info-label">Petitioner</div>
                    <div class="case-info-value" style="margin-bottom:4px;">${pet}</div>
                    <div style="font-size:0.75rem; color:var(--text-subtle);">Counsel: ${petAdvs}</div>
                </div>
                <div class="case-info-cell">
                    <div class="case-info-label">Respondent</div>
                    <div class="case-info-value" style="margin-bottom:4px;">${res}</div>
                    <div style="font-size:0.75rem; color:var(--text-subtle);">Counsel: ${resAdvs}</div>
                </div>
            </div>

            <div class="case-info-grid">
                <div class="case-info-cell">
                    <div class="case-info-label">Case Type</div>
                    <div class="case-info-value">${escapeHtml(data.caseType || '—')}</div>
                </div>
                <div class="case-info-cell">
                    <div class="case-info-label">Status</div>
                    <div class="case-info-value" style="color: ${data.caseStatus === 'DISPOSED' || data.caseStatus === 'Disposed' ? 'var(--success-text)' : 'var(--warning-text)'};">${escapeHtml(data.caseStatus || 'Pending')}</div>
                </div>
                <div class="case-info-cell">
                    <div class="case-info-label">Filing Details</div>
                    <div class="case-info-value">${escapeHtml(data.filingNumber || '—')}</div>
                    <div style="font-size:0.75rem; color:var(--text-subtle);">${escapeHtml(data.filingDate || '—')}</div>
                </div>
                <div class="case-info-cell">
                    <div class="case-info-label">Registration</div>
                    <div class="case-info-value">${escapeHtml(data.registrationNumber || '—')}</div>
                    <div style="font-size:0.75rem; color:var(--text-subtle);">${escapeHtml(data.registrationDate || '—')}</div>
                </div>
            </div>`;

    const hasFirDetails = data.firNumber || data.policeStation || (data.firDetails && Object.keys(data.firDetails).length > 0);
    if (hasFirDetails || data.firstHearingDate || data.nextHearingDate || data.decisionDate) {
        html += `<div class="case-info-grid">
                ${hasFirDetails ? `
                <div class="case-info-cell">
                    <div class="case-info-label">FIR Details</div>
                    <div class="case-info-value">${escapeHtml(data.firNumber || '—')} / ${escapeHtml(data.firYear || '—')}</div>
                    <div style="font-size:0.75rem; color:var(--text-subtle);">Station: ${escapeHtml(data.policeStation || '—')}</div>
                </div>` : ''}
                <div class="case-info-cell" style="grid-column: ${hasFirDetails ? 'auto' : 'span 2'};">
                    <div class="case-info-label">Hearing Info</div>
                    <div style="font-size:0.75rem; color:var(--text-subtle); margin-bottom:4px;">First: ${escapeHtml(data.firstHearingDate || '—')}</div>
                    ${data.caseStatus === 'DISPOSED' || data.caseStatus === 'Disposed' ? `
                        <div class="case-info-value" style="color: var(--error-text);">Decided: ${escapeHtml(data.decisionDate || '—')}</div>
                        <div style="font-size:0.75rem; color:var(--text-subtle);">${disposalNature}</div>
                    ` : `
                        <div class="case-info-value" style="color: var(--primary);">Next: ${escapeHtml(data.nextHearingDate || data.lastHearingDate || '—')}</div>
                    `}
                </div>
            </div>`;
    }

    html += `<div class="case-detail-body">`;

    if (data.acts && data.acts.length > 0) {
        html += `<div class="orders-section-title">Acts & Sections</div>
        <div style="margin-bottom: 24px;">
            ${data.acts.map(a => `<span class="case-meta-chip" style="margin-right:6px; margin-bottom:6px; display:inline-block;">${escapeHtml(a.act)} (Sec: ${escapeHtml(a.section)})</span>`).join('')}
        </div>`;
    }

    const allProcesses = data.processes || [];
    if (allProcesses.length > 0) {
        html += `<div class="orders-section-title" style="margin-top:24px;">Court Processes & Summons</div>`;
        allProcesses.forEach(item => {
            html += `
            <div class="order-item" style="padding-right: 18px;">
                <div class="order-meta">
                    <div class="order-date">📅 ${escapeHtml(item.processDate || 'N/A')}</div>
                    <div class="order-filename" style="margin-top: 6px; white-space: normal; line-height: 1.4;"><strong>${escapeHtml(item.processTitle || '—')}</strong></div>
                </div>
            </div>`;
        });
    }

    const allHearings = data.historyOfCaseHearings || data.history || data.caseHistory || [];
    if (allHearings.length > 0) {
        html += `<div class="orders-section-title" style="margin-top:24px;">Hearing History</div>`;
        allHearings.forEach(item => {
            const date = escapeHtml(item.hearingDate || item.businessOnDate || item.dateOfOrder || 'N/A');
            const purpose = escapeHtml(item.purposeOfListing || item.purpose || '—');
            
            html += `
            <div class="order-item" style="padding-right: 18px;">
                <div class="order-meta">
                    <div class="order-date">📅 ${date}</div>
                    <div class="order-filename" style="margin-top: 6px;"><strong>Judge:</strong> ${escapeHtml(item.judge || '—')}</div>
                    <div class="order-filename" style="margin-top: 2px;"><strong>Purpose:</strong> ${purpose}</div>
                </div>
            </div>`;
        });
    }

    const allOrders = [ ...(data.judgmentOrders || []), ...(data.interimOrders || []), ...(data.orders || []), ...(data.judgements || []) ];
    if (allOrders.length > 0) {
        html += `<div class="orders-section-title" style="margin-top:24px;">Orders & Judgments</div>`;
        allOrders.forEach(item => {
            const filename = item.orderUrl || item.judgement || item.orderPdf || item.pdfFilename; 
            const date = escapeHtml(item.orderDate || item.dateOfOrder || 'N/A');
            const type = escapeHtml(item.description || item.orderType || item.purpose || 'Order');
            
            html += `
            <div class="order-item">
                <div class="order-doc-icon">⚖️</div>
                <div class="order-meta">
                    <div class="order-date">${date}</div>
                    <div class="order-filename">${type}</div>
                </div>`;
            
            if (filename) {
                const safeId = filename.replace(/[^a-zA-Z0-9-]/g, '');
                html += `<button id="btn-pdf-${safeId}" class="order-download-btn" data-cnr="${escapeHtml(data.cnr)}" data-filename="${escapeHtml(filename)}" onclick="window.downloadPDF(this.dataset.cnr, this.dataset.filename)">📄 Download</button>`;
            } else {
                html += `<div style="font-size: 0.7rem; color: var(--text-subtle); font-style: italic;">No PDF</div>`;
            }
            html += `</div>`;
        });
    }

    const safeCnr = escapeHtml(data.cnr);
    const existingCase = practiceCases.find(c => c.cnr && c.cnr.replace(/\s+/g,'').toUpperCase() === data.cnr.toUpperCase());
    const safeTitle = `${escapeHtml((data.petitioners||['—'])[0])} vs ${escapeHtml((data.respondents||['—'])[0])}`.replace(/'/g, "\\'").replace(/"/g, "&quot;");

    let trackButtonHtml = '';
    if (existingCase) {
        trackButtonHtml = `<button class="add-ledger-btn" style="margin: 0; background: var(--success-bg); color: var(--success-text); border-color: var(--success-border);" onclick="window.goToDashboardCase(${existingCase.id})">
           ✅ View in Practice Dashboard
        </button>`;
    } else {
        trackButtonHtml = `<button class="add-ledger-btn" style="margin: 0;" onclick="window.openAddCaseModal(); document.getElementById('track-cnr').value='${safeCnr}'; document.getElementById('track-title').value='${safeTitle}';">
           💼 Track this Case in Ledger
        </button>`;
    }

    html += `
        <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 32px;">
            <div id="ai-summary-box-${safeCnr}"></div>
            
            <button class="add-ledger-btn" style="margin: 0; background: linear-gradient(135deg, var(--gold-light), var(--gold)); color: white; border: none; box-shadow: 0 4px 12px rgba(156,107,30,0.25);" onclick="window.generateAISummary('${safeCnr}')">
               ✨ Generate AI Summary
            </button>
            
            ${trackButtonHtml}

            <button class="add-ledger-btn" style="margin: 0; background: var(--bg-alt); color: var(--text-main); border-color: var(--border);" onclick="window.print()">
               🖨️ Print / Save as PDF
            </button>
        </div>
        </div></div>`;
        
    document.getElementById('results').innerHTML = html;
}

window.saveTrackedCase = async function() {
    const cnrEl = document.getElementById('track-cnr');
    const titleEl = document.getElementById('track-title');
    const totalEl = document.getElementById('track-total');
    const hearingEl = document.getElementById('track-hearing');
    
    if (!cnrEl || !titleEl) return;
    
    const cnr = cnrEl.value.trim();
    const title = titleEl.value.trim();
    const total = parseInt(totalEl.value) || 0;
    const perHearing = parseInt(hearingEl.value) || 0;

    if (!title) return alert("Case Title / Client Name required.");

    const executeSave = async () => {
        const previousCases = JSON.parse(JSON.stringify(practiceCases));
        const newCase = { id: Date.now(), cnr: cnr, title: title, totalFee: total, perHearing: perHearing, collected: 0, payments: [] };
        
        practiceCases.unshift(newCase);
        localStorage.setItem('vaad_dashboard_cases', JSON.stringify(practiceCases));
        window.renderDashboard();
        
        try {
            if (currentUser && userConsent === 'true' && syncPermission) {
                await setDoc(doc(db, "users", currentUser.uid, "cases", newCase.id.toString()), newCase);
            }
            cnrEl.value = ''; titleEl.value = ''; totalEl.value = ''; hearingEl.value = '';
            window.closeAddCaseModal(); 
            window.toggleView('dashboard');
        } catch (e) {
            practiceCases = previousCases;
            localStorage.setItem('vaad_dashboard_cases', JSON.stringify(practiceCases));
            window.renderDashboard();
            alert('Failed to save to cloud. Please check your connection.');
        }
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
    const amount = parseInt(input?.value);
    if (!amount || amount <= 0) return alert("Please enter a valid amount.");

    const previousCases = JSON.parse(JSON.stringify(practiceCases));
    const caseIndex = practiceCases.findIndex(c => c.id === id);
    if (caseIndex > -1) {
        practiceCases[caseIndex].collected += amount;
        practiceCases[caseIndex].payments.push({ date: new Date().toLocaleDateString('en-GB'), amount: amount });
        localStorage.setItem('vaad_dashboard_cases', JSON.stringify(practiceCases));
        window.renderDashboard();
        
        try {
            if (currentUser && userConsent === 'true' && syncPermission) {
                await updateDoc(doc(db, "users", currentUser.uid, "cases", id.toString()), {
                    collected: practiceCases[caseIndex].collected,
                    payments: practiceCases[caseIndex].payments
                });
            }
        } catch (e) {
            practiceCases = previousCases;
            localStorage.setItem('vaad_dashboard_cases', JSON.stringify(practiceCases));
            window.renderDashboard();
            alert('Failed to save payment to cloud. Changes reverted.');
        }
    }
};

window.deleteDashboardCase = async function(id) {
    if (!confirm("Are you sure you want to permanently delete this case? Payment history will be lost.")) return;
    
    const previousCases = JSON.parse(JSON.stringify(practiceCases));
    practiceCases = practiceCases.filter(c => c.id !== id);
    localStorage.setItem('vaad_dashboard_cases', JSON.stringify(practiceCases));
    window.renderDashboard();
    
    try {
        if (currentUser && userConsent === 'true' && syncPermission) {
            await deleteDoc(doc(db, "users", currentUser.uid, "cases", id.toString()));
        }
    } catch(e) {
        practiceCases = previousCases;
        localStorage.setItem('vaad_dashboard_cases', JSON.stringify(practiceCases));
        window.renderDashboard();
        alert('Failed to delete from cloud. Changes reverted.');
    }
};

window.deletePaymentLog = async function(caseId, paymentIndex) {
    if (!confirm("Delete payment log?")) return;
    
    const previousCases = JSON.parse(JSON.stringify(practiceCases));
    const caseIndex = practiceCases.findIndex(c => c.id === caseId);
    if (caseIndex > -1) {
        const pAmount = practiceCases[caseIndex].payments[paymentIndex].amount;
        practiceCases[caseIndex].collected -= pAmount; 
        practiceCases[caseIndex].payments.splice(paymentIndex, 1);
        localStorage.setItem('vaad_dashboard_cases', JSON.stringify(practiceCases));
        window.renderDashboard();
        
        try {
            if (currentUser && userConsent === 'true' && syncPermission) {
                await updateDoc(doc(db, "users", currentUser.uid, "cases", caseId.toString()), {
                    collected: practiceCases[caseIndex].collected,
                    payments: practiceCases[caseIndex].payments
                });
            }
        } catch (e) {
            practiceCases = previousCases;
            localStorage.setItem('vaad_dashboard_cases', JSON.stringify(practiceCases));
            window.renderDashboard();
            alert('Failed to delete payment from cloud. Changes reverted.');
        }
    }
};

window.renderDashboard = function() {
    let totalExpected = 0, totalCollected = 0, html = '';

    if (practiceCases.length === 0) { 
        html = `<div class="empty-state">
            <div class="empty-state-icon">💼</div>
            <div class="empty-state-text">No cases tracked in ledger yet.</div>
        </div>`; 
    }

    practiceCases.forEach((c, index) => {
        totalExpected += c.totalFee; totalCollected += c.collected;
        const remaining = Math.max(0, c.totalFee - c.collected);
        
        let paymentsHtml = '';
        if (c.payments && c.payments.length > 0) {
            paymentsHtml = `<div class="payment-history">
                <div class="payment-history-title">Payment History</div>`;
            const reversedPayments = c.payments.map((p, i) => ({...p, originalIndex: i})).reverse();
            reversedPayments.forEach(p => {
                paymentsHtml += `<div class="payment-row">
                    <span class="payment-date">${escapeHtml(p.date)}</span>
                    <div style="display: flex; gap: 12px; align-items: center;">
                        <span class="payment-amount">+ ₹${p.amount}</span>
                        <button class="payment-delete" onclick="window.deletePaymentLog(${c.id}, ${p.originalIndex})">×</button>
                    </div>
                </div>`;
            });
            paymentsHtml += `</div>`;
        }

        const pendingClass = remaining > 0 ? 'status-pending' : 'status-disposed';
        const pendingText = remaining > 0 ? `₹${remaining} Due` : 'Paid ✓';

        html += `
        <div id="dashboard-case-${c.id}" class="dash-case-card">
            <div class="dash-case-header">
                <div>
                    <div class="dash-case-title">${escapeHtml(c.title)}</div>
                    <div class="dash-case-cnr">CNR: ${escapeHtml(c.cnr) || 'Manual Entry'}</div>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                    <div class="dash-pending-pill ${pendingClass}">${pendingText}</div>
                    <button class="dash-delete-btn" onclick="window.deleteDashboardCase(${c.id})">🗑️</button>
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
                    <div class="dash-stat-val" style="color: var(--success-text);">₹${c.collected}</div>
                </div>
            </div>

            <div class="dash-payment-row">
                <input type="number" id="pay-input-${c.id}" class="dash-payment-input" placeholder="${c.perHearing > 0 ? '₹' + c.perHearing : '₹ Amount'}" ${remaining === 0 ? 'disabled' : ''}>
                <button class="dash-log-btn" onclick="window.logPayment(${c.id})" ${remaining === 0 ? 'disabled' : ''}>Log Payment</button>
            </div>
            
            ${paymentsHtml}
        </div>`;

        // ✨ FEATURE: Native Ad Banner (Only for Free Users, every 3 cases)
        if (currentPlan === 'free' && (index + 1) % 3 === 0) {
            html += `
            <div class="dash-case-card native-ad-card" style="border: 1px dashed var(--border); background: var(--bg-alt); display: flex; gap: 12px; cursor: pointer; padding: 12px; margin-top: 12px; box-shadow: none;" onclick="window.open('https://your-sponsor-link.com', '_blank')">
                <img src="https://raw.githubusercontent.com/gaurav-kalal/vaad/main/assets/ads/mlsu-ad-1.jpg" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px; border: 1px solid var(--border-soft);" alt="Sponsored Ad">
                <div style="flex: 1; display: flex; flex-direction: column; justify-content: center;">
                    <div style="font-size: 0.65rem; color: var(--text-subtle); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; font-weight: 700;">Sponsored</div>
                    <div style="font-weight: 600; color: var(--text-main); font-size: 0.95rem; line-height: 1.2;">MLSU Law Admissions Open</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px; line-height: 1.4;">Best Govt College in Udaipur. Click to explore.</div>
                </div>
            </div>`;
        }
    });

    document.getElementById('dashboard-cases').innerHTML = html;
    document.getElementById('stat-expected').innerText = `₹${totalExpected}`;
    document.getElementById('stat-collected').innerText = `₹${totalCollected}`;
    document.getElementById('stat-pending').innerText = `₹${Math.max(0, totalExpected - totalCollected)}`;
};

window.generateAISummary = async function(cnr) {
    if (!currentUser) { window.openLoginModal(); return; }
    if (currentPlan !== 'supreme') { window.openModal(); return; }

    const safeCnr = escapeHtml(cnr);
    const box = document.getElementById('ai-summary-box-' + safeCnr);
    if (box) box.innerHTML = `<div style="padding: 16px; background: var(--gold-bg); border: 1px solid var(--gold-border); border-radius: 12px; margin-bottom: 12px; font-size: 0.9rem; color: var(--gold); display: flex; align-items: center; gap: 10px;"><div class="spinner" style="border-top-color: var(--gold); width: 16px; height: 16px;"></div> <strong>Analyzing legal docket...</strong></div>`;

    try {
        const headers = await getAuthHeaders();
        const { res, json } = await safeFetch(`${API}/ai-summary`, { 
            method: 'POST', 
            headers: headers, 
            body: JSON.stringify({ cnr: cnr }) 
        });

        if (res.status === 403) {
            box.innerHTML = '';
            alert(json.message || "AI limit reached. Please upgrade.");
            window.openModal(); return;
        }
        if (!res.ok) throw new Error(json.error || "Failed to generate AI summary.");

        const summaryText = escapeHtml(json.data || json.summary || json.message || "AI analysis complete.");
        
        box.innerHTML = `<div style="padding: 16px; background: var(--gold-bg); border: 1px solid var(--gold-border); border-radius: 12px; margin-bottom: 12px; font-size: 0.9rem; line-height: 1.6; color: var(--text-main);">
            <strong style="color: var(--gold); font-size: 1rem; display: block; margin-bottom: 8px;">✨ AI Case Analysis</strong>
            ${summaryText}
        </div>`;
        
        updateSearchLimitUI(); 
    } catch (e) {
        box.innerHTML = `<div class="error-box" style="margin-bottom: 12px;">⚠️ Error: ${escapeHtml(e.message)}</div>`;
    }
};

// ✨ NEW: Ask AI Chat Handler
window.sendChatMessage = async function() {
    if (!currentUser) { window.openLoginModal(); return; }
    
    const inputEl = document.getElementById('ai-chat-input');
    const question = inputEl.value.trim();
    if (!question) return;

    const chatHistory = document.getElementById('chat-history');
    const btn = document.getElementById('ai-send-btn');
    
    chatHistory.innerHTML += `<div class="chat-bubble user">${escapeHtml(question)}</div>`;
    inputEl.value = '';
    btn.disabled = true;
    btn.innerText = '...';
    chatHistory.scrollTop = chatHistory.scrollHeight;

    try {
        const headers = await getAuthHeaders();
        const res = await fetch(`${API}/ask-legal-ai`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ question: question })
        });

        const data = await res.json();
        
        if (res.status === 403) {
            chatHistory.innerHTML += `<div class="chat-bubble ai" style="color: var(--error-text);">You have reached your daily AI limit (5/5). Please upgrade to Pro for more queries.</div>`;
            window.openModal();
        } else if (!res.ok) {
            chatHistory.innerHTML += `<div class="chat-bubble ai" style="color: var(--error-text);">Error: AI is temporarily unavailable.</div>`;
        } else {
            const formattedAnswer = escapeHtml(data.answer).replace(/\n/g, '<br>');
            chatHistory.innerHTML += `<div class="chat-bubble ai"><strong>✨ Legal Insight</strong><br><br>${formattedAnswer}</div>`;
            updateSearchLimitUI();
        }
    } catch (e) {
        chatHistory.innerHTML += `<div class="chat-bubble ai" style="color: var(--error-text);">Network error communicating with AI.</div>`;
    } finally {
        btn.disabled = false;
        btn.innerText = 'Send';
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }
};
