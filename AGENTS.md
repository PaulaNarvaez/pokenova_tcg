# Pokenova TCG

## Desarrollo

- Trabaja en el checkout existente. Cada tarea de la nube ya está aislada; no crees un worktree salvo petición explícita.
- Instala las dependencias con `npm ci` y respeta `package-lock.json`.
- Usa `npm run dev` para desarrollo, `npm run build` para producción, `npm test` para la lógica y `npm run test:e2e` para los flujos del navegador.
- Mantén la tienda en español y los precios de venta en pesos chilenos (CLP).
- No presentes precios o stock de ejemplo como información comercial real. Las referencias del mercado deben indicar fuente, moneda y fecha.

## Commits

- Usa como título la hora y fecha reales del commit en la zona `America/Santiago`, con formato `HH:mm:ss · DD-MM-YYYY`. Describe los cambios en el cuerpo del mensaje si hace falta.
- La identidad de autora del repositorio es **PaulaNarvaez**. Verifica la configuración local y reutiliza su identidad ya verificada en el historial; no uses la identidad predeterminada de otra persona.

## Configuración

- El número público de WhatsApp está en `src/site.config.js`.
- El catálogo de demostración está en `src/catalog.js`.
- No guardes credenciales ni archivos `.env` en Git.
- La compilación acepta `VITE_BASE_PATH` para alojarse en una subruta, por ejemplo `/pokenova_tcg/` en GitHub Pages.
