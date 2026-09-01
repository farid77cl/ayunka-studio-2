# Ayünka Studio

El taller de Ayünka en una sola pantalla: qué se hace, cuánto cuesta, cuánto se cobra, qué
hay que entregar y si el tiempo alcanza.

Vanilla JS, sin compilador ni dependencias. Se abre con doble click o se sirve como sitio
estático. Los datos viven en el navegador y, si se configura, se sincronizan con Firestore.

---

## Por qué existe esta versión

La anterior creció sin plan: el catálogo terminó repartido entre cinco archivos, los precios
se editaban en tres lugares distintos, y el 1 de septiembre de 2026 la sincronización bajó
una copia de tres semanas atrás encima del trabajo local, sin preguntar.

Esta versión no es un rediseño estético. Cada decisión de abajo existe por un error concreto
que costó tiempo o datos.

### 1. La nube nunca gana en silencio

Cuando el equipo y la nube no coinciden, aparece un diálogo con **las dos fechas y los dos
conteos**, y decide una persona. Ninguna rama del código resuelve un conflicto sola.

> Lo que pasó antes: `if (local > remoto) subir; else bajar;`. Ese `else` se comió tres
> semanas de trabajo y solo dejó una nota de estado que había que ir a buscar.

### 2. Un equipo con datos reales que se conecta por primera vez, SUBE

Casi nunca es el destino: es la fuente. Antes se asumía lo contrario.

### 3. El respaldo se descarga al disco, no al navegador

Antes de la primera sincronización se baja un `.json` de verdad. El `localStorage` no puede
ser a la vez la víctima y la red de seguridad.

### 4. Se sube apenas hay sesión

No se espera a que alguien edite algo. Antes, la nube pasó tres semanas sin recibir nada y
la app seguía diciendo «sincronización activada».

### 5. Un documento por ficha

En Firestore cada producto, pedido o filamento es su propio documento
(`negocios/{negocio}/productos/{id}`). Editar un producto en el PC ya no puede pisar un
filamento nuevo del teléfono.

### 6. El código va por red primero

El *service worker* cachea las imágenes, pero el JS y el CSS los pide siempre a la red y usa
la copia solo si no hay internet. Así un arreglo llega en la siguiente recarga, **siempre**.

> Lo que pasó antes: el número del caché estaba escrito a mano dentro de `sw.js`. Se cambió
> el código cinco veces sin tocarlo y el navegador sirvió la versión vieja durante horas —
> los campos nuevos existían y no aparecían en pantalla.

La versión vive en **un solo lugar** (`js/version.js`) y se muestra abajo a la izquierda, para
que se sepa en tres segundos cuál se está corriendo.

### 7. Un cálculo incompleto dice que no sabe

Un producto de bordado sin horas de trabajo no vale $385: es que no se sabe cuánto vale. La
app muestra **qué falta** en vez de un número inventado, y no ofrece precio sugerido hasta
tenerlo. Una alarma falsa enseña a ignorar las alarmas.

### 8. Nada se borra

Las fichas se marcan `activo: false`. Lo borrado a mano no vuelve.

---

## Los dos oficios

Es lo que ningún producto del mercado hace, y la razón principal para construir en vez de
comprar. Bordado, costura e impresión 3D tienen estructuras de costo distintas y márgenes
distintos, en la misma ficha:

| Oficio | Qué manda el costo | Margen |
|---|---|---|
| Bordado | horas de trabajo a mano + materiales | ×2,55 |
| Costura | horas de trabajo a mano + materiales | ×2 |
| Impresión 3D | filamento, luz, amortización de la K2, preparación y post-proceso | ×3,5 |

El costo 3D incluye la amortización real de la máquina: con los parámetros actuales, cada
hora de la K2 cuesta unos $108 solo en eso.

---

## Lo que trae cargado

`datos/semilla.json` — datos reales, verificados, nada inventado:

- **36 productos** con SKU, de `catalogo/productos-app.json`, con los gramos y las horas
  medidos en G-code real. No están los 26 nombres de archivo STL que ensuciaban la base vieja.
- **6 filamentos** con marca, color y precio de compra.
- **19 diseños 3D** hechos en el diseñador de la versión anterior.
- **Los parámetros ya afinados**: kWh a 202, mano de obra $4.000/h, amortización a 3 años,
  merma 8%, fallas 10%.
- **2 clientes y el pedido de LIDCAR** que estaba en curso.

De los 36, **12 traen precio**. Los otros 24 esperan que alguien los ponga — con el sugerido
a un click cuando el costo esté completo.

---

## Poner en marcha

### Local

```bash
python3 -m http.server 8765     # y abrir http://localhost:8765
```

Abrir el `index.html` directo también funciona, pero **no se recomienda**: un `file://` no
tiene *service worker*, no se puede abrir desde el teléfono, y cada origen tiene su propio
almacenamiento — es lo que hizo que los datos vivieran presos en un solo PC.

### Publicado

Cualquier hosting estático sirve. Con GitHub Pages basta con activar Pages sobre la rama.

### Sincronización

1. En Firebase: crear el proyecto, activar Firestore y **Authentication → correo/contraseña**.
2. Crear un usuario de acceso (no el Gmail personal).
3. Poner ese correo en `firestore.rules` y **publicar las reglas en la consola**.
   Cambiar el archivo **no publica nada**.
4. Comprobar desde afuera que quedó cerrado:
   ```bash
   curl "https://firestore.googleapis.com/v1/projects/TU-PROYECTO/databases/(default)/documents/negocios/ayunka"
   ```
   Tiene que responder **403**.
5. En Ajustes de la app: pegar el `firebaseConfig`, el correo y la contraseña. Se guardan
   **solo en ese equipo**, nunca en git.

---

## Estructura

```
index.html
css/app.css              paleta "Acuarela Silvestre"
js/version.js            la versión, en un solo lugar
js/config.js             valores públicos (sin claves de acceso)
js/db.js                 estado, migraciones, respaldos
js/costos.js             el motor de costos de los dos oficios
js/nube.js               Firestore, un documento por ficha
js/ui.js                 piezas de interfaz
js/app.js                arranque y navegación
js/vistas/               productos, pedidos, cola, clientes, filamentos, ajustes
datos/semilla.json       el catálogo real
firestore.rules          hay que PUBLICARLAS, no basta con guardarlas
sw.js                    red primero para el código, caché para las imágenes
```

---

## Lo que todavía no está

Y se dice acá para que nadie lo descubra a mitad de camino:

- **Las líneas de los pedidos no se editan desde la interfaz** — se ven y se calculan, pero
  agregar o quitar una línea todavía no tiene pantalla.
- **No hay conexión con la impresora.** El plan está escrito: un agente en la misma red que
  la K2 lee su WebSocket (`ws://<ip>:9999`, sin root) y **empuja** el estado a Firestore; la
  app lo lee como cualquier otra ficha. Nunca al revés: una página `https` no puede llamar
  al `http` de la impresora.
- **No hay cotización desde un 3MF.** Un 3MF de proyecto no trae peso ni tiempo: hay que
  laminarlo. El camino es OrcaSlicer en modo CLI y leer `slice_info.config`.
- **No hay subida de fotos.** Las que hay apuntan a las URL de Supabase que ya existían.
- **Falta separar bordado de costura** en los 15 productos textiles: hoy entran todos como
  bordado y hay que revisar cuáles son costura, que va con otro margen.
