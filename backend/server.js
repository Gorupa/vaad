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

// ── RAZORPAY INIT ──
const rzp = (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_SECRET_KEY)
    ? new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_SECRET_KEY })
    : null;

if (!rzp) console.warn("⚠️ Razorpay keys missing. Payment orders will fail.");

const app = express();

app.use(cors({
    origin: (origin, callback) => {
        const allowedOrigins = ['https://vaad.pages.dev', 'http://localhost:3000', 'http://localhost:5500'];
        if (!origin || allowedOrigins.includes(origin)) { callback(null, true); } 
        else { callback(new Error('Not allowed by CORS')); }
    }
}));

app.use('/api/webhook/razorpay', express.raw({ type: 'application/json' }));
app.use(express.json());

const API_KEY = process.env.ECOURTS_API_KEY;
const BASE_URL = 'https://webapi.ecourtsindia.com/api/partner';
const eCourtsHeaders = { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' };

// ✨ REVENUE PROTECTION: THE 3-WALLET FUP MODEL ✨
const PLAN_LIMITS = {
    free:    { search: 1,   pdf: 0,  ai: 0 },
    pro:     { search: 30,  pdf: 5,  ai: 0 },
    promax:  { search: 100, pdf: 20, ai: 0 },
    supreme: { search: 150, pdf: 50, ai: 20 }
};

// ─────────────────────────────────────────────
// DYNAMIC FUP MIDDLEWARE (Protects Search, PDF, and AI)
// ─────────────────────────────────────────────
async function enforceFUP(req, res, actionType = 'search') {
    if (!db) { res.status(500).json({ success: false, error: 'Database not initialized.' }); return null; }

    const { userId } = req.body;
    if (!userId) { res.status(401).json({ success: false, error: 'Unauthorized. userId is required.' }); return null; }

    let userSnap;
    try { userSnap = await db.collection('users').doc(userId).get(); } 
    catch (e) { res.status(500).json({ success: false, error: 'Could not verify user.' }); return null; }

    if (!userSnap.exists) { res.status(401).json({ success: false, error: 'User not found.' }); return null; }

    const userRef = userSnap.ref;
    let data = userSnap.data();

    let plan = String(data.plan || 'free').toLowerCase().replace(/[^a-z]/g, '');
    if (!PLAN_LIMITS[plan]) plan = 'free';

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cycleStart = data.cycleStartDate ? new Date(data.cycleStartDate) : today;
    cycleStart.setHours(0, 0, 0, 0);

    const diffDays = Math.floor((today - cycleStart) / (1000 * 60 * 60 * 24));

    if (diffDays >= 30) {
        const todayStr = new Date().toISOString().split('T')[0];

        if (plan !== 'free') {
            // Paid plan expired -> Lock everything out instantly
            try {
                await userRef.update({ plan: 'free', searchCount: 0, pdfCount: 0, aiCount: 0, cycleStartDate: todayStr });
            } catch (e) { console.error("FUP Reset Error:", e); }
            
            res.status(403).json({ success: false, error: 'subscription_expired', message: 'Your Pro subscription has expired. Please renew.' });
            return null; 
        } else {
            // Free cycle reset
            const updates = { searchCount: 0, pdfCount: 0, aiCount: 0, cycleStartDate: todayStr };
            try { await userRef.update(updates); data = { ...data, ...updates }; } 
            catch (e) { res.status(500).json({ success: false, error: 'Could not reset usage cycle.' }); return null; }
        }
    }

    const limit = PLAN_LIMITS[plan][actionType];
    const usedCount = data[`${actionType}Count`] || 0;

    if (usedCount >= limit) {
        let msg = `Limit reached for ${actionType.toUpperCase()}. Please upgrade your plan.`;
        if (actionType === 'pdf' && plan === 'free') msg = "PDF downloads are a premium feature. Please upgrade your plan.";
        if (actionType === 'ai' && (plan === 'free' || plan === 'pro' || plan === 'promax')) msg = "AI Assistant is exclusive to the Supreme plan.";
        
        res.status(403).json({ success: false, error: 'limit_reached', message: msg });
        return null;
    }

    try {
        await userRef.update({ [`${actionType}Count`]: admin.firestore.FieldValue.increment(1) });
    } catch (e) { res.status(500).json({ success: false, error: 'Could not update usage.' }); return null; }

    return { userRef, actionType };
}

// Rollback helper if API fails
async function decrementOnFailure(fupData) {
    if (!fupData) return;
    try { await fupData.userRef.update({ [`${fupData.actionType}Count`]: admin.firestore.FieldValue.increment(-1) }); } 
    catch (e) { console.error("FUP decrement failed:", e); }
}

// ── ROUTE 1: CNR SEARCH ──
app.post('/api/cnr', async (req, res) => {
    const fup = await enforceFUP(req, res, 'search'); if (!fup) return;
    const { cnr } = req.body;
    try {
        const response = await fetch(`${BASE_URL}/case/${cnr}`, { headers: eCourtsHeaders });
        const data = await response.json();
        if (!response.ok) { await decrementOnFailure(fup); return res.status(400).json({ success: false, error: data.message }); }
        res.json({ success: true, data });
    } catch (error) { await decrementOnFailure(fup); res.status(500).json({ success: false, error: 'Server error' }); }
});

// ── ROUTE 2: LIST SEARCH ──
app.post('/api/search', async (req, res) => {
    const fup = await enforceFUP(req, res, 'search'); if (!fup) return;
    const { query, type } = req.body;
    let url = `${BASE_URL}/search?pageSize=10&`;
    if (type === 'litigant') url += `litigants=${encodeURIComponent(query)}`;
    else if (type === 'advocate') url += `advocates=${encodeURIComponent(query)}`;
    else if (type === 'judge') url += `judges=${encodeURIComponent(query)}`;
    
    try {
        const response = await fetch(url, { headers: eCourtsHeaders });
        const data = await response.json();
        if (!response.ok) { await decrementOnFailure(fup); return res.status(400).json({ success: false, error: data.message }); }
        res.json({ success: true, data: data.data.results });
    } catch (error) { await decrementOnFailure(fup); res.status(500).json({ success: false, error: 'Server error' }); }
});

// ── ROUTE 3: CAUSE LIST ──
app.post('/api/causelist', async (req, res) => {
    const fup = await enforceFUP(req, res, 'search'); if (!fup) return;
    const { query, state, limit } = req.body;
    try {
        const response = await fetch(`${BASE_URL}/causelist/search?q=${encodeURIComponent(query)}&state=${encodeURIComponent(state)}&limit=${limit || 10}`, { headers: eCourtsHeaders });
        const data = await response.json();
        if (!response.ok) { await decrementOnFailure(fup); return res.status(400).json({ success: false, error: data.message }); }
        res.json({ success: true, data });
    } catch (error) { await decrementOnFailure(fup); res.status(500).json({ success: false, error: 'Server error' }); }
});

// ── ROUTE 4: BULK REFRESH ──
app.post('/api/bulk-refresh', async (req, res) => {
    const fup = await enforceFUP(req, res, 'search'); if (!fup) return;
    const { cnrs } = req.body;
    try {
        const response = await fetch(`${BASE_URL}/case/bulk-refresh`, { method: 'POST', headers: eCourtsHeaders, body: JSON.stringify({ cnrs }) });
        const data = await response.json();
        if (!response.ok) { await decrementOnFailure(fup); return res.status(400).json({ success: false, error: data.message }); }
        res.json({ success: true, data });
    } catch (error) { await decrementOnFailure(fup); res.status(500).json({ success: false, error: 'Server error' }); }
});

// ── ROUTE 5: AI ORDER ANALYSIS (Uses 'ai' credit) ──
app.post('/api/order/analyze', async (req, res) => {
    const fup = await enforceFUP(req, res, 'ai'); if (!fup) return;
    const { cnr, filename, type } = req.body;
    try {
        const endpointType = type === 'summary' ? 'order-ai' : 'order-md';
        const response = await fetch(`${BASE_URL}/case/${cnr}/${endpointType}/${filename}`, { headers: eCourtsHeaders });
        const data = await response.json();
        if (!response.ok) { await decrementOnFailure(fup); return res.status(400).json({ success: false, error: data.message }); }
        res.json({ success: true, data });
    } catch (error) { await decrementOnFailure(fup); res.status(500).json({ success: false, error: 'Server error' }); }
});

// ── ROUTE 6: PDF DOWNLOAD (Uses 'pdf' credit) ──
app.post('/api/download', async (req, res) => {
    const fup = await enforceFUP(req, res, 'pdf'); if (!fup) return;
    const { cnr, filename } = req.body;
    try {
        const response = await fetch(`${BASE_URL}/case/${cnr}/order/${filename}`, { headers: eCourtsHeaders });
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            await decrementOnFailure(fup);
            const data = await response.json();
            return res.status(400).json({ success: false, error: data.message });
        }
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return response.body.pipe(res);
    } catch (error) { await decrementOnFailure(fup); res.status(500).json({ success: false, error: 'Server error' }); }
});

// ── PAYMENTS & WEBHOOKS (Unchanged) ──
app.post('/api/initiate-payment', async (req, res) => {
    if (!rzp) return res.status(500).json({ success: false, error: 'Payment service not configured.' });
    const { userId, plan, amount } = req.body;
    const officialPricingPaise = { pro: 9900, promax: 19900, supreme: 39900 };
    if (officialPricingPaise[plan] === undefined || (amount * 100) !== officialPricingPaise[plan]) return res.status(400).json({ success: false, error: 'Invalid plan or amount.' });
    try {
        const order = await rzp.orders.create({ amount: officialPricingPaise[plan], currency: 'INR', receipt: `vaad_${plan}_${Date.now()}`, notes: { userId, planName: plan } });
        res.json({ success: true, data: { order } });
    } catch (error) { res.status(500).json({ success: false, error: 'Order failed.' }); }
});

app.post('/api/webhook/razorpay', async (req, res) => {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers['x-razorpay-signature'];
    const expectedSignature = crypto.createHmac('sha256', webhookSecret).update(req.body).digest('hex');
    if (signature !== expectedSignature) return res.status(400).json({ error: 'Invalid signature.' });
    
    const paymentData = JSON.parse(req.body.toString()).payload?.payment?.entity;
    if (paymentData && paymentData.status === 'captured') {
        const firebaseUserId = paymentData.notes?.userId;
        const purchasedPlan = paymentData.notes?.planName;
        try {
            await db.collection('users').doc(firebaseUserId).update({
                plan: purchasedPlan, cycleStartDate: new Date().toISOString().split('T')[0],
                searchCount: 0, pdfCount: 0, aiCount: 0 // Reset all 3 wallets on purchase
            });
            return res.status(200).json({ status: 'success' });
        } catch (error) { return res.status(500).json({ error: 'Database error.' }); }
    }
    return res.status(200).json({ status: 'ignored' });
});

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
app.listen(process.env.PORT || 3000, () => console.log(`🚀 Vaad backend running`));
