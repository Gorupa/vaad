const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const crypto = require('crypto');
const admin = require('firebase-admin');

// Initialize Firebase Admin so the server can securely update user plans
// NOTE: Ensure FIREBASE_SERVICE_ACCOUNT environment variable is set in Render
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log("✅ Firebase Admin Initialized successfully.");
    } catch (e) {
        console.error("❌ ERROR: Failed to parse FIREBASE_SERVICE_ACCOUNT env variable.", e.message);
    }
} else {
    console.warn("⚠️ WARNING: FIREBASE_SERVICE_ACCOUNT env variable is missing. Webhooks will fail to update database.");
}

const db = admin.apps.length ? admin.firestore() : null;

const app = express();
app.use(cors());
app.use(express.json());

const API_KEY = process.env.ECOURTS_API_KEY;
const BASE_URL = 'https://webapi.ecourtsindia.com/api/partner';

const headers = {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json'
};

// ── ROUTE 1: EXACT CNR SEARCH ──
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

// ── ROUTE 2: LIST SEARCH ──
app.post('/api/search', async (req, res) => {
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
        console.error("API Error:", error);
        return res.status(500).json({ success: false, error: 'Internal server connection error.' });
    }
});

// ── ROUTE 3: CAUSE LIST SEARCH (Mapped to official API) ──
app.post('/api/causelist', async (req, res) => {
    const { query, state, limit } = req.body;
    if (!query || !state) return res.status(400).json({ success: false, error: 'Query and State are required for Cause List search' });

    const fetchLimit = limit || 10;
    const url = `${BASE_URL}/causelist/search?q=${encodeURIComponent(query)}&state=${encodeURIComponent(state)}&limit=${fetchLimit}`;

    try {
        const response = await fetch(url, { method: 'GET', headers });
        const data = await response.json();
        if (!response.ok) return res.status(400).json({ success: false, error: data.message || 'Cause list fetch failed.' });
        return res.json({ success: true, data: data });
    } catch (error) {
        console.error("API Error:", error);
        return res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});

// ── ROUTE 4: BULK CASE REFRESH (Mapped to official API) ──
app.post('/api/bulk-refresh', async (req, res) => {
    const { cnrs } = req.body; 
    if (!cnrs || !Array.isArray(cnrs)) return res.status(400).json({ success: false, error: 'Array of CNRs is required' });

    try {
        const response = await fetch(`${BASE_URL}/case/bulk-refresh`, { 
            method: 'POST', 
            headers,
            body: JSON.stringify({ cnrs })
        });
        const data = await response.json();
        if (!response.ok) return res.status(400).json({ success: false, error: data.message || 'Bulk refresh failed.' });
        return res.json({ success: true, data: data });
    } catch (error) {
        console.error("API Error:", error);
        return res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});

// ── ROUTE 5: AI JUDGMENT SUMMARY & MARKDOWN (Mapped to official API) ──
app.post('/api/order/analyze', async (req, res) => {
    const { cnr, filename, type } = req.body; 
    if (!cnr || !filename || !type) return res.status(400).json({ success: false, error: 'CNR, filename, and type required' });

    try {
        const endpointType = type === 'summary' ? 'order-ai' : 'order-md';
        const url = `${BASE_URL}/case/${cnr}/${endpointType}/${filename}`;
        
        const response = await fetch(url, { method: 'GET', headers });
        const data = await response.json();
        
        if (!response.ok) return res.status(400).json({ success: false, error: data.message || `Failed to fetch ${type}.` });
        return res.json({ success: true, data: data });
    } catch (error) {
        console.error("API Error:", error);
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
            return res.status(400).json({ success: false, error: data.message || 'Could not fetch PDF.', raw: data });
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return response.body.pipe(res);

    } catch (error) {
        console.error("API Error:", error);
        return res.status(500).json({ success: false, error: 'Internal server connection error.' });
    }
});

// ── ROUTE 7: SECURE RAZORPAY WEBHOOK (UPDATED WITH AMOUNT VALIDATION) ──
app.post('/api/webhook/razorpay', async (req, res) => {
    // NOTE: Ensure RAZORPAY_WEBHOOK_SECRET env variable is set in Render
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET; 

    if (!webhookSecret) {
        console.error("❌ ERROR: RAZORPAY_WEBHOOK_SECRET env variable is not configured.");
        return res.status(500).json({ error: "Server config error" });
    }

    // Verify signature to prove request came from Razorpay
    const signature = req.headers['x-razorpay-signature'];
    const expectedSignature = crypto.createHmac('sha256', webhookSecret)
                                    .update(JSON.stringify(req.body))
                                    .digest('hex');

    if (signature !== expectedSignature) {
        console.error("⛔ SECURITY ALERT: Invalid Razorpay Webhook Signature Received. Potential tampering.");
        return res.status(400).json({ error: "Invalid signature" });
    }

    // If signature is valid, proceed
    console.log("✅ Valid Razorpay Webhook Received & Authenticated.");

    const paymentData = req.body.payload.payment ? req.body.payload.payment.entity : null;
    
    // Check if payment is successful
    if (paymentData && paymentData.status === 'captured') {
        const firebaseUserId = paymentData.notes ? paymentData.notes.userId : null;
        const purchasedPlan = paymentData.notes ? paymentData.notes.planName : null;
        
        // ✨ NEW: Get actual amount paid (Razorpay sends this in PAISE)
        const actualAmountPaidPaise = paymentData.amount; 

        if (!firebaseUserId || !purchasedPlan || !db) {
            console.warn("⚠️ Webhook valid, but missing userId, planName in notes, or Firebase DB not initialized. Ignored.");
            return res.status(200).json({ status: "ignored" }); 
        }

        // ── ✨ MANDATORY SECURITY LAYER: AMOUNT VALIDATION ✨ ──

        // A. Define official Pricing Sheet (prices in PAISE) strictly on backend
        const officialPricingPaise = {
            pro: 99 * 100,      // ₹99.00
            promax: 199 * 100,   // ₹199.00
            supreme: 399 * 100   // ₹399.00
        };

        const expectedAmountPaise = officialPricingPaise[purchasedPlan];

        // B. Handle invalid plan requested
        if (expectedAmountPaise === undefined) {
            console.error(`⛔ FRAUD ALERT: User ${firebaseUserId} requested unknown plan: ${purchasedPlan}.`);
            return res.status(200).json({ status: "invalid_plan_ignored" });
        }

        // C. Compare paid amount vs official price
        if (actualAmountPaidPaise !== expectedAmountPaise) {
            // Amount MISMATCH - Indicates frontend tampering
            console.error(`⛔⛔⛔ CRITICAL SECURITY ALERT: Tampering Detected! User ${firebaseUserId} attempted to purchase ${purchasedPlan} (official price ₹${expectedAmountPaise/100}) but only paid ₹${actualAmountPaidPaise/100}. Database update blocked.`);
            
            // Revert user to FREE plan due to fraud attempt
            try {
                await db.collection('users').doc(firebaseUserId).update({
                    plan: 'free',
                    fraudulentAttemptNote: ` Tampering detected: Paid ₹${actualAmountPaidPaise/100} conceptually for ₹${expectedAmountPaise/100} plan on ${new Date().toISOString()}`
                });
                console.log(`Action taken: User ${firebaseUserId} set to FREE plan.`);
            } catch (fbError) {
                console.error("Failed to update fraud note in Firebase:", fbError.message);
            }
            
            // Return 200 to Razorpay so they stop retrying, but log as fraud on our end
            return res.status(200).json({ status: "fraud_handled" }); 
        }

        // ── D. SUCCESS: Amounts match, process database upgrade ──
        try {
            const today = new Date().toISOString().split('T')[0];
            await db.collection('users').doc(firebaseUserId).update({
                plan: purchasedPlan,
                cycleStartDate: today,
                notes_on_account: admin.firestore.FieldValue.delete() // Clean up any old fraud notes
            });
            
            console.log(`✅ SUCCESS: Upgraded user ${firebaseUserId} to ${purchasedPlan} plan based on verified payment of ₹${actualAmountPaidPaise/100}.`);
            return res.status(200).json({ status: "success" });

        } catch (error) {
            console.error("❌ ERROR: Firebase update failed for successful payment:", error.message);
            // Return 500 so Razorpay retries webhook later
            return res.status(500).json({ error: "Database error" });
        }
    } else {
        // Payment status not captured, ignore
        console.log(`Webhook received for payment status: ${paymentData ? paymentData.status : 'unknown'}. Ignored.`);
        return res.status(200).json({ status: "ignored" });
    }
});

app.get('/api/health', (req, res) => res.json({ status: 'Live with Official Partner API & Secure Webhooks' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Vaad Server running on port ${PORT}`));
