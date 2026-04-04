// js/services/fup.js
// Owns: FUP check (for badge/UI display), live search limit display from Firestore.
import { state } from '../state.js';
import { PLAN_LIMITS } from '../config.js';
import { db } from '../services/firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// Client-side FUP check used ONLY for badge/modal display — NOT for enforcement.
// Actual enforcement happens server-side in server.js.
export function checkFUP(actionType) {
    if (!state.currentUser) return { allowed: false, used: 0, limit: 0, remaining: 0, expired: false, daysLeft: 0 };
    if (!state.currentPlan || !PLAN_LIMITS[state.currentPlan]) state.currentPlan = 'free';

    const cycleStart = new Date(state.cycleStartDate || new Date().toISOString().split('T')[0]);
    cycleStart.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((today - cycleStart) / (1000 * 60 * 60 * 24));

    const isExpired = state.currentPlan !== 'free' && diffDays >= 30;
    const daysLeft  = state.currentPlan !== 'free' ? Math.max(0, 30 - diffDays) : 0;

    const planData  = PLAN_LIMITS[state.currentPlan];
    const limit     = planData ? planData[actionType] : 0;

    return { expired: isExpired, daysLeft, limit };
}

// Reads live searchCount from Firestore so count always reflects server-side truth.
export async function updateSearchLimitUI() {
    const limitText  = document.getElementById('limit-text');
    const upgradeBtn = document.getElementById('nav-upgrade-btn');

    if (!state.currentUser) {
        if (limitText)  limitText.innerText = 'Sign in to get 1 free search';
        if (upgradeBtn) upgradeBtn.style.display = 'none';
        return;
    }

    if (limitText) limitText.innerHTML = `<span style="color:var(--text-muted);font-weight:600;">Loading...</span>`;

    try {
        const userSnap = await getDoc(doc(db, 'users', state.currentUser.uid));
        const data     = userSnap.exists() ? userSnap.data() : {};
        const used     = data.searchCount || 0;
        const plan     = state.currentPlan || 'free';
        const limit    = (PLAN_LIMITS[plan] || PLAN_LIMITS.free).search;
        const remaining = Math.max(0, limit - used);

        const cycleStart = state.cycleStartDate ? new Date(state.cycleStartDate) : new Date();
        const diffDays   = Math.floor((new Date() - cycleStart) / (1000 * 60 * 60 * 24));
        const isExpired  = plan !== 'free' && diffDays >= 30;
        const daysLeft   = plan !== 'free' ? Math.max(0, 30 - diffDays) : 0;

        if (isExpired) {
            if (limitText)  limitText.innerHTML = `<span style="color:#ef4444;font-weight:600;">Subscription Expired</span>`;
            if (upgradeBtn) { upgradeBtn.style.display = 'inline-block'; upgradeBtn.innerText = '⚡ Renew'; upgradeBtn.onclick = () => window.openModal(); }
            return;
        }

        const daysText = plan !== 'free' ? `(${daysLeft}d left) • ` : '';
        const color    = plan === 'supreme' ? '#8b5cf6' : 'var(--primary)';
        if (limitText) limitText.innerHTML = `<span style="color:${color};font-weight:600;">${plan.toUpperCase()} ${daysText}${remaining}/${limit} Searches</span>`;

        if (plan === 'supreme') {
            if (upgradeBtn) upgradeBtn.style.display = 'none';
        } else {
            if (upgradeBtn) { upgradeBtn.style.display = 'inline-block'; upgradeBtn.innerText = '⚡ Upgrade'; upgradeBtn.onclick = () => window.openModal(); }
        }
    } catch (e) {
        console.error('[FUP] updateSearchLimitUI error:', e);
        if (limitText) limitText.innerHTML = `<span style="color:var(--primary);font-weight:600;">${(state.currentPlan || 'free').toUpperCase()} Plan</span>`;
    }
}
