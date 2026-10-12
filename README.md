# Pokenova TCG

Pokenova TCG será una aplicación de tienda en línea dedicada a la venta de productos de Pokémon. Su objetivo es reunir en un solo lugar artículos para jugadores del Juego de Cartas Coleccionables Pokémon (TCG), coleccionistas y fans de la franquicia.

## ¿Qué podrás encontrar?

El catálogo estará enfocado en productos como:

- **Cartas Pokémon:** cartas individuales para coleccionar o completar mazos.
- **Productos TCG sellados:** sobres, cajas de sobres, Elite Trainer Boxes (ETB), mazos y colecciones especiales.
- **Accesorios para jugar y coleccionar:** fundas, carpetas, cajas para mazos y tapetes de juego.
- **Peluches y figuras:** artículos de personajes y Pokémon favoritos.
- **Otros productos Pokémon:** ropa, llaveros, decoración y más artículos relacionados con la franquicia.

## Objetivo de la aplicación

Ofrecer una experiencia de compra sencilla para explorar productos Pokémon, consultar sus características y encontrar artículos tanto para jugar como para coleccionar o regalar.

## Primera versión de la tienda

La aplicación incluye una portada con personajes Pokémon, diseño adaptable a celulares, iconos y animaciones, categorías, búsqueda, orden por precio, detalles de productos, una sección **Quiénes somos** y un carrito que se guarda en el navegador.

Los botones de **WhatsApp** permiten consultar un producto o enviar el contenido del carrito al **+56 9 9871 6582**. Esta versión no realiza pagos ni reservas; la disponibilidad, el precio final y el envío se confirman por WhatsApp.

### Precios de venta y referencias del mercado

- El catálogo, los precios CLP y las existencias en `src/catalog.js` son **de demostración**, hasta que se cargue el inventario real de la tienda. Las imágenes son referenciales; los personajes no son fotografías de los peluches.
- **Radar TCG** consulta la API pública de [TCGdex](https://tcgdex.dev/markets-prices), que proporciona referencias de TCGplayer y Cardmarket. Cada precio disponible muestra su moneda original (USD o EUR), fuente y fecha; no se convierte a CLP ni se usa como precio de venta.
- Si una referencia no existe o la conexión falla, la interfaz lo indica y ofrece un enlace a la fuente. No se muestran cotizaciones inventadas como respaldo.
- Las fuentes de las imágenes se registran en `public/images/assets-sources.json`.

## Desarrollo

Requisitos: **Node.js 24** y npm. No se necesitan credenciales ni un servidor de base de datos para esta primera versión.

```sh
npm ci
npm run dev
```

```sh
npm test            # Lógica de catálogo, carrito y referencias de precios
npm run test:e2e    # Flujos de escritorio y móvil con Playwright
npm run build      # Genera el sitio estático en dist/
npm run preview    # Comprueba la compilación de producción
```

Playwright utiliza `/usr/bin/chromium` si está disponible, o su navegador instalado. Para instalarlo en otra máquina, ejecuta `npx playwright install chromium`; también puedes indicar una ruta mediante `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

El número de WhatsApp se configura en `src/site.config.js`. El catálogo está en `src/catalog.js`; las cartas seguidas por el radar están en `src/market.js`.

### Red del entorno

La instalación utiliza `registry.npmjs.org`. Radar TCG requiere acceso HTTPS a `api.tcgdex.net`. En el entorno de nube actual, esta API respondió con un bloqueo de red: se verificaron el contrato documentado, el manejo de errores y el diseño con datos sintéticos en pruebas, pero **no se validaron cotizaciones actuales**. Los datos sintéticos están únicamente en las pruebas.

### Publicar en GitHub Pages

El código incluye el flujo **Publicar tienda** en `.github/workflows/pages.yml`. La publicación del sitio es independiente de subir el código a GitHub:

1. En GitHub, abre **Settings → Pages** y selecciona **GitHub Actions** como origen de publicación.
2. En **Actions → Publicar tienda → Run workflow**, ejecuta el flujo para publicar la versión de `main`.
3. GitHub mostrará la dirección pública cuando termine la publicación. Para publicar una nueva versión, vuelve a ejecutar el flujo.

La compilación para Pages usa `VITE_BASE_PATH=/pokenova_tcg/`. Para un dominio propio alojado en la raíz, utiliza la compilación predeterminada (`npm run build`) y publica `dist/` en un alojamiento estático.

## Convenciones

Los títulos de los commits usan la hora y fecha reales de Chile (`America/Santiago`), según las instrucciones en `AGENTS.md`.

Pokénova TCG es un proyecto independiente. Pokémon y las marcas relacionadas pertenecen a sus respectivos titulares.
