import { useState } from 'react';
import './AlgorithmsDashboard.css';

const API = 'http://localhost:3000/api/v1';
const money = (n) => `$ ${Number(n || 0).toLocaleString('es-CO')}`;

export default function AlgorithmsDashboard() {
  const [activeSubTab, setActiveSubTab] = useState('voraz'); // 'voraz' | 'mochila' | 'backtracking'

  // ==========================================
  // ESTADO: 1. ALGORITMO VORAZ
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
      if (!res.ok) throw new Error(data.error || 'Error al ejecutar algoritmo voraz');
      setResultadoVoraz(data);
    } catch (err) {
      setErrorVoraz(err.message);
    } finally {
      setLoadingVoraz(false);
    }
  };

  // ==========================================
  // ESTADO: 2. PROBLEMA DE LA MOCHILA (KNAPSACK)
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
      if (!res.ok) throw new Error(data.error || 'Error al ejecutar algoritmo de la mochila');
      setResultadoMochila(data);
    } catch (err) {
      setErrorMochila(err.message);
    } finally {
      setLoadingMochila(false);
    }
  };

  // ==========================================
  // ESTADO: 3. BACKTRACKING
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
      if (!res.ok) throw new Error(data.error || 'Error al ejecutar backtracking');
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
        <h2>Laboratorio de Algoritmos Clásicos</h2>
        <p>Implementación teórica y funcional de Algoritmos Voraces, Problema de la Mochila y Backtracking en el sistema POS.</p>
      </div>

      {/* Subtabs de navegación */}
      <div className="algo-subtabs">
        <button
          className={`algo-subtab-btn ${activeSubTab === 'voraz' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('voraz')}
        >
          1. Algoritmo Voraz (Greedy)
        </button>
        <button
          className={`algo-subtab-btn ${activeSubTab === 'mochila' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('mochila')}
        >
          2. Problema de la Mochila (Knapsack)
        </button>
        <button
          className={`algo-subtab-btn ${activeSubTab === 'backtracking' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('backtracking')}
        >
          3. Backtracking (Vuelta Atrás)
        </button>
      </div>

      {/* ============================================================== */}
      {/* 1. SECCIÓN: ALGORITMO VORAZ                                   */}
      {/* ============================================================== */}
      {activeSubTab === 'voraz' && (
        <div className="algo-card">
          <div className="algo-card-title">
            <span>Desglose Óptimo de Cambio en Caja Registradora</span>
            <span className="algo-theory-badge">Complejidad: O(D) tiempo | O(1) espacio</span>
          </div>

          <p style={{ color: '#a89f91', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
            Aplica la <strong>Propiedad de Elección Voraz</strong>: en cada paso entrega la máxima cantidad posible de la
            denominación de mayor valor restante, garantizando la entrega del menor número total de billetes y monedas.
          </p>

          <div className="algo-form-grid">
            <div className="algo-input-group">
              <label>Total de la Cuenta / Factura ($):</label>
              <input
                type="number"
                step="50"
                value={montoPagar}
                onChange={(e) => setMontoPagar(Number(e.target.value))}
              />
            </div>
            <div className="algo-input-group">
              <label>Efectivo Recibido del Cliente ($):</label>
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
                {loadingVoraz ? 'Calculando...' : 'Calcular Cambio Voraz'}
              </button>
            </div>
          </div>

          {errorVoraz && <p style={{ color: '#f07a7a' }}>{errorVoraz}</p>}

          {resultadoVoraz && (
            <div style={{ marginTop: '1.5rem' }}>
              <div className="algo-stats-grid">
                <div className="algo-stat-box">
                  <div className="algo-stat-label">Cambio Total</div>
                  <div className="algo-stat-value">{money(resultadoVoraz.cambioEntregado)}</div>
                </div>
                <div className="algo-stat-box">
                  <div className="algo-stat-label">Total de Piezas</div>
                  <div className="algo-stat-value green">{resultadoVoraz.totalPiezas}</div>
                </div>
                <div className="algo-stat-box">
                  <div className="algo-stat-label">Denominaciones Usadas</div>
                  <div className="algo-stat-value">{resultadoVoraz.desglose.length}</div>
                </div>
              </div>

              <h4 style={{ color: '#d4af37', margin: '1rem 0 0.5rem' }}>Desglose de Billetes y Monedas:</h4>
              <div className="algo-breakdown-grid">
                {resultadoVoraz.desglose.map((p, idx) => (
                  <div key={idx} className="algo-piece-card">
                    <span className="algo-piece-type">{p.tipo}</span>
                    <div className="algo-piece-denom">{money(p.denominacion)}</div>
                    <span className="algo-piece-qty">{p.cantidad}x</span>
                    <div style={{ fontSize: '0.75rem', color: '#a89f91', marginTop: '0.3rem' }}>
                      {money(p.subtotal)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="algo-theory-box">
                <strong>Justificación Teórica del Algoritmo Voraz:</strong><br />
                {resultadoVoraz.explicacion.propiedadEleccionVoraz} El sistema monetario nacional es un sistema canónico, lo cual
                demuestra matemáticamente que la heurística voraz alcanza siempre la solución óptima global sin requerir búsqueda exhaustiva.
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. SECCIÓN: PROBLEMA DE LA MOCHILA                            */}
      {/* ============================================================== */}
      {activeSubTab === 'mochila' && (
        <div className="algo-card">
          <div className="algo-card-title">
            <span>Optimización de Presupuesto para Reabastecimiento de Inventario</span>
            <span className="algo-theory-badge">Programación Dinámica: O(N * W)</span>
          </div>

          <p style={{ color: '#a89f91', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
            Modela la compra de mercancía como una <strong>Mochila 0/1</strong>. Capacidad de la mochila = <em>Presupuesto disponible</em>.
            Peso de cada producto = <em>Costo de compra</em>. Valor de cada producto = <em>Ganancia proyectada</em> (Precio Venta - Costo).
            Maximiza la ganancia total sin superar el límite de dinero.
          </p>

          <div className="algo-form-grid">
            <div className="algo-input-group">
              <label>Presupuesto Disponible para Compras ($):</label>
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
                {loadingMochila ? 'Optimizando...' : 'Optimizar Compra (Mochila 0/1)'}
              </button>
            </div>
          </div>

          {errorMochila && <p style={{ color: '#f07a7a' }}>{errorMochila}</p>}

          {resultadoMochila && (
            <div style={{ marginTop: '1.5rem' }}>
              <div className="algo-stats-grid">
                <div className="algo-stat-box">
                  <div className="algo-stat-label">Presupuesto Utilizado</div>
                  <div className="algo-stat-value">{money(resultadoMochila.mochila01_ProgramacionDinamica.costoUtilizado)}</div>
                </div>
                <div className="algo-stat-box">
                  <div className="algo-stat-label">Ganancia Máxima Proyectada</div>
                  <div className="algo-stat-value green">{money(resultadoMochila.mochila01_ProgramacionDinamica.gananciaMaxima)}</div>
                </div>
                <div className="algo-stat-box">
                  <div className="algo-stat-label">Eficiencia de Presupuesto</div>
                  <div className="algo-stat-value">{resultadoMochila.mochila01_ProgramacionDinamica.porcentajeUsoPresupuesto}</div>
                </div>
                <div className="algo-stat-box">
                  <div className="algo-stat-label">Productos Seleccionados</div>
                  <div className="algo-stat-value">{resultadoMochila.mochila01_ProgramacionDinamica.totalProductosSeleccionados}</div>
                </div>
              </div>

              <h4 style={{ color: '#d4af37', margin: '1rem 0 0.5rem' }}>Productos Seleccionados por Programación Dinámica (Mochila 0/1):</h4>
              <div className="algo-table-wrapper">
                <table className="algo-table">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Producto</th>
                      <th>Costo Compra (Peso)</th>
                      <th>Precio Venta</th>
                      <th>Ganancia Unitaria (Valor)</th>
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
                <strong>Comparativa Académica: Mochila 0/1 (DP) vs. Mochila Fraccionaria (Voraz):</strong><br />
                {resultadoMochila.comparativaTeorica.diferencia}<br />
                Si se admitieran fracciones de productos, la estrategia voraz por densidad (ganancia/costo) generaría un techo teórico de{' '}
                <strong>{money(resultadoMochila.mochilaFraccionaria_EnfoqueVoraz.gananciaMaxima)}</strong>.
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* 3. SECCIÓN: BACKTRACKING (VUELTA ATRÁS)                         */}
      {/* ============================================================== */}
      {activeSubTab === 'backtracking' && (
        <div className="algo-card">
          <div className="algo-card-title">
            <span>Búsqueda Exhaustiva con Vuelta Atrás y Poda (Backtracking)</span>
            <span className="algo-theory-badge">Poda Bounding: Espacio O(2^N)</span>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <button
              className={`algo-subtab-btn ${subTipoBacktracking === 'combos' ? 'active' : ''}`}
              onClick={() => { setSubTipoBacktracking('combos'); setResultadoBacktrack(null); }}
            >
              A) Combos y Cupones de Consumo Exacto (Subset Sum)
            </button>
            <button
              className={`algo-subtab-btn ${subTipoBacktracking === 'mesas' ? 'active' : ''}`}
              onClick={() => { setSubTipoBacktracking('mesas'); setResultadoBacktrack(null); }}
            >
              B) Asignación de Mesas con Restricciones (Constraint Satisfaction)
            </button>
          </div>

          {subTipoBacktracking === 'combos' ? (
            <div>
              <p style={{ color: '#a89f91', fontSize: '0.9rem', marginBottom: '1rem' }}>
                Dado un presupuesto o cupón de consumo exacto, explora el árbol de combinaciones recursivamente.
                Aplica <strong>podas de cota superior e inferior</strong> para descartar ramas no viables y realiza <em>rollback</em> para encontrar todas las combinaciones exactas posibles.
              </p>

              <div className="algo-form-grid">
                <div className="algo-input-group">
                  <label>Valor Exacto del Combo / Cupón ($):</label>
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
                    {loadingBacktrack ? 'Explorando árbol...' : 'Generar Combos con Backtracking'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <p style={{ color: '#a89f91', fontSize: '0.9rem', marginBottom: '1rem' }}>
                Asigna una lista de grupos de comensales a mesas libres disponibles considerando capacidades de cada mesa.
                Si en algún punto una rama de asignación no puede completarse, retrocede (<em>backtrack</em>) al grupo previo para reintentar otra mesa válida.
              </p>

              <div className="algo-form-grid">
                <div className="algo-input-group" style={{ flex: 2 }}>
                  <label>Tamaños de Grupos de Comensales (separados por coma):</label>
                  <input
                    type="text"
                    value={gruposMesas}
                    placeholder="Ej: 4, 2, 6, 2"
                    onChange={(e) => setGruposMesas(e.target.value)}
                  />
                </div>
                <div>
                  <button
                    className="algo-btn-action"
                    onClick={ejecutarBacktrack}
                    disabled={loadingBacktrack}
                  >
                    {loadingBacktrack ? 'Asignando mesas...' : 'Resolver Asignación con Backtracking'}
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
                  <div className="algo-stat-label">Combinaciones Exactas</div>
                  <div className="algo-stat-value green">{resultadoBacktrack.totalCombinacionesEncontradas}</div>
                </div>
                <div className="algo-stat-box">
                  <div className="algo-stat-label">Llamadas Recursivas</div>
                  <div className="algo-stat-value">{resultadoBacktrack.metricasAlgoritmo.llamadasRecursivas}</div>
                </div>
                <div className="algo-stat-box">
                  <div className="algo-stat-label">Ramas Podadas</div>
                  <div className="algo-stat-value">{resultadoBacktrack.metricasAlgoritmo.ramasPodadas}</div>
                </div>
                <div className="algo-stat-box">
                  <div className="algo-stat-label">Eficiencia de Poda</div>
                  <div className="algo-stat-value">{resultadoBacktrack.metricasAlgoritmo.eficienciaPoda}</div>
                </div>
              </div>

              <h4 style={{ color: '#d4af37', margin: '1rem 0 0.5rem' }}>
                Combinaciones Exactas Encontradas ({resultadoBacktrack.totalCombinacionesEncontradas}):
              </h4>

              {resultadoBacktrack.combinaciones.length === 0 ? (
                <p style={{ color: '#a89f91' }}>No existe ninguna combinación de productos que sume exactamente {money(valorObjetivo)}.</p>
              ) : (
                <div className="algo-table-wrapper">
                  <table className="algo-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Productos del Combo</th>
                        <th>Cant. Productos</th>
                        <th>Suma Exacta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultadoBacktrack.combinaciones.map((c) => (
                        <tr key={c.comboId}>
                          <td><span className="algo-badge-combo">Opción {c.comboId}</span></td>
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
                <strong>Justificación de Backtracking:</strong><br />
                El espacio de búsqueda exhaustivo es de {resultadoBacktrack.metricasAlgoritmo.espacioMaximoTeorico}.
                Gracias a las <strong>podas tempranas</strong> (cuando la suma acumulada supera el objetivo o el sufijo restante no alcanza),
                el algoritmo descartó ramas enteras sin evaluarlas, visitando solo {resultadoBacktrack.metricasAlgoritmo.llamadasRecursivas} estados.
              </div>
            </div>
          )}

          {resultadoBacktrack && subTipoBacktracking === 'mesas' && (
            <div style={{ marginTop: '1.5rem' }}>
              <div className="algo-stats-grid">
                <div className="algo-stat-box">
                  <div className="algo-stat-label">Estado de Asignación</div>
                  <div className={`algo-stat-value ${resultadoBacktrack.exito ? 'green' : ''}`}>
                    {resultadoBacktrack.exito ? 'Éxito' : 'Conflicto'}
                  </div>
                </div>
                <div className="algo-stat-box">
                  <div className="algo-stat-label">Grupos Asignados</div>
                  <div className="algo-stat-value">{resultadoBacktrack.totalGrupos}</div>
                </div>
                <div className="algo-stat-box">
                  <div className="algo-stat-label">Llamadas Backtracking</div>
                  <div className="algo-stat-value">{resultadoBacktrack.llamadasRecursivas}</div>
                </div>
              </div>

              {resultadoBacktrack.resultado && (
                <div className="algo-table-wrapper">
                  <table className="algo-table">
                    <thead>
                      <tr>
                        <th>Grupo #</th>
                        <th>Comensales</th>
                        <th>Mesa Asignada</th>
                        <th>Capacidad Mesa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultadoBacktrack.resultado.map((r) => (
                        <tr key={r.grupoId}>
                          <td><strong>Grupo {r.grupoId}</strong></td>
                          <td>{r.comensales} personas</td>
                          <td><span className="algo-badge-combo">Mesa {r.numero_mesa}</span></td>
                          <td>{r.capacidad} puestos</td>
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
