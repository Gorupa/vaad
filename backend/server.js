const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const crypto = require('crypto');
const admin = require('firebase-admin');

// Initialize Firebase Admin so the server can securely update user plans
// You need to add FIREBASE_SERVICE_ACCOUNT as an Environment Variable in Render
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log("Firebase Admin Initialized successfully.");
} else {
    console.warn("WARNING: FIREBASE_SERVICE_ACCOUNT env variable is missing. Webhooks will fail.");
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

// ── ROUTE 1: EXACT CNR SEARCH (Pro Max & Supreme) ──
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

// ── ROUTE 2: LIST SEARCH (Pro, Pro Max, Supreme) ──
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

// ── ROUTE 3: PDF DOWNLOAD (Supreme Only) ──
app.post('/api/download', async (req, res) => {
    const { cnr, filename } = req.body;
    if (!cnr || !filename) return res.status(400).json({ success: false, error: 'CNR and filename are required' });

    try {
        const response = await fetch(`${BASE_URL}/case/${cnr}/order/${filename}`, { method: 'GET', headers });
        
        // Check if the API returned an error JSON instead of a PDF
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const data = await response.json();
            return res.status(400).json({ success: false, error: data.message || 'Could not fetch PDF.', raw: data });
        }

        // If it's a valid PDF stream, send it directly to the user's browser
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return response.body.pipe(res);

    } catch (error) {
        console.error("API Error:", error);
        return res.status(500).json({ success: false, error: 'Internal server connection error.' });
    }
});

// ── ROUTE 4: RAZORPAY WEBHOOK ──
app.post('/api/webhook/razorpay', async (req, res) => {
    // Make sure to add this Secret in your Render Dashboard
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET; 

    if (!webhookSecret) {
        console.error("Razorpay secret not configured.");
        return res.status(500).json({ error: "Server config error" });
    }

    const signature = req.headers['x-razorpay-signature'];
    
    // Generate our own signature to compare
    const expectedSignature = crypto.createHmac('sha256', webhookSecret)
                                    .update(JSON.stringify(req.body))
                                    .digest('hex');

    if (signature === expectedSignature) {
        console.log("Valid Razorpay Webhook Received!");

        // Safely extract data depending on event type
        const paymentData = req.body.payload.payment ? req.body.payload.payment.entity : null;
        
        if (paymentData && paymentData.status === 'captured') {
            const firebaseUserId = paymentData.notes ? paymentData.notes.userId : null;
            const purchasedPlan = paymentData.notes ? paymentData.notes.planName : null;

            if (firebaseUserId && purchasedPlan && db) {
                try {
                    const today = new Date().toISOString().split('T')[0];
                    await db.collection('users').doc(firebaseUserId).update({
                        plan: purchasedPlan,
                        cycleStartDate: today
                    });
                    
                    console.log(`Successfully upgraded user ${firebaseUserId} to ${purchasedPlan}`);
                    return res.status(200).json({ status: "success" });

                } catch (error) {
                    console.error("Firebase update failed:", error);
                    return res.status(500).json({ error: "Database error" });
                }
            } else {
                console.warn("Webhook valid, but missing userId, planName, or DB not initialized.");
                return res.status(200).json({ status: "ignored" }); // Still return 200 so Razorpay stops pinging
            }
        } else {
            return res.status(200).json({ status: "ignored" });
        }
    } else {
        console.error("Invalid Razorpay Signature.");
        return res.status(400).json({ error: "Invalid signature" });
    }
});

app.get('/api/health', (req, res) => res.json({ status: 'Live with Official Partner API & Webhooks' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Vaad Server running on port ${PORT}`));
