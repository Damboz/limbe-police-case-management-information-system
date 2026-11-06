// ============================================================
// Session cookie policy, shared by the cookie-session middleware
// in app.js and the logout handler in authApiController.js.
//
// The session lives entirely in a signed cookie (cookie-session),
// and a browser only deletes that cookie when the attributes on
// the clearing Set-Cookie match the ones used to create it. Both
// sides therefore read their options from here instead of each
// repeating the SameSite/Secure logic, which had drifted apart
// and left officers logged in after they signed out.
// ============================================================


// Browser origins allowed to call this API. Trailing slashes are stripped because
// browsers send the Origin header without one, so a value like
// "https://app.vercel.app/" would never match.
const ALLOWED_ORIGINS = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map(origin => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);



const CROSS_ORIGIN_DEPLOY = ALLOWED_ORIGINS.some(origin => !/^https?:\/\/(localhost|127\.0\.0\.1)/.test(origin));


const IS_PRODUCTION = process.env.NODE_ENV === 'production';


const SESSION_COOKIE_NAME = 'limbe.sid';



const SESSION_MAX_AGE = 1000 * 60 * 5; // 5 minutes;



const SESSION_IDLE_TIMEOUT = Math.max(1, Number(process.env.SESSION_IDLE_MINUTES) || 30) * 60 * 1000;


const SESSION_COOKIE_OPTIONS = {
    httpOnly: true,
    sameSite: CROSS_ORIGIN_DEPLOY ? 'none' : 'lax',
    secure: CROSS_ORIGIN_DEPLOY || IS_PRODUCTION,
    path: '/'
};


module.exports = {
    ALLOWED_ORIGINS,
    CROSS_ORIGIN_DEPLOY,
    IS_PRODUCTION,
    SESSION_COOKIE_NAME,
    SESSION_MAX_AGE,
    SESSION_IDLE_TIMEOUT,
    SESSION_COOKIE_OPTIONS
};
