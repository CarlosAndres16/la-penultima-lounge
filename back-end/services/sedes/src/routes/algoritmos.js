import express from 'express';
import pool from '../db.js';
import { requireAuth } from '@lounge/common';

const router = express.Router();
router.use(requireAuth((text, params) => pool.query(text, params)));

/**
 * ============================================================================
 * 1. ALGORITMO VORAZ (GREEDY ALGORITHM)
 * Problema: Desglose Óptimo de Cambio en Efectivo (Coin Change Problem)
 * ============================================================================
 * Teoría:
 * - Propiedad de Elección Voraz (Greedy Choice Property): En cada paso, el
 *   algoritmo selecciona la denominación más grande posible que no exceda el
 *   monto restante, sin reconsiderar elecciones previas.
 * - Subestructura Óptima: La solución óptima al problema global contiene la
 *   solución óptima a los subproblemas de cambio restante.
 * - Complejidad Temporal: O(D) donde D es la cantidad de denominaciones.
 * - Complejidad Espacial: O(1) auxiliar.
 */
router.post('/voraz-cambio', (req, res) => {
  try {
    const { montoPagar, montoRecibido, cambioDirecto, denominacionesPersonalizadas } = req.body;

    let cambioTotal = 0;
    if (cambioDirecto !== undefined && cambioDirecto !== null) {
      cambioTotal = Number(cambioDirecto);
    } else {
      const pagar = Number(montoPagar || 0);
      const recibido = Number(montoRecibido || 0);
      if (recibido < pagar) {
        return res.status(400).json({ error: 'El monto recibido no puede ser menor al monto a pagar' });
      }
      cambioTotal = recibido - pagar;
    }

    if (isNaN(cambioTotal) || cambioTotal < 0) {
      return res.status(400).json({ error: 'El valor de cambio debe ser un número positivo válido' });
    }

    // Denominaciones estándar de curso legal en Colombia
    const denominacionesDefault = [
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

    let denominaciones = denominacionesDefault;
    if (Array.isArray(denominacionesPersonalizadas) && denominacionesPersonalizadas.length > 0) {
      denominaciones = denominacionesPersonalizadas
        .map((d) => (typeof d === 'number' ? { valor: d, tipo: d >= 2000 ? 'Billete' : 'Moneda' } : d))
        .filter((d) => d.valor > 0)
        .sort((a, b) => b.valor - a.valor);
    }

    // Ejecución Voraz
    let restante = Math.round(cambioTotal);
    const desglose = [];
    const pasos = [];
    let totalPiezas = 0;

    for (const d of denominaciones) {
      if (restante >= d.valor) {
        const cantidad = Math.floor(restante / d.valor);
        const subtotal = cantidad * d.valor;
        restante = restante % d.valor;
        totalPiezas += cantidad;

        desglose.push({
          denominacion: d.valor,
          tipo: d.tipo,
          cantidad,
          subtotal
        });

        pasos.push({
          denominacion: d.valor,
          decisionVoraz: `Tomar ${cantidad} ${d.tipo.toLowerCase()}(s) de $${d.valor.toLocaleString('es-CO')}`,
          subtotal,
          restantePendiente: restante
        });
      }
    }

    res.json({
      algoritmo: 'Voraz (Greedy)',
      categoria: 'Optimización de Cambio en Caja POS',
      montoSolicitado: cambioTotal,
      cambioEntregado: cambioTotal - restante,
      residuoNoEntregable: restante,
      totalPiezas,
      desglose,
      pasos,
      explicacion: {
        propiedadEleccionVoraz: 'En cada paso se tomó la mayor denominación disponible menor o igual al saldo restante.',
        subestructuraOptima: 'Cada sub-saldo se resuelve con la combinación óptima de denominaciones menores.',
        complejidadTemporal: `O(${denominaciones.length}) iteraciones (casi O(1))`
      }
    });
  } catch (error) {
    console.error('Error en algoritmo voraz:', error);
    res.status(500).json({ error: 'Error al ejecutar algoritmo voraz' });
  }
});

/**
 * ============================================================================
 * 2. PROBLEMA DE LA MOCHILA (KNAPSACK PROBLEM)
 * Problema: Optimización de Presupuesto para Reabastecimiento de Inventario
 * ============================================================================
 * Teoría:
 * - Mochila 0/1: Cada producto se compra completo (1) o no se compra (0).
 *   Resuelto mediante Programación Dinámica (Dynamic Programming).
 *   Recurrencia: DP[i][w] = max(DP[i-1][w], DP[i-1][w - costo_i] + ganancia_i)
 * - Mochila Fraccionaria (Greedy): Si se pudieran comprar fracciones o unidades
 *   flexibles, se ordenan los productos por ratio (ganancia / costo) y se toman
 *   vorazmente.
 * - Complejidad Temporal 0/1: O(N * W) donde N es el número de productos y W la capacidad.
 * - Complejidad Espacial 0/1: O(N * W).
 */
router.post('/mochila-presupuesto', async (req, res) => {
  try {
    const { presupuesto, productosPersonalizados, escala = 1000 } = req.body;

    const capacidadPresupuesto = Number(presupuesto);
    if (!capacidadPresupuesto || capacidadPresupuesto <= 0) {
      return res.status(400).json({ error: 'El presupuesto debe ser un número mayor a cero' });
    }

    let items = [];

    if (Array.isArray(productosPersonalizados) && productosPersonalizados.length > 0) {
      items = productosPersonalizados.map((p, idx) => ({
        id_producto: p.id_producto || idx + 1,
        nombre: p.nombre || p.nombre_producto,
        costo: Number(p.costo || p.valor_compra),
        precioVenta: Number(p.precioVenta || p.precio_venta || 0),
        ganancia: Number(p.ganancia || (Number(p.precio_venta || 0) - Number(p.valor_compra || 0)))
      }));
    } else {
      // Tomar productos activos directamente desde la base de datos
      const dbRes = await pool.query(`
        SELECT id_producto, codigo_producto, nombre_producto, valor_compra, precio_venta
        FROM productos
        WHERE estado = 'Activo'
        ORDER BY id_producto ASC
      `);

      items = dbRes.rows.map((r) => {
        const costo = Number(r.valor_compra) > 0 ? Number(r.valor_compra) : Math.round(Number(r.precio_venta) * 0.5);
        const precio = Number(r.precio_venta);
        const ganancia = precio - costo > 0 ? precio - costo : Math.round(costo * 0.3);
        return {
          id_producto: r.id_producto,
          codigo: r.codigo_producto,
          nombre: r.nombre_producto,
          costo,
          precioVenta: precio,
          ganancia
        };
      });
    }

    // Filtrar elementos con costo válido
    const candidatos = items.filter((item) => item.costo > 0 && item.ganancia > 0);
    if (candidatos.length === 0) {
      return res.status(400).json({ error: 'No hay productos con costos y ganancias válidos para optimizar' });
    }

    // -------------------------------------------------------------
    // A) MOCHILA 0/1 CON PROGRAMACIÓN DINÁMICA
    // -------------------------------------------------------------
    // Usamos factor de escala para mantener la matriz DP en un tamaño razonable en memoria
    const factor = Math.max(1, Number(escala) || 1000);
    const W_scaled = Math.floor(capacidadPresupuesto / factor);
    const n = candidatos.length;

    // DP table: (n + 1) x (W_scaled + 1)
    const dp = Array.from({ length: n + 1 }, () => new Float64Array(W_scaled + 1));

    for (let i = 1; i <= n; i++) {
      const item = candidatos[i - 1];
      const w_i = Math.ceil(item.costo / factor);
      const v_i = item.ganancia;

      for (let w = 0; w <= W_scaled; w++) {
        if (w_i <= w) {
          dp[i][w] = Math.max(dp[i - 1][w], dp[i - 1][w - w_i] + v_i);
        } else {
          dp[i][w] = dp[i - 1][w];
        }
      }
    }

    // Reconstrucción de la solución (Backtracking sobre la tabla DP)
    let w_curr = W_scaled;
    const seleccionados01 = [];
    let costoTotal01 = 0;
    let gananciaTotal01 = 0;

    for (let i = n; i > 0; i--) {
      if (dp[i][w_curr] !== dp[i - 1][w_curr]) {
        const item = candidatos[i - 1];
        seleccionados01.push(item);
        costoTotal01 += item.costo;
        gananciaTotal01 += item.ganancia;
        const w_i = Math.ceil(item.costo / factor);
        w_curr -= w_i;
      }
    }

    seleccionados01.reverse();

    // -------------------------------------------------------------
    // B) MOCHILA FRACCIONARIA (ENFOQUE VORAZ / GREEDY)
    // -------------------------------------------------------------
    const itemsVoraz = candidatos.map((it) => ({
      ...it,
      ratio: it.ganancia / it.costo
    }));
    itemsVoraz.sort((a, b) => b.ratio - a.ratio);

    let presupuestoRestanteVoraz = capacidadPresupuesto;
    let gananciaTotalVoraz = 0;
    const seleccionadosVoraz = [];

    for (const it of itemsVoraz) {
      if (presupuestoRestanteVoraz <= 0) break;
      if (it.costo <= presupuestoRestanteVoraz) {
        seleccionadosVoraz.push({ ...it, fraccion: 1, costoTomado: it.costo, gananciaTomada: it.ganancia });
        presupuestoRestanteVoraz -= it.costo;
        gananciaTotalVoraz += it.ganancia;
      } else {
        const fraccion = Math.round((presupuestoRestanteVoraz / it.costo) * 100) / 100;
        const gananciaFraccion = Math.round(it.ganancia * fraccion);
        seleccionadosVoraz.push({
          ...it,
          fraccion,
          costoTomado: presupuestoRestanteVoraz,
          gananciaTomada: gananciaFraccion
        });
        gananciaTotalVoraz += gananciaFraccion;
        presupuestoRestanteVoraz = 0;
      }
    }

    res.json({
      algoritmo: 'Problema de la Mochila (Knapsack Problem)',
      categoria: 'Optimización de Presupuesto para Compras e Inventario',
      presupuestoTotal: capacidadPresupuesto,
      mochila01_ProgramacionDinamica: {
        costoUtilizado: costoTotal01,
        gananciaMaxima: gananciaTotal01,
        presupuestoRestante: capacidadPresupuesto - costoTotal01,
        porcentajeUsoPresupuesto: `${Math.round((costoTotal01 / capacidadPresupuesto) * 100)}%`,
        totalProductosSeleccionados: seleccionados01.length,
        itemsSeleccionados: seleccionados01,
        complejidad: `O(N * W) -> O(${n} * ${W_scaled}) en tiempo y espacio`
      },
      mochilaFraccionaria_EnfoqueVoraz: {
        costoUtilizado: capacidadPresupuesto - presupuestoRestanteVoraz,
        gananciaMaxima: gananciaTotalVoraz,
        totalItemsConsiderados: seleccionadosVoraz.length,
        itemsSeleccionados: seleccionadosVoraz,
        complejidad: `O(N log N) por ordenamiento voraz de ratios`
      },
      comparativaTeorica: {
        diferencia: 'La Mochila 0/1 no admite fracciones y requiere Programación Dinámica para garantizar el óptimo global. La Mochila Fraccionaria sí cumple la propiedad voraz ordenando por densidad de valor/costo.'
      }
    });
  } catch (error) {
    console.error('Error en algoritmo de la mochila:', error);
    res.status(500).json({ error: 'Error al ejecutar algoritmo de la mochila' });
  }
});

/**
 * ============================================================================
 * 3. BACKTRACKING (VUELTA ATRÁS CON PODA)
 * Problema: Generador de Combos Exactos y Bonos de Consumo (Subset Sum con Poda)
 * ============================================================================
 * Teoría:
 * - Técnica recursiva sistemática para explorar el espacio de estados.
 * - Poda (Pruning): Si la suma acumulada supera el objetivo o no alcanza
 *   con los elementos restantes, la rama se descarta inmediatamente.
 * - Backtrack: Se desmarca la decisión tomada y se regresa al nivel anterior.
 * - Complejidad Temporal: O(2^N) en el peor de los casos, fuertemente reducida
 *   por las podas de viabilidad.
 */
router.post('/backtracking-combos', async (req, res) => {
  try {
    const { valorObjetivo, productosPersonalizados, maxResultados = 20 } = req.body;

    const objetivo = Number(valorObjetivo);
    if (!objetivo || objetivo <= 0) {
      return res.status(400).json({ error: 'El valor objetivo debe ser un número positivo' });
    }

    let items = [];

    if (Array.isArray(productosPersonalizados) && productosPersonalizados.length > 0) {
      items = productosPersonalizados.map((p, idx) => ({
        id_producto: p.id_producto || idx + 1,
        nombre: p.nombre || p.nombre_producto,
        precio: Number(p.precio || p.precio_venta)
      }));
    } else {
      const dbRes = await pool.query(`
        SELECT id_producto, codigo_producto, nombre_producto, precio_venta
        FROM productos
        WHERE estado = 'Activo' AND precio_venta > 0
        ORDER BY precio_venta ASC
      `);

      items = dbRes.rows.map((r) => ({
        id_producto: r.id_producto,
        codigo: r.codigo_producto,
        nombre: r.nombre_producto,
        precio: Number(r.precio_venta)
      }));
    }

    // Filtrar productos con precio mayor al objetivo
    const filtrados = items.filter((it) => it.precio <= objetivo);
    filtrados.sort((a, b) => a.precio - b.precio);

    const n = filtrados.length;
    const combinacionesExactas = [];
    let llamadasRecursivas = 0;
    let ramasPodadas = 0;

    // Calcular sufijos de suma para poda por cota inferior
    const sufijoSuma = new Float64Array(n + 1);
    for (let i = n - 1; i >= 0; i--) {
      sufijoSuma[i] = sufijoSuma[i + 1] + filtrados[i].precio;
    }

    /**
     * Función recursiva de Vuelta Atrás (Backtracking)
     * @param {number} idx - Índice del elemento a considerar
     * @param {number} sumaActual - Suma acumulada de la combinación actual
     * @param {Array} camino - Elementos actualmente incluidos
     */
    function backtrack(idx, sumaActual, camino) {
      llamadasRecursivas++;

      // Caso base de éxito: Suma exacta alcanzada
      if (sumaActual === objetivo) {
        combinacionesExactas.push([...camino]);
        return;
      }

      if (combinacionesExactas.length >= (Number(maxResultados) || 20)) {
        return; // Límite de soluciones para respuesta ágil
      }

      for (let i = idx; i < n; i++) {
        const item = filtrados[i];
        const nuevaSuma = sumaActual + item.precio;

        // PODA 1: Si excede el objetivo, dado que la lista está ordenada,
        // ningún elemento subsiguiente podrá formar una solución válida.
        if (nuevaSuma > objetivo) {
          ramasPodadas++;
          break; // Poda del ciclo completo
        }

        // PODA 2: Si la suma actual más todos los elementos restantes no alcanza el objetivo
        if (sumaActual + sufijoSuma[i] < objetivo) {
          ramasPodadas++;
          break;
        }

        // 1. Paso Adelante (Hacer elección)
        camino.push(item);

        // 2. Llamada Recursiva
        backtrack(i + 1, nuevaSuma, camino);

        // 3. VUELTA ATRÁS (Backtrack: deshacer la elección para explorar alternativas)
        camino.pop();
      }
    }

    backtrack(0, 0, []);

    res.json({
      algoritmo: 'Backtracking (Vuelta Atrás con Poda)',
      categoria: 'Generador de Combos Exactos y Cupones de Consumo (Subset Sum)',
      valorObjetivo: objetivo,
      totalProductosAnalizados: n,
      totalCombinacionesEncontradas: combinacionesExactas.length,
      metricasAlgoritmo: {
        llamadasRecursivas,
        ramasPodadas,
        espacioMaximoTeorico: `2^${n} = ${Math.pow(2, Math.min(n, 30)).toLocaleString()} posibles ramas`,
        eficienciaPoda: `${Math.round((ramasPodadas / (llamadasRecursivas + ramasPodadas || 1)) * 100)}% de ramas podadas`
      },
      combinaciones: combinacionesExactas.map((c, i) => ({
        comboId: i + 1,
        totalItems: c.length,
        valorTotal: c.reduce((s, it) => s + it.precio, 0),
        items: c
      }))
    });
  } catch (error) {
    console.error('Error en algoritmo de backtracking:', error);
    res.status(500).json({ error: 'Error al ejecutar backtracking' });
  }
});

/**
 * ============================================================================
 * 4. BACKTRACKING - ASIGNACIÓN DE MESAS CON RESTRICCIONES (TABLE SEATING)
 * Problema: Ubicación óptima de grupos de clientes en mesas disponibles
 * ============================================================================
 */
router.post('/backtracking-mesas', async (req, res) => {
  try {
    const { gruposComensales, sedeId } = req.body;

    const grupos = Array.isArray(gruposComensales) && gruposComensales.length > 0
      ? gruposComensales.map((g, idx) => ({ id_grupo: idx + 1, comensales: Number(g) || 2 }))
      : [
          { id_grupo: 1, comensales: 6 },
          { id_grupo: 2, comensales: 4 },
          { id_grupo: 3, comensales: 2 },
          { id_grupo: 4, comensales: 4 }
        ];

    // Consultar mesas disponibles en la sede
    let queryMesas = `SELECT id_mesa, numero_mesa, id_sede, estado_actual FROM mesas`;
    const params = [];
    if (sedeId && sedeId !== 'ALL') {
      params.push(Number(sedeId));
      queryMesas += ` WHERE id_sede = $1`;
    }
    queryMesas += ` ORDER BY id_mesa ASC`;

    const mesasRes = await pool.query(queryMesas, params);
    const mesas = mesasRes.rows.map((m) => ({
      id_mesa: m.id_mesa,
      numero_mesa: m.numero_mesa,
      // Capacidad estimada o estándar según número de mesa
      capacidad: Number(m.numero_mesa) % 2 === 0 ? 6 : 4,
      ocupada: m.estado_actual === 'Ocupada'
    }));

    if (mesas.length === 0) {
      return res.status(400).json({ error: 'No se encontraron mesas para realizar la asignación' });
    }

    const asignacion = {};
    const mesasOcupadas = new Set(mesas.filter((m) => m.ocupada).map((m) => m.id_mesa));
    let llamadasBacktracking = 0;

    /**
     * Backtracking de asignación de mesas
     * @param {number} idxGrupo
     * @returns {boolean}
     */
    function asignar(idxGrupo) {
      llamadasBacktracking++;
      if (idxGrupo === grupos.length) {
        return true; // Todos los grupos ubicados exitosamente
      }

      const grupo = grupos[idxGrupo];

      for (const mesa of mesas) {
        // Restricción: mesa no ocupada y con capacidad suficiente
        if (!mesasOcupadas.has(mesa.id_mesa) && mesa.capacidad >= grupo.comensales) {
          // 1. Paso adelante: ubicar el grupo en esta mesa
          mesasOcupadas.add(mesa.id_mesa);
          asignacion[grupo.id_grupo] = {
            mesaId: mesa.id_mesa,
            numero_mesa: mesa.numero_mesa,
            capacidad: mesa.capacidad,
            comensales: grupo.comensales
          };

          // 2. Recursión: intentar asignar el siguiente grupo
          if (asignar(idxGrupo + 1)) {
            return true;
          }

          // 3. VUELTA ATRÁS: si no se pudo completar el resto, liberar la mesa
          mesasOcupadas.delete(mesa.id_mesa);
          delete asignacion[grupo.id_grupo];
        }
      }

      return false; // Backtrack al grupo previo
    }

    const exito = asignar(0);

    res.json({
      algoritmo: 'Backtracking (Asignación con Restricciones)',
      exito,
      totalGrupos: grupos.length,
      totalMesasEvaluadas: mesas.length,
      llamadasRecursivas: llamadasBacktracking,
      resultado: exito
        ? Object.entries(asignacion).map(([grupoId, mesa]) => ({
            grupoId: Number(grupoId),
            ...mesa
          }))
        : null,
      mensaje: exito
        ? 'Asignación completada exitosamente sin conflictos'
        : 'No fue posible asignar todos los grupos con las mesas y restricciones actuales'
    });
  } catch (error) {
    console.error('Error en backtracking de mesas:', error);
    res.status(500).json({ error: 'Error al ejecutar backtracking de mesas' });
  }
});

/**
 * Endpoint informativo general de los algoritmos implementados
 */
router.get('/info', (req, res) => {
  res.json({
    proyecto: 'La Penúltima Lounge POS',
    algoritmos: [
      {
        nombre: 'Algoritmo Voraz (Greedy)',
        archivo: 'services/sedes/src/routes/algoritmos.js',
        endpoint: 'POST /api/v1/algoritmos/voraz-cambio',
        casoDeUso: 'Cálculo de cambio óptimo en caja registradora con mínimo número de billetes/monedas',
        complejidad: 'O(D) tiempo, O(1) espacio',
        teoria: 'Propiedad de elección voraz y subestructura óptima'
      },
      {
        nombre: 'Problema de la Mochila (Knapsack)',
        archivo: 'services/sedes/src/routes/algoritmos.js',
        endpoint: 'POST /api/v1/algoritmos/mochila-presupuesto',
        casoDeUso: 'Optimización de compras a proveedores para reabastecimiento con presupuesto limitado',
        complejidad: 'O(N * W) tiempo y espacio en 0/1 (Programación Dinámica), O(N log N) en Fraccionario (Voraz)',
        teoria: '0/1 mediante Programación Dinámica y Fraccionaria mediante Enfoque Voraz'
      },
      {
        nombre: 'Backtracking (Vuelta Atrás)',
        archivo: 'services/sedes/src/routes/algoritmos.js',
        endpoints: [
          'POST /api/v1/algoritmos/backtracking-combos',
          'POST /api/v1/algoritmos/backtracking-mesas'
        ],
        casoDeUso: 'Generador exhaustivo de combos/bonos exactos y asignación de comensales a mesas con restricciones',
        complejidad: 'O(2^N) en el peor de los casos, optimizado mediante podas por cota superior e inferior',
        teoria: 'Exploración de árbol de estados, verificación de restricciones, podas y rollback'
      }
    ]
  });
});

export default router;
