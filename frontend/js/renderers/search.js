// js/renderers/search.js
import { clearResults, showError } from "../utils/ui.js";

// FIX: removed broken import of openGenericModalOpener which does not exist in ui.js
// (ui.js exports createGenericModalOpener, not openGenericModalOpener)

export function renderCaseList(resultsArray) {
    if (!resultsArray || resultsArray.length === 0) return showError('No cases found.');
    let html = '<div style="margin-bottom:15px; cursor:pointer; color:var(--text-muted); font-size:14px; text-decoration:underline;" onclick="window.clearResults()">\u2190 Back to search</div>';
    html += '<div style="font-size:16px; font-weight:600; margin-bottom:15px; color:var(--text-main);">Found ' + resultsArray.length + ' cases:</div>';
    resultsArray.forEach(data => {
        html += '<div style="background:var(--bg); padding:15px; border-radius:8px; border:1px solid var(--border); margin-bottom:10px;">';
        html += '<div style="display:flex; justify-content:space-between; align-items:start;">';
        html += '<div style="padding-right:15px;"><div style="font-size:15px; font-weight:600; color:var(--text-main); margin-bottom:4px; word-break:break-word;">' + (data.petitioners||['—'])[0] + ' vs ' + (data.respondents||['—'])[0] + '</div>';
        html += '<div style="font-size:13px; color:var(--text-muted); margin-bottom:8px;">CNR: ' + (data.cnr || '—') + '</div></div>';
        html += '<div style="font-size:11px; font-weight:bold; background:var(--primary-bg); color:var(--primary); padding:4px 8px; border-radius:4px; white-space:nowrap;">' + (data.caseStatus || 'Pending') + '</div>';
        html += '</div></div>';
    });
    document.getElementById('results').innerHTML = html;
}

export function renderCaseDetail(payload) {
    if (!payload || !payload.data || !payload.data.courtCaseData) return showError('Invalid API data.');
    const data = payload.data.courtCaseData;
    const title = (data.petitioners||['—'])[0] + ' vs ' + (data.respondents||['—'])[0];
    let html = '<div style="margin-bottom:15px; cursor:pointer; color:var(--text-muted); font-size:14px; text-decoration:underline;" onclick="window.clearResults()">\u2190 Back to search</div>';
    html += '<div style="background:var(--bg); padding:20px; border-radius:8px; border:1px solid var(--border);">';
    html += '<div style="font-size:20px; font-weight:600; margin-bottom:5px;">' + title + '</div>';
    html += '<div style="font-size:14px; color:var(--text-muted); margin-bottom:20px;">CNR: ' + data.cnr + '</div>';
    html += '<div style="display:grid; grid-template-columns:1fr 1fr; gap:15px;">';
    html += '<div><div style="font-size:12px; color:var(--text-muted);">Status</div><div style="font-weight:500;">' + (data.caseStatus || 'Pending') + '</div></div>';
    html += '<div><div style="font-size:12px; color:var(--text-muted);">Court</div><div style="font-weight:500;">' + data.courtName + '</div></div>';
    html += '</div>';
    html += '<button class="btn-action btn-ai" onclick="window.openAddCaseModal(); document.getElementById(\'track-cnr\').value=\'' + data.cnr + '\'; document.getElementById(\'track-title\').value=\'' + title.replace(/'/g, "\\'") + '\';" style="margin-top:16px; width:100%; justify-content:center;">';
    html += '\ud83d\udcbc Add to My Practice Ledger</button></div>';
    document.getElementById('results').innerHTML = html;
}
