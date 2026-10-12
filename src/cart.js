const STORAGE_KEY = 'pokenova-cart-v1';

function validId(id) {
  return typeof id === 'string' && id.trim().length > 0;
}

function validStock(stock) {
  return Number.isSafeInteger(stock) && stock >= 0 ? stock : 0;
}

function sanitizeItems(items) {
  if (!Array.isArray(items)) return [];
  const quantities = new Map();

  for (const item of items) {
    if (!item || !validId(item.productId) || !Number.isSafeInteger(item.quantity) || item.quantity <= 0) continue;
    const previous = quantities.get(item.productId) ?? 0;
    quantities.set(item.productId, Math.min(Number.MAX_SAFE_INTEGER, previous + item.quantity));
  }

  return [...quantities].map(([productId, quantity]) => ({ productId, quantity }));
}

export function addToCart(items, productId, stock) {
  const next = sanitizeItems(items);
  if (!validId(productId)) return next;
  const quantity = next.find((item) => item.productId === productId)?.quantity ?? 0;
  return updateQuantity(next, productId, Math.min(quantity + 1, validStock(stock)), stock);
}

export function updateQuantity(items, productId, quantity, stock) {
  const next = sanitizeItems(items);
  if (!validId(productId) || !Number.isSafeInteger(quantity)) return next;
  const boundedQuantity = Math.max(0, Math.min(quantity, validStock(stock)));
  if (boundedQuantity === 0) return next.filter((item) => item.productId !== productId);

  const existing = next.find((item) => item.productId === productId);
  if (existing) {
    return next.map((item) => item.productId === productId ? { productId, quantity: boundedQuantity } : item);
  }
  return [...next, { productId, quantity: boundedQuantity }];
}

export function removeFromCart(items, productId) {
  return sanitizeItems(items).filter((item) => item.productId !== productId);
}

export function getCartCount(items) {
  return sanitizeItems(items).reduce((count, item) => count + item.quantity, 0);
}

export function getCartSubtotal(items, products) {
  const productMap = new Map(products.map((product) => [product.id, product]));
  return sanitizeItems(items).reduce((subtotal, item) => {
    const product = productMap.get(item.productId);
    if (!product || typeof product.price !== 'number' || !Number.isFinite(product.price) || product.price < 0) return subtotal;
    return subtotal + product.price * Math.min(item.quantity, validStock(product.stock));
  }, 0);
}

export function readCart(storage, products) {
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY));
    const productMap = new Map(products.map((product) => [product.id, product]));
    return sanitizeItems(parsed).flatMap((item) => {
      const product = productMap.get(item.productId);
      const quantity = Math.min(item.quantity, validStock(product?.stock));
      return quantity > 0 ? [{ productId: item.productId, quantity }] : [];
    });
  } catch {
    return [];
  }
}

export function saveCart(storage, items) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(sanitizeItems(items)));
    return true;
  } catch {
    return false;
  }
}
