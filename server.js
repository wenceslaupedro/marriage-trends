const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const MailerLite = require('@mailerlite/mailerlite-nodejs').default;
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize MailerLite
const mailerlite = new MailerLite({
    api_key: process.env.MAILERLITE_API_KEY
});

// Routes
app.post('/api/subscribe', async (req, res) => {
    try {
        const { email, firstName, lastName } = req.body;
        
        const params = {
            email: email,
            fields: {
                name: firstName,
                last_name: lastName
            },
            groups: [process.env.MAILERLITE_GROUP_ID]
        };

        const response = await mailerlite.subscribers.createOrUpdate(params);

        res.json({ success: true, message: 'Subscription successful' });
    } catch (error) {
        console.error('Subscription error:', error);
        res.status(500).json({ success: false, message: 'Subscription failed' });
    }
});

app.get('/api/newsletters', async (req, res) => {
    try {
        // This would fetch your newsletter content from a database
        const newsletters = [
            {
                id: 1,
                title: "Latest Marriage Trends",
                date: "2024-03-20",
                content: "Your newsletter content here..."
            }
            // Add more newsletters as needed
        ];
        res.json(newsletters);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch newsletters' });
    }
});

// Serve index.html for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
}); 