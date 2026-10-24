import { useState, useEffect, useCallback } from 'react';
import './OrderEntry.css';
import Toast from './Toast';
import CloseOrderModal from './CloseOrderModal';
import Invoice from './Invoice';

const API = 'http://localhost:3000/api/v1';
const POLL_MS = 5000; // HU-23 CA-01: stock is re-read from the server every few seconds
const money = (n) => `$ ${Number(n || 0).toLocaleString('es-CO')}`;

/**
 * Order registration screen.
 * HU-23: for every product it shows the real-time stock of the branch; when the stock is zero the
 * "Add" action is disabled and the "Out of stock" label is shown. The server is the final judge:
 * it checks and discounts the stock in one atomic statement, so if two users ask for the same
 * product at once, the request that exceeds the remaining stock is rejected.
 *
 * HU-26 / HU-27 / HU-28 / HU-29: the Cashier (or Administrator) closes the order, chooses the payment method
 * and gets the invoice.
 * An open order with no products can be cancelled to free the table again (customers changed their mind).
 *
 * @param {Object} props.order - Order received from the table map (needs id_pedido, id_mesa, id_sede).
 * @param {string} props.userRol - Role of the logged-in user (only Waiter and Administrator can add products).
 * @param {Function} props.onBack - Returns to the table map.
 */
export default function OrderEntry({ order, userRol, onBack }) {
  const canAdd = userRol === 'Mesero' || userRol === 'Administrador';
  const canClose = userRol === 'Cajero' || userRol === 'Administrador'; // HU-28
  const canCancel = userRol === 'Mesero' || userRol === 'Administrador'; // same roles that start orders (HU-22)

  const [pedido, setPedido] = useState(order);
  const [productos, setProductos] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [pageError, setPageError] = useState('');
  const [orderClosed, setOrderClosed] = useState(false);
  const [quantities, setQuantities] = useState({});
  const [addingId, setAddingId] = useState(null);
  const [showClose, setShowClose] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [invoiceId, setInvoiceId] = useState(null); // invoice just issued when the order is closed
  const [toast, setToast] = useState(null);
  const closeToast = useCallback(() => setToast(null), []);

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

  // Current state of the order (lines and total); detects that it was closed by someone else
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
      fetchProductos(); // always show the real stock after an attempt (accepted or rejected)
    }
  };

  // Cancel an order that has no products and free the table
  const handleCancelOrder = async () => {
    if (!window.confirm(`Cancel this order and free table ${pedido.numero_mesa}?`)) {
      return;
    }

    setCancelling(true);
    try {
      const res = await fetch(`${API}/pedidos/${pedido.id_pedido}/cancelar`, {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to cancel the order');
      onBack(); // the table is free again: back to the tables map
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
      setCancelling(false);
      fetchPedido(); // the order may have received products in the meantime
    }
  };

  const lineas = pedido.lineas || [];

  return (
    <div className="order-container">
      <div className="order-header">
        <div>
          <h2>Order Registration</h2>
          <p className="order-subtitle">
            Table {pedido.numero_mesa} · Order #{String(pedido.id_pedido).padStart(4, '0')} · {pedido.estado}
          </p>
        </div>
        <button type="button" className="order-btn-secondary" onClick={onBack}>
          ← Back to tables
        </button>
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
                          {busy ? 'Adding...' : 'Add'}
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
                </tr>
              </thead>
              <tbody>
                {lineas.map((l) => (
                  <tr key={l.id_detalle_pedido}>
                    <td>{l.nombre_producto}</td>
                    <td>{l.cantidad}</td>
                    <td>{money(l.precio_unitario)}</td>
                    <td>{money(l.subtotal)}</td>
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
            onBack(); // the table is free again: back to the tables map
          }}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={closeToast} />}
    </div>
  );
}