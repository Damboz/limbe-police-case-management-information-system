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
    doc.text(`OUR REF: ${caseItem.ob_number}`, { align: 'right' });
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
    doc.text(`Offence Reported: ${caseItem.crime_category || 'Uncategorised'} (OB Reference ${caseItem.ob_number})`);
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
        .text(`Reference ${caseItem.ob_number} | Restricted — Official Use Only`, { align: 'center' });

    doc.end();

    return { buffer: done, suspectFullName };
}


module.exports = { buildSuspectInvitationPdf, formatDisplayDate };
