import { expect, test } from '@playwright/test';

// Synthetic fixtures exercise rendering; these are not real market quotations.
const syntheticPrices = {
  'sv03-223': 42.5,
  'swsh12-049': 1.25,
  'sv03.5-173': 17.75,
};

async function mockMarket(page) {
  await page.route('https://api.tcgdex.net/v2/en/cards/**', async route => {
    const id = route.request().url().split('/').at(-1);
    await route.fulfill({
      json: {
        id,
        pricing: {
          tcgplayer: {
            unit: 'USD',
            updated: '2026-10-10T08:00:00Z',
            holofoil: { marketPrice: syntheticPrices[id] },
          },
        },
      },
    });
  });
}

function decodedWhatsapp(href) {
  const url = new URL(href);
  expect(url.origin).toBe('https://wa.me');
  expect(url.pathname).toBe('/56998716582');
  return url.searchParams.get('text');
}

test('desktop browsing, market references, product details, and persistent cart', async ({ page }) => {
  await mockMarket(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Tu próxima');
  await expect(page.locator('.product-card')).toHaveCount(8);

  const firstMarket = page.locator('.market-row').first();
  await expect(firstMarket.locator('.market-price strong')).toHaveText('USD 42,50');
  await expect(firstMarket.locator('.market-price')).toContainText('TCGplayer · 10-10-26');
  await expect(firstMarket.getByRole('link', { name: 'Ver fuente' }))
    .toHaveAttribute('href', 'https://www.tcgplayer.com/product/509980');

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
  const orderLink = cart.getByRole('link', { name: 'Consultar mi pedido' });
  const message = decodedWhatsapp(await orderLink.getAttribute('href'));
  expect(message).toContain('2 × Peluche Eevee');
  expect(message).toContain('$22.990 c/u, valor de ejemplo');
  expect(message).toContain('Total de ejemplo: $45.980 CLP');
  expect(message).toContain('¿Me confirman el valor final y el envío?');

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
  await expect(page.locator('.toast')).not.toHaveClass(/visible/);
  await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
  await page.screenshot({ path: '/tmp/pokenova-desktop.png', fullPage: true, animations: 'disabled' });
});

test('mobile navigation, cart, and page width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockMarket(page);
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

test('failed market requests show an unavailable state and recover on retry', async ({ page }) => {
  let fail = true;
  let requestCount = 0;
  await page.route('https://api.tcgdex.net/v2/en/cards/**', async route => {
    requestCount += 1;
    if (fail) return route.fulfill({ status: 503, body: 'Synthetic service unavailable' });
    const id = route.request().url().split('/').at(-1);
    return route.fulfill({ json: {
      pricing: { tcgplayer: { unit: 'USD', updated: '2026-10-10T08:00:00Z', normal: { marketPrice: syntheticPrices[id] } } },
    } });
  });
  await page.goto('/');
  await expect(page.locator('.market-error')).toContainText('No pudimos consultar los precios');
  await expect(page.locator('.market-row .market-price strong')).toHaveText(['—', '—', '—']);
  await expect(page.locator('.market-row .market-price').first()).toContainText('Referencia no disponible');
  // React StrictMode can start and cancel an initial effect during development.
  const initialRequests = requestCount;
  expect(initialRequests).toBeGreaterThanOrEqual(3);
  fail = false;
  await page.getByRole('button', { name: 'Actualizar precios del mercado' }).click();
  await expect(page.locator('.market-row .market-price strong').first()).toHaveText('USD 42,50');
  await expect(page.locator('.market-error')).toHaveCount(0);
  expect(requestCount).toBe(initialRequests + 3);
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
  await mockMarket(page);
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
  await mockMarket(page);
  await page.goto('/');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect.poll(() => page.locator('.hero-pikachu').evaluate(el => getComputedStyle(el).animationName)).toBe('floating');
  await expect.poll(() => page.locator('.ticker > div').evaluate(el => getComputedStyle(el).animationName)).toBe('marquee');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const motion = await page.evaluate(() => ({
    scroll: getComputedStyle(document.documentElement).scrollBehavior,
    animations: ['.hero-pikachu', '.ticker > div', '.hero-spark', '.wave', '.chat-emoji']
      .map(selector => getComputedStyle(document.querySelector(selector)).animationName),
  }));
  expect(motion.scroll).toBe('auto');
  expect(motion.animations).toEqual(['none', 'none', 'none', 'none', 'none']);
});
