function renderCaseDetail(payload) {
    hidePlaceholder();
    
    // Safety check to make sure the API sent the expected structure
    if (!payload || !payload.data || !payload.data.courtCaseData) { 
        showError('Invalid case data returned from official API.'); 
        return; 
    }

    const data = payload.data.courtCaseData;

    // Safely extract arrays (lists of names) into comma-separated text
    const petitioner = (data.petitioners && data.petitioners.length > 0) ? data.petitioners.join(', ') : '—';
    const respondent = (data.respondents && data.respondents.length > 0) ? data.respondents.join(', ') : '—';
    const petAdv = (data.petitionerAdvocates && data.petitionerAdvocates.length > 0) ? data.petitionerAdvocates.join(', ') : '—';
    const resAdv = (data.respondentAdvocates && data.respondentAdvocates.length > 0) ? data.respondentAdvocates.join(', ') : '—';

    // Create a dynamic title
    const title = `${petitioner.split(',')[0]} vs ${respondent.split(',')[0]}`;

    // Map the core fields
    const cnr = data.cnr || '—';
    const caseType = data.caseTypeRaw || data.caseType || '—';
    const courtName = data.courtName || '—';
    const district = data.district || '—';
    const filingDate = data.filingDate || '—';
    const status = data.caseStatus || 'Pending';
    
    // For Stage: Use disposal type if disposed, otherwise use the current purpose
    const stage = data.disposalTypeRaw || data.purpose || '—';
    
    let nextHearing = data.nextHearingDate || '—';
    const nextPurpose = data.purpose || '';

    // Determine badge color
    const statusClass = status.toUpperCase().includes('DISPOS') ? 'status-disposed' : status.toUpperCase().includes('FRESH') ? 'status-fresh' : 'status-pending';

    let html = `<span class="detail-back" onclick="window.clearResults()">← Back to search</span>
        <div class="detail-header"><div class="detail-title">${title}</div><div class="detail-cnr">CNR: ${cnr}</div></div>`;

    // Smart logic for the Next Hearing Box
    if (status.toUpperCase().includes('DISPOS')) {
        // If disposed, show the decision date in a green box instead of a "next hearing" date
        const decisionDate = data.decisionDate || data.lastHearingDate || nextHearing;
        html += `<div class="next-hearing" style="background: rgba(16, 185, 129, 0.1); border-color: rgba(16, 185, 129, 0.3);"><div class="nh-label" style="color: #10b981;">Decision / Disposed Date</div><div class="nh-date" style="color: #10b981;">${decisionDate}</div></div>`;
    } else if (nextHearing !== '—') {
        html += `<div class="next-hearing"><div class="nh-label">Next Hearing Date</div><div class="nh-date">${nextHearing}</div>${nextPurpose ? `<div class="nh-purpose">${nextPurpose}</div>` : ''}</div>`;
    }

    // Build the grid
    html += `<div class="info-grid">
        <div class="info-row"><span class="info-key">Status</span><span class="info-val"><span class="status-badge ${statusClass}">${status}</span></span></div>
        <div class="info-row"><span class="info-key">Case Type</span><span class="info-val">${caseType}</span></div>
        <div class="info-row"><span class="info-key">Court</span><span class="info-val">${courtName}</span></div>
        <div class="info-row"><span class="info-key">District</span><span class="info-val">${district}</span></div>
        <div class="info-row"><span class="info-key">Filing Date</span><span class="info-val">${filingDate}</span></div>
        <div class="info-row"><span class="info-key">Stage</span><span class="info-val">${stage}</span></div>
        <div class="info-row"><span class="info-key">Petitioner</span><span class="info-val">${petitioner}</span></div>
        <div class="info-row"><span class="info-key">Respondent</span><span class="info-val">${respondent}</span></div>
        <div class="info-row"><span class="info-key">Pet. Advocate</span><span class="info-val">${petAdv}</span></div>
        <div class="info-row"><span class="info-key">Res. Advocate</span><span class="info-val">${resAdv}</span></div>
    </div>`;

    document.getElementById('results').innerHTML = html;
    document.getElementById('results').scrollIntoView({ behavior:'smooth', block:'start' });
}
