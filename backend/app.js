const express = require('express');
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const cookieSession = require('cookie-session');


// Render injects environment variables rather than a .env file, and Vercel-style
// hosts may set the working directory elsewhere, so this resolves from __dirname
// rather than process.cwd(). The repository-root .env is read first as a fallback and
// never overrides backend/.env, because dotenv skips keys already in process.env.
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '.env') });


const app = express();
const PORT = process.env.PORT || 3000;


const apiRoutes = require('./routes/apiRoutes');
const reportRoutes = require('./routes/reportRoutes');


app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// The frontend is deployed on its own domain, so every browser request arrives as a
// cross-origin call. An allowlist is required rather than '*': with credentials the
// CORS spec forbids the wildcard, and a blanket origin would let any site on the
// internet try to act as a logged-in officer.
const ALLOWED_ORIGINS = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

app.use(cors({
    origin(origin, callback) {
        // No Origin header: same-origin request, curl, or a server-side call.
        if (!origin) return callback(null, true);
        if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
        return callback(new Error(`Origin ${origin} is not allowed by CORS.`));
    },
    credentials: true
}));


// Body parsers leave req.body undefined when a request has no matching
// Content-Type, which would turn a bad request into a 500 in API controllers.
app.use((req, res, next) => {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        req.body = {};
    }
    next();
});


const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Falling back to a fixed secret would let anyone who has read the source forge an
// admin session cookie, so refuse to start rather than sign one with a known key.
const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
    throw new Error(
        'SESSION_SECRET must be set. Add it to backend/.env for local runs, or to the environment variables on Render.'
    );
}

// The session lives in a signed cookie rather than server memory, so logins survive
// restarts and scale-out without sticky sessions.

// The frontend and API are on different domains, so the browser treats this as a
// third-party cookie. 'none' is the only value that survives that trip; it in turn
// requires HTTPS, which is why Secure is tied to production and why the cookie is
// only relaxed once a real deployment origin is configured. SameSite=None is what
// makes CSRF possible in principle, so the exact-origin CORS allowlist above is the
// control that actually protects the session.
const CROSS_ORIGIN_DEPLOY = ALLOWED_ORIGINS.some(origin => !/^https?:\/\/(localhost|127\.0\.0\.1)/.test(origin));

app.use(cookieSession({
    name: 'limbe.sid',
    keys: [SESSION_SECRET],
    maxAge: 1000 * 60 * 60 * 8,
    httpOnly: true,
    sameSite: CROSS_ORIGIN_DEPLOY ? 'none' : 'lax',
    secure: CROSS_ORIGIN_DEPLOY || IS_PRODUCTION
}));


app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'UP', system: 'Limbe Police Station CMS' });
});


app.use('/api', apiRoutes);


// PDF exports stream straight to the browser rather than through the JSON API.
app.use(reportRoutes);


// This process serves the API only. The React app is a separate deployment, so an
// unmatched path is a wrong URL rather than a client-side route, and every response
// is JSON regardless of what the client asked for.
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Resource not found.',
        path: req.originalUrl
    });
});


app.use((err, req, res, next) => {
    // A rejected CORS origin arrives here as a plain Error. Answer it as 403: the
    // browser is the one that has to be told, and a 500 would read as an outage.
    if (/not allowed by CORS/.test(err.message || '')) {
        return res.status(403).json({ success: false, error: 'This origin is not permitted to use the API.' });
    }

    // body-parser and friends raise 4xx errors (malformed JSON, oversized body).
    // Forwarding them keeps client mistakes from looking like server outages.
    const status = Number(err.status || err.statusCode) || 500;

    if (status < 500) {
        return res.status(status).json({ success: false, error: 'The request could not be read. Please check the data sent and try again.' });
    }

    console.error('Unhandled System Error:', err);
    res.status(500).json({ success: false, error: 'An unexpected system error occurred.' });
});


if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Limbe Police Station API live: http://localhost:${PORT}`);
        console.log(`Accepting browser requests from: ${ALLOWED_ORIGINS.join(', ')}`);
    });
}

module.exports = app;
