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
        console.error("❌ Firebase Init Error:", e.message); 
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
    origin: ['https://vaad.pages.dev', 'http://localhost:3000', 'http://localhost:5500'] 
}));

// RAW BODY for webhook (must be before express.json)
app.use('/api/webhook/razorpay', express.raw({ type: 'application/json' }));
app.use(express.json());

const API_KEY = process.env.ECOURTS_API_KEY;
const BASE_URL = 'https://webapi.ecourtsindia.com/api/partner';
const eCourtsHeaders = { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' };

// ✨ THE 3-WALLET FUP MODEL ✨
const PLAN_LIMITS = {
    free:    { search: 1,   pdf: 0,  ai: 0 },
    pro:     { search: 30,  pdf: 5,  ai: 0 },
    promax:  { search: 100, pdf: 20, ai: 0 },
    supreme: { search: 150, pdf: 50, ai: 20 }
};

// ─────────────────────────────────────────────
// DYNAMIC FUP MIDDLEWARE (Protects Search, PDF, AI, and Bulk Cost)
// ─────────────────────────────────────────────
async function enforceFUP(req, res, actionType = 'search', deductAmount = 1) {
    if (!db) { res.status(500).json({ success: false, error: 'Database error.' }); return null; }
    
    const { userId } = req.body;
    if (!userId) { res.status(401).json({ success: false, error: 'Please sign in.' }); return null; }

    let userSnap = await db.collection('users').doc(userId).get();
    if (!userSnap.exists) { res.status(401).json({ success: false, error: 'User not found.' }); return null; }

    const userRef = userSnap.ref;
    let data = userSnap.data();
    let plan = String(data.plan || 'free').toLowerCase().replace(/[^a-z]/g, '');
    if (!PLAN_LIMITS[plan]) plan = 'free';

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const cycleStart = data.cycleStartDate ? new Date(data.cycleStartDate) : today; 
    cycleStart.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((today - cycleStart) / (1000 * 60 * 60 * 24));

    if (diffDays >= 30) {
        const todayStr = new Date().toISOString().split('T')[0];
        if (plan !== 'free') {
            await userRef.update({ plan: 'free', searchCount: 0, pdfCount: 0, aiCount: 0, cycleStartDate: todayStr });
            res.status(403).json({ success: false, error: 'subscription_expired', message: 'Your Pro subscription has expired. Please renew.' });
            return null; 
        } else {
            await userRef.update({ searchCount: 0, pdfCount: 0, aiCount: 0, cycleStartDate: todayStr });
            data.searchCount = 0; data.pdfCount = 0; data.aiCount = 0;
        }
    }

    const limit = PLAN_LIMITS[plan][actionType];
    const usedCount = data[`${actionType}Count`] || 0;

    if (usedCount + deductAmount > limit) {
        let msg = `Limit reached. You have ${Math.max(0, limit - usedCount)} credits left, but tried to use ${deductAmount}. Upgrade your plan.`;
        if (actionType === 'pdf' && plan === 'free') msg = "PDF downloads are a premium feature. Please upgrade your plan.";
        if (actionType === 'ai' && plan !== 'supreme') msg = "AI Assistant is exclusive to the Supreme plan.";
        res.status(403).json({ success: false, error: 'limit_reached', message: msg });
        return null;
    }

    await userRef.update({ [`${actionType}Count`]: admin.firestore.FieldValue.increment(deductAmount) });
    return { userRef, actionType, deductAmount, plan };
}

async function decrementOnFailure(fup) {
    if (!fup) return;
    try {
        await fup.userRef.update({ [`${fup.actionType}Count`]: admin.firestore.FieldValue.increment(-fup.deductAmount) });
    } catch (e) { console.error("FUP decrement failed:", e); }
}

// ── ROUTE 1: CNR SEARCH ──
app.post('/api/cnr', async (req, res) => {
    const fup = await enforceFUP(req, res, 'search', 1); if (!fup) return;
    try {
        const r = await fetch(`${BASE_URL}/case/${req.body.cnr}`, { headers: eCourtsHeaders });
        const d = await r.json();
        if (!r.ok) { await decrementOnFailure(fup); return res.status(400).json({ success: false, error: d.message }); }
        res.json({ success: true, data: d });
    } catch (e) { await decrementOnFailure(fup); res.status(500).json({ success: false, error: 'Server error' }); }
});

// ── ROUTE 2: LIST SEARCH ──
app.post('/api/search', async (req, res) => {
    const fup = await enforceFUP(req, res, 'search', 1); if (!fup) return;
    let url = `${BASE_URL}/search?pageSize=10&${req.body.type}s=${encodeURIComponent(req.body.query)}`;
    try {
        const r = await fetch(url, { headers: eCourtsHeaders });
        const d = await r.json();
        if (!r.ok) { await decrementOnFailure(fup); return res.status(400).json({ success: false, error: d.message }); }
        res.json({ success: true, data: d.data.results });
    } catch (e) { await decrementOnFailure(fup); res.status(500).json({ success: false, error: 'Server error' }); }
});

// ── ROUTE 3: CAUSE LIST ──
app.post('/api/causelist', async (req, res) => {
    // 🔒 CAUSE LIST LOCK: Pro and above only
    const userDoc = await db.collection('users').doc(req.body.userId).get();
    if ((userDoc.data()?.plan || 'free') === 'free') {
        return res.status(403).json({ success: false, error: 'limit_reached', message: 'Cause List requires a Pro plan.' });
    }
    
    const fup = await enforceFUP(req, res, 'search', 1); if (!fup) return;
    try {
        const r = await fetch(`${BASE_URL}/causelist/search?q=${encodeURIComponent(req.body.query)}&state=${encodeURIComponent(req.body.state)}&limit=20`, { headers: eCourtsHeaders });
        const d = await r.json();
        if (!r.ok) { await decrementOnFailure(fup); return res.status(400).json({ success: false, error: d.message }); }
        res.json({ success: true, data: d });
    } catch (e) { await decrementOnFailure(fup); res.status(500).json({ success: false, error: 'Server error' }); }
});

// ── ROUTE 4: BULK REFRESH ──
app.post('/api/bulk-refresh', async (req, res) => {
    // 🔒 BULK LOCK: Pro Max and above only
    const userDoc = await db.collection('users').doc(req.body.userId).get();
    const p = userDoc.data()?.plan || 'free';
    if (p === 'free' || p === 'pro') {
        return res.status(403).json({ success: false, error: 'limit_reached', message: 'Bulk Refresh requires Pro Max.' });
    }
    
    // ✨ Deduct the exact array length to protect revenue
    const fup = await enforceFUP(req, res, 'search', req.body.cnrs.length); if (!fup) return;
    try {
        const r = await fetch(`${BASE_URL}/case/bulk-refresh`, { method: 'POST', headers: eCourtsHeaders, body: JSON.stringify({ cnrs: req.body.cnrs }) });
        const d = await r.json();
        if (!r.ok) { await decrementOnFailure(fup); return res.status(400).json({ success: false, error: d.message }); }
        res.json({ success: true, data: d });
    } catch (e) { await decrementOnFailure(fup); res.status(500).json({ success: false, error: 'Server error' }); }
});

// ── ROUTE 5: AI ORDER ANALYSIS (Uses 'ai' credit) ──
app.post('/api/order/analyze', async (req, res) => {
    // 🔒 AI LOCK: Supreme only
    const userDoc = await db.collection('users').doc(req.body.userId).get();
    const p = userDoc.data()?.plan || 'free';
    if (p !== 'supreme') {
        return res.status(403).json({ success: false, error: 'limit_reached', message: 'AI Assistant requires the Supreme plan.' });
    }

    const fup = await enforceFUP(req, res, 'ai', 1); if (!fup) return;
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
    const fup = await enforceFUP(req, res, 'pdf', 1); if (!fup) return;
    try {
        const r = await fetch(`${BASE_URL}/case/${req.body.cnr}/order/${req.body.filename}`, { headers: eCourtsHeaders });
        if (r.headers.get('content-type')?.includes('application/json')) {
            await decrementOnFailure(fup);
            return res.status(400).json({ success: false, error: 'PDF not found' });
        }
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${req.body.filename}"`);
        r.body.pipe(res);
    } catch (e) { await decrementOnFailure(fup); res.status(500).json({ success: false, error: 'Server error' }); }
});

// ── ROUTE 7: INITIATE PAYMENT ORDER ──
app.post('/api/initiate-payment', async (req, res) => {
    if (!rzp) return res.status(500).json({ success: false, error: 'Payment service not configured.' });
    const officialPricing = { pro: 9900, promax: 19900, supreme: 39900 };
    if (!officialPricing[req.body.plan] || (req.body.amount * 100) !== officialPricing[req.body.plan]) {
        return res.status(400).json({ success: false, error: 'Invalid amount' });
    }
    try {
        const order = await rzp.orders.create({ 
            amount: officialPricing[req.body.plan], 
            currency: 'INR', 
            receipt: `vaad_${Date.now()}`, 
            notes: { userId: req.body.userId, planName: req.body.plan } 
        });
        res.json({ success: true, data: { order } });
    } catch (error) { res.status(500).json({ success: false, error: 'Order failed.' }); }
});

// ── ROUTE 8: RAZORPAY WEBHOOK ──
app.post('/api/webhook/razorpay', async (req, res) => {
    try {
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
        
        if (!webhookSecret) {
            console.error("❌ CRITICAL: RAZORPAY_WEBHOOK_SECRET is missing in Render Environment Variables!");
            return res.status(500).json({ error: 'Server config error.' });
        }

        const signature = req.headers['x-razorpay-signature'];
        if (!signature) return res.status(400).json({ error: 'No signature provided.' });

        const expectedSignature = crypto.createHmac('sha256', webhookSecret).update(req.body).digest('hex');
        
        if (signature !== expectedSignature) {
            console.error("⛔ WEBHOOK BLOCKED: Invalid signature. Your secret in Razorpay does not match your secret in Render.");
            return res.status(400).json({ error: 'Invalid signature.' });
        }
        
        const payload = JSON.parse(req.body.toString());
        console.log(`📡 Razorpay Webhook Received Event: ${payload.event}`);

        // Listen for captured payments
        if (payload.event === 'payment.captured') {
            const payment = payload.payload.payment.entity;
            const userId = payment.notes?.userId;
            const planName = payment.notes?.planName;

            if (!userId || !planName) {
                console.error("❌ Missing 'notes' in payment entity. Cannot identify user:", payment.notes);
                return res.status(400).json({ error: 'Missing notes data' });
            }

            console.log(`💰 Processing Upgrade: User [${userId}] -> Plan [${planName}]`);
            
            // Upgrade plan and instantly reset all 3 wallets to 0
            await db.collection('users').doc(userId).update({ 
                plan: planName, 
                cycleStartDate: new Date().toISOString().split('T')[0], 
                searchCount: 0, 
                pdfCount: 0, 
                aiCount: 0 
            });
            
            console.log(`✅ SUCCESS: User [${userId}] is now on ${planName} plan!`);
            return res.status(200).json({ status: 'success' });
        }
        
        console.log(`⏭️ Ignored event: ${payload.event}`);
        res.status(200).json({ status: 'ignored' });

    } catch (error) {
        console.error("🔥 FATAL WEBHOOK ERROR:", error.message);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// ── ROUTE 9: HEALTH CHECK ──
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.listen(process.env.PORT || 3000, () => console.log(`🚀 Vaad backend running`));
