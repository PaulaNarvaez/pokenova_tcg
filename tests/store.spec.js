import { expect, test } from '@playwright/test';

function decodedWhatsapp(href) {
  const url = new URL(href);
  expect(url.origin).toBe('https://wa.me');
  expect(url.pathname).toBe('/56998716582');
  return url.searchParams.get('text');
}

async function stubWhatsapp(context) {
  // Context routing also intercepts the popup's initial navigation. No message
  // is sent and no WhatsApp server is contacted by these interaction tests.
  await context.route('https://wa.me/**', route => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><html><title>Consulta de prueba</title><body><h1>WhatsApp de prueba</h1></body></html>',
  }));
}

async function openStubbedWhatsapp(page, link) {
  const href = await link.getAttribute('href');
  const popupPromise = page.waitForEvent('popup');
  await link.click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL(href);
  await expect(popup.getByRole('heading', { name: 'WhatsApp de prueba' })).toBeVisible();
  await popup.close();
}

async function storedCart(page) {
  return page.evaluate(() => JSON.parse(window.localStorage.getItem('pokenova-cart-v1')));
}

test('desktop browsing, product details, persistent cart, and clearing a consulted order', async ({ page, context }) => {
  await stubWhatsapp(context);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Tu próxima');
  await expect(page.locator('.product-card')).toHaveCount(8);

  await page.locator('.filter-tabs').getByRole('button', { name: 'Cartas', exact: true }).click();
  await expect(page.locator('.product-card')).toHaveCount(2);
  await expect(page.locator('.result-count')).toHaveText('2 favoritos por descubrir');
  await page.locator('.filter-tabs').getByRole('button', { name: 'Todo el universo' }).click();
  await page.getByRole('searchbox', { name: 'Buscar en el catálogo' }).fill('Eevee');
  await expect(page.locator('.product-card')).toHaveCount(1);
  await expect(page.locator('.product-name')).toHaveText('Peluche Eevee');
  await page.getByRole('searchbox', { name: 'Buscar en el catálogo' }).fill('');
  await page.getByRole('combobox', { name: 'Ordenar productos' }).selectOption('price-asc');
  await expect(page.locator('.product-name').first()).toHaveText('Sobre Pokémon TCG');
  await expect(page.locator('.product-name').last()).toHaveText('ETB Escarlata y Púrpura');
  await page.getByRole('combobox', { name: 'Ordenar productos' }).selectOption('price-desc');
  await expect(page.locator('.product-name').first()).toHaveText('ETB Escarlata y Púrpura');
  await page.getByRole('combobox', { name: 'Ordenar productos' }).selectOption('featured');

  const detailsTrigger = page.getByRole('button', { name: 'Ver detalles de Charizard ex · Obsidian Flames' });
  await detailsTrigger.click();
  const details = page.getByRole('dialog', { name: 'Un favorito de cerca' });
  await expect(details.getByRole('heading', { name: 'Charizard ex · Obsidian Flames' })).toBeVisible();
  expect(decodedWhatsapp(await details.getByRole('link', { name: 'Consultar precio' }).getAttribute('href')))
    .toContain('precio y disponibilidad de Charizard ex · Obsidian Flames');
  await page.keyboard.press('Escape');
  await expect(details).toHaveCount(0);
  await expect(detailsTrigger).toBeFocused();

  await page.getByRole('button', { name: 'Agregar Peluche Eevee al carrito', exact: true }).click();
  const cartTrigger = page.getByRole('button', { name: 'Abrir carrito, 1 productos' });
  await cartTrigger.click();
  let cart = page.getByRole('dialog', { name: 'Tu colección (1)' });
  await expect(cart.getByRole('heading', { name: 'Peluche Eevee' })).toBeVisible();
  await cart.getByRole('button', { name: 'Aumentar cantidad de Peluche Eevee' }).click();
  cart = page.getByRole('dialog', { name: 'Tu colección (2)' });
  await expect(cart.getByLabel('Cantidad: 2', { exact: true })).toHaveText('2');
  await page.reload();
  await page.getByRole('button', { name: 'Abrir carrito, 2 productos' }).click();
  cart = page.getByRole('dialog', { name: 'Tu colección (2)' });
  await expect(cart.getByLabel('Cantidad: 2', { exact: true })).toHaveText('2');
  await cart.getByRole('button', { name: 'Reducir cantidad de Peluche Eevee' }).click();
  cart = page.getByRole('dialog', { name: 'Tu colección (1)' });
  await expect(cart.getByLabel('Cantidad: 1', { exact: true })).toHaveText('1');
  await cart.getByRole('button', { name: 'Eliminar Peluche Eevee' }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Una aventura por llenar.' })).toBeVisible();
  // Removing the focused control must not let keyboard focus escape the modal.
  await page.keyboard.press('Tab');
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Cerrar', exact: true })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Explorar la tienda' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Cerrar', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Abrir carrito, 0 productos' })).toBeFocused();
  await page.getByRole('button', { name: 'Agregar Peluche Eevee al carrito', exact: true }).click();
  await page.getByRole('button', { name: 'Agregar Peluche Eevee al carrito', exact: true }).click();
  await page.getByRole('button', { name: 'Abrir carrito, 2 productos' }).click();
  const orderLink = page.getByRole('dialog').getByRole('link', { name: 'Consultar mi pedido' });
  const message = decodedWhatsapp(await orderLink.getAttribute('href'));
  expect(message).toContain('2 × Peluche Eevee');
  expect(message).toContain('$22.990 c/u, valor de ejemplo');
  expect(message).toContain('Total de ejemplo: $45.980 CLP');
  expect(message).toContain('¿Me confirman el valor final y el envío?');
  await openStubbedWhatsapp(page, orderLink);
  await expect(page.getByRole('button', { name: 'Abrir carrito, 0 productos' })).toBeVisible();
  await expect.poll(() => storedCart(page)).toEqual([]);
  await page.reload();
  await page.getByRole('button', { name: 'Abrir carrito, 0 productos' }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Una aventura por llenar.' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.toast')).not.toHaveClass(/visible/);
  await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
  await page.screenshot({ path: '/tmp/pokenova-desktop.png', fullPage: true, animations: 'disabled' });
});

test('mobile navigation, cart, and page width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const openMenu = page.getByRole('button', { name: 'Abrir menú' });
  await expect(openMenu).toBeVisible();
  await openMenu.click();
  await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toBeVisible();
  await page.getByRole('navigation').getByRole('link', { name: 'Quiénes somos' }).click();
  await expect(page.getByRole('button', { name: 'Abrir menú' })).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('navigation')).not.toBeVisible();
  const widths = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport);

  await page.getByRole('button', { name: 'Agregar Sobre Pokémon TCG al carrito', exact: true }).click();
  await page.getByRole('button', { name: 'Abrir carrito, 1 productos' }).click();
  const cart = page.getByRole('dialog', { name: 'Tu colección (1)' });
  await expect(cart).toBeVisible();
  await expect(cart.getByRole('link', { name: 'Consultar mi pedido' })).toBeVisible();
  expect(decodedWhatsapp(await cart.getByRole('link', { name: 'Consultar mi pedido' }).getAttribute('href')))
    .toContain('Total de ejemplo: $5.990 CLP');
  const cartBounds = await cart.boundingBox();
  expect(cartBounds.x).toBeGreaterThanOrEqual(0);
  expect(cartBounds.x + cartBounds.width).toBeLessThanOrEqual(390);
  await page.keyboard.press('Escape');
  await expect(page.locator('.toast')).not.toHaveClass(/visible/);
  await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
  await page.screenshot({ path: '/tmp/pokenova-mobile.png', fullPage: true, animations: 'disabled' });
});

test('consulting one product clears only that product and preserves the other cart items', async ({ page, context }) => {
  await stubWhatsapp(context);
  await page.goto('/');
  const addCharizard = page.getByRole('button', { name: 'Agregar Charizard ex · Obsidian Flames al carrito', exact: true });
  await addCharizard.click();
  await addCharizard.click();
  await page.getByRole('button', { name: 'Agregar Peluche Eevee al carrito', exact: true }).click();
  await page.getByRole('button', { name: 'Ver detalles de Charizard ex · Obsidian Flames' }).click();
  const link = page.getByRole('dialog').getByRole('link', { name: 'Consultar precio' });
  expect(decodedWhatsapp(await link.getAttribute('href'))).toContain('Charizard ex · Obsidian Flames');
  await openStubbedWhatsapp(page, link);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Abrir carrito, 1 productos' })).toBeVisible();
  await expect.poll(() => storedCart(page)).toEqual([{ productId: 'eevee-plush', quantity: 1 }]);
  await page.reload();
  await page.getByRole('button', { name: 'Abrir carrito, 1 productos' }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Peluche Eevee' })).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Charizard ex · Obsidian Flames' })).toHaveCount(0);
});

test('buyback offers challa and sealed products through WhatsApp and removes market requests', async ({ page, context }) => {
  const marketRequests = [];
  page.on('request', request => {
    if (request.url().includes('api.tcgdex.net')) marketRequests.push(request.url());
  });
  await stubWhatsapp(context);
  await page.goto('/');
  await expect(page.locator('#compramos')).toBeVisible();
  const challa = page.locator('#compramos').getByRole('link', { name: 'Vender mi challa' });
  const sealed = page.locator('#compramos').getByRole('link', { name: 'Ofrecer productos sellados' });
  expect(decodedWhatsapp(await challa.getAttribute('href'))).toMatch(/challa/i);
  expect(decodedWhatsapp(await sealed.getAttribute('href'))).toMatch(/sellados/i);
  await openStubbedWhatsapp(page, challa);
  await openStubbedWhatsapp(page, sealed);
  await expect(page.getByRole('link', { name: 'Radar TCG' })).toHaveCount(0);
  await expect(page.locator('#mercado')).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText('USD');
  await expect(page.locator('.hero-copy')).not.toContainText('PARA TU LADO COLECCIONISTA');
  expect(marketRequests).toEqual([]);
});

test('a blocked localStorage getter still allows an in-memory shopping cart', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() { throw new DOMException('Synthetic blocked storage', 'SecurityError'); },
    });
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Agregar Peluche Pikachu al carrito', exact: true }).click();
  await page.getByRole('button', { name: 'Abrir carrito, 1 productos' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Aumentar cantidad de Peluche Pikachu' }).click();
  await expect(page.getByRole('dialog', { name: 'Tu colección (2)' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Abrir carrito, 2 productos' }).click();
  await expect(page.getByRole('dialog').getByLabel('Cantidad: 2', { exact: true })).toHaveText('2');
  expect(errors).toEqual([]);
});

test('decorative movement respects the reduced-motion preference', async ({ page }) => {
  await page.goto('/');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect.poll(() => page.locator('.hero-pikachu').evaluate(el => getComputedStyle(el).animationName)).toBe('floating');
  await expect.poll(() => page.locator('.ticker > div').evaluate(el => getComputedStyle(el).animationName)).toBe('marquee');
  await expect.poll(() => page.locator('.background-orb').first().evaluate(el => getComputedStyle(el).animationName)).toBe('backgroundDrift');
  await expect.poll(() => page.locator('.background-spark').first().evaluate(el => getComputedStyle(el).animationName)).toBe('backgroundTwinkle');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const motion = await page.evaluate(() => ({
    scroll: getComputedStyle(document.documentElement).scrollBehavior,
    animations: ['.hero-pikachu', '.ticker > div', '.hero-spark', '.wave', '.chat-emoji', '.background-orb', '.background-spark']
      .map(selector => getComputedStyle(document.querySelector(selector)).animationName),
  }));
  expect(motion.scroll).toBe('auto');
  expect(motion.animations).toEqual(Array(7).fill('none'));
});

function overlaps(a, b) {
  return a.x < b.x + b.width - 1 && a.x + a.width > b.x + 1
    && a.y < b.y + b.height - 1 && a.y + a.height > b.y + 1;
}

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`category layout and brand remain intact at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('.category-tile')).toHaveCount(4);
    const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(pageWidth).toBeLessThanOrEqual(width);
    for (const tile of await page.locator('.category-tile').all()) {
      const bounds = await tile.boundingBox();
      const label = await tile.locator('.tile-index').boundingBox();
      const copy = await tile.locator('.tile-copy').boundingBox();
      const heading = await tile.getByRole('heading', { level: 3 }).boundingBox();
      const visual = await tile.locator('.tile-visual').boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      for (const box of [label, copy, heading, visual]) {
        expect(box.width).toBeGreaterThan(0);
        expect(box.height).toBeGreaterThan(0);
        expect(box.x).toBeGreaterThanOrEqual(bounds.x - 1);
        expect(box.x + box.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1);
      }
      expect(overlaps(label, heading)).toBe(false);
      expect(overlaps(label, visual)).toBe(false);
      expect(overlaps(copy, visual)).toBe(false);
    }
    const logo = page.locator('header .brand img.brand-symbol');
    await expect(logo).toBeVisible();
    expect(await logo.evaluate(image => image.naturalWidth)).toBeGreaterThan(0);
    const faviconHref = await page.locator('link[rel="icon"]').getAttribute('href');
    const logoSrc = await logo.getAttribute('src');
    const normalizePath = value => {
      const url = new URL(value, page.url());
      return `${url.origin}${url.pathname}`;
    };
    expect(normalizePath(logoSrc)).toBe(normalizePath(faviconHref));
    await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
    await page.screenshot({ path: `/tmp/pokenova-refresh-${width}.png`, fullPage: true, animations: 'disabled' });
  });
}
