// js/renderers/search.js
// Owns: case list/detail rendering, search execution, causelist/bulk rendering.
import { state } from '../state.js';
import { API_URL } from '../config.js';
import { setLoading, clearResults, showError, openModal, openLoginModal } from '../utils/ui.js';
import { updateSearchLimitUI } from '../services/fup.js';

// ─── Renderers ────────────────────────────────────────────────
export function renderCaseList(resultsArray) {
    if (!resultsArray || resultsArray.length === 0) return showError('No cases found.');
    let html = `<div style="margin-bottom:15px;cursor:pointer;color:var(--text-muted);font-size:14px;text-decoration:underline;" onclick="window.clearResults()">← Back to search</div>`;
    html += `<div style="font-size:16px;font-weight:600;margin-bottom:15px;color:var(--text-main);">Found ${resultsArray.length} cases:</div>`;
    resultsArray.forEach(data => {
        html += `<div style="background:var(--bg);padding:15px;border-radius:8px;border:1px solid var(--border);margin-bottom:10px;">
            <div style="display:flex;justify-content:space-between;align-items:start;">
                <div style="padding-right:15px;">
                    <div style="font-size:15px;font-weight:600;color:var(--text-main);margin-bottom:4px;word-break:break-word;">${(data.petitioners||['—'])[0]} vs ${(data.respondents||['—'])[0]}</div>
                    <div style="font-size:13px;color:var(--text-muted);margin-bottom:8px;">CNR: ${data.cnr || '—'}</div>
                </div>
                <div style="font-size:11px;font-weight:bold;background:var(--primary-bg);color:var(--primary);padding:4px 8px;border-radius:4px;white-space:nowrap;">${data.caseStatus || 'Pending'}</div>
            </div>
        </div>`;
    });
    document.getElementById('results').innerHTML = html;
}

export function renderCaseDetail(payload) {
    if (!payload || !payload.data || !payload.data.courtCaseData) return showError('Invalid API data.');
    const data  = payload.data.courtCaseData;
    const title = `${(data.petitioners||['—'])[0]} vs ${(data.respondents||['—'])[0]}`;
    let html = `<div style="margin-bottom:15px;cursor:pointer;color:var(--text-muted);font-size:14px;text-decoration:underline;" onclick="window.clearResults()">← Back to search</div>
        <div style="background:var(--bg);padding:20px;border-radius:8px;border:1px solid var(--border);">
            <div style="font-size:20px;font-weight:600;margin-bottom:5px;">${title}</div>
            <div style="font-size:14px;color:var(--text-muted);margin-bottom:20px;">CNR: ${data.cnr}</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;">
                <div><div style="font-size:12px;color:var(--text-muted);">Status</div><div style="font-weight:500;">${data.caseStatus || 'Pending'}</div></div>
                <div><div style="font-size:12px;color:var(--text-muted);">Court</div><div style="font-weight:500;">${data.courtName}</div></div>
            </div>
            <button class="btn-action btn-ai"
                onclick="window.openAddCaseModal(); document.getElementById('track-cnr').value='${data.cnr}'; document.getElementById('track-title').value='${title.replace(/'/g, "\\'")}'"
                style="margin-top:16px;width:100%;justify-content:center;">
                💼 Add to My Practice Ledger
            </button>
        </div>`;
    document.getElementById('results').innerHTML = html;
}

// ─── Search Execution ─────────────────────────────────────────
export async function handleSearch() {
    if (!state.currentUser) { openLoginModal(); return; }

    let endpoint = '', bodyData = {}, renderType = '';

    if (state.activeJurisdiction === 'usa' && state.activeTab === 'us-case') {
        alert('US Case Law search is coming soon!'); return;
    } else if (state.activeTab === 'lawyer') {
        alert('Lawyer search is coming soon.'); return;
    } else if (state.activeTab === 'cnr') {
        const modeInput = document.querySelector('input[name="cnr-mode"]:checked');
        const mode = modeInput ? modeInput.value : 'single';
        if (mode === 'single') {
            const query = document.getElementById('cnr-input').value.trim();
            if (!query) return;
            endpoint = `${API_URL}/cnr`;
            bodyData = { userId: state.currentUser.uid, cnr: query };
            renderType = 'cnr';
        } else {
            const bulkText = document.getElementById('cnr-bulk-input').value.trim();
            if (!bulkText) return;
            const cnrs = bulkText.split('\n').map(c => c.trim()).filter(c => c.length > 5);
            if (cnrs.length > 50) return alert('Max 50 CNRs allowed.');
            endpoint = `${API_URL}/bulk-refresh`;
            bodyData = { userId: state.currentUser.uid, cnrs };
            renderType = 'bulk';
        }
    } else if (state.activeTab === 'causelist') {
        const stateEl = document.getElementById('causelist-state');
        const queryEl = document.getElementById('causelist-query');
        if (!stateEl || !queryEl) return;
        const stateVal = stateEl.value.trim().toUpperCase();
        const queryVal = queryEl.value.trim();
        if (!stateVal || !queryVal) return alert('Provide State Code and Query.');
        endpoint = `${API_URL}/causelist`;
        bodyData = { userId: state.currentUser.uid, query: queryVal, state: stateVal, limit: 20 };
        renderType = 'causelist';
    } else {
        let query = '';
        const litigantEl = document.getElementById('litigant-input');
        const advocateEl = document.getElementById('advocate-input');
        const judgeEl    = document.getElementById('judge-input');
        if (state.activeTab === 'litigant' && litigantEl) query = litigantEl.value.trim();
        if (state.activeTab === 'advocate' && advocateEl) query = advocateEl.value.trim();
        if (state.activeTab === 'judge'    && judgeEl)    query = judgeEl.value.trim();
        if (!query) return;
        endpoint = `${API_URL}/search`;
        bodyData = { userId: state.currentUser.uid, query, type: state.activeTab };
        renderType = 'list';
    }

    await performSearch(endpoint, bodyData, renderType);
}

async function performSearch(endpoint, bodyData, renderType) {
    setLoading(true);
    clearResults();
    try {
        const res  = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bodyData) });
        const json = await res.json();

        if (res.status === 403) { showError(json.error || 'Search limit reached. Please upgrade.'); openModal(); return; }
        if (res.status === 401) { showError('Please sign in to search.'); openLoginModal(); return; }
        if (!res.ok || !json.success) return showError(json.error || 'The official API failed to fetch records.');

        // Refresh limit display from Firestore (server already incremented)
        await updateSearchLimitUI();

        if (renderType === 'cnr') {
            renderCaseDetail(json.data);
        } else if (renderType === 'list') {
            renderCaseList(json.data);
        } else if (renderType === 'causelist') {
            const rc = document.getElementById('results');
            let html = `<div style="margin-bottom:15px;cursor:pointer;color:var(--text-muted);font-size:14px;text-decoration:underline;" onclick="window.clearResults()">← Back to search</div><h3 style="margin-bottom:15px;">Today's Cause List</h3>`;
            if (!json.data?.results?.length) {
                html += `<div>No cases listed today.</div>`;
            } else {
                json.data.results.forEach(c => {
                    html += `<div style="background:var(--bg);padding:12px;border:1px solid var(--border);border-radius:8px;margin-bottom:10px;">
                        <div style="font-weight:600;margin-bottom:4px;">${c.caseNumber || 'Unknown Case'}</div>
                        <div style="font-size:13px;color:var(--text-muted);">Court: ${c.courtName || '—'}</div>
                        <div style="font-size:12px;margin-top:8px;"><span style="background:var(--primary-bg);color:var(--primary);padding:2px 6px;border-radius:4px;">Room: ${c.courtNo || '—'}</span></div>
                    </div>`;
                });
            }
            rc.innerHTML = html;
        } else if (renderType === 'bulk') {
            document.getElementById('results').innerHTML = `<div style="background:var(--success-bg);color:var(--success-text);padding:16px;border:1px solid #a7f3d0;border-radius:8px;">
                <h3 style="margin-bottom:8px;">Bulk Refresh Initiated ✓</h3>
                <p style="font-size:0.9rem;">Your CNRs are queued. Check individually in 1-2 minutes.</p>
                <div style="margin-top:12px;cursor:pointer;text-decoration:underline;font-size:0.85rem;" onclick="window.clearResults()">← Start New Search</div>
            </div>`;
        }
    } catch (e) {
        showError(`Network Error: ${e.message}`);
    } finally {
        setLoading(false);
    }
}
