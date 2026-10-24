# End-to-End Manual Test Script (Phase 5)

## Prerequisites
- Backend running, DB migrated
- User accounts: Police Officer (IO), Station Officer/Station Commander, Records Officer

## Test Steps

1. **Register a case**
   - Login as Police Officer
   - Create case with complainant details
   - Expected: Case created, complainant becomes Witness No. 1 in case_parties

2. **Add a witness**
   - Open case → Parties tab → Add Witness
   - Expected: Witness gets next number (e.g., Witness No. 2), appears under Witness group

3. **Add a suspect**
   - Parties tab → Add Suspect (first/last/gender)
   - Expected: Suspect appears under Suspect group with badge

4. **Upload statement**
   - Add Evidence for complainant/witness → enter statement + optional files
   - Expected: Statement saved to case_statements; ledger entry created as "Statement" with "Collected" custody

5. **Upload document and video**
   - Add Evidence for party → upload .pdf and .mp4
   - Expected: Files stored in evidence_storage/{caseId}/ with safe names, original names in DB, SHA-256 computed, ledger entries created, custody events "Collected"

6. **Check ledger entries**
   - Case page → Evidence Ledger link OR /evidence
   - Filter by party/type, search by ledger number
   - Expected: Entries show ledger number, type, provided by (party/role), collected by, date, status, shortened hash

7. **Transfer custody**
   - Open evidence detail → Request Transfer (IO) to user
   - Login as Station Commander → Approve transfer
   - Expected: Transfer request created, approval adds custody_log entry; earlier entries unchanged

8. **Verify integrity**
   - Evidence detail → Verify Integrity
   - Expected: Compares computed hash with stored SHA-256, shows pass/fail

## Security checks
- Try uploading .exe → rejected
- Try accessing evidence file as different user without access → 403
- Attempt to edit/delete ledger entries via API → no routes exist
