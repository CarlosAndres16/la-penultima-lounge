import { useState, useEffect } from 'react';
import Login from './components/Login';
import Navbar from './components/Navbar';
import UserManagement from './components/UserManagement';
import Catalog from './components/Catalog';
import Tables from './components/Tables';
import Sedes from './components/Sedes';
import Restock from './components/Restock';
import RestockHistory from './components/RestockHistory';
import ShiftOrders from './components/ShiftOrders';
import SalesReport from './components/SalesReport';
import ConsolidatedReport from './components/ConsolidatedReport';
import OrderEntry from './components/OrderEntry';
import Invoices from './components/Invoices';
import { t, ROLE_LABEL } from './i18n';
import { logout } from './utils/auth';
import './components/Navigation.css';

function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedSede, setSelectedSede] = useState('ALL');
  const [activeOrder, setActiveOrder] = useState(null);

  // Load persisted user and map Spanish fields to English‑friendly aliases
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      const parsed = JSON.parse(savedUser);
      const { nombre_completo: fullName, rol: role, id_sede: branchId } = parsed;
      const userWithAliases = { ...parsed, fullName, role, branchId };
      setUser(userWithAliases);
      if (role !== 'Administrador') {
        setSelectedSede(branchId);
      }
    }
  }, []);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    if (userData.rol !== 'Administrador') {
      setSelectedSede(userData.id_sede);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (e) {
      console.error('Logout failed:', e);
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setActiveOrder(null);
    setUser(null);
  };

  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  const isCashierOrAdmin = user.rol === 'Administrador' || user.rol === 'Cajero';
  const isAdmin = user.rol === 'Administrador';

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#121212', color: '#fff' }}>
      <Navbar 
        user={user} 
        onLogout={handleLogout} 
        selectedSede={selectedSede} 
        setSelectedSede={setSelectedSede} 
      />

      {/* Styled Modern Subnavigation Bar */}
      <div className="app-subnav-container">
        <div className="app-subnav-wrapper">
          {/* Main Group */}
          <div className="app-subnav-group">
            <span className="app-subnav-label">General</span>
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`app-nav-pill ${activeTab === 'dashboard' ? 'active' : ''}`}
            >
              <span>Dashboard</span>
            </button>
            <button
              onClick={() => setActiveTab('tables')}
              className={`app-nav-pill ${activeTab === 'tables' || activeTab === 'order' ? 'active' : ''}`}
            >
              <span>Tables</span>
            </button>
            <button
              onClick={() => setActiveTab('catalog')}
              className={`app-nav-pill ${activeTab === 'catalog' ? 'active' : ''}`}
            >
              <span>Catalog</span>
            </button>
          </div>

          {/* Operations Group */}
          {isCashierOrAdmin && (
            <div className="app-subnav-group">
              <span className="app-subnav-label">Operations</span>
              <button
                onClick={() => setActiveTab('shifts')}
                className={`app-nav-pill ${activeTab === 'shifts' ? 'active' : ''}`}
              >
                <span>Shift Orders</span>
              </button>
              <button
                onClick={() => setActiveTab('invoices')}
                className={`app-nav-pill ${activeTab === 'invoices' ? 'active' : ''}`}
              >
                <span>Closed Orders</span>
              </button>
              <button
                onClick={() => setActiveTab('restock')}
                className={`app-nav-pill ${activeTab === 'restock' ? 'active' : ''}`}
              >
                <span>Restock</span>
              </button>
              <button
                onClick={() => setActiveTab('restock-history')}
                className={`app-nav-pill ${activeTab === 'restock-history' ? 'active' : ''}`}
              >
                <span>Restock History</span>
              </button>
            </div>
          )}

          {/* Reports & Analytics Group */}
          {isCashierOrAdmin && (
            <div className="app-subnav-group">
              <span className="app-subnav-label">Reports</span>
              <button
                onClick={() => setActiveTab('sales-report')}
                className={`app-nav-pill ${activeTab === 'sales-report' ? 'active' : ''}`}
              >
                <span>Sales Report</span>
              </button>

              {isAdmin && (
                <button
                  onClick={() => setActiveTab('consolidated')}
                  className={`app-nav-pill ${activeTab === 'consolidated' ? 'active' : ''}`}
                >
                  <span>Multi-location Consolidated</span>
                </button>
              )}
            </div>
          )}

          {/* Administration Group */}
          {isAdmin && (
            <div className="app-subnav-group">
              <span className="app-subnav-label">Configuration</span>
              <button
                onClick={() => setActiveTab('users')}
                className={`app-nav-pill ${activeTab === 'users' ? 'active' : ''}`}
              >
                <span>Users</span>
              </button>
              <button
                onClick={() => setActiveTab('sedes')}
                className={`app-nav-pill ${activeTab === 'sedes' ? 'active' : ''}`}
              >
                <span>Branches</span>
              </button>
            </div>
          )}
        </div>
      </div>
      
      <main className="app-main-content">
        {activeTab === 'dashboard' && (
          <div style={{ background: '#1a1a1a', padding: '2rem', borderRadius: '8px', border: '1px solid #3d2c23' }}>
            <h2 style={{ color: '#d4af37', margin: 0 }}>Main Dashboard</h2>
            <p style={{ color: '#c9c2b5', marginTop: '0.5rem' }}>
              Welcome to the multi-branch system, <strong>{user.nombre_completo}</strong>.
            </p>
            <p style={{ color: '#a89f91' }}>
              Your role is: <span style={{ color: '#d4af37', fontWeight: 600 }}>{t(ROLE_LABEL, user.rol)}</span>
            </p>
          </div>
        )}

        {activeTab === 'users' && isAdmin && (
          <UserManagement />
        )}
        
        {activeTab === 'catalog' && (
          <Catalog userRol={user.rol} selectedSede={selectedSede} />
        )}

        {activeTab === 'tables' && (
          <Tables
            userRol={user.rol}
            selectedSede={selectedSede}
            onOpenOrder={(order) => {
              setActiveOrder(order);
              setActiveTab('order');
            }}
          />
        )}

        {activeTab === 'order' && activeOrder && (
          <OrderEntry
            key={activeOrder.id_pedido}
            order={activeOrder}
            userRol={user.rol}
            onBack={() => setActiveTab('tables')}
          />
        )}

        {activeTab === 'sedes' && isAdmin && (
          <Sedes />
        )}

        {activeTab === 'invoices' && isCashierOrAdmin && (
          <Invoices selectedSede={selectedSede} />
        )}

        {activeTab === 'restock' && isCashierOrAdmin && (
          <Restock userRol={user.rol} selectedSede={selectedSede} />
        )}

        {/* HU-30 */}
        {activeTab === 'restock-history' && isCashierOrAdmin && (
          <RestockHistory userRol={user.rol} selectedSede={selectedSede} />
        )}

        {/* HU-31 */}
        {activeTab === 'shifts' && isCashierOrAdmin && (
          <ShiftOrders userRol={user.rol} selectedSede={selectedSede} />
        )}

        {/* HU-32 & HU-33 */}
        {activeTab === 'sales-report' && isCashierOrAdmin && (
          <SalesReport userRol={user.rol} selectedSede={selectedSede} />
        )}

        {/* HU-34 */}
        {activeTab === 'consolidated' && isAdmin && (
          <ConsolidatedReport />
        )}
      </main>
    </div>
  );
}

export default App;
