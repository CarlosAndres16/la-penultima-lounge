import { useState, useEffect } from 'react';
import Login from './components/Login';
import Navbar from './components/Navbar';
import UserManagement from './components/UserManagement';
import Catalog from './components/Catalog';

// ... (skip lines just by editing the right part)

function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedSede, setSelectedSede] = useState('ALL');

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      const parsed = JSON.parse(savedUser);
      setUser(parsed);
      if (parsed.rol !== 'Administrador') {
        setSelectedSede(parsed.id_sede);
      }
    }
  }, []);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    if (userData.rol !== 'Administrador') {
      setSelectedSede(userData.id_sede);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

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
          <button 
            onClick={() => setActiveTab('dashboard')}
            style={{ padding: '0.5rem 1rem', background: activeTab === 'dashboard' ? '#d4af37' : '#2a2a2a', color: activeTab === 'dashboard' ? '#000' : '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Dashboard
          </button>
          
          <button 
            onClick={() => setActiveTab('catalog')}
            style={{ padding: '0.5rem 1rem', background: activeTab === 'catalog' ? '#d4af37' : '#2a2a2a', color: activeTab === 'catalog' ? '#000' : '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Catálogo
          </button>

          {user.rol === 'Administrador' && (
            <button 
              onClick={() => setActiveTab('users')}
              style={{ padding: '0.5rem 1rem', background: activeTab === 'users' ? '#d4af37' : '#2a2a2a', color: activeTab === 'users' ? '#000' : '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              Usuarios
            </button>
          )}
        </div>

        {activeTab === 'dashboard' && (
          <div>
            <h2>Panel Principal</h2>
            <p>Bienvenido al sistema multisede, {user.nombre_completo}.</p>
            <p>Tu rol es: <strong>{user.rol}</strong></p>
          </div>
        )}

        {activeTab === 'users' && user.rol === 'Administrador' && (
          <UserManagement />
        )}
        
        {activeTab === 'catalog' && (
          <Catalog userRol={user.rol} selectedSede={selectedSede} />
        )}
      </main>
    </div>
  );
}

export default App;
