import { useState, useEffect } from 'react';
import './Catalog.css';

const EMPTY_FORM = {
  codigo_producto: '',
  nombre_producto: '',
  tipo_producto: '',
  valor_compra: '',
  precio_venta: ''
};

export default function Catalog({ userRol, selectedSede }) {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [proveedor, setProveedor] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchProductos();
  }, [selectedSede, searchTerm]);

  useEffect(() => {
    fetchProveedor();
  }, []);

  const fetchProductos = async () => {
    try {
      const token = localStorage.getItem('token');
      const query = new URLSearchParams({ 
        sedeId: selectedSede || 'ALL',
        search: searchTerm
      });

      const res = await fetch(`http://localhost:3000/api/v1/productos?${query}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Error al cargar catálogo');
      const data = await res.json();
      setProductos(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProveedor = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:3000/api/v1/proveedores', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) return;
      const data = await res.json();
      setProveedor(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenModal = (producto = null) => {
    setError('');
    if (producto) {
      setEditingProduct(producto);
      setFormData({
        codigo_producto: producto.codigo_producto,
        nombre_producto: producto.nombre_producto,
        tipo_producto: producto.tipo_producto || '',
        valor_compra: producto.valor_compra ?? '',
        precio_venta: producto.precio_venta ?? ''
      });
    } else {
      setEditingProduct(null);
      setFormData(EMPTY_FORM);
    }
    setShowModal(true);
  };

  const saveProduct = async (confirmar) => {
    setError('');

    if (!proveedor) {
      setError('No hay un proveedor registrado. Debe existir uno antes de crear productos.');
      return;
    }

    const token = localStorage.getItem('token');
    const isEdit = !!editingProduct;

    const url = isEdit
      ? `http://localhost:3000/api/v1/productos/${editingProduct.id_producto}`
      : 'http://localhost:3000/api/v1/productos';
    const method = isEdit ? 'PUT' : 'POST';

    const payload = {
      id_proveedor: proveedor.id_proveedor,
      nombre_producto: formData.nombre_producto,
      tipo_producto: formData.tipo_producto,
      valor_compra: Number(formData.valor_compra),
      precio_venta: Number(formData.precio_venta)
    };

    if (!isEdit) {
      payload.codigo_producto = formData.codigo_producto;
      if (confirmar) payload.confirmar = true;
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
        // Advertencia: precio de venta <= valor de compra
        if (res.status === 409 && errData.warning) {
          if (window.confirm(errData.error)) {
            return saveProduct(true);
          }
          return;
        }
        throw new Error(errData.error || 'Error al guardar');
      }

      setShowModal(false);
      fetchProductos();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    saveProduct(false);
  };

  const handleToggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'Activo' ? 'Inactivo' : 'Activo';

    if (currentStatus === 'Activo') {
      if (!window.confirm('¿Está seguro de inactivar este producto?')) {
        return;
      }
    }

    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`http://localhost:3000/api/v1/productos/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ estado: newStatus })
      });
      if (res.ok) {
        fetchProductos();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="catalog-container">
      <div className="catalog-header">
        <h2>Catálogo de Productos {selectedSede === 'ALL' ? '(Global)' : '(Sede Específica)'}</h2>
        {userRol === 'Administrador' && (
          <button className="btn-primary" onClick={() => handleOpenModal()}>+ Nuevo Producto</button>
        )}
      </div>

      <div className="catalog-filters">
        <input 
          type="text" 
          placeholder="Buscar por nombre o código..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>

      {loading ? (
        <p>Cargando catálogo...</p>
      ) : (
        <table className="catalog-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Nombre</th>
              <th>Proveedor</th>
              <th>Precio Venta</th>
              <th>Existencias</th>
              <th>Estado</th>
              {userRol === 'Administrador' && <th>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {productos.map(p => (
              <tr key={p.id_producto} className={p.estado === 'Inactivo' ? 'row-inactive' : ''}>
                <td>{p.codigo_producto}</td>
                <td>{p.nombre_producto}</td>
                <td>{p.nombre_proveedor || 'Sin proveedor'}</td>
                <td>${Number(p.precio_venta).toLocaleString()}</td>
                <td>
                  <span className={`stock-badge ${Number(p.stock_total) > 0 ? 'stock-ok' : 'stock-zero'}`}>
                    {p.stock_total}
                  </span>
                </td>
                <td>
                  <span className={`status-badge ${p.estado.toLowerCase()}`}>{p.estado}</span>
                </td>
                {userRol === 'Administrador' && (
                  <td className="actions">
                    <button className="btn-icon" onClick={() => handleOpenModal(p)} title="Editar">✏️</button>
                    <button 
                      className="btn-icon" 
                      onClick={() => handleToggleStatus(p.id_producto, p.estado)}
                      title={p.estado === 'Activo' ? 'Inactivar' : 'Activar'}
                    >
                      {p.estado === 'Activo' ? '🚫' : '✅'}
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {productos.length === 0 && (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>
                  No se encontraron productos
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>{editingProduct ? 'Editar Producto' : 'Nuevo Producto'}</h3>
            {error && <div className="error-message">{error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Código</label>
                {editingProduct ? (
                  <input type="text" value={editingProduct.codigo_producto} readOnly disabled />
                ) : (
                  <input
                    type="text"
                    placeholder="Ej: PRD-300"
                    value={formData.codigo_producto}
                    onChange={e => setFormData({...formData, codigo_producto: e.target.value})}
                    required
                  />
                )}
              </div>

              <div className="form-group">
                <label>Nombre del Producto</label>
                <input
                  type="text"
                  value={formData.nombre_producto}
                  onChange={e => setFormData({...formData, nombre_producto: e.target.value})}
                  required
                />
              </div>

              <div className="form-group">
                <label>Tipo de Producto</label>
                <input
                  type="text"
                  list="tipos-producto"
                  placeholder="Ej: Cóctel, Cerveza..."
                  value={formData.tipo_producto}
                  onChange={e => setFormData({...formData, tipo_producto: e.target.value})}
                  required
                />
                <datalist id="tipos-producto">
                  <option value="Cóctel" />
                  <option value="Cóctel de autor" />
                  <option value="Cerveza" />
                  <option value="Licor" />
                  <option value="Comida" />
                  <option value="Bebida sin alcohol" />
                </datalist>
              </div>

              <div className="form-group">
                <label>Proveedor</label>
                <input
                  type="text"
                  value={proveedor ? proveedor.nombre_proveedor : 'Sin proveedor registrado'}
                  readOnly
                  disabled
                />
              </div>

              <div className="form-group">
                <label>Valor de Compra</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={formData.valor_compra}
                  onChange={e => setFormData({...formData, valor_compra: e.target.value})}
                  required
                />
              </div>

              <div className="form-group">
                <label>Valor de Venta</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={formData.precio_venta}
                  onChange={e => setFormData({...formData, precio_venta: e.target.value})}
                  required
                />
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