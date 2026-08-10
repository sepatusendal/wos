export interface WeatherData {
  temp: number           // celsius
  condition: string      // "Cerah", "Hujan", "Berawan", etc
  icon: string           // emoji
  humidity: number       // percentage
  location: string       // city name
  updatedAt: string      // ISO
}

interface OpenMeteoCurrentWeather {
  temperature: number
  windspeed: number
  winddirection: number
  weathercode: number
  time: string
}

interface OpenMeteoResponse {
  current_weather: OpenMeteoCurrentWeather
  current_weather_units?: {
    temperature: string
  }
}

// Map WMO weather codes to Indonesian labels + emoji
function mapWeatherCode(code: number): { condition: string; icon: string } {
  if (code === 0) return { condition: 'Cerah', icon: '☀️' }                         // ☀️
  if (code >= 1 && code <= 3) return { condition: 'Cerah Berawan', icon: '🌤️' } // 🌤️
  if (code >= 45 && code <= 48) return { condition: 'Berkabut', icon: '🌫️' }    // 🌫️
  if (code >= 51 && code <= 55) return { condition: 'Gerimis', icon: '🌦️' }     // 🌦️
  if (code >= 61 && code <= 65) return { condition: 'Hujan', icon: '🌧️' }       // 🌧️
  if (code >= 71 && code <= 77) return { condition: 'Hujan Salju', icon: '❄️' }       // ❄️
  if (code >= 80 && code <= 82) return { condition: 'Hujan Ringan', icon: '🌦️' } // 🌦️
  if (code >= 95 && code <= 99) return { condition: 'Badai', icon: '⛈️' }             // ⛈️
  return { condition: 'Tidak Diketahui', icon: '🌡️' }                           // 🌡️
}

interface CacheEntry {
  data: WeatherData
  timestamp: number
}

const CACHE_DURATION_MS = 30 * 60 * 1000 // 30 minutes
let weatherCache: CacheEntry | null = null

/**
 * Fetch current weather from Open-Meteo (free, no API key).
 * Caches for 30 minutes.
 * Default location: Jakarta (-6.2, 106.8)
 */
export async function fetchWeather(
  lat: number = -6.2,
  lon: number = 106.8,
): Promise<WeatherData | null> {
  // Return cached data if still fresh
  if (weatherCache && Date.now() - weatherCache.timestamp < CACHE_DURATION_MS) {
    // Update the timestamp to reflect "as of now" but keep data
    return { ...weatherCache.data, updatedAt: new Date().toISOString() }
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=relativehumidity_2m`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data: OpenMeteoResponse & { hourly?: { relativehumidity_2m?: number[]; time?: string[] } } = await res.json()

    const cw = data.current_weather
    const { condition, icon } = mapWeatherCode(cw.weathercode)

    // Extract humidity from hourly data — use the current hour
    let humidity = 0
    if (data.hourly?.relativehumidity_2m && data.hourly?.time) {
      const nowHour = new Date().toISOString().slice(0, 13) + ':00'
      const idx = data.hourly.time.findIndex((t: string) => t === nowHour)
      if (idx >= 0) {
        humidity = data.hourly.relativehumidity_2m[idx] ?? 0
      } else {
        humidity = data.hourly.relativehumidity_2m[0] ?? 0
      }
    }

    const result: WeatherData = {
      temp: Math.round(cw.temperature),
      condition,
      icon,
      humidity: Math.round(humidity),
      location: 'Jakarta',
      updatedAt: new Date().toISOString(),
    }

    weatherCache = { data: result, timestamp: Date.now() }
    return result
  } catch (err) {
    console.warn('[Weather] fetch failed:', err)
    return null
  }
}

/**
 * Clear the weather cache (useful for testing or forced refresh).
 */
export function clearWeatherCache(): void {
  weatherCache = null
}
