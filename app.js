const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const cookieSession = require('cookie-session');
const { wantsJson } = require('./utils/http');


dotenv.config();


const app = express();
const PORT = process.env.PORT || 3000;


const apiRoutes = require('./routes/apiRoutes');
const reportRoutes = require('./routes/reportRoutes');


const CLIENT_DIST = path.join(__dirname, 'client', 'dist');
const CLIENT_INDEX = path.join(CLIENT_DIST, 'index.html');
const HAS_CLIENT_BUILD = fs.existsSync(CLIENT_INDEX);


app.use(express.static(path.join(__dirname, 'public')));
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Body parsers leave req.body undefined when a request has no matching
// Content-Type, which would turn a bad request into a 500 in API controllers.
app.use((req, res, next) => {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        req.body = {};
    }
    next();
});


// The session lives in a signed cookie rather than server memory, so logins
// survive across the separate, short-lived instances a serverless host creates.
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Falling back to a fixed secret would let anyone who has read the source forge an
// admin session cookie, so refuse to start rather than sign one with a known key.
const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
    throw new Error(
        'SESSION_SECRET must be set. Add it to .env for local runs, or to the project environment variables on Vercel.'
    );
}

app.use(cookieSession({
    name: 'limbe.sid',
    keys: [SESSION_SECRET],
    maxAge: 1000 * 60 * 60 * 8,
    httpOnly: true,
    sameSite: 'lax',
    secure: IS_PRODUCTION
}));


app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'UP', system: 'Limbe Police Station CMS' });
});


app.use('/api', apiRoutes);


// PDF exports stream straight to the browser rather than through the JSON API.
app.use(reportRoutes);


if (HAS_CLIENT_BUILD) {
    app.use(express.static(CLIENT_DIST, { index: false, maxAge: '1h' }));

    app.use((req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            return next();
        }
        if (req.path.startsWith('/api')) {
            return next();
        }
        if (req.path.startsWith('/css') || req.path.startsWith('/js') || req.path.startsWith('/logo')) {
            return next();
        }
        if (path.extname(req.path)) {
            return next();
        }
        return res.sendFile(CLIENT_INDEX);
    });
}


app.use((req, res) => {
    if (wantsJson(req)) {
        return res.status(404).json({ success: false, error: 'Resource not found.' });
    }
    if (HAS_CLIENT_BUILD) {
        return res.status(404).sendFile(CLIENT_INDEX);
    }
    res.status(404).send(`
        <div style="font-family: sans-serif; text-align: center; padding: 50px;">
            <h2>404 - Resource Not Found</h2>
            <p>The requested path <code>${req.originalUrl}</code> does not exist on this server.</p>
            <a href="/dashboard" style="color: #004085; text-decoration: none; font-weight: bold;">Return to Dashboard</a>
        </div>
    `);
});


app.use((err, req, res, next) => {
    // body-parser and friends raise 4xx errors (malformed JSON, oversized body).
    // Forwarding them keeps client mistakes from looking like server outages.
    const status = Number(err.status || err.statusCode) || 500;

    if (status < 500) {
        return wantsJson(req)
            ? res.status(status).json({ success: false, error: 'The request could not be read. Please check the data sent and try again.' })
            : res.status(status).send('Bad Request');
    }

    console.error('Unhandled System Error:', err);
    if (wantsJson(req)) {
        return res.status(500).json({ success: false, error: 'An unexpected system error occurred.' });
    }
    res.status(500).send('An unexpected system error occurred.');
});


if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Limbe Police Station Web Portal Live: http://localhost:${PORT}`);
        if (HAS_CLIENT_BUILD) {
            console.log('React client build detected and mounted.');
        } else {
            console.log('No React client build found at client/dist - run "npm run build" in the client folder.');
        }
    });
}

module.exports = app;
