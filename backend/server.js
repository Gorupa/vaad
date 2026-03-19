const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());

const API_KEY = process.env.ECOURTS_API_KEY;
const BASE_URL = 'https://webapi.ecourtsindia.com/api/partner';

const headers = {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json'
};

// ── ROUTE 1: EXACT CNR SEARCH (Free & Pro) ──
app.post('/api/cnr', async (req, res) => {
    const { cnr } = req.body;
    if (!cnr) return res.status(400).json({ success: false, error: 'CNR is required' });

    try {
        const response = await fetch(`${BASE_URL}/case/${cnr}`, { method: 'GET', headers });
        const data = await response.json();
        if (!response.ok) return res.status(400).json({ success: false, error: data.message || 'Case not found in official database.' });
        return res.json({ success: true, data: data });
    } catch (error) {
        console.error("API Error:", error);
        return res.status(500).json({ success: false, error: 'Internal server connection error.' });
    }
});

// ── ROUTE 2: LIST SEARCH (Pro Max Only) ──
app.post('/api/search', async (req, res) => {
    const { query, type } = req.body;
    if (!query || !type) return res.status(400).json({ success: false, error: 'Query and type are required' });

    // Build the official API URL based on the tab the user clicked
    let url = `${BASE_URL}/search?pageSize=10&`;
    if (type === 'litigant') url += `litigants=${encodeURIComponent(query)}`;
    else if (type === 'advocate') url += `advocates=${encodeURIComponent(query)}`;
    else if (type === 'judge') url += `judges=${encodeURIComponent(query)}`;
    else return res.status(400).json({ success: false, error: 'Invalid search type' });

    try {
        const response = await fetch(url, { method: 'GET', headers });
        const data = await response.json();
        if (!response.ok) return res.status(400).json({ success: false, error: data.message || 'Search failed.' });
        
        // The official search API returns the array inside data.data.results
        return res.json({ success: true, data: data.data.results });
    } catch (error) {
        console.error("API Error:", error);
        return res.status(500).json({ success: false, error: 'Internal server connection error.' });
    }
});

app.get('/api/health', (req, res) => res.json({ status: 'Live with Official Partner API' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Vaad Server running on port ${PORT}`));
