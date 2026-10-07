// Sedes.jsx - cleaned up
import React from 'react';
import { useState, useEffect } from 'react';
import './Sedes.css';
import Toast from './Toast';
import { t, STATUS_LABEL } from '../i18n';

/** Helper to extract role from JWT */
const getUserRole = (token) => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.rol || payload.role || '';
  } catch (e) {
    return '';
  }
};

/**
 * Sedes component – manages branch (sede) CRUD operations.
 * Adjusted for HU‑02: Cajero can only view its own sede (read‑only).
 */
export default function Sedes() {
  const [sedes, setSedes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSede, setEditingSede] = useState(null);
  const [formData, setFormData] = useState({ codigo_sede: '', nombre_sede: '', direccion: '' });
  const [error, setError] = useState('');
  const [userRole, setUserRole] = useState('');
  const [toast, setToast] = useState(null);

  /** Load branches from the appropriate API based on role */
  const fetchSedes = async () => {
    try {
      const token = localStorage.getItem('token');
      const role = getUserRole(token);
      setUserRole(role);
      const endpoint = role === 'Cajero' ? '/api/v1/sedes/mia' : '/api/v1/sedes';
      const res = await fetch(`http://localhost:3000${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to fetch branches');
      }
      const data = await res.json();
      setSedes(data);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSedes();
  }, []);

  const openModal = (sede = null) => {
    setError('');
    if (sede) {
      setEditingSede(sede);
      setFormData({
        codigo_sede: sede.codigo_sede,
        nombre_sede: sede.nombre_sede,
        direccion: sede.direccion,
      });
    } else {
      setEditingSede(null);
      setFormData({ codigo_sede: '', nombre_sede: '', direccion: '' });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingSede(null);
    setFormData({ codigo_sede: '', nombre_sede: '', direccion: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const token = localStorage.getItem('token');
    const isEdit = !!editingSede;
    const url = isEdit
      ? `http://localhost:3000/api/v1/sedes/${editingSede.id_sede}`
      : 'http://localhost:3000/api/v1/sedes';
    const method = isEdit ? 'PUT' : 'POST';
    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to save branch');
      }
      closeModal();
      fetchSedes();
    } catch (err) {
      setError(err.message);
    }
  };

  // Toggle activation status (activate / deactivate)
  const toggleBranchStatus = async (sede) => {
    const token = localStorage.getItem('token');
    const newEstado = sede.estado === 'Activo' ? 'Inactivo' : 'Activo';
    try {
      const payload = { ...sede, estado: newEstado };
      const res = await fetch(`http://localhost:3000/api/v1/sedes/${sede.id_sede}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || `Failed to ${newEstado === 'Activo' ? 'activate' : 'deactivate'}`);
      }
      fetchSedes();
      setToast({
        message: `Branch ${newEstado === 'Activo' ? 'reactivated' : 'deactivated'} successfully`,
        type: 'success',
      });
    } catch (err) {
      console.error(err);
      setToast({ message: err.message, type: 'error' });
    }
  };

  if (loading) return <div className="sedes-loading">Loading branches...</div>;

  return (
    <div className="sedes-container">
      <div className="sedes-header">
        <h2>Branch Management</h2>
        {userRole === 'Administrador' && (
          <button className="btn-primary" onClick={() => openModal()}>+ New Branch</button>
        )}
      </div>

      <table className="sedes-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Code</th>
            <th>Name</th>
            <th>Address</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sedes.map((s) => (
            <tr key={s.id_sede} className={s.estado === 'Inactivo' ? 'row-inactive' : ''}>
              <td>{s.id_sede}</td>
              <td>{s.codigo_sede}</td>
              <td>{s.nombre_sede}</td>
              <td>{s.direccion}</td>
              <td><span className={`status-badge ${s.estado.toLowerCase()}`}>{t(STATUS_LABEL, s.estado)}</span></td>
              <td className="actions">
                {userRole === 'Administrador' && (
                  <>
                    <button className="btn-icon" onClick={() => openModal(s)} title="Edit">✏️</button>
                    <button className="btn-icon" onClick={() => toggleBranchStatus(s)} title={s.estado === 'Activo' ? 'Deactivate' : 'Activate'}>{s.estado === 'Activo' ? '🚫' : '✅'}</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>{editingSede ? 'Edit Branch' : 'New Branch'}</h3>
            {error && <div className="error-message">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Code</label>
                <input
                  type="text"
                  value={formData.codigo_sede}
                  onChange={(e) => setFormData({ ...formData, codigo_sede: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  value={formData.nombre_sede}
                  onChange={(e) => setFormData({ ...formData, nombre_sede: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Address</label>
                <input
                  type="text"
                  value={formData.direccion}
                  onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                  required
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
