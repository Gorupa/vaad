// js/renderers/search.js
import { clearResults, openGenericModalOpener, showError } from "../utils/ui.js";

export function renderCaseList(resultsArray) {
    if (!resultsArray || resultsArray.length === 0) return showError('No cases found.'); 
    let html = `<div style="margin-bottom: 15px; cursor: pointer; color: var(--text-muted); font-size: 14px; text-decoration: underline;" onclick="window.clearResults()">← Back to search</div><div style="font-size: 16px; font-weight: 600; margin-bottom: 15px; color: var(--text-main);">Found ${resultsArray.length} cases:</div>`;
    resultsArray.forEach(data => {
        html += `<div style="background: var(--bg); padding: 15px; border-radius: 8px; border: 1px solid var(--border); margin-bottom: 10px;"><div style="display: flex; justify-content: space-between; align-items: start;"><div style="padding-right: 15px;"><div style="font-size: 15px; font-weight: 600; color: var(--text-main); margin-bottom: 4px; word-break: break-word;">${(data.petitioners||['—'])[0]} vs ${(data.respondents||['—'])[0]}</div><div style="font-size: 13px; color: var(--text-muted); margin-bottom: 8px;">CNR: ${data.cnr || '—'}</div></div><div style="font-size: 11px; font-weight: bold; background: var(--primary-bg); color: var(--primary); padding: 4px 8px; border-radius: 4px; white-space: nowrap;">${data.caseStatus || 'Pending'}</div></div></div>`;
    });
    document.getElementById('results').innerHTML = html;
}

export function renderCaseDetail(payload) {
    if (!payload || !payload.data || !payload.data.courtCaseData) return showError('Invalid API data.'); 
    const data = payload.data.courtCaseData;
    let html = `<div style="margin-bottom: 15px; cursor: pointer; color: var(--text-muted); font-size: 14px; text-decoration: underline;" onclick="window.clearResults()">← Back to search</div>
        <div style="background: var(--bg); padding: 20px; border-radius: 8px; border: 1px solid var(--border);">
            <div style="font-size: 20px; font-weight: 600; margin-bottom: 5px;">${(data.petitioners||['—'])[0]} vs ${(data.respondents||['—'])[0]}</div>
            <div style="font-size: 14px; color: var(--text-muted); margin-bottom: 20px;">CNR: ${data.cnr}</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div><div style="font-size: 12px; color: var(--text-muted);">Status</div><div style="font-weight: 500;">${data.caseStatus || 'Pending'}</div></div>
                <div><div style="font-size: 12px; color: var(--text-muted);">Court</div><div style="font-weight: 500;">${data.courtName}</div></div>
            </div>
            
            <button class="btn-action btn-ai" onclick="window.openAddCaseModal(); document.getElementById('track-cnr').value='${data.cnr}'; document.getElementById('track-title').value='${(data.petitioners||['—'])[0]} vs ${(data.respondents||['—'])[0]}';" style="margin-top: 16px; width: 100%; justify-content: center;">
               💼 Add to My Practice Ledger
            </button>
        </div>`;
    document.getElementById('results').innerHTML = html;
}
