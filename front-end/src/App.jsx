import { useState, useEffect } from 'react';
import Login from './components/Login';
import Navbar from './components/Navbar';
import UserManagement from './components/UserManagement';
import Catalog from './components/Catalog';
import Tables from './components/Tables';
import Sedes from './components/Sedes';
import Restock from './components/Restock';
import { t, ROLE_LABEL } from './i18n';
import { logout } from './utils/auth';

function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedSede, setSelectedSede] = useState('ALL');

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
      await logout(); // invalidate session on server
    } catch (e) {
      console.error('Logout failed:', e);
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  const tabStyle = (tab) => ({
    padding: '0.5rem 1rem',
    background: activeTab === tab ? '#d4af37' : '#2a2a2a',
    color: activeTab === tab ? '#000' : '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  });

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#121212', color: '#fff' }}>
      <Navbar 
        user={user} 
        onLogout={handleLogout} 
        selectedSede={selectedSede} 
        setSelectedSede={setSelectedSede} 
      />
      
      <main style={{ padding: '2rem' }}>
        <div style={{ marginBottom: '2rem', display: 'flex', gap: '1rem' }}>
          <button onClick={() => setActiveTab('dashboard')} style={tabStyle('dashboard')}>
            Dashboard
          </button>

          <button onClick={() => setActiveTab('catalog')} style={tabStyle('catalog')}>
            Catalog
          </button>

          <button onClick={() => setActiveTab('tables')} style={tabStyle('tables')}>
            Tables
          </button>

          {(user.rol === 'Administrador' || user.rol === 'Cajero') && (
            <button onClick={() => setActiveTab('restock')} style={tabStyle('restock')}>
              Restock
            </button>
          )}

          {user.rol === 'Administrador' && (
            <> 
              <button onClick={() => setActiveTab('users')} style={tabStyle('users')}>Users</button>
              <button onClick={() => setActiveTab('sedes')} style={tabStyle('sedes')}>Branches</button>
            </>
          )}
        </div>

        {activeTab === 'dashboard' && (
          <div>
            <h2>Main Dashboard</h2>
            <p>Welcome to the multi-branch system, {user.nombre_completo}.</p>
            <p>Your role is: <strong>{t(ROLE_LABEL, user.rol)}</strong></p>
          </div>
        )}

        {activeTab === 'users' && user.rol === 'Administrador' && (
          <UserManagement />
        )}
        
        {activeTab === 'catalog' && (
          <Catalog userRol={user.rol} selectedSede={selectedSede} />
        )}

        {activeTab === 'tables' && (
          <Tables userRol={user.rol} selectedSede={selectedSede} />
        )}
        {activeTab === 'sedes' && (
          <Sedes />
        )}

        {activeTab === 'restock' && (user.rol === 'Administrador' || user.rol === 'Cajero') && (
          <Restock userRol={user.rol} selectedSede={selectedSede} />
        )}
      </main>
    </div>
  );
}

export default App;