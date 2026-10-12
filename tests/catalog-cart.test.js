import test from 'node:test';
import assert from 'node:assert/strict';
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

test('demo catalog has distinct products with known categories, CLP prices and inventory', () => {
  assert.equal(products.length, 8);
  assert.equal(new Set(products.map(({ id }) => id)).size, products.length);
  for (const product of products) {
    assert.ok(categories.some(({ id }) => id === product.category));
    assert.ok(Number.isSafeInteger(product.price) && product.price > 0);
    assert.ok(Number.isSafeInteger(product.stock) && product.stock >= 0);
    if (product.category === 'sealed') assert.equal(product.image, null);
    else assert.match(product.image, /^\/images\/.+\.(png|webp)$/);
  }
  assert.equal(formatPrice(24990), '$24.990');
});

test('search ignores accents and case and combines with category', () => {
  const result = filterProducts(products, { category: 'sealed', query: ' POKEMON ' });
  assert.deepEqual(result.map(({ id }) => id), ['booster-pack']);
  assert.equal(filterProducts(products, { category: 'plush', query: 'CHARIZARD' }).length, 0);
  assert.equal(filterProducts(products, { query: '  ' }).length, 8);
});

test('price sorting works without mutating catalog and featured restores its order', () => {
  const original = products.map(({ id }) => id);
  const ascending = filterProducts(products, { sort: 'price-asc' });
  assert.equal(ascending[0].id, 'booster-pack');
  assert.equal(ascending.at(-1).id, 'elite-trainer-box');
  assert.deepEqual(filterProducts(products, { sort: 'price-desc' }), [...ascending].reverse());
  assert.deepEqual(products.map(({ id }) => id), original);
  assert.deepEqual(filterProducts(products).map(({ id }) => id), original);
});

test('cart increments and quantity changes respect available stock without mutating input', () => {
  const initial = [{ productId: 'charizard-card', quantity: 3 }];
  const next = addToCart(initial, 'charizard-card', 4);
  assert.deepEqual(next, [{ productId: 'charizard-card', quantity: 4 }]);
  assert.deepEqual(addToCart(next, 'charizard-card', 4), next);
  assert.deepEqual(initial, [{ productId: 'charizard-card', quantity: 3 }]);
  assert.deepEqual(updateQuantity(next, 'charizard-card', 20, 4), next);
  assert.deepEqual(updateQuantity(next, 'charizard-card', 0, 4), []);
  assert.deepEqual(updateQuantity(next, 'charizard-card', -2, 4), []);
  assert.deepEqual(addToCart([], 'charizard-card', 0), []);
  assert.deepEqual(addToCart([], 'charizard-card', '4'), []);
  assert.deepEqual(updateQuantity(next, 'charizard-card', '2', 4), next);
  assert.deepEqual(updateQuantity(next, 'charizard-card', 1.5, 4), next);
});

test('cart supports removal, unit count and subtotal using current catalog', () => {
  const items = [
    { productId: 'pikachu-plush', quantity: 2 },
    { productId: 'booster-pack', quantity: 3 },
  ];
  assert.equal(getCartCount(items), 5);
  assert.equal(getCartSubtotal(items, products), 2 * 24990 + 3 * 5990);
  assert.deepEqual(removeFromCart(items, 'pikachu-plush'), [{ productId: 'booster-pack', quantity: 3 }]);
  assert.equal(getCartSubtotal([{ productId: 'missing', quantity: 2 }], products), 0);
  assert.equal(getCartSubtotal([{ productId: 'charizard-card', quantity: 50 }], products), 4 * 39990);
});

test('restored cart discards bad entries and unknown products, merges duplicates and clamps stock', () => {
  const storage = createStorage(JSON.stringify([
    { productId: 'charizard-card', quantity: 3 },
    { productId: 'charizard-card', quantity: 3 },
    { productId: 'booster-pack', quantity: 2 },
    { productId: 'missing', quantity: 1 },
    { productId: 'eevee-plush', quantity: '2' },
    { productId: 'gengar-plush', quantity: -1 },
    { productId: 'pikachu-plush', quantity: 0.5 },
    { productId: null, quantity: 1 },
    null,
    'invalid',
  ]));
  assert.deepEqual(readCart(storage, products), [
    { productId: 'charizard-card', quantity: 4 },
    { productId: 'booster-pack', quantity: 2 },
  ]);
  assert.deepEqual(readCart(createStorage('[{"productId":"empty","quantity":1}]'), [
    { id: 'empty', stock: 0 },
  ]), []);
});

test('unavailable storage and corrupt or non-array payloads leave a usable empty cart', () => {
  for (const payload of [null, '', '{broken', 'null', '{}', '"string"', '42']) {
    assert.deepEqual(readCart(createStorage(payload), products), []);
  }
  const blockedStorage = {
    getItem() { throw new Error('Storage unavailable'); },
    setItem() { throw new Error('Quota exceeded'); },
  };
  assert.deepEqual(readCart(blockedStorage, products), []);
  assert.equal(saveCart(blockedStorage, []), false);
  assert.deepEqual(readCart(undefined, products), []);
  assert.equal(saveCart(undefined, []), false);
});

test('cart persists and restores valid quantities', () => {
  const storage = createStorage();
  const items = addToCart(addToCart([], 'pikachu-plush', 12), 'booster-pack', 30);
  assert.equal(saveCart(storage, items), true);
  assert.deepEqual(readCart(storage, products), items);
});
