// Vercel entrypoint.
//
// Vercel only treats files in the /api directory at the repository root as
// serverless functions, so this shim exists to point it at the real server.
// All the application code lives in backend/.
const app = require('../backend/app');

module.exports = app;
