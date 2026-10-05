import { useState, useEffect } from 'react';
import './UserManagement.css';

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  
  // Form State
  const [formData, setFormData] = useState({
    nombre_completo: '',
    username: '',
    password: '',
    id_rol: '1', // Default a Mesero o Cajero
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
      if (!res.ok) throw new Error('Error al cargar usuarios');
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
        nombre_completo: user.nombre_completo,
        username: user.username,
        password: '', // En edición, la contraseña viene vacía para no sobrescribir a menos que se escriba algo
        id_rol: user.id_rol,
        id_sede: user.id_sede || '',
        estado: user.estado
      });
    } else {
      setEditingUser(null);
      setFormData({
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
    // Si editamos y la clave está vacía, no la enviamos
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
        throw new Error(errData.error || 'Error al guardar');
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
      if (!window.confirm('¿Está seguro de inactivar este usuario? Perderá su sesión inmediatamente.')) {
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

  if (loading) return <div>Cargando usuarios...</div>;

  return (
    <div className="users-container">
      <div className="users-header">
        <h2>Gestión de Usuarios</h2>
        <button className="btn-primary" onClick={() => handleOpenModal()}>+ Nuevo Usuario</button>
      </div>

      <table className="users-table">
        <thead>
          <tr>
            <th>Código</th>
            <th>Nombre Completo</th>
            <th>Usuario</th>
            <th>Rol</th>
            <th>Sede Asignada</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id_usuario}>
              <td>USR-{u.id_usuario.toString().padStart(3, '0')}</td>
              <td>{u.nombre_completo}</td>
              <td>{u.username}</td>
              <td>{u.nombre_rol}</td>
              <td>{u.nombre_sede || 'N/A'}</td>
              <td>
                <span className={`status-badge ${u.estado.toLowerCase()}`}>{u.estado}</span>
              </td>
              <td className="actions">
                <button className="btn-icon" onClick={() => handleOpenModal(u)}>✏️</button>
                <button 
                  className="btn-icon" 
                  onClick={() => handleToggleStatus(u.id_usuario, u.estado)}
                  title={u.estado === 'Activo' ? 'Inactivar' : 'Activar'}
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
            <h3>{editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>
            {error && <div className="error-message">{error}</div>}
            
            <form onSubmit={handleSubmit}>
              {editingUser && (
                <div className="form-group">
                  <label>Código</label>
                  <input type="text" value={`USR-${editingUser.id_usuario.toString().padStart(3, '0')}`} readOnly disabled />
                </div>
              )}

              <div className="form-group">
                <label>Nombre Completo</label>
                <input 
                  type="text" 
                  value={formData.nombre_completo} 
                  onChange={e => setFormData({...formData, nombre_completo: e.target.value})} 
                  required 
                />
              </div>

              <div className="form-group">
                <label>Usuario</label>
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
                <label>Contraseña {editingUser && '(Opcional: Dejar en blanco para no cambiar)'}</label>
                <input 
                  type="password" 
                  value={formData.password} 
                  onChange={e => setFormData({...formData, password: e.target.value})} 
                  required={!editingUser} 
                  placeholder="Min 8 chars, 1 letra, 1 número"
                />
              </div>

              <div className="form-group">
                <label>Rol</label>
                <select 
                  value={formData.id_rol} 
                  onChange={e => setFormData({...formData, id_rol: e.target.value})}
                >
                  <option value="1">Mesero</option>
                  <option value="2">Cajero</option>
                  <option value="3">Administrador</option>
                </select>
              </div>

              <div className="form-group">
                <label>Sede Asignada</label>
                {/* Lo ideal sería traer sedes dinámicamente, por ahora mock: */}
                <select 
                  value={formData.id_sede} 
                  onChange={e => setFormData({...formData, id_sede: e.target.value})}
                >
                  <option value="">Ninguna</option>
                  <option value="1">La Penúltima — Zona Rosa</option>
                  <option value="2">La Penúltima — Chapinero</option>
                </select>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn-primary">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
