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

const limits = {
    free: { searches: 1, pdfs: 0 },
    pro: { searches: 30, pdfs: 0 },
    promax: { searches: 100, pdfs: 0 },
    supreme: { searches: 150, pdfs: 30 }
};

let activeTab = 'cnr';

onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
        document.getElementById('login-btn').style.display = 'none';
        document.getElementById('user-menu').style.display = 'flex';
        document.getElementById('user-name').innerText = user.displayName.split(' ')[0];
        document.getElementById('user-avatar').src = user.photoURL;

        try {
            const userRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                currentPlan = userSnap.data().plan || 'free';
            } else {
                await setDoc(userRef, { name: user.displayName, email: user.email, plan: 'free', joinedAt: new Date().toISOString() });
                currentPlan = 'free';
            }
        } catch (error) {
            currentPlan = 'free';
        }
    } else {
        document.getElementById('login-btn').style.display = 'flex';
        document.getElementById('user-menu').style.display = 'none';
        currentPlan = 'free';
    }
    
    updateSearchLimitUI();
    updateTabLocks();
});

setTimeout(() => {
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    if (loginBtn) loginBtn.onclick = () => signInWithPopup(auth, provider);
    if (logoutBtn) logoutBtn.onclick = () => signOut(auth);
}, 500);

function updateTabLocks() {
    const cnrLock = document.getElementById('cnr-lock');
    if (cnrLock) {
        // CNR is unlocked for Free, ProMax, and Supreme. (Pro users get locked out of CNR)
        if (currentPlan === 'promax' || currentPlan === 'supreme' || currentPlan === 'free') {
            cnrLock.style.display = 'none';
        } else {
            cnrLock.style.display = 'inline';
        }
    }
}

window.switchTab = function(tab) {
    // Free users cannot use list tabs
    if (currentPlan === 'free' && tab !== 'cnr') {
        window.openModal();
        return;
    }
    
    // Pro users cannot use CNR tab
    if (currentPlan === 'pro' && tab === 'cnr') {
        window.openModal();
        return;
    }

    activeTab = tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    document.querySelectorAll('.form-panel').forEach(p => p.style.display = 'none');
    document.getElementById('panel-' + tab).style.display = 'block';
    window.clearResults();
};

window.closeModal = function() { 
    const modal = document.getElementById('upgrade-modal');
    if (modal) modal.style.display = 'none'; 
};

window.openModal = function() { 
    const modal = document.getElementById('upgrade-modal');
    if (modal) modal.style.display = 'flex'; 
};

window.handleSearch = async function() {
    let query = '';
    
    if (activeTab === 'cnr') query = document.getElementById('cnr-input').value.trim();
    if (activeTab === 'litigant') query = document.getElementById('litigant-input').value.trim();
    if (activeTab === 'advocate') query = document.getElementById('advocate-input').value.trim();
    if (activeTab === 'judge') query = document.getElementById('judge-input').value.trim();

    if (!query) return;

    if (!currentUser) {
        signInWithPopup(auth, provider);
        return;
    }

    const date = new Date();
    const monthKey = `${date.getFullYear()}_${date.getMonth()}`;
    const storageKey = `vaad_searches_${currentUser.uid}_${monthKey}`;
    let searchesUsed = parseInt(localStorage.getItem(storageKey) || 0);
    const maxSearchesAllowed = limits[currentPlan].searches;

    if (searchesUsed >= maxSearchesAllowed) { 
        if (currentPlan === 'free') {
            window.openModal();
        } else {
            showError(`Strict Fair Usage Policy (FUP) reached for the ${currentPlan.toUpperCase()} plan. Please wait for limits to reset, or contact gauravkalal1719@gmail.com.`);
        }
        return; 
    }

    if (activeTab === 'cnr' && currentPlan === 'pro') {
        window.openModal();
        return;
    }

    if (activeTab === 'cnr') {
        await performSearch(`${API}/cnr`, { cnr: query }, storageKey, 'cnr');
    } else {
        await performSearch(`${API}/search`, { query: query, type: activeTab }, storageKey, 'list');
    }
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
        else renderCaseList(json.data);
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

    if (currentPlan === 'supreme') {
        if (limitText) limitText.innerHTML = '<span style="color: #8b5cf6; font-weight:600;">Supreme Active - 150 Searches</span>';
        if (upgradeBtn) upgradeBtn.style.display = 'none';
    } else if (currentPlan === 'promax') {
        if (limitText) limitText.innerHTML = '<span style="color: #d4af37; font-weight:600;">Pro Max Active - 100 Searches</span>';
        if (upgradeBtn) { upgradeBtn.style.display = 'block'; upgradeBtn.innerText = "⚡ Get Supreme"; upgradeBtn.onclick = () => window.openModal(); }
    } else if (currentPlan === 'pro') {
        if (limitText) limitText.innerHTML = '<span style="color: var(--primary); font-weight:600;">Pro Active - 30 Searches</span>';
        if (upgradeBtn) { upgradeBtn.style.display = 'block'; upgradeBtn.innerText = "⚡ Get Pro Max"; upgradeBtn.onclick = () => window.openModal(); }
    } else {
        const storageKey = `vaad_searches_${currentUser.uid}_${new Date().getFullYear()}_${new Date().getMonth()}`;
        let searchesUsed = parseInt(localStorage.getItem(storageKey) || 0);
        let remaining = Math.max(0, limits.free.searches - searchesUsed);
        if (limitText) limitText.innerText = `Free searches remaining: ${remaining}/${limits.free.searches}`;
        if (upgradeBtn) { upgradeBtn.style.display = 'block'; upgradeBtn.innerText = "⚡ Upgrade"; upgradeBtn.onclick = () => window.openModal(); }
    }
}

function setLoading(on) {
    const btn = document.getElementById('search-btn');
    if (!btn) return;
    btn.disabled = on;
    btn.innerHTML = on ? '<div class="spinner"></div><span>Fetching...</span>' : '<span id="btn-text">Search Cases</span>';
}

function renderCaseList(resultsArray) {
    hidePlaceholder();
    if (!resultsArray || resultsArray.length === 0) { 
        showError('No cases found for this search query.'); 
        return; 
    }

    let html = `<div style="margin-bottom: 15px; cursor: pointer; color: var(--text-muted); font-size: 14px; text-decoration: underline;" onclick="window.clearResults()">← Back to search</div>
                <div style="font-size: 16px; font-weight: 600; margin-bottom: 15px; color: var(--text-primary);">Found ${resultsArray.length} recent cases:</div>`;

    resultsArray.forEach(data => {
        const petitioner = (data.petitioners && data.petitioners.length > 0) ? data.petitioners[0] : 'Unknown Petitioner';
        const respondent = (data.respondents && data.respondents.length > 0) ? data.respondents[0] : 'Unknown Respondent';
        const cnr = data.cnr || '—';
        const status = data.caseStatus || 'Pending';
        
        html += `
        <div style="background: var(--bg-secondary); padding: 15px; border-radius: 8px; border: 1px solid var(--border-color); margin-bottom: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: start;">
                <div style="padding-right: 15px;">
                    <div style="font-size: 15px; font-weight: 600; color: var(--text-primary); margin-bottom: 4px; word-break: break-word;">${petitioner} vs ${respondent}</div>
                    <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 8px;">CNR: ${cnr}</div>
                </div>
                <div style="font-size: 11px; font-weight: bold; background: var(--primary-light); color: var(--primary); padding: 4px 8px; border-radius: 4px; white-space: nowrap;">${status}</div>
            </div>
        </div>`;
    });
    document.getElementById('results').innerHTML = html;
}

function renderCaseDetail(payload) {
    hidePlaceholder();
    if (!payload || !payload.data || !payload.data.courtCaseData) return showError('Invalid API data.'); 

    const data = payload.data.courtCaseData;
    const title = `${(data.petitioners||['—'])[0]} vs ${(data.respondents||['—'])[0]}`;
    const status = data.caseStatus || 'Pending';
    
    let html = `<div style="margin-bottom: 15px; cursor: pointer; color: var(--text-muted); font-size: 14px; text-decoration: underline;" onclick="window.clearResults()">← Back to search</div>
        <div style="background: var(--bg-secondary); padding: 20px; border-radius: 8px; border: 1px solid var(--border-color);">
            <div style="font-size: 20px; font-weight: 600; color: var(--text-primary); margin-bottom: 5px;">${title}</div>
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
                <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 12px;">Upgrade to the ₹399 Supreme Plan to view the full timeline and download certified PDFs.</div>
                <button class="btn-primary" style="background: #8b5cf6; border: none;">Unlock Case History</button>
            </div>`;
        }
    } else {
        if (history.length > 0) {
            html += `<h3 style="margin-top:25px; margin-bottom: 10px;">Hearing History</h3>
            <div style="overflow-x: auto; background: var(--bg-secondary); border-radius: 8px; border: 1px solid var(--border-color);">
                <table style="width: 100%; text-align: left; border-collapse: collapse; font-size: 13px;">
                    <tr style="background: var(--primary-light); border-bottom: 1px solid var(--border-color);">
                        <th style="padding: 10px;">Date</th><th style="padding: 10px;">Purpose</th><th style="padding: 10px;">Judge</th>
                    </tr>`;
            history.forEach(h => {
                html += `<tr style="border-bottom: 1px solid var(--border-color);">
                    <td style="padding: 10px;">${h.hearingDate || h.businessOnDate}</td>
                    <td style="padding: 10px;">${h.purposeOfListing || '—'}</td>
                    <td style="padding: 10px;">${h.judge || '—'}</td>
                </tr>`;
            });
            html += `</table></div>`;
        }

        if (orders.length > 0) {
            html += `<h3 style="margin-top:25px; margin-bottom: 10px;">Case Orders (PDFs)</h3>
            <div style="display: flex; flex-direction: column; gap: 10px;">`;
            orders.forEach(o => {
                html += `<div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-secondary); padding: 12px; border: 1px solid var(--border-color); border-radius: 6px;">
                    <div>
                        <div style="font-weight: 500; font-size: 14px;">${o.orderDate || 'Order'}</div>
                        <div style="font-size: 12px; color: var(--text-muted);">${o.description || 'Order Document'}</div>
                    </div>
                    <button onclick="downloadPDF(event, '${data.cnr}', '${o.orderUrl}')" style="background: #8b5cf6; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold;">Download PDF</button>
                </div>`;
            });
            html += `</div>`;
        }
    }

    document.getElementById('results').innerHTML = html;
}

// PDF Download Logic with strict FUP controls
window.downloadPDF = async function(event, cnr, filename) {
    const date = new Date();
    const monthKey = `${date.getFullYear()}_${date.getMonth()}`;
    const pdfStorageKey = `vaad_pdfs_${currentUser.uid}_${monthKey}`;
    let pdfsUsed = parseInt(localStorage.getItem(pdfStorageKey) || 0);

    if (pdfsUsed >= limits.supreme.pdfs) {
        alert(`FUP Reached: You have used your ${limits.supreme.pdfs} PDF downloads for this month.`);
        return;
    }

    const btn = event.target;
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

        localStorage.setItem(pdfStorageKey, pdfsUsed + 1);
        btn.innerText = "Downloaded ✓";
        btn.style.background = "#10b981"; 
        btn.style.opacity = "1";

    } catch (e) {
        alert(`Network error: ${e.message}`);
        btn.innerText = "Download Failed";
        btn.disabled = false;
        btn.style.opacity = "1";
    }
};

function showError(msg) {
    hidePlaceholder();
    document.getElementById('results').innerHTML = `<div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: #ef4444; padding: 15px; border-radius: 8px; display: flex; align-items: center; gap: 10px; line-height: 1.5;"><span>⚠</span><span>${msg}</span></div>`;
}
window.clearResults = function() { document.getElementById('results').innerHTML = ''; document.getElementById('placeholder').style.display = 'block'; };
function hidePlaceholder() { document.getElementById('placeholder').style.display = 'none'; }
document.addEventListener('keydown', e => { if (e.key === 'Enter') window.handleSearch(); });
