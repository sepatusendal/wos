// ── Market Price Service ──────────────────────────────────
// Fetches live prices from Yahoo Finance (stocks) and CoinPaprika (crypto).
// In-memory cache with 24h expiry.

export interface PriceQuote {
  ticker: string
  price: number
  currency: string
  change: number       // absolute change
  changePercent: number // percentage change
  lastUpdated: string   // ISO timestamp
  source: 'yahoo' | 'coinpaprika'
}

const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

interface CacheEntry {
  quote: PriceQuote
  fetchedAt: number
}

const cache = new Map<string, CacheEntry>()

function getCached(key: string): PriceQuote | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.fetchedAt > CACHE_TTL) { cache.delete(key); return null }
  return entry.quote
}

function getCachedExpired(key: string): PriceQuote | null {
  const entry = cache.get(key)
  return entry ? entry.quote : null
}

function setCache(key: string, quote: PriceQuote): void {
  cache.set(key, { quote, fetchedAt: Date.now() })
}

// Known exchange suffixes — tickers ending with these won't get .JK appended
const KNOWN_EXCHANGE_SUFFIXES = [
  '.JK', '.SI', '.KL', '.L', '.T', '.TO', '.V', '.AX',
  '.HK', '.SS', '.SZ', '.TWO', '.TW', '.KS', '.KQ',
  '.NS', '.BO', '.PA', '.MC', '.SW', '.DE', '.F',
  '.AS', '.OL', '.ST', '.CO', '.SA',
]

function shouldAppendJK(ticker: string): boolean {
  const upper = ticker.toUpperCase()
  return !KNOWN_EXCHANGE_SUFFIXES.some((suffix) => upper.endsWith(suffix))
}

// ── Crypto symbol mapping ────────────────────────────────
const CRYPTO_MAP: Record<string, string> = {
  BTC: 'btc-bitcoin',
  ETH: 'eth-ethereum',
  USDT: 'usdt-tether',
  BNB: 'bnb-binance-coin',
  SOL: 'sol-solana',
  XRP: 'xrp-xrp',
  USDC: 'usdc-usd-coin',
  ADA: 'ada-cardano',
  DOGE: 'doge-dogecoin',
  AVAX: 'avax-avalanche',
  DOT: 'dot-polkadot',
  MATIC: 'matic-polygon',
  SHIB: 'shib-shiba-inu',
  TRX: 'trx-tron',
  UNI: 'uni-uniswap',
  LINK: 'link-chainlink',
  ATOM: 'atom-cosmos',
  LTC: 'ltc-litecoin',
  BCH: 'bch-bitcoin-cash',
  XLM: 'xlm-stellar',
  ALGO: 'algo-algorand',
  NEAR: 'near-near-protocol',
  APT: 'apt-aptos',
  SUI: 'sui-sui',
  ARB: 'arb-arbitrum',
  OP: 'op-optimism',
  PEPE: 'pepe-pepe',
  WIF: 'wif-dogwifcoin',
  INJ: 'inj-injective',
  TIA: 'tia-celestia',
  SEI: 'sei-sei',
  STRK: 'strk-starknet',
  PYTH: 'pyth-pyth-network',
  JUP: 'jup-jupiter',
  BONK: 'bonk-bonk1',
  W: 'w-wormhole',
}

function resolveCoinId(symbol: string): string {
  const upper = symbol.toUpperCase().trim()
  if (CRYPTO_MAP[upper]) return CRYPTO_MAP[upper]
  // Fallback: lowercase slug
  return `${upper.toLowerCase()}-${upper.toLowerCase()}`
}

// ── Stock price from Yahoo Finance ───────────────────────
export async function fetchStockPrice(ticker: string): Promise<PriceQuote | null> {
  const cleanTicker = ticker.trim().toUpperCase()
  const displayTicker = cleanTicker

  const cacheKey = `stock:${cleanTicker}`

  // Return fresh cache if available
  const cached = getCached(cacheKey)
  if (cached) return cached

  // Auto-append .JK for Indonesian stocks
  const symbol = shouldAppendJK(cleanTicker) ? `${cleanTicker}.JK` : cleanTicker

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`
    const res = await fetch(url)

    if (!res.ok) {
      // Return expired cache if available
      return getCachedExpired(cacheKey)
    }

    const data = await res.json()
    const result = data?.chart?.result?.[0]
    if (!result) return getCachedExpired(cacheKey)

    const meta = result.meta
    const price = meta?.regularMarketPrice
    const previousClose = meta?.previousClose
    const currency = meta?.currency ?? 'IDR'

    if (price == null) return getCachedExpired(cacheKey)

    const change = previousClose != null ? price - previousClose : 0
    const changePercent = previousClose != null && previousClose !== 0
      ? ((price - previousClose) / previousClose) * 100
      : 0

    const quote: PriceQuote = {
      ticker: displayTicker,
      price,
      currency,
      change,
      changePercent,
      lastUpdated: new Date().toISOString(),
      source: 'yahoo',
    }

    setCache(cacheKey, quote)
    return quote
  } catch {
    return getCachedExpired(cacheKey)
  }
}

// ── Crypto price from CoinPaprika ────────────────────────
export async function fetchCryptoPrice(coinId: string): Promise<PriceQuote | null> {
  const resolved = coinId.includes('-') ? coinId.toLowerCase().trim() : resolveCoinId(coinId)
  const cacheKey = `crypto:${resolved}`

  const cached = getCached(cacheKey)
  if (cached) return cached

  try {
    const url = `https://api.coinpaprika.com/v1/tickers/${resolved}`
    const res = await fetch(url)

    if (!res.ok) {
      return getCachedExpired(cacheKey)
    }

    const data = await res.json()
    const quotes = data?.quotes?.USD
    if (!quotes) return getCachedExpired(cacheKey)

    const price = quotes.price
    const changePercent = quotes.percent_change_24h ?? 0
    const change = price != null && changePercent !== 0
      ? price - (price / (1 + changePercent / 100))
      : 0

    const quote: PriceQuote = {
      ticker: coinId.toUpperCase().trim(),
      price,
      currency: 'USD',
      change,
      changePercent,
      lastUpdated: new Date().toISOString(),
      source: 'coinpaprika',
    }

    setCache(cacheKey, quote)
    return quote
  } catch {
    return getCachedExpired(cacheKey)
  }
}

// ── Bulk fetch with rate limiting ────────────────────────
export async function refreshAssetPrices(
  assets: { id: string; ticker: string; type: string }[],
): Promise<Map<string, number>> {
  const results = new Map<string, number>()

  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i]!
    if (!asset.ticker) continue

    // Rate limit: 200ms between requests
    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, 200))
    }

    try {
      if (asset.type === 'crypto') {
        const quote = await fetchCryptoPrice(asset.ticker)
        if (quote) results.set(asset.id, quote.price)
      } else if (asset.type === 'stock') {
        const quote = await fetchStockPrice(asset.ticker)
        if (quote) results.set(asset.id, quote.price)
      }
    } catch {
      // Skip failed assets
    }
  }

  return results
}
