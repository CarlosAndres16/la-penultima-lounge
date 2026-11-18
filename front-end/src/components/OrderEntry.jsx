import { useState, useEffect, useCallback } from 'react';
import './OrderEntry.css';
import Toast from './Toast';
import CloseOrderModal from './CloseOrderModal';
import Invoice from './Invoice';

const API = 'http://localhost:3000/api/v1';
const POLL_MS = 5000;
const money = (n) => `$ ${Number(n || 0).toLocaleString('es-CO')}`;

/**
 * Order registration screen + Backtracking combo generator.
 */
export default function OrderEntry({ order, userRol, onBack }) {
  const canAdd = userRol === 'Mesero' || userRol === 'Administrador';
  const canRemove = canAdd;
  const canClose = userRol === 'Cajero' || userRol === 'Administrador';
  const canCancel = userRol === 'Mesero' || userRol === 'Administrador';

  const [pedido, setPedido] = useState(order);
  const [productos, setProductos] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [pageError, setPageError] = useState('');
  const [orderClosed, setOrderClosed] = useState(false);
  const [quantities, setQuantities] = useState({});
  const [addingId, setAddingId] = useState(null);
  const [removingId, setRemovingId] = useState(null);
  const [showClose, setShowClose] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [invoiceId, setInvoiceId] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [toast, setToast] = useState(null);
  const closeToast = useCallback(() => setToast(null), []);

  // Backtracking Combos State
  const [showComboModal, setShowComboModal] = useState(false);
  const [presupuestoCombo, setPresupuestoCombo] = useState(25000);
  const [combosData, setCombosData] = useState(null);
  const [loadingCombos, setLoadingCombos] = useState(false);
  const [comboError, setComboError] = useState('');
  const [addingCombo, setAddingCombo] = useState(false);

  const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

  // Stock of the branch that owns the order (active products only)
  const fetchProductos = useCallback(async () => {
    try {
      const res = await fetch(`${API}/productos?sedeId=${order.id_sede}&estado=Activo`, {
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ([]));
      if (!res.ok) throw new Error(data.error || 'Failed to load the products');
      setProductos(data);
      setPageError('');
    } catch (err) {
      setPageError(err.message);
    } finally {
      setLoadingProducts(false);
    }
  }, [order.id_sede]);

  // Current state of the order
  const fetchPedido = useCallback(async () => {
    try {
      const res = await fetch(`${API}/pedidos/mesa/${order.id_mesa}`, { headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (res.status === 404) {
        setOrderClosed(true);
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Failed to load the order');
      if (data.id_pedido !== order.id_pedido) {
        setOrderClosed(true);
        return;
      }
      setPedido(data);
    } catch (err) {
      setPageError(err.message);
    }
  }, [order.id_mesa, order.id_pedido]);

  useEffect(() => {
    fetchProductos();
    fetchPedido();
    const timer = setInterval(() => {
      fetchProductos();
      fetchPedido();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [fetchProductos, fetchPedido]);

  const getQty = (id) => (quantities[id] === undefined ? '1' : quantities[id]);
  const setQty = (id, value) => setQuantities((prev) => ({ ...prev, [id]: value }));

  const handleAdd = async (producto) => {
    const qty = Number(getQty(producto.id_producto));
    if (!Number.isInteger(qty) || qty <= 0) {
      setToast({ message: 'Quantity must be a whole number greater than zero', type: 'error' });
      return;
    }

    setAddingId(producto.id_producto);
    try {
      const res = await fetch(`${API}/pedidos/${pedido.id_pedido}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ id_producto: producto.id_producto, cantidad: qty }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to add the product');

      setPedido(data);
      setQty(producto.id_producto, '1');
      setToast({ message: `${producto.nombre_producto} x${qty} added`, type: 'success' });
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setAddingId(null);
      fetchProductos();
    }
  };

  const removeLine = async (linea) => {
    setRemovingId(linea.id_detalle_pedido);
    try {
      const res = await fetch(`${API}/pedidos/${pedido.id_pedido}/items/${linea.id_detalle_pedido}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to remove the product');

      setPedido(data);
      setToast({ message: `${linea.nombre_producto} removed from the order`, type: 'success' });
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
      fetchPedido();
    } finally {
      setRemovingId(null);
      fetchProductos();
    }
  };

  const handleRemoveLine = (linea) => {
    setConfirmDialog({
      title: 'Remove product',
      message: `Remove ${linea.nombre_producto} (x${linea.cantidad}) from the order? The quantity will go back to the branch stock.`,
      confirmLabel: 'Remove',
      onConfirm: () => removeLine(linea),
    });
  };

  const cancelOrder = async () => {
    setCancelling(true);
    try {
      const res = await fetch(`${API}/pedidos/${pedido.id_pedido}/cancelar`, {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to cancel the order');
      setToast({ message: `Order on table ${pedido.numero_mesa} cancelled`, type: 'success' });
      onBack();
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setCancelling(false);
    }
  };

  const handleCancelOrder = () => {
    setConfirmDialog({
      title: 'Cancel order',
      message: `Cancel order on table ${pedido.numero_mesa}? The table will be freed immediately.`,
      confirmLabel: 'Cancel order',
      onConfirm: cancelOrder,
    });
  };

  const handleConfirmDialog = () => {
    const action = confirmDialog?.onConfirm;
    setConfirmDialog(null);
    if (action) action();
  };

  // Backtracking: Generar combos exactos
  const buscarCombosBacktracking = async () => {
    setLoadingCombos(true);
    setComboError('');
    try {
      const res = await fetch(`${API}/algoritmos/backtracking-combos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ valorObjetivo: presupuestoCombo })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al generar combos');
      setCombosData(data);
    } catch (err) {
      setComboError(err.message);
    } finally {
      setLoadingCombos(false);
    }
  };

  // Cargar todos los productos de un combo en el pedido
  const aplicarComboAlPedido = async (combo) => {
    setAddingCombo(true);
    try {
      for (const item of combo.items) {
        await fetch(`${API}/pedidos/${pedido.id_pedido}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ id_producto: item.id_producto, cantidad: 1 })
        });
      }
      await fetchPedido();
      await fetchProductos();
      setShowComboModal(false);
      setToast({
        message: `Exact combo of ${money(combo.valorTotal)} (${combo.items.length} products) added to order`,
        type: 'success'
      });
    } catch (err) {
      setToast({ message: `Failed to add combo: ${err.message}`, type: 'error' });
    } finally {
      setAddingCombo(false);
    }
  };

  const lineas = pedido.lineas || [];
  const showRemoveColumn = canRemove && !orderClosed;

  return (
    <div className="order-container">
      <div className="order-header">
        <div>
          <h2>Order Registration</h2>
          <p className="order-subtitle">
            Table {pedido.numero_mesa} · Order #{String(pedido.id_pedido).padStart(4, '0')} · {pedido.estado}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          {canAdd && !orderClosed && (
            <button
              type="button"
              className="order-btn-secondary"
              onClick={() => { setShowComboModal(true); if (!combosData) buscarCombosBacktracking(); }}
              style={{ borderColor: '#d4af37', color: '#d4af37', fontWeight: 600 }}
            >
              ⚡ Suggest Combo (Backtracking)
            </button>
          )}
          <button type="button" className="order-btn-secondary" onClick={onBack}>
            ← Back to tables
          </button>
        </div>
      </div>

      {orderClosed && !invoiceId && (
        <div className="order-error">This order is no longer open. Go back to the tables map.</div>
      )}
      {pageError && !orderClosed && <div className="order-error">{pageError}</div>}

      <div className="order-layout">
        {canAdd && !orderClosed && (
          <section className="order-panel">
            <h3>Products</h3>
            {loadingProducts ? (
              <p className="order-hint">Loading products...</p>
            ) : productos.length === 0 ? (
              <p className="order-hint">No active products for this branch.</p>
            ) : (
              <ul className="order-products">
                {productos.map((p) => {
                  const stock = Number(p.stock_total);
                  const outOfStock = stock <= 0;
                  const busy = addingId === p.id_producto;
                  return (
                    <li key={p.id_producto} className={`order-product${outOfStock ? ' order-product-out' : ''}`}>
                      <div className="order-product-info">
                        <strong>{p.nombre_producto}</strong>
                        <span className="order-product-meta">
                          {p.codigo_producto} · {money(p.precio_venta)}
                        </span>
                      </div>

                      <div className="order-product-actions">
                        {outOfStock ? (
                          <span className="order-badge order-badge-out">Out of stock</span>
                        ) : (
                          <span className="order-badge order-badge-stock">Stock: {stock}</span>
                        )}
                        <input
                          type="number"
                          min="1"
                          step="1"
                          inputMode="numeric"
                          className="order-qty"
                          value={getQty(p.id_producto)}
                          onChange={(e) => setQty(p.id_producto, e.target.value)}
                          disabled={outOfStock || busy}
                          aria-label={`Quantity of ${p.nombre_producto}`}
                        />
                        <button
                          type="button"
                          className="order-btn-primary"
                          onClick={() => handleAdd(p)}
                          disabled={outOfStock || busy}
                        >
                          {busy ? '...' : 'Add'}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        <section className="order-panel">
          <h3>Order detail</h3>
          {lineas.length === 0 ? (
            <p className="order-hint">No products in this order yet.</p>
          ) : (
            <table className="order-lines">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Unit price</th>
                  <th>Subtotal</th>
                  {showRemoveColumn && <th></th>}
                </tr>
              </thead>
              <tbody>
                {lineas.map((l) => (
                  <tr key={l.id_detalle_pedido}>
                    <td>{l.nombre_producto}</td>
                    <td>{l.cantidad}</td>
                    <td>{money(l.precio_unitario)}</td>
                    <td>{money(l.subtotal)}</td>
                    {showRemoveColumn && (
                      <td>
                        <button
                          type="button"
                          className="order-btn-secondary"
                          onClick={() => handleRemoveLine(l)}
                          disabled={removingId === l.id_detalle_pedido}
                          aria-label={`Remove ${l.nombre_producto} from the order`}
                          title="Remove from order"
                        >
                          {removingId === l.id_detalle_pedido ? '...' : '✕'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="order-total">
            <span>Total</span>
            <strong>{money(pedido.total)}</strong>
          </div>
          {canCancel && !orderClosed && lineas.length === 0 && (
            <button
              type="button"
              className="order-btn-secondary"
              style={{ width: '100%', marginTop: '1rem' }}
              onClick={handleCancelOrder}
              disabled={cancelling}
            >
              {cancelling ? 'Cancelling...' : 'Cancel order and free table'}
            </button>
          )}
          {canClose && !orderClosed && (
            <button
              type="button"
              className="order-btn-primary"
              style={{ width: '100%', marginTop: '1rem' }}
              onClick={() => setShowClose(true)}
              disabled={lineas.length === 0}
            >
              Close Order and Invoice
            </button>
          )}
        </section>
      </div>

      {/* Modal de Combos con Backtracking */}
      {showComboModal && (
        <div className="billing-overlay" onClick={() => setShowComboModal(false)}>
          <div
            className="billing-modal"
            style={{ maxWidth: '600px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h3 style={{ color: '#d4af37', margin: 0 }}>⚡ Suggest Exact Combo (Backtracking)</h3>
              <span style={{ fontSize: '0.75rem', background: 'rgba(212,175,55,0.15)', color: '#d4af37', padding: '0.2rem 0.5rem', borderRadius: '10px' }}>
                Subset Sum with Pruning O(2^N)
              </span>
            </div>
            <p className="billing-sub">
              Enter customer budget or voucher amount. The algorithm explores the catalog with backtracking and pruning to find exact combinations.
            </p>

            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-end', marginBottom: '1rem' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={{ fontSize: '0.8rem', color: '#a89f91' }}>Exact Budget ($):</label>
                <input
                  type="number"
                  step="1000"
                  value={presupuestoCombo}
                  onChange={(e) => setPresupuestoCombo(Number(e.target.value))}
                  style={{ padding: '0.55rem', background: '#242424', border: '1px solid #4a3b32', color: '#fff', borderRadius: '4px' }}
                />
              </div>
              <button
                type="button"
                className="billing-btn billing-btn-primary"
                onClick={buscarCombosBacktracking}
                disabled={loadingCombos || presupuestoCombo <= 0}
                style={{ height: '38px', padding: '0 1rem' }}
              >
                {loadingCombos ? 'Searching...' : 'Search Combos'}
              </button>
            </div>

            {comboError && <div className="billing-error">{comboError}</div>}

            {combosData && (
              <div>
                <div style={{ fontSize: '0.8rem', color: '#a89f91', marginBottom: '0.5rem' }}>
                  Found: <strong style={{ color: '#fff' }}>{combosData.totalCombinacionesEncontradas} combinations</strong> ·
                  Pruned branches: <strong style={{ color: '#66bb6a' }}>{combosData.metricasAlgoritmo.eficienciaPoda}</strong>
                </div>

                {combosData.combinaciones.length === 0 ? (
                  <p className="order-hint">No product combination matches exactly {money(presupuestoCombo)}.</p>
                ) : (
                  <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid #2e2621', borderRadius: '4px' }}>
                    {combosData.combinaciones.map((c) => (
                      <div
                        key={c.comboId}
                        style={{ padding: '0.75rem', borderBottom: '1px solid #241d18', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      >
                        <div style={{ flex: 1, marginRight: '0.75rem' }}>
                          <div style={{ fontWeight: 600, color: '#d4af37', fontSize: '0.88rem' }}>
                            Option {c.comboId} — {money(c.valorTotal)}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#c9c2b5', marginTop: '0.2rem' }}>
                            {c.items.map((it) => it.nombre).join(' + ')}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="billing-btn billing-btn-primary"
                          onClick={() => aplicarComboAlPedido(c)}
                          disabled={addingCombo}
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                        >
                          {addingCombo ? '...' : '+ Add to Order'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="billing-actions" style={{ marginTop: '1rem' }}>
              <button type="button" className="billing-btn" onClick={() => setShowComboModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showClose && (
        <CloseOrderModal
          order={pedido}
          onCancel={() => setShowClose(false)}
          onClosed={(idFactura) => {
            setShowClose(false);
            setInvoiceId(idFactura);
          }}
        />
      )}

      {invoiceId !== null && (
        <Invoice
          idFactura={invoiceId}
          onClose={() => {
            setInvoiceId(null);
            onBack();
          }}
        />
      )}

      {confirmDialog && (
        <div className="billing-overlay" onClick={() => setConfirmDialog(null)}>
          <div
            className="billing-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-confirm-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="order-confirm-title">{confirmDialog.title}</h3>
            <p className="billing-sub">{confirmDialog.message}</p>
            <div className="billing-actions">
              <button type="button" className="billing-btn" onClick={() => setConfirmDialog(null)}>
                Keep
              </button>
              <button
                type="button"
                className="billing-btn billing-btn-primary"
                onClick={handleConfirmDialog}
                autoFocus
              >
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={closeToast} />}
    </div>
  );
}
