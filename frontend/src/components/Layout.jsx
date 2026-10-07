import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import Footer from './Footer';
import useReportExport from '../hooks/useReportExport';


export default function Layout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { requestReport, modal } = useReportExport('Generate Report');

    return (
        <div className="app-wrapper">
            <Sidebar
                open={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
                onDownloadReport={requestReport}
            />
            <div className="main-content">
                <Topbar onToggleSidebar={() => setSidebarOpen(v => !v)} />
                <main className="content-body">
                    <Outlet />
                </main>
                <Footer />
            </div>
            {modal}
        </div>
    );
}
