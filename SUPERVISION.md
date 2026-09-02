# Quién escribe el código, y quién supervisa

> Escrito el 2-sep-2026, después de que dos instancias trabajaran sobre el mismo repo al
> mismo tiempo y Farid lo parara: *«hay 2 instancias escribiendo código, detente, ya te dije
> que tú eres supervisor, no escribas código. Harán que se crucen el código entre lo tuyo y
> VS Code»*. Tenía razón. Esto queda escrito para que no vuelva a pasar.

## La regla

**Solo VS Code escribe en este repo.** Una sola mano en el código.

La sesión de Cowork (la del navegador, la que habla con la impresora y con Firebase)
**supervisa**: investiga, verifica desde afuera, mide, revisa, y **especifica**. Si necesita
un cambio, lo describe acá o en la bitácora. No lo escribe.

Por qué importa, más allá de los conflictos de git: dos manos escribiendo producen dos
criterios. La app ya se desordenó una vez por eso.

## Qué hace cada uno

| | VS Code (Claude Code) | Cowork (supervisor) |
|---|---|---|
| Escribir código | **Sí, solo él** | No |
| `git commit` y `push` en este repo | **Sí, solo él** | No |
| Investigar en la web, comparar productos | Puede | **Sí** |
| Hablar con la K2, con Firebase, con el navegador | No | **Sí** |
| Verificar desde afuera que algo quedó cerrado | Puede | **Sí** |
| Escribir la bitácora del negocio (`../sesion-log.md`) | No | **Sí** |
| `BITACORA.md` de este repo | **Sí** | Lee y comenta |
| Decidir el alcance con Farid | — | **Sí** |

Si el supervisor necesita tocar algo del repo, **pide**. Si VS Code necesita que alguien
compruebe algo desde afuera —que las reglas de Firestore estén publicadas de verdad, que la
impresora responda, que un 3MF traiga lo que se cree— **pide**.

## Lo que está pendiente de mi lado, como especificación

Lo siguiente está diseñado y probado en un entorno aparte, contra los datos reales de Farid,
pero **no está en este repo**. Impleméntalo tú.

### La impresora · `js/impresora.js` + `js/vistas/impresora.js`

**La idea la puso Farid y cambia el enfoque:** no es un monitor en vivo. *«Hay información
que se puede recuperar desde ella aunque no esté en línea todo el tiempo.»* La K2 guarda su
propio historial; se va a buscar cuando se pueda y se recupera todo lo que hizo mientras
nadie miraba.

Y ahí está lo que de verdad vale: ese historial trae **los gramos y las horas reales de cada
trabajo**. Son exactamente los dos números que la cotización pide a mano y que no se pueden
deducir de la geometría. **La propia máquina es la fuente de verdad de su costo.**

Qué tiene que hacer:

1. **Traer el historial**, por dos caminos que terminan en lo mismo:
   - `GET http://<ip>:4408/server/history/list?limit=500` si la impresora está al alcance.
   - Soltando un archivo JSON, si no. Acepta el formato crudo de Moonraker **y** el de
     `../historial-impresion.json`, que ya está resumido.
2. **Normalizar los dos formatos** a `{archivo, veces, horasReales, gramosReales}`.
   De Moonraker: `print_duration` en segundos y `filament_used` en milímetros —
   **PLA de 1,75 mm son 2,98 g/m**, esa constante ya está usada en el archivo de Farid.
3. **Emparejar con el catálogo por nombre de archivo.** La raíz se saca quitando `.gcode`,
   el sufijo `_PLA_2h41m34s`, `_gcode_plate_1` y la extensión del modelo. Primero contra
   `archivoOrigen` del producto; si no, por parecido de nombre, marcando cuál fue.
4. **Proponer, no aplicar.** Muestra la tabla y que una persona apruebe. La app no rellena
   datos a espaldas de nadie. Al aplicar, deja constancia en `origenDatos`.
5. **Comparar la tasa de fallas real con la de Ajustes** y ofrecer usar la real de un click.

**Lo que hay que saber, y no es negociable:** una página servida por `https` **no puede**
llamar al `http` de la K2 — el navegador lo bloquea y no hay forma de saltarlo desde el
navegador. Dilo en pantalla en vez de fallar en silencio. La solución de fondo es al revés y
está en `PLAN.md` Fase 3: un agente en la red de la impresora que **empuje** a Firestore.

**Cómo se comprueba que funciona** (yo lo corrí así, con datos reales):

- Con `../historial-impresion.json` los totales tienen que dar **160 h impresas, 154 trabajos,
  4,0 kg, 593 g perdidos y 12,9% de fallas**.
- Aviso esperado: en Ajustes la tasa está en 10% y la real es 12,9%. Esa diferencia se va
  derecho a todos los costos.
- **Prueba del emparejador:** bórrale los gramos y las horas a tres productos que sí tengan
  `archivoOrigen` —`AY-3D-001`, `AY-3D-002`, `AY-3D-004`— y vuelve a importar. Tienen que
  recuperarse exactos: **75,2 g / 2,515 h**, **13,1 g / 0,658 h** y **63,2 g / 2,21 h**,
  los tres marcados «por archivo».
- Ojo con un detalle que a mí se me pasó: al guardar el resumen hay que **repintar** la
  pantalla, o los totales de arriba no aparecen hasta cambiar de vista.

**El dato que justifica todo esto:** en ese historial hay **100 piezas** con gramos y horas
reales. Solo **11** llegaron al catálogo. Las otras 89 llevan un mes ahí sin usarse, y son
las que hacen confiable la cola de producción y las cotizaciones.

## Lo demás sigue igual

`COMO-REPORTAR.md` manda sobre cómo reportar y sobre qué espera Farid. `PLAN.md` tiene las
fases. `BITACORA.md` es tuya: una entrada por sesión, arriba, con el «cómo sé que funciona»
obligatorio.
