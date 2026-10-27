import { useState, useEffect, useCallback } from 'react';
import './Reports.css';

const API = 'http://localhost:3000/api/v1';
const money = (n) => `$ ${Number(n || 0).toLocaleString('es-CO')}`;
const formatDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

/**
 * HU-30: Consultar histórico de reabastecimientos
 * CA-01: List with date, product, quantity, total value and branch; filterable by date range and branch.
 * CA-02: Sort by date ASC or DESC.
 * CA-03: Read-only audit (no editing or deletion).
 */
export default function RestockHistory({ userRol, selectedSede }) {
  const isAdmin = userRol === 'Administrador';

  const [historico, setHistorico] = useState([]);
  const [sedes, setSedes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [filtroSede, setFiltroSede] = useState(selectedSede || 'ALL');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [orden, setOrden] = useState('DESC');
  const [busqueda, setBusqueda] = useState('');

  // Sync selectedSede from top bar if admin changes it
  useEffect(() => {
    if (isAdmin && selectedSede) {
      setFiltroSede(selectedSede);
    }
  }, [isAdmin, selectedSede]);

  // Load branches for filter dropdown (Admin only)
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

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (isAdmin && filtroSede && filtroSede !== 'ALL') {
        params.append('sedeId', filtroSede);
      }
      if (fechaInicio) params.append('fechaInicio', fechaInicio);
      if (fechaFin) params.append('fechaFin', fechaFin);
      if (orden) params.append('orden', orden);
      if (busqueda) params.append('busqueda', busqueda);

      const res = await fetch(`${API}/reabastecimientos/historico?${params.toString()}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to load restock history');
      }
      const data = await res.json();
      setHistorico(data);
    } catch (err) {
      setError(err.message);
      setHistorico([]);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, filtroSede, fechaInicio, fechaFin, orden, busqueda]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  return (
    <div className="report-container">
      <div className="report-header">
        <div>
          <h2>Restock History</h2>
          <p className="report-subtitle">Search with date and location filters</p>
        </div>
      </div>

      <div className="report-filters">
        <div className="report-filter-group">
          <label>Search product...</label>
          <input
            type="text"
            placeholder="Name or code..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
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

        <div className="report-filter-group">
          <label>Sort by date:</label>
          <select value={orden} onChange={(e) => setOrden(e.target.value)}>
            <option value="DESC">Newest first (Descending)</option>
            <option value="ASC">Oldest first (Ascending)</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="report-empty">Cargando histórico de reabastecimientos...</div>
      ) : error ? (
        <div className="report-empty" style={{ color: '#f07a7a' }}>{error}</div>
      ) : historico.length === 0 ? (
        <div className="report-empty">No restocks found for the selected filters.</div>
      ) : (
        <div className="report-table-wrapper">
          <table className="report-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Product</th>
                <th>Quantity</th>
                <th>Total value</th>
                <th>Branch</th>
                <th>User</th>
              </tr>
            </thead>
            <tbody>
              {historico.map((r) => (
                <tr key={r.id_reabastecimiento}>
                  <td>{formatDate(r.fecha_reabastecimiento)}</td>
                  <td>
                    <strong>{r.nombre_producto}</strong>
                    <div style={{ fontSize: '0.8rem', color: '#a89f91' }}>{r.codigo_producto}</div>
                  </td>
                  <td>{r.cantidad}</td>
                  <td>{money(r.valor_total)}</td>
                  <td>{r.nombre_sede}</td>
                  <td>{r.usuario_responsable}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

