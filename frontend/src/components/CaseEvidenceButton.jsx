import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { roleFlags } from '../lib/roles';


const EVIDENCE_STATUSES = ['Court Pending', 'Closed'];


export default function CaseEvidenceButton({ caseId, status, always = false, className = 'btn btn-sm btn-navy ms-1' }) {
    const { user } = useAuth();
    const { isPoliceOfficer, isStationOfficer, isBranchOfficer } = roleFlags(user);
    const canViewEvidence = isPoliceOfficer || isStationOfficer || isBranchOfficer;

    if (!canViewEvidence) return null;
    if (!always && !EVIDENCE_STATUSES.includes(status)) return null;

    return (
        <Link to={`/evidence?caseId=${caseId}`} className={className}>
            <i className="bi bi-box-seam me-1" />Evidence
        </Link>
    );
}
