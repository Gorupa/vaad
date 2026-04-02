// js/state.js

export const state = {
    currentUser: null,
    currentPlan: 'free',
    cycleStartDate: null,
    activeTab: 'cnr',
    activeJurisdiction: 'india',
    syncPermission: true,
    practiceCases: JSON.parse(localStorage.getItem('vaad_dashboard_cases')) || [],
    userConsent: localStorage.getItem('vaad_dpdp_consent'),
    pendingSaveAction: null,
};

// State helper functions
export function updatePracticeCases(newCases) {
    state.practiceCases = newCases;
    localStorage.setItem('vaad_dashboard_cases', JSON.stringify(state.practiceCases));
}

export function resetStateOnLogout() {
    state.currentUser = null;
    state.currentPlan = 'free';
    state.cycleStartDate = null;
    updatePracticeCases([]);
}
