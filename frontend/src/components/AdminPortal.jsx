import { appUrl } from '../config.js';
import AdminPage from '../pages/AdminPage.jsx';
import SystemSettingsPage from '../pages/SystemSettingsPage.jsx';
import '../admin-portal.css';

export default function AdminPortal({ section = 'editorial' }) {
  return (
    <>
      <div className="admin-portal-switcher">
        <div className="container admin-portal-switcher-inner">
          <strong>TechWissen Admin</strong>
          <nav aria-label="Admin-Hauptbereiche">
            <a className={section === 'editorial' ? 'active' : ''} href={appUrl('/admin')}>Redaktion</a>
            <a className={section === 'system' ? 'active' : ''} href={appUrl('/admin/system')}>Systemeinstellungen</a>
          </nav>
        </div>
      </div>
      {section === 'system' ? <SystemSettingsPage /> : <AdminPage />}
    </>
  );
}
