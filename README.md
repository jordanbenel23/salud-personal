# Mi tratamiento

Web app instalable (PWA) para seguir el tratamiento de dermatología y los hábitos diarios.
HTML/CSS/JS sin dependencias ni paso de compilación. Funciona sin conexión.

## Estructura

| Archivo | Qué es |
|---|---|
| `index.html` | Página única + barra de pestañas + temporizador |
| `styles.css` | Estilos (modo claro/oscuro automático) |
| `js/logic.js` | Fechas, calendario de tratamientos, %, racha, viaje (sin DOM) |
| `js/app.js` | Interfaz, guardado en `localStorage`, exportar/importar, temporizador |
| `manifest.webmanifest`, `sw.js` | Instalación y modo offline |
| `icons/` | Iconos (regenerar con `python3 tools/make_icons.py`) |
| `tests/logic.test.js` | Tests de fechas y cálculos (`npm test`, requiere Node 20+) |

## Probar en el ordenador

```bash
node tools/serve.mjs
```

Abre http://localhost:5178. Para simular otra fecha: `http://localhost:5178/?hoy=2026-11-27`
(en ese modo no se registra el service worker y no se guarda la fecha).

## Publicar gratis con GitHub Pages

1. Crea una cuenta en https://github.com si no tienes.
2. Pulsa **New repository**, ponle un nombre (p. ej. `tratamiento`) y créalo.
   Puede ser privado solo con GitHub Pro; si es público, el código es visible, pero
   **tus datos no**: se guardan solo en tu iPhone.
3. Sube los archivos de esta carpeta. Desde la terminal, dentro de la carpeta:

   ```bash
   git init && git add . && git commit -m "Primera versión"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/tratamiento.git
   git push -u origin main
   ```

   (O, sin terminal: en el repositorio pulsa **Add file → Upload files** y arrastra todo
   el contenido de la carpeta, incluidas las carpetas `js`, `icons`.)
4. En el repositorio: **Settings → Pages → Build and deployment → Source: Deploy from a branch**,
   rama `main`, carpeta `/ (root)`, **Save**.
5. Espera 1–2 minutos. La URL será `https://TU_USUARIO.github.io/tratamiento/`.

### Alternativa: Vercel

1. Entra en https://vercel.com con tu cuenta de GitHub.
2. **Add New → Project**, elige el repositorio, Framework Preset: **Other**, sin comando de build.
3. **Deploy**. Te da una URL `https://tratamiento-xxx.vercel.app`.

## Instalar en el iPhone

1. Abre la URL en **Safari** (tiene que ser Safari).
2. Pulsa el botón **Compartir** (cuadrado con flecha hacia arriba).
3. Baja y elige **Añadir a pantalla de inicio** → **Añadir**.
4. Abre la app desde el icono. A partir de aquí funciona sin conexión.

## Publicar una actualización

Cambia `VERSION` en `sw.js` (p. ej. `'v2'`) y vuelve a subir los archivos.
En el iPhone, abre la app, ciérrala del todo y ábrela otra vez para ver la versión nueva.

## Copias de seguridad

Los datos viven solo en el iPhone (en la app instalada; Safari y la app instalada no
comparten datos). **Ajustes → Exportar** abre el menú de compartir: elige *Guardar en Archivos*
(iCloud Drive). Para restaurar: **Ajustes → Importar** y elige el `.json`.
iOS puede borrar los datos de webs que no usas en semanas; con la app en la pantalla
de inicio y usándola a diario no debería pasar, pero exporta de vez en cuando.

## Limitaciones conocidas

- **Vibración**: Safari en iPhone no permite que una web vibre. Al terminar los 3 min el
  temporizador suena (un pitido, si el modo silencio está desactivado), parpadea y mantiene la
  pantalla encendida mientras cuenta. En Android sí vibra.
- Si bloqueas el iPhone durante el temporizador, iOS pausa la web: al volver muestra
  el tiempo correcto, pero no avisará con la pantalla bloqueada.
