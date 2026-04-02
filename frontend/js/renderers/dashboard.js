// js/renderers/dashboard.js
import { state, updatePracticeCases } from "../state.js";
import { auth, db } from "../services/firebase.js";
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { openGenericModalCloser, openGenericModalOpener, openGenericModalOpenerWithFallback } from "../utils/ui.js";

// Database Sync Helper (Moved here from app.js)
async function syncDashboardToCloud() {
    if (!state.currentUser) return; 
    if (state.userConsent !== 'true') return; 
    if (!state.syncPermission) return; 

    try {
        const userRef = doc(db, "users", state.currentUser.uid);
        await updateDoc(userRef, {
            practiceCases: state.practiceCases
        });
        console.log("[Cloud Sync] Dashboard saved to Firestore.");
    } catch (error) {
        console.error("Error syncing dashboard to cloud:", error);
    }
}

export function renderDashboard() {
    let totalExpected = 0;
    let totalCollected = 0;
    let html = '';

    const dashboardCases = document.getElementById('dashboard-cases');
    if(!dashboardCases) return;

    if (state.practiceCases.length === 0) {
        html = `<div style="text-align:center; padding: 40px 20px; color: var(--text-muted); border: 1px dashed var(--border); border-radius: 8px;">No cases tracked ledger empty.</div>`;
    }

    state.practiceCases.forEach(c => {
        totalExpected += c.totalFee;
        totalCollected += c.collected;
        const remaining = Math.max(0, c.totalFee - c.collected);
        
        let paymentsHtml = '';
        if (c.payments && c.payments.length > 0) {
            paymentsHtml = `<div style="font-size: 0.8rem; margin-top: 12px; border-top: 1px solid var(--border); padding-top: 8px;">
                <div style="font-weight: 600; margin-bottom: 6px; color: var(--text-muted);">Payment History</div>`;
            
            const reversedPayments = c.payments.map((p, i) => ({...p, originalIndex: i})).reverse();
            reversedPayments.forEach(p => {
                paymentsHtml += `<div style="display:flex; justify-content: space-between; border-bottom: 1px dashed var(--border); padding: 6px 0; align-items: center;">
                    <span>${p.date}</span>
                    <div style="display: flex; gap: 12px; align-items: center;">
                        <span style="color: var(--success-text); font-weight: 600;">+ ₹${p.amount}</span>
                        <button onclick="window.deletePaymentLog(${c.id}, ${p.originalIndex})" style="background: none; border: none; color: var(--error-text); cursor: pointer; font-size: 1.1rem; line-height: 1; padding: 0 4px;" title="Delete Payment">×</button>
                    </div>
                </div>`;
            });
            paymentsHtml += `</div>`;
        }

        html += `
        <div id="dashboard-case-${c.id}" style="background: var(--bg); border: 1px solid var(--border); border-radius: 8px; margin-bottom: 16px; padding: 16px; transition: box-shadow 0.3s ease;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 12px; align-items: flex-start;">
                <div>
                    <div style="font-weight: 700; font-size: 1.05rem;">${c.title}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;">CNR: ${c.cnr || 'Manual Entry'}</div>
                </div>
                <div style="text-align: right;">
                    <div style="display: flex; align-items: center; justify-content: flex-end; gap: 8px; margin-bottom: 4px;">
                        <div style="font-size: 0.8rem; background: ${remaining > 0 ? 'var(--warning-bg)' : 'var(--success-bg)'}; color: ${remaining > 0 ? 'var(--warning-text)' : 'var(--success-text)'}; padding: 4px 8px; border-radius: 4px; font-weight: bold;">
                            ${remaining > 0 ? `₹${remaining} Pending` : 'Paid ✓'}
                        </div>
                        <button onclick="window.deleteDashboardCase(${c.id})" style="background: none; border: none; color: var(--error-text); cursor: pointer; font-size: 1rem; padding: 4px; transition: transform 0.1s;" title="Delete Case" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">🗑️</button>
                    </div>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; background: var(--bg-alt); padding: 12px; border-radius: 6px; margin-bottom: 12px; text-align: center;">
                <div><div style="font-size: 0.7rem; color: var(--text-muted);">Total Fee</div><div style="font-weight: 600;">₹${c.totalFee}</div></div>
                <div><div style="font-size: 0.7rem; color: var(--text-muted);">Per Hearing</div><div style="font-weight: 600;">₹${c.perHearing}</div></div>
                <div><div style="font-size: 0.7rem; color: var(--text-muted);">Collected</div><div style="font-weight: 600; color: var(--success-text);">₹${c.collected}</div></div>
            </div>

            <div style="display: flex; gap: 8px;">
                <input type="number" id="pay-input-${c.id}" placeholder="${c.perHearing > 0 ? '₹' + c.perHearing : '₹ Amount'}" style="flex: 1; padding: 8px; border: 1px solid var(--border); border-radius: 6px; font-size: 0.9rem;" ${remaining === 0 ? 'disabled' : ''}>
                <button class="btn-action" onclick="window.logPayment(${c.id})" style="background: var(--success-bg); color: var(--success-text); border-color: #a7f3d0; padding: 8px 16px;" ${remaining === 0 ? 'disabled' : ''}>Log Payment</button>
            </div>
            
            ${paymentsHtml}
        </div>`;
    });

    dashboardCases.innerHTML = html;
    const expectedEl = document.getElementById('stat-expected');
    const collectedEl = document.getElementById('stat-collected');
    const pendingEl = document.getElementById('stat-pending');
    
    if(expectedEl) expectedEl.innerText = `₹${totalExpected}`;
    if(collectedEl) collectedEl.innerText = `₹${totalCollected}`;
    if(pendingEl) pendingEl.innerText = `₹${Math.max(0, totalExpected - totalCollected)}`;
}

// Case Management Functions
export async function saveTrackedCase() {
    const cnr = document.getElementById('track-cnr').value.trim();
    const title = document.getElementById('track-title').value.trim();
    const totalInput = document.getElementById('track-total');
    const hearingInput = document.getElementById('track-hearing');
    const total = totalInput ? parseInt(totalInput.value) || 0 : 0;
    const perHearing = hearingInput ? parseInt(hearingInput.value) || 0 : 0;

    if (!title) return alert("Case Title / Client Name required.");

    const executeSave = async () => {
        const newCases = [...state.practiceCases];
        newCases.unshift({
            id: Date.now(),
            cnr: cnr,
            title: title,
            totalFee: total,
            perHearing: perHearing,
            collected: 0,
            payments: []
        });
        updatePracticeCases(newCases);

        await syncDashboardToCloud(); 
        
        document.getElementById('track-cnr').value = '';
        document.getElementById('track-title').value = '';
        if(totalInput) totalInput.value = '';
        if(hearingInput) hearingInput.value = '';
        
        window.closeAddCaseModal();
        window.toggleView('dashboard');
    };

    if (state.userConsent === null && state.currentUser) {
        state.pendingSaveAction = executeSave;
        window.closeAddCaseModal(); 
        window.openConsentModal();
    } else {
        await executeSave(); 
    }
}

export async function logPayment(id) {
    const input = document.getElementById('pay-input-' + id);
    if(!input) return;
    const amount = parseInt(input.value);
    
    if (!amount || amount <= 0) return alert("Please enter a valid amount.");

    const caseIndex = state.practiceCases.findIndex(c => c.id === id);
    if (caseIndex > -1) {
        const newCases = [...state.practiceCases];
        newCases[caseIndex].collected += amount;
        newCases[caseIndex].payments.push({
            date: new Date().toLocaleDateString('en-GB'),
            amount: amount
        });
        updatePracticeCases(newCases);
        
        await syncDashboardToCloud(); 
        renderDashboard();
    }
}

export async function deleteDashboardCase(id) {
    if (!confirm("Are permanently delete this case? payment history lost.")) return;
    
    const newCases = state.practiceCases.filter(c => c.id !== id);
    updatePracticeCases(newCases);
    
    await syncDashboardToCloud();
    renderDashboard();
}

export async function deletePaymentLog(caseId, paymentIndex) {
    if (!confirm("Delete payment log?")) return;

    const caseIndex = state.practiceCases.findIndex(c => c.id === caseId);
    if (caseIndex > -1) {
        const newCases = [...state.practiceCases];
        const pAmount = newCases[caseIndex].payments[paymentIndex].amount;
        newCases[caseIndex].collected -= pAmount; 
        newCases[caseIndex].payments.splice(paymentIndex, 1);
        updatePracticeCases(newCases);
        
        await syncDashboardToCloud();
        renderDashboard();
    }
}
