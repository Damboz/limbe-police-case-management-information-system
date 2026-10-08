# Limbe Police Station — Case Management Information System

A web app for a police station. Officers register cases, supervisors hand them to
investigators, investigators record notes and evidence, and management downloads PDF
reports.

This README explains **how the code works and why it's built this way.** It assumes you
have never written an Express or SQL app before. Every technical term is explained the
first time it shows up.

---

## Contents

**Part 1 — The big picture**
1. [What this program actually does](#1-what-this-program-actually-does)
2. [The files and why there are so many](#2-the-files-and-why-there-are-so-many)

**Part 2 — Concepts you'll need**
3. [How the web works](#3-how-the-web-works)
4. [How this app is put together](#4-how-this-app-is-put-together)
5. [A tour of one request](#5-a-tour-of-one-request)
6. [Logging in, and what a "session" is](#6-logging-in-and-what-a-session-is)
7. [Talking to the database](#7-talking-to-the-database)
8. [How the code says "yes" or "no"](#8-how-the-code-says-yes-or-no)
9. [Roles and access control](#9-roles-and-access-control)
10. [Keeping a record of everything](#10-keeping-a-record-of-everything)

**Part 3 — The controllers, one file at a time**
11. [`authApiController.js` — login and passwords](#11-authapicontrollerjs--login-and-passwords)
12. [`caseApiController.js` — the heart of the system](#12-caseapicontrollerjs--the-heart-of-the-system)
13. [`evidenceApiController.js` — the chain of custody](#13-evidenceapicontrollerjs--the-chain-of-custody)
14. [`adminApiController.js` — managing user accounts](#14-adminapicontrollerjs--managing-user-accounts)
15. [`supervisorApiController.js` — command-level oversight](#15-supervisorapicontrollerjs--command-level-oversight)
16. [`reportsApiController.js` and `generalApiController.js`](#16-reportsapicontrollerjs-and-generalapicontrollerjs)
17. [`pdfController.js` — generating the PDF reports](#17-pdfcontrollerjs--generating-the-pdf-reports)
18. [`controllers/database/` — the schema](#18-controllersdatabase--the-schema)

**Part 4 — Reference**
19. [Every endpoint in one table](#19-every-endpoint-in-one-table)
20. [Setup](#20-setup)
21. [Deployment](#21-deployment)
22. [Things that are wrong with the code](#22-things-that-are-wrong-with-the-code)

---

# Part 1 — The big picture

## 1. What this program actually does

A police station handles paperwork. Someone walks in and reports a crime — that's a
**case**. Then the case moves through stages:

```
Reported  →  Under Investigation  →  Court Pending  →  Closed
```

While a case exists, other things attach to it: the **complainant** (the person who
reported it), one or more **suspects** (people accused), one or more **victims**,
**investigators** (the officers assigned to work it), **evidence** (physical items),
and **notes** (written observations).

This program does four jobs:

1. **Records** that information in a database.
2. **Controls** who is allowed to do what — an officer can only work their own cases,
   only a station commander can assign cases, only an admin can create accounts.
3. **Produces documents** — PDF reports for management, and formal invitation letters
   to suspects.
4. **Logs everything** — every login, every case created, every status change is
   written to an audit trail. This matters for a police force: you need to be able to
   answer "who did this, and when?"

## 2. The files and why there are so many

A beginner's instinct is to put everything in one file. This project deliberately
doesn't, and the reason shows up immediately: **the code that decides *what* to do
(the controller) is completely separate from the code that *does* it (the service).**

```
backend/          The API. Deployed to Render.
  app.js          Builds the Express app: CORS, cookies, routes, error handling.
  routes/         Lists which URL does what. (apiRoutes.js, reportRoutes.js)
  middleware/     The guards that check who you are before you get in.
  controllers/    One file per area of the app. This is what this README is mostly about.
  services/       All the SQL lives here.
  utils/          Small helpers used everywhere.
  config/db.js    Creates the database connection and a shortcut for running queries.
frontend/         The React app. Deployed to Vercel as static files.
  public/         Static files copied verbatim into dist/ (css/, logo/).
  vite.config.js  Dev server and its proxy to the local API.
```

The two halves have separate `package.json` files, separate `node_modules`, and deploy
to separate hosts. Express answers JSON and PDF requests only; it no longer serves the
React build.

**Why split controllers from services?** Three reasons:

- **A controller shouldn't know SQL.** If `caseApiController` contained the
  `INSERT INTO cases...` statement, then reading the HTTP logic would mean wading
  through SQL, and changing the database structure would mean rewriting the HTTP code.
- **Several controllers need the same query.** The investigator dashboard and the
  admin dashboard both count cases. If the counting query lived in a controller, you'd
  copy it and eventually the two copies would disagree.
- **It's testable.** Because services don't send HTTP responses, you can test a
  function like "reject an empty note" without starting a web server.

So the rule the project follows is:

> **Controllers speak HTTP. Services speak SQL. Neither knows about the other.**

The only thing that crosses between them is a plain object — which brings us to the
most important pattern in the whole codebase.

---

# Part 2 — Concepts you'll need

## 3. How the web works

When you type `https://limbe-police.example.com/api/cases` into a browser, the
browser sends an HTTP request to a server. The server sends back a response: a status
number and some content.

**An HTTP request has:**
- a **method** — `GET` (fetch something), `POST` (create or change something),
  `PUT` (replace something), `DELETE` (remove something)
- a **path** — `/api/cases`
- **headers** — small pieces of metadata, like `Content-Type: application/json`
- a **body** — the actual data being sent, as text

**A response has:**
- a **status code** — a number with a standard meaning:

| Code | Meaning | Example in this app |
|---|---|---|
| `200` | Worked | Loaded the dashboard |
| `201` | Created something new | Registered a case |
| `400` | Your request was wrong | You left a required field blank |
| `401` | You need to log in | Session cookie missing |
| `403` | You logged in, but you can't do this | An officer tried to assign a case |
| `404` | Not found | Case ID 999 doesn't exist |
| `500` | The server broke | A SQL error |

- a **body** — usually JSON, which is just data written as `{"key": "value"}`

The `4xx` codes are *your* fault and `5xx` is *the server's* fault. This app is
careful about that distinction: a database outage returns a vague `500`, but a
malformed request returns a specific `400` with a message telling you what to fix.

### Express

Writing a server from scratch in Node means dealing with raw sockets. **Express** is a
library that wraps that so you just say "when someone hits this URL, run this
function."

```js
app.get('/api/cases', handleRequest);
```

Read that as: "if the method is GET and the path is `/api/cases`, call
`handleRequest`."

The functions Express runs are always shaped the same way:

```js
function handleRequest(req, res, next) {
    // req = the request  (what the client sent)
    // res = the response (what you send back)
    // next = "I'm finished, let someone else handle this"
}
```

So a controller that registers a case looks like this:

```js
exports.create = async (req, res, next) => {
    const result = await caseService.createCase(req.session.user.id, req.body);
    if (!result.ok) {
        return res.status(400).json({ success: false, error: result.error });
    }
    res.status(201).json({ success: true, message: 'Case registered.' });
};
```

Reading it out loud: "get the case data out of the request, ask the service to create
it, and if that didn't work send back an error; otherwise confirm it worked."

Two things to notice:

- **`req.body` is untrusted.** It's whatever the client sent, which a malicious user
  could edit by hand. Never trust it. More on this in [section 9](#9-roles-and-access-control).
- **`return` before `res.status(...)`** — once you send a response you can't send
  another one, so the code returns immediately.

### `async` / `await`

Almost everything here involves the database, and the database is on another
machine. So every useful function has to *wait* for a network reply.

```js
const result = await caseService.createCase(...);
```

`await` means "pause here until this finishes, then continue with the result." In
plain terms: *ask the database a question, wait for the answer, then decide what to
do.* JavaScript handles the waiting in the background, so your code reads top to
bottom even though it isn't actually sequential.

You'll also see `await` used on something that isn't obviously a query, in
[`suspectInvitation`](#suspectinvitation). It works the same way — `await` works on
any *promise*, and a promise is just "a value that isn't ready yet." That matters
there because a PDF is built in pieces over time.

### CommonJS (`require` and `module.exports`)

Older-style JavaScript module system, still what this project uses:

```js
const caseService = require('../services/caseService');   // load someone else's code
module.exports = { create, search };                      // offer my code to others
```

The `../` means "go up one folder." So this file lives in `backend/controllers/api/`, and
`../services/caseService` is `backend/services/caseService`.

## 4. How this app is put together

```
Browser
  │  GET /api/cases   (with a cookie attached)
  ▼
┌─────────────────────────────────────────────────────────┐
│ app.js  (runs for every request)                        │
│   morgan        → writes a line to the terminal log     │
│   express.json  → turns the request body into req.body  │
│   cookie-session→ reads the cookie into req.session     │
└─────────────────────────────────────────────────────────┘
  ▼
┌─────────────────────────────────────────────────────────┐
│ routes/apiRoutes.js  (the address book)                 │
│   GET /api/cases  →  isAuthenticated  →  caseApi.list   │
└─────────────────────────────────────────────────────────┘
  ▼
┌─────────────────────────────────────────────────────────┐
│ middleware/authMiddleware.js  (the guards)              │
│   isAuthenticated  — are you logged in?                 │
│   isAdmin          — are you an administrator?          │
│   authorizeRoles   — are you one of these roles?        │
└─────────────────────────────────────────────────────────┘
  ▼
┌─────────────────────────────────────────────────────────┐
│ controller  (controllers/api/caseApiController.js)      │
│   reads req, calls the service, writes the response     │
└─────────────────────────────────────────────────────────┘
  ▼
┌─────────────────────────────────────────────────────────┐
│ service  (services/caseService.js)                      │
│   runs the SQL, applies the business rules              │
└─────────────────────────────────────────────────────────┘
  ▼
      PostgreSQL  (via config/db.js)
```

`app.js` is where the app is assembled. Notice it serves two things from the same
process: the JSON API *and* the React front end. That's why you only run one server
in production.

## 5. A tour of one request

Let's follow a real one: an investigator opens a case.

**1. The browser sends** `GET /api/cases/42` with the `limbe.sid` cookie.

**2. `morgan`** writes `GET /api/cases/42 200 4.213ms` to the terminal. Useful when
you're running locally and want to see what's happening.

**3. `express.json()`** parses the request body. For a `GET` there's usually nothing,
so `req.body` ends up `undefined`.

**4. That `undefined` gets fixed.** Look at `app.js:52`:

```js
app.use((req, res, next) => {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        req.body = {};
    }
    next();
});
```

**Why?** Because the body parser only produces a `req.body` when the
`Content-Type` header matches. Send a `POST` without a JSON header and there's no
body to parse, so `req.body` stays `undefined`. Any controller doing
`req.body.note` would then crash with *"cannot read property 'note' of undefined"* —
and that crash would be reported to the user as a server error, when in fact
**they** sent a malformed request. This tiny function turns that into a clean
"you forgot something" instead.

**5. `cookie-session`** decrypts the cookie and populates `req.session`. So
`req.session.user` is now the logged-in officer's details, or `undefined` if they
aren't logged in.

**6. The guard runs** — `isAuthenticated` checks `req.session.user` exists. No? Then
it returns `401` and the request stops here; the controller never runs.

That "stops here" is the `next` parameter. In Express, a function that doesn't send a
response *and* doesn't call `next()` implicitly stops the chain. Guards work by
sending a response themselves and returning.

**7. The controller runs** — `caseApi.detail` calls the service.

**8. The service runs SQL** and returns either a result or an error.

**9. The controller translates that into a response** — `res.json({ success: true, data: ... })`.

**10. If anything threw** (a real bug, a dead database connection), the error skips
straight to the last function in `app.js`:

```js
app.use((err, req, res, next) => {
    const status = Number(err.status || err.statusCode) || 500;
    if (status < 500) {
        return res.status(status).json({ success: false, ... });
    }
    console.error('Unhandled System Error:', err);
    res.status(500).json({ success: false, error: 'An unexpected system error occurred.' });
});
```

Note it has **four** parameters, not three. That's Express's way of marking a
function as an error handler. Two behaviours worth understanding:

- **4xx errors are passed through.** If the body parser rejected malformed JSON, the
  user gets that specific complaint, not a generic "something went wrong."
- **5xx details are hidden.** The real error is printed to the server log for the
  developer, but the response says only "an unexpected system error occurred."
  Sending `err.message` to the browser would leak table names and file paths to
  anyone who could reach the page.

## 6. Logging in, and what a "session" is

A **session** is "we remember who this person is." The problem: your server is
stateless — it doesn't know that request #2 came from the same person as request #1.

The fix is a **cookie**: a small piece of text the server sends to the browser, which
the browser automatically returns on every later request. Put a reference in the
cookie, and on each request the server looks up who's who.

This project uses **`cookie-session`**, which is the good version of this idea: instead
of keeping session data *on the server* (in memory or a database) and putting only an
ID in the cookie, it encrypts **the whole session** into the cookie itself.

**Why does that matter here specifically?** Because the API runs on Render, where
instances are recycled and can be more than one at a time. A session stored in server
memory would be lost between requests — you'd be logged out constantly. A session that
travels in the cookie is unaffected, because the browser carries it.

The trade-off is size (cookies max out around 4KB) and the need for a signing secret.
Which brings us to `app.js:82`:

```js
const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
    throw new Error('SESSION_SECRET must be set...');
}
```

**Why crash instead of using a default?** A fallback secret would mean anyone who has
read the source code could forge a cookie claiming to be an administrator. The comment
in the code says exactly this. Refusing to start is the safe choice — the failure is
loud and immediate at deploy time rather than silent and dangerous in production.

## 7. Talking to the database

PostgreSQL stores data in **tables**: rows and columns, like a spreadsheet.

```
cases table                          users table
┌────┬─────────────┬──────────────┐  ┌────┬──────────┬─────────────┐
│ id │ ob_number   │ complainant  │  │ id │ badge    │ first_name  │
├────┼─────────────┼──────────────┤  ├────┼──────────┼─────────────┤
│  1 │ OB-2026-001 │ Jane Mwale   │  │  1 │ LIM-001  │ Charles     │
│  2 │ OB-2026-002 │ Peter Banda  │  │  2 │ MW-002   │ Esterk      │
└────┴─────────────┴──────────────┘  └────┴──────────┴─────────────┘
```

`config/db.js` creates a **connection pool** — a set of open connections the app reuses
instead of dialing the database for every single query. Two details in that file are
worth understanding:

**It translates MySQL syntax to PostgreSQL.** The original project used MySQL, and
this helper keeps the old style while running on Postgres:

```js
// This code says:
db.execute('SELECT * FROM users WHERE badge_number = ?', ['LIM-001'])

// The helper rewrites the ? into $1 before sending it, because that's what
// PostgreSQL wants:
SELECT * FROM users WHERE badge_number = $1
```

**The `?` is a security feature, not just syntax.** Values are never pasted into the
SQL text — they're sent separately, so the database treats them as data and never as
code. Write the naive version instead:

```js
// NEVER DO THIS
db.execute(`SELECT * FROM users WHERE badge_number = '${input}'`)
```

and someone typing `' OR '1'='1` deletes your user table. The placeholder style makes
that attack impossible. **Every query in this project uses `?` placeholders** — keep it
that way.

`execute()` also has a quirk that explains a lot of confusing code in the services:

```js
const [[totals]] = await db.execute(`SELECT COUNT(*) ... FROM cases`);
```

`db.execute()` returns an array whose *first element* is the rows array. So
`await db.execute(...)` gives `[[...rows]]`, destructuring once with `[x]` gives the
rows, and `const [[totals]]` picks the first row out of those. It looks like noise, but
it's what makes the destructuring in the controllers line up.

## 8. How the code says "yes" or "no"

This is the pattern you'll see in every single service, so it's worth understanding
properly.

A service function doesn't send a response — it returns a plain object that the
controller turns into one. `utils/result.js` defines just two shapes:

```js
function ok(data)  { return { ok: true,  ...(data || {}) }; }
function fail(status, error) { return { ok: false, status, error }; }
```

**Success:**
```js
{ ok: true, caseId: 42, obNumber: 'OB-20260927-0001' }
```

**Failure:**
```js
{ ok: false, status: 400, error: 'Please complete all required fields before submitting.' }
```

Two details that trip people up:

1. **`ok(data)` spreads with `...`.** It doesn't nest the data under a `data` key — it
   throws the fields in at the top level. So the success object above has `caseId` as
   a *top-level* property, not at `result.data.caseId`. This is why controllers send
   `data: result` and the client reads `response.data.caseId`.

2. **The service picks the status code, not the controller.** `fail(400, ...)` means
   the service decided "this is the caller's mistake." Controllers never choose
   numbers; they just copy whatever came back:

   ```js
   if (!result.ok) {
       return res.status(result.status).json({ success: false, error: result.error });
   }
   ```

   This means the error messages are consistent and specific — `'Note cannot be empty.'`
   rather than a generic "invalid input" — because the code that *knows* what's missing
   is the code that validates it.

Every response, success or failure, has `success: true/false` at the top level. The
React client relies on that to decide what to render.

## 9. Roles and access control

**Authentication** = "who are you?" (the session cookie).
**Authorization** = "what are you allowed to do?" (your role).

Four roles:

| role_id | role | what they do |
|---|---|---|
| 1 | Admin | everything, including user management and the audit log |
| 2 | Station Commander | assigns cases, approves status changes, station analytics |
| 3 | Investigating Officer | works on the cases assigned to them |
| 4 | Counter/Intake Officer | registers cases at the front desk |

Access control happens at **three different levels**, and this matters because a
mistake at any one of them is a security hole.

**Level 1 — the route guard.** `routes/apiRoutes.js` chains guards in front of every
handler:

```js
router.delete('/admin/users/:id', isAuthenticated, isAdmin, adminApi.deleteUser);
```

Read that left to right: they must be logged in, they must be an admin, and only then
does the controller run. The `:id` is a parameter — whatever is in that position in
the URL arrives as `req.params.id`.

**Level 2 — the service re-checks.** Guards stop casual mistakes, but they run in a
different file from the SQL. `caseService.addCaseNote` re-verifies the officer is
actually assigned to that case:

```js
// 403 Only investigators assigned to this case can add notes.
```

**Level 3 — identity comes from the session, never the body.** This is the subtle one
and it's the most important. `caseApi.addNote` does this:

```js
const user = req.session.user;          // who the server says you are
caseService.addCaseNote(req.params.id, user, req.body.note);
```

The officer's ID comes from the encrypted cookie, never from the request. The client
*sends* the case ID and the note, but never its own identity. If a malicious user
edited their request to put a different officer's ID in the body, there'd be nothing to
grab — the server was never listening. This pattern appears in every controller that
writes anything.

One more thing the code does carefully: the `permissions` object in
`getCaseDetail` tells the React app which buttons to show, but that is only cosmetic.
The real enforcement is the service check in level 2. Hiding a button is a
convenience; the server refusing the request is the security boundary.

## 10. Keeping a record of everything

Every important action calls `logAudit`:

```js
await logAudit(req, user.id, 'CASE_REGISTERED',
    `Registered new Case OB ${obNumber} for complainant ${complainantName}.`);
```

That writes a row to `audit_logs` with the action, a readable description, the
timestamp, and the officer's **IP address**. `utils/audit.js` gets the IP from
`x-forwarded-for`, a header Render sets to tell you the real client address when the
request passed through a proxy.

**One deliberate decision:** `logAudit` wraps its database call in a try/catch and
prints a console error instead of throwing:

```js
catch (err) {
    console.error(`Failed to write audit log "${action}":`, err.message);
}
```

That means if the audit table breaks, registering a case *still works*. Is that
right? For a police system you could argue the opposite. The reasoning here is
availability: an officer standing at a counter shouldn't be blocked from registering a
crime because a logging insert timed out. It's a defensible trade-off, but worth
knowing it's a trade-off.

---

# Part 3 — The controllers, one file at a time

Now the controllers themselves. For each one I've noted the route, who can reach it,
what it does, and anything surprising.

## 11. `authApiController.js` — login and passwords

**File:** `controllers/api/authApiController.js` · **4 functions**

Logging in and out. This is the only controller with two routes that need no guard at
all — you can't require a login to log in.

### `login` — `POST /api/auth/login`

```js
const result = await authService.authenticate(req.body.badge_number, req.body.password);
if (!result.ok) {
    return res.status(result.status).json({ success: false, error: result.error });
}
req.session.user = user;
await logAudit(req, user.id, 'USER_LOGIN', `Officer ${user.badge_number} logged in successfully.`);
return res.json({ success: true, data: { user } });
```

The service checks badge number *or* email, then verifies the password. Four possible
failures, each with a deliberate choice of message:

| Status | Message | Why that status |
|---|---|---|
| `400` | `Please provide both Badge Number / Username and Password.` | An empty form — your fault |
| `401` | `Invalid credentials. Please verify your badge number or email.` | No such badge number |
| `403` | `Account deactivated. Please contact your System Administrator.` | Real user, but disabled |
| `401` | `Invalid credentials. Please check your password.` | Right badge, wrong password |

Notice the unknown-badge and wrong-password messages are *different*, which is normally
a bad idea — it lets an attacker discover which badge numbers exist. It's a small
inconsistency worth knowing about.

The critical line is `req.session.user = user`. What gets stored is built by
`authService.toSessionUser()`, and that function is careful:

```js
{ id, badge_number, rank_title, first_name, last_name, email, role, role_id }
//  no password_hash, no is_active
```

**The password hash is deliberately kept out of the session.** The session is encrypted
into a cookie, but the hash still has no business being in data the client carries
around.

### `logout` — `POST /api/auth/logout`

```js
if (!user) return res.json({ success: true });   // already logged out — not an error
await logAudit(req, user.id, 'USER_LOGOUT', `Officer ${user.badge_number} logged out.`);
req.session = null;
res.clearCookie('limbe.sid', { httpOnly: true, sameSite: 'lax', secure: /* production */ });
```

Setting the session to `null` empties the cookie, and `clearCookie` makes the browser
drop it entirely. The second part matters: emptying a cookie isn't the same as deleting
it, and some browsers keep empty cookies around.

`secure` only applies in production because setting it on `http://localhost` would make
the browser refuse to send the cookie, and you couldn't log in during development.

### `me` — `GET /api/auth/me` · `isAuthenticated`

```js
res.json({ success: true, data: { user: req.session.user } });
```

One line, and it's essential. **The React app reloads constantly** — every page refresh
throws away the JavaScript state — so on startup it calls `/api/auth/me` to ask the
server "am I still logged in?" This endpoint is how the app restores that state.

### `changePassword` — `POST /api/auth/change-password` · `isAuthenticated`

Takes `current_password`, `new_password`, `confirm_password`. The service checks in
order: all present (`400 All password fields are required.`), the two new ones match
(`400 New password and confirmation password do not match.`), length ≥ 6
(`400 New password must be at least 6 characters long.`), the account still exists
(`401`), and the current password is right (`400 Incorrect current password.`). Only
then does it re-hash and save.

Passwords are stored as a **bcrypt hash** — a one-way scramble. Nobody, including the
system, can read a stored password back. To check a login, bcrypt re-scrambles the
attempted password and compares the results. That's why `changePassword` needs the
current password at all: you can't check it against a hash, you can only check a real
attempt against it.

## 12. `caseApiController.js` — the heart of the system

**File:** `controllers/api/caseApiController.js` · **10 functions** · all `isAuthenticated`

The biggest and most important file. All ten functions read the officer from
`req.session.user`.

### `list` — `GET /api/cases`

Returns the case list. The service builds a long query that joins cases to their crime
category, branch, intake officer, and assigned investigators, and aggregates
`STRING_AGG` so you get one row per case with the officers' names already joined into
"Detective Banda, Detective Phiri" rather than repeated rows.

**Know this:** only Investigators are filtered to their own cases. Every other role
gets the entire station. See [issue #2](#22-things-that-are-wrong-with-the-code).

### `formOptions` — `GET /api/cases/new`

Returns `{ categories, branches }` so the new-case form's dropdowns come from the
database instead of being hardcoded in JavaScript. Small, but it means adding a crime
category is a database change, not a code change.

### `create` — `POST /api/cases` → `201`

The intake process. The service validates the required fields, then generates a
reference number:

```js
const datePart = today.toISOString().slice(0,10).replace(/-/g,'');   // 20260927
const count    = /* SELECT COUNT(*) FROM cases WHERE DATE(created_at) = CURRENT_DATE */;
return `OB-${datePart}-${String(count + 1).padStart(4, '0')}`;         // OB-20260927-0001
```

So references look like `OB-20260927-0001`: today's date plus a daily sequence number.
(The counter is station-wide and mixes UTC with server-local time, so it could
collide near midnight — a real but minor issue.)

The interesting part is that **one request can write two audit rows**:

```js
if (suspectName) {
    await logAudit(req, user.id, 'SUSPECT_LINKED',
        `Linked suspect "${suspectName}" to Case OB ${obNumber} during intake.`);
}
await logAudit(req, user.id, 'CASE_REGISTERED',
    `Registered new Case OB ${obNumber} for complainant ${complainantName}.`);
```

If the officer filled in the optional suspect box during intake, both the case and
the suspect linkage get logged. The response message changes too:

> *"Case registered successfully with reference OB-…. Suspect "X" was added — you
> can now generate an invitation letter for him/her."*

### `search` — `GET /api/cases/search?q=&type=`

One endpoint, four search modes. `type` picks which: `national_id`, `phone`,
`suspect`, or `victim` (or `all` for every branch). Each returns up to 20 results
tagged with a `match_type` so the UI can say *why* something matched.

Two things worth knowing: terms under 2 characters return `[]` (an unbounded `%term%`
search over every table is a slow way to crash your database), and **this search is
not restricted to the caller's cases** — any officer can search everything.

### `detail` — `GET /api/cases/:id`

Six queries in one response: the case, assigned investigators, notes, evidence,
suspects, victims. It also returns a `permissions` object:

```js
permissions: {
    canAddNote, canRequestStatus, canAddEvidence, canLinkSuspectVictim
}
```

**This is UI convenience, not security.** It tells the React app which buttons to
render. The real check happens in each write function.

### `addNote` — `POST /api/cases/:id/notes`

The order of checks here is instructive:

```js
if (!note)            return fail(400, 'Note cannot be empty.');
if (!caseExists)       return fail(404, 'Case not found.');
if (!isAssigned)       return fail(403, 'Only investigators assigned to this case can add notes.');
```

Cheapest and most common mistake first, then existence, then permission — so the
response explains the *first* thing that's actually wrong. A user who submits an empty
note on a bad case ID gets "note cannot be empty" rather than a confusing 404.

### `requestStatus` — `POST /api/cases/:id/request-status`

**The most misunderstood function in the project.** An investigator finishing a case
does *not* set its status. They submit a *request*:

```sql
UPDATE cases
SET requested_status = ?, status_request_notes = ?, status_requested_by = ?, status_requested_at = NOW()
WHERE id = ?
```

`status` is untouched. A commander has to approve it. That's a deliberate separation of
duties: an officer can't quietly close their own case.

The service restricts requests to `Closed` or `Court Pending` (a database `CHECK`
constraint enforces the same thing), and refuses a second request while one is pending:

> `400 A status change request is already pending supervisor review.`

### `addEvidence` — `POST /api/cases/:id/evidence` → `201`

Inserts an evidence row, always starting at `status = 'In Locker'`. Requires an
assigned investigator.

### `linkSuspect` / `linkVictim` — `POST /api/cases/:id/suspects` · `/victims` → `201`

Near-identical. Both check required fields, confirm the case exists, and check
permission — but they're more permissive than the note/evidence functions, allowing
assigned investigators *and* intake officers *and* supervisors. That makes sense: a
complainant names a suspect at the counter, and a commander can add one later.

`linkSuspect` writes two rows (the person, then the case link); `linkVictim` writes one.

## 13. `evidenceApiController.js` — the chain of custody

**File:** `controllers/api/evidenceApiController.js` · **4 functions** ·
all `authorizeRoles('Investigating Officer', 'Station Commander', 'Admin')`

**Chain of custody** is the legal requirement that you can prove who held an item, when.
Which is why every function here writes an audit row with the before *and* after state.

### `ledger` — `GET /api/evidence`

The evidence list with filters (`status`, `category`, `q`, `from`, `to`) and a KPI
summary. Two things are happening here:

**Row scoping, in the service:**

```js
const scoped = !canManage(user);
if (scoped) {
    where.push('c.id IN (SELECT ci.case_id FROM case_investigators ci WHERE ci.investigator_id = ?)');
    params.push(user.id);
}
```

An officer sees only evidence from their own cases; a commander or admin sees
everything. Good — this one is done correctly.

**A computed `canUpdateStatus` flag** tells the UI whether to show the status buttons.
Note the ordering in the write functions below: the *service* is the real gate, and it
checks role first.

### `updateStatus` — `POST /api/evidence/:id/status`

Reads `new_status` and `notes`. The service checks in this order:

1. `403 Only Supervisors and Administrators can update evidence status.`
2. `400 Invalid evidence status.` — against the five legal states
3. `404 Evidence item not found.`

The audit detail is the useful part:

```
Evidence item "E-01" (Case OB 20260927-0001) status changed from "In Locker" to "Transferred to Lab".
```

Both the old and new state, plus the case reference. That's what makes the trail
evidence.

### `transfer` — `POST /api/evidence/:id/transfer`

Does two things in one `UPDATE`:

```sql
UPDATE evidence SET storage_location = ?, status = 'Transferred to Lab' WHERE id = ?
```

Changing the location implies the status change, so the service does both together
rather than making the caller remember. The audit records the movement: *"transferred
from "old" to "new"."*

### `dispose` — `POST /api/evidence/:id/dispose`

Requires a `disposal_reason`, with a message that makes the reason mandatory:

> `400 Disposal reason is required for audit purposes.`

Disposing of an item with no stated reason is exactly the kind of gap a chain of
custody exists to prevent, so the code refuses it. Status becomes `Disposed`;
`storage_location` is deliberately left alone, preserving where the item *was*.

## 14. `adminApiController.js` — managing user accounts

**File:** `controllers/api/adminApiController.js` · **11 functions** ·
all `isAuthenticated` + `isAdmin`

### `dashboard` — `GET /api/admin/dashboard`

One response with counts for users, cases, evidence, plus the 5 newest users and 10
newest audit rows. Just a read.

### `users` — `GET /api/admin/users`

Passes `req.query` (the URL's `?search=...&role=...`) to the service. One pattern to
notice — the search filter is **always applied**, defaulting to `%` (SQL's
match-everything wildcard):

```js
WHERE (u.badge_number LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)
```

So there's no "no filter" code path that could accidentally dump the whole table.

### `formOptions` / `editUser` — `GET /api/admin/users/form-options` · `/admin/users/:id`

`editUser` is a small efficiency win worth copying:

```js
const options = await adminService.getPersonnelFormOptions();
res.json({ success: true, data: { ...result, ...options } });
```

The edit form needs the user *and* the role/branch dropdowns. Fetching both server-side
and merging them into one response saves the browser a second round trip.

### `createUser` — `POST /admin/users` → `201`

The acting admin's ID is captured *before* the write:

```js
const adminId = req.session.user.id;
const result = await adminService.createUser(req.body);
```

That ordering is deliberate. `req.body` is the *new user's* data, so if the audit line
were built afterwards from the wrong object you'd log the wrong person. The service
validates required fields, rejects duplicate badge or email, maps the role string to
its `role_id`, and hashes the password with bcrypt.

### `updateUser` — `PUT /admin/users/:id`

Updates identity and role. **It does not touch `is_active`** — deactivating someone is
a separate, separately-audited action. If updating a profile could silently re-enable
a suspended account, there'd be no record of it.

### `resetPassword` — `POST /admin/users/:id/reset-password`

An admin resetting someone's password. Note the check order: length is tested *before*
the two passwords match, so a missing confirmation field reports the length error. Odd,
but harmless. This function has **no existence check** — see issue #5.

### `toggleStatus` — `POST /admin/users/:id/toggle-status`

Passes *both* the session user and the target ID, because the service needs both:

```js
adminService.toggleUserStatus(req.session.user, req.params.id);
```

and refuses self-deactivation — `400 You cannot deactivate your own active account.`
Otherwise an admin could lock themselves out, and with no second admin there's no way
back in. A small guard that prevents an unrecoverable situation.

### `deleteUser` — `DELETE /admin/users/:id`

The most carefully-guarded function in the project. A four-step ladder:

1. `400 You cannot delete your own account.`
2. `400 Account LIM-005 is active. Only deactivated (inactive) accounts can be deleted.`
3. **A referential check** — one query counts related records:
   ```sql
   SELECT (SELECT COUNT(*) FROM cases    WHERE intake_officer_id = ?) AS intake_cases,
          (SELECT COUNT(*) FROM evidence WHERE collected_by_officer_id = ?) AS evidence_records,
          (SELECT COUNT(*) FROM case_notes WHERE officer_id = ?) AS case_notes
   ```
   Any non-zero result → `400 Cannot delete LIM-005 — the account has historical
   records (3 case(s) as intake officer, 12 evidence record(s), 5 case note(s)).
   Deactivate instead.`
4. Only then `DELETE`.

The idea is good: **deactivate first, delete later, and never if there's history.**
Deactivation is reversible; a hard delete that orphans case files is not. (The check
misses `case_investigators` — issue #6.)

### `auditLogs` / `clearAuditLogs` — `GET` / `DELETE /api/admin/audit-logs`

`auditLogs` is a filtered, paginated view with dropdowns for available actions and
roles, capped at 500 rows.

`clearAuditLogs` is subtle. It wipes the table, then immediately writes a new row:

```js
await adminService.clearAuditLogs();
await logAudit(req, currentUser ? currentUser.id : null, 'LOGS_CLEARED',
    currentUser ? `... cleared by ${currentUser.badge_number || 'Administrator'}.`
                : 'Security and audit trail logs cleared.');
```

**So the destruction of the audit trail is itself audited** — and that's the one entry
that survives. The session null-checks mean it still logs a sensible line even if the
request somehow had no session.

## 15. `supervisorApiController.js` — command-level oversight

**File:** `controllers/api/supervisorApiController.js` · **6 functions** ·
all `authorizeRoles('Station Commander', 'Admin')`

### `dashboard` — `GET /api/supervisor/dashboard`

The busiest response in the app. Four things at once, in five queries:

- `kpi` — unassigned cases, pending approvals, active cases, overdue cases
- `unassignedCases` — top 10 by priority; "who needs a commander right now"
- `pendingApprovals` — oldest request first, so nothing waits forever
- `investigatorWorkload` — **ordered least-loaded first**, because this list feeds the
  assignment dropdown and the useful officer is the one with the smallest caseload
- `assignedActiveCases` — top 15 by days open

`overdueDaysThreshold: 14` is a constant (`OVERDUE_DAYS_THRESHOLD`, defined in
`caseService.js`) returned to the client so the UI can label "overdue" without
hardcoding 14. The same constant is interpolated into the SQL that counts overdue
cases, so the definition lives in one place.

### `assignCase` — `POST /api/supervisor/cases/assign`

The validation order is a good example of defence in depth:

1. `403 Only Station Commanders can assign cases to investigators.`
2. `400 Please select a valid case and at least one investigator.`
3. `400 Selected officers are not active investigators.` — the submitted IDs are
   filtered against *active investigators only*, so a client sending a retired
   officer's ID doesn't fail; that ID is just dropped
4. `404 Case record not found.`

Then it **replaces** the assignment set — delete everyone, re-insert — and marks the
first as `is_lead`. Note this is not in a database transaction, so a failure between
the delete and the inserts would leave a case unassigned. It works, but it's a place
where a concurrent request could cause trouble.

One nice touch: the *service* decides the audit action, so the controller doesn't
have to know:

```js
auditAction: hadPrevious ? 'CASE_REASSIGNED' : 'CASE_ASSIGNED',
```

First assignment logs `CASE_ASSIGNED`; reassignment logs `CASE_REASSIGNED`.

### `approveStatus` — `POST /api/supervisor/cases/approve-status`

The other half of the request workflow from
[`requestStatus`](#requeststatus--postapicasesidrequest-status). Reads `case_id`,
`decision` (`APPROVE` or `REJECT`), and `supervisor_notes`.

`APPROVE` applies the requested status; `REJECT` reverts to `Under Investigation`.
Either way it clears all four `requested_status*` columns — which is what allows the
officer to submit a fresh request afterwards.

The audit line is built by interpolating the decision:

```js
`Supervisor ${decision}D status change request for Case OB ${ob}. ...`
```

`'APPROVE' + 'D'` gives `APPROVED`, but `'REJECT' + 'D'` gives **`REJECTD`** — a typo
that lands in the permanent audit log. See issue #4.

### `analytics` / `hotspots` / `categories`

Three read endpoints that run four queries concurrently using `Promise.all(...)`
instead of one after another. `analytics` is the summary; `hotspots` and `categories`
are the untruncated drill-downs (the summary truncates to top 10 / no limit).

## 16. `reportsApiController.js` and `generalApiController.js`

Two small files for the dashboards every logged-in user can see.

**`generalApiController.js`** (2 functions) — `dashboard` and `myAnalytics`. Only
`dashboard` is actually wired up; `myAnalytics` here is an unused copy.

**`reportsApiController.js`** (3 functions) — the two above plus the one genuinely
interesting function:

### `suspectInvitation` — `GET /api/cases/:id/suspects/:suspectId/letter`

The only controller in the project that returns a **PDF** instead of JSON, and the only
one that is called with a `GET` but expects the browser to `POST` a body
(`appearance_date`, `appearance_time`, `officer_notes`) — the client's form does that
with `fetch`.

The sequence, and why the order matters:

```js
const { buffer } = pdfService.buildSuspectInvitationPdf({ ... });   // 1. start building
const pdfBuffer = await buffer;                                    // 2. wait for it
await logAudit(req, user.id, 'INVITATION_LETTER_GENERATED', ...);  // 3. log
res.setHeader('Content-Type', 'application/pdf');                  // 4. now respond
return res.send(pdfBuffer);
```

`buildSuspectInvitationPdf` returns `{ buffer: <a Promise> }` — it collects the PDF
chunks into an array and resolves when pdfkit says "done" (`pdfService.js:22`). The
service function can't return the finished PDF because it doesn't have it yet; it
returns the *promise* of it. That's what `await` on line 2 is for.

**The order is the point.** If the code sent the response before writing the audit row,
the browser would already be downloading while nothing was logged — or a failure
between them would produce a letter with no audit trail. Here, the log is guaranteed to
exist before a single byte reaches the user.

`Content-Disposition: inline` (not `attachment`) means the letter opens in the browser
tab rather than downloading, which is what you'd want for something the officer is
about to print.

## 17. `pdfController.js` — generating the PDF reports

**File:** `controllers/pdfController.js` · **4 handlers + 3 private helpers**

These live at non-`/api` paths (`routes/reportRoutes.js`) because they stream a file
rather than returning JSON.

### Three private helpers

Not Express handlers — just functions that draw the shared look. They exist because all
four reports should look like they came from the same office.

- **`drawReportHeader(doc, title)`** — centred station name, report title, timestamp,
  then a gold rule.
- **`drawSectionTitle(doc, text)`** — blue bold heading, then resets the font.
  **The reset is the important part.** pdfkit's font and colour settings *stick*, so
  without it every paragraph after a heading would print as a big blue heading.
- **`drawRestrictedFooter(doc)`** — `RESTRICTED — OFFICIAL USE ONLY` in small grey.

### The streaming pattern

All four handlers follow the same shape:

```js
const doc = new PDFDocument({ margin: 50, size: 'A4' });
res.setHeader('Content-Type', 'application/pdf');
res.setHeader('Content-Disposition', `attachment; filename="..."`);
doc.pipe(res);        // stream straight to the browser as pages are drawn
drawReportHeader(doc, 'My Case Report');
doc.text('...');
doc.end();            // finish the document
```

`doc.pipe(res)` means the PDF is written to the response *as it's generated* rather
than built fully in memory first. The handler therefore returns before the document is
finished — which is why nothing slow can be `await`ed after `pipe`, or the response
would already be closed.

`attachment` (unlike the invitation letter's `inline`) makes these download as files,
which is right for reports meant to be filed.

### `exportMyCasesPDF` — `GET /reports/my-cases`

`reportsService.getCasesForReport(user)` **is** properly scoped — the officer's own
cases, whether they registered or were assigned. Counts total, active, and closed for
the summary.

Handles the empty case with a sentence rather than a blank section:

```js
if (cases.length === 0) doc.text('No cases on record for this officer.');
```

### `exportStationPerformancePDF` — `GET /supervisor/reports/station-performance`

**The only controller in the project that writes SQL directly** — it calls
`db.execute` rather than going through a service. It's a reporting query with no
business logic beyond formatting, and this is a fair place to make an exception.

Three queries: station totals (with overdue interpolated from the shared constant),
a category breakdown, and per-officer workload. The divide is guarded:

```js
const resolutionRate = totals.totalCases > 0
    ? ((totals.closedCases / totals.totalCases) * 100).toFixed(1)
    : '0.0';
```

Because an empty station would otherwise be `0/0 = NaN` printed in a police report.

### `exportCrimeStatsPDF` — `GET /supervisor/reports/crime-statistics`

12-month trend and top 10 hotspots. One detail worth stealing:

```sql
TO_CHAR(created_at, 'Mon YYYY') AS month_label
...
GROUP BY TO_CHAR(created_at, 'YYYY-MM'), month_label
ORDER BY TO_CHAR(created_at, 'YYYY-MM') ASC
```

It *displays* "Sep 2026" but *sorts and groups* by "2026-09". Sorting on the pretty
string would give alphabetical order — Apr, Aug, Dec. Blank locations are filtered out
with `TRIM(incident_location) != ''`.

### `exportOfficerProductivityPDF` — `GET /supervisor/reports/officer-productivity`

Per-officer totals and resolution rates, with the same divide guard. Names the report
by rank, name, and badge number.

## 18. `controllers/database/` — the schema

Two SQL files, run once against an empty database. Not runtime code.

- **`init.sql`** — for local/self-hosted PostgreSQL 12+. Uses `psql` meta-commands
  (`\set ON_ERROR_STOP on`) and creates the database itself. Run with
  `psql -U postgres -f init.sql`. **It drops and recreates everything.**
- **`init.neon.sql`** — identical schema and data, minus the `CREATE DATABASE` and
  `\connect` lines, so the whole file can be pasted into the Neon web SQL Editor (which
  can't run `psql` commands).

Both create 15 tables in three groups:

| Group | Tables |
|---|---|
| Lookup | `roles`, `station_branch`, `crime_categories` |
| People | `users` |
| Cases | `cases`, `case_investigators`, `case_suspects`, `suspects`, `victims`, `evidence`, `case_notes` |
| System | `audit_logs`, `sessions` |

**The constraints carry the business rules**, so the database itself refuses bad data
even if a code path is missed:

```sql
CONSTRAINT chk_cases_priority CHECK (priority IN ('Low', 'Medium', 'High', 'Critical'))
CONSTRAINT chk_cases_status   CHECK (status IN ('Reported', 'Under Investigation',
                                                'Court Pending', 'Closed', 'Archived'))
CONSTRAINT chk_cases_requested_status CHECK (requested_status IN ('Closed', 'Court Pending'))
CONSTRAINT chk_evidence_status CHECK (status IN ('In Locker', 'Transferred to Lab',
                                                 'Presented in Court', 'Returned', 'Disposed'))
```

Note that `chk_cases_requested_status` **only allows `Closed` or `Court Pending`** —
the database independently enforces the same rule the service checks.

**The delete rules are the interesting part.** There are four different behaviours, and
they encode real policy about what may be erased:

| Relationship | Rule | Meaning |
|---|---|---|
| `case_notes`, `evidence`, `case_suspects`, `victims` → `cases.case_id` | `ON DELETE CASCADE` | Child rows only exist in the context of a case, so deleting the case deletes them |
| `case_investigators.investigator_id` → `users.id` | `ON DELETE CASCADE` | Deleting an officer removes their case assignments |
| `evidence.collected_by_officer_id`, `case_notes.officer_id` → `users.id` | `ON DELETE RESTRICT` | The database **refuses** to delete an officer who collected evidence or wrote notes |
| `audit_logs.user_id` → `users.id` | `ON DELETE SET NULL` | Deleting a user leaves their audit trail, just with no name attached |
| `cases.intake_officer_id` → `users.id` | *(none — defaults to RESTRICT)* | The database refuses to delete an officer who registered cases |

The last three are the important ones for a police system. **Evidence and notes can
never be orphaned by deleting their author** — `RESTRICT` makes the database itself
enforce it, and `adminService.deleteUser` re-checks in application code as well. And
**deleting a user never destroys the audit trail**: `SET NULL` erases the link but keeps
the rows, so the log of what someone did survives their account.

The `case_investigators` cascade is the one to be careful with — see issue #6.

Both files also seed demo data — roles, branches, crime categories, an admin
(`LIM-001`), sample cases, notes, and audit rows — so the app has something to show
immediately after install.

---

# Part 4 — Reference

## 19. Every endpoint in one table

**Auth** — `routes/apiRoutes.js`

| Method | Path | Guard | Handler |
|---|---|---|---|
| POST | `/api/auth/login` | — | `authApi.login` |
| POST | `/api/auth/logout` | — | `authApi.logout` |
| GET | `/api/auth/me` | auth | `authApi.me` |
| POST | `/api/auth/change-password` | auth | `authApi.changePassword` |

**General** — every role

| Method | Path | Guard | Handler |
|---|---|---|---|
| GET | `/api/dashboard` | auth | `generalApi.dashboard` |
| GET | `/api/my-analytics` | auth, IO/CO | `reportsApi.myAnalytics` |

**Cases** — all `auth`

| Method | Path | Handler |
|---|---|---|
| GET | `/api/cases` | `caseApi.list` |
| GET | `/api/cases/new` | `caseApi.formOptions` |
| POST | `/api/cases` | `caseApi.create` |
| GET | `/api/cases/search` | `caseApi.search` |
| GET | `/api/cases/:id` | `caseApi.detail` |
| POST | `/api/cases/:id/notes` | `caseApi.addNote` |
| POST | `/api/cases/:id/request-status` | `caseApi.requestStatus` |
| POST | `/api/cases/:id/evidence` | `caseApi.addEvidence` |
| POST | `/api/cases/:id/suspects` | `caseApi.linkSuspect` |
| POST | `/api/cases/:id/victims` | `caseApi.linkVictim` |
| GET | `/api/cases/:id/suspects/:suspectId/letter` | `reportsApi.suspectInvitation` |

**Evidence** — `auth` + `Investigating Officer / Station Commander / Admin`

| Method | Path | Handler |
|---|---|---|
| GET | `/api/evidence` | `evidenceApi.ledger` |
| POST | `/api/evidence/:id/status` | `evidenceApi.updateStatus` |
| POST | `/api/evidence/:id/transfer` | `evidenceApi.transfer` |
| POST | `/api/evidence/:id/dispose` | `evidenceApi.dispose` |

**Admin** — `auth` + `isAdmin`

| Method | Path | Handler |
|---|---|---|
| GET | `/api/admin/dashboard` | `adminApi.dashboard` |
| GET | `/api/admin/users` | `adminApi.users` |
| GET | `/api/admin/users/form-options` | `adminApi.formOptions` |
| POST | `/api/admin/users` | `adminApi.createUser` |
| GET | `/api/admin/users/:id` | `adminApi.editUser` |
| PUT | `/api/admin/users/:id` | `adminApi.updateUser` |
| POST | `/api/admin/users/:id/reset-password` | `adminApi.resetPassword` |
| POST | `/api/admin/users/:id/toggle-status` | `adminApi.toggleStatus` |
| DELETE | `/api/admin/users/:id` | `adminApi.deleteUser` |
| GET | `/api/admin/audit-logs` | `adminApi.auditLogs` |
| DELETE | `/api/admin/audit-logs` | `adminApi.clearAuditLogs` |

**Supervisor** — `auth` + `Station Commander / Admin`

| Method | Path | Handler |
|---|---|---|
| GET | `/api/supervisor/dashboard` | `supervisorApi.dashboard` |
| POST | `/api/supervisor/cases/assign` | `supervisorApi.assignCase` |
| POST | `/api/supervisor/cases/approve-status` | `supervisorApi.approveStatus` |
| GET | `/api/supervisor/analytics` | `supervisorApi.analytics` |
| GET | `/api/supervisor/analytics/hotspots` | `supervisorApi.hotspots` |
| GET | `/api/supervisor/analytics/categories` | `supervisorApi.categories` |

**PDF** — `routes/reportRoutes.js`, no `/api` prefix

| Method | Path | Guard | Handler |
|---|---|---|---|
| GET | `/reports/my-cases` | auth, IO/SC/Admin | `exportMyCasesPDF` |
| GET | `/supervisor/reports/station-performance` | auth, SC/Admin | `exportStationPerformancePDF` |
| GET | `/supervisor/reports/crime-statistics` | auth, SC/Admin | `exportCrimeStatsPDF` |
| GET | `/supervisor/reports/officer-productivity` | auth, SC/Admin | `exportOfficerProductivityPDF` |

One more, defined in `app.js:92` rather than a router: `GET /api/health` returns
`{ status: 'UP' }` with no auth, for uptime checks.

## 20. Setup

```bash
cd backend
npm install
psql -U postgres -f controllers/database/init.sql
cp .env.example .env      # then fill it in — see below
npm run dev               # nodemon app.js, restarts on save
```

The React app runs separately while developing, in its own terminal:

```bash
cd frontend && npm install && npm run dev
```

Vite's dev server runs on port 5173 and proxies `/api`, `/reports` and
`/supervisor/reports` through to Express on port 3000. That keeps every request
same-origin in development, so the cookie session behaves the same as it will in
production. Static assets need no proxy: they live in `frontend/public/` and
Vite copies them into `dist/`.

`backend/.env` needs:

| Variable | Default | Notes |
|---|---|---|
| `SESSION_SECRET` | **none** | mandatory — the app won't start without it |
| `CLIENT_ORIGIN` | `http://localhost:5173` | comma-separated allowlist of browser origins |
| `PGHOST` / `DB_HOST` | `localhost` | both spellings work |
| `PGUSER` / `DB_USER` | `postgres` | |
| `PGPASSWORD` / `DB_PASSWORD` | `''` | |
| `PGDATABASE` / `DB_NAME` | `limbe_police` | |
| `PGPORT` / `DB_PORT` | `5432` | |
| `PGSSLMODE` | unset | set `require` for Neon |
| `NODE_ENV` | unset | `production` enables `secure` cookies |

Generate a session secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

`backend/.env` is covered by `.gitignore` — never commit it. It holds the database
password. `app.js` loads it by absolute path, so it works no matter which folder you
start the app from; a root-level `.env` is read as a fallback and never overrides it.

## 21. Deployment

The two halves deploy separately, to two different hosts:

| Piece | Host | What it serves |
|---|---|---|
| `frontend/` | **Vercel** | the built React app, as static files |
| `backend/` | **Render** | the JSON API and the PDF routes |

That split is what makes the auth work. The browser loads the app from
`*.vercel.app` and calls the API on `*.onrender.com`, which are different origins, so
every request is cross-origin and three things have to line up.

### Cookies must be `SameSite=None`

`app.js` sets the session cookie to `SameSite=None; Secure` when `CLIENT_ORIGIN`
points at a real domain, which is the only combination a browser accepts for a
third-party cookie. Same-origin `Lax` would work in local development but the cookie
would never be sent once the two hosts diverge, and login would appear to succeed and
then silently fail on the next request.

`SameSite=None` is what makes **CSRF** possible in principle. The protection is the
CORS allowlist: `CLIENT_ORIGIN` is an exact-origin list, so a hostile page cannot read
responses or ride the session. Keep it to your real frontend domain and nothing else.

### The frontend must not use relative `/api` URLs

`client.js` builds every request from `VITE_API_URL`:

```js
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
```

Unset, that is an empty string and requests stay relative — which is exactly what the
Vite dev proxy wants. Set on Vercel, it becomes the absolute Render URL. It is also
why `credentials` had to change from `'same-origin'` to `'include'`: a relative request
is same-origin, an absolute one to Render is not.

### PDF reports are fetched, not linked

The four `/reports/*` routes sit outside `/api` and were plain `<a href>` links. A bare
link across origins **navigates** to the API host instead of downloading, which would
kick the user out of the app. They now go through `downloadPdfReport()`, which fetches
the PDF and saves it from a blob, exactly like the suspect invitation letters already
did.

### Vercel — the frontend

Point the project at **`frontend`** as the Root Directory. Vercel detects Vite
and builds it; `frontend/vercel.json` only adds the SPA history fallback:

```json
{
  "framework": "vite",
  "installCommand": "npm install --include=dev",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [{ "source": "/((?!assets/).*)", "destination": "/index.html" }]
}
```

`installCommand` is not optional in practice. `vite` is a devDependency, so if
`NODE_ENV=production` is set anywhere in the project's environment variables, the
install step skips devDependencies and the build dies with
`sh: vite: command not found` / `exited with 127`. `--include=dev` makes the step
immune to that.

Static assets must live in **`frontend/public/`** so Vite copies them into `dist/`.
When they sat outside the Vite root, the build succeeded but silently omitted
them — Express used to serve them instead.

Set one environment variable, for **Production**:

| Variable | Value |
|---|---|
| `VITE_API_URL` | `https://<your-render-service>.onrender.com` |

No trailing slash. Anything prefixed `VITE_` is baked into the bundle at build time,
so changing it means a rebuild.

### Render — the backend

`render.yaml` is a **blueprint**: pushing the repo with that file present creates the
service with the right settings. It sets `rootDir: backend`, `npm install`,
`npm start`, and points the health check at `/api/health`.

Fill in the blanks in the Render dashboard, or set them as `sync: false` secrets:

| Variable | Notes |
|---|---|
| `CLIENT_ORIGIN` | your Vercel domain — **must** match, or login fails |
| `SESSION_SECRET` | `generateValue: true` in the blueprint creates one |
| `PGHOST`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` | your Neon credentials |
| `PGSSLMODE` | `require` |
| `NODE_ENV` | `production` |

Deploy the **backend first**. Vercel needs the Render URL to bake into `VITE_API_URL`,
and Render needs the Vercel domain for `CLIENT_ORIGIN`. Neither can be filled in until
the other exists, so: create the Render service, copy its URL into Vercel, then set
`CLIENT_ORIGIN` on Render.

## 22. Things that are wrong with the code

Found while writing this README. Nothing has been changed.

### Serious

**1. Admins can't assign cases or approve status changes.**

`routes/apiRoutes.js:81-86` admits `'Station Commander', 'Admin'`, but the service
gates those two actions on:

```js
const COMMANDER_ROLES = ['Station Commander', 'supervisor'];   // no 'Admin'
```

An admin passes the route guard and is then rejected with `403`. Two contradictory
sources of truth for the same question.

**2. `/api/cases` isn't scoped for intake officers.**

In `caseService.listCasesForUser`, only `Investigating Officer` is filtered to their
own cases — the `else` branch has **no filter at all**. So a Counter/Intake Officer
listing cases receives every case at the station. Meanwhile
`reportsService.getMyAnalytics` *does* scope with `intake_officer_id = ?`, so the two
parts of the app disagree about what an intake officer can see.

**3. Case detail and search have no ownership check.**

Any authenticated user can read any case by id (`getCaseDetail`) or find it via
`searchCases`. `getCaseDetail` only *computes* a `permissions` object for the UI; the
write functions re-check independently, so this is a read-scope leak rather than a
write hole — but for a police system, read access is still sensitive.

### Minor

**4. Typo in the approval audit string.** `supervisorService` builds
`` `Supervisor ${decision}D ...` `` from `'APPROVE' | 'REJECT'`, so rejections are
logged as **`REJECTD`** — permanently, in the audit trail. The related action name is
also inconsistent: `STATUS_APPROVAL_APPROVE` / `STATUS_APPROVAL_REJECT` (not
`_APPROVED`).

**5. `resetPassword` has no existence check.** Resetting a nonexistent user ID
returns success, so a typo looks like it worked.

**6. `deleteUser` misses `case_investigators` — and the database silently cascades.**
The guard counts `cases.intake_officer_id`, `evidence.collected_by_officer_id`, and
`case_notes.officer_id` but not `case_investigators`. The other three are additionally
protected by `ON DELETE RESTRICT`, so the database would block the delete anyway.
`case_investigators` is different: it's `ON DELETE CASCADE`, so deleting an officer
who only ever *investigated* **silently removes them from every case they were
assigned to**, with no prompt and no audit record of the reassignment. The
`Cannot delete … the account has historical records … Deactivate instead.` message
should cover this table too.

**7. `reportsApi.dashboard` is dead code.** It's a verbatim copy of
`generalApi.dashboard`, but the route points at the `generalApi` version, so the
`reportsApi` copy is never called.

**8. `syncCaseInvestigators` has no transaction.** It deletes the existing
assignments then inserts the new ones. If an insert fails midway, the case is left with
fewer investigators than intended — or none. Wrapping it in `BEGIN`/`COMMIT` would fix
it.

**9. The login messages differ for unknown-badge vs wrong-password**
(`...verify your badge number or email` vs `...check your password`), which lets an
attacker enumerate valid badge numbers. A single generic message would be better.
