const express = require('express');
const cors = require('cors');
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
    console.warn("⚠️ FIREBASE_SERVICE_ACCOUNT missing. FUP and webhooks will not work.");
}

const db = admin.apps.length ? admin.firestore() : null;

// ── RAZORPAY INIT (safe — won't crash if env vars missing) ──
const rzp = (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_SECRET_KEY)
    ? new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_SECRET_KEY })
    : null;

if (!rzp) console.warn("⚠️ Razorpay keys missing. Payment orders will fail.");

const app = express();

// ── CORS ──
const allowedOrigins = [
    'https://vaad.pages.dev',
    'http://localhost:3000',
    'http://localhost:5500'
];
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.warn(`⛔ CORS blocked: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    }
}));

// ── RAW BODY for webhook (must be before express.json) ──
app.use('/api/webhook/razorpay', express.raw({ type: 'application/json' }));

// ── JSON for everything else ──
app.use(express.json());

// ── ECOURTS API CONFIG ──
const API_KEY = process.env.ECOURTS_API_KEY;
const BASE_URL = 'https://webapi.ecourtsindia.com/api/partner';
const eCourtsHeaders = {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json'
};

// ── PLAN LIMITS ──
const PLAN_LIMITS = {
    free:    1,
    pro:     30,
    promax:  100,
    supreme: 150
};

// ─────────────────────────────────────────────
// FUP MIDDLEWARE
// Checks userId, fetches user doc, validates cycle,
// enforces limit, increments count.
// Returns { userRef, userData } on success so the
// route can optionally decrement on eCourts failure.
// ─────────────────────────────────────────────
async function enforceFUP(req, res) {
    if (!db) {
        res.status(500).json({ success: false, error: 'Database not initialized.' });
        return null;
    }

    const { userId } = req.body;
    if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized. userId is required.' });
        return null;
    }

    let userSnap;
    try {
        userSnap = await db.collection('users').doc(userId).get();
    } catch (e) {
        console.error("FUP: Firestore read error:", e.message);
        res.status(500).json({ success: false, error: 'Could not verify user. Try again.' });
        return null;
    }

    if (!userSnap.exists) {
        res.status(401).json({ success: false, error: 'User not found.' });
        return null;
    }

    const userRef = userSnap.ref;
    let data = userSnap.data();

    // Normalize plan name
    let plan = String(data.plan || 'free').toLowerCase().replace(/[^a-z]/g, '');
    if (!PLAN_LIMITS[plan]) plan = 'free';

    // ── Cycle validation ──
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const cycleStart = data.cycleStartDate
        ? new Date(data.cycleStartDate)
        : today;
    cycleStart.setHours(0, 0, 0, 0);

    const diffDays = Math.floor((today - cycleStart) / (1000 * 60 * 60 * 24));

    if (diffDays >= 30) {
        const todayStr = new Date().toISOString().split('T')[0];

        if (plan !== 'free') {
            // ✨ FIX 1: Paid plan expired — Downgrade AND BLOCK ✨
            const updates = {
                plan: 'free',
                searchCount: 0,
                cycleStartDate: todayStr
            };
            try {
                await userRef.update(updates);
                console.log(`[FUP] User ${userId} paid plan expired. Downgraded to free.`);
            } catch (e) {
                console.error("FUP: Failed to reset cycle:", e.message);
            }
            
            // Immediately stop the search and tell frontend to show upgrade modal
            res.status(403).json({
                success: false,
                error: 'subscription_expired',
                message: 'Your Pro subscription has expired. Please upgrade to continue searching.'
            });
            return null; // Stop execution
            
        } else {
            // Free plan expired - Just reset their count and let them search
            const updates = {
                searchCount: 0,
                cycleStartDate: todayStr
            };
            try {
                await userRef.update(updates);
                data = { ...data, ...updates }; // Update local data to pass the limit check below
            } catch (e) {
                console.error("FUP: Failed to reset free cycle:", e.message);
                res.status(500).json({ success: false, error: 'Could not reset usage cycle.' });
                return null;
            }
        }
    }

    const limit = PLAN_LIMITS[plan];
    const searchCount = data.searchCount || 0;

    // ── Enforce limit ──
    if (searchCount >= limit) {
        res.status(403).json({
            success: false,
            error: 'Limit reached. Please upgrade your plan.',
            plan: plan,
            used: searchCount,
            limit: limit
        });
        return null;
    }

    // ── Increment count BEFORE search ──
    try {
        await userRef.update({
            searchCount: admin.firestore.FieldValue.increment(1)
        });
    } catch (e) {
        console.error("FUP: Failed to increment searchCount:", e.message);
        res.status(500).json({ success: false, error: 'Could not update usage. Try again.' });
        return null;
    }

    // Return ref so route can decrement on eCourts failure
    return { userRef, plan, searchCount, limit };
}

// Helper to decrement count if eCourts API fails (user not charged for our failure)
async function decrementOnFailure(userRef) {
    try {
        await userRef.update({
            searchCount: admin.firestore.FieldValue.increment(-1)
        });
    } catch (e) {
        console.error("FUP: Failed to decrement on failure:", e.message);
    }
}

// ─────────────────────────────────────────────
// ROUTE 1: CNR SEARCH
// ─────────────────────────────────────────────
app.post('/api/cnr', async (req, res) => {
    const fup = await enforceFUP(req, res);
    if (!fup) return;

    const { cnr } = req.body;
    if (!cnr) return res.status(400).json({ success: false, error: 'CNR is required.' });

    try {
        const response = await fetch(`${BASE_URL}/case/${cnr}`, { method: 'GET', headers: eCourtsHeaders });
        const data = await response.json();
        if (!response.ok) {
            await decrementOnFailure(fup.userRef);
            return res.status(400).json({ success: false, error: data.message || 'Case not found.' });
        }
        return res.json({ success: true, data });
    } catch (error) {
        console.error("CNR Error:", error);
        await decrementOnFailure(fup.userRef);
        return res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});

// ─────────────────────────────────────────────
// ROUTE 2: LIST SEARCH (litigant / advocate / judge)
// ─────────────────────────────────────────────
app.post('/api/search', async (req, res) => {
    const fup = await enforceFUP(req, res);
    if (!fup) return;

    const { query, type } = req.body;
    if (!query || !type) return res.status(400).json({ success: false, error: 'Query and type are required.' });

    let url = `${BASE_URL}/search?pageSize=10&`;
    if (type === 'litigant') url += `litigants=${encodeURIComponent(query)}`;
    else if (type === 'advocate') url += `advocates=${encodeURIComponent(query)}`;
    else if (type === 'judge') url += `judges=${encodeURIComponent(query)}`;
    else return res.status(400).json({ success: false, error: 'Invalid search type.' });

    try {
        const response = await fetch(url, { method: 'GET', headers: eCourtsHeaders });
        const data = await response.json();
        if (!response.ok) {
            await decrementOnFailure(fup.userRef);
            return res.status(400).json({ success: false, error: data.message || 'Search failed.' });
        }
        return res.json({ success: true, data: data.data.results });
    } catch (error) {
        console.error("Search Error:", error);
        await decrementOnFailure(fup.userRef);
        return res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});

// ─────────────────────────────────────────────
// ROUTE 3: CAUSE LIST
// ─────────────────────────────────────────────
app.post('/api/causelist', async (req, res) => {
    const fup = await enforceFUP(req, res);
    if (!fup) return;

    const { query, state, limit } = req.body;
    if (!query || !state) return res.status(400).json({ success: false, error: 'Query and State are required.' });

    const url = `${BASE_URL}/causelist/search?q=${encodeURIComponent(query)}&state=${encodeURIComponent(state)}&limit=${limit || 10}`;

    try {
        const response = await fetch(url, { method: 'GET', headers: eCourtsHeaders });
        const data = await response.json();
        if (!response.ok) {
            await decrementOnFailure(fup.userRef);
            return res.status(400).json({ success: false, error: data.message || 'Cause list failed.' });
        }
        return res.json({ success: true, data });
    } catch (error) {
        console.error("Causelist Error:", error);
        await decrementOnFailure(fup.userRef);
        return res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});

// ─────────────────────────────────────────────
// ROUTE 4: BULK REFRESH
// ─────────────────────────────────────────────
app.post('/api/bulk-refresh', async (req, res) => {
    const fup = await enforceFUP(req, res);
    if (!fup) return;

    const { cnrs } = req.body;
    if (!cnrs || !Array.isArray(cnrs)) return res.status(400).json({ success: false, error: 'Array of CNRs is required.' });

    try {
        const response = await fetch(`${BASE_URL}/case/bulk-refresh`, {
            method: 'POST',
            headers: eCourtsHeaders,
            body: JSON.stringify({ cnrs })
        });
        const data = await response.json();
        if (!response.ok) {
            await decrementOnFailure(fup.userRef);
            return res.status(400).json({ success: false, error: data.message || 'Bulk refresh failed.' });
        }
        return res.json({ success: true, data });
    } catch (error) {
        console.error("Bulk Refresh Error:", error);
        await decrementOnFailure(fup.userRef);
        return res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});

// ─────────────────────────────────────────────
// ROUTE 5: AI ORDER ANALYSIS (no FUP — separate feature)
// ─────────────────────────────────────────────
app.post('/api/order/analyze', async (req, res) => {
    const { cnr, filename, type } = req.body;
    if (!cnr || !filename || !type) return res.status(400).json({ success: false, error: 'CNR, filename, and type required.' });

    try {
        const endpointType = type === 'summary' ? 'order-ai' : 'order-md';
        const response = await fetch(`${BASE_URL}/case/${cnr}/${endpointType}/${filename}`, { method: 'GET', headers: eCourtsHeaders });
        const data = await response.json();
        if (!response.ok) return res.status(400).json({ success: false, error: data.message || `Failed to fetch ${type}.` });
        return res.json({ success: true, data });
    } catch (error) {
        console.error("Analyze Error:", error);
        return res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});

// ─────────────────────────────────────────────
// ROUTE 6: PDF DOWNLOAD 
// ─────────────────────────────────────────────
app.post('/api/download', async (req, res) => {
    // ✨ FIX 2: Added userId to requirement and implemented Backend Paywall ✨
    const { cnr, filename, userId } = req.body;
    if (!cnr || !filename || !userId) return res.status(400).json({ success: false, error: 'CNR, filename, and userId are required.' });

    if (!db) return res.status(500).json({ success: false, error: 'Database not initialized.' });

    try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists || userDoc.data().plan === 'free' || !userDoc.data().plan) {
            return res.status(403).json({ 
                success: false, 
                error: 'premium_required',
                message: 'PDF downloads are a premium feature. Please upgrade your plan.' 
            });
        }
    } catch (error) {
        console.error("PDF Auth Error:", error);
        return res.status(500).json({ success: false, error: 'Could not verify user subscription.' });
    }

    try {
        const response = await fetch(`${BASE_URL}/case/${cnr}/order/${filename}`, { method: 'GET', headers: eCourtsHeaders });
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

// ─────────────────────────────────────────────
// ROUTE 7: INITIATE PAYMENT ORDER
// ─────────────────────────────────────────────
app.post('/api/initiate-payment', async (req, res) => {
    if (!rzp) return res.status(500).json({ success: false, error: 'Payment service not configured.' });

    const { userId, plan, amount } = req.body;
    if (!userId || !plan || !amount) return res.status(400).json({ success: false, error: 'userId, plan, and amount are required.' });

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

// ─────────────────────────────────────────────
// ROUTE 8: RAZORPAY WEBHOOK
// ─────────────────────────────────────────────
app.post('/api/webhook/razorpay', async (req, res) => {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
        console.error("❌ RAZORPAY_WEBHOOK_SECRET not set.");
        return res.status(500).json({ error: 'Server config error.' });
    }

    const signature = req.headers['x-razorpay-signature'];
    const rawBody = req.body;
    const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex');

    if (signature !== expectedSignature) {
        console.error("⛔ Invalid webhook signature.");
        return res.status(400).json({ error: 'Invalid signature.' });
    }

    let payload;
    try {
        payload = JSON.parse(rawBody.toString());
    } catch (e) {
        return res.status(400).json({ error: 'Invalid JSON payload.' });
    }

    console.log("✅ Webhook verified.");

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
            console.error(`⛔⛔ FRAUD: User ${firebaseUserId} paid ₹${actualAmountPaidPaise / 100} for ₹${expectedAmountPaise / 100} plan.`);
            try {
                await db.collection('users').doc(firebaseUserId).update({
                    plan: 'free',
                    fraudulentAttemptNote: `Tamper: paid ₹${actualAmountPaidPaise / 100} for ${purchasedPlan} on ${new Date().toISOString()}`
                });
            } catch (e) {
                console.error("Failed to flag fraud:", e.message);
            }
            return res.status(200).json({ status: 'fraud_handled' });
        }

        // ✅ Valid payment — upgrade plan and reset search count for new cycle
        try {
            const today = new Date().toISOString().split('T')[0];
            await db.collection('users').doc(firebaseUserId).update({
                plan: purchasedPlan,
                cycleStartDate: today,
                searchCount: 0,
                fraudulentAttemptNote: admin.firestore.FieldValue.delete()
            });
            console.log(`✅ Upgraded ${firebaseUserId} → ${purchasedPlan}`);
            return res.status(200).json({ status: 'success' });
        } catch (error) {
            console.error("❌ Firebase upgrade failed:", error.message);
            return res.status(500).json({ error: 'Database error.' }); // 500 = Razorpay retries
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
