import { expect, test } from '@playwright/test';
import { products, categories, formatPrice } from '../src/catalog.js';
import { store } from '../src/site.config.js';

const availableProducts = products.filter(product => product.stock > 0);
const cartProduct = availableProducts.find(product => product.stock >= 2) ?? availableProducts[0];

function decodedWhatsapp(href) {
  const url = new URL(href);
  expect(url.origin).toBe('https://wa.me');
  expect(url.pathname).toBe(`/${store.whatsapp}`);
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

function addButton(page, product) {
  return productCard(page, product).getByRole('button', { name: `Agregar ${product.name} al carrito`, exact: true });
}

function productCard(page, product) {
  return page.locator('.product-card').nth(products.findIndex(item => item.id === product.id));
}

async function expectEmptyCart(page) {
  await page.getByRole('button', { name: 'Abrir carrito, 0 productos' }).click();
  const cart = page.getByRole('dialog', { name: 'Tu colección (0)' });
  await expect(cart.getByRole('heading', { name: 'Una aventura por llenar.' })).toBeVisible();
  await expect(cart.getByRole('link', { name: 'Consultar mi pedido' })).toHaveCount(0);
  return cart;
}

async function expectNoAvailableProducts(page) {
  // Empty and sold-out catalogs remain usable; cart logic is also covered by
  // independent unit fixtures even when the live inventory has no stock.
  if (products.length === 0) {
    await expect(page.locator('.empty-search')).toBeVisible();
  } else {
    await addButton(page, products[0]).click();
    await expect(page.locator('.toast')).toContainText('Ya agregaste todas las unidades disponibles.');
  }
  await expectEmptyCart(page);
  await expect.poll(() => storedCart(page)).toEqual([]);
}

function normalizeSearch(text) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-CL');
}

async function screenshot(page, path) {
  await expect(page.locator('.toast')).not.toHaveClass(/visible/);
  await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
  await page.screenshot({ path, fullPage: true, animations: 'disabled' });
}

test('desktop browsing, product details, persistent cart, and clearing a consulted order', async ({ page, context }) => {
  await stubWhatsapp(context);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Tu próxima');
  await expect(page.locator('.product-card')).toHaveCount(products.length);

  const category = categories.find(item => item.id !== 'all');
  if (category) {
    const categoryProducts = products.filter(product => product.category === category.id);
    await page.locator('.filter-tabs').getByRole('button', { name: category.label, exact: true }).click();
    await expect(page.locator('.product-card')).toHaveCount(categoryProducts.length);
    await expect(page.locator('.result-count')).toHaveText(`${categoryProducts.length} ${categoryProducts.length === 1 ? 'favorito' : 'favoritos'} por descubrir`);
  }
  await page.locator('.filter-tabs').getByRole('button', { name: categories.find(item => item.id === 'all').label, exact: true }).click();
  if (products.length > 0) {
    const query = products[0].name;
    const searchMatches = products.filter(product => normalizeSearch(`${product.name} ${product.categoryLabel} ${product.description}`).includes(normalizeSearch(query)));
    await page.getByRole('searchbox', { name: 'Buscar en el catálogo' }).fill(query);
    await expect(page.locator('.product-name')).toHaveText(searchMatches.map(product => product.name));
    await page.getByRole('searchbox', { name: 'Buscar en el catálogo' }).fill('');
  }
  await page.getByRole('combobox', { name: 'Ordenar productos' }).selectOption('price-asc');
  await expect(page.locator('.product-name')).toHaveText([...products].sort((a, b) => a.price - b.price).map(product => product.name));
  await page.getByRole('combobox', { name: 'Ordenar productos' }).selectOption('price-desc');
  await expect(page.locator('.product-name')).toHaveText([...products].sort((a, b) => b.price - a.price).map(product => product.name));
  await page.getByRole('combobox', { name: 'Ordenar productos' }).selectOption('featured');
  await expect(page.locator('.product-name')).toHaveText(products.map(product => product.name));

  if (products.length > 0) {
    const product = products[0];
    const detailsTrigger = productCard(page, product).getByRole('button', { name: `Ver detalles de ${product.name}`, exact: true });
    await detailsTrigger.click();
    const details = page.getByRole('dialog', { name: 'Un favorito de cerca' });
    await expect(details.getByRole('heading', { name: product.name, exact: true })).toBeVisible();
    await expect(details.locator('.detail-price strong')).toHaveText(`${formatPrice(product.price)} CLP`);
    if (product.image) {
      const image = details.getByRole('img', { name: product.name, exact: true });
      await expect(image).toBeVisible();
      await expect.poll(() => image.evaluate(element => element.naturalWidth)).toBeGreaterThan(0);
    }
    expect(decodedWhatsapp(await details.getByRole('link', { name: 'Consultar precio' }).getAttribute('href')))
      .toContain(`precio y disponibilidad de ${product.name}`);
    await page.keyboard.press('Escape');
    await expect(details).toHaveCount(0);
    await expect(detailsTrigger).toBeFocused();
  }

  if (!cartProduct) {
    await expectNoAvailableProducts(page);
    await page.keyboard.press('Escape');
    await screenshot(page, '/tmp/pokenova-desktop.png');
    return;
  }
  const quantity = Math.min(2, cartProduct.stock);
  await addButton(page, cartProduct).click();
  await page.getByRole('button', { name: 'Abrir carrito, 1 productos' }).click();
  let cart = page.getByRole('dialog', { name: 'Tu colección (1)' });
  await expect(cart.getByRole('heading', { name: cartProduct.name, exact: true })).toBeVisible();
  if (quantity === 2) {
    await cart.getByRole('button', { name: `Aumentar cantidad de ${cartProduct.name}`, exact: true }).click();
  } else {
    await expect(cart.getByRole('button', { name: `Aumentar cantidad de ${cartProduct.name}`, exact: true })).toBeDisabled();
  }
  cart = page.getByRole('dialog', { name: `Tu colección (${quantity})` });
  await expect(cart.getByLabel(`Cantidad: ${quantity}`, { exact: true })).toHaveText(String(quantity));
  await page.reload();
  await page.getByRole('button', { name: `Abrir carrito, ${quantity} productos` }).click();
  cart = page.getByRole('dialog', { name: `Tu colección (${quantity})` });
  await expect(cart.getByLabel(`Cantidad: ${quantity}`, { exact: true })).toHaveText(String(quantity));
  if (quantity === 2) {
    await cart.getByRole('button', { name: `Reducir cantidad de ${cartProduct.name}`, exact: true }).click();
    cart = page.getByRole('dialog', { name: 'Tu colección (1)' });
    await expect(cart.getByLabel('Cantidad: 1', { exact: true })).toHaveText('1');
  }
  await cart.getByRole('button', { name: `Eliminar ${cartProduct.name}`, exact: true }).click();
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
  for (let unit = 0; unit < quantity; unit += 1) await addButton(page, cartProduct).click();
  await page.getByRole('button', { name: `Abrir carrito, ${quantity} productos` }).click();
  const orderLink = page.getByRole('dialog').getByRole('link', { name: 'Consultar mi pedido' });
  const message = decodedWhatsapp(await orderLink.getAttribute('href'));
  expect(message).toContain(`${quantity} × ${cartProduct.name}`);
  expect(message).toContain(`${formatPrice(cartProduct.price)} c/u, valor de ejemplo`);
  expect(message).toContain(`Total de ejemplo: ${formatPrice(quantity * cartProduct.price)} CLP`);
  expect(message).toContain('¿Me confirman el valor final y el envío?');
  await openStubbedWhatsapp(page, orderLink);
  await expect(page.getByRole('button', { name: 'Abrir carrito, 0 productos' })).toBeVisible();
  await expect.poll(() => storedCart(page)).toEqual([]);
  await page.reload();
  await expectEmptyCart(page);
  await page.keyboard.press('Escape');
  await screenshot(page, '/tmp/pokenova-desktop.png');
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

  let cart;
  if (cartProduct) {
    await addButton(page, cartProduct).click();
    await page.getByRole('button', { name: 'Abrir carrito, 1 productos' }).click();
    cart = page.getByRole('dialog', { name: 'Tu colección (1)' });
    await expect(cart.getByRole('link', { name: 'Consultar mi pedido' })).toBeVisible();
    expect(decodedWhatsapp(await cart.getByRole('link', { name: 'Consultar mi pedido' }).getAttribute('href')))
      .toContain(`Total de ejemplo: ${formatPrice(cartProduct.price)} CLP`);
  } else {
    cart = await expectEmptyCart(page);
  }
  await expect(cart).toBeVisible();
  const cartBounds = await cart.boundingBox();
  expect(cartBounds.x).toBeGreaterThanOrEqual(0);
  expect(cartBounds.x + cartBounds.width).toBeLessThanOrEqual(390);
  await page.keyboard.press('Escape');
  await screenshot(page, '/tmp/pokenova-mobile.png');
});

test('consulting one product clears only that product and preserves other available cart items', async ({ page, context }) => {
  await stubWhatsapp(context);
  await page.goto('/');
  if (!cartProduct) {
    await expectNoAvailableProducts(page);
    return;
  }
  const otherProduct = availableProducts.find(product => product.id !== cartProduct.id);
  const quantity = Math.min(2, cartProduct.stock);
  for (let unit = 0; unit < quantity; unit += 1) await addButton(page, cartProduct).click();
  if (otherProduct) await addButton(page, otherProduct).click();
  await productCard(page, cartProduct).getByRole('button', { name: `Ver detalles de ${cartProduct.name}`, exact: true }).click();
  const link = page.getByRole('dialog').getByRole('link', { name: 'Consultar precio' });
  expect(decodedWhatsapp(await link.getAttribute('href'))).toContain(cartProduct.name);
  await openStubbedWhatsapp(page, link);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const remaining = otherProduct ? [{ productId: otherProduct.id, quantity: 1 }] : [];
  await expect(page.getByRole('button', { name: `Abrir carrito, ${remaining.length} productos` })).toBeVisible();
  await expect.poll(() => storedCart(page)).toEqual(remaining);
  await page.reload();
  await page.getByRole('button', { name: `Abrir carrito, ${remaining.length} productos` }).click();
  await expect(page.getByRole('dialog').locator('.cart-item')).toHaveCount(remaining.length);
  if (otherProduct) {
    await expect(page.getByRole('dialog').getByRole('heading', { name: otherProduct.name, exact: true })).toBeVisible();
  } else {
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'Una aventura por llenar.' })).toBeVisible();
  }
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

test('a blocked localStorage getter still allows a usable in-memory cart', async ({ page }) => {
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
  if (cartProduct) {
    const quantity = Math.min(2, cartProduct.stock);
    await addButton(page, cartProduct).click();
    await page.getByRole('button', { name: 'Abrir carrito, 1 productos' }).click();
    if (quantity === 2) {
      await page.getByRole('dialog').getByRole('button', { name: `Aumentar cantidad de ${cartProduct.name}`, exact: true }).click();
    } else {
      await expect(page.getByRole('dialog').getByRole('button', { name: `Aumentar cantidad de ${cartProduct.name}`, exact: true })).toBeDisabled();
    }
    await expect(page.getByRole('dialog', { name: `Tu colección (${quantity})` })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: `Abrir carrito, ${quantity} productos` }).click();
    await expect(page.getByRole('dialog').getByLabel(`Cantidad: ${quantity}`, { exact: true })).toHaveText(String(quantity));
  } else {
    await expectEmptyCart(page);
  }
  expect(errors).toEqual([]);
});

test('decorative sparkles animate without obstructing controls and respect reduced motion', async ({ page }) => {
  await page.goto('/');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect.poll(() => page.locator('.hero-pikachu').evaluate(el => getComputedStyle(el).animationName)).toBe('floating');
  await expect.poll(() => page.locator('.ticker > div').evaluate(el => getComputedStyle(el).animationName)).toBe('marquee');
  await expect.poll(() => page.locator('.background-orb').first().evaluate(el => getComputedStyle(el).animationName)).toBe('backgroundDrift');
  await expect.poll(() => page.locator('.background-spark').first().evaluate(el => getComputedStyle(el).animationName)).toBe('backgroundTwinkle');
  const glints = page.locator('.background-glint');
  expect(await glints.count()).toBeGreaterThan(0);
  await expect.poll(() => glints.first().evaluate(el => getComputedStyle(el).animationName)).toBe('glintTwinkle');
  const decoration = await page.locator('.animated-background').evaluate(element => ({
    hidden: element.getAttribute('aria-hidden'),
    pointerEvents: getComputedStyle(element).pointerEvents,
    durations: [...element.querySelectorAll('.background-glint')].map(glint => parseFloat(getComputedStyle(glint).animationDuration)),
  }));
  expect(decoration.hidden).toBe('true');
  expect(decoration.pointerEvents).toBe('none');
  expect(decoration.durations.every(duration => duration > 0)).toBe(true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const motion = await page.evaluate(() => ({
    scroll: getComputedStyle(document.documentElement).scrollBehavior,
    animations: ['.hero-pikachu', '.ticker > div', '.hero-spark', '.wave', '.chat-emoji', '.background-orb', '.background-spark', '.background-glint']
      .map(selector => getComputedStyle(document.querySelector(selector)).animationName),
  }));
  expect(motion.scroll).toBe('auto');
  expect(motion.animations).toEqual(Array(8).fill('none'));
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
