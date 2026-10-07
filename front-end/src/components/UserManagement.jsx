import { useState, useEffect } from 'react';
import './UserManagement.css';
import { t, ROLE_LABEL, STATUS_LABEL } from '../i18n';
import Toast from './Toast';

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  // Form State
  const [branches, setBranches] = useState([]);
  const [formData, setFormData] = useState({
    nombre_completo: '',
    username: '',
    password: '',
    id_rol: '1', // Default: Waiter
    id_sede: '1',
    estado: 'Activo'
  });

  const [error, setError] = useState('');
  // Toast state for UX-friendly notifications
  const [toast, setToast] = useState(null);

  // Load users and branches on mount
  useEffect(() => {
    fetchUsers();
    const fetchBranches = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('http://localhost:3000/api/v1/sedes', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to load branches');
        const data = await res.json();
        setBranches(data);
      } catch (err) {
        console.error(err);
        setToast({ message: err.message, type: 'error' });
      }
    };
    fetchBranches();
  }, []);

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:3000/api/v1/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load users');
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      console.error(err);
      setToast({ message: err.message, type: 'error' });
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
        password: '', // keep empty unless changed
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
    if (isEdit && !payload.password) delete payload.password;
    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to save');
      }
      setShowModal(false);
      fetchUsers();
      setToast({
        message: isEdit ? 'User updated successfully' : 'User created successfully',
        type: 'success'
      });
    } catch (err) {
      setError(err.message);
    }
  };

  const handleToggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'Activo' ? 'Inactivo' : 'Activo';
    // Directly proceed with status toggle without native confirmation alert.
    // If confirmation is needed, implement a custom modal/dialog in future.
    // For now, we skip the window.confirm step.
    // (No additional code needed here)
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`http://localhost:3000/api/v1/users/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ estado: newStatus })
      });
      if (!res.ok) {
        const errData = await res.json();
        setToast({ message: errData.error || 'Failed to change status', type: 'error' });
        return;
      }
      fetchUsers();
      setToast({
        message: `User ${newStatus === 'Activo' ? 'activated' : 'deactivated'} successfully`,
        type: 'success'
      });
    } catch (err) {
      console.error(err);
      setToast({ message: err.message, type: 'error' });
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
            <th>Full Names</th>
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
              <td><span className={`status-badge ${u.estado.toLowerCase()}`}>{t(STATUS_LABEL, u.estado)}</span></td>
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
                <label>Full Names</label>
                <input
                  type="text"
                  value={formData.nombre_completo}
                  onChange={e => setFormData({ ...formData, nombre_completo: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Username</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={e => setFormData({ ...formData, username: e.target.value })}
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
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  required={!editingUser}
                  placeholder="Min 8 chars, 1 letter, 1 number"
                />
              </div>

              <div className="form-group">
                <label>Role</label>
                <select
                  value={formData.id_rol}
                  onChange={e => setFormData({ ...formData, id_rol: e.target.value })}
                >
                  <option value="1">{ROLE_LABEL.Mesero}</option>
                  <option value="2">{ROLE_LABEL.Cajero}</option>
                  <option value="3">{ROLE_LABEL.Administrador}</option>
                </select>
              </div>

              <div className="form-group">
                <label>Assigned Branch</label>
                <select
                  value={formData.id_sede}
                  onChange={e => setFormData({ ...formData, id_sede: e.target.value })}
                >
                  <option value="">None</option>
                  {branches.map(branch => (
                    <option key={branch.id_sede} value={branch.id_sede}>{branch.nombre_sede}</option>
                  ))}
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

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}