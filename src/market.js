// Card identities and marketplace IDs verified against tcgdex/cards-database.
// References: https://tcgdex.dev/reference/card#pricing
// Prices are fetched at runtime; this module contains no stored quotations.
export const marketCards = [
  {
    id: 'sv03-223',
    name: 'Charizard ex',
    set: 'Obsidian Flames',
    number: '223/197',
    tcgplayerUrl: 'https://www.tcgplayer.com/product/509980',
  },
  {
    // TCGdex retains the leading zero from the official 049.ts data file.
    id: 'swsh12-049',
    name: 'Pikachu',
    set: 'Silver Tempest',
    number: '049/195',
    tcgplayerUrl: 'https://www.tcgplayer.com/product/451703',
  },
  {
    id: 'sv03.5-173',
    name: 'Pikachu',
    set: '151',
    number: '173/165',
    tcgplayerUrl: 'https://www.tcgplayer.com/product/513721',
  },
]

const isPrice = (value) => typeof value === 'number' && Number.isFinite(value) && value > 0

function parseUpdatedAt(value) {
  if (typeof value !== 'string') return null

  // Validate the calendar day as well as Date.parse: it normalizes February 30.
  const match = /^(\d{4})-(\d{2})-(\d{2})T/.exec(value)
  if (!match) return null
  const [, year, month, day] = match.map(Number)
  const calendarDay = new Date(Date.UTC(year, month - 1, day))
  if (
    calendarDay.getUTCFullYear() !== year ||
    calendarDay.getUTCMonth() !== month - 1 ||
    calendarDay.getUTCDate() !== day
  ) return null

  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null
}

export function parseMarketPrice(card) {
  const tcgplayer = card?.pricing?.tcgplayer
  const tcgUpdatedAt = parseUpdatedAt(tcgplayer?.updated)

  if (tcgplayer?.unit === 'USD' && tcgUpdatedAt) {
    // The documented variant names differ between examples and the reference.
    // Use the provider's actual variant name and require its marketPrice.
    for (const [variant, prices] of Object.entries(tcgplayer)) {
      if (isPrice(prices?.marketPrice)) {
        return {
          price: prices.marketPrice,
          currency: 'USD',
          updatedAt: tcgUpdatedAt,
          source: 'TCGplayer',
          variant,
        }
      }
    }
  }

  const cardmarket = card?.pricing?.cardmarket
  const cardmarketUpdatedAt = parseUpdatedAt(cardmarket?.updated)

  if (cardmarket?.unit === 'EUR' && cardmarketUpdatedAt) {
    for (const [field, variant] of [['trend-holo', 'holo'], ['trend', 'normal']]) {
      if (isPrice(cardmarket[field])) {
        return {
          price: cardmarket[field],
          currency: 'EUR',
          updatedAt: cardmarketUpdatedAt,
          source: 'Cardmarket',
          variant,
        }
      }
    }
  }

  return null
}

export async function fetchMarketPrice(cardId, { signal, fetchImpl = fetch } = {}) {
  const url = `https://api.tcgdex.net/v2/en/cards/${encodeURIComponent(cardId)}`
  const response = await fetchImpl(url, { signal, headers: { Accept: 'application/json' } })
  if (!response.ok) {
    throw new Error(`No se pudo consultar el mercado (HTTP ${response.status}).`)
  }
  return parseMarketPrice(await response.json())
}
