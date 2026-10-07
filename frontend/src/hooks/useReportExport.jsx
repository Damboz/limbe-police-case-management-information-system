import { useCallback, useState } from 'react';
import { downloadPdfReport } from '../api/client';
import { useToast } from '../context/ToastContext';
import ReportPeriodModal from '../components/ReportPeriodModal';


// Every PDF export goes through this hook so the user picks a period
// (daily / weekly / monthly / yearly / all time) before the download starts.
export default function useReportExport(defaultTitle) {
    const toast = useToast();
    const [pendingKey, setPendingKey] = useState(null);
    const [busy, setBusy] = useState(false);

    const requestReport = useCallback((key) => setPendingKey(key), []);

    const close = useCallback(() => {
        if (!busy) setPendingKey(null);
    }, [busy]);

    const generate = useCallback(async (period) => {
        setBusy(true);
        try {
            await downloadPdfReport(pendingKey, { period });
        } catch (err) {
            toast.error(err.message || 'Could not download the report.');
        } finally {
            setBusy(false);
            setPendingKey(null);
        }
    }, [pendingKey, toast]);

    const modal = pendingKey ? (
        <ReportPeriodModal
            title={defaultTitle}
            busy={busy}
            onGenerate={generate}
            onClose={close}
        />
    ) : null;

    return { requestReport, modal, busy };
}
