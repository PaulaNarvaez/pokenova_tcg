import test from 'node:test'
import assert from 'node:assert/strict'
import { fetchMarketPrice, marketCards, parseMarketPrice } from '../src/market.js'

// Synthetic fixtures test the documented schema, not actual market quotations.
const updated = '2025-08-05T20:07:54.000Z'
const tcgFixture = (marketPrice, extra = {}) => ({
  pricing: {
    tcgplayer: {
      updated,
      unit: 'USD',
      holofoil: { marketPrice },
      ...extra,
    },
  },
})

test('the three selected cards use verified TCGdex and TCGplayer identities', () => {
  assert.deepEqual(marketCards.map(({ id }) => id), ['sv03-223', 'swsh12-049', 'sv03.5-173'])
  assert.deepEqual(marketCards.map(({ tcgplayerUrl }) => tcgplayerUrl), [
    'https://www.tcgplayer.com/product/509980',
    'https://www.tcgplayer.com/product/451703',
    'https://www.tcgplayer.com/product/513721',
  ])
})

test('returns the dated TCGplayer market price with its original variant', () => {
  assert.deepEqual(parseMarketPrice(tcgFixture(12.5)), {
    price: 12.5,
    currency: 'USD',
    updatedAt: updated,
    source: 'TCGplayer',
    variant: 'holofoil',
  })
  assert.equal(parseMarketPrice(tcgFixture(0, { reverse: { marketPrice: 2.5 } })).variant, 'reverse')
})

test('prefers TCGplayer over a valid Cardmarket reference', () => {
  const card = tcgFixture(12.5)
  card.pricing.cardmarket = { updated, unit: 'EUR', 'trend-holo': 10 }
  assert.equal(parseMarketPrice(card).source, 'TCGplayer')
})

test('falls back to a dated Cardmarket foil trend, then its normal trend', () => {
  const card = { pricing: { cardmarket: { updated, unit: 'EUR', 'trend-holo': 4, trend: 2 } } }
  assert.deepEqual(parseMarketPrice(card), {
    price: 4,
    currency: 'EUR',
    updatedAt: updated,
    source: 'Cardmarket',
    variant: 'holo',
  })
  card.pricing.cardmarket['trend-holo'] = null
  assert.equal(parseMarketPrice(card).price, 2)
  assert.equal(parseMarketPrice(card).variant, 'normal')
})

test('never fabricates missing prices or treats invalid numbers as quotations', () => {
  for (const card of [null, undefined, {}, { pricing: null }, { pricing: {} }]) {
    assert.equal(parseMarketPrice(card), null)
  }
  for (const price of [undefined, null, 0, -1, NaN, Infinity, '12.5']) {
    assert.equal(parseMarketPrice(tcgFixture(price)), null)
    assert.equal(parseMarketPrice({ pricing: { cardmarket: { updated, unit: 'EUR', trend: price } } }), null)
  }
})

test('requires explicit provider currency and a valid update date', () => {
  for (const date of [undefined, null, '', 'invalid', '2025-02-30T12:00:00.000Z', '2025-13-01T00:00:00Z']) {
    assert.equal(parseMarketPrice(tcgFixture(1, { updated: date })), null)
    assert.equal(parseMarketPrice({ pricing: { cardmarket: { updated: date, unit: 'EUR', trend: 1 } } }), null)
  }
  for (const unit of [undefined, null, '', 'EUR', 'CLP']) {
    assert.equal(parseMarketPrice(tcgFixture(1, { unit })), null)
  }
  assert.equal(parseMarketPrice({ pricing: { cardmarket: { updated, unit: 'USD', trend: 1 } } }), null)
})

test('an invalid TCGplayer reference may fall back to valid Cardmarket data', () => {
  const card = tcgFixture(20, { updated: 'invalid' })
  card.pricing.cardmarket = { updated, unit: 'EUR', trend: 4 }
  assert.equal(parseMarketPrice(card).source, 'Cardmarket')
})

test('fetches the documented direct card response and forwards cancellation', async () => {
  const controller = new AbortController()
  let receivedUrl
  let receivedOptions
  const result = await fetchMarketPrice('sv03-223', {
    signal: controller.signal,
    fetchImpl: async (url, options) => {
      receivedUrl = url
      receivedOptions = options
      return { ok: true, json: async () => tcgFixture(1) }
    },
  })
  assert.equal(receivedUrl, 'https://api.tcgdex.net/v2/en/cards/sv03-223')
  assert.equal(receivedOptions.signal, controller.signal)
  assert.equal(result.price, 1)
})

test('returns null for a successful response without pricing', async () => {
  assert.equal(await fetchMarketPrice('sv03-223', {
    fetchImpl: async () => ({ ok: true, json: async () => ({ id: 'sv03-223' }) }),
  }), null)
})

test('throws HTTP, transport, JSON and abort errors instead of stale or fake prices', async () => {
  await assert.rejects(fetchMarketPrice('sv03-223', {
    fetchImpl: async () => ({ ok: false, status: 503 }),
  }), /HTTP 503/)
  await assert.rejects(fetchMarketPrice('sv03-223', {
    fetchImpl: async () => { throw new TypeError('Failed to fetch') },
  }), /Failed to fetch/)
  await assert.rejects(fetchMarketPrice('sv03-223', {
    fetchImpl: async () => ({ ok: true, json: async () => { throw new SyntaxError('Invalid JSON') } }),
  }), /Invalid JSON/)
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(fetchMarketPrice('sv03-223', {
    signal: controller.signal,
    fetchImpl: async (_, { signal }) => { signal.throwIfAborted() },
  }), { name: 'AbortError' })
})
