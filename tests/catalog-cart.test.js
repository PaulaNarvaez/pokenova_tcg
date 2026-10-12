import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { products, categories, formatPrice, filterProducts } from '../src/catalog.js';
import {
  addToCart,
  updateQuantity,
  removeFromCart,
  getCartCount,
  getCartSubtotal,
  readCart,
  saveCart,
} from '../src/cart.js';

// These fixtures test behavior independently of the editable shop inventory.
const fixtures = [
  { id: 'fixture-plush', name: 'Peluche Pokémon', category: 'plush', categoryLabel: 'Peluches', description: 'Compañero suave.', price: 24990, stock: 12 },
  { id: 'fixture-card', name: 'Carta Charizard', category: 'cards', categoryLabel: 'Cartas', description: 'Carta para jugar.', price: 39990, stock: 4 },
  { id: 'fixture-etb', name: 'Elite Trainer Box', category: 'sealed', categoryLabel: 'Sellados', description: 'Caja de colección.', price: 59990, stock: 6 },
  { id: 'fixture-pack', name: 'Sobre Pokémon TCG', category: 'sealed', categoryLabel: 'Sellados', description: 'Sobre para abrir.', price: 5990, stock: 30 },
  { id: 'fixture-empty', name: 'Producto agotado', category: 'accessories', categoryLabel: 'Accesorios', description: 'Sin unidades.', price: 1000, stock: 0 },
];

function createStorage(initial = null) {
  let value = initial;
  return {
    getItem(key) {
      assert.equal(key, 'pokenova-cart-v1');
      return value;
    },
    setItem(key, next) {
      assert.equal(key, 'pokenova-cart-v1');
      value = next;
    },
  };
}

test('editable catalog uses distinct ids, valid categories, CLP prices, inventory and local browser images', () => {
  assert.ok(Array.isArray(products));
  assert.ok(Array.isArray(categories));
  assert.ok(categories.some(({ id }) => id === 'all'));
  assert.equal(new Set(categories.map(({ id }) => id)).size, categories.length);
  assert.equal(new Set(products.map(({ id }) => id)).size, products.length);
  for (const product of products) {
    assert.ok(typeof product.id === 'string' && product.id.trim().length > 0);
    assert.ok(typeof product.name === 'string' && product.name.trim().length > 0);
    assert.ok(typeof product.categoryLabel === 'string' && product.categoryLabel.trim().length > 0);
    assert.equal(typeof product.description, 'string');
    assert.ok(product.category !== 'all' && categories.some(({ id }) => id === product.category));
    assert.ok(Number.isSafeInteger(product.price) && product.price >= 0);
    assert.ok(Number.isSafeInteger(product.stock) && product.stock >= 0);
    if (product.image !== null) {
      assert.equal(typeof product.image, 'string');
      assert.match(product.image, /^\/images\/.+\.(?:avif|gif|jpe?g|png|svg|webp)$/i);
      assert.ok(!product.image.split('/').includes('..'), 'Image paths must stay in public/images');
      assert.ok(existsSync(new URL(`../public${product.image}`, import.meta.url)), `Missing image for ${product.id}`);
    }
  }
});

test('prices are formatted as whole Chilean pesos, including a zero price', () => {
  assert.equal(formatPrice(24990), '$24.990');
  assert.equal(formatPrice(0), '$0');
});

test('search ignores accents and case and combines with category', () => {
  const result = filterProducts(fixtures, { category: 'sealed', query: ' POKEMON ' });
  assert.deepEqual(result.map(({ id }) => id), ['fixture-pack']);
  assert.equal(filterProducts(fixtures, { category: 'plush', query: 'CHARIZARD' }).length, 0);
  assert.deepEqual(filterProducts(fixtures, { query: 'compañero' }).map(({ id }) => id), ['fixture-plush']);
  assert.deepEqual(filterProducts(fixtures, { query: '  ' }), fixtures);
});

test('price sorting works without mutating catalog and featured restores its order', () => {
  const original = fixtures.map(({ id }) => id);
  const ascending = filterProducts(fixtures, { sort: 'price-asc' });
  assert.deepEqual(ascending.map(({ id }) => id), ['fixture-empty', 'fixture-pack', 'fixture-plush', 'fixture-card', 'fixture-etb']);
  assert.deepEqual(filterProducts(fixtures, { sort: 'price-desc' }), [...ascending].reverse());
  assert.deepEqual(fixtures.map(({ id }) => id), original);
  assert.deepEqual(filterProducts(fixtures).map(({ id }) => id), original);
});

test('cart increments and quantity changes respect available stock without mutating input', () => {
  const initial = [{ productId: 'fixture-card', quantity: 3 }];
  const next = addToCart(initial, 'fixture-card', 4);
  assert.deepEqual(next, [{ productId: 'fixture-card', quantity: 4 }]);
  assert.deepEqual(addToCart(next, 'fixture-card', 4), next);
  assert.deepEqual(initial, [{ productId: 'fixture-card', quantity: 3 }]);
  assert.deepEqual(updateQuantity(next, 'fixture-card', 20, 4), next);
  assert.deepEqual(updateQuantity(next, 'fixture-card', 0, 4), []);
  assert.deepEqual(updateQuantity(next, 'fixture-card', -2, 4), []);
  assert.deepEqual(addToCart([], 'fixture-card', 0), []);
  assert.deepEqual(addToCart([], 'fixture-card', '4'), []);
  assert.deepEqual(updateQuantity(next, 'fixture-card', '2', 4), next);
  assert.deepEqual(updateQuantity(next, 'fixture-card', 1.5, 4), next);
});

test('cart supports removal, unit count and subtotal using explicit prices and stocks', () => {
  const items = [
    { productId: 'fixture-plush', quantity: 2 },
    { productId: 'fixture-pack', quantity: 3 },
  ];
  assert.equal(getCartCount(items), 5);
  assert.equal(getCartSubtotal(items, fixtures), 67950);
  assert.deepEqual(removeFromCart(items, 'fixture-plush'), [{ productId: 'fixture-pack', quantity: 3 }]);
  assert.equal(getCartSubtotal([{ productId: 'missing', quantity: 2 }], fixtures), 0);
  assert.equal(getCartSubtotal([{ productId: 'fixture-card', quantity: 50 }], fixtures), 159960);
  assert.equal(getCartSubtotal([{ productId: 'fixture-empty', quantity: 1 }], fixtures), 0);
});

test('subtotal uses updated prices and ignores unusable prices', () => {
  const items = [{ productId: 'updated', quantity: 2 }];
  assert.equal(getCartSubtotal(items, [{ id: 'updated', price: 10990, stock: 5 }]), 21980);
  assert.equal(getCartSubtotal(items, [{ id: 'updated', price: 15990, stock: 5 }]), 31980);
  for (const price of [NaN, Infinity, -1, '10990', null]) {
    assert.equal(getCartSubtotal(items, [{ id: 'updated', price, stock: 5 }]), 0);
  }
});

test('restored cart discards bad entries and unknown products, merges duplicates and clamps stock', () => {
  const storage = createStorage(JSON.stringify([
    { productId: 'fixture-card', quantity: 3 },
    { productId: 'fixture-card', quantity: 3 },
    { productId: 'fixture-pack', quantity: 2 },
    { productId: 'missing', quantity: 1 },
    { productId: 'fixture-plush', quantity: '2' },
    { productId: 'fixture-etb', quantity: -1 },
    { productId: 'fixture-plush', quantity: 0.5 },
    { productId: 'fixture-empty', quantity: 1 },
    { productId: null, quantity: 1 },
    null,
    'invalid',
  ]));
  assert.deepEqual(readCart(storage, fixtures), [
    { productId: 'fixture-card', quantity: 4 },
    { productId: 'fixture-pack', quantity: 2 },
  ]);
});

test('unavailable storage and corrupt or non-array payloads leave a usable empty cart', () => {
  for (const payload of [null, '', '{broken', 'null', '{}', '"string"', '42']) {
    assert.deepEqual(readCart(createStorage(payload), fixtures), []);
  }
  const blockedStorage = {
    getItem() { throw new Error('Storage unavailable'); },
    setItem() { throw new Error('Quota exceeded'); },
  };
  assert.deepEqual(readCart(blockedStorage, fixtures), []);
  assert.equal(saveCart(blockedStorage, []), false);
  assert.deepEqual(readCart(undefined, fixtures), []);
  assert.equal(saveCart(undefined, []), false);
});

test('cart persists and restores valid quantities with independent inventory fixtures', () => {
  const storage = createStorage();
  const items = addToCart(addToCart([], 'fixture-plush', 12), 'fixture-pack', 30);
  assert.equal(saveCart(storage, items), true);
  assert.deepEqual(readCart(storage, fixtures), items);
});
