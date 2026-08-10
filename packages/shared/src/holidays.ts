export interface HolidayData {
  date: string        // YYYY-MM-DD
  name: string        // "Idul Fitri", "Hari Kemerdekaan", etc
  type: 'nasional' | 'cuti-bersama'
}

// Indonesian Public Holidays API: free, no key
// Endpoint: https://indonesian-public-holidays.vercel.app/api?year={year}
// Returns JSON array of { date, name, is_national_holiday }

// In-memory cache per year
const holidayCache = new Map<number, HolidayData[]>()

export async function fetchHolidays(year?: number): Promise<HolidayData[]> {
  const y = year ?? new Date().getFullYear()

  // Return from cache if available
  if (holidayCache.has(y)) return holidayCache.get(y)!

  try {
    const res = await fetch(`https://indonesian-public-holidays.vercel.app/api?year=${y}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()

    // Map API response to our HolidayData shape
    const holidays: HolidayData[] = (data as any[]).map((item) => ({
      date: item.date,
      name: item.name,
      type: item.is_national_holiday === true ? 'nasional' : 'cuti-bersama',
    }))

    holidayCache.set(y, holidays)
    return holidays
  } catch {
    // Offline / error: return empty — graceful degradation
    return []
  }
}

// Precompute a lookup map keyed by date string for fast O(1) access
export function holidaysByDate(holidays: HolidayData[]): Map<string, HolidayData> {
  const map = new Map<string, HolidayData>()
  for (const h of holidays) {
    map.set(h.date, h)
  }
  return map
}
