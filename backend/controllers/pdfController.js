const db = require('../config/db');
const PDFDocument = require('pdfkit');
const reportsService = require('../services/reportsService');
const { OVERDUE_DAYS_THRESHOLD } = require('../services/caseService');
const { resolvePeriod, periodWhere, periodAnd } = require('../utils/reportPeriod');


function drawReportHeader(doc, reportTitle, period) {
    doc.fillColor('#0274B0')
        .fontSize(18)
        .text('Limbe Police Station', { align: 'center' });

    doc.fillColor('#1E293B')
        .fontSize(13)
        .text(reportTitle, { align: 'center' });

    doc.fillColor('#1E293B')
        .fontSize(10)
        .text(`Period: ${period.label}`, { align: 'center' });

    doc.fillColor('#64748B')
        .fontSize(9)
        .text(`Generated: ${new Date().toLocaleString('en-GB')}`, { align: 'center' });

    doc.moveDown(0.3);
    doc.strokeColor('#F7C631').lineWidth(2)
        .moveTo(doc.page.margins.left, doc.y)
        .lineTo(doc.page.width - doc.page.margins.right, doc.y)
        .stroke();
    doc.moveDown(1.2);
}

function drawSectionTitle(doc, text) {
    doc.moveDown(0.5);
    doc.fillColor('#0274B0').fontSize(12).font('Helvetica-Bold').text(text);
    doc.fillColor('#1E293B').font('Helvetica').fontSize(10);
    doc.moveDown(0.3);
}

function drawRestrictedFooter(doc) {
    doc.moveDown(1.5);
    doc.fontSize(8).fillColor('#94A3B8')
        .text('RESTRICTED — OFFICIAL USE ONLY | Malawi Police Service — Limbe Station', { align: 'center' });
}

function reportFileName(base, period) {
    const suffix = period.key === 'all' ? '' : `_${period.key}`;
    return `${base}${suffix}_${new Date().toISOString().slice(0, 10)}.pdf`;
}

function slug(text) {
    return String(text || 'report').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'report';
}


exports.exportMyCasesPDF = async (req, res, next) => {
    try {
        const user = req.session.user;
        const period = resolvePeriod(req.query.period);
        const cases = await reportsService.getCasesForReport(user, period);

        const activeCount = cases.filter(c => c.status === 'Under Investigation').length;
        const closedCount = cases.filter(c => c.status === 'Closed').length;
        const totalCount = cases.length;

        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${reportFileName(`My_Case_Report_${user.badge_number}`, period)}"`);
        doc.pipe(res);

        drawReportHeader(doc, 'My Case Report', period);

        drawSectionTitle(doc, 'Summary');
        doc.text(`Total Cases: ${totalCount}`);
        doc.text(`Active / Under Investigation: ${activeCount}`);
        doc.text(`Closed: ${closedCount}`);
        doc.moveDown(1);

        drawSectionTitle(doc, 'Case List');
        doc.moveDown(0.3);

        if (cases.length === 0) {
            doc.text('No cases on record for this officer during the selected period.');
        } else {
            cases.forEach(c => {
                doc.font('Helvetica-Bold')
                    .text(`${c.ob_number || `Case #${c.id} (Unnumbered)`} — ${c.crime_category || 'Uncategorised'} (${c.status})`);
                doc.font('Helvetica').text(`   ${c.incident_details || ''}`);
                doc.font('Helvetica').text(`   Priority: ${c.priority} | Registered: ${c.created_at ? new Date(c.created_at).toLocaleDateString('en-GB') : '—'}`);
                doc.moveDown(0.4);
            });
        }

        drawRestrictedFooter(doc);

        doc.end();
    } catch (err) {
        next(err);
    }
};


exports.exportStationPerformancePDF = async (req, res, next) => {
    try {
        const period = resolvePeriod(req.query.period);
        const inWindow = periodWhere(period, 'created_at');
        const inWindowAnd = periodAnd(period, 'c.created_at');

        const [[totals]] = await db.execute(`
            SELECT
                COUNT(*) AS total_cases,
                COALESCE(SUM(CASE WHEN status = 'Closed' THEN 1 ELSE 0 END), 0) AS closed_cases,
                COALESCE(SUM(CASE WHEN status NOT IN ('Closed', 'Archived') THEN 1 ELSE 0 END), 0) AS active_cases,
                COALESCE(SUM(CASE WHEN status = 'Under Investigation' AND CURRENT_DATE - created_at::date > ${OVERDUE_DAYS_THRESHOLD} THEN 1 ELSE 0 END), 0) AS overdue_cases
            FROM cases
            ${inWindow.sql}
        `, inWindow.params);

        const [categoryBreakdown] = await db.execute(`
            SELECT cc.name, COUNT(c.id) AS total
            FROM crime_categories cc
            LEFT JOIN cases c ON cc.id = c.category_id
            ${inWindowAnd.sql}
            GROUP BY cc.id, cc.name
            ORDER BY total DESC
        `, inWindowAnd.params);

        const [workload] = await db.execute(`
            SELECT u.rank_title, u.first_name, u.last_name, u.badge_number,
                COUNT(DISTINCT c.id) AS active_cases
            FROM users u
            LEFT JOIN case_investigators ci ON u.id = ci.investigator_id
            LEFT JOIN cases c ON ci.case_id = c.id AND c.status = 'Under Investigation' ${inWindowAnd.sql}
            WHERE u.is_active = 1 AND u.role NOT IN ('Admin', 'admin')
            GROUP BY u.id
            ORDER BY active_cases DESC
        `, inWindowAnd.params);

        const resolutionRate = totals.total_cases > 0
            ? ((totals.closed_cases / totals.total_cases) * 100).toFixed(1)
            : '0.0';

        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${reportFileName('Station_Performance_Report', period)}"`);
        doc.pipe(res);

        drawReportHeader(doc, 'Station Performance Report', period);

        drawSectionTitle(doc, 'Overview');
        doc.text(`Total Cases Recorded: ${totals.total_cases}`);
        doc.text(`Closed Cases: ${totals.closed_cases}`);
        doc.text(`Active Cases: ${totals.active_cases}`);
        doc.text(`Overdue Cases (${OVERDUE_DAYS_THRESHOLD}+ days under investigation): ${totals.overdue_cases}`);
        doc.text(`Overall Resolution Rate: ${resolutionRate}%`);

        drawSectionTitle(doc, 'Crime Category Breakdown');
        if (categoryBreakdown.length === 0) {
            doc.text('No category data available.');
        } else {
            categoryBreakdown.forEach(c => {
                doc.text(`${c.name}: ${c.total} case(s)`);
            });
        }

        drawSectionTitle(doc, 'Investigator Workload (Active Cases)');
        if (workload.length === 0) {
            doc.text('No active investigators on record.');
        } else {
            workload.forEach(o => {
                doc.text(`${o.rank_title} ${o.first_name} ${o.last_name} (${o.badge_number}) — ${o.active_cases} active case(s)`);
            });
        }

        drawRestrictedFooter(doc);

        doc.end();
    } catch (err) {
        next(err);
    }
};


// The grouping granularity follows the selected period: days for daily/weekly/
// monthly windows, months for yearly and all-time windows.
const TREND_GROUPS = {
    daily: { fmt: "TO_CHAR(created_at, 'Dy DD Mon YYYY')", key: "TO_CHAR(created_at, 'YYYY-MM-DD')", header: 'Daily Case Volume (Today)' },
    weekly: { fmt: "TO_CHAR(created_at, 'Dy DD Mon')", key: "TO_CHAR(created_at, 'YYYY-MM-DD')", header: 'Daily Case Volume (This Week)' },
    monthly: { fmt: "TO_CHAR(created_at, 'DD Mon')", key: "TO_CHAR(created_at, 'YYYY-MM-DD')", header: 'Daily Case Volume (This Month)' },
    yearly: { fmt: "TO_CHAR(created_at, 'Mon YYYY')", key: "TO_CHAR(created_at, 'YYYY-MM')", header: 'Monthly Case Volume (This Year)' },
    all: { fmt: "TO_CHAR(created_at, 'Mon YYYY')", key: "TO_CHAR(created_at, 'YYYY-MM')", header: 'Monthly Case Volume (Last 12 Months)' }
};


exports.exportCrimeStatsPDF = async (req, res, next) => {
    try {
        const period = resolvePeriod(req.query.period);
        const inWindow = periodWhere(period, 'created_at');
        const inWindowAnd = periodAnd(period, 'created_at');
        const group = TREND_GROUPS[period.key];

        const [monthlyTrends] = await db.execute(`
            SELECT
                ${group.fmt} AS month_label,
                COUNT(*) AS total_cases,
                COALESCE(SUM(CASE WHEN priority IN ('High', 'Critical') THEN 1 ELSE 0 END), 0) AS severe_cases
            FROM cases
            ${period.start ? inWindow.sql : "WHERE created_at >= CURRENT_DATE - INTERVAL '12 months'"}
            GROUP BY ${group.key}, month_label
            ORDER BY ${group.key} ASC
        `, period.start ? inWindow.params : []);

        const [hotspots] = await db.execute(`
            SELECT
                incident_location,
                COUNT(*) AS incident_count,
                COALESCE(SUM(CASE WHEN status = 'Closed' THEN 1 ELSE 0 END), 0) AS resolved_count
            FROM cases
            WHERE incident_location IS NOT NULL AND TRIM(incident_location) != ''
            ${inWindowAnd.sql}
            GROUP BY incident_location
            ORDER BY incident_count DESC
            LIMIT 10
        `, inWindowAnd.params);

        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${reportFileName('Crime_Statistics_Report', period)}"`);
        doc.pipe(res);

        drawReportHeader(doc, 'Crime Statistics Report', period);

        drawSectionTitle(doc, group.header);
        if (monthlyTrends.length === 0) {
            doc.text('No case data available for the selected period.');
        } else {
            monthlyTrends.forEach(m => {
                doc.text(`${m.month_label}: ${m.total_cases} case(s) — ${m.severe_cases} High/Critical priority`);
            });
        }

        drawSectionTitle(doc, 'Top Incident Hotspots');
        if (hotspots.length === 0) {
            doc.text('No location data available.');
        } else {
            hotspots.forEach((h, i) => {
                doc.text(`${i + 1}. ${h.incident_location} — ${h.incident_count} incident(s), ${h.resolved_count} resolved`);
            });
        }

        drawRestrictedFooter(doc);

        doc.end();
    } catch (err) {
        next(err);
    }
};


exports.exportOfficerProductivityPDF = async (req, res, next) => {
    try {
        const period = resolvePeriod(req.query.period);
        const inWindowAnd = periodAnd(period, 'c.created_at');

        const [officers] = await db.execute(`
            SELECT
                u.badge_number, u.rank_title, u.first_name, u.last_name,
                COUNT(ci.case_id) AS total_assigned,
                COALESCE(SUM(CASE WHEN c.status = 'Closed' THEN 1 ELSE 0 END), 0) AS total_closed,
                COALESCE(SUM(CASE WHEN c.status = 'Under Investigation' THEN 1 ELSE 0 END), 0) AS total_active
            FROM users u
            LEFT JOIN case_investigators ci ON u.id = ci.investigator_id
            LEFT JOIN cases c ON ci.case_id = c.id ${inWindowAnd.sql}
            WHERE u.is_active = 1 AND u.role NOT IN ('Admin', 'admin')
            GROUP BY u.id
            ORDER BY total_assigned DESC
        `, inWindowAnd.params);

        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${reportFileName('Officer_Productivity_Report', period)}"`);
        doc.pipe(res);

        drawReportHeader(doc, 'Officer Productivity Report', period);

        drawSectionTitle(doc, 'Investigator Case Metrics');
        if (officers.length === 0) {
            doc.text('No active investigators on record.');
        } else {
            officers.forEach(o => {
                const rate = o.total_assigned > 0
                    ? ((o.total_closed / o.total_assigned) * 100).toFixed(1)
                    : '0.0';
                doc.font('Helvetica-Bold').text(`${o.rank_title} ${o.first_name} ${o.last_name} (${o.badge_number})`);
                doc.font('Helvetica').text(
                    `   Total Assigned: ${o.total_assigned}  |  Closed: ${o.total_closed}  |  Active: ${o.total_active}  |  Resolution Rate: ${rate}%`
                );
                doc.moveDown(0.4);
            });
        }

        drawRestrictedFooter(doc);

        doc.end();
    } catch (err) {
        next(err);
    }
};


// Branch Officer: the cases classified into the officer's workflow branch.
exports.exportBranchCasesPDF = async (req, res, next) => {
    try {
        const user = req.session.user;
        if (!user.branch) {
            return res.status(400).json({
                success: false,
                error: 'Your account is not assigned to a workflow branch, so a branch report cannot be generated.'
            });
        }

        const period = resolvePeriod(req.query.period);
        const { branch, summary, statusBreakdown, cases } = await reportsService.getBranchCasesForReport(user, period);

        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${reportFileName(`Branch_Case_Report_${slug(branch)}`, period)}"`);
        doc.pipe(res);

        drawReportHeader(doc, `Branch Case Report — ${branch}`, period);

        drawSectionTitle(doc, 'Overview');
        doc.text(`Total Cases: ${summary.total_cases}`);
        doc.text(`Active Cases: ${summary.active_cases}`);
        doc.text(`Closed Cases: ${summary.closed_cases}`);
        doc.text(`Awaiting Branch Review: ${summary.pending_review}`);
        doc.text(`Returned to Investigator: ${summary.returned_cases}`);
        doc.text(`Forwarded to Prosecution: ${summary.forwarded_cases}`);

        drawSectionTitle(doc, 'Status Breakdown');
        if (statusBreakdown.length === 0) {
            doc.text('No cases on record for this branch during the selected period.');
        } else {
            statusBreakdown.forEach(s => {
                doc.text(`${s.status || 'Unknown'}: ${s.total} case(s)`);
            });
        }

        drawSectionTitle(doc, 'Branch Case List');
        if (cases.length === 0) {
            doc.text('No cases on record for this branch during the selected period.');
        } else {
            cases.forEach(c => {
                doc.font('Helvetica-Bold')
                    .text(`${c.ob_number || `Case #${c.id} (Unnumbered)`} — ${c.crime_category || 'Uncategorised'} (${c.status})`);
                doc.font('Helvetica').text(`   ${c.incident_details || ''}`);
                doc.font('Helvetica').text(
                    `   Priority: ${c.priority} | Investigators: ${c.investigator_names || 'Unassigned'} | Registered: ${c.created_at ? new Date(c.created_at).toLocaleDateString('en-GB') : '—'}`
                );
                doc.moveDown(0.4);
            });
        }

        drawRestrictedFooter(doc);
        doc.end();
    } catch (err) {
        next(err);
    }
};


// Records Officer: the station's numbering register and pending queue.
exports.exportNumberingRegisterPDF = async (req, res, next) => {
    try {
        const period = resolvePeriod(req.query.period);
        const { summary, numbered, pending } = await reportsService.getNumberingRegisterForReport(period);

        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${reportFileName('Records_Numbering_Register', period)}"`);
        doc.pipe(res);

        drawReportHeader(doc, 'Records Numbering Register', period);

        drawSectionTitle(doc, 'Overview');
        doc.text(`Cases Numbered (All Time): ${summary.total_numbered}`);
        doc.text(`Awaiting OB / Criminal Numbers: ${summary.pending_count}`);
        doc.text(`Numbered in Selected Period: ${numbered.length}`);

        drawSectionTitle(doc, 'Numbered Cases');
        if (numbered.length === 0) {
            doc.text('No cases were numbered during the selected period.');
        } else {
            numbered.forEach(n => {
                doc.font('Helvetica-Bold').text(`${n.ob_number || '—'}  |  ${n.criminal_number || '—'}`);
                doc.font('Helvetica').text(`   ${n.complainant_name || 'Unknown complainant'} — ${n.crime_category || 'Uncategorised'}`);
                doc.font('Helvetica').text(
                    `   Assigned: ${n.numbers_assigned_at ? new Date(n.numbers_assigned_at).toLocaleDateString('en-GB') : '—'}${n.assigned_by_name ? ' | By: ' + n.assigned_by_name : ''}`
                );
                doc.moveDown(0.4);
            });
        }

        drawSectionTitle(doc, 'Pending Numbering Queue');
        if (pending.length === 0) {
            doc.text('No cases are awaiting OB and criminal numbers.');
        } else {
            pending.forEach(p => {
                doc.font('Helvetica-Bold').text(`${p.complainant_name || 'Unknown complainant'} — ${p.priority} priority`);
                doc.font('Helvetica').text(
                    `   ${p.crime_category || 'Uncategorised'} | Status: ${p.status} | Registered: ${p.created_at ? new Date(p.created_at).toLocaleDateString('en-GB') : '—'}`
                );
                doc.moveDown(0.3);
            });
        }

        drawRestrictedFooter(doc);
        doc.end();
    } catch (err) {
        next(err);
    }
};


// Prosecutor: the station's prosecution caseload and court outcomes.
exports.exportProsecutionCasesPDF = async (req, res, next) => {
    try {
        const period = resolvePeriod(req.query.period);
        const { summary, cases } = await reportsService.getProsecutionCasesForReport(period);

        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${reportFileName('Prosecution_Report', period)}"`);
        doc.pipe(res);

        drawReportHeader(doc, 'Prosecution Report', period);

        drawSectionTitle(doc, 'Overview');
        doc.text(`Cases Forwarded to Prosecution: ${summary.forwarded_total}`);
        doc.text(`Awaiting Prosecution Action: ${summary.pending_prosecution}`);
        doc.text(`With Scheduled Court Date: ${summary.scheduled}`);
        doc.text(`Convictions Recorded: ${summary.convicted}`);
        doc.text(`Acquitted / Withdrawn: ${summary.not_convicted}`);

        drawSectionTitle(doc, 'Prosecution Case List');
        if (cases.length === 0) {
            doc.text('No prosecution cases on record for the selected period.');
        } else {
            cases.forEach(c => {
                doc.font('Helvetica-Bold')
                    .text(`${c.ob_number || 'Unnumbered'} — ${c.crime_category || 'Uncategorised'} (${c.status})`);
                doc.font('Helvetica').text(`   ${c.incident_details || ''}`);
                doc.font('Helvetica').text(
                    `   Priority: ${c.priority} | Forwarded: ${c.forwarded_at ? new Date(c.forwarded_at).toLocaleDateString('en-GB') : '—'} | Court: ${c.court_date ? new Date(c.court_date).toLocaleDateString('en-GB') : 'Not set'} | Outcome: ${c.court_outcome || 'Pending'}`
                );
                if (c.file_location) {
                    doc.font('Helvetica').text(`   File Location: ${c.file_location}`);
                }
                doc.moveDown(0.4);
            });
        }

        drawRestrictedFooter(doc);
        doc.end();
    } catch (err) {
        next(err);
    }
};


// Admin: personnel, case and audit activity snapshot across the whole system.
exports.exportSystemReportPDF = async (req, res, next) => {
    try {
        const period = resolvePeriod(req.query.period);
        const { userStats, caseStats, roleBreakdown, recentActivity } = await reportsService.getSystemReport(period);

        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${reportFileName('System_Report', period)}"`);
        doc.pipe(res);

        drawReportHeader(doc, 'System & Audit Report', period);

        drawSectionTitle(doc, 'Personnel');
        doc.text(`Total User Accounts: ${userStats.total_users}`);
        doc.text(`Active Accounts: ${userStats.active_users}`);

        drawSectionTitle(doc, 'Cases');
        doc.text(`Total Cases: ${caseStats.total_cases}`);
        doc.text(`Active Cases: ${caseStats.active_cases}`);
        doc.text(`Closed Cases: ${caseStats.closed_cases}`);

        drawSectionTitle(doc, 'Personnel by Role');
        if (roleBreakdown.length === 0) {
            doc.text('No personnel records found.');
        } else {
            roleBreakdown.forEach(r => {
                doc.text(`${r.role || 'Unassigned'}: ${r.total} account(s)`);
            });
        }

        drawSectionTitle(doc, 'Audit Activity (Top Actions)');
        if (recentActivity.length === 0) {
            doc.text('No audit activity recorded for the selected period.');
        } else {
            recentActivity.forEach(a => {
                doc.text(`${a.action}: ${a.total} event(s)`);
            });
        }

        drawRestrictedFooter(doc);
        doc.end();
    } catch (err) {
        next(err);
    }
};
