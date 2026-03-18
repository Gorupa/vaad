const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch'); // Make sure node-fetch is in your package.json!

const app = express();
app.use(cors());
app.use(express.json());

const API_KEY = process.env.ECOURTS_API_KEY;

// ── NEW OFFICIAL API ROUTE ──
app.post('/api/cnr', async (req, res) => {
    const { cnr } = req.body;
    if (!cnr) return res.status(400).json({ success: false, error: 'CNR is required' });

    try {
        // Calling the official eCourtsIndia Partner API
        const response = await fetch(`https://webapi.ecourtsindia.com/api/partner/case/${cnr}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        // If the API returns an error (like invalid CNR)
        if (!response.ok) {
            return res.status(400).json({ success: false, error: data.message || 'Case not found in official database.' });
        }

        // Success! Send the data back to the frontend
        return res.json({ success: true, data: data });
        
    } catch (error) {
        console.error("API Error:", error);
        return res.status(500).json({ success: false, error: 'Internal server connection error.' });
    }
});

app.get('/api/health', (req, res) => res.json({ status: 'Live with Official Partner API' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Vaad Server running on port ${PORT}`));
