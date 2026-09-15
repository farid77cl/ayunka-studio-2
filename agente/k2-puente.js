/* Ayünka Studio -- puente local K2.
 *
 * ################################################################
 * # NO VERIFICADO CONTRA UNA IMPRESORA K2 REAL. Ver README.md.  #
 * ################################################################
 *
 * Se conecta por WebSocket a la K2 (ws://<ip>:9999, subprotocolo "wsslicer",
 * según la investigación en .planning/QUE-COMPRAR-QUE-CONSTRUIR.md del repo
 * "negocio" y el proyecto de referencia 3dg1luk43/ha_creality_ws) y escribe
 * el estado normalizado en Firestore, en negocios/{espacio}/impresora/k2 --
 * el mismo documento que Nube.leerImpresoraViva() ya sabe leer.
 *
 * Corre con --debug para SOLO imprimir cada mensaje crudo por consola, sin
 * escribir nada a Firestore. Úsalo primero: como el formato exacto de los
 * mensajes no está confirmado contra hardware real, lo más seguro es mirar
 * qué manda la impresora de verdad antes de confiar en lo que este script
 * interpreta.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const DEBUG = process.argv.includes('--debug');
const RUTA_CFG = path.join(__dirname, 'config.json');

function cargarConfig() {
  if (!fs.existsSync(RUTA_CFG)) {
    console.error(`Falta ${RUTA_CFG}. Copia config.example.json a config.json y complétalo.`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(RUTA_CFG, 'utf8'));
}

function numero(v) { return (typeof v === 'number' && isFinite(v)) ? v : null; }
function texto(v) { return (typeof v === 'string' && v.trim()) ? v.trim() : null; }
function primero(...vals) { for (const v of vals) { if (v != null) return v; } return null; }

/* Mensaje real capturado el 15-sep-2026 contra la K2 de Farid (hostname K2-5CDF,
 * modelo F021, firmware DWIN 1.1.6.7), en vivo con npm run --debug mientras imprimía
 * "RUDY Automotriz 19_PLA_8h35m25s.gcode". Reemplaza los nombres de campo adivinados:
 * la capa viene en "layer" (esto sí coincidía), pero el total viene en "TotalLayer"
 * (con mayúscula, solo en el primer mensaje completo -- los mensajes siguientes son
 * deltas y no siempre lo traen) y el progreso en "printProgress" (0-100, no 0-1). El
 * estado es un CÓDIGO NUMÉRICO ("state": 1 mientras imprimía), no un texto -- el
 * mapeo de abajo sale del proyecto de referencia 3dg1luk43/ha_creality_ws
 * (custom_components/ha_creality_ws/sensor.py, clase PrintStatusSensor). Solo el
 * código 1 ("imprimiendo") está confirmado contra la K2 real hoy -- los códigos 0/4/5
 * salen de esa referencia externa, no de una prueba propia (no se puede pausar/detener
 * un trabajo real solo para confirmarlo). */
const MAPA_ESTADO = { 0: 'preparando', 1: 'imprimiendo', 4: 'detenida', 5: 'pausada' };

function interpretar(msg) {
  const p = msg.print || msg.data || msg;
  const codigoEstado = numero(p.state);
  const estado = codigoEstado != null ? (MAPA_ESTADO[codigoEstado] || `estado ${codigoEstado}`) : (texto(p.state) || texto(p.status) || texto(msg.state));
  const capaActual = primero(numero(p.layer), numero(p.curLayer), numero(p.layer_num), numero(p.mc_layer));
  const capaTotal = primero(numero(p.TotalLayer), numero(p.totalLayer), numero(p.total_layer_num), numero(p.layerCount));
  const progreso = primero(numero(p.printProgress), numero(p.dProgress), numero(p.percent), numero(p.progress), numero(p.mc_percent));
  const out = {};
  if (estado) out.estado = estado;
  if (capaActual != null) out.capaActual = capaActual;
  if (capaTotal != null) out.capaTotal = capaTotal;
  if (progreso != null) out.progreso = progreso;
  return Object.keys(out).length ? out : null;
}

async function main() {
  const cfg = cargarConfig();
  let db = null;
  if (!DEBUG) {
    const admin = require('firebase-admin');
    const credPath = path.isAbsolute(cfg.credencialesFirebase) ? cfg.credencialesFirebase : path.join(__dirname, cfg.credencialesFirebase);
    admin.initializeApp({ credential: admin.credential.cert(require(credPath)) });
    db = admin.firestore();
  }

  let ultimaEscritura = 0;
  const MIN_MS_ENTRE_ESCRITURAS = 3000;

  async function escribir(datos) {
    if (DEBUG) return;
    const ahora = Date.now();
    if (ahora - ultimaEscritura < MIN_MS_ENTRE_ESCRITURAS) return;
    ultimaEscritura = ahora;
    try {
      await db.collection('negocios').doc(cfg.espacio || 'ayunka').collection('impresora').doc('k2')
        .set(Object.assign({ actualizado: ahora }, datos), { merge: true });
    } catch (e) {
      console.error('No se pudo escribir en Firestore:', e.message || e);
    }
  }

  function conectar(intentos) {
    const url = `ws://${cfg.impresoraIp}:9999`;
    console.log(`Conectando a ${url} (subprotocolo wsslicer)${DEBUG ? ' -- modo debug, sin escribir a Firestore' : ''}...`);
    const ws = new WebSocket(url, 'wsslicer');

    ws.on('open', () => { console.log('Conectado a la K2.'); intentos = 0; });

    ws.on('message', raw => {
      let msg;
      try { msg = JSON.parse(raw.toString()); }
      catch (e) { if (DEBUG) console.log('MENSAJE NO-JSON:', raw.toString()); return; }
      if (DEBUG) console.log('MENSAJE:', JSON.stringify(msg));
      const datos = interpretar(msg);
      if (datos) escribir(datos);
      else if (DEBUG) console.log('  (no se reconoció ningún campo útil en este mensaje)');
    });

    ws.on('close', () => {
      const espera = Math.min(30000, 1000 * Math.pow(2, intentos));
      console.log(`Conexión cerrada. Reintentando en ${Math.round(espera / 1000)}s...`);
      setTimeout(() => conectar(intentos + 1), espera);
    });

    ws.on('error', e => console.error('Error de WebSocket:', e.message || e));
  }

  conectar(0);
}

main();
