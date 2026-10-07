import { useState, useEffect } from 'react';
import './Catalog.css';
import { t, STATUS_LABEL } from '../i18n';

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
      if (!res.ok) throw new Error('Failed to load catalog');
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
      setError('No supplier is registered. One must exist before creating products.');
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
        // Warning: sale price <= cost price
        if (res.status === 409 && errData.warning) {
          if (window.confirm(errData.error)) {
            return saveProduct(true);
          }
          return;
        }
        throw new Error(errData.error || 'Failed to save');
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
      if (!window.confirm('Are you sure you want to deactivate this product?')) {
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
        <h2>Product Catalog {selectedSede === 'ALL' ? '(Global)' : '(Specific Branch)'}</h2>
        {userRol === 'Administrador' && (
          <button className="btn-primary" onClick={() => handleOpenModal()}>+ New Product</button>
        )}
      </div>

      <div className="catalog-filters">
        <input 
          type="text" 
          placeholder="Search by name or code..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>

      {loading ? (
        <p>Loading catalog...</p>
      ) : (
        <table className="catalog-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Supplier</th>
              <th>Sale Price</th>
              <th>Stock</th>
              <th>Status</th>
              {userRol === 'Administrador' && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {productos.map(p => (
              <tr key={p.id_producto} className={p.estado === 'Inactivo' ? 'row-inactive' : ''}>
                <td>{p.codigo_producto}</td>
                <td>{p.nombre_producto}</td>
                <td>{p.nombre_proveedor || 'No supplier'}</td>
                <td>${Number(p.precio_venta).toLocaleString()}</td>
                <td>
                  <span className={`stock-badge ${Number(p.stock_total) > 0 ? 'stock-ok' : 'stock-zero'}`}>
                    {p.stock_total}
                  </span>
                </td>
                <td>
                  <span className={`status-badge ${p.estado.toLowerCase()}`}>{t(STATUS_LABEL, p.estado)}</span>
                </td>
                {userRol === 'Administrador' && (
                  <td className="actions">
                    <button className="btn-icon" onClick={() => handleOpenModal(p)} title="Edit">✏️</button>
                    <button 
                      className="btn-icon" 
                      onClick={() => handleToggleStatus(p.id_producto, p.estado)}
                      title={p.estado === 'Activo' ? 'Deactivate' : 'Activate'}
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
                  No products found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>{editingProduct ? 'Edit Product' : 'New Product'}</h3>
            {error && <div className="error-message">{error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Code</label>
                {editingProduct ? (
                  <input type="text" value={editingProduct.codigo_producto} readOnly disabled />
                ) : (
                  <input
                    type="text"
                    placeholder="e.g. PRD-300"
                    value={formData.codigo_producto}
                    onChange={e => setFormData({...formData, codigo_producto: e.target.value})}
                    required
                  />
                )}
              </div>

              <div className="form-group">
                <label>Product Name</label>
                <input
                  type="text"
                  value={formData.nombre_producto}
                  onChange={e => setFormData({...formData, nombre_producto: e.target.value})}
                  required
                />
              </div>

              <div className="form-group">
                <label>Product Type</label>
                <input
                  type="text"
                  list="tipos-producto"
                  placeholder="e.g. Cocktail, Beer..."
                  value={formData.tipo_producto}
                  onChange={e => setFormData({...formData, tipo_producto: e.target.value})}
                  required
                />
                <datalist id="tipos-producto">
                  <option value="Cocktail" />
                  <option value="Signature cocktail" />
                  <option value="Beer" />
                  <option value="Liquor" />
                  <option value="Food" />
                  <option value="Non-alcoholic" />
                </datalist>
              </div>

              <div className="form-group">
                <label>Supplier</label>
                <input
                  type="text"
                  value={proveedor ? proveedor.nombre_proveedor : 'No supplier registered'}
                  readOnly
                  disabled
                />
              </div>

              <div className="form-group">
                <label>Cost Price</label>
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
                <label>Sale Price</label>
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