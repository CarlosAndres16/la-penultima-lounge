import { useState, useEffect, useCallback } from 'react';
import './Reports.css';

const API = 'http://localhost:3000/api/v1';
const money = (n) => `$ ${Number(n || 0).toLocaleString('es-CO')}`;
const formatTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false });
};
const formatDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

/**
 * HU-31: Consultar pedidos abiertos y cerrados del turno
 * CA-01: List filtrable by state (Abierto/Cerrado), table, waiter, date range.
 * CA-02: Detail on lateral panel/modal: products, quantities, values, waiter, cashier, state.
 * CA-03: Cashier only sees their own branch; Administrator can switch or view all.
 */
export default function ShiftOrders({ userRol, selectedSede }) {
  const isAdmin = userRol === 'Administrador';

  const [pedidos, setPedidos] = useState([]);
  const [selectedPedido, setSelectedPedido] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState('');
  const [sedes, setSedes] = useState([]);

  // Filters
  const [filtroSede, setFiltroSede] = useState(selectedSede || 'ALL');
  const [estado, setEstado] = useState('Todos');
  const [mesa, setMesa] = useState('');
  const [mesero, setMesero] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [busqueda, setBusqueda] = useState('');

  // Sync selectedSede from top bar for Admin
  useEffect(() => {
    if (isAdmin && selectedSede) {
      setFiltroSede(selectedSede);
    }
  }, [isAdmin, selectedSede]);

  // Load branches for Admin
  useEffect(() => {
    if (!isAdmin) return;
    const fetchSedes = async () => {
      try {
        const res = await fetch(`${API}/sedes`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        if (res.ok) {
          const data = await res.json();
          setSedes(data);
        }
      } catch (e) {
        console.error('Error fetching sedes:', e);
      }
    };
    fetchSedes();
  }, [isAdmin]);

  const loadPedidos = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (isAdmin && filtroSede && filtroSede !== 'ALL') {
        params.append('sedeId', filtroSede);
      }
      if (estado && estado !== 'Todos') params.append('estado', estado);
      if (mesa) params.append('mesa', mesa);
      if (mesero) params.append('mesero', mesero);
      if (fechaInicio) params.append('fechaInicio', fechaInicio);
      if (fechaFin) params.append('fechaFin', fechaFin);
      if (busqueda) params.append('busqueda', busqueda);

      const res = await fetch(`${API}/pedidos?${params.toString()}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to load shift orders');
      }
      const data = await res.json();
      setPedidos(data);
      // Auto-select first order if none selected or previous no longer in list
      if (data.length > 0 && (!selectedPedido || !data.some(p => p.id_pedido === selectedPedido.id_pedido))) {
        loadPedidoDetail(data[0].id_pedido);
      } else if (data.length === 0) {
        setSelectedPedido(null);
      }
    } catch (err) {
      setError(err.message);
      setPedidos([]);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, filtroSede, estado, mesa, mesero, fechaInicio, fechaFin, busqueda]);

  const loadPedidoDetail = async (idPedido) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`${API}/pedidos/${idPedido}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedPedido(data);
      }
    } catch (err) {
      console.error('Error loading order detail:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    loadPedidos();
  }, [loadPedidos]);

  return (
    <div className="report-container">
      <div className="report-header">
        <div>
          <h2>Shift Orders</h2>
          <p className="report-subtitle">
            Open and closed {isAdmin ? (filtroSede === 'ALL' ? '· All Branches' : '') : ''}
          </p>
        </div>
      </div>

      <div className="report-filters">
        <div className="report-filter-group">
          <label>Search order or table...</label>
          <input
            type="text"
            placeholder="e.g: #0233 or Table 02"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>

        <div className="report-filter-group">
          <label>Status:</label>
          <select value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="Todos">All</option>
            <option value="Abierto">Open</option>
            <option value="Cerrado">Closed</option>
          </select>
        </div>

        <div className="report-filter-group">
          <label>Table:</label>
          <input
            type="text"
            placeholder="Table No"
            value={mesa}
            onChange={(e) => setMesa(e.target.value)}
            style={{ width: '90px' }}
          />
        </div>

        <div className="report-filter-group">
          <label>Waiter:</label>
          <input
            type="text"
            placeholder="Waiter name"
            value={mesero}
            onChange={(e) => setMesero(e.target.value)}
          />
        </div>

        <div className="report-filter-group">
          <label>From:</label>
          <input
            type="date"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
          />
        </div>

        <div className="report-filter-group">
          <label>To:</label>
          <input
            type="date"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
          />
        </div>

        {isAdmin && (
          <div className="report-filter-group">
            <label>Branch:</label>
            <select value={filtroSede} onChange={(e) => setFiltroSede(e.target.value)}>
              <option value="ALL">All branches</option>
              {sedes.map((s) => (
                <option key={s.id_sede} value={s.id_sede}>
                  {s.nombre_sede}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <div className="report-empty">Loading Shift Orders...</div>
      ) : error ? (
        <div className="report-empty" style={{ color: '#f07a7a' }}>{error}</div>
      ) : pedidos.length === 0 ? (
        <div className="report-empty">No orders found with the applied filters.</div>
      ) : (
        <div className="shifts-layout">
          {/* Main List */}
          <div className="report-table-wrapper">
            <table className="report-table">
              <thead>
                <tr>
                  <th>ORDER</th>
                  <th>TABLE</th>
                  <th>STATUS</th>
                  <th>TOTAL</th>
                  {isAdmin && <th>BRANCH</th>}
                  <th>Hour</th>
                </tr>
              </thead>
              <tbody>
                {pedidos.map((p) => {
                  const isSelected = selectedPedido && selectedPedido.id_pedido === p.id_pedido;
                  return (
                    <tr
                      key={p.id_pedido}
                      onClick={() => loadPedidoDetail(p.id_pedido)}
                      style={{
                        cursor: 'pointer',
                        backgroundColor: isSelected ? '#2a221b' : 'transparent',
                        borderLeft: isSelected ? '4px solid #d4af37' : 'none'
                      }}
                    >
                      <td><strong>#{String(p.id_pedido).padStart(4, '0')}</strong></td>
                      <td>Mesa {p.numero_mesa}</td>
                      <td>
                        <span className={`badge-status ${p.estado === 'Abierto' ? 'badge-abierto' : 'badge-cerrado'}`}>
                          {p.estado}
                        </span>
                      </td>
                      <td>{money(p.total)}</td>
                      {isAdmin && <td>{p.nombre_sede}</td>}
                      <td>{formatTime(p.fecha_apertura)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="shift-detail-panel">
            {loadingDetail ? (
              <p style={{ color: '#a89f91' }}>Loading details...</p>
            ) : selectedPedido ? (
              <>
                <h3>Order #{String(selectedPedido.id_pedido).padStart(4, '0')}</h3>

                <div className="shift-detail-item">
                  <span className="label">Table</span>
                  <span className="value">Table {selectedPedido.numero_mesa}</span>
                </div>

                <div className="shift-detail-item">
                  <span className="label">Status</span>
                  <span className="value">
                    <span className={`badge-status ${selectedPedido.estado === 'Abierto' ? 'badge-abierto' : 'badge-cerrado'}`}>
                      {selectedPedido.estado}
                    </span>
                  </span>
                </div>

                <div className="shift-detail-item">
                  <span className="label">Branch</span>
                  <span className="value">{selectedPedido.nombre_sede}</span>
                </div>

                <div className="shift-detail-item">
                  <span className="label">Waiter</span>
                  <span className="value">{selectedPedido.mesero || '—'}</span>
                </div>

                {selectedPedido.cajero && (
                  <div className="shift-detail-item">
                    <span className="label">Cashier</span>
                    <span className="value">{selectedPedido.cajero}</span>
                  </div>
                )}

                {selectedPedido.medio_pago && (
                  <div className="shift-detail-item">
                    <span className="label">Payment Method</span>
                    <span className="value">{selectedPedido.medio_pago}</span>
                  </div>
                )}

                <div className="shift-detail-item">
                  <span className="label">Opened</span>
                  <span className="value">
                    {formatDate(selectedPedido.fecha_apertura)} {formatTime(selectedPedido.fecha_apertura)}
                  </span>
                </div>

                {selectedPedido.fecha_cierre && (
                  <div className="shift-detail-item">
                    <span className="label">Closed</span>
                    <span className="value">
                      {formatDate(selectedPedido.fecha_cierre)} {formatTime(selectedPedido.fecha_cierre)}
                    </span>
                  </div>
                )}

                <div className="shift-detail-item" style={{ marginTop: '0.8rem', borderTop: '1px solid #3d2c23', paddingTop: '0.6rem' }}>
                  <span className="label" style={{ fontSize: '1.05rem', color: '#d4af37', fontWeight: 600 }}>Total</span>
                  <span className="value" style={{ fontSize: '1.15rem', color: '#d4af37', fontWeight: 700 }}>
                    {money(selectedPedido.total)}
                  </span>
                </div>

                {/* Products detail (CA-02) */}
                <div className="shift-detail-lines">
                  <div style={{ fontSize: '0.85rem', color: '#a89f91', marginBottom: '0.5rem', fontWeight: 600 }}>
                    Productos ({selectedPedido.lineas?.length || 0}):
                  </div>
                  {selectedPedido.lineas?.map((l) => (
                    <div key={l.id_detalle_pedido} className="shift-detail-line">
                      <div>
                        <span>{l.cantidad}x </span>
                        <span>{l.nombre_producto}</span>
                      </div>
                      <span style={{ fontWeight: 600 }}>{money(l.subtotal)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p style={{ color: '#a89f91' }}>Select an order to view details.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

