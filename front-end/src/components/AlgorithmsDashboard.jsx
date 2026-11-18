import { useState } from 'react';
import './AlgorithmsDashboard.css';

const API = 'http://localhost:3000/api/v1';
const money = (n) => `$ ${Number(n || 0).toLocaleString('en-US')}`;

export default function AlgorithmsDashboard() {
  const [activeSubTab, setActiveSubTab] = useState('voraz'); // 'voraz' | 'mochila' | 'backtracking'

  // ==========================================
  // STATE: 1. GREEDY ALGORITHM
  // ==========================================
  const [montoPagar, setMontoPagar] = useState(37500);
  const [montoRecibido, setMontoRecibido] = useState(100000);
  const [loadingVoraz, setLoadingVoraz] = useState(false);
  const [resultadoVoraz, setResultadoVoraz] = useState(null);
  const [errorVoraz, setErrorVoraz] = useState('');

  const ejecutarVoraz = async () => {
    setLoadingVoraz(true);
    setErrorVoraz('');
    try {
      const res = await fetch(`${API}/algoritmos/voraz-cambio`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ montoPagar, montoRecibido })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to execute greedy algorithm');
      setResultadoVoraz(data);
    } catch (err) {
      setErrorVoraz(err.message);
    } finally {
      setLoadingVoraz(false);
    }
  };

  // ==========================================
  // STATE: 2. KNAPSACK PROBLEM
  // ==========================================
  const [presupuesto, setPresupuesto] = useState(150000);
  const [loadingMochila, setLoadingMochila] = useState(false);
  const [resultadoMochila, setResultadoMochila] = useState(null);
  const [errorMochila, setErrorMochila] = useState('');

  const ejecutarMochila = async () => {
    setLoadingMochila(true);
    setErrorMochila('');
    try {
      const res = await fetch(`${API}/algoritmos/mochila-presupuesto`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ presupuesto, escala: 500 })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to execute knapsack algorithm');
      setResultadoMochila(data);
    } catch (err) {
      setErrorMochila(err.message);
    } finally {
      setLoadingMochila(false);
    }
  };

  // ==========================================
  // STATE: 3. BACKTRACKING
  // ==========================================
  const [subTipoBacktracking, setSubTipoBacktracking] = useState('combos'); // 'combos' | 'mesas'
  const [valorObjetivo, setValorObjetivo] = useState(25000);
  const [gruposMesas, setGruposMesas] = useState('4, 2, 6, 2');
  const [loadingBacktrack, setLoadingBacktrack] = useState(false);
  const [resultadoBacktrack, setResultadoBacktrack] = useState(null);
  const [errorBacktrack, setErrorBacktrack] = useState('');

  const ejecutarBacktrack = async () => {
    setLoadingBacktrack(true);
    setErrorBacktrack('');
    try {
      const endpoint = subTipoBacktracking === 'combos'
        ? `${API}/algoritmos/backtracking-combos`
        : `${API}/algoritmos/backtracking-mesas`;

      const payload = subTipoBacktracking === 'combos'
        ? { valorObjetivo }
        : { gruposComensales: gruposMesas.split(',').map((n) => Number(n.trim())).filter((n) => n > 0) };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to execute backtracking');
      setResultadoBacktrack(data);
    } catch (err) {
      setErrorBacktrack(err.message);
    } finally {
      setLoadingBacktrack(false);
    }
  };

  return (
    <div className="algo-container">
      <div className="algo-header">
        <h2>Classical Algorithms Lab</h2>
        <p>Theoretical and functional implementation of Greedy, 0/1 Knapsack, and Backtracking algorithms in the POS system.</p>
      </div>

      {/* Navigation Subtabs */}
      <div className="algo-subtabs">
        <button
          className={`algo-subtab-btn ${activeSubTab === 'voraz' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('voraz')}
        >
          1. Greedy Algorithm
        </button>
        <button
          className={`algo-subtab-btn ${activeSubTab === 'mochila' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('mochila')}
        >
          2. Knapsack Problem (0/1)
        </button>
        <button
          className={`algo-subtab-btn ${activeSubTab === 'backtracking' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('backtracking')}
        >
          3. Backtracking
        </button>
      </div>

      {/* ============================================================== */}
      {/* 1. SECTION: GREEDY ALGORITHM                                   */}
      {/* ============================================================== */}
      {activeSubTab === 'voraz' && (
        <div className="algo-card">
          <div className="algo-card-title">
            <span>Optimal Cash Register Change Breakdown</span>
            <span className="algo-theory-badge">Complexity: O(D) time | O(1) space</span>
          </div>

          <p style={{ color: '#a89f91', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
            Applies the <strong>Greedy Choice Property</strong>: at each step, delivers the maximum possible quantity of the
            largest remaining denomination, guaranteeing the minimum total number of bills and coins.
          </p>

          <div className="algo-form-grid">
            <div className="algo-input-group">
              <label>Total Bill Amount ($):</label>
              <input
                type="number"
                step="50"
                value={montoPagar}
                onChange={(e) => setMontoPagar(Number(e.target.value))}
              />
            </div>
            <div className="algo-input-group">
              <label>Cash Received from Customer ($):</label>
              <input
                type="number"
                step="50"
                value={montoRecibido}
                onChange={(e) => setMontoRecibido(Number(e.target.value))}
              />
            </div>
            <div>
              <button
                className="algo-btn-action"
                onClick={ejecutarVoraz}
                disabled={loadingVoraz || montoRecibido < montoPagar}
              >
                {loadingVoraz ? 'Calculating...' : 'Calculate Greedy Change'}
              </button>
            </div>
          </div>

          {errorVoraz && <p style={{ color: '#f07a7a' }}>{errorVoraz}</p>}

          {resultadoVoraz && (
            <div style={{ marginTop: '1.5rem' }}>
              <div className="algo-stats-grid">
                <div className="algo-stat-box">
                  <div className="algo-stat-label">Total Change</div>
                  <div className="algo-stat-value">{money(resultadoVoraz.cambioEntregado)}</div>
                </div>
                <div className="algo-stat-box">
                  <div className="algo-stat-label">Total Pieces</div>
                  <div className="algo-stat-value green">{resultadoVoraz.totalPiezas}</div>
                </div>
                <div className="algo-stat-box">
                  <div className="algo-stat-label">Denominations Used</div>
                  <div className="algo-stat-value">{resultadoVoraz.desglose.length}</div>
                </div>
              </div>

              <h4 style={{ color: '#d4af37', margin: '1rem 0 0.5rem' }}>Bills and Coins Breakdown:</h4>
              <div className="algo-breakdown-grid">
                {resultadoVoraz.desglose.map((p, idx) => (
                  <div key={idx} className="algo-piece-card">
                    <span className="algo-piece-type">{p.tipo === 'Billete' ? 'Bill' : p.tipo === 'Moneda' ? 'Coin' : p.tipo}</span>
                    <div className="algo-piece-denom">{money(p.denominacion)}</div>
                    <span className="algo-piece-qty">{p.cantidad}x</span>
                    <div style={{ fontSize: '0.75rem', color: '#a89f91', marginTop: '0.3rem' }}>
                      {money(p.subtotal)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="algo-theory-box">
                <strong>Theoretical Justification of the Greedy Algorithm:</strong><br />
                {resultadoVoraz.explicacion?.propiedadEleccionVoraz || 'The national currency system is a canonical coin system, mathematically proving that the greedy heuristic always reaches the global optimal solution without exhaustive search.'}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. SECTION: KNAPSACK PROBLEM (0/1)                             */}
      {/* ============================================================== */}
      {activeSubTab === 'mochila' && (
        <div className="algo-card">
          <div className="algo-card-title">
            <span>Budget Optimization for Inventory Restocking</span>
            <span className="algo-theory-badge">Dynamic Programming: O(N * W)</span>
          </div>

          <p style={{ color: '#a89f91', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
            Models merchandise purchase as a <strong>0/1 Knapsack</strong>. Knapsack capacity = <em>Available budget</em>.
            Item weight = <em>Purchase cost</em>. Item value = <em>Projected profit</em> (Sale Price - Cost).
            Maximizes total profit without exceeding the budget constraint.
          </p>

          <div className="algo-form-grid">
            <div className="algo-input-group">
              <label>Available Purchase Budget ($):</label>
              <input
                type="number"
                step="5000"
                value={presupuesto}
                onChange={(e) => setPresupuesto(Number(e.target.value))}
              />
            </div>
            <div>
              <button
                className="algo-btn-action"
                onClick={ejecutarMochila}
                disabled={loadingMochila || presupuesto <= 0}
              >
                {loadingMochila ? 'Optimizing...' : 'Optimize Purchase (0/1 Knapsack)'}
              </button>
            </div>
          </div>

          {errorMochila && <p style={{ color: '#f07a7a' }}>{errorMochila}</p>}

          {resultadoMochila && (
            <div style={{ marginTop: '1.5rem' }}>
              <div className="algo-stats-grid">
                <div className="algo-stat-box">
                  <div className="algo-stat-label">Used Budget</div>
                  <div className="algo-stat-value">{money(resultadoMochila.mochila01_ProgramacionDinamica.costoUtilizado)}</div>
                </div>
                <div className="algo-stat-box">
                  <div className="algo-stat-label">Max Projected Profit</div>
                  <div className="algo-stat-value green">{money(resultadoMochila.mochila01_ProgramacionDinamica.gananciaMaxima)}</div>
                </div>
                <div className="algo-stat-box">
                  <div className="algo-stat-label">Budget Efficiency</div>
                  <div className="algo-stat-value">{resultadoMochila.mochila01_ProgramacionDinamica.porcentajeUsoPresupuesto}</div>
                </div>
                <div className="algo-stat-box">
                  <div className="algo-stat-label">Selected Products</div>
                  <div className="algo-stat-value">{resultadoMochila.mochila01_ProgramacionDinamica.totalProductosSeleccionados}</div>
                </div>
              </div>

              <h4 style={{ color: '#d4af37', margin: '1rem 0 0.5rem' }}>Selected Products via Dynamic Programming (0/1 Knapsack):</h4>
              <div className="algo-table-wrapper">
                <table className="algo-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Product</th>
                      <th>Purchase Cost (Weight)</th>
                      <th>Sale Price</th>
                      <th>Unit Profit (Value)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultadoMochila.mochila01_ProgramacionDinamica.itemsSeleccionados.map((item, idx) => (
                      <tr key={idx}>
                        <td><code>{item.codigo || `ID-${item.id_producto}`}</code></td>
                        <td><strong>{item.nombre}</strong></td>
                        <td>{money(item.costo)}</td>
                        <td>{money(item.precioVenta)}</td>
                        <td style={{ color: '#66bb6a', fontWeight: 600 }}>{money(item.ganancia)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="algo-theory-box">
                <strong>Academic Comparison: 0/1 Knapsack (DP) vs. Fractional Knapsack (Greedy):</strong><br />
                {resultadoMochila.comparativaTeorica?.diferencia || '0/1 Knapsack requires Dynamic Programming because indivisible discrete items prevent purely greedy choices.'}<br />
                If fractional product quantities were permitted, the greedy density strategy (profit / cost) would yield an upper theoretical profit of{' '}
                <strong>{money(resultadoMochila.mochilaFraccionaria_EnfoqueVoraz.gananciaMaxima)}</strong>.
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* 3. SECTION: BACKTRACKING                                       */}
      {/* ============================================================== */}
      {activeSubTab === 'backtracking' && (
        <div className="algo-card">
          <div className="algo-card-title">
            <span>Exhaustive Search with Backtracking and Pruning</span>
            <span className="algo-theory-badge">Bounding Pruning: Space O(2^N)</span>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <button
              className={`algo-subtab-btn ${subTipoBacktracking === 'combos' ? 'active' : ''}`}
              onClick={() => { setSubTipoBacktracking('combos'); setResultadoBacktrack(null); }}
            >
              A) Exact Combos and Consumption Vouchers (Subset Sum)
            </button>
            <button
              className={`algo-subtab-btn ${subTipoBacktracking === 'mesas' ? 'active' : ''}`}
              onClick={() => { setSubTipoBacktracking('mesas'); setResultadoBacktrack(null); }}
            >
              B) Table Seating with Constraints (Constraint Satisfaction)
            </button>
          </div>

          {subTipoBacktracking === 'combos' ? (
            <div>
              <p style={{ color: '#a89f91', fontSize: '0.9rem', marginBottom: '1rem' }}>
                Given an exact customer budget or voucher, recursively explores the combination tree.
                Applies <strong>upper and lower bound pruning</strong> to discard unviable branches and performs <em>rollback</em> to discover all exact valid combinations.
              </p>

              <div className="algo-form-grid">
                <div className="algo-input-group">
                  <label>Exact Combo / Voucher Amount ($):</label>
                  <input
                    type="number"
                    step="1000"
                    value={valorObjetivo}
                    onChange={(e) => setValorObjetivo(Number(e.target.value))}
                  />
                </div>
                <div>
                  <button
                    className="algo-btn-action"
                    onClick={ejecutarBacktrack}
                    disabled={loadingBacktrack || valorObjetivo <= 0}
                  >
                    {loadingBacktrack ? 'Exploring tree...' : 'Generate Combos with Backtracking'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <p style={{ color: '#a89f91', fontSize: '0.9rem', marginBottom: '1rem' }}>
                Assigns a list of guest party sizes to available free tables considering the capacity of each table.
                If an assignment branch cannot be fulfilled, it backtracks to the previous party to try an alternate valid table.
              </p>

              <div className="algo-form-grid">
                <div className="algo-input-group" style={{ flex: 2 }}>
                  <label>Guest Party Sizes (comma-separated):</label>
                  <input
                    type="text"
                    value={gruposMesas}
                    placeholder="e.g. 4, 2, 6, 2"
                    onChange={(e) => setGruposMesas(e.target.value)}
                  />
                </div>
                <div>
                  <button
                    className="algo-btn-action"
                    onClick={ejecutarBacktrack}
                    disabled={loadingBacktrack}
                  >
                    {loadingBacktrack ? 'Assigning tables...' : 'Solve Seating with Backtracking'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {errorBacktrack && <p style={{ color: '#f07a7a' }}>{errorBacktrack}</p>}

          {resultadoBacktrack && subTipoBacktracking === 'combos' && (
            <div style={{ marginTop: '1.5rem' }}>
              <div className="algo-stats-grid">
                <div className="algo-stat-box">
                  <div className="algo-stat-label">Exact Combinations</div>
                  <div className="algo-stat-value green">{resultadoBacktrack.totalCombinacionesEncontradas}</div>
                </div>
                <div className="algo-stat-box">
                  <div className="algo-stat-label">Recursive Calls</div>
                  <div className="algo-stat-value">{resultadoBacktrack.metricasAlgoritmo.llamadasRecursivas}</div>
                </div>
                <div className="algo-stat-box">
                  <div className="algo-stat-label">Pruned Branches</div>
                  <div className="algo-stat-value">{resultadoBacktrack.metricasAlgoritmo.ramasPodadas}</div>
                </div>
                <div className="algo-stat-box">
                  <div className="algo-stat-label">Pruning Efficiency</div>
                  <div className="algo-stat-value">{resultadoBacktrack.metricasAlgoritmo.eficienciaPoda}</div>
                </div>
              </div>

              <h4 style={{ color: '#d4af37', margin: '1rem 0 0.5rem' }}>
                Exact Combinations Found ({resultadoBacktrack.totalCombinacionesEncontradas}):
              </h4>

              {resultadoBacktrack.combinaciones.length === 0 ? (
                <p style={{ color: '#a89f91' }}>No product combination matches exactly {money(valorObjetivo)}.</p>
              ) : (
                <div className="algo-table-wrapper">
                  <table className="algo-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Combo Products</th>
                        <th>Item Count</th>
                        <th>Exact Sum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultadoBacktrack.combinaciones.map((c) => (
                        <tr key={c.comboId}>
                          <td><span className="algo-badge-combo">Option {c.comboId}</span></td>
                          <td>
                            {c.items.map((it, idx) => (
                              <span key={idx} style={{ display: 'inline-block', background: '#241d18', padding: '0.2rem 0.5rem', borderRadius: '4px', margin: '0.15rem 0.3rem 0.15rem 0', fontSize: '0.85rem' }}>
                                {it.nombre} ({money(it.precio)})
                              </span>
                            ))}
                          </td>
                          <td>{c.totalItems}</td>
                          <td><strong style={{ color: '#d4af37' }}>{money(c.valorTotal)}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="algo-theory-box">
                <strong>Backtracking Justification:</strong><br />
                The exhaustive search space is {resultadoBacktrack.metricasAlgoritmo.espacioMaximoTeorico}.
                Thanks to <strong>early pruning</strong> (when accumulated sum exceeds target or remaining suffix sum falls short),
                the algorithm discarded entire branches without evaluating them, visiting only {resultadoBacktrack.metricasAlgoritmo.llamadasRecursivas} states.
              </div>
            </div>
          )}

          {resultadoBacktrack && subTipoBacktracking === 'mesas' && (
            <div style={{ marginTop: '1.5rem' }}>
              <div className="algo-stats-grid">
                <div className="algo-stat-box">
                  <div className="algo-stat-label">Assignment Status</div>
                  <div className={`algo-stat-value ${resultadoBacktrack.exito ? 'green' : ''}`}>
                    {resultadoBacktrack.exito ? 'Success' : 'Conflict'}
                  </div>
                </div>
                <div className="algo-stat-box">
                  <div className="algo-stat-label">Assigned Groups</div>
                  <div className="algo-stat-value">{resultadoBacktrack.totalGrupos}</div>
                </div>
                <div className="algo-stat-box">
                  <div className="algo-stat-label">Backtracking Calls</div>
                  <div className="algo-stat-value">{resultadoBacktrack.llamadasRecursivas}</div>
                </div>
              </div>

              {resultadoBacktrack.resultado && (
                <div className="algo-table-wrapper">
                  <table className="algo-table">
                    <thead>
                      <tr>
                        <th>Party #</th>
                        <th>Guests</th>
                        <th>Assigned Table</th>
                        <th>Table Capacity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultadoBacktrack.resultado.map((r) => (
                        <tr key={r.grupoId}>
                          <td><strong>Party {r.grupoId}</strong></td>
                          <td>{r.comensales} guests</td>
                          <td><span className="algo-badge-combo">Table {r.numero_mesa}</span></td>
                          <td>{r.capacidad} seats</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}