/**
 * court-api — backend/server.js
 * Node.js + Express backend for eCourts data with ultimate zkTLS polyfills
 */

'use strict';

// --- ULTIMATE BROWSER POLYFILLS FOR zkTLS (WASM) ---
global.window = global;
global.self = global;

// Fake the browser's URL and document so the WASM file can "find" itself
global.document = { baseURI: 'http://localhost/' };
global.location = { href: 'http://localhost/' };
global.self.location = global.location;


// Map WebSockets
const WebSocket = require('ws');
global.WebSocket = WebSocket;

// Map Web Crypto
const crypto = require('crypto');
if (!global.crypto) {
    global.crypto = crypto.webcrypto;
}
// ---------------------------------------------------

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const NodeCache = require('node-cache');

// Your open-source scraper/engine
const ecourts = require('@bullpenm/legal-case-scraper');

const app = express();
const cache = new NodeCache({ stdTTL: 3600 }); // 1 hour cache
const PORT = process.env.PORT || 3000;

// FREE INDIAN PROXIES (Update if the government blocks one)
const INDIAN_PROXY = process.env.INDIAN_PROXY || 'http://103.122.60.229:8080';

let _session = null;

async function getSession() {
    if (!_session) {
        console.log('Creating eCourts session via proxy...');
        try {
            _session = await ecourts.createSession(INDIAN_PROXY);
            console.log('Session ready.');
        } catch (err) {
            console.error('Session creation failed:', err.message);
            throw err;
        }
    }
    return _session;
}

// --- MIDDLEWARE ---
app.use(helmet());
app.use(express.json());
app.use(cors({
    origin: true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Accept'],
}));

app.use(rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    message: { error: 'Too many requests. Please wait a minute.' },
}));

// --- ROUTES ---

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        version: '1.0.0',
        proxy: 'active',
        zkTLS: 'ready'
    });
});

app.post('/api/cnr', async (req, res) => {
    const { cnr } = req.body;
    if (!cnr) return res.status(400).json({ success: false, error: 'CNR number is required.' });

    const cleanCNR = cnr.replace(/[\s\-]/g, '').toUpperCase();
    if (!/^[A-Z0-9]{16}$/.test(cleanCNR)) {
        return res.status(400).json({ success: false, error: 'Invalid CNR. Must be 16 alphanumeric characters.' });
    }

    const cacheKey = `cnr_${cleanCNR}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json({ success: true, data: cached });

    try {
        const session = await getSession();
        
        // Calls your library, which handles the zkTLS proofs under the hood
        const data = await ecourts.getCaseByCNR(session, cleanCNR);

        if (!data) {
            return res.status(404).json({ success: false, error: 'Case not found.' });
        }

        cache.set(cacheKey, data);
        res.json({ success: true, data });

    } catch (error) {
        console.error('CNR error:', error.message);
        _session = null; // Reset session on error so it generates a fresh one next time
        res.status(500).json({ success: false, error: 'Failed to fetch case. Proxy or eCourts server may be down.' });
    }
});

// --- START SERVER ---
app.listen(PORT, async () => {
    console.log(`Vaad Backend running on port ${PORT}`);
    console.log('Ultimate zkTLS Polyfills initialized successfully.');
    
    // Warm up session on startup
    getSession().catch(() => console.log('Will retry session on first request.'));
});
