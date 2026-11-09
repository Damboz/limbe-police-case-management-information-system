const PDFDocument = require('pdfkit');


function formatDisplayDate(dateStr) {
    if (!dateStr) return null;
    const [y, m, d] = String(dateStr).split('-');
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    if (isNaN(date.getTime())) return String(dateStr);
    return date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}


function buildSuspectInvitationPdf({ caseItem, suspect, user, appearanceDate, appearanceTime, officerNotes }) {
    const NAVY = '#0274B0';
    const DARK = '#1E293B';
    const GREY = '#64748B';

    const doc = new PDFDocument({ margin: 50, size: 'A4', compress: false });
    const chunks = [];
    doc.on('data', c => chunks.push(c));

    const done = new Promise((resolve, reject) => {
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
    });

    const letterDate = formatDisplayDate(appearanceDate) || String(appearanceDate);
    const letterTime = appearanceTime ? `${appearanceTime} hours` : '09:00 hours';
    const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const incidentOn = caseItem.incident_datetime
        ? new Date(caseItem.incident_datetime).toLocaleString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : 'Not recorded';
    const suspectFullName = `${suspect.first_name} ${suspect.last_name}`;
    // A case can be invited before its OB and criminal numbers are assigned,
    // so the letter works either way: it shows both
    // when available, and falls back to the internal Case ID when not.
    const obNumber = caseItem.ob_number || null;
    const criminalNumber = caseItem.criminal_number || null;
    const caseReference = obNumber || `Case #${caseItem.id}`;
    const referenceLine = [
        obNumber ? `OB ${obNumber}` : null,
        criminalNumber ? `Criminal No. ${criminalNumber}` : null
    ].filter(Boolean).join(' / ') || `Case #${caseItem.id}`;

    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(14).text('REPUBLIC OF MALAWI', { align: 'center' });
    doc.fillColor(DARK).fontSize(18).text('MALAWI POLICE SERVICE', { align: 'center' });
    doc.fontSize(13).text('LIMBE POLICE STATION', { align: 'center' });
    doc.fillColor(GREY).font('Helvetica').fontSize(9)
        .text('Limbe, Blantyre, Malawi', { align: 'center' });
    doc.moveDown(0.4);
    doc.strokeColor('#F7C631').lineWidth(2)
        .moveTo(doc.page.margins.left, doc.y)
        .lineTo(doc.page.width - doc.page.margins.right, doc.y)
        .stroke();
    doc.moveDown(1);

    doc.font('Helvetica').fontSize(9).fillColor(DARK);
    doc.text(`OUR REF: ${referenceLine}`, { align: 'right' });
    doc.text(`DATE: ${today}`, { align: 'right' });
    doc.moveDown(0.8);

    doc.font('Helvetica-Bold').fontSize(12).fillColor(NAVY)
        .text('INVITATION TO REPORT AT LIMBE POLICE STATION', { align: 'center' });
    doc.moveDown(1);

    doc.font('Helvetica').fontSize(10).fillColor(DARK).text('TO:');
    doc.font('Helvetica-Bold').fontSize(11).text(suspectFullName + (suspect.alias ? ` ("${suspect.alias}")` : ''));
    doc.font('Helvetica').fontSize(10);
    if (suspect.national_id) doc.text(`National ID: ${suspect.national_id}`);
    if (suspect.address) doc.text(`Address: ${suspect.address}`);
    if (suspect.phone_number) doc.text(`Phone: ${suspect.phone_number}`);
    doc.moveDown(1);

    doc.font('Helvetica').fontSize(10.5).fillColor(DARK).text(
        `You are hereby invited to report and appear before the Officer-in-Charge or the Desk Officer at Limbe Police Station on ${letterDate} at ${letterTime}, in connection with the matter described below.`
    );
    doc.moveDown(0.6);

    doc.font('Helvetica-Bold').fontSize(10.5).text('MATTER / REPORT AGAINST YOU:');
    doc.fillColor(DARK).font('Helvetica').fontSize(10);
    doc.text(`Offence Reported: ${caseItem.crime_category || 'Uncategorised'} (${obNumber ? `OB Reference ${obNumber}` : `Reference ${caseReference}`})`);
    doc.text(`Date & Time of Incident: ${incidentOn}`);
    doc.text(`Place of Incident: ${caseItem.incident_location}`);
    doc.text(`Complainant: ${caseItem.complainant_name}`);
    doc.moveDown(0.4);
    doc.text('Details of the report:');
    doc.text(caseItem.incident_details, { indent: 12 });
    doc.moveDown(0.6);

    doc.text(
        'You are kindly requested to bring your National Identity Card, passport, or any other means of identification, together with any documents in your possession that may assist this inquiry.'
    );
    doc.moveDown(0.4);
    doc.text(
        'If for any reason you are unable to attend at the stated time, please contact the reporting officer below so that an alternative date may be arranged.'
    );
    doc.moveDown(0.4);
    doc.font('Helvetica-Bold').text(
        'Please note that failure or refusal to honour this invitation without lawful cause may result in a warrant of arrest being issued against you.'
    );
    doc.moveDown(0.4);
    if (officerNotes && String(officerNotes).trim()) {
        doc.font('Helvetica').text(`Remarks: ${String(officerNotes).trim()}`);
        doc.moveDown(0.4);
    }

    doc.moveDown(0.8);
    doc.font('Helvetica').fontSize(10).fillColor(DARK).text('Yours faithfully,');
    doc.moveDown(1.6);
    doc.font('Helvetica-Bold').fontSize(11)
        .text(`${user.rank_title} ${user.first_name} ${user.last_name}`, { continued: false });
    doc.font('Helvetica').fontSize(10).fillColor(DARK)
        .text(`${user.role} — Badge No. ${user.badge_number}`)
        .text('Limbe Police Station')
        .text('Contact: Desk Officer, Limbe Police Station');

    doc.moveDown(1);
    doc.strokeColor('#CBD5E1').lineWidth(0.5)
        .moveTo(doc.page.margins.left, doc.y)
        .lineTo(doc.page.width - doc.page.margins.right, doc.y)
        .stroke();
    doc.moveDown(0.3);
    doc.fontSize(7.5).fillColor('#94A3B8').font('Helvetica')
        .text('System-generated invitation letter — Malawi Police Service, Limbe Station.', { align: 'center' })
        .text(`Reference ${referenceLine} | Restricted — Official Use Only`, { align: 'center' });

    doc.end();

    return { buffer: done, suspectFullName };
}


function formatDateTime(value) {
    if (!value) return 'Not recorded';
    const date = new Date(value);
    if (isNaN(date.getTime())) return String(value);
    return date.toLocaleString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
}


function formatDateOnly(value) {
    if (!value) return 'Not set';
    const date = new Date(value);
    if (isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}


function buildCourtCaseFilePdf({
    caseItem,
    parties = [],
    investigators = [],
    evidenceLedger = [],
    evidenceLegacy = [],
    minutes = [],
    notes = [],
    generatedBy
}) {
    const NAVY = '#0274B0';
    const DARK = '#1E293B';
    const GREY = '#64748B';

    const doc = new PDFDocument({ margin: 50, size: 'A4', compress: false });
    const chunks = [];
    doc.on('data', c => chunks.push(c));

    const done = new Promise((resolve, reject) => {
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
    });

    const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const value = (v, fallback = 'Not recorded') => (v === null || v === undefined || v === '') ? fallback : String(v);

    function section(title) {
        if (doc.y > doc.page.height - 130) doc.addPage();
        doc.moveDown(0.7);
        doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(12).text(title.toUpperCase());
        const lineY = doc.y + 2;
        doc.strokeColor('#CBD5E1').lineWidth(0.5)
            .moveTo(doc.page.margins.left, lineY)
            .lineTo(doc.page.width - doc.page.margins.right, lineY)
            .stroke();
        doc.moveDown(0.5);
        doc.fillColor(DARK).font('Helvetica').fontSize(10);
    }

    function field(label, val) {
        doc.font('Helvetica-Bold').fillColor(GREY).fontSize(8.5).text(label.toUpperCase());
        doc.font('Helvetica').fillColor(DARK).fontSize(10).text(value(val));
        doc.moveDown(0.25);
    }

    function paragraph(label, text) {
        doc.font('Helvetica-Bold').fillColor(GREY).fontSize(8.5).text(label.toUpperCase());
        doc.font('Helvetica').fillColor(DARK).fontSize(10).text(value(text), { indent: 12, width: contentWidth - 12 });
        doc.moveDown(0.4);
    }

    // Letterhead
    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(14).text('REPUBLIC OF MALAWI', { align: 'center' });
    doc.fillColor(DARK).fontSize(18).text('MALAWI POLICE SERVICE', { align: 'center' });
    doc.fontSize(13).text('LIMBE POLICE STATION', { align: 'center' });
    doc.fillColor(GREY).font('Helvetica').fontSize(9).text('Limbe, Blantyre, Malawi', { align: 'center' });
    doc.moveDown(0.4);
    doc.strokeColor('#F7C631').lineWidth(2)
        .moveTo(doc.page.margins.left, doc.y)
        .lineTo(doc.page.width - doc.page.margins.right, doc.y)
        .stroke();
    doc.moveDown(0.8);
    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(16).text('COURT CASE FILE', { align: 'center' });
    doc.fillColor(DARK).font('Helvetica').fontSize(10)
        .text(`Generated: ${new Date().toLocaleString('en-GB')}`, { align: 'center' });
    if (generatedBy) {
        doc.fillColor(GREY).fontSize(9)
            .text(`Downloaded by: ${generatedBy}`, { align: 'center' });
    }

    section('Case Reference');
    field('OB Number', caseItem.ob_number || 'Unnumbered');
    field('Criminal Number', caseItem.criminal_number || 'Not assigned');
    field('Court Date', formatDateOnly(caseItem.court_date));
    field('Officer Standing with Case', caseItem.court_officer_name
        ? `${caseItem.court_officer_name}${caseItem.court_officer_badge ? ` (${caseItem.court_officer_badge})` : ''}`
        : 'Not assigned');
    field('Case Status', caseItem.status);
    field('Offence / Category', caseItem.crime_category || 'Uncategorised');
    field('Priority', caseItem.priority);
    field('Classification', caseItem.classification || 'Not classified');
    field('Workflow Branch', caseItem.workflow_branch || caseItem.branch_name || 'Not assigned');
    field('Recorded By', caseItem.recorded_by_name || 'Unknown');
    field('Registered', formatDateTime(caseItem.created_at));

    section('Incident Details');
    field('Date & Time of Incident', formatDateTime(caseItem.incident_datetime));
    field('Place of Incident', caseItem.incident_location);
    paragraph('Details of the Report', caseItem.incident_details);

    section('Complainant & Parties');
    if (parties.length === 0) {
        doc.font('Helvetica').fontSize(10).fillColor(GREY).text('No parties recorded.');
    } else {
        const order = { Complainant: 1, Witness: 2, Suspect: 3 };
        const sorted = [...parties].sort((a, b) => {
            const byType = (order[a.party_type] || 9) - (order[b.party_type] || 9);
            if (byType !== 0) return byType;
            return (a.witness_number || 0) - (b.witness_number || 0);
        });

        sorted.forEach((party, index) => {
            if (doc.y > doc.page.height - 120) doc.addPage();
            const heading = party.party_type === 'Witness' && party.witness_number
                ? `Witness No. ${party.witness_number} - ${value(party.full_name)}`
                : `${value(party.party_type)} - ${value(party.full_name)}`;
            doc.font('Helvetica-Bold').fillColor(NAVY).fontSize(10.5).text(heading);
            doc.font('Helvetica').fillColor(DARK).fontSize(9.5);
            if (party.alias) doc.text(`Alias: ${party.alias}`);
            if (party.national_id) doc.text(`National ID: ${party.national_id}`);
            if (party.phone_number) doc.text(`Phone: ${party.phone_number}`);
            if (party.gender) doc.text(`Gender: ${party.gender}`);
            if (party.age) doc.text(`Age: ${party.age}`);
            if (party.occupation) doc.text(`Occupation: ${party.occupation}`);
            if (party.address) doc.text(`Address: ${party.address}`);
            if (party.statement) {
                doc.moveDown(0.2);
                doc.font('Helvetica-Bold').fontSize(8.5).fillColor(GREY).text('STATEMENT');
                doc.font('Helvetica').fontSize(9.5).fillColor(DARK)
                    .text(party.statement, { indent: 12, width: contentWidth - 12 });
            }
            doc.moveDown(0.5);
            if (index < sorted.length - 1) {
                doc.strokeColor('#E2E8F0').lineWidth(0.5)
                    .moveTo(doc.page.margins.left, doc.y)
                    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
                    .stroke();
                doc.moveDown(0.3);
            }
        });
    }

    if (investigators.length > 0) {
        section('Investigation Team');
        investigators.forEach((inv, idx) => {
            const lead = idx === 0 || inv.is_lead ? ' (Lead)' : '';
            doc.font('Helvetica').fontSize(10).fillColor(DARK)
                .text(`${inv.rank_title || ''} ${inv.first_name || ''} ${inv.last_name || ''}${lead} - ${inv.badge_number || 'No badge'}`);
        });
    }

    if (caseItem.status_request_notes) {
        section('Investigation Findings');
        paragraph('Submitted Findings', caseItem.status_request_notes);
    }

    if (minutes.length > 0) {
        section('Case Minutes');
        minutes.forEach(m => {
            if (doc.y > doc.page.height - 110) doc.addPage();
            doc.font('Helvetica-Bold').fontSize(9.5).fillColor(DARK)
                .text(`${value(m.minute_type)} - ${value(m.decision, 'No decision')} (${formatDateTime(m.created_at)})`);
            if (m.author_name) {
                doc.font('Helvetica').fontSize(8.5).fillColor(GREY).text(`By ${m.author_name}`);
            }
            if (m.comment) {
                doc.font('Helvetica').fontSize(9.5).fillColor(DARK)
                    .text(m.comment, { indent: 12, width: contentWidth - 12 });
            }
            doc.moveDown(0.4);
        });
    }

    if (notes.length > 0) {
        section('Case Notes');
        notes.forEach(n => {
            if (doc.y > doc.page.height - 110) doc.addPage();
            doc.font('Helvetica-Bold').fontSize(9).fillColor(GREY)
                .text(`${formatDateTime(n.created_at)} - ${value(n.officer_name, 'Officer')}`);
            doc.font('Helvetica').fontSize(9.5).fillColor(DARK)
                .text(n.note, { indent: 12, width: contentWidth - 12 });
            doc.moveDown(0.4);
        });
    }

    section(`Evidence Ledger (${evidenceLedger.length} item${evidenceLedger.length === 1 ? '' : 's'})`);
    if (evidenceLedger.length === 0) {
        doc.font('Helvetica').fontSize(10).fillColor(GREY).text('No evidence ledger entries recorded.');
    } else {
        evidenceLedger.forEach((item, index) => {
            if (doc.y > doc.page.height - 120) doc.addPage();
            const title = [item.ledger_no, item.item_number].filter(Boolean).join(' / ') || `Evidence #${item.id}`;
            doc.font('Helvetica-Bold').fontSize(10).fillColor(DARK)
                .text(`${title} - ${value(item.evidence_type)} (${value(item.status)})`);
            doc.font('Helvetica').fontSize(9).fillColor(DARK)
                .text(value(item.description), { indent: 12, width: contentWidth - 12 });
            doc.font('Helvetica').fontSize(8.5).fillColor(GREY);
            if (item.party_name) doc.text(`Party: ${item.party_name}`, { indent: 12 });
            doc.text(`Collected by: ${value(item.collected_by_name, 'Unknown')} on ${formatDateTime(item.collected_at)}`, { indent: 12 });
            if (item.storage_location) doc.text(`Storage: ${item.storage_location}`, { indent: 12 });
            if (item.file_name) doc.text(`File: ${item.file_name}`, { indent: 12 });
            if (item.sha256) doc.text(`SHA-256: ${item.sha256}`, { indent: 12 });
            doc.moveDown(0.45);
            if (index < evidenceLedger.length - 1) {
                doc.strokeColor('#E2E8F0').lineWidth(0.5)
                    .moveTo(doc.page.margins.left, doc.y)
                    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
                    .stroke();
                doc.moveDown(0.25);
            }
        });
    }

    section(`Legacy Evidence Register (${evidenceLegacy.length} item${evidenceLegacy.length === 1 ? '' : 's'})`);
    if (evidenceLegacy.length === 0) {
        doc.font('Helvetica').fontSize(10).fillColor(GREY).text('No legacy evidence entries recorded.');
    } else {
        evidenceLegacy.forEach((item, index) => {
            if (doc.y > doc.page.height - 110) doc.addPage();
            doc.font('Helvetica-Bold').fontSize(10).fillColor(DARK)
                .text(`${value(item.item_number)} - ${value(item.category)} (${value(item.status)})`);
            doc.font('Helvetica').fontSize(9).fillColor(DARK)
                .text(value(item.description), { indent: 12, width: contentWidth - 12 });
            doc.font('Helvetica').fontSize(8.5).fillColor(GREY);
            doc.text(`Collected by: ${value(item.collected_by_name, 'Unknown')} on ${formatDateTime(item.collected_at)}`, { indent: 12 });
            if (item.storage_location) doc.text(`Storage: ${item.storage_location}`, { indent: 12 });
            doc.moveDown(0.45);
            if (index < evidenceLegacy.length - 1) {
                doc.strokeColor('#E2E8F0').lineWidth(0.5)
                    .moveTo(doc.page.margins.left, doc.y)
                    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
                    .stroke();
                doc.moveDown(0.25);
            }
        });
    }

    doc.moveDown(1.2);
    doc.strokeColor('#CBD5E1').lineWidth(0.5)
        .moveTo(doc.page.margins.left, doc.y)
        .lineTo(doc.page.width - doc.page.margins.right, doc.y)
        .stroke();
    doc.moveDown(0.4);
    doc.fontSize(7.5).fillColor('#94A3B8').font('Helvetica')
        .text('RESTRICTED - OFFICIAL USE ONLY | Malawi Police Service - Limbe Station', { align: 'center' })
        .text('System-generated court case file.', { align: 'center' });

    doc.end();

    return { buffer: done, fileName: `Court_Case_File_${caseItem.ob_number || `Case_${caseItem.id}`}` };
}


module.exports = {
    buildSuspectInvitationPdf,
    buildCourtCaseFilePdf,
    formatDisplayDate
};
