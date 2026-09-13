# Agente K2 -- puente local (Fase 6)

## ⚠️ No verificado contra una impresora real

Este script se escribió con lo investigado (ver
`.planning/QUE-COMPRAR-QUE-CONSTRUIR.md` en el repo `negocio`) pero **nunca
se probó contra una K2 de verdad**, porque desde donde se escribió no hay
red hacia la impresora. Antes de confiar en él:

1. Corre `npm run debug` con la IP real de la impresora en `config.json`.
2. Mira qué mensajes llegan de verdad (se imprimen tal cual, sin interpretar).
3. Si los nombres de campo no calzan con lo que `interpretar()` busca en
   `k2-puente.js`, ajústalos ahí -- están puestos a modo de mejor intento,
   con varios nombres candidatos por campo (`state`/`status`, `layer`/
   `curLayer`/`layer_num`, etc.) precisamente porque no había forma de
   confirmar cuál usa el firmware real.

Si el puerto `9999` o el subprotocolo `wsslicer` resultan estar mal, el
proyecto de referencia usado en la investigación es
[`3dg1luk43/ha_creality_ws`](https://github.com/3dg1luk43/ha_creality_ws)
(integración de Home Assistant en Python, sin necesidad de root) -- ahí está
el protocolo real documentado con más detalle del que se alcanzó a portar
aquí.

## Qué hace

Se conecta por WebSocket a la K2 y escribe el estado normalizado en
Firestore, en `negocios/{espacio}/impresora/k2` -- el mismo documento que la
vista **Historial K2** de la app ya sabe leer (`Nube.leerImpresoraViva()`).
Con el agente corriendo, esa vista muestra estado/capa/progreso en vivo sin
que la app misma tenga que hablarle a la impresora (la app es una PWA
servida por GitHub Pages, no tiene acceso a la red local de la K2).

Campos que puede escribir (todos opcionales -- si un mensaje no trae un
campo, no se escribe encima del valor anterior):

- `estado` (texto)
- `capaActual`, `capaTotal` (número)
- `progreso` (número, 0-100)

## Puesta en marcha

```bash
cd agente
npm install
cp config.example.json config.json
# edita config.json: IP de la K2, espacio (el mismo que en Ajustes de la app),
# y la ruta al JSON de la cuenta de servicio de Firebase
```

La cuenta de servicio de Firebase se descarga desde la consola de Firebase
del proyecto (Configuración del proyecto → Cuentas de servicio → Generar
nueva clave privada). **No se sube a git** -- `config.json` y cualquier
`*.json` de credenciales quedan fuera del repo (ver `.gitignore`).

```bash
npm run debug   # solo mirar los mensajes crudos, no escribe nada
npm start       # modo real: interpreta y escribe a Firestore
```

Pensado para dejarlo corriendo en el mismo equipo/red que la K2 (por
ejemplo, la Raspberry que ya corre n8n) -- no es parte de la PWA.

## Trampas conocidas

- **No hay autenticación de Firestore de por medio en este script**: usa
  una cuenta de servicio con acceso total al proyecto. Guárdala con el
  mismo cuidado que las otras credenciales del negocio
  (`negocio/credenciales-privadas.txt`).
- **Reconexión con backoff exponencial** (hasta 30s): si la K2 se apaga o
  cambia de IP, el script no se cae, solo reintenta.
- **Las escrituras a Firestore se limitan a una cada 3 segundos** como
  mínimo, para no generar tráfico innecesario si la impresora manda estado
  muy seguido.
