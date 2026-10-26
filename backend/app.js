const express = require('express');
const rateLimit = require('express-rate-limit');
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

// ADDED: Render terminates HTTPS at its proxy, so without this Express sees every
// request as plain HTTP and cookie-session refuses to set a Secure cookie.
app.set('trust proxy', 1);


const apiRoutes = require('./routes/apiRoutes');
const reportRoutes = require('./routes/reportRoutes');
const db = require('./config/db');
const {
    ALLOWED_ORIGINS,
    SESSION_COOKIE_NAME,
    SESSION_MAX_AGE,
    SESSION_COOKIE_OPTIONS
} = require('./config/session');
const { normalizeSessionRole, enforceSessionTimeout } = require('./middleware/authMiddleware');


app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
try {
  const rl = require('./node_modules/express-rate-limit');
  app.use('/api', rl({ windowMs: 15 * 60 * 1000, max: 300 }));
} catch (e) {}


// The frontend is deployed on its own domain, so every browser request arrives as a
// cross-origin call. An allowlist is required rather than '*': with credentials the
// CORS spec forbids the wildcard, and a blanket origin would let any site on the
// internet try to act as a logged-in officer. The list lives in config/session.js
// because the cookie's SameSite/Secure policy is derived from it.
app.use(cors({
    origin(origin, callback) {
        // No Origin header: same-origin request, curl, or a server-side call.
        if (!origin) return callback(null, true);
        if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
        // ADDED: name the rejected origin so a misconfigured CLIENT_ORIGIN is easy to spot in Render's logs.
        console.warn(`CORS rejected origin: ${origin} (allowed: ${ALLOWED_ORIGINS.join(', ')})`);
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


// Falling back to a fixed secret would let anyone who has read the source forge an
// admin session cookie, so refuse to start rather than sign one with a known key.
const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
    throw new Error(
        'SESSION_SECRET must be set. Add it to backend/.env for local runs, or to the environment variables on Render.'
    );
}

// The session lives in a signed cookie rather than server memory, so logins survive
// restarts and scale-out without sticky sessions. The cookie's SameSite/Secure policy
// is defined once in config/session.js so logout can clear the exact cookie this sets:
// a browser only deletes a cookie whose clearing attributes match the original.
app.use(cookieSession({
    name: SESSION_COOKIE_NAME,
    keys: [SESSION_SECRET],
    maxAge: SESSION_MAX_AGE,
    ...SESSION_COOKIE_OPTIONS
}));


// Every response here is either a signed-in officer's data or a generated document.
// Without an explicit no-store, a browser, proxy or CDN edge can cache GET
// /api/auth/me and hand the previous officer's session to the next person who opens
// the app — who then lands on someone else's dashboard without ever seeing a login.
// Vary: Cookie stops any shared cache from mixing two officers' responses.
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    // append (not set) so the CORS middleware's own `Vary: Origin` is preserved.
    res.append('Vary', 'Cookie');
    next();
});


// Rewrite legacy role names in existing session cookies so role
// checks see the new canonical roles until the officer logs in again.
app.use(normalizeSessionRole);


// Drop sessions that have been idle past the timeout (or past their absolute cap)
// before any route can read them, so an abandoned shared-terminal session cannot be
// picked up by the next person who opens the app.
app.use(enforceSessionTimeout);


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

    // Opening a connection to a remote database costs a full TCP + TLS + SCRAM
    // handshake that dwarfs the queries themselves. The pool only grows on
    // demand, so fill it during boot; otherwise the first officer pays the
    // handshake cost, one connection at a time, on their first dashboard.
    db.warm()
        .then(() => console.log('[db] Connection pool warm.'))
        .catch((err) => console.warn(`[db] Pool warm-up skipped: ${err.message}`));
}

module.exports = app;