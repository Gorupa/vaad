// js/utils/ui.js
import { state } from "../state.js";

// Modal Control Functions
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

export function setLoading(on) {
    const btn = document.getElementById('search-btn');
    if (!btn) return;
    btn.disabled = on;
    btn.innerHTML = on ? '<div class="spinner"></div><span>Fetching...</span>' : '<span id="btn-text">Search Cases</span>';
}

export function showError(message) {
    const resultsContainer = document.getElementById('results');
    resultsContainer.innerHTML = `<div style="background: var(--warning-bg); color: var(--warning-text); padding: 16px; border-radius: 8px; border: 1px solid #fecaca; font-size: 14px; display: flex; align-items: center; gap: 8px;">⚠️ ${message}</div>`;
}

export function clearResults() {
    document.getElementById('results').innerHTML = '';
}

export function switchTab(tab) {
    if (!state.currentUser && tab !== 'cnr' && tab !== 'us-case' && tab !== 'lawyer') {
        openUpgradeModal(); return;
    }
    if (state.currentPlan === 'free' && tab !== 'cnr' && tab !== 'us-case' && tab !== 'lawyer') {
        openUpgradeModal(); return;
    }

    state.activeTab = tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    document.querySelectorAll('.form-panel').forEach(p => p.style.display = 'none');
    
    const targetPanel = document.getElementById('panel-' + tab);
    if (targetPanel) targetPanel.style.display = 'block';
    clearResults();
}

export function toggleMenu() {
    document.getElementById('side-drawer').classList.toggle('open');
    document.getElementById('drawer-overlay').classList.toggle('open');
}

export function toggleCnrMode() {
    if (state.currentPlan === 'free') {
        alert("Bulk CNR refresh requires a Paid Plan.");
        const singleCnrRadio = document.querySelector('input[name="cnr-mode"][value="single"]');
        if (singleCnrRadio) singleCnrRadio.checked = true;
        openUpgradeModal(); return;
    }
    const selectedModeInput = document.querySelector('input[name="cnr-mode"]:checked');
    const mode = selectedModeInput ? selectedModeInput.value : 'single';
    const singleField = document.getElementById('cnr-single-field');
    const bulkField = document.getElementById('cnr-bulk-field');
    if (singleField) singleField.style.display = mode === 'single' ? 'block' : 'none';
    if (bulkField) bulkField.style.display = mode === 'bulk' ? 'block' : 'none';
}

// Simple modal controls
export const createGenericModalOpener = (id) => () => { 
    const m = document.getElementById(id);
    if(m) { m.classList.add('active'); m.style.display = ''; }
};
export const createGenericModalCloser = (id) => () => {
    const m = document.getElementById(id);
    if(m) m.classList.remove('active');
};

export const openUpgradeModal = () => { 
    const modal = document.getElementById('upgrade-modal');
    if (!modal) return;
    modal.style.display = ''; 

    // Important: FUP logic needs to be integrated here or imported
    // Since fup.js imports config/state, we should probably make fup.js handle checking 
    // and just have a function here to display the modal based on results.
    // For simplicity of refactoring, I'm assuming checkFUP is available globally or imported.
    // Let's create a placeholder for now to avoid breaking flow.
    const upgradeReason = document.getElementById('upgrade-reason');
    if (upgradeReason) upgradeReason.innerText = "Paid plans offer higher search limits and additional features.";

    if (!state.currentUser) {
        setPricingCardVisibility(['pro', 'promax', 'supreme'], 'block');
        window.selectPlan('pro');
        modal.classList.add('active');
        return;
    }
    
    // Logic dependent on checkFUP from fup.js
    // We will bind this logic in main.js
};
export const closeUpgradeModal = createGenericModalCloser('upgrade-modal');

export function setPricingCardVisibility(plans, displayStyle) {
    const allCards = ['pro', 'promax', 'supreme'];
    allCards.forEach(plan => {
        const card = document.getElementById(`${plan}-card`);
        if(card) card.style.display = plans.includes(plan) ? displayStyle : 'none';
    });
}
