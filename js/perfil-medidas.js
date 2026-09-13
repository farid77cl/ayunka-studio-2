/* Ayünka Studio — perfil-medidas: matemática de ray-casting para el grosor de pared local
 * (ANAL-01) y las zonas finas/grabados (ANAL-02) sobre la malla plana que ya entrega
 * lector-3mf.js (posiciones Float32Array xyz, indices Uint32Array 3 por triángulo).
 *
 * Mismo patrón de namespace que lector-3mf.js: este módulo también se carga con
 * importScripts dentro del Worker, donde el objeto global del navegador no existe —
 * excepción deliberada a la convención "NOMBRE colgado del objeto global del navegador"
 * de CONVENTIONS.md (raiz = self si existe, si no globalThis). Solo funciones puras:
 * sin `self` propio, sin `postMessage` — eso es trabajo de perfil-worker.js.
 *
 * ADVERTENCIA para quien lea esto después: NO recorrer todos los triángulos contra todos.
 * A 400.000 triángulos (Lector3MF.UMBRAL_TRIANGULOS, el techo "sigo igual" de la Fase 2)
 * la fuerza bruta rayo-triángulo son 1,6 × 10^11 pruebas — cuelga el teléfono al instante.
 * Y las fixtures chicas de prueba NO lo delatan: pasan igual de rápido con o sin grilla, el
 * problema solo se nota con un 3MF real y denso. Por eso la grilla espacial
 * (construirGrilla) y el tope de orígenes muestreados (elegirOrigenes/
 * UMBRAL_MUESTREO_ORIGENES) son parte obligatoria del entregable, no una optimización para
 * "después".
 */
(function () {
  'use strict';

  var raiz = (typeof self !== 'undefined') ? self : globalThis;

  // Constantes ajustables. Todas son estimaciones sin medir aún en un teléfono real
  // (03-RESEARCH.md Assumptions Log A1) — si un análisis real sale raro, estos son los
  // primeros números a tocar.
  //
  // UMBRAL_MUESTREO_ORIGENES es a propósito distinto y mucho más bajo que
  // Lector3MF.UMBRAL_TRIANGULOS (400000): ese responde "¿esta malla es muy densa para
  // verla?", este responde "¿cuántos rayos aguanta el teléfono por análisis?" — cada
  // origen cuesta una consulta completa a la grilla, no solo un vértice a dibujar.
  // Medido en escritorio contra el 3MF real más denso del repo (672.216 triángulos,
  // respaldo-supabase/catalogo/bobbin-clip-class15/SmallClass15BobbinClip_New.3mf,
  // fase 03-05): con 20000 la medición tardaba 8953ms y truncaba por presupuesto de
  // pruebas rayo-triángulo agotado (solo 7331 de 20000 orígenes alcanzados). Con 3000
  // tarda 2204ms sin truncar — bajo los 3s pedidos, con margen. Los archivos reales
  // típicos de Farid (llaveros, 1500-8000 triángulos) ya usan TODOS sus triángulos como
  // origen con cualquiera de los dos valores (triangulos <= umbral), así que bajar esta
  // constante no les cambia nada — solo protege el caso extremo.
  var UMBRAL_MUESTREO_ORIGENES = 3000;
  var RADIO_CLUSTER_MM = 2;
  var MAX_ZONAS = 10;
  var DISTANCIA_MAX_MM = 50;
  var MAX_PRUEBAS_RAYO_TRIANGULO = 20000000;

  var EPS = 1e-9;
  var EPS_DESPLAZAMIENTO = 1e-4;

  // Tope interno (no exportado) de anillos de grilla a recorrer por rayo, ademas del
  // tope natural de distanciaMax/tamanoCelda. Mitigacion T-03-03 del threat_model: en
  // una malla casi plana (caja envolvente con una dimension ~0, ej. mallaAbierta()) el
  // tamaño de celda cae al piso de 0.2mm y distanciaMax/tamanoCelda solo por si mismo
  // pediria cientos de anillos -- cada anillo hueco (sin candidatos) igual cuesta
  // O(r^2) celdas a revisar, así que sin este tope una malla abierta y chica igual
  // puede colgar el analisis completo aunque nunca consuma presupuesto de pruebas
  // rayo-triangulo (las celdas vacias no gastan ese presupuesto). 64 anillos es de
  // sobra para cualquier malla real bien formada, donde tamanoCelda ya escala con el
  // tamaño de triangulo real de la pieza.
  var MAX_ANILLOS_BUSQUEDA = 64;

  // ---------- helpers de vector, sin libreria ----------
  function verticeDe(posiciones, i) {
    return [posiciones[i * 3], posiciones[i * 3 + 1], posiciones[i * 3 + 2]];
  }
  function resta(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function cruz(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  }
  function punto(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function longitud(v) { return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]); }
  function distancia(a, b) {
    var dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  // Normal (B-A)x(C-A) normalizada -- por la especificacion 3MF (winding antihorario
  // visto desde afuera del solido) apunta AFUERA -- mas el centroide del triangulo.
  // Devuelve null si la magnitud del producto cruz es menor a 1e-12: triangulo
  // degenerado, se descarta antes de normalizar. Bajo ninguna circunstancia deja salir
  // NaN de esta funcion (Pitfall 6).
  function normalYCentroide(posiciones, indices, triIdx) {
    var ia = indices[triIdx * 3], ib = indices[triIdx * 3 + 1], ic = indices[triIdx * 3 + 2];
    var A = verticeDe(posiciones, ia), B = verticeDe(posiciones, ib), C = verticeDe(posiciones, ic);
    var n = cruz(resta(B, A), resta(C, A));
    var mag = longitud(n);
    if (mag < 1e-12) return null; // triangulo degenerado
    var normal = [n[0] / mag, n[1] / mag, n[2] / mag];
    var centroide = [(A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3, (A[2] + B[2] + C[2]) / 3];
    return { normal: normal, centroide: centroide };
  }

  // Moller-Trumbore. origen/direccion: [x,y,z]. Devuelve la distancia t (>0) al impacto,
  // o null si no hay. Descarta rayo paralelo (|det|<EPS), u/v fuera de [0,1] o u+v>1, y
  // t<=EPS (detras o en el origen del rayo).
  function interseccionRayoTriangulo(origen, direccion, A, B, C) {
    var e1 = resta(B, A), e2 = resta(C, A);
    var p = cruz(direccion, e2);
    var det = punto(e1, p);
    if (Math.abs(det) < EPS) return null; // rayo paralelo al triangulo
    var invDet = 1 / det;
    var t0 = resta(origen, A);
    var u = punto(t0, p) * invDet;
    if (u < 0 || u > 1) return null;
    var q = cruz(t0, e1);
    var v = punto(direccion, q) * invDet;
    if (v < 0 || u + v > 1) return null;
    var t = punto(e2, q) * invDet;
    return t > EPS ? t : null;
  }

  // Caja envolvente de toda la malla (recorre posiciones una vez) -- insumo para el
  // tamaño de celda de la grilla.
  function calcularCajaEnvolvente(posiciones) {
    var minX = Infinity, minY = Infinity, minZ = Infinity;
    var maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (var i = 0; i < posiciones.length; i += 3) {
      var x = posiciones[i], y = posiciones[i + 1], z = posiciones[i + 2];
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
    return { minX: minX, minY: minY, minZ: minZ, maxX: maxX, maxY: maxY, maxZ: maxZ };
  }

  // Recorre una vez todos los triangulos, calcula el tamaño de celda a partir del
  // volumen de la caja envolvente y de cuantos triangulos hay
  // (Math.max(Math.cbrt(volumenBB / triangulos) * 2, 0.2), heuristica estandar de
  // subdivision espacial), y los reparte en un Map por la celda de su centroide, clave
  // "cx,cy,cz". Los triangulos degenerados no entran a la grilla (normalYCentroide ya
  // los filtra). El array de normales/centroides se cachea aqui para no recalcularlos
  // dos veces (una al construir la grilla, otra al elegir origenes).
  function construirGrilla(posiciones, indices, triangulos) {
    var caja = calcularCajaEnvolvente(posiciones);
    var anchoX = Math.max(caja.maxX - caja.minX, 0);
    var anchoY = Math.max(caja.maxY - caja.minY, 0);
    var anchoZ = Math.max(caja.maxZ - caja.minZ, 0);
    var volumenBB = Math.max(anchoX * anchoY * anchoZ, 1e-6);
    var tamanoCelda = Math.max(Math.cbrt(volumenBB / Math.max(triangulos, 1)) * 2, 0.2);

    var celdas = new Map(); // "cx,cy,cz" -> [triIdx, ...]
    var normales = new Array(triangulos);
    for (var t = 0; t < triangulos; t++) {
      var nc = normalYCentroide(posiciones, indices, t);
      normales[t] = nc;
      if (!nc) continue; // triangulo degenerado, no entra a la grilla
      var cx = Math.floor(nc.centroide[0] / tamanoCelda);
      var cy = Math.floor(nc.centroide[1] / tamanoCelda);
      var cz = Math.floor(nc.centroide[2] / tamanoCelda);
      var clave = cx + ',' + cy + ',' + cz;
      var lista = celdas.get(clave);
      if (!lista) { lista = []; celdas.set(clave, lista); }
      lista.push(t);
    }
    return { celdas: celdas, tamanoCelda: tamanoCelda, normales: normales };
  }

  // Expande en anillos de celdas desde la celda del origen, probando todos los
  // candidatos de cada anillo con interseccionRayoTriangulo, quedandose con el t mas
  // chico del anillo, y cortando en el primer anillo que de impacto valido o cuando el
  // radio minimo del anillo supere distanciaMax. Dos guardas contra la
  // auto-interseccion (Pitfall 1), las dos, no una: (1) excluir explicitamente
  // triOrigen de los candidatos; (2) el origen del rayo ya llega desplazado 1e-4mm a lo
  // largo de la direccion (ver medir()), red de seguridad numerica sobre la anterior.
  // Descarta impactos con t > distanciaMax (Pitfall 4: evita que un rayo se escape por
  // un agujero y "mida" contra otro objeto de la plancha). `presupuesto` es un contador
  // mutable {restante} de pruebas rayo-triangulo consumidas, compartido entre origenes;
  // si se agota, corta y devuelve null.
  function primerImpacto(grilla, posiciones, indices, origen, direccion, triOrigen, distanciaMax, presupuesto) {
    var tamanoCelda = grilla.tamanoCelda;
    var celdas = grilla.celdas;
    var cx0 = Math.floor(origen[0] / tamanoCelda);
    var cy0 = Math.floor(origen[1] / tamanoCelda);
    var cz0 = Math.floor(origen[2] / tamanoCelda);
    var maxAnillo = Math.min(Math.ceil(distanciaMax / tamanoCelda) + 1, MAX_ANILLOS_BUSQUEDA);

    var mejorT = null;

    function probarCelda(dx, dy, dz) {
      var clave = (cx0 + dx) + ',' + (cy0 + dy) + ',' + (cz0 + dz);
      var candidatos = celdas.get(clave);
      if (!candidatos) return;
      for (var i = 0; i < candidatos.length; i++) {
        var triIdx = candidatos[i];
        if (triIdx === triOrigen) continue; // guarda 1: excluir el triangulo de origen
        if (presupuesto.restante <= 0) return;
        presupuesto.restante--;
        var ia = indices[triIdx * 3], ib = indices[triIdx * 3 + 1], ic = indices[triIdx * 3 + 2];
        var A = verticeDe(posiciones, ia), B = verticeDe(posiciones, ib), C = verticeDe(posiciones, ic);
        var t = interseccionRayoTriangulo(origen, direccion, A, B, C);
        if (t === null) continue;
        if (t > distanciaMax) continue; // Pitfall 4
        if (mejorT === null || t < mejorT) mejorT = t;
      }
    }

    // Recorre SOLO la cascara del cubo de radio r (Chebyshev), nunca el cubo completo:
    // visitar (2r+1)^3 celdas por anillo (filtrando adentro) es O(r^3) por anillo y
    // O(r^4) acumulado -- exactamente el tipo de costo que cuelga el telefono en una
    // malla abierta que nunca encuentra impacto y agota los 251 anillos posibles con
    // una celda chica. Enumerar directo las ~24*r^2 celdas de la cascara mantiene el
    // costo acumulado en O(r^3).
    function recorrerAnillo(r) {
      if (r === 0) { probarCelda(0, 0, 0); return; }
      for (var dx = -r; dx <= r; dx++) {
        for (var dy = -r; dy <= r; dy++) {
          if (Math.abs(dx) === r || Math.abs(dy) === r) {
            for (var dz = -r; dz <= r; dz++) probarCelda(dx, dy, dz);
          } else {
            probarCelda(dx, dy, -r);
            probarCelda(dx, dy, r);
          }
        }
      }
    }

    for (var r = 0; r <= maxAnillo; r++) {
      if (presupuesto.restante <= 0) return null;
      mejorT = null;
      recorrerAnillo(r);
      if (mejorT !== null) return mejorT;
      var radioMinAnillo = r * tamanoCelda;
      if (radioMinAnillo > distanciaMax) return null;
    }
    return null;
  }

  // Recibe la distribucion YA ordenada ascendente por valor. Recorre de la mas fina a
  // la mas gruesa, aceptando una entrada como zona nueva solo si su ubicacion esta a
  // distancia euclidea >= radioCluster de la ubicacion de TODAS las zonas ya
  // aceptadas; si esta mas cerca, se descarta por ser el mismo detalle ya reportado.
  // Corta al llegar a maxZonas entradas. Devuelve copias nuevas {valor, ubicacion},
  // nunca referencias a la distribucion original.
  function agruparZonasFinas(distribucionAscendente, radioCluster, maxZonas) {
    var zonas = [];
    for (var i = 0; i < distribucionAscendente.length; i++) {
      var muestra = distribucionAscendente[i];
      var esDuplicado = false;
      for (var j = 0; j < zonas.length; j++) {
        if (distancia(zonas[j].ubicacion, muestra.ubicacion) < radioCluster) {
          esDuplicado = true;
          break;
        }
      }
      if (esDuplicado) continue;
      zonas.push({ valor: muestra.valor, ubicacion: muestra.ubicacion.slice() });
      if (zonas.length >= maxZonas) break;
    }
    return zonas;
  }

  // Si triangulos <= umbral, todos los indices. Si no, muestreo uniforme por stride
  // Math.floor(i * (triangulos / umbral)) para i de 0 a umbral-1.
  function elegirOrigenes(triangulos, umbral) {
    if (triangulos <= umbral) {
      var todos = [];
      for (var i = 0; i < triangulos; i++) todos.push(i);
      return todos;
    }
    var elegidos = [];
    var paso = triangulos / umbral;
    for (var j = 0; j < umbral; j++) elegidos.push(Math.floor(j * paso));
    return elegidos;
  }

  // medir(posiciones, indices, opciones) -- funcion publica, sincrona, no muta las
  // entradas. Resuelve las opciones contra las constantes por defecto; avisa
  // opciones.onProgreso('midiendo') al empezar y de nuevo cada 2000 origenes procesados
  // (el reloj de 30s de perfil-geometria.js se reinicia con cada mensaje de progreso:
  // sin esta repeticion un analisis largo se cancelaria solo). Construye la grilla,
  // elige los origenes, y por cada uno calcula normal y centroide, lanza el rayo en
  // -normal y, si hay impacto valido, guarda {valor: t, ubicacion: centroide} en la
  // distribucion.
  //
  // Reglas duras de la distribucion: un rayo sin impacto NO cuenta como grosor 0 ni
  // como Infinity -- se descarta el origen (Pitfall 2). Al terminar: muestras es la
  // cantidad de origenes para los que se llego a lanzar un rayo (triangulo no
  // degenerado), impactos la cantidad que entro a la distribucion. grosorMinimo es la
  // entrada de menor valor, o null si la distribucion quedo vacia.
  //
  // En esta tarea (Task 1) grabados se devuelve como [] -- el agrupamiento en zonas
  // finas se agrega en la Task 2.
  function medir(posiciones, indices, opciones) {
    opciones = opciones || {};
    var umbralMuestreo = opciones.umbralMuestreo || UMBRAL_MUESTREO_ORIGENES;
    var distanciaMax = opciones.distanciaMax || DISTANCIA_MAX_MM;
    var radioCluster = opciones.radioCluster || RADIO_CLUSTER_MM;
    var maxZonas = opciones.maxZonas || MAX_ZONAS;
    var onProgreso = typeof opciones.onProgreso === 'function' ? opciones.onProgreso : null;

    var triangulos = indices.length / 3;
    if (onProgreso) onProgreso('midiendo');

    var grilla = construirGrilla(posiciones, indices, triangulos);
    var origenes = elegirOrigenes(triangulos, umbralMuestreo);
    var presupuesto = { restante: MAX_PRUEBAS_RAYO_TRIANGULO };

    var distribucion = [];
    var muestras = 0;
    var truncado = false;

    for (var i = 0; i < origenes.length; i++) {
      if (presupuesto.restante <= 0) { truncado = true; break; }
      var triIdx = origenes[i];
      var nc = grilla.normales[triIdx];
      if (!nc) continue; // triangulo degenerado, no es un origen valido de rayo

      var direccion = [-nc.normal[0], -nc.normal[1], -nc.normal[2]];
      var origenDesplazado = [
        nc.centroide[0] + direccion[0] * EPS_DESPLAZAMIENTO,
        nc.centroide[1] + direccion[1] * EPS_DESPLAZAMIENTO,
        nc.centroide[2] + direccion[2] * EPS_DESPLAZAMIENTO
      ];

      muestras++;

      var t = primerImpacto(grilla, posiciones, indices, origenDesplazado, direccion, triIdx, distanciaMax, presupuesto);
      if (t === null) continue; // sin impacto: se descarta el origen (Pitfall 2), no cuenta como 0 ni Infinity

      distribucion.push({ valor: t, ubicacion: nc.centroide.slice() });

      if (onProgreso && muestras % 2000 === 0) onProgreso('midiendo');
    }

    var impactos = distribucion.length;

    // grosorMinimo se calcula de la distribucion completa, nunca como grabados[0]: son
    // dos campos separados a proposito (D-03) aunque en fixtures como cajaConAleta()
    // los dos terminen apuntando al mismo punto fisico (la aleta). Responden preguntas
    // distintas -- ¿la cascara aguanta? (ANAL-01) vs. ¿se va a leer la letra?
    // (ANAL-02) -- asi que ni siquiera cuando coinciden en valor se debe "simplificar"
    // asignando uno desde el otro.
    var grosorMinimo = null;
    if (impactos > 0) {
      var minEntrada = distribucion[0];
      for (var k = 1; k < distribucion.length; k++) {
        if (distribucion[k].valor < minEntrada.valor) minEntrada = distribucion[k];
      }
      grosorMinimo = { valor: minEntrada.valor, ubicacion: minEntrada.ubicacion.slice() };
    }

    // grabados: copia ordenada ascendente por valor de la MISMA distribucion, agrupada
    // por distancia (ANAL-02). Si la distribucion esta vacia, sigue siendo [].
    var distribucionAscendente = distribucion.slice().sort(function (a, b) { return a.valor - b.valor; });
    var grabados = agruparZonasFinas(distribucionAscendente, radioCluster, maxZonas);

    var avisoMedicion = null;
    if (truncado) {
      avisoMedicion = { tipo: 'medicion_truncada', muestras: muestras, impactos: impactos };
    } else if (muestras > 0 && impactos < muestras * 0.8) {
      avisoMedicion = { tipo: 'malla_no_cerrada', muestras: muestras, impactos: impactos };
    }

    return {
      grosorMinimo: grosorMinimo,
      grabados: grabados,
      muestras: muestras,
      impactos: impactos,
      avisoMedicion: avisoMedicion
    };
  }

  raiz.PerfilMedidas = {
    UMBRAL_MUESTREO_ORIGENES: UMBRAL_MUESTREO_ORIGENES,
    RADIO_CLUSTER_MM: RADIO_CLUSTER_MM,
    MAX_ZONAS: MAX_ZONAS,
    DISTANCIA_MAX_MM: DISTANCIA_MAX_MM,
    MAX_PRUEBAS_RAYO_TRIANGULO: MAX_PRUEBAS_RAYO_TRIANGULO,
    medir: medir
  };
})();
