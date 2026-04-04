// js/utils/ui.js
// Owns: all DOM manipulation, modal control, tab/view switching,
//       universal search UI, badge, upgrade modal, AI sidebar.
import { state } from '../state.js';
import { checkFUP } from '../services/fup.js';

// ─── Login Modal ─────────────────────────────────────────────
export function openLoginModal() {
    document.getElementById('login-modal').classList.add('active');
    document.getElementById('login-modal').style.display = 'flex';
}

export function closeLoginModal() {
    document.getElementById('login-modal').classList.remove('active');
    document.getElementById('login-modal').style.display = 'none';
    const authError = document.getElementById('auth-error');
    if (authError) authError.style.display = 'none';
    const authEmail = document.getElementById('auth-email');
    if (authEmail) authEmail.value = '';
    const authPass = document.getElementById('auth-password');
    if (authPass) authPass.value = '';
    resetLoginButtons();
}

export function resetLoginButtons() {
    const emailBtn = document.getElementById('email-login-btn');
    const googleBtn = document.getElementById('google-login-btn');
    if (emailBtn) { emailBtn.innerText = 'Sign In / Register'; emailBtn.disabled = false; }
    if (googleBtn) {
        googleBtn.innerHTML = `<img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" style="width:20px;margin-right:10px;" alt="G"> Continue with Google`;
        googleBtn.disabled = false;
    }
}

// ─── Generic Modal Factory ────────────────────────────────────
export const createGenericModalOpener = (id) => () => {
    const m = document.getElementById(id);
    if (m) { m.classList.add('active'); m.style.display = ''; }
};
export const createGenericModalCloser = (id) => () => {
    const m = document.getElementById(id);
    if (m) m.classList.remove('active');
};

// ─── Upgrade / Payment Modal ──────────────────────────────────
export function openModal() {
    const modal = document.getElementById('upgrade-modal');
    if (!modal) return;
    modal.style.display = '';

    if (!state.currentUser) {
        setPricingCardVisibility(['pro', 'promax', 'supreme'], 'block');
        window.selectPlan('pro');
        modal.classList.add('active');
        return;
    }

    const fup = checkFUP('search');
    if (state.currentPlan === 'supreme' && !fup.expired) return;

    if (fup.expired) {
        window.selectPlan(state.currentPlan === 'free' ? 'pro' : state.currentPlan);
    } else {
        if (state.currentPlan === 'free') {
            setPricingCardVisibility(['pro', 'promax', 'supreme'], 'block');
            window.selectPlan('pro');
        } else if (state.currentPlan === 'pro') {
            setPricingCardVisibility(['promax', 'supreme'], 'block');
            window.selectPlan('promax');
        } else {
            setPricingCardVisibility(['supreme'], 'block');
            window.selectPlan('supreme');
        }
    }
    modal.classList.add('active');
}
export const closeModal = createGenericModalCloser('upgrade-modal');

export function setPricingCardVisibility(plansToShow, displayStyle) {
    ['pro', 'promax', 'supreme'].forEach(plan => {
        const card = document.getElementById(`${plan}-card`);
        if (card) card.style.display = plansToShow.includes(plan) ? displayStyle : 'none';
    });
}

// ─── Search UI ────────────────────────────────────────────────
export function setLoading(on) {
    const btn = document.getElementById('search-btn');
    if (!btn) return;
    btn.disabled = on;
    btn.innerHTML = on
        ? '<div class="spinner"></div><span>Fetching...</span>'
        : '<span id="btn-text">Search Cases</span>';
}

export function showError(message) {
    const el = document.getElementById('results');
    if (el) el.innerHTML = `<div style="background:var(--warning-bg);color:var(--warning-text);padding:16px;border-radius:8px;border:1px solid #fecaca;font-size:14px;display:flex;align-items:center;gap:8px;">⚠️ ${message}</div>`;
}

export function clearResults() {
    const el = document.getElementById('results');
    if (el) el.innerHTML = '';
}

// ─── Tab / View / Jurisdiction ────────────────────────────────
export function switchTab(tab) {
    if (!state.currentUser && tab !== 'cnr' && tab !== 'us-case' && tab !== 'lawyer') {
        openModal(); return;
    }
    if (state.currentPlan === 'free' && tab !== 'cnr' && tab !== 'us-case' && tab !== 'lawyer') {
        openModal(); return;
    }
    state.activeTab = tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    document.querySelectorAll('.form-panel').forEach(p => p.style.display = 'none');
    const targetPanel = document.getElementById('panel-' + tab);
    if (targetPanel) targetPanel.style.display = 'block';
    clearResults();
}

export function switchJurisdiction(country) {
    state.activeJurisdiction = country;
    const indianTabs   = document.querySelectorAll('.indian-tab');
    const indianPanels = document.querySelectorAll('.indian-panel');
    const usTabs       = document.querySelectorAll('.us-tab');
    const usPanels     = document.querySelectorAll('.us-panel');

    if (country === 'usa') {
        indianTabs.forEach(el => el.style.display = 'none');
        indianPanels.forEach(el => el.style.display = 'none');
        usTabs.forEach(el => el.style.display = 'block');
        switchTab('us-case');
    } else {
        indianTabs.forEach(el => el.style.display = 'block');
        usTabs.forEach(el => el.style.display = 'none');
        usPanels.forEach(el => el.style.display = 'none');
        switchTab('cnr');
    }
    clearResults();
}

export function toggleView(viewName) {
    const searchView    = document.getElementById('view-search');
    const dashboardView = document.getElementById('view-dashboard');
    if (!searchView || !dashboardView) return;

    if (viewName === 'dashboard') {
        if (!state.currentUser) { alert('Please sign in to access the dashboard.'); openModal(); return; }
        searchView.style.display = 'none';
        dashboardView.style.display = 'block';
        const mb = document.getElementById('menu-btn');
        if (mb) mb.style.display = 'block';
        window.renderDashboard();
    } else {
        dashboardView.style.display = 'none';
        searchView.style.display = 'block';
        const mb = document.getElementById('menu-btn');
        if (mb) mb.style.display = 'block';
    }
}

export function toggleMenu() {
    document.getElementById('side-drawer').classList.toggle('open');
    document.getElementById('drawer-overlay').classList.toggle('open');
}

export function toggleCnrMode() {
    if (state.currentPlan === 'free') {
        alert('Bulk CNR refresh requires a Paid Plan.');
        const radio = document.querySelector('input[name="cnr-mode"][value="single"]');
        if (radio) radio.checked = true;
        openModal(); return;
    }
    const modeInput = document.querySelector('input[name="cnr-mode"]:checked');
    const mode = modeInput ? modeInput.value : 'single';
    const sf = document.getElementById('cnr-single-field');
    const bf = document.getElementById('cnr-bulk-field');
    if (sf) sf.style.display = mode === 'single' ? 'block' : 'none';
    if (bf) bf.style.display = mode === 'bulk'   ? 'block' : 'none';
}

// ─── Badge & Tab Locks ────────────────────────────────────────
export function updateBadge() {
    const badge       = document.getElementById('user-badge');
    const drawerBadge = document.getElementById('drawer-badge');
    if (!badge) return;

    const fup = checkFUP('search');
    let text, bg, color;

    if (fup.expired) {
        text = 'EXPIRED'; bg = '#ef4444'; color = 'white';
    } else if (state.currentPlan === 'supreme') {
        text = 'SUPREME'; bg = '#8b5cf6'; color = 'white';
    } else if (state.currentPlan === 'promax') {
        text = 'PRO MAX'; bg = '#d4af37'; color = 'black';
    } else if (state.currentPlan === 'pro') {
        text = 'PRO'; bg = 'var(--primary)'; color = 'white';
    } else {
        text = 'FREE'; bg = 'var(--border)'; color = 'var(--text-muted)';
    }

    badge.innerText = text; badge.style.background = bg; badge.style.color = color;
    if (drawerBadge) { drawerBadge.innerText = text; drawerBadge.style.background = bg; drawerBadge.style.color = color; }
}

export function updateTabLocks() {
    const locks = document.querySelectorAll('.tab:not(#tab-cnr):not(#tab-lawyer):not(#tab-us-case) .lock-icon');
    const hasPaid = ['pro', 'promax', 'supreme'].includes(state.currentPlan);
    if (hasPaid) {
        locks.forEach(icon => icon.style.display = 'none');
    } else {
        locks.forEach(icon => icon.style.display = 'inline');
        const needsLock = !['cnr', 'us-case', 'lawyer'].includes(state.activeTab);
        if (needsLock) switchTab('cnr');
    }
}

// ─── Universal Search ─────────────────────────────────────────
export function openUniversalSearch() {
    if (!state.currentUser) { alert('Please sign in to search your practice dashboard.'); openModal(); return; }
    const modal = document.getElementById('universal-search-modal');
    if (!modal) return;
    modal.classList.add('active');
    modal.style.display = '';
    setTimeout(() => { const input = document.getElementById('uni-search-input'); if (input) input.focus(); }, 100);
}

export function closeUniversalSearch() {
    const modal = document.getElementById('universal-search-modal');
    if (!modal) return;
    modal.classList.remove('active');
    const input   = document.getElementById('uni-search-input');
    const results = document.getElementById('uni-search-results');
    if (input)   input.value = '';
    if (results) results.innerHTML = '<div style="text-align:center;color:var(--text-muted);font-size:0.85rem;padding:20px;">Type to search your Practice Dashboard records...</div>';
}

export function runUniversalSearch() {
    const query          = document.getElementById('uni-search-input').value.toLowerCase().trim();
    const resultsContainer = document.getElementById('uni-search-results');
    if (!resultsContainer) return;

    if (!query) {
        resultsContainer.innerHTML = '<div style="text-align:center;color:var(--text-muted);font-size:0.85rem;padding:20px;">Type to search your Practice Dashboard records...</div>';
        return;
    }

    const matches = state.practiceCases.filter(c =>
        c.title.toLowerCase().includes(query) ||
        (c.cnr && c.cnr.toLowerCase().includes(query)) ||
        c.totalFee.toString().includes(query)
    );

    if (matches.length === 0) {
        resultsContainer.innerHTML = `<div style="text-align:center;color:var(--warning-text);font-size:0.9rem;padding:20px;background:var(--warning-bg);border-radius:8px;">No records found for "${query}"</div>`;
        return;
    }

    let html = '';
    matches.forEach(c => {
        const remaining = Math.max(0, c.totalFee - c.collected);
        html += `<div onclick="window.goToDashboardCase(${c.id})" style="padding:12px;border-bottom:1px solid var(--border);cursor:pointer;border-radius:6px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                <div style="font-weight:600;color:var(--primary);">${c.title}</div>
                <div style="font-size:0.75rem;font-weight:bold;color:${remaining > 0 ? 'var(--warning-text)' : 'var(--success-text)'};">${remaining > 0 ? '₹' + remaining + ' Due' : 'Paid'}</div>
            </div>
            <div style="font-size:0.8rem;color:var(--text-muted);">CNR: ${c.cnr || 'Manual Entry'} • Total: ₹${c.totalFee}</div>
        </div>`;
    });
    resultsContainer.innerHTML = html;
}

export function goToDashboardCase(id) {
    closeUniversalSearch();
    toggleView('dashboard');
    setTimeout(() => {
        const el = document.getElementById('dashboard-case-' + id);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 200);
}

// ─── AI Sidebar ───────────────────────────────────────────────
export function openAI() {
    if (!state.currentUser) { alert('Please sign in to use the AI Assistant.'); return; }
    document.getElementById('ai-sidebar').classList.add('active');
    document.getElementById('ai-overlay').style.display = 'block';
}

export function closeAI() {
    document.getElementById('ai-sidebar').classList.remove('active');
    document.getElementById('ai-overlay').style.display = 'none';
}
