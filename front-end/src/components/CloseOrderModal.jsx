import { useState, useEffect } from 'react';
import './Billing.css';
import { t, PAYMENT_METHOD_LABEL } from '../i18n';

const API = 'http://localhost:3000/api/v1';
const money = (n) => `$ ${Number(n || 0).toLocaleString('es-CO')}`;
const CASH = 'Efectivo';

/**
 * Close order flow for the Cashier, in two steps.
 * Step 1 (HU-27): optional customer name for the invoice.
 * Step 2 (HU-26): payment method (Cash, Debit Card, Credit Card).
 * For cash: applies the Algoritmo Voraz (Greedy Algorithm) to calculate the optimal breakdown
 * of bills and coins to hand to the customer (minimum number of pieces).
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
  const [vorazDesglose, setVorazDesglose] = useState(null);

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

  // Ejecución del Algoritmo Voraz para desglose óptimo de cambio
  useEffect(() => {
    if (isCash && change !== null && change > 0) {
      const denoms = [
        { valor: 100000, tipo: 'Billete' },
        { valor: 50000, tipo: 'Billete' },
        { valor: 20000, tipo: 'Billete' },
        { valor: 10000, tipo: 'Billete' },
        { valor: 5000, tipo: 'Billete' },
        { valor: 2000, tipo: 'Billete' },
        { valor: 1000, tipo: 'Moneda / Billete' },
        { valor: 500, tipo: 'Moneda' },
        { valor: 200, tipo: 'Moneda' },
        { valor: 100, tipo: 'Moneda' },
        { valor: 50, tipo: 'Moneda' }
      ];

      let resto = Math.round(change);
      const piezas = [];
      let totalCount = 0;

      for (const d of denoms) {
        if (resto >= d.valor) {
          const count = Math.floor(resto / d.valor);
          resto = resto % d.valor;
          totalCount += count;
          piezas.push({ valor: d.valor, tipo: d.tipo, cantidad: count });
        }
      }

      setVorazDesglose({ totalPiezas: totalCount, items: piezas });
    } else {
      setVorazDesglose(null);
    }
  }, [isCash, change]);

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
              <div className="billing-group" style={{ marginTop: '0.8rem' }}>
                <label htmlFor="billing-received">Amount received (Cash)</label>
                <input
                  id="billing-received"
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  placeholder="e.g. 50000"
                  value={received}
                  onChange={(e) => setReceived(e.target.value)}
                />
                {receivedTooLow && <p className="billing-hint billing-hint-bad">The amount received is less than the total.</p>}
                {change !== null && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <p className="billing-hint" style={{ fontSize: '0.95rem', color: '#fff' }}>
                      Change to give back: <strong style={{ color: '#d4af37' }}>{money(change)}</strong>
                    </p>

                    {/* Desglose Óptimo con Algoritmo Voraz */}
                    {vorazDesglose && vorazDesglose.items.length > 0 && (
                      <div style={{ background: '#121212', border: '1px solid #3d2c23', borderRadius: '6px', padding: '0.65rem 0.8rem', marginTop: '0.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                          <span style={{ fontSize: '0.78rem', color: '#d4af37', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            ⚡ Desglose Voraz (Mínimo de piezas):
                          </span>
                          <span style={{ fontSize: '0.75rem', background: '#d4af37', color: '#121212', padding: '0.1rem 0.45rem', borderRadius: '10px', fontWeight: 800 }}>
                            {vorazDesglose.totalPiezas} {vorazDesglose.totalPiezas === 1 ? 'pieza' : 'piezas'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                          {vorazDesglose.items.map((it, idx) => (
                            <span key={idx} style={{ background: '#221c17', border: '1px solid #4a382c', color: '#eaeaea', fontSize: '0.8rem', padding: '0.2rem 0.45rem', borderRadius: '4px' }}>
                              <strong style={{ color: '#d4af37' }}>{it.cantidad}x</strong> {money(it.valor)} <small style={{ color: '#a89f91' }}>({it.tipo})</small>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
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
