import { useState, useEffect } from 'react';
import './Billing.css';
import { t, PAYMENT_METHOD_LABEL, CUSTOMER_LABEL } from '../i18n';

const API = 'http://localhost:3000/api/v1';
const money = (n) => `$ ${Number(n || 0).toLocaleString('es-CO')}`;
const invoiceNumber = (id) => String(id).padStart(5, '0');
const formatDate = (iso) =>
  new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
const formatTime = (iso) =>
  new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false });
const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Standalone HTML file of the invoice for the "Download" action
const buildInvoiceHtml = (f) => `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Invoice ${invoiceNumber(f.id_factura)}</title>
<style>
body{font-family:Arial,Helvetica,sans-serif;max-width:420px;margin:2rem auto;color:#111}
h1{font-size:1.3rem;margin:0}.c{text-align:center}table{width:100%;border-collapse:collapse;margin:1rem 0}
th,td{padding:.35rem 0;text-align:left;border-bottom:1px solid #ddd;font-size:.9rem}th:nth-child(n+2),td:nth-child(n+2){text-align:right}
.total{display:flex;justify-content:space-between;font-weight:bold;font-size:1.1rem}.meta{margin-top:1rem;font-size:.85rem}
</style></head><body>
<div class="c"><h1>La Penúltima Lounge</h1><div>${escapeHtml(f.nombre_sede)}</div>
<div>Invoice No. <strong>${invoiceNumber(f.id_factura)}</strong></div>
<div>${formatDate(f.fecha_emision)} · ${formatTime(f.fecha_emision)}</div></div>
<table><thead><tr><th>Product</th><th>Qty</th><th>Subtotal</th></tr></thead><tbody>
${f.lineas.map((l) => `<tr><td>${escapeHtml(l.nombre_producto)}</td><td>${l.cantidad}</td><td>${money(l.subtotal)}</td></tr>`).join('')}
</tbody></table>
<div class="total"><span>Total</span><span>${money(f.total_venta)}</span></div>
<div class="meta">Customer: ${escapeHtml(t(CUSTOMER_LABEL, f.nombre_cliente || 'Consumidor Final'))}<br>
Table: ${escapeHtml(f.numero_mesa)}<br>Cashier: ${escapeHtml(f.nombre_cajero || '-')}<br>
Payment: ${escapeHtml(t(PAYMENT_METHOD_LABEL, f.nombre_metodo))}</div>
</body></html>`;

/**
 * Sale invoice preview (HU-29). Read-only: there is no way to edit an issued invoice.
 * Print uses the browser print dialog (only the sheet is printed); Download saves a standalone HTML file.
 *
 * @param {number} props.idFactura - Invoice to show.
 * @param {Function} props.onClose - Closes the preview.
 */
export default function Invoice({ idFactura, onClose }) {
  const [factura, setFactura] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API}/facturas/${idFactura}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Failed to load the invoice');
        setFactura(data);
      } catch (err) {
        setError(err.message);
      }
    };
    load();
  }, [idFactura]);

  const handleDownload = () => {
    const blob = new Blob([buildInvoiceHtml(factura)], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `invoice-${invoiceNumber(factura.id_factura)}.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="billing-overlay">
      <div className="invoice-modal">
        {error && <div className="billing-error">{error}</div>}
        {!factura && !error && <p className="billing-sub">Loading invoice...</p>}

        {factura && (
          <div className="invoice-paper invoice-printable">
            <div className="invoice-head">
              <h3>La Penúltima Lounge</h3>
              <div>{factura.nombre_sede}</div>
              <div>Invoice No. <strong>{invoiceNumber(factura.id_factura)}</strong></div>
              <div>{formatDate(factura.fecha_emision)} · {formatTime(factura.fecha_emision)}</div>
            </div>

            <table className="invoice-lines">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Unit price</th>
                  <th>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {factura.lineas.map((l) => (
                  <tr key={l.id_detalle_pedido}>
                    <td>{l.nombre_producto}</td>
                    <td>{l.cantidad}</td>
                    <td>{money(l.precio_unitario)}</td>
                    <td>{money(l.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="invoice-total">
              <span>Total</span>
              <strong>{money(factura.total_venta)}</strong>
            </div>

            <dl className="invoice-meta">
              <dt>Customer</dt>
              <dd>{t(CUSTOMER_LABEL, factura.nombre_cliente || 'Consumidor Final')}</dd>
              <dt>Table</dt>
              <dd>{factura.numero_mesa}</dd>
              <dt>Cashier</dt>
              <dd>{factura.nombre_cajero || '-'}</dd>
              <dt>Payment</dt>
              <dd>{t(PAYMENT_METHOD_LABEL, factura.nombre_metodo)}</dd>
            </dl>
          </div>
        )}

        <div className="billing-actions no-print">
          <button type="button" className="billing-btn" onClick={onClose}>Close</button>
          {factura && (
            <>
              <button type="button" className="billing-btn" onClick={handleDownload}>Download</button>
              <button type="button" className="billing-btn billing-btn-primary" onClick={() => window.print()}>Print</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}