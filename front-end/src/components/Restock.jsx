import { useState, useEffect, useCallback } from 'react';
import './Restock.css';
import Toast from './Toast';

const API = 'http://localhost:3000/api/v1';
const QTY_ERROR = 'Quantity must be a whole number greater than zero';
const money = (n) => `$ ${Number(n || 0).toLocaleString('es-CO')}`;

/**
 * HU-20 - New Restock form.
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
  const valorTotal = qtyValid ? qty * valorCompra : 0; // display only; the server recalculates

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

  return (
    <div className="restock-container">
      <div className="restock-header">
        <h2>New Restock</h2>
        <p className="restock-subtitle">Register an inventory entry for the branch</p>
      </div>

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