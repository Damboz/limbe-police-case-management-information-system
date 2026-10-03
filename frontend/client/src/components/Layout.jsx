import { useCallback, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import Footer from './Footer';
import { downloadPdfReport } from '../api/client';
import { useToast } from '../context/ToastContext';


export default function Layout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const toast = useToast();

    const handleDownloadReport = useCallback(async (key) => {
        try {
            await downloadPdfReport(key);
        } catch (err) {
            toast.error(err.message || 'Could not download the report.');
        }
    }, [toast]);

    return (
        <div className="app-wrapper">
            <Sidebar
                open={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
                onDownloadReport={handleDownloadReport}
            />
            <div className="main-content">
                <Topbar onToggleSidebar={() => setSidebarOpen(v => !v)} />
                <main className="content-body">
                    <Outlet />
                </main>
                <Footer />
            </div>
        </div>
    );
}
