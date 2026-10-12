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

La aplicación incluye una portada con personajes Pokémon, diseño adaptable a celulares, categorías, búsqueda, orden por precio, detalles de productos, una sección **Quiénes somos** y un carrito de consulta que se guarda en el navegador. El icono de la pestaña usa el mismo logo de la tienda. El fondo tiene una animación suave que respeta la preferencia del sistema de reducir movimiento.

Los botones de **WhatsApp** permiten consultar un producto o preparar un mensaje con el contenido del carrito al **+56 9 9871 6582**. Esta versión no realiza pagos ni reservas; la disponibilidad, el precio final y el envío se confirman por WhatsApp.

Al pulsar **Consultar mi pedido**, se abre WhatsApp con el mensaje y se vacía todo el carrito local. Al consultar un producto individual desde su ventana de detalles, se elimina solo ese producto del carrito y se conservan los demás. Abrir WhatsApp no confirma que el mensaje se haya enviado ni que el pedido esté aceptado.

### Compramos tus cartas

La tienda incluye una sección para ofrecer **challa y cartas sueltas, lotes o productos sellados**. El botón prepara una consulta por WhatsApp para coordinar la tasación. La evaluación depende del estado, contenido y características de los productos; no se promete un precio fijo ni una compra automática.

### Catálogo de demostración

- El catálogo, los precios CLP y las existencias en `src/catalog.js` son **de demostración**, hasta que se cargue el inventario real de la tienda. Las imágenes son referenciales; los personajes no son fotografías de los peluches.
- Los importes del carrito son ejemplos para presentar el flujo de consulta. La tienda confirma por WhatsApp el valor vigente y la disponibilidad.
- Las fuentes de las imágenes se registran en `public/images/assets-sources.json`.

## Desarrollo

Requisitos: **Node.js 24** y npm. No se necesitan credenciales ni un servidor de base de datos para esta primera versión.

```sh
npm ci
npm run dev
```

```sh
npm test            # Lógica de catálogo y carrito
npm run test:e2e    # Flujos de escritorio y móvil con Playwright
npm run build      # Genera el sitio estático en dist/
npm run preview    # Comprueba la compilación de producción
```

Playwright utiliza `/usr/bin/chromium` si está disponible, o su navegador instalado. Para instalarlo en otra máquina, ejecuta `npx playwright install chromium`; también puedes indicar una ruta mediante `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

La atención de la tienda se realiza por WhatsApp. El número se configura en `src/site.config.js`. El catálogo está en `src/catalog.js`.

### Red del entorno

La instalación de dependencias utiliza `registry.npmjs.org`. La tienda utiliza imágenes locales y no necesita una API de precios ni una base de datos. Los enlaces de atención abren WhatsApp.

### Publicar en GitHub Pages

El código incluye el flujo **Publicar tienda** en `.github/workflows/pages.yml`. La publicación del sitio es independiente de subir el código a GitHub:

1. En GitHub, abre **Settings → Pages** y selecciona **GitHub Actions** como origen de publicación.
2. En **Actions → Publicar tienda → Run workflow**, ejecuta el flujo para publicar la versión de `main`.
3. GitHub mostrará la dirección pública cuando termine la publicación. Para publicar una nueva versión, vuelve a ejecutar el flujo.

La compilación para Pages usa `VITE_BASE_PATH=/pokenova_tcg/`. Para un dominio propio alojado en la raíz, utiliza la compilación predeterminada (`npm run build`) y publica `dist/` en un alojamiento estático.

## Convenciones

Los títulos de los commits usan la hora y fecha reales de Chile (`America/Santiago`), según las instrucciones en `AGENTS.md`.

Pokénova TCG es un proyecto independiente. Pokémon y las marcas relacionadas pertenecen a sus respectivos titulares.
