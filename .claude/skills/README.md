# `.claude/skills/` — biblioteca **superpowers** (vendorizada)

**Origen:** [obra/superpowers](https://github.com/obra/superpowers) · **v6.3.0** · commit `b36e082`
(12/08/2026) · MIT. Copia verbatim de la que vive en `LaVouteDAnais/.claude/skills/`
(sin `android-development`, que no es de superpowers).
**Instalada:** 03/10/2026, por orden de Farid: *«Lleva Super Powers a ayunka nada más»*.
**Fecha de muerte declarada:** si al 03/01/2027 no cambió cómo se escribe el código de Ayünka,
se borra la carpeta con `git rm -r .claude/skills` y se anota en `sesion-log.md`.

## Por qué copiada y no instalada como plugin

El 13/09 (sesión de Ayünka Studio 2) se decidió **no** instalar el plugin/marketplace vía
`/plugin` ni tocar `~/.claude/settings.json`: es código externo con alcance amplio. Copiarlas
al repo es otra cosa — son solo `.md` y unos scripts de apoyo, quedan versionadas en git y
Claude Code las descubre igual como skills de proyecto. Lo que no viene es el hook
`SessionStart` del plugin (ver abajo).

Misma copia en `negocio/.claude/skills/` (el repo del negocio). Las dos se actualizan juntas.

## Alcance: código sí, contenido no

| ✅ Sí | ❌ No |
|---|---|
| `ayunka-studio/`, `ayunka-studio-2`, `impresora/`, scripts Python (generadores de STL, manuales) | Posts, guiones, ganchos, ideas de contenido (`skills/` de este repo mandan) |
| Workflows de n8n, `sync.js`, esquemas de Supabase | Diseño de producto, precios, branding |

**Ojo con dos:**
- **`brainstorming`** dice *«You MUST use this before any creative work»*. Aquí «creative work»
  es solo diseñar código; un carrusel o un reel siguen por `skills/ideas-contenido`,
  `skills/guion-video`, etc.
- **`using-superpowers`** exige invocar una skill antes de cualquier respuesta. Su hook
  `SessionStart` **no está cableado** y no se cablea sin decisión de Farid.

Los planes que escriba `writing-plans` van a `docs/superpowers/plans/` del repo de código
(como ya hace `ayunka-studio-2`); el estado del negocio sigue en `sesion-log.md` y
`.planning/`.

## Actualizar

```bash
git clone --depth 1 https://github.com/obra/superpowers.git /tmp/sp
cp -r /tmp/sp/skills/. .claude/skills/     # revisar el diff antes de commitear
```
Al actualizar, revisar los `description:`: son los que disparan la auto-activación. Y
actualizar las dos copias (este repo y `ayunka-studio-2`) en la misma pasada.
