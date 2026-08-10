export interface QuoteData {
  text: string
  author: string
}

interface QuoteGardenResponse {
  statusCode: number
  message: string
  data: Array<{
    _id: string
    quoteText: string
    quoteAuthor: string
    quoteGenre: string
  }>
}

interface CacheEntry {
  data: QuoteData
  date: string // YYYY-MM-DD
}

let quoteCache: CacheEntry | null = null

const FALLBACK_QUOTE: QuoteData = {
  text: 'Hidup ini sederhana, tapi kita yang membuatnya rumit.',
  author: 'Confucius',
}

/**
 * Fetch a random quote from Quote Garden (free, no auth).
 * Caches one quote per calendar day.
 * Falls back to a built-in quote on failure.
 */
export async function fetchRandomQuote(): Promise<QuoteData> {
  const today = new Date().toISOString().slice(0, 10)

  // Return cached quote if it's still the same day
  if (quoteCache && quoteCache.date === today) {
    return quoteCache.data
  }

  try {
    const res = await fetch('https://quote-garden.onrender.com/api/v3/quotes/random')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json: QuoteGardenResponse = await res.json()

    if (json.data && json.data.length > 0) {
      const q = json.data[0]!
      const result: QuoteData = {
        text: q.quoteText,
        author: q.quoteAuthor || 'Unknown',
      }
      quoteCache = { data: result, date: today }
      return result
    }

    throw new Error('No quote data in response')
  } catch (err) {
    console.warn('[Quote] fetch failed, using fallback:', err)
    return FALLBACK_QUOTE
  }
}

/**
 * Clear the quote cache (useful for testing or forced refresh).
 */
export function clearQuoteCache(): void {
  quoteCache = null
}
