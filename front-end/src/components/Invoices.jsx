import { useState, useEffect, useCallback } from 'react';
import './Billing.css';
import Invoice from './Invoice';
import { t, PAYMENT_METHOD_LABEL, CUSTOMER_LABEL } from '../i18n';

const API = 'http://localhost:3000/api/v1';
const money = (n) => `$ ${Number(n || 0).toLocaleString('es-CO')}`;
const formatDateTime = (iso) =>
  new Date(iso).toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  });

/**
 * HU-29 CA-03 - Closed orders module: lists the issued invoices and lets the user view, print or download them.
 * The Cashier only sees the invoices of their own branch; the Administrator sees the selected branch or all.
 *
 * @param {string|number} props.selectedSede - Selected branch ("ALL" = every branch, Administrator only).
 */
export default function Invoices({ selectedSede }) {
  const [facturas, setFacturas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/facturas?sedeId=${selectedSede || 'ALL'}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await res.json().catch(() => ([]));
      if (!res.ok) throw new Error(data.error || 'Failed to load the closed orders');
      setFacturas(data);
      setError('');
    } catch (err) {
      setError(err.message);
      setFacturas([]);
    } finally {
      setLoading(false);
    }
  }, [selectedSede]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="billing-page">
      <div className="billing-page-head">
        <div>
          <h2>Closed Orders</h2>
          <p className="billing-sub">Issued invoices</p>
        </div>
        <button type="button" className="billing-btn" onClick={load}>Refresh</button>
      </div>

      {error && <div className="billing-error">{error}</div>}

      {loading ? (
        <p>Loading closed orders...</p>
      ) : facturas.length === 0 ? (
        <div className="billing-empty">No closed orders yet</div>
      ) : (
        <div className="billing-scroll">
          <table className="billing-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Date</th>
                <th>Branch</th>
                <th>Table</th>
                <th>Customer</th>
                <th>Payment</th>
                <th className="billing-num">Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {facturas.map((f) => (
                <tr key={f.id_factura}>
                  <td>{String(f.id_factura).padStart(5, '0')}</td>
                  <td>{formatDateTime(f.fecha_emision)}</td>
                  <td>{String(f.nombre_sede).split('—').pop().trim()}</td>
                  <td>{f.numero_mesa}</td>
                  <td>{t(CUSTOMER_LABEL, f.nombre_cliente)}</td>
                  <td>{t(PAYMENT_METHOD_LABEL, f.nombre_metodo)}</td>
                  <td className="billing-num">{money(f.total_venta)}</td>
                  <td>
                    <button type="button" className="billing-btn billing-btn-small" onClick={() => setOpenId(f.id_factura)}>
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openId !== null && <Invoice idFactura={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}