import { useState, useEffect } from 'react';
import './Billing.css';
import { t, PAYMENT_METHOD_LABEL } from '../i18n';

const API = 'http://localhost:3000/api/v1';
const money = (n) => `$ ${Number(n || 0).toLocaleString('es-CO')}`;
const CASH = 'Efectivo';

/**
 * Close order flow for the Cashier, in two steps.
 * Step 1 (HU-27): optional customer name for the invoice.
 * Step 2 (HU-26): payment method (Cash, Debit Card, Credit Card). For cash the cashier may enter the
 * amount received to see the change; it is only an on-screen calculation, nothing is stored.
 * Confirming closes the order, frees the table and issues the invoice (HU-28, HU-29).
 *
 * @param {Object} props.order - Open order (needs id_pedido, numero_mesa, total).
 * @param {Function} props.onCancel - Closes the modal without closing the order.
 * @param {Function} props.onClosed - Called with the id of the issued invoice.
 */
export default function CloseOrderModal({ order, onCancel, onClosed }) {
  const [step, setStep] = useState(1);
  const [customerName, setCustomerName] = useState('');
  const [methods, setMethods] = useState([]);
  const [methodId, setMethodId] = useState(null);
  const [received, setReceived] = useState('');
  const [loadingMethods, setLoadingMethods] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API}/medios-pago`, { headers: authHeaders() });
        const data = await res.json().catch(() => ([]));
        if (!res.ok) throw new Error(data.error || 'Failed to load the payment methods');
        setMethods(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoadingMethods(false);
      }
    };
    load();
  }, []);

  const selectedMethod = methods.find((m) => m.id_medio_pago === methodId) || null;
  const isCash = selectedMethod?.nombre_metodo === CASH;
  const total = Number(order.total || 0);
  const receivedNumber = Number(received);
  const hasReceived = received !== '' && Number.isFinite(receivedNumber);
  const receivedTooLow = isCash && hasReceived && receivedNumber < total;
  const change = isCash && hasReceived && receivedNumber >= total ? receivedNumber - total : null;

  const handleConfirm = async () => {
    if (!selectedMethod) {
      setError('Select a payment method');
      return;
    }
    if (receivedTooLow) {
      setError('The amount received is less than the total');
      return;
    }

    setError('');
    setSaving(true);
    try {
      const res = await fetch(`${API}/pedidos/${order.id_pedido}/cerrar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ id_medio_pago: selectedMethod.id_medio_pago, nombre_cliente: customerName }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to close the order');
      onClosed(data.id_factura);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <div className="billing-overlay">
      <div className="billing-modal">
        <h3>{step === 1 ? 'Close Order' : 'Confirm payment'}</h3>
        <p className="billing-sub">
          Table {order.numero_mesa} · Order #{String(order.id_pedido).padStart(4, '0')}
        </p>

        {error && <div className="billing-error">{error}</div>}

        {step === 1 && (
          <>
            <div className="billing-group">
              <label htmlFor="billing-customer">Customer name (optional)</label>
              <input
                id="billing-customer"
                type="text"
                maxLength={100}
                placeholder="Final Consumer"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="billing-total">
              <span>Total to pay</span>
              <strong>{money(total)}</strong>
            </div>
            <div className="billing-actions">
              <button type="button" className="billing-btn" onClick={onCancel}>Cancel</button>
              <button type="button" className="billing-btn billing-btn-primary" onClick={() => { setError(''); setStep(2); }}>
                Continue
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="billing-total">
              <span>Total to pay</span>
              <strong>{money(total)}</strong>
            </div>

            {loadingMethods ? (
              <p className="billing-sub">Loading payment methods...</p>
            ) : (
              <div className="billing-methods">
                {methods.map((m) => (
                  <button
                    key={m.id_medio_pago}
                    type="button"
                    className={`billing-method${m.id_medio_pago === methodId ? ' billing-method-selected' : ''}`}
                    aria-pressed={m.id_medio_pago === methodId}
                    onClick={() => { setMethodId(m.id_medio_pago); setError(''); }}
                  >
                    {t(PAYMENT_METHOD_LABEL, m.nombre_metodo)}
                  </button>
                ))}
              </div>
            )}

            {isCash && (
              <div className="billing-group">
                <label htmlFor="billing-received">Amount received (optional)</label>
                <input
                  id="billing-received"
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  value={received}
                  onChange={(e) => setReceived(e.target.value)}
                />
                {receivedTooLow && <p className="billing-hint billing-hint-bad">The amount received is less than the total.</p>}
                {change !== null && <p className="billing-hint">Change to give back: <strong>{money(change)}</strong></p>}
              </div>
            )}

            <div className="billing-actions">
              <button type="button" className="billing-btn" onClick={() => { setError(''); setStep(1); }} disabled={saving}>
                Back
              </button>
              <button
                type="button"
                className="billing-btn billing-btn-primary"
                onClick={handleConfirm}
                disabled={saving || !selectedMethod || receivedTooLow}
              >
                {saving ? 'Closing...' : 'Confirm payment'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}