import { useState, useEffect } from 'react';
import './UserManagement.css';
import { t, ROLE_LABEL, STATUS_LABEL } from '../i18n';

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  
  // Form State
  const [formData, setFormData] = useState({
    codigo_usuario: '',
    nombre_completo: '',
    username: '',
    password: '',
    id_rol: '1', // Default: Waiter
    id_sede: '1',
    estado: 'Activo'
  });

  const [error, setError] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:3000/api/v1/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load users');
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (user = null) => {
    setError('');
    if (user) {
      setEditingUser(user);
      setFormData({
        codigo_usuario: user.codigo_usuario,
        nombre_completo: user.nombre_completo,
        username: user.username,
        password: '', // When editing, leave empty so the password is not overwritten unless something is typed
        id_rol: user.id_rol,
        id_sede: user.id_sede || '',
        estado: user.estado
      });
    } else {
      setEditingUser(null);
      setFormData({
        codigo_usuario: '',
        nombre_completo: '',
        username: '',
        password: '',
        id_rol: '1',
        id_sede: '1',
        estado: 'Activo'
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const token = localStorage.getItem('token');
    const isEdit = !!editingUser;
    
    const url = isEdit 
      ? `http://localhost:3000/api/v1/users/${editingUser.id_usuario}`
      : 'http://localhost:3000/api/v1/users';
      
    const method = isEdit ? 'PUT' : 'POST';

    const payload = { ...formData };
    // If editing and the password is empty, do not send it
    if (isEdit && !payload.password) {
      delete payload.password;
    }

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to save');
      }

      setShowModal(false);
      fetchUsers();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleToggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'Activo' ? 'Inactivo' : 'Activo';
    if (currentStatus === 'Activo') {
      if (!window.confirm('Are you sure you want to deactivate this user? They will lose their session immediately.')) {
        return;
      }
    }

    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`http://localhost:3000/api/v1/users/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ estado: newStatus })
      });
      if (!res.ok) {
        const errData = await res.json();
        alert(errData.error);
        return;
      }
      fetchUsers();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div>Loading users...</div>;

  return (
    <div className="users-container">
      <div className="users-header">
        <h2>User Management</h2>
        <button className="btn-primary" onClick={() => handleOpenModal()}>+ New User</button>
      </div>

      <table className="users-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Full Name</th>
            <th>Username</th>
            <th>Role</th>
            <th>Assigned Branch</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id_usuario}>
              <td>{u.codigo_usuario}</td>
              <td>{u.nombre_completo}</td>
              <td>{u.username}</td>
              <td>{t(ROLE_LABEL, u.nombre_rol)}</td>
              <td>{u.nombre_sede || 'N/A'}</td>
              <td>
                <span className={`status-badge ${u.estado.toLowerCase()}`}>{t(STATUS_LABEL, u.estado)}</span>
              </td>
              <td className="actions">
                <button className="btn-icon" onClick={() => handleOpenModal(u)} title="Edit">✏️</button>
                <button 
                  className="btn-icon" 
                  onClick={() => handleToggleStatus(u.id_usuario, u.estado)}
                  title={u.estado === 'Activo' ? 'Deactivate' : 'Activate'}
                >
                  {u.estado === 'Activo' ? '🚫' : '✅'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>{editingUser ? 'Edit User' : 'New User'}</h3>
            {error && <div className="error-message">{error}</div>}
            
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Code</label>
                {editingUser ? (
                  <input type="text" value={editingUser.codigo_usuario} readOnly disabled />
                ) : (
                  <input
                    type="text"
                    placeholder="e.g. USR-010"
                    value={formData.codigo_usuario}
                    onChange={e => setFormData({...formData, codigo_usuario: e.target.value})}
                    required
                  />
                )}
              </div>

              <div className="form-group">
                <label>Full Name</label>
                <input 
                  type="text" 
                  value={formData.nombre_completo} 
                  onChange={e => setFormData({...formData, nombre_completo: e.target.value})} 
                  required 
                />
              </div>

              <div className="form-group">
                <label>Username</label>
                <input 
                  type="text" 
                  value={formData.username} 
                  onChange={e => setFormData({...formData, username: e.target.value})} 
                  readOnly={!!editingUser} 
                  disabled={!!editingUser}
                  required 
                />
              </div>

              <div className="form-group">
                <label>Password {editingUser && '(Optional: leave blank to keep current)'}</label>
                <input 
                  type="password" 
                  value={formData.password} 
                  onChange={e => setFormData({...formData, password: e.target.value})} 
                  required={!editingUser} 
                  placeholder="Min 8 chars, 1 letter, 1 number"
                />
              </div>

              <div className="form-group">
                <label>Role</label>
                <select 
                  value={formData.id_rol} 
                  onChange={e => setFormData({...formData, id_rol: e.target.value})}
                >
                  <option value="1">{ROLE_LABEL.Mesero}</option>
                  <option value="2">{ROLE_LABEL.Cajero}</option>
                  <option value="3">{ROLE_LABEL.Administrador}</option>
                </select>
              </div>

              <div className="form-group">
                <label>Assigned Branch</label>
                {/* Ideally branches would be fetched dynamically; mock for now: */}
                <select 
                  value={formData.id_sede} 
                  onChange={e => setFormData({...formData, id_sede: e.target.value})}
                >
                  <option value="">None</option>
                  <option value="1">La Penúltima — Zona Rosa</option>
                  <option value="2">La Penúltima — Chapinero</option>
                </select>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}