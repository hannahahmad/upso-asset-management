import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import AdminLoginPage from './pages/AdminLoginPage.jsx';
import UserLoginPage from './pages/UserLoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import AssetsPage from './pages/AssetsPage.jsx';
import AssetDetailPage from './pages/AssetDetailPage.jsx';
import LocationsPage from './pages/LocationsPage.jsx';
import ServiceRequestsPage from './pages/ServiceRequestsPage.jsx';
import ServiceRequestDetailPage from './pages/ServiceRequestDetailPage.jsx';
import AssetCreatePage from './pages/AssetCreatePage.jsx';
import ServiceRequestCreatePage from './pages/ServiceRequestCreatePage.jsx';
import ReportsPage from './pages/ReportsPage.jsx';
import UsersPage from './pages/UsersPage.jsx';
import UserHomePage from './pages/UserHomePage.jsx';
import UserComplaintCreatePage from './pages/UserComplaintCreatePage.jsx';
import UserComplaintStatusPage from './pages/UserComplaintStatusPage.jsx';
import Header from './components/Header.jsx';
import UserHeader from './components/UserHeader.jsx';
import { getStoredUser, clearAuth } from './api.js';

function App() {
  const [user, setUser] = useState(getStoredUser());
  const [loginPortal, setLoginPortal] = useState('admin');

  useEffect(() => {
    if (user) {
      localStorage.setItem('upso1_user', JSON.stringify(user));
    }
  }, [user]);

  const handleLogout = () => {
    clearAuth();
    setUser(null);
  };

  if (!user) {
    return loginPortal === 'admin'
      ? <AdminLoginPage onLogin={setUser} onSwitchToUser={() => setLoginPortal('user')} />
      : <UserLoginPage onLogin={setUser} onSwitchToAdmin={() => setLoginPortal('admin')} />;
  }

  if (user.role === 'User') {
    return (
      <div className="app-shell">
        <UserHeader user={user} onLogout={handleLogout} />
        <main className="content-main">
          <Routes>
            <Route path="/" element={<UserHomePage />} />
            <Route path="/complaints/new" element={<UserComplaintCreatePage />} />
            <Route path="/complaints/new/:assetId" element={<UserComplaintCreatePage />} />
            <Route path="/complaints" element={<UserComplaintStatusPage />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Header user={user} onLogout={handleLogout} />
      <main className="content-main">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/assets" element={<AssetsPage />} />
          <Route path="/assets/new" element={<AssetCreatePage />} />
          <Route path="/assets/:id" element={<AssetDetailPage />} />
          <Route path="/locations" element={<LocationsPage />} />
          <Route path="/service-requests" element={<ServiceRequestsPage />} />
          <Route path="/service-requests/new" element={<ServiceRequestCreatePage />} />
          <Route path="/service-requests/:id" element={<ServiceRequestDetailPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          {user.role === 'Administrator' && <Route path="/users" element={<UsersPage />} />}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
