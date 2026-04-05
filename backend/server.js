require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const admin = require('firebase-admin');
const helmet = require('helmet');
const fetch = require('node-fetch');
const pdfParse = require('pdf-parse'); // Required for reading PDFs before Gemini processing

let serviceAccount;
try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } else {
        serviceAccount = require('./firebase-adminsdk.json');
    }
} catch (error) {
    console.error("CRITICAL ERROR: Could not load Firebase credentials.", error.message);
    process.exit(1); 
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

if (!process.env.RAZORPAY_KEY_SECRET && process.env.NODE_ENV === 'production') {
    console.warn("WARNING: RAZORPAY_KEY_SECRET is missing. Payments will fail.");
}

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'rzp_live_SYzqjL2QNwMNDE',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummy_secret_for_local_testing'
});

const db = admin.firestore();
const app = express();

app.use(helmet());

app.use(cors({
    origin: [
        'https://vaad.pages.dev',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:5500',
        'http://127.0.0.1:5500'
    ],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-razorpay-signature']
}));

app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
        const signature = req.headers['x-razorpay-signature'];
        const body = req.body.toString();

        const expectedSignature = crypto.createHmac('sha256', secret).update(body).digest('hex');

        if (expectedSignature !== signature) {
            console.error('⛔ Webhook signature mismatch');
            return res.status(400).json({ success: false, error: 'Invalid signature' });
        }

        const payload = JSON.parse(body);
        
        if (payload.event === 'payment.captured') {
            const payment = payload.payload.payment.entity;
            const userId = payment.notes?.userId;
            const planName = payment.notes?.planName;

            const officialPricingPaise = { pro: 9900, promax: 19900, supreme: 39900 };
            const expectedAmount = officialPricingPaise[planName];

            if (!expectedAmount || payment.amount !== expectedAmount) {
                console.error(`⛔ FRAUD ALERT: User ${userId} paid ₹${payment.amount/100} but planName is '${planName}'`);
                return res.status(200).json({ status: 'fraud_detected_manual_review_required' });
            }
            
            await db.collection('users').doc(userId).update({
                plan: planName,
                cycleStartDate: new Date().toISOString().split('T')[0],
                searchCount: 0,
                pdfCount: 0,
                aiCount: 0,
                summaryCount: 0
            });
        }
        res.status(200).json({ status: 'ok' });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ success: false, error: 'Webhook processing failed' });
    }
});

app.use(express.json());

// Perfectly balanced limits for guaranteed 50%+ profit margins
const PLAN_LIMITS = {
    free: { search: 1, pdf: 0, ai: 5, summary: 0 },
    pro: { search: 20, pdf: 5, ai: 50, summary: 3 },
    promax: { search: 50, pdf: 10, ai: 100, summary: 8 },
    supreme: { search: 100, pdf: 20, ai: 200, summary: 15 }
};

const PLAN_PRICES = { pro: 9900, promax: 19900, supreme: 39900 };

async function verifyFirebaseAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'No auth token provided.' });
    }
    try {
        const token = authHeader.split('Bearer ')[1];
        const decoded = await admin.auth().verifyIdToken(token);
        req.uid = decoded.uid; 
        next();
    } catch (e) {
        return res.status(401).json({ success: false, error: 'Invalid or expired token.' });
    }
}

async function enforceFUP(req, res, actionType = 'search', deductAmount = 1, requirePro = false) {
    if (!db) { res.status(500).json({ success: false, error: 'Database error.' }); return null; }
    
    const userId = req.uid; 
    const userRef = db.collection('users').doc(userId);
    let resultFup = null;

    try {
        await db.runTransaction(async (transaction) => {
            const userSnap = await transaction.get(userRef);
            if (!userSnap.exists) throw new Error('USER_NOT_FOUND');

            let data = userSnap.data();
            let plan = String(data.plan || 'free').toLowerCase().replace(/[^a-z]/g, '');
            if (!PLAN_LIMITS[plan]) plan = 'free';

            const today = new Date(); today.setHours(0,0,0,0);
            const cycleStart = data.cycleStartDate ? new Date(data.cycleStartDate) : today;
            cycleStart.setHours(0,0,0,0);
            const diffDays = Math.floor((today - cycleStart) / (1000 * 60 * 60 * 24));

            const updates = {};
            if (diffDays >= 30) {
                updates.searchCount = 0; updates.pdfCount = 0; updates.aiCount = 0; updates.summaryCount = 0;
                updates.cycleStartDate = new Date().toISOString().split('T')[0];
                if (plan !== 'free') { updates.plan = 'free'; plan = 'free'; }
                data = { ...data, ...updates, searchCount: 0 };
            }

            if (requirePro && plan === 'free') throw new Error('FEATURE_LOCKED');

            const limit = PLAN_LIMITS[plan][actionType] || 0;
            const usedCount = data[`${actionType}Count`] || 0;

            if (usedCount + deductAmount > limit) throw new Error(`LIMIT_REACHED:${plan}:${usedCount}:${limit}`);

            updates[`${actionType}Count`] = admin.firestore.FieldValue.increment(deductAmount);
            transaction.update(userRef, updates);
            
            resultFup = { actionType, deductAmount, plan };
        });
        return resultFup;
    } catch (e) {
        if (e.message === 'USER_NOT_FOUND') {
            res.status(401).json({ success: false, error: 'User not found.' }); return null;
        }
        if (e.message === 'FEATURE_LOCKED') {
            res.status(403).json({ success: false, error: 'feature_locked', message: 'This feature requires a Premium plan.' }); return null;
        }
        if (e.message.startsWith('LIMIT_REACHED')) {
            const [, plan, used, limit] = e.message.split(':');
            res.status(403).json({ success: false, error: 'limit_reached', message: `Limit reached (${used}/${limit}). Please upgrade.` });
            return null;
        }
        console.error(e);
        res.status(500).json({ success: false, error: 'Server error during FUP check.' }); return null;
    }
}

async function refundCredit(userId, actionType, amount = 1) {
    try {
        await db.collection('users').doc(userId).update({
            [`${actionType}Count`]: admin.firestore.FieldValue.increment(-amount)
        });
    } catch (e) {
        console.error('Failed to refund credit:', e);
    }
}

function getBaseUrl() {
    if (!process.env.ECOURTS_BASE_URL) {
        console.error("CRITICAL: ECOURTS_BASE_URL is not set in Render Environment Variables!");
        throw new Error("Missing Base URL");
    }
    return process.env.ECOURTS_BASE_URL;
}

// ── ROUTES ──

app.post('/api/ask-legal-ai', verifyFirebaseAuth, async (req, res) => {
    const userQuestion = req.body.question;
    if (!userQuestion) return res.status(400).json({ success: false, error: 'Missing question' });

    const fup = await enforceFUP(req, res, 'ai', 1, false);
    if (!fup) return; 

    try {
        const geminiKey = process.env.GEMINI_API_KEY;
        if (!geminiKey) throw new Error("Missing GEMINI_API_KEY in Render Environment");

        const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
        
        const payload = {
            contents: [{ parts: [{ text: userQuestion }] }],
            systemInstruction: { parts: [{ text: "You are a highly knowledgeable Indian Legal Assistant. Provide accurate legal information based on Indian law (including new BNS, BNSS, BSA). Always end your response by stating: '\n\nDisclaimer: This is legal information, not official legal advice. Please consult an advocate for your specific case.' Keep answers well-formatted, concise, and professional." }] },
            generationConfig: { temperature: 0.3 }
        };

        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            await refundCredit(req.uid, 'ai', 1);
            console.error("Gemini API Error:", data);
            return res.status(502).json({ success: false, error: 'AI API unavailable.' });
        }
        
        const answerText = data.candidates[0].content.parts[0].text;
        res.json({ success: true, answer: answerText });
    } catch (error) {
        await refundCredit(req.uid, 'ai', 1);
        console.error(`AI fetch failed:`, error.message);
        res.status(500).json({ success: false, error: 'Upstream AI error' });
    }
});

app.post('/api/initiate-payment', verifyFirebaseAuth, async (req, res) => {
    try {
        const { plan } = req.body;
        const userId = req.uid;

        const amount = PLAN_PRICES[plan];
        if (!amount) return res.status(400).json({ success: false, error: 'Invalid plan selected.' });

        const options = {
            amount: amount,
            currency: 'INR',
            receipt: `r_${userId.substring(0, 8)}_${Date.now()}`,
            notes: { userId: userId, planName: plan }
        };

        const order = await razorpay.orders.create(options);
        res.json({ success: true, data: { order } });
    } catch (error) {
        console.error('Razorpay Order Error:', error);
        res.status(500).json({ success: false, error: 'Could not initiate payment. Please check server logs.' });
    }
});

app.post('/api/cnr', verifyFirebaseAuth, async (req, res) => {
    const { cnr } = req.body;
    if (!cnr) return res.status(400).json({ success: false, error: 'Missing CNR' });

    const fup = await enforceFUP(req, res, 'search', 1, false);
    if (!fup) return; 

    try {
        const targetUrl = `${getBaseUrl()}/case/${cnr}`;
        const response = await fetch(targetUrl, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${process.env.ECOURTS_API_KEY}` }
        });
        
        if (!response.ok) {
            const errorText = await response.text(); 
            console.error(`🚨 UPSTREAM CNR ERROR (${response.status}):`, errorText);
            await refundCredit(req.uid, 'search', 1);
            return res.status(502).json({ success: false, error: 'eCourts API unavailable.' });
        }
        
        const data = await response.json();
        res.json({ success: true, data: data });
    } catch (error) {
        await refundCredit(req.uid, 'search', 1);
        console.error(`Fetch failed for CNR ${cnr}:`, error.message);
        res.status(500).json({ success: false, error: 'Upstream API error' });
    }
});

app.post('/api/search', verifyFirebaseAuth, async (req, res) => {
    const fup = await enforceFUP(req, res, 'search', 1, false);
    if (!fup) return;

    try {
        const queryParams = new URLSearchParams(req.body).toString();
        const targetUrl = `${getBaseUrl()}/search?${queryParams}`;
        
        const response = await fetch(targetUrl, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${process.env.ECOURTS_API_KEY}` }
        });
        
        if (!response.ok) {
            const errorText = await response.text(); 
            console.error(`🚨 UPSTREAM SEARCH ERROR (${response.status}):`, errorText);
            await refundCredit(req.uid, 'search', 1);
            return res.status(502).json({ success: false, error: 'eCourts API unavailable.' });
        }
        
        const data = await response.json();
        res.json({ success: true, data: data });
    } catch (error) {
        await refundCredit(req.uid, 'search', 1);
        console.error(`Search fetch failed:`, error.message);
        res.status(500).json({ success: false, error: 'Upstream API error' });
    }
});

app.post('/api/causelist', verifyFirebaseAuth, async (req, res) => {
    const fup = await enforceFUP(req, res, 'search', 1, true); 
    if (!fup) return;

    try {
        const queryParams = new URLSearchParams(req.body).toString();
        const targetUrl = `${getBaseUrl()}/causelist/search?${queryParams}`;
        
        const response = await fetch(targetUrl, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${process.env.ECOURTS_API_KEY}` }
        });
        
        if (!response.ok) {
            const errorText = await response.text(); 
            console.error(`🚨 UPSTREAM CAUSELIST ERROR (${response.status}):`, errorText);
            await refundCredit(req.uid, 'search', 1);
            return res.status(502).json({ success: false, error: 'eCourts API unavailable.' });
        }
        
        const data = await response.json();
        res.json({ success: true, data: data });
    } catch (error) {
        await refundCredit(req.uid, 'search', 1);
        console.error(`Causelist fetch failed:`, error.message);
        res.status(500).json({ success: false, error: 'Upstream API error' });
    }
});

app.post('/api/bulk-refresh', verifyFirebaseAuth, async (req, res) => {
    const { cnrs } = req.body;
    if (!Array.isArray(cnrs) || cnrs.length === 0) return res.status(400).json({ success: false, error: 'Invalid CNR list' });
    if (cnrs.length > 50) return res.status(400).json({ success: false, error: 'Maximum 50 CNRs per request.' });
    
    const cost = cnrs.length;
    const fup = await enforceFUP(req, res, 'search', cost, true);
    if (!fup) return;

    try {
        const targetUrl = `${getBaseUrl()}/bulk-refresh`;
        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.ECOURTS_API_KEY}` 
            },
            body: JSON.stringify({ cnrs })
        });
        
        if (!response.ok) {
            const errorText = await response.text(); 
            console.error(`🚨 UPSTREAM BULK-REFRESH ERROR (${response.status}):`, errorText);
            await refundCredit(req.uid, 'search', cost);
            return res.status(502).json({ success: false, error: 'eCourts API unavailable.' });
        }
        
        const data = await response.json();
        res.json({ success: true, data: data });
    } catch (error) {
        await refundCredit(req.uid, 'search', cost);
        console.error(`Bulk refresh fetch failed:`, error.message);
        res.status(500).json({ success: false, error: 'Upstream API error' });
    }
});

app.post('/api/download', verifyFirebaseAuth, async (req, res) => {
    const fup = await enforceFUP(req, res, 'pdf', 1, true);
    if (!fup) return;

    try {
        const { cnr, filename } = req.body;
        const targetUrl = `${getBaseUrl()}/case/${cnr}/order/${filename}`;
        
        const response = await fetch(targetUrl, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${process.env.ECOURTS_API_KEY}` }
        });
        
        if (!response.ok) {
            const errorText = await response.text(); 
            console.error(`🚨 UPSTREAM PDF ERROR (${response.status}):`, errorText);
            await refundCredit(req.uid, 'pdf', 1);
            throw new Error('PDF Fetch Failed');
        }
        
        res.setHeader('Content-Type', 'application/pdf');
        response.body.pipe(res);
    } catch (error) {
        await refundCredit(req.uid, 'pdf', 1);
        console.error(`PDF download failed:`, error.message);
        res.status(500).json({ success: false, error: 'Upstream API error' });
    }
});

app.post('/api/ai-summary', verifyFirebaseAuth, async (req, res) => {
    const fup = await enforceFUP(req, res, 'summary', 1, true);
    if (!fup) return;

    try {
        const { cnr, filename } = req.body;
        if (!cnr || !filename) throw new Error("Missing CNR or filename");

        const pdfUrl = `${getBaseUrl()}/case/${cnr}/order/${filename}`;
        const pdfResponse = await fetch(pdfUrl, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${process.env.ECOURTS_API_KEY}` }
        });
        
        if (!pdfResponse.ok) {
            console.error(`🚨 UPSTREAM PDF FETCH ERROR FOR AI (${pdfResponse.status})`);
            await refundCredit(req.uid, 'summary', 1);
            return res.status(502).json({ success: false, error: 'Could not fetch order PDF for summarization.' });
        }

        const pdfBuffer = await pdfResponse.buffer();
        const pdfData = await pdfParse(pdfBuffer);
        const extractedText = pdfData.text;

        if (!extractedText || extractedText.trim().length < 50) {
            return res.json({ 
                success: true, 
                data: { summary: "This PDF appears to be a scanned image or handwritten document. The AI cannot extract text from it currently." } 
            });
        }

        const geminiKey = process.env.GEMINI_API_KEY;
        if (!geminiKey) throw new Error("Missing GEMINI_API_KEY");

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
        
        const prompt = `You are an expert Indian Legal AI. Read the following court order text and provide a structured summary. 
        Include: 1. Date of Order, 2. Judge Name, 3. Key Findings, 4. Next Hearing Date/Outcome. 
        Keep it strictly factual, professional, and concise.\n\nCourt Order Text:\n${extractedText.substring(0, 25000)}`;

        const payload = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2 } 
        };

        const aiResponse = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const aiData = await aiResponse.json();
        
        if (!aiResponse.ok) {
            console.error("Gemini API Error:", aiData);
            throw new Error("Gemini API failed");
        }
        
        const answerText = aiData.candidates[0].content.parts[0].text;
        
        res.json({ success: true, data: { summary: answerText, ai_summary: answerText } });

    } catch (error) {
        await refundCredit(req.uid, 'summary', 1);
        console.error(`AI Summary via Gemini failed:`, error.message);
        res.status(500).json({ success: false, error: 'Could not generate AI summary.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Vaad Secure Server running on port ${PORT}`);
});
