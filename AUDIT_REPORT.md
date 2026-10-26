# AUDIT REPORT - Smart Police Case Management System

## PHASE 1: AUDIT (read-only)

### A. Map implementation - Roles, routes, middleware
- Role definitions: backend/roles.js:62-148 - ROLES/Admin/Police Officer/Records Officer/Station Officer/Branch Officer/Prosecutor, ROLE_IDS 1/6/7/8/9/10, canonicalization+legacy aliases/maps.
- Auth middleware: backend/middleware/authMiddleware.js:86-201 - isAuthenticated 401 if no session; isAdmin checks canonical role/role_id==ADMIN -> 403; denyAdmin blocks admins; authorizeRoles checks canonical role/role_id, 401 if no session, 403 else. normalizeSessionRole rewrites legacy roles/ids and hydrates branch for Branch Officer. enforceSessionTimeout drops idle/absolute expired sessions.
- Routes (backend/routes/apiRoutes.js): auth public except /auth/me,/auth/change-password; /api/dashboard isAuthenticated; /api/my-analytics isAuthenticated+authorizeRoles(POLICE_OFFICER); cases all isAuthenticated,denyAdmin (67-85); evidence mix authorizeRoles/custom (88-632); admin isAuthenticated,isAdmin (635-644); supervisor authorizeRoles(STATION_OFFICER) (647-656); branch authorizeRoles(BRANCH_OFFICER) (659-665); records authorizeRoles(RECORDS_OFFICER) (668-669); prosecution authorizeRoles(PROSECUTOR) (672-677).


### B. Verify workflow steps 1-8
1) Complainant online complaint -> verify by officer then case (rejected not become). POST /api/cases requires isAuthenticated,denyAdmin (apiRoutes.js:70), caseService.createCase creates case status Registered (caseService.js:240-372). No public/unprotected complaint submission endpoint found; no explicit verification gate; no mechanism preventing rejected complaints becoming cases. **FAIL/PARTIAL**.
2) Officer can register physically reported cases. **PASS**.
3) Any police officer can be assigned to investigate; can take statements. Assignment allows ASSIGN_ROLES with branch isolation (supervisorService.js:369-447). Parties/statements routes allow non-admin without assignment check. **PARTIAL**.
4) Records Officer assigns OB/criminal numbers only. authorizeRoles(RECORDS_OFFICER), atomic upsert in number_sequences, UNIQUE (recordsService.js:38-232, init.sql:205-207). **PASS**.
5) Station Officer decides CID vs Investigation Branch; oversees station; generates reports. classifyCase requires STATION_OFFICER, sets classification/workflow_branch/status Classified (supervisorService.js:277-338). **PASS**.
6) Branch Officer assigns only cases in their branch; reassignment with history. Branch isolation enforced; reassignment proposed by Branch Officer decided by Station Officer. History in reassignment_proposals; case_assignments table not written by code. **PARTIAL**.
7) Prosecutor views only cases sent to court; decides who goes to court. Dashboard filters Forwarded to Prosecution (prosecutorService.js:39-150). recordCourtDetails saves court_date/court_outcome but no explicit field for who goes to court. **PARTIAL**.
8) Any police officer can register case and be assigned as investigator. **PASS**.
State machine: assignment doesn't enforce numbering/classification/workflow_branch - steps can be skipped/out of order.


### C. Role/status/branch consistency
Backend/frontend roles and DB match; branches map correctly; canonicalization exists. **OK**.

### D. Security and validation
SQL parameterized mostly. Password hashing with bcryptjs. Session cookie-session with secret required, timeout, no-store. Missing CSRF, missing rate limiting on auth/public endpoints. Some evidence routes overly broad. Input validation gaps. **CONCERNS**.

### E. Audit trail
Audit logs table exists, logAudit used in controllers for key actions. **MOSTLY COVERED**.

### F. Tests
No test files found in /tests except helpers.js. Will create tests for critical rules.

### G. Defects (prioritized)
Critical: C1 No public online complaint submission/verification gate (spec step 1) - backend/routes/apiRoutes.js:70, backend/services/caseService.js:240-372; C2 Branch isolation/IDOR risks - backend/services/supervisorService.js:431-436; C3 Statements/notes/parties to non-assigned possible - backend/routes/apiRoutes.js:67-85, backend/controllers/api/caseApiController.js:158-238
High: H1 Assignment doesn't enforce numbering/classification/workflow_branch - backend/services/supervisorService.js:369-447; H2 case_assignments not written (history incomplete) - backend/services/assignmentService.js:51-70; H3 Prosecutor court assignment not explicit - backend/services/prosecutorService.js:218-279; H4 CSRF missing - backend/app.js; H5 Rate limiting missing - backend/app.js
Medium: M1 Evidence route role breadth - backend/routes/apiRoutes.js:170-237; M2 Transfer approve allows ADMIN - backend/routes/apiRoutes.js:274; M3 Input validation gaps
Low: L1 Minor inconsistencies

