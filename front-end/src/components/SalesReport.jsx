import { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import './Reports.css';

const API = 'http://localhost:3000/api/v1';
const money = (n) => `$ ${Number(n || 0).toLocaleString('es-CO')}`;

// Format today as YYYY-MM-DD
const getTodayStr = () => {
  const d = new Date();
  return d.toISOString().split('T')[0];
};

// First day of current month
const getFirstDayOfMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

/**
 * HU-32: Consultar reporte de ventas por fecha y sede
 * CA-01: Mandatory date range (fechaInicio, fechaFin). Sede filter only for Administrator (including "Todas las sedes").
 * CA-02: Shows at least: fecha, codigo_producto, cantidad vendida, valor de compra, valor de venta y ganancia (venta - compra * cantidad).
 * CA-03: Filter strictly by order opening date (fecha_apertura).
 * CA-04: Cashier automatically restricted to their branch, branch selector hidden.
 * CA-05: Message "No se encontraron resultados para el periodo y sede seleccionados".
 *
 * HU-33: Exportar reporte de ventas a Excel (.xlsx)
 * CA-01: Exports same columns and filters applied.
 * CA-02: Header row with column names and a summary row of totals.
 * CA-03: "Exportar a Excel" button disabled when there are no results.
 * CA-04: Automatic file name includes date range and queried branch: Reporte_Ventas_{sede}_{fechaInicio}_{fechaFin}.xlsx
 */
export default function SalesReport({ userRol, selectedSede }) {
  const isAdmin = userRol === 'Administrador';

  const [fechaInicio, setFechaInicio] = useState(getFirstDayOfMonth());
  const [fechaFin, setFechaFin] = useState(getTodayStr());
  const [filtroSede, setFiltroSede] = useState(selectedSede || 'ALL');
  const [sedes, setSedes] = useState([]);

  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [viewMode, setViewMode] = useState('resumen'); // 'resumen' (mockup) | 'detalle' (CA-02 product level)
  const [error, setError] = useState('');

  // Sync selectedSede from top bar if admin changes it
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

  const fetchReport = useCallback(async () => {
    if (!fechaInicio || !fechaFin) {
      setError('Las fechas inicial y final son obligatorias.');
      return;
    }
    setLoading(true);
    setError('');
    setSearched(true);

    try {
      const params = new URLSearchParams({ fechaInicio, fechaFin });
      if (isAdmin && filtroSede && filtroSede !== 'ALL') {
        params.append('sedeId', filtroSede);
      }

      const res = await fetch(`${API}/reportes/ventas?${params.toString()}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Error to get Sales Report');
      }
      const data = await res.json();
      setReportData(data);
    } catch (err) {
      setError(err.message);
      setReportData(null);
    } finally {
      setLoading(false);
    }
  }, [fechaInicio, fechaFin, isAdmin, filtroSede]);

  // Initial load
  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const hasResults = reportData && (
    (viewMode === 'resumen' && reportData.resumenDiario.length > 0) ||
    (viewMode === 'detalle' && reportData.productos.length > 0)
  );

  /**
   * HU-33: Export to Excel (.xlsx)
   */
  const handleExportExcel = () => {
    if (!hasResults || !reportData) return;

    const wb = XLSX.utils.book_new();

    // Sheet 1: Daily summary
    const summaryData = reportData.resumenDiario.map((r) => ({
      Fecha: r.fecha,
      Pedidos: r.pedidos,
      'Ventas ($)': r.ventas,
      'Ganancia ($)': r.ganancia,
      'Ticket Promedio ($)': r.ticket_promedio
    }));
    // Append totals row (CA-02)
    summaryData.push({
      Fecha: 'Total General',
      Pedidos: reportData.totales.pedidos,
      'Ventas ($)': reportData.totales.ventas,
      'Ganancia ($)': reportData.totales.ganancia,
      'Ticket Promedio ($)': reportData.totales.ticket_promedio
    });

    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen Diario');

    // Sheet 2: Products Detail (CA-02)
    const productData = reportData.productos.map((p) => ({
      Fecha: p.fecha,
      Sede: p.nombre_sede,
      'Código Producto': p.codigo_producto,
      Producto: p.nombre_producto,
      'Cantidad Vendida': p.cantidad_vendida,
      'Valor Compra ($)': p.valor_compra,
      'Valor Venta ($)': p.valor_venta,
      'Total Venta ($)': p.total_venta,
      'Ganancia ($)': p.ganancia
    }));
    // Append totals row
    productData.push({
      Fecha: 'Total General',
      Sede: '—',
      'Código Producto': '—',
      Producto: '—',
      'Cantidad Vendida': reportData.productos.reduce((sum, p) => sum + p.cantidad_vendida, 0),
      'Valor Compra ($)': '—',
      'Valor Venta ($)': '—',
      'Total Venta ($)': reportData.totales.ventas,
      'Ganancia ($)': reportData.totales.ganancia
    });

    const wsProduct = XLSX.utils.json_to_sheet(productData);
    XLSX.utils.book_append_sheet(wb, wsProduct, 'Detalle por Producto');

    // Filename: Reporte_Ventas_{sede}_{fechaInicio}_{fechaFin}.xlsx (HU-33 CA-04)
    const safeSede = (reportData.sedeConsultada || 'Sede')
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_-]/g, '');
    const filename = `Reporte_Ventas_${safeSede}_${fechaInicio}_${fechaFin}.xlsx`;

    XLSX.writeFile(wb, filename);
  };

  return (
    <div className="report-container">
      <div className="report-header">
        <div>
          <h2>Sales Report</h2>
          <p className="report-subtitle">
            Filtered by date and location · {reportData?.sedeConsultada || ''}
          </p>
        </div>

        {/* HU-33 CA-01, CA-03: Export to Excel button top right */}
        <button
          className="report-btn report-btn-excel"
          onClick={handleExportExcel}
          disabled={!hasResults || loading}
          title={!hasResults ? 'No hay resultados para exportar' : 'Descargar reporte en formato .xlsx'}
        >
          Export to Excel.
        </button>
      </div>

      {/* HU-32 CA-01, CA-03, CA-04: Mandatory filters */}
      <div className="report-filters">
        <div className="report-filter-group">
          <label>From (Opening) *:</label>
          <input
            type="date"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
            required
          />
        </div>

        <div className="report-filter-group">
          <label>To (Opening) *:</label>
          <input
            type="date"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
            required
          />
        </div>

        {/* CA-04: Sede filter visible only for Administrator */}
        {isAdmin && (
          <div className="report-filter-group">
            <label>Branch:</label>
            <select value={filtroSede} onChange={(e) => setFiltroSede(e.target.value)}>
              <option value="ALL">Todas las sedes</option>
              {sedes.map((s) => (
                <option key={s.id_sede} value={s.id_sede}>
                  {s.nombre_sede}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="report-filter-group">
          <label>View:</label>
          <select value={viewMode} onChange={(e) => setViewMode(e.target.value)}>
            <option value="resumen">Daily Summary (Sales and Average Ticket)</option>
            <option value="detalle">Detail by Product (Purchases, Sales, and Profit)</option>
          </select>
        </div>

        <div className="report-filter-group">
          <button
            className="report-btn report-btn-primary"
            onClick={fetchReport}
            disabled={loading}
          >
            {loading ? 'Consulting...' : 'Consult'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="report-empty">Generating Sales Report...</div>
      ) : error ? (
        <div className="report-empty" style={{ color: '#f07a7a' }}>{error}</div>
      ) : searched && !hasResults ? (
        <div className="report-empty">
          No results found for the selected period and location.
        </div>
      ) : reportData && (
        <>
          {viewMode === 'resumen' ? (
            <div className="report-table-wrapper">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Orders</th>
                    <th>Sales</th>
                    <th>Profit</th>
                    <th>AVG. ticket.</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.resumenDiario.map((r) => (
                    <tr key={r.fecha}>
                      <td>{r.fecha}</td>
                      <td>{r.pedidos}</td>
                      <td><strong>{money(r.ventas)}</strong></td>
                      <td style={{ color: '#66bb6a' }}>{money(r.ganancia)}</td>
                      <td>{money(r.ticket_promedio)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Total</td>
                    <td>{reportData.totales.pedidos}</td>
                    <td>{money(reportData.totales.ventas)}</td>
                    <td style={{ color: '#66bb6a' }}>{money(reportData.totales.ganancia)}</td>
                    <td>{money(reportData.totales.ticket_promedio)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="report-table-wrapper">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    {isAdmin && <th>Branch</th>}
                    <th>Cód. Product</th>
                    <th>Product</th>
                    <th>Quantity Sold</th>
                    <th>Purchase Price</th>
                    <th>Sale Price</th>
                    <th>Total Sales</th>
                    <th>Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.productos.map((p, idx) => (
                    <tr key={`${p.fecha}-${p.id_producto}-${idx}`}>
                      <td>{p.fecha}</td>
                      {isAdmin && <td>{p.nombre_sede}</td>}
                      <td><code>{p.codigo_producto}</code></td>
                      <td>{p.nombre_producto}</td>
                      <td>{p.cantidad_vendida}</td>
                      <td>{money(p.valor_compra)}</td>
                      <td>{money(p.valor_venta)}</td>
                      <td><strong>{money(p.total_venta)}</strong></td>
                      <td style={{ color: p.ganancia >= 0 ? '#66bb6a' : '#f07a7a', fontWeight: 600 }}>
                        {money(p.ganancia)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={isAdmin ? 4 : 3}>Total General</td>
                    <td>{reportData.productos.reduce((sum, p) => sum + p.cantidad_vendida, 0)}</td>
                    <td>—</td>
                    <td>—</td>
                    <td>{money(reportData.totales.ventas)}</td>
                    <td style={{ color: '#66bb6a' }}>{money(reportData.totales.ganancia)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

