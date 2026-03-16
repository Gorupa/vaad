/**
 * vaad.in — backend/server.js
 * Node.js + Express backend for eCourts data
 *
 * Author : gorupa (https://github.com/gorupa)
 * License: AGPL-3.0
 *
 * Data source: ecourts.gov.in (via @bullpenm/legal-case-scraper)
 *
 * Endpoints:
 * GET  /api/health
 * GET  /api/states
 * GET  /api/districts?state_code=...
 * POST /api/cnr       { cnr }
 * POST /api/party     { state_code, district_code, name }
 * POST /api/advocate  { state_code, district_code, name }
 */

'use strict';

const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');
const NodeCache = require('node-cache');

// ── Published NPM module ─────────────────────────────────────
const ecourts = require('@bullpenm/legal-case-scraper');
// ─────────────────────────────────────────────────────────────

const app   = express();
const cache = new NodeCache({ stdTTL: 3600 }); // 1 hour cache

/* ─────────────────────────────────────────────
   CONFIG & PROXY
───────────────────────────────────────────── */

const PORT = process.env.PORT || 3000;

// FREE INDIAN PROXIES (Update if the government blocks one)
// 103.122.60.229:8080
// 4.213.98.253:80
// 27.34.242.98:80
const INDIAN_PROXY = process.env.INDIAN_PROXY || 'http://103.122.60.229:8080';

/* ─────────────────────────────────────────────
   SESSION MANAGEMENT
   Single shared session, refreshed on error
───────────────────────────────────────────── */

let _session = null;

async function getSession() {
    if (!_session) {
        console.log('Creating eCourts session via proxy...');
        _session = await ecourts.createSession(INDIAN_PROXY);
        console.log('Session ready. Token:', _session.appToken || 'none');
    }
    return _session;
}

async function refreshSession() {
    console.log('Refreshing session via proxy...');
    try {
        _session = await ecourts.createSession(INDIAN_PROXY);
    } catch (e) {
        _session = null;
        console.error('Session refresh failed:', e.message);
    }
}

/* ─────────────────────────────────────────────
   MIDDLEWARE
───────────────────────────────────────────── */

app.use(helmet());
app.use(express.json());
app.use(cors({
    origin:         true,
    methods:        ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Accept'],
}));

app.use(rateLimit({
    windowMs: 60 * 1000,
    max:      30,
    message:  { error: 'Too many requests. Please wait a minute.' },
}));

/* ─────────────────────────────────────────────
   ROUTES
───────────────────────────────────────────── */

app.get('/api/health', (req, res) => {
    res.json({
        status:    'ok',
        version:   '0.2.0',
        source:    'ecourts.gov.in (via @bullpenm/legal-case-scraper)',
        proxy:     'active',
        timestamp: new Date().toISOString(),
    });
});

app.get('/api/states', async (req, res) => {
    const cached = cache.get('states');
    if (cached) return res.json({ success: true, data: cached });

    try {
        const session = await getSession();
        const states  = await ecourts.getStates(session);

        if (!states || states.length === 0) {
            return res.status(500).json({ success: false, error: 'No states returned.' });
        }

        cache.set('states', states);
        res.json({ success: true, data: states });

    } catch (err) {
        console.error('States error:', err.message);
        await refreshSession();
        res.status(500).json({ success: false, error: 'Failed to fetch states.' });
    }
});

app.get('/api/districts', async (req, res) => {
    const { state_code } = req.query;
    if (!state_code) {
        return res.status(400).json({ success: false, error: 'state_code is required.' });
    }

    const cacheKey = `districts_${state_code}`;
    const cached   = cache.get(cacheKey);
    if (cached) return res.json({ success: true, data: cached });

    try {
        const session   = await getSession();
        const districts = await ecourts.getDistricts(session, state_code);
        cache.set(cacheKey, districts);
        res.json({ success: true, data: districts });

    } catch (err) {
        console.error('Districts error:', err.message);
        res.status(500).json({ success: false, error: 'Failed to fetch districts.' });
    }
});

app.post('/api/cnr', async (req, res) => {
    const { cnr } = req.body;
    if (!cnr) return res.status(400).json({ success: false, error: 'CNR number is required.' });

    const cleanCNR = cnr.replace(/[\s\-]/g, '').toUpperCase();
    if (!/^[A-Z0-9]{16}$/.test(cleanCNR)) {
        return res.status(400).json({ success: false, error: 'Invalid CNR. Must be 16 alphanumeric characters.' });
    }

    const cacheKey = `cnr_${cleanCNR}`;
    const cached   = cache.get(cacheKey);
    if (cached) return res.json({ success: true, data: cached });

    try {
        const session = await getSession();
        const data    = await ecourts.getCaseByCNR(session, cleanCNR);

        if (!data) {
            return res.status(404).json({ success: false, error: 'Case not found. Please check the CNR number.' });
        }

        cache.set(cacheKey, data);
        res.json({ success: true, data });

    } catch (err) {
        console.error('CNR error:', err.message);
        await refreshSession();
        res.status(500).json({ success: false, error: 'Failed to fetch case. Please try again.' });
    }
});

app.post('/api/party', async (req, res) => {
    const { state_code, district_code, name, case_type } = req.body;

    if (!state_code || !district_code || !name) {
        return res.status(400).json({ success: false, error: 'state_code, district_code and name are required.' });
    }
    if (name.trim().length < 3) {
        return res.status(400).json({ success: false, error: 'Name must be at least 3 characters.' });
    }

    try {
        const session = await getSession();
        const data    = await ecourts.searchByParty(session, {
            stateCode:    state_code,
            districtCode: district_code,
            name:         name.trim(),
            caseType:     case_type || '',
        });

        res.json({ success: true, data });

    } catch (err) {
        console.error('Party error:', err.message);
        await refreshSession();
        res.status(500).json({ success: false, error: 'Failed to search. Please try again.' });
    }
});

app.post('/api/advocate', async (req, res) => {
    const { state_code, district_code, name } = req.body;

    if (!state_code || !district_code || !name) {
        return res.status(400).json({ success: false, error: 'state_code, district_code and name are required.' });
    }
    if (name.trim().length < 3) {
        return res.status(400).json({ success: false, error: 'Name must be at least 3 characters.' });
    }

    try {
        const session = await getSession();
        const data    = await ecourts.searchByAdvocate(session, {
            stateCode:    state_code,
            districtCode: district_code,
            name:         name.trim(),
        });

        res.json({ success: true, data });

    } catch (err) {
        console.error('Advocate error:', err.message);
        await refreshSession();
        res.status(500).json({ success: false, error: 'Failed to search. Please try again.' });
    }
});

/* ─────────────────────────────────────────────
   ERROR HANDLER
───────────────────────────────────────────── */

app.use((err, req, res, next) => {
    console.error(err.message);
    res.status(500).json({ success: false, error: 'Internal server error.' });
});

/* ─────────────────────────────────────────────
   START
───────────────────────────────────────────── */

app.listen(PORT, async () => {
    console.log(`vaad.in backend v0.2.0 running on port ${PORT}`);
    console.log('Data source: ecourts.gov.in (via NPM module)');
    // Warm up session on startup
    getSession().catch(err => console.warn('Session warmup failed:', err.message));
});
