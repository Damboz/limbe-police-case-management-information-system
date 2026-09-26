const { Pool, types } = require('pg');
const dns = require('dns');
const dotenv = require('dotenv');

const dnsPromises = dns.promises;

dotenv.config({ quiet: true });

// node-postgres returns BIGINT/NUMERIC as strings to avoid precision loss.
// This app uses them as plain numbers, so parse them back to Number.
types.setTypeParser(types.builtins.INT8, (value) => value === null ? null : parseInt(value, 10));
types.setTypeParser(types.builtins.NUMERIC, (value) => value === null ? null : parseFloat(value));


const dbName = process.env.PGDATABASE || process.env.DB_NAME || 'limbe_police_cms';
const sslRequired = ['require', 'verify-ca', 'verify-full'].includes((process.env.PGSSLMODE || '').toLowerCase());
const configuredHost = process.env.PGHOST || process.env.DB_HOST || 'localhost';

// A serverless host keeps many short-lived instances alive at once, and any one
// instance only ever handles a handful of concurrent requests. Sizing the pool
// for a long-running server would multiply idle connections against the database.
const IS_SERVERLESS = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.FUNCTION_TARGET);


// Neon pooled endpoints route on the TLS SNI hostname. Connecting to a bare IP
// makes the SNI unusable, so the endpoint id has to travel in the startup
// "options" parameter instead.
function isNeonPooledHost(host) {
    return /-pooler\./i.test(host) && /\.neon\.tech$/i.test(host);
}

function endpointIdFor(host) {
    return String(host).split('.')[0];
}


function baseConfig() {
    return {
        host: configuredHost,
        user: process.env.PGUSER || process.env.DB_USER || 'postgres',
        password: process.env.PGPASSWORD || process.env.DB_PASSWORD || '',
        database: dbName,
        port: Number(process.env.PGPORT || process.env.DB_PORT || 5432),
        ssl: sslRequired ? { rejectUnauthorized: false } : undefined,
        max: IS_SERVERLESS ? 2 : 10,
        idleTimeoutMillis: IS_SERVERLESS ? 10000 : 30000,
        connectionTimeoutMillis: 15000,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0
    };
}


function describeError(err) {
    if (!err) return 'Unknown error.';
    if (Array.isArray(err.errors) && err.errors.length) {
        return err.errors.map(e => `${e.code || e.name}: ${e.message}`).join(' | ') || err.message;
    }
    return err.message || String(err);
}


async function canConnect(config) {
    const probe = new Pool({ ...config, max: 1, connectionTimeoutMillis: 6000 });
    try {
        await probe.query('SELECT 1');
        return true;
    } catch (err) {
        return { ok: false, reason: describeError(err) };
    } finally {
        await probe.end().catch(() => {});
    }
}


// Use the OS resolver (dns.lookup). Direct DNS queries (dns.resolve4) are
// refused by some campus/ISP resolvers, so they cannot be relied on here.
async function resolveIpv4(host) {
    const records = await dnsPromises.lookup(host, { all: true }).catch(() => []);
    const addresses = records.filter((r) => r.family === 4).map((r) => r.address);
    return [...new Set(addresses)];
}


// node-postgres connects with a bare `new net.Socket()` + `connect(port, host)`,
// so it cannot be told to prefer IPv4. On hosts without working IPv6, Node's
// Happy Eyeballs attempt fails on the unreachable AAAA records and the whole
// connection times out. Probe the strategies in order and keep the one that works.
async function resolveWorkingConfig() {
    const base = baseConfig();
    const failures = [];

    const direct = await canConnect(base);
    if (direct === true) {
        console.log(`[db] Connected to PostgreSQL [${dbName}] via hostname ${base.host}`);
        return base;
    }
    failures.push(`hostname ${base.host} -> ${direct.reason}`);

    // The IPv4 fallback exists for local networks that advertise IPv6 records the
    // machine cannot actually reach. A serverless host has working IPv6, and on it
    // every failed probe costs a 6-second timeout on each cold start, so only look
    // for a fallback address outside production.
    if (process.env.NODE_ENV === 'production' && !process.env.DB_IPV4_FALLBACK) {
        console.error(`[db] Could not reach PostgreSQL [${dbName}] via ${base.host}: ${direct.reason}`);
        return base;
    }

    const addresses = await resolveIpv4(base.host);
    for (const address of addresses) {
        const candidate = { ...base, host: address };
        if (isNeonPooledHost(configuredHost)) {
            candidate.options = `endpoint=${endpointIdFor(configuredHost)}`;
        }

        const attempt = await canConnect(candidate);
        if (attempt === true) {
            console.log(`[db] Connected to PostgreSQL [${dbName}] via IPv4 ${address} (${configuredHost})`);
            return candidate;
        }
        failures.push(`ipv4 ${address} -> ${attempt.reason}`);
    }

    console.error(`[db] Could not reach PostgreSQL [${dbName}]. Attempts: ${failures.join(' ;; ')}`);
    return base;
}


let poolPromise = null;
let activePool = null;


async function getPool() {
    if (!poolPromise) {
        poolPromise = resolveWorkingConfig().then((config) => {
            activePool = new Pool(config);
            activePool.on('error', (err) => {
                console.error('[db] Idle client error:', describeError(err));
            });
            return activePool;
        });
    }
    return poolPromise;
}


function convertPlaceholders(sql) {
    let index = 0;
    return String(sql).replace(/\?/g, () => `$${++index}`);
}


function isInsert(sql) {
    return /^\s*insert\s+into/i.test(sql);
}


function isSelect(sql) {
    return /^\s*(select|show|with|values)/i.test(sql);
}


// A pooled endpoint is free to close a connection the moment it goes idle, so a
// client can be handed out that is already dead. That surfaces as a socket-level
// failure raised before the statement was ever sent, which is safe to retry once.
const TRANSIENT_SQLSTATES = new Set([
    '08000', '08001', '08003', '08004', '08006', // connection exception
    '57P01', '57P02', '57P03',                   // shutdown / cannot connect now
    '53300'                                       // too many connections
]);

const TRANSIENT_SYSTEM_CODES = new Set([
    'ECONNRESET', 'EPIPE', 'ETIMEDOUT', 'ECONNREFUSED',
    'EHOSTUNREACH', 'ENETUNREACH', 'ENOTFOUND', 'EAI_AGAIN'
]);

function isTransientConnectionError(err) {
    if (!err) return false;
    // A SQLSTATE means the server already answered, so the statement may have
    // been applied. Only pre-statement failures are safe to send again.
    if (err.code && TRANSIENT_SQLSTATES.has(err.code)) return true;
    if (err.code && TRANSIENT_SYSTEM_CODES.has(err.code)) return true;
    if (!err.code) {
        const message = String(err.message || '');
        return /socket connection was closed unexpectedly|connection terminated|connection ended|server closed the connection|Client has encountered a connection error/i.test(message);
    }
    return false;
}


async function queryWithRetry(text, values) {
    const pool = await getPool();
    try {
        return await pool.query(text, values);
    } catch (err) {
        if (!isTransientConnectionError(err)) throw err;
        console.warn(`[db] Retrying after a dropped pooled connection (${describeError(err)})`);
        return pool.query(text, values);
    }
}


async function execute(sql, params) {
    const values = Array.isArray(params) ? params : [];
    let text = convertPlaceholders(sql);

    // Emulate MySQL's AUTO_INCREMENT insertId behaviour.
    if (isInsert(text) && !/\breturning\b/i.test(text)) {
        text += ' RETURNING id';
    }

    const result = await queryWithRetry(text, values);

    if (isInsert(text)) {
        const inserted = result.rows && result.rows[0];
        return [{ insertId: inserted ? inserted.id : 0, affectedRows: result.rowCount, ...(inserted || {}) }];
    }

    if (isSelect(text)) {
        return [result.rows];
    }

    return [{ affectedRows: result.rowCount }];
}


async function query(sql, params) {
    return queryWithRetry(sql, params);
}


module.exports = {
    execute,
    query,
    ready: getPool,
    get pool() {
        if (!activePool) {
            throw new Error('Database pool is not ready yet - await db.ready() first.');
        }
        return activePool;
    }
};
