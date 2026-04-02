// js/services/fup.js
import { state } from "../state.js";
import { PLAN_LIMITS } from "../config.js";

export function checkFUP(actionType) {
    if (!state.currentUser) return { allowed: false, used: 0, limit: 0, remaining: 0, storageKey: null, expired: false, daysLeft: 0 };
    if (!state.currentPlan || !PLAN_LIMITS[state.currentPlan]) state.currentPlan = 'free';

    const cycleStart = new Date(state.cycleStartDate || new Date().toISOString().split('T')[0]);
    cycleStart.setHours(0,0,0,0);
    const today = new Date();
    today.setHours(0,0,0,0);
    const diffTime = today - cycleStart;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)); 

    let isExpired = false;
    let daysLeft = 0;

    if (state.currentPlan !== 'free') {
        if (diffDays >= 30) isExpired = true;
        else daysLeft = 30 - diffDays;
    }

    const storageKey = `vaad_${actionType}_${state.currentUser.uid}_cycle_${state.cycleStartDate}`;
    let used = parseInt(localStorage.getItem(storageKey) || 0);
    let planData = PLAN_LIMITS[state.currentPlan];
    let limit = planData ? planData[actionType] : 0; 
    let remaining = Math.max(0, limit - used);

    return { allowed: used < limit, used: used, limit: limit, remaining: remaining, storageKey: storageKey, expired: isExpired, daysLeft: daysLeft };
}

export function updateSearchLimitUI() {
    const limitText = document.getElementById('limit-text');
    const upgradeBtn = document.getElementById('nav-upgrade-btn');
    
    if (!state.currentUser) { 
        if (limitText) limitText.innerText = "Sign in Google get 1 free search"; 
        if (upgradeBtn) upgradeBtn.style.display = 'none'; 
        return; 
    }
    
    const fup = checkFUP('search');
    
    if (fup.expired) {
        if (limitText) limitText.innerHTML = `<span style="color: #ef4444; font-weight:600;">Subscription Expired</span>`;
        if (upgradeBtn) { upgradeBtn.style.display = 'inline-block'; upgradeBtn.innerText = "⚡ Renew"; upgradeBtn.onclick = () => window.openModal(); }
        return;
    }
    
    let daysText = state.currentPlan !== 'free' ? `(${fup.daysLeft} days left) • ` : '';
    if (state.currentPlan === 'supreme') {
        if (limitText) limitText.innerHTML = `<span style="color: #8b5cf6; font-weight:600;">Supreme ${daysText}${fup.remaining}/${fup.limit} Searches</span>`;
        if (upgradeBtn) upgradeBtn.style.display = 'none'; 
    } else {
        if (limitText) limitText.innerHTML = `<span style="color: var(--primary); font-weight:600;">${state.currentPlan.toUpperCase()} ${daysText}${fup.remaining}/${fup.limit} Searches</span>`;
        if (upgradeBtn) { upgradeBtn.style.display = 'inline-block'; upgradeBtn.innerText = "⚡ Upgrade"; upgradeBtn.onclick = () => window.openModal(); }
    }
}
