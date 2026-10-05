import { useState, useEffect } from 'react';
import './Navbar.css';

export default function Navbar({ user, onLogout, selectedSede, setSelectedSede }) {
  const [sedes, setSedes] = useState([]);

  useEffect(() => {
    if (user && user.rol === 'Administrador') {
      fetchSedes();
    }
  }, [user]);

  const fetchSedes = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:3000/api/v1/sedes', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Error fetch sedes');
      const data = await res.json();
      setSedes(data);
    } catch (error) {
      console.error('Error fetching sedes:', error);
    }
  };

  const handleSedeChange = (e) => {
    setSelectedSede(e.target.value);
  };

  if (!user) return null;

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <h2>🍸 La Penúltima</h2>
      </div>

      <div className="navbar-center">
        {user.rol === 'Administrador' ? (
          <div className="branch-selector">
            <label htmlFor="sede-select">Sede:</label>
            <select 
              id="sede-select" 
              value={selectedSede} 
              onChange={handleSedeChange}
              className="dropdown"
            >
              <option value="ALL">Todas las sedes</option>
              {sedes.map((sede) => (
                <option key={sede.id_sede} value={sede.id_sede}>
                  {sede.nombre_sede}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="branch-fixed">
            <span className="badge">Sede: {user.sede_nombre || 'Asignada'}</span>
          </div>
        )}
      </div>

      <div className="navbar-right">
        <span className="user-info">
          {user.nombre_completo} <small>({user.rol})</small>
        </span>
        <button onClick={onLogout} className="logout-btn">Salir</button>
      </div>
    </nav>
  );
}
