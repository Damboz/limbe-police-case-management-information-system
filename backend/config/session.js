
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
