import { useState, useEffect } from 'react';
import './Navbar.css';
import { t, ROLE_LABEL } from '../i18n';

/**
 * Navbar component displays navigation bar with branch selector for administrators.
 *
 * @param {Object} props
 * @param {Object} props.user - User object containing authentication details.
 * @param {Function} props.onLogout - Callback to trigger logout.
 * @param {string} props.selectedSede - Currently selected branch identifier.
 * @param {Function} props.setSelectedSede - Setter for selected branch.
 */
export default function Navbar({ user, onLogout, selectedSede, setSelectedSede }) {
  const [sedes, setSedes] = useState([]);

  // Destructure and rename Spanish user properties to English-friendly names.
  const {
    nombre_completo: fullName,
    rol: role,
    sede_nombre: branchName,
  } = user || {};

  useEffect(() => {
    if (user && role === 'Administrador') {
      fetchSedes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  /** Fetch list of branches (sedes) for administrators */
  const fetchSedes = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:3000/api/v1/sedes', {
        headers: { Authorization: `Bearer ${token}` },
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
        {role === 'Administrador' ? (
          <div className="branch-selector">
            <label htmlFor="sede-select">Branch:</label>
            <select
              id="sede-select"
              value={selectedSede}
              onChange={handleSedeChange}
              className="dropdown"
            >
              <option value="ALL">All branches</option>
              {sedes.map((sede) => (
                <option key={sede.id_sede} value={sede.id_sede}>
                  {sede.nombre_sede}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="branch-fixed">
            <span className="badge">Branch: {branchName || 'Assigned'}</span>
          </div>
        )}
      </div>

      <div className="navbar-right">
        <span className="user-info">
          {fullName} <small>({t(ROLE_LABEL, role)})</small>
        </span>
        <button onClick={onLogout} className="logout-btn">Log out</button>
      </div>
    </nav>
  );
}

