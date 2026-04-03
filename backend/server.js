const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const fetch = require('node-fetch');
const crypto = require('crypto');
const admin = require('firebase-admin');
const Razorpay = require('razorpay');

// ── FIREBASE ADMIN INIT ──
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        console.log("✅ Firebase Admin Initialized.");
    } catch (e) {
        console.error("❌ Failed to parse FIREBASE_SERVICE_ACCOUNT:", e.message);
    }
} else {
    console.warn("⚠️ FIREBASE_SERVICE_ACCOUNT missing. Webhooks will not update database.");
}

const db = admin.apps.length ? admin.firestore() : null;

// ── RAZORPAY INIT (safe — won't crash if env vars missing) ──
const rzp = (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_SECRET_KEY)
    ? new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_SECRET_KEY })
    : null;

if (!rzp) console.warn("⚠️ RAZORPAY_KEY_ID or RAZORPAY_SECRET_KEY missing. Payment orders will fail.");

const app = express();

// ── SECURITY: Helmet (sets safe HTTP headers) ──
app.use(helmet());

// ── SECURITY: CORS (locked to your Cloudflare domain) ──
const allowedOrigins = [
    'https://vaad.pages.dev',
    'http://localhost:3000',   // for local dev
    'http://localhost:5500'    // for local dev with Live Server
];
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Razorpay webhook, health checks)
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.warn(`⛔ CORS blocked request from: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    }
}));

// ── SECURITY: Rate Limiting ──
// General API limit — 60 requests per minute per IP
const generalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    message: { success: false, error: 'Too many requests. Please slow down.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Stricter limit for search routes — prevents API key abuse
const searchLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    message: { success: false, error: 'Search rate limit exceeded. Try again in a minute.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Payment limiter — prevent order spam
const paymentLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: { success: false, error: 'Too many payment requests. Please wait.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Apply general limiter to all routes
app.use('/api/', generalLimiter);

// ── IMPORTANT: Webhook needs raw body for signature verification ──
// Must be before express.json()
app.use('/api/webhook/razorpay', express.raw({ type: 'application/json' }));

// Parse JSON for all other routes
app.use(express.json());

const API_KEY = process.env.ECOURTS_API_KEY;
const BASE_URL = 'https://webapi.ecourtsindia.com/api/partner';

const headers = {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json'
};

// ── ROUTE 1: CNR SEARCH ──
app.post('/api/cnr', searchLimiter, async (req, res) => {
    const { cnr } = req.body;
    if (!cnr) return res.status(400).json({ success: false, error: 'CNR is required' });

    try {
        const response = await fetch(`${BASE_URL}/case/${cnr}`, { method: 'GET', headers });
        const data = await response.json();
        if (!response.ok) return res.status(400).json({ success: false, error: data.message || 'Case not found.' });
        return res.json({ success: true, data: data });
    } catch (error) {
        console.error("CNR Error:", error);
        return res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});

// ── ROUTE 2: LIST SEARCH ──
app.post('/api/search', searchLimiter, async (req, res) => {
    const { query, type } = req.body;
    if (!query || !type) return res.status(400).json({ success: false, error: 'Query and type are required' });

    let url = `${BASE_URL}/search?pageSize=10&`;
    if (type === 'litigant') url += `litigants=${encodeURIComponent(query)}`;
    else if (type === 'advocate') url += `advocates=${encodeURIComponent(query)}`;
    else if (type === 'judge') url += `judges=${encodeURIComponent(query)}`;
    else return res.status(400).json({ success: false, error: 'Invalid search type' });

    try {
        const response = await fetch(url, { method: 'GET', headers });
        const data = await response.json();
        if (!response.ok) return res.status(400).json({ success: false, error: data.message || 'Search failed.' });
        return res.json({ success: true, data: data.data.results });
    } catch (error) {
        console.error("Search Error:", error);
        return res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});

// ── ROUTE 3: CAUSE LIST ──
app.post('/api/causelist', searchLimiter, async (req, res) => {
    const { query, state, limit } = req.body;
    if (!query || !state) return res.status(400).json({ success: false, error: 'Query and State are required' });

    const url = `${BASE_URL}/causelist/search?q=${encodeURIComponent(query)}&state=${encodeURIComponent(state)}&limit=${limit || 10}`;

    try {
        const response = await fetch(url, { method: 'GET', headers });
        const data = await response.json();
        if (!response.ok) return res.status(400).json({ success: false, error: data.message || 'Cause list failed.' });
        return res.json({ success: true, data: data });
    } catch (error) {
        console.error("Causelist Error:", error);
        return res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});

// ── ROUTE 4: BULK REFRESH ──
app.post('/api/bulk-refresh', searchLimiter, async (req, res) => {
    const { cnrs } = req.body;
    if (!cnrs || !Array.isArray(cnrs)) return res.status(400).json({ success: false, error: 'Array of CNRs is required' });

    try {
        const response = await fetch(`${BASE_URL}/case/bulk-refresh`, {
            method: 'POST', headers, body: JSON.stringify({ cnrs })
        });
        const data = await response.json();
        if (!response.ok) return res.status(400).json({ success: false, error: data.message || 'Bulk refresh failed.' });
        return res.json({ success: true, data: data });
    } catch (error) {
        console.error("Bulk Refresh Error:", error);
        return res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});

// ── ROUTE 5: AI ORDER ANALYSIS ──
app.post('/api/order/analyze', async (req, res) => {
    const { cnr, filename, type } = req.body;
    if (!cnr || !filename || !type) return res.status(400).json({ success: false, error: 'CNR, filename, and type required' });

    try {
        const endpointType = type === 'summary' ? 'order-ai' : 'order-md';
        const response = await fetch(`${BASE_URL}/case/${cnr}/${endpointType}/${filename}`, { method: 'GET', headers });
        const data = await response.json();
        if (!response.ok) return res.status(400).json({ success: false, error: data.message || `Failed to fetch ${type}.` });
        return res.json({ success: true, data: data });
    } catch (error) {
        console.error("Analyze Error:", error);
        return res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});

// ── ROUTE 6: PDF DOWNLOAD ──
app.post('/api/download', async (req, res) => {
    const { cnr, filename } = req.body;
    if (!cnr || !filename) return res.status(400).json({ success: false, error: 'CNR and filename are required' });

    try {
        const response = await fetch(`${BASE_URL}/case/${cnr}/order/${filename}`, { method: 'GET', headers });
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const data = await response.json();
            return res.status(400).json({ success: false, error: data.message || 'Could not fetch PDF.' });
        }
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return response.body.pipe(res);
    } catch (error) {
        console.error("Download Error:", error);
        return res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});

// ── ROUTE 7: INITIATE PAYMENT ORDER ──
app.post('/api/initiate-payment', paymentLimiter, async (req, res) => {
    if (!rzp) return res.status(500).json({ success: false, error: 'Payment service not configured.' });

    const { userId, plan, amount } = req.body;
    if (!userId || !plan || !amount) {
        return res.status(400).json({ success: false, error: 'userId, plan, and amount are required' });
    }

    const officialPricingPaise = { pro: 9900, promax: 19900, supreme: 39900 };
    const expectedAmountPaise = officialPricingPaise[plan];

    if (expectedAmountPaise === undefined || (amount * 100) !== expectedAmountPaise) {
        console.error(`⛔ TAMPER BLOCKED: User ${userId} sent invalid amount for plan: ${plan}`);
        return res.status(400).json({ success: false, error: 'Invalid plan or amount.' });
    }

    try {
        const order = await rzp.orders.create({
            amount: expectedAmountPaise,
            currency: 'INR',
            receipt: `vaad_${plan}_${Date.now()}`,
            notes: { userId, planName: plan }
        });
        return res.json({ success: true, data: { order } });
    } catch (error) {
        console.error("Razorpay Order Error:", error);
        return res.status(500).json({ success: false, error: 'Failed to create payment order.' });
    }
});

// ── ROUTE 8: RAZORPAY WEBHOOK ──
// Note: uses raw body (set up before express.json() above)
app.post('/api/webhook/razorpay', async (req, res) => {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
        console.error("❌ RAZORPAY_WEBHOOK_SECRET not set.");
        return res.status(500).json({ error: 'Server config error' });
    }

    const signature = req.headers['x-razorpay-signature'];
    const rawBody = req.body; // raw buffer from express.raw()
    const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex');

    if (signature !== expectedSignature) {
        console.error("⛔ Invalid webhook signature. Possible tampering.");
        return res.status(400).json({ error: 'Invalid signature' });
    }

    console.log("✅ Webhook verified.");

    let payload;
    try {
        payload = JSON.parse(rawBody.toString());
    } catch (e) {
        return res.status(400).json({ error: 'Invalid JSON payload' });
    }

    const paymentData = payload.payload?.payment?.entity;

    if (paymentData && paymentData.status === 'captured') {
        const firebaseUserId = paymentData.notes?.userId;
        const purchasedPlan = paymentData.notes?.planName;
        const actualAmountPaidPaise = paymentData.amount;

        if (!firebaseUserId || !purchasedPlan || !db) {
            console.warn("⚠️ Webhook valid but missing userId/planName or Firebase not ready.");
            return res.status(200).json({ status: 'ignored' });
        }

        const officialPricingPaise = { pro: 9900, promax: 19900, supreme: 39900 };
        const expectedAmountPaise = officialPricingPaise[purchasedPlan];

        if (expectedAmountPaise === undefined) {
            console.error(`⛔ Unknown plan in webhook: ${purchasedPlan}`);
            return res.status(200).json({ status: 'invalid_plan_ignored' });
        }

        if (actualAmountPaidPaise !== expectedAmountPaise) {
            console.error(`⛔⛔ FRAUD: User ${firebaseUserId} paid ₹${actualAmountPaidPaise/100} for ₹${expectedAmountPaise/100} plan.`);
            try {
                await db.collection('users').doc(firebaseUserId).update({
                    plan: 'free',
                    fraudulentAttemptNote: `Tamper: paid ₹${actualAmountPaidPaise/100} for ${purchasedPlan} on ${new Date().toISOString()}`
                });
            } catch (e) {
                console.error("Failed to flag fraud in Firebase:", e.message);
            }
            return res.status(200).json({ status: 'fraud_handled' });
        }

        // ✅ Valid payment — upgrade plan
        try {
            const today = new Date().toISOString().split('T')[0];
            await db.collection('users').doc(firebaseUserId).update({
                plan: purchasedPlan,
                cycleStartDate: today,
                fraudulentAttemptNote: admin.firestore.FieldValue.delete()
            });
            console.log(`✅ Upgraded ${firebaseUserId} → ${purchasedPlan}`);
            return res.status(200).json({ status: 'success' });
        } catch (error) {
            console.error("❌ Firebase update failed:", error.message);
            return res.status(500).json({ error: 'Database error' }); // 500 = Razorpay will retry
        }
    } else {
        console.log(`Webhook ignored. Status: ${paymentData?.status || 'unknown'}`);
        return res.status(200).json({ status: 'ignored' });
    }
});

// ── HEALTH CHECK ──
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Vaad backend running on port ${PORT}`));
