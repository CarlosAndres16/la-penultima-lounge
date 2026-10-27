import { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import './Reports.css';

const API = 'http://localhost:3000/api/v1';
const money = (n) => `$ ${Number(n || 0).toLocaleString('es-CO')}`;

// First day of current month
const getFirstDayOfMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};
const getTodayStr = () => new Date().toISOString().split('T')[0];

/**
 * HU-34: Consolidación de reportes multisede para Administrador
 * CA-01: When Administrator selects "Todas las sedes", present data grouped by branch with a subtotal per branch and total general.
 * CA-02: Comparative performance summary (total sold and profit per branch) within the queried period.
 * CA-03: Exclusively visible and available for Administrator (not visible to Cashier).
 */
export default function ConsolidatedReport() {
  const [fechaInicio, setFechaInicio] = useState(getFirstDayOfMonth());
  const [fechaFin, setFechaFin] = useState(getTodayStr());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadConsolidado = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (fechaInicio) params.append('fechaInicio', fechaInicio);
      if (fechaFin) params.append('fechaFin', fechaFin);

      const res = await fetch(`${API}/reportes/consolidado?${params.toString()}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Error to get Consolidated Report');
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [fechaInicio, fechaFin]);

  useEffect(() => {
    loadConsolidado();
  }, [loadConsolidado]);

  const handleExport = () => {
    if (!data || !data.sedes.length) return;
    const wb = XLSX.utils.book_new();

    const exportRows = data.sedes.map((s) => ({
      Sede: s.nombre_sede,
      'Código Sede': s.codigo_sede,
      Pedidos: s.pedidos,
      'Ventas ($)': s.ventas,
      'Ganancia ($)': s.ganancia,
      'Inventario Valorizado ($)': s.inventario_valorizado
    }));

    exportRows.push({
      Sede: 'Total General',
      'Código Sede': '—',
      Pedidos: data.totalGeneral.pedidos,
      'Ventas ($)': data.totalGeneral.ventas,
      'Ganancia ($)': data.totalGeneral.ganancia,
      'Inventario Valorizado ($)': data.totalGeneral.inventario_valorizado
    });

    const ws = XLSX.utils.json_to_sheet(exportRows);
    XLSX.utils.book_append_sheet(wb, ws, 'Multi-location Consolidated');
    XLSX.writeFile(wb, `Reporte_Consolidado_Multisede_${fechaInicio || 'inicio'}_${fechaFin || 'fin'}.xlsx`);
  };

  return (
    <div className="report-container">
      <div className="report-header">
        <div>
          <h2>Consolidated Report</h2>
          <p className="report-subtitle">Grouped by location · All branches</p>
        </div>

        <button
          className="report-btn report-btn-excel"
          onClick={handleExport}
          disabled={!data || data.sedes.length === 0}
        >
         Export to Excel.
        </button>
      </div>

      <div className="report-filters">
        <div className="report-filter-group">
          <label>From (Opening):</label>
          <input
            type="date"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
          />
        </div>

        <div className="report-filter-group">
          <label>To (Opening):</label>
          <input
            type="date"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
          />
        </div>

        <div className="report-filter-group">
          <button
            className="report-btn report-btn-primary"
            onClick={loadConsolidado}
            disabled={loading}
          >
            {loading ? 'Consulting...' : 'Filter Period'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="report-empty">Loading multi-branch consolidation...</div>
      ) : error ? (
        <div className="report-empty" style={{ color: '#f07a7a' }}>{error}</div>
      ) : !data || data.sedes.length === 0 ? (
        <div className="report-empty">No branch information available.</div>
      ) : (
        <div className="report-table-wrapper">
          <table className="report-table">
            <thead>
              <tr>
                <th>Branch</th>
                <th>Orders</th>
                <th>Sales</th>
                <th>Profit</th>
                <th>Inventory Value</th>
              </tr>
            </thead>
            <tbody>
              {data.sedes.map((s) => (
                <tr key={s.id_sede}>
                  <td>
                    <strong>{s.nombre_sede}</strong>
                    <div style={{ fontSize: '0.8rem', color: '#a89f91' }}>{s.codigo_sede}</div>
                  </td>
                  <td>{s.pedidos}</td>
                  <td><strong>{money(s.ventas)}</strong></td>
                  <td style={{ color: s.ganancia > 0 ? '#66bb6a' : '#eaeaea' }}>
                    {money(s.ganancia)}
                  </td>
                  <td>{money(s.inventario_valorizado)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total general</td>
                <td>{data.totalGeneral.pedidos}</td>
                <td>{money(data.totalGeneral.ventas)}</td>
                <td style={{ color: '#66bb6a' }}>{money(data.totalGeneral.ganancia)}</td>
                <td>{money(data.totalGeneral.inventario_valorizado)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

