import { useState, useEffect, useCallback } from 'react';
import './Tables.css';
import Toast from './Toast';

import { t, TABLE_STATUS_LABEL } from '../i18n';
const API = 'http://localhost:3000/api/v1';
const POLL_MS = 5000; // HU-21 CA-02: the map refreshes by itself, no manual page reload
const money = (n) => `$ ${Number(n || 0).toLocaleString('es-CO')}`;
const formatTime = (iso) =>
  new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false });

/**
 * Tables screen.
 * - Everyone (Waiter, Cashier, Administrator): live table map of the branch with the summary of the
 *   open order of each occupied table (HU-21) and "New Order" on free tables (HU-22).
 * - Administrator only: also creates and deletes the tables of the branch (HU-18).
 *
 * @param {string} props.userRol - Role of the logged-in user.
 * @param {string|number} props.selectedSede - Selected branch ("ALL" for the Administrator = none).
 * @param {Function} [props.onOpenOrder] - Called with the order when it is started or opened,
 *   so the parent can show the order registration screen (HU-24).
 */
export default function Tables({ userRol, selectedSede, onOpenOrder }) {
  const [mesas, setMesas] = useState([]);
  const [sedes, setSedes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [pageError, setPageError] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [numeroMesa, setNumeroMesa] = useState('');
  const [modalError, setModalError] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const closeToast = useCallback(() => setToast(null), []);

  // Table map state (HU-21 / HU-22)
  const [selectedId, setSelectedId] = useState(null);
  const [pedido, setPedido] = useState(null);
  const [pedidoError, setPedidoError] = useState('');
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [tick, setTick] = useState(0);

  const isAdmin = userRol === 'Administrador';
  // Waiter and Administrator can start orders (HU-22)
  const canStartOrder = userRol === 'Mesero' || isAdmin;
  const hasBranch = selectedSede && selectedSede !== 'ALL';
  const authHeaders = () => ({ 'Authorization': `Bearer ${localStorage.getItem('token')}` });

  const selectedMesa = mesas.find((m) => m.id_mesa === selectedId) || null;
  const selectedEstado = selectedMesa ? selectedMesa.estado_actual : null;

  useEffect(() => {
    fetchSedes();
  }, []);

  // Polling: every POLL_MS the tick changes and the effects below refresh the map and the order summary
  useEffect(() => {
    const timer = setInterval(() => setTick((n) => n + 1), POLL_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setSearchTerm('');
    setPageError('');
    setSelectedId(null);
    if (hasBranch) {
      fetchMesas();
    } else {
      setMesas([]);
    }
  }, [selectedSede]);

  // Silent refresh of the tables (no "Loading..." flicker)
  useEffect(() => {
    if (tick > 0 && hasBranch) {
      fetchMesas(true);
    }
  }, [tick]);

  // HU-21 CA-03: summary of the open order when an occupied table is selected
  useEffect(() => {
    if (selectedId === null || selectedEstado !== 'Ocupada') {
      setPedido(null);
      setPedidoError('');
      return;
    }
    fetchPedido(selectedId);
  }, [selectedId, selectedEstado, tick]);

  const fetchSedes = async () => {
    try {
      const res = await fetch(`${API}/sedes`, { headers: authHeaders() });
      if (!res.ok) return;
      setSedes(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMesas = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`${API}/sedes/${selectedSede}/mesas`, { headers: authHeaders() });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to load tables');
      }
      setMesas(await res.json());
      setPageError('');
    } catch (err) {
      setPageError(err.message);
      if (!silent) setMesas([]);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchPedido = async (idMesa) => {
    try {
      const res = await fetch(`${API}/pedidos/mesa/${idMesa}`, { headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to load the order');
      setPedido(data);
      setPedidoError('');
    } catch (err) {
      setPedido(null);
      setPedidoError(err.message);
    }
  };

  const handleOpenModal = () => {
    setNumeroMesa('');
    setModalError('');
    setShowModal(true);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setModalError('');
    setSaving(true);

    try {
      const res = await fetch(`${API}/sedes/${selectedSede}/mesas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ numero_mesa: numeroMesa })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to create table');
      }

      setShowModal(false);
      setNumeroMesa('');
      fetchMesas();
    } catch (err) {
      setModalError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (mesa) => {
    setPageError('');
    try {
      const res = await fetch(`${API}/sedes/${selectedSede}/mesas/${mesa.id_mesa}`, {
        method: 'DELETE',
        headers: authHeaders()
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to delete table');
      }

      if (selectedId === mesa.id_mesa) setSelectedId(null);
      fetchMesas();
      setToast({ message: 'Table deleted successfully', type: 'success' });
    } catch (err) {
      setPageError(err.message);
      setToast({ message: err.message, type: 'error' });
    }
  };

  // HU-22: start an order on the selected free table
  const handleNewOrder = async () => {
    if (!selectedMesa) return;
    setCreatingOrder(true);
    try {
      const res = await fetch(`${API}/pedidos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ id_mesa: selectedMesa.id_mesa })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to start the order');

      setToast({ message: `Order started on table ${selectedMesa.numero_mesa}`, type: 'success' });
      setPedido(data);
      fetchMesas(true);
      if (onOpenOrder) onOpenOrder(data);
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
      fetchMesas(true); // another user may have taken the table in the meantime
    } finally {
      setCreatingOrder(false);
    }
  };

  // Reserve a free table or release a reserved one (Waiter, Cashier and Administrator)
  const handleChangeStatus = async (nuevoEstado) => {
    if (!selectedMesa) return;
    setChangingStatus(true);
    try {
      const res = await fetch(`${API}/sedes/${selectedMesa.id_sede}/mesas/${selectedMesa.id_mesa}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ estado: nuevoEstado })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to change the table status');

      setToast({
        message: `Table ${selectedMesa.numero_mesa} is now ${t(TABLE_STATUS_LABEL, nuevoEstado).toLowerCase()}`,
        type: 'success'
      });
      fetchMesas(true);
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
      fetchMesas(true); // the table may have changed in the meantime
    } finally {
      setChangingStatus(false);
    }
  };

  const sedeActual = sedes.find(s => String(s.id_sede) === String(selectedSede));
  const filtered = mesas.filter(m =>
    m.numero_mesa.toLowerCase().includes(searchTerm.trim().toLowerCase())
  );
  // Ignore a late response that belongs to a table that is no longer selected
  const pedidoActual = pedido && pedido.id_mesa === selectedId ? pedido : null;

  return (
    <div className="tables-container">
      <div className="tables-header">
        <div>
          <h2>Tables</h2>
          <p className="tables-subtitle">
            {hasBranch
              ? `Live status of the tables${sedeActual ? ` — ${sedeActual.nombre_sede}` : ''}`
              : 'Live status of the tables by branch'}
          </p>
        </div>
        {isAdmin && hasBranch && (
          <button className="tables-btn-primary" onClick={handleOpenModal}>+ New Table</button>
        )}
      </div>

      {!hasBranch ? (
        <div className="tables-empty">
          {isAdmin
            ? 'Select a specific branch in the top bar to see its tables.'
            : 'Your user has no assigned branch.'}
        </div>
      ) : (
        <>
          <div className="tables-filters">
            <input
              type="text"
              placeholder="Search table..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="tables-search"
            />
          </div>

          {pageError && <div className="tables-error">{pageError}</div>}

          {loading ? (
            <p>Loading tables...</p>
          ) : filtered.length === 0 ? (
            <div className="tables-empty">
              {mesas.length === 0 ? 'No tables registered for this branch yet' : 'No tables found'}
            </div>
          ) : (
            <div className="tables-layout">
              <div className="tables-grid">
                {filtered.map(m => (
                  <div
                    key={m.id_mesa}
                    role="button"
                    tabIndex={0}
                    aria-pressed={m.id_mesa === selectedId}
                    className={`table-card table-${m.estado_actual.toLowerCase()}${
                      m.id_mesa === selectedId ? ' table-card-selected' : ''
                    }`}
                    onClick={() => setSelectedId(m.id_mesa)}
                    onKeyDown={(e) => {
                      if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        setSelectedId(m.id_mesa);
                      }
                    }}
                  >
                    {isAdmin && (
                      <button
                        className="table-delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(m);
                        }}
                        title="Delete table"
                      >
                        ✕
                      </button>
                    )}
                    <span className="table-number">{m.numero_mesa}</span>
                    <span className="table-status">{t(TABLE_STATUS_LABEL, m.estado_actual)}</span>
                  </div>
                ))}
              </div>

              <aside className="tables-detail">
                {!selectedMesa ? (
                  <p className="tables-hint">Select a table to see its detail</p>
                ) : (
                  <>
                    <div className="tables-detail-head">
                      <h3>Table {selectedMesa.numero_mesa}</h3>
                      <span className={`tables-badge table-${selectedMesa.estado_actual.toLowerCase()}`}>
                        {t(TABLE_STATUS_LABEL, selectedMesa.estado_actual)}
                      </span>
                    </div>

                    {selectedMesa.estado_actual === 'Libre' && (
                      <>
                        <p className="tables-hint">This table is available.</p>
                        {canStartOrder ? (
                          <button
                            type="button"
                            className="tables-btn-primary"
                            onClick={handleNewOrder}
                            disabled={creatingOrder}
                          >
                            {creatingOrder ? 'Starting...' : 'New Order'}
                          </button>
                        ) : (
                          <p className="tables-hint">Only waiters can start an order.</p>
                        )}
                        <button
                          type="button"
                          className="tables-btn-secondary"
                          style={{ marginTop: '0.6rem' }}
                          onClick={() => handleChangeStatus('Reservada')}
                          disabled={changingStatus || creatingOrder}
                        >
                          {changingStatus ? 'Updating...' : 'Mark as Reserved'}
                        </button>
                      </>
                    )}

                    {selectedMesa.estado_actual === 'Reservada' && (
                      <>
                        <p className="tables-hint">This table is reserved.</p>
                        <button
                          type="button"
                          className="tables-btn-secondary"
                          onClick={() => handleChangeStatus('Libre')}
                          disabled={changingStatus}
                        >
                          {changingStatus ? 'Updating...' : 'Mark as Free'}
                        </button>
                      </>
                    )}

                    {selectedMesa.estado_actual === 'Ocupada' && (
                      <>
                        {pedidoError && <p className="tables-hint">{pedidoError}</p>}
                        {!pedidoError && !pedidoActual && <p className="tables-hint">Loading order...</p>}
                        {pedidoActual && (
                          <>
                            <dl className="tables-info">
                              <dt>Order</dt>
                              <dd>#{String(pedidoActual.id_pedido).padStart(4, '0')}</dd>
                              <dt>Waiter</dt>
                              <dd>{pedidoActual.nombre_mesero}</dd>
                              <dt>Opened</dt>
                              <dd>{formatTime(pedidoActual.fecha_apertura)}</dd>
                            </dl>

                            {pedidoActual.lineas.length === 0 ? (
                              <p className="tables-hint">No products in this order yet.</p>
                            ) : (
                              <table className="tables-lines">
                                <thead>
                                  <tr>
                                    <th>Product</th>
                                    <th>Qty</th>
                                    <th>Subtotal</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {pedidoActual.lineas.map((l) => (
                                    <tr key={l.id_detalle_pedido}>
                                      <td>{l.nombre_producto}</td>
                                      <td>{l.cantidad}</td>
                                      <td>{money(l.subtotal)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}

                            <div className="tables-total">
                              <span>Total</span>
                              <strong>{money(pedidoActual.total)}</strong>
                            </div>

                            {onOpenOrder && (
                              <button
                                type="button"
                                className="tables-btn-secondary"
                                onClick={() => onOpenOrder(pedidoActual)}
                              >
                                View order
                              </button>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </>
                )}
              </aside>
            </div>
          )}
        </>
      )}

      {showModal && (
        <div className="tables-overlay">
          <div className="tables-modal">
            <h3>New Table</h3>
            {modalError && <div className="tables-error">{modalError}</div>}

            <form onSubmit={handleCreate}>
              <div className="tables-form-group">
                <label>Table number or code</label>
                <input
                  type="text"
                  placeholder="e.g. 11"
                  value={numeroMesa}
                  onChange={(e) => setNumeroMesa(e.target.value)}
                  maxLength={20}
                  required
                  autoFocus
                />
              </div>

              <div className="tables-form-group">
                <label>Initial status</label>
                <input type="text" value={t(TABLE_STATUS_LABEL, 'Libre')} readOnly disabled />
              </div>

              <div className="tables-modal-actions">
                <button type="button" className="tables-btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="tables-btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={closeToast} />}
    </div>
  );
}