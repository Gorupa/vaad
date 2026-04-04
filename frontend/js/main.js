window.onerror = function(msg, url, line) { console.error("Script Error:", msg, line); };

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithCredential, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const app = initializeApp({ apiKey: "AIzaSyCW0rBn8YLGfYqdkj3DCn2RPUeYirIpreU", authDomain: "vaad-87fed.firebaseapp.com", projectId: "vaad-87fed", storageBucket: "vaad-87fed.firebasestorage.app", messagingSenderId: "649989985981", appId: "1:649989985981:web:6dcbcdd0babd45f2cb09d4" });
const auth = getAuth(app); const provider = new GoogleAuthProvider(); const db = getFirestore(app);

const API = 'https://vaad-wnul.onrender.com/api';
let currentUser = null, currentPlan = 'free', practiceCases = [];

const limits = {
    free: { search: 1, pdf: 0 }, pro: { search: 30, pdf: 5 },
    promax: { search: 100, pdf: 20 }, supreme: { search: 150, pdf: 50 }
};

window.openLoginModal = () => { document.getElementById('login-modal').classList.add('active'); };
window.closeLoginModal = () => { document.getElementById('login-modal').classList.remove('active'); };
window.openModal = () => { document.getElementById('upgrade-modal').classList.add('active'); };
window.closeModal = () => { document.getElementById('upgrade-modal').classList.remove('active'); };
window.toggleMenu = () => { document.getElementById('side-drawer').classList.toggle('open'); document.getElementById('drawer-overlay').classList.toggle('open'); };
window.toggleView = (v) => { document.getElementById('view-search').style.display = v==='search'?'block':'none'; document.getElementById('view-dashboard').style.display = v==='dashboard'?'block':'none'; if(v==='dashboard') window.renderDashboard(); };
window.switchTab = (t) => {
    if (t === 'causelist' && currentPlan === 'free') { alert("Cause List requires a Pro plan."); window.openModal(); return; }
    document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
    document.querySelector(`[data-tab="${t}"]`).classList.add('active');
    document.querySelectorAll('.form-panel').forEach(p => p.style.display = 'none');
    document.getElementById('panel-'+t).style.display = 'block';
    window.activeTab = t;
};
window.toggleCnrMode = () => {
    if (currentPlan === 'free' || currentPlan === 'pro') {
        alert("Bulk refresh requires Pro Max or Supreme plan.");
        document.querySelector('input[name="cnr-mode"][value="single"]').checked = true;
        window.openModal(); return;
    }
    const mode = document.querySelector('input[name="cnr-mode"]:checked').value;
    document.getElementById('cnr-single-field').style.display = mode === 'single' ? 'block' : 'none';
    document.getElementById('cnr-bulk-field').style.display = mode === 'bulk' ? 'block' : 'none';
};

onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
        document.getElementById('login-btn').style.display = 'none';
        document.getElementById('user-menu').style.display = 'flex';
        const snap = await getDoc(doc(db, "users", user.uid));
        currentPlan = snap.exists() ? (snap.data().plan || 'free') : 'free';
        document.getElementById('user-badge').innerText = currentPlan.toUpperCase();
        document.getElementById('drawer-badge').innerText = currentPlan.toUpperCase();
        updateSearchLimitUI();
    } else {
        document.getElementById('login-btn').style.display = 'block';
        document.getElementById('user-menu').style.display = 'none';
        currentPlan = 'free';
    }
});

async function updateSearchLimitUI() {
    if (!currentUser) return;
    const snap = await getDoc(doc(db, 'users', currentUser.uid));
    const used = snap.exists() ? (snap.data().searchCount || 0) : 0;
    const max = limits[currentPlan] ? limits[currentPlan].search : 1;
    document.getElementById('limit-text').innerText = `${currentPlan.toUpperCase()} Plan: ${Math.max(0, max - used)}/${max} Searches Left`;
}

window.handleSearch = async () => {
    if (!currentUser) return window.openLoginModal();
    let endpoint = '', body = { userId: currentUser.uid }, t = window.activeTab || 'cnr';
    
    if (t === 'cnr') {
        const mode = document.querySelector('input[name="cnr-mode"]:checked').value;
        if (mode === 'single') { endpoint = `${API}/cnr`; body.cnr = document.getElementById('cnr-input').value.trim(); }
        else { endpoint = `${API}/bulk-refresh`; body.cnrs = document.getElementById('cnr-bulk-input').value.split('\n').filter(x=>x.trim()); }
    } else if (t === 'causelist') {
        endpoint = `${API}/causelist`; body.state = document.getElementById('causelist-state').value; body.query = document.getElementById('causelist-query').value;
    } else {
        endpoint = `${API}/search`; body.type = t; body.query = document.getElementById(t+'-input').value;
    }

    document.getElementById('search-btn').disabled = true;
    try {
        const res = await fetch(endpoint, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body) });
        const json = await res.json();
        if (!res.ok) { alert(json.message || json.error); if(res.status===403) window.openModal(); return; }
        document.getElementById('results').innerHTML = `<div style="padding:20px; background:white; border-radius:12px;">Search Successful! Check console or UI. <br><br> ${JSON.stringify(json.data).substring(0,200)}...</div>`;
        updateSearchLimitUI();
    } finally { document.getElementById('search-btn').disabled = false; }
};

window.selectPlan = (p) => {
    document.querySelectorAll('.pricing-card').forEach(c => c.style.border = '1px solid var(--border)');
    document.getElementById(p+'-card').style.border = '2px solid var(--primary)';
    const amt = p==='pro'?99 : p==='promax'?199 : 399;
    document.getElementById('upi-btn-link').innerText = `Pay ₹${amt} Securely`;
    document.getElementById('upi-btn-link').onclick = () => window.payWithRazorpay(p, amt);
};

window.payWithRazorpay = (plan, amt) => {
    if (!currentUser) return window.openLoginModal();
    const rzp = new window.Razorpay({ key: "rzp_live_SYzqjL2QNwMNDE", amount: amt*100, currency: "INR", name: "Vaad", notes: {userId: currentUser.uid, planName: plan}, handler: () => window.location.reload() });
    rzp.open();
};
