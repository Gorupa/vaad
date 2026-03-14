/**
 * vaad.in — backend/server.js
 * Node.js + Express backend for eCourts data
 *
 * Author : gorupa (https://github.com/gorupa)
 * License: MIT
 *
 * Endpoints:
 *   GET  /api/health
 *   GET  /api/states
 *   GET  /api/districts?state_code=...
 *   POST /api/cnr          { cnr }
 *   POST /api/party        { state_code, district_code, name, case_type }
 *   POST /api/advocate     { state_code, district_code, name }
 */

'use strict';

const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');
const NodeCache  = require('node-cache');
const axios      = require('axios');

const app   = express();
const cache = new NodeCache({ stdTTL: 3600 }); // cache 1 hour

/* ─────────────────────────────────────────────
   CONFIG
───────────────────────────────────────────── */

const PORT         = process.env.PORT || 3000;
const ECIAPI_BASE  = 'https://eciapi.akshit.me';
const ALLOWED_ORIGINS = [
    'https://vaad.in',
    'https://www.vaad.in',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'http://localhost:3000',
];

/* ─────────────────────────────────────────────
   MIDDLEWARE
───────────────────────────────────────────── */

app.use(helmet());
app.use(express.json());
app.use(cors({
    origin: (origin, cb) => {
        if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
        cb(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST'],
}));

// Rate limiting — 30 requests per minute per IP
app.use(rateLimit({
    windowMs: 60 * 1000,
    max:      30,
    message:  { error: 'Too many requests. Please wait a minute.' },
}));

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */

/**
 * Fetch from ECIAPI with cache
 * @param {string} endpoint
 * @param {object} params
 * @param {string} cacheKey
 */
async function fetchECI(endpoint, params = {}, cacheKey) {
    if (cacheKey) {
        const cached = cache.get(cacheKey);
        if (cached) return cached;
    }

    const res = await axios.get(`${ECIAPI_BASE}${endpoint}`, {
        params,
        timeout: 15000,
        headers: { 'Accept': 'application/json' },
    });

    if (cacheKey) cache.set(cacheKey, res.data);
    return res.data;
}

/**
 * POST to ECIAPI with cache
 */
async function postECI(endpoint, body, cacheKey) {
    if (cacheKey) {
        const cached = cache.get(cacheKey);
        if (cached) return cached;
    }

    const res = await axios.post(`${ECIAPI_BASE}${endpoint}`, body, {
        timeout: 15000,
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    });

    if (cacheKey) cache.set(cacheKey, res.data);
    return res.data;
}

/* ─────────────────────────────────────────────
   ROUTES
───────────────────────────────────────────── */

/** Health check */
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', version: '0.1.0', timestamp: new Date().toISOString() });
});

/**
 * GET /api/states
 * Returns list of all states with codes
 */
app.get('/api/states', async (req, res) => {
    try {
        const data = await fetchECI('/states', {}, 'states');
        res.json({ success: true, data });
    } catch (err) {
        console.error('States error:', err.message);
        res.status(500).json({ success: false, error: 'Failed to fetch states.' });
    }
});

/**
 * GET /api/districts?state_code=24
 * Returns districts for a given state
 */
app.get('/api/districts', async (req, res) => {
    const { state_code } = req.query;
    if (!state_code) return res.status(400).json({ success: false, error: 'state_code is required.' });

    try {
        const data = await fetchECI('/districts', { state_code }, `districts_${state_code}`);
        res.json({ success: true, data });
    } catch (err) {
        console.error('Districts error:', err.message);
        res.status(500).json({ success: false, error: 'Failed to fetch districts.' });
    }
});

/**
 * POST /api/cnr
 * Body: { cnr: "MHAU010012342023" }
 * Returns full case details by CNR number
 */
app.post('/api/cnr', async (req, res) => {
    const { cnr } = req.body;
    if (!cnr) return res.status(400).json({ success: false, error: 'CNR number is required.' });

    // Basic CNR format validation — 16 alphanumeric chars
    const cleanCNR = cnr.replace(/[\s\-]/g, '').toUpperCase();
    if (!/^[A-Z0-9]{16}$/.test(cleanCNR)) {
        return res.status(400).json({ success: false, error: 'Invalid CNR format. CNR must be 16 alphanumeric characters.' });
    }

    try {
        const data = await postECI('/cnr', { cnr: cleanCNR }, `cnr_${cleanCNR}`);
        res.json({ success: true, data });
    } catch (err) {
        console.error('CNR error:', err.message);
        if (err.response?.status === 404) {
            return res.status(404).json({ success: false, error: 'Case not found. Please check the CNR number.' });
        }
        res.status(500).json({ success: false, error: 'Failed to fetch case details.' });
    }
});

/**
 * POST /api/party
 * Body: { state_code, district_code, name, case_type? }
 * Returns cases matching party name
 */
app.post('/api/party', async (req, res) => {
    const { state_code, district_code, name, case_type } = req.body;
    if (!state_code || !district_code || !name) {
        return res.status(400).json({ success: false, error: 'state_code, district_code and name are required.' });
    }
    if (name.trim().length < 3) {
        return res.status(400).json({ success: false, error: 'Name must be at least 3 characters.' });
    }

    try {
        const body = { state_code, district_code, name: name.trim(), ...(case_type && { case_type }) };
        const data = await postECI('/party', body);
        res.json({ success: true, data });
    } catch (err) {
        console.error('Party error:', err.message);
        res.status(500).json({ success: false, error: 'Failed to fetch cases.' });
    }
});

/**
 * POST /api/advocate
 * Body: { state_code, district_code, name }
 * Returns cases for an advocate
 */
app.post('/api/advocate', async (req, res) => {
    const { state_code, district_code, name } = req.body;
    if (!state_code || !district_code || !name) {
        return res.status(400).json({ success: false, error: 'state_code, district_code and name are required.' });
    }
    if (name.trim().length < 3) {
        return res.status(400).json({ success: false, error: 'Name must be at least 3 characters.' });
    }

    try {
        const data = await postECI('/advocate', { state_code, district_code, name: name.trim() });
        res.json({ success: true, data });
    } catch (err) {
        console.error('Advocate error:', err.message);
        res.status(500).json({ success: false, error: 'Failed to fetch advocate cases.' });
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

app.listen(PORT, () => {
    console.log(`vaad.in backend running on port ${PORT}`);
});
