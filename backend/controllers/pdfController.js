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
                    .text(`${c.ob_number} — ${c.crime_category || 'Uncategorised'} (${c.status})`);
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
                COUNT(*) AS totalCases,
                COALESCE(SUM(CASE WHEN status = 'Closed' THEN 1 ELSE 0 END), 0) AS closedCases,
                COALESCE(SUM(CASE WHEN status NOT IN ('Closed', 'Archived') THEN 1 ELSE 0 END), 0) AS activeCases,
                COALESCE(SUM(CASE WHEN status = 'Under Investigation' AND CURRENT_DATE - created_at::date > ${OVERDUE_DAYS_THRESHOLD} THEN 1 ELSE 0 END), 0) AS overdueCases
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
            WHERE u.role IN ('Investigating Officer', 'investigator') AND u.is_active = 1
            GROUP BY u.id
            ORDER BY active_cases DESC
        `, inWindowAnd.params);

        const resolutionRate = totals.totalCases > 0
            ? ((totals.closedCases / totals.totalCases) * 100).toFixed(1)
            : '0.0';

        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${reportFileName('Station_Performance_Report', period)}"`);
        doc.pipe(res);

        drawReportHeader(doc, 'Station Performance Report', period);

        drawSectionTitle(doc, 'Overview');
        doc.text(`Total Cases Recorded: ${totals.totalCases}`);
        doc.text(`Closed Cases: ${totals.closedCases}`);
        doc.text(`Active Cases: ${totals.activeCases}`);
        doc.text(`Overdue Cases (${OVERDUE_DAYS_THRESHOLD}+ days under investigation): ${totals.overdueCases}`);
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
            WHERE u.role IN ('Investigating Officer', 'investigator') AND u.is_active = 1
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
