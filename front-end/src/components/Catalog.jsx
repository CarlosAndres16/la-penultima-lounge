import { useState, useEffect } from 'react';
import './Catalog.css';

export default function Catalog({ userRol, selectedSede }) {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchProductos();
  }, [selectedSede, searchTerm]);

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

  const handleToggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'Activo' ? 'Inactivo' : 'Activo';
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
          <button className="btn-primary">+ Nuevo Producto</button>
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
                  <td>PRD-{p.id_producto.toString().padStart(3, '0')}</td>
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
                      <button className="btn-icon">✏️</button>
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
    </div>
  );
}

