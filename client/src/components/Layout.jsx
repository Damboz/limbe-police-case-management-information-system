import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import Footer from './Footer';


export default function Layout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="app-wrapper">
            <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
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
