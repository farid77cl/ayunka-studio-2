# Cómo reportar el trabajo en Ayünka Studio

> Para Claude Code, o para quien siga. Escrito el 2-sep-2026 por la sesión que armó este
> repo, después de un día en que **tres cosas se dieron por hechas y ninguna lo estaba**:
> las reglas de Firestore decían estar cerradas y la base llevaba semanas abierta; la
> sincronización decía estar activada y llevaba tres semanas sin subir nada; y unos campos
> nuevos existían en el código pero el navegador servía la versión vieja.
>
> Por eso este documento no es burocracia. Es la diferencia entre "lo hice" y "funciona".

---

## La regla de fondo

**Nada está hecho porque el código lo diga. Está hecho cuando algo que podría haber fallado,
no falló.**

Un commit que dice «cerrar Firestore» no cierra Firestore. Un archivo `firestore.rules`
correcto en el disco no publica nada. Una función escrita no es una función que corre. Antes
de escribir «listo», pregúntate: *¿qué comprobación habría salido mal si esto estuviera roto,
y la corrí?*

---

## Dónde va el reporte

Un solo archivo, `BITACORA.md`, en la raíz de este repo. **Se agrega arriba**, lo más nuevo
primero. Una entrada por sesión de trabajo, no por commit.

Farid lo lee en diagonal y con poco tiempo. Que se entienda sin abrir el código.

### El formato

```markdown
## 2026-09-05 · Fase 1.1, editar líneas de pedido

**Qué cambió.** En dos o tres frases, en lenguaje de negocio: qué puede hacer ahora
que antes no podía.

**Cómo sé que funciona.** La comprobación concreta, con el resultado.
- Armé un pedido de LIDCAR con 50 rectangulares a $5.000 → total $250.000, saldo $250.000.
- La cola pasó de 0 a 26,0 h y dijo «no alcanza» para una entrega a 1 día. Correcto.

**Lo que NO quedó.** Sin adornos.
- Las líneas todavía no se pueden reordenar.

**Necesito una decisión tuya.** Solo si de verdad la necesitas. Si no, no pongas la sección.
- ¿El abono por defecto sigue siendo 50%?

**Versión.** v2.3.0 · commits `abc1234`..`def5678`
```

### Reglas de la entrada

1. **«Cómo sé que funciona» es obligatorio** y va con números o con la salida real. Si dice
   «probado y funcionando» sin decir qué se probó, no sirve.
2. **«Lo que NO quedó» también es obligatorio**, aunque sea «nada». Los pendientes callados
   se descubren en el peor momento — por ejemplo, con un cliente esperando.
3. **Si algo se rompió o salió mal, va primero**, no al final. Y va aunque lo hayas arreglado.
4. **Si cambiaste una decisión de diseño** de las que están en el `README.md`, dilo y explica
   por qué. Esas ocho reglas existen por errores concretos; cambiar una sin decirlo es
   volver a pisar el mismo hoyo.
5. **Sube el número de versión** en `js/version.js` en cada cambio de `js/` o `css/`, y ponlo
   en la entrada. Se muestra en pantalla justamente para poder verificarlo de un vistazo.

---

## Qué quiere Farid · lo que hay que entender antes de decidir por él

Esto no está en ningún requisito y es lo que más importa. Sale de un día entero trabajando
con él.

**Quiere producir y vender sin pelear con el software.** Ayünka Studio no es un proyecto de
programación: es la herramienta con la que cotiza, imprime y entrega. Si una pantalla es
bonita pero no le ahorra una hora, no sirve.

**Odia que el software le mienta.** Prefiere «no sé» a un número inventado. Por eso el motor
de costos devuelve `completo:false` y dice qué falta, y por eso la cotización pide los gramos
en vez de estimarlos. **Si te ves poniendo un valor por defecto para que "se vea algo",
detente.** Una alarma falsa enseña a ignorar las alarmas.

**Verifica.** Te va a preguntar cómo sabes lo que dices, y con razón: se le fue un día entero
por creerle a tres cosas que no eran. Trae la evidencia antes de que la pida.

**El resultado físico es profesional y eso no se negocia.** Textual: *«si me importa el
planchado, ya te dije que el resultado debe ser profesional, si no lo plancho salen líneas
raras o rugosidades no deseadas, el reverso debe salir liso»*. **Nunca propongas apagar el
planchado inverso para ganar tiempo.** Está cerrado.

**Quiere el negocio fuera del PC.** Textual: *«todo esto debe quedar en la nube, no vivir
100% en el pc»*, y después *«una parte sí puede ser local, pero apunta a que no sea así»*.
Lo único que obligatoriamente vive en su red es el puente con la impresora, y hasta eso
tiene que empujar hacia afuera, no que la app entre a buscarlo.

**Quiere que le avisen de las decisiones, no de los pasos.** Textual: *«has todo tú, solo
avísame cuando hayan decisiones»*. No le narres el progreso. Cuando de verdad no se puede
avanzar sin él, dilo claro y con las opciones.

**No le entregues un plan cuando pidió la cosa.** Nos lo dijo así: *«casi solo copiaste lo
que había»*, y tenía razón — le habíamos dejado lo distintivo como «Fase 3 y 4». Un plan no
es la cosa.

**Trabaja en VS Code** y ahí es donde está más cómodo. El ciclo de mirar-ajustar-mirar es
suyo.

---

## Lo que Ayünka Studio tiene que llegar a ser

En orden, con el detalle en `PLAN.md`:

1. **La herramienta con la que cotiza.** Precios que salen de sus costos reales, no de
   copiar a la competencia. Hoy 24 de 36 productos no tienen precio, y esa es la tarea de
   mayor retorno del negocio entero.
2. **Pedidos B2B de verdad**: cliente, abono, saldo, entrega comprometida, y qué bandejas lo
   cubren. Nadie en el mercado lo hace.
3. **La impresora adentro**: estado en vivo y el aviso de la pausa del chip, sin depender de
   que su PC esté prendido. El agente empuja hacia afuera; la app nunca llama a la K2.
4. **De un 3MF a una cotización** sin abrir Creality Print más que una vez. Ya está la mitad.
5. **Fuente única de precios**: se ponen en Studio y de ahí SALEN el CSV de Meta y el catálogo
   de WhatsApp. Hoy se editan en tres lados, y por eso el desorden vuelve solo.

Y lo que **no** hay que construir, porque ya existe barato o gratis: facturación electrónica,
inventario de filamento (Spoolman), granja de impresión (Printago). Está razonado en
`../.planning/QUE-COMPRAR-QUE-CONSTRUIR.md`.

---

## Antes de dar por cerrada una fase

Corre estas tres, siempre:

1. **Abre la app y úsala** como la usaría él. No mires solo que compile.
2. **Comprueba desde afuera lo que afecte a la nube.** Para Firestore:
   ```bash
   curl "https://firestore.googleapis.com/v1/projects/TU-PROYECTO/databases/(default)/documents/negocios/ayunka"
   ```
   Tiene que dar **403**.
3. **Recarga dos veces** y confirma que la versión de abajo a la izquierda es la nueva. Si no
   subió, el navegador está sirviendo código viejo y lo que probaste no es lo que hay.
