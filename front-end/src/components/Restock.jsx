import { useState, useEffect, useCallback } from 'react';
import './Restock.css';
import Toast from './Toast';

const API = 'http://localhost:3000/api/v1';
const QTY_ERROR = 'Quantity must be a whole number greater than zero';
const money = (n) => `$ ${Number(n || 0).toLocaleString('es-CO')}`;

/**
 * HU-20 - New Restock form + Knapsack (Problema de la Mochila) budget optimizer.
 * Cashier: always restocks their own branch.
 * Administrator: restocks the branch selected in the top bar (must not be "All branches").
 */
export default function Restock({ userRol, selectedSede }) {
  const isAdmin = userRol === 'Administrador';
  const hasBranch = !!selectedSede && selectedSede !== 'ALL';
  const canRestock = !isAdmin || hasBranch;

  const [productos, setProductos] = useState([]);
  const [proveedor, setProveedor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [idProducto, setIdProducto] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const closeToast = useCallback(() => setToast(null), []);

  // Estado para el Asistente de Mochila (Knapsack)
  const [showMochila, setShowMochila] = useState(false);
  const [presupuestoMochila, setPresupuestoMochila] = useState(100000);
  const [resultadoMochila, setResultadoMochila] = useState(null);
  const [loadingMochila, setLoadingMochila] = useState(false);
  const [errorMochila, setErrorMochila] = useState('');

  const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

  // Reload the lists every time the form is opened or the branch changes (HU-19 CA-02/CA-03)
  useEffect(() => {
    if (!canRestock) return;
    const load = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const res = await fetch(`${API}/reabastecimientos/formulario`, { headers: authHeaders() });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to load the restock form');
        }
        const data = await res.json();
        setProductos(data.productos);
        setProveedor(data.proveedor);
      } catch (err) {
        setLoadError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [canRestock, selectedSede]);

  const producto = productos.find((p) => String(p.id_producto) === String(idProducto));
  const valorCompra = producto ? Number(producto.valor_compra) : 0;
  const qty = Number(cantidad);
  const qtyValid = cantidad !== '' && Number.isInteger(qty) && qty > 0;
  const valorTotal = qtyValid ? qty * valorCompra : 0;

  const resetForm = () => {
    setIdProducto('');
    setCantidad('');
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!idProducto) {
      setError('Select a product');
      return;
    }
    if (!qtyValid) {
      setError(QTY_ERROR);
      return;
    }

    setSaving(true);
    try {
      const body = { id_producto: Number(idProducto), cantidad: qty };
      if (isAdmin) body.id_sede = Number(selectedSede);

      const res = await fetch(`${API}/reabastecimientos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to register the restock');

      setToast({
        message: `Restock saved. ${data.nombre_producto}: new stock ${data.nueva_existencia} at ${data.nombre_sede}`,
        type: 'success',
      });
      resetForm();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Ejecución de la Mochila 0/1 para compras óptimas
  const calcularMochila = async () => {
    setLoadingMochila(true);
    setErrorMochila('');
    try {
      const res = await fetch(`${API}/algoritmos/mochila-presupuesto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ presupuesto: presupuestoMochila, escala: 500 })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al optimizar presupuesto');
      setResultadoMochila(data);
    } catch (err) {
      setErrorMochila(err.message);
    } finally {
      setLoadingMochila(false);
    }
  };

  const seleccionarProductoDeMochila = (p) => {
    setIdProducto(String(p.id_producto));
    setCantidad('1');
    setToast({
      message: `Producto ${p.nombre} seleccionado para reabastecimiento`,
      type: 'success'
    });
  };

  return (
    <div className="restock-container">
      <div className="restock-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>New Restock</h2>
          <p className="restock-subtitle">Register an inventory entry for the branch</p>
        </div>

        {canRestock && (
          <button
            type="button"
            className="restock-btn-secondary"
            onClick={() => setShowMochila(!showMochila)}
            style={{ borderColor: '#d4af37', color: '#d4af37', fontWeight: 600 }}
          >
            {showMochila ? '✕ Ocultar Asistente Mochila' : '🎒 Asistente Mochila 0/1'}
          </button>
        )}
      </div>

      {/* Asistente Mochila (Knapsack 0/1) Integrado en Reabastecimiento */}
      {showMochila && canRestock && (
        <div style={{ background: '#141414', border: '1px solid #d4af37', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h4 style={{ color: '#d4af37', margin: 0 }}>
              🎒 Optimizar Compra con Algoritmo de la Mochila (Knapsack 0/1)
            </h4>
            <span style={{ fontSize: '0.75rem', color: '#66bb6a', background: 'rgba(102,187,106,0.15)', padding: '0.2rem 0.5rem', borderRadius: '10px' }}>
              Programación Dinámica O(N*W)
            </span>
          </div>
          <p style={{ color: '#a89f91', fontSize: '0.85rem', margin: '0 0 0.8rem' }}>
            Ingresa el presupuesto total disponible para compras. El algoritmo seleccionará el conjunto óptimo de productos que maximiza el margen de ganancia proyectado sin exceder el presupuesto.
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <label style={{ fontSize: '0.8rem', color: '#c9c2b5' }}>Presupuesto de compra ($):</label>
              <input
                type="number"
                step="5000"
                value={presupuestoMochila}
                onChange={(e) => setPresupuestoMochila(Number(e.target.value))}
                style={{ padding: '0.5rem', background: '#242424', border: '1px solid #4a3b32', color: '#fff', borderRadius: '4px' }}
              />
            </div>
            <button
              type="button"
              className="restock-btn-primary"
              onClick={calcularMochila}
              disabled={loadingMochila || presupuestoMochila <= 0}
              style={{ height: '38px', padding: '0 1rem' }}
            >
              {loadingMochila ? 'Optimizando...' : 'Calcular Compra Óptima'}
            </button>
          </div>

          {errorMochila && <p style={{ color: '#f07a7a', fontSize: '0.85rem', marginTop: '0.5rem' }}>{errorMochila}</p>}

          {resultadoMochila && (
            <div style={{ marginTop: '1rem', borderTop: '1px dashed #3d2c23', paddingTop: '0.8rem' }}>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.8rem', fontSize: '0.85rem' }}>
                <span style={{ color: '#a89f91' }}>
                  Costo Total: <strong style={{ color: '#fff' }}>{money(resultadoMochila.mochila01_ProgramacionDinamica.costoUtilizado)}</strong>
                </span>
                <span style={{ color: '#a89f91' }}>
                  Ganancia Proyectada: <strong style={{ color: '#66bb6a' }}>{money(resultadoMochila.mochila01_ProgramacionDinamica.gananciaMaxima)}</strong>
                </span>
                <span style={{ color: '#a89f91' }}>
                  Eficiencia Presupuesto: <strong style={{ color: '#d4af37' }}>{resultadoMochila.mochila01_ProgramacionDinamica.porcentajeUsoPresupuesto}</strong>
                </span>
              </div>

              <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #2e2621', borderRadius: '4px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: '#1c1713', color: '#a89f91', textAlign: 'left' }}>
                      <th style={{ padding: '0.5rem' }}>Producto</th>
                      <th style={{ padding: '0.5rem' }}>Costo Compra</th>
                      <th style={{ padding: '0.5rem' }}>Ganancia</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right' }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultadoMochila.mochila01_ProgramacionDinamica.itemsSeleccionados.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #241d18' }}>
                        <td style={{ padding: '0.5rem', color: '#fff' }}><strong>{item.nombre}</strong></td>
                        <td style={{ padding: '0.5rem' }}>{money(item.costo)}</td>
                        <td style={{ padding: '0.5rem', color: '#66bb6a' }}>{money(item.ganancia)}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={() => seleccionarProductoDeMochila(item)}
                            style={{ background: '#d4af37', color: '#121212', border: 'none', padding: '0.2rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                          >
                            Cargar en Formulario
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {!canRestock ? (
        <div className="restock-empty">
          Select a specific branch in the top bar to register a restock.
        </div>
      ) : loading ? (
        <p>Loading form...</p>
      ) : loadError ? (
        <div className="restock-error">{loadError}</div>
      ) : (
        <form className="restock-form" onSubmit={handleSubmit} noValidate>
          {error && <div className="restock-error">{error}</div>}
          {!proveedor && (
            <div className="restock-error">
              No supplier is registered. One must exist before restocking.
            </div>
          )}

          <div className="restock-group restock-wide">
            <label htmlFor="restock-product">Product</label>
            <select
              id="restock-product"
              value={idProducto}
              onChange={(e) => setIdProducto(e.target.value)}
            >
              <option value="">Select a product...</option>
              {productos.map((p) => (
                <option key={p.id_producto} value={p.id_producto}>
                  {p.nombre_producto} ({p.codigo_producto})
                </option>
              ))}
            </select>
          </div>

          <div className="restock-group">
            <label htmlFor="restock-qty">Quantity</label>
            <input
              id="restock-qty"
              type="number"
              step="1"
              inputMode="numeric"
              placeholder="e.g. 24"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
            />
          </div>

          <div className="restock-group">
            <label htmlFor="restock-cost">Purchase Value</label>
            <input id="restock-cost" type="text" value={producto ? money(valorCompra) : '—'} readOnly disabled />
          </div>

          <div className="restock-group">
            <label htmlFor="restock-total">Total Value</label>
            <input id="restock-total" className="restock-total" type="text" value={qtyValid && producto ? money(valorTotal) : '—'} readOnly disabled />
          </div>

          <div className="restock-group">
            <label htmlFor="restock-supplier">Supplier</label>
            <input id="restock-supplier" type="text" value={proveedor ? proveedor.nombre_proveedor : 'No supplier registered'} readOnly disabled />
          </div>

          <div className="restock-actions">
            <button type="button" className="restock-btn-secondary" onClick={resetForm} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="restock-btn-primary" disabled={saving || !proveedor}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={closeToast} />}
    </div>
  );
}
