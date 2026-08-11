import type { QueryBuilder, DatabaseAdapter, Condition, OrderBy, AuthResult } from '../adapter'

const DEFAULT_ENDPOINT = '/api/db'

export interface HttpAdapterOptions {
  endpoint?: string
  headers?: Record<string, string> | (() => Record<string, string> | Promise<Record<string, string>>)
}

async function callDb(payload: any, options?: HttpAdapterOptions): Promise<any> {
  const endpoint = options?.endpoint || DEFAULT_ENDPOINT
  let customHeaders: Record<string, string> = {}
  if (typeof options?.headers === 'function') {
    customHeaders = await options.headers()
  } else if (options?.headers) {
    customHeaders = options.headers
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...customHeaders },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data?.error || `DB request gagal (${res.status})`)
  }
  return data
}

/**
 * DatabaseAdapter yang berkomunikasi lewat HTTP ke API route (mis. /api/db di Next.js).
 * Dipakai untuk web app karena libsql client di browser tidak support "file:" URL.
 */
export function createHttpAdapter(options?: string | HttpAdapterOptions): DatabaseAdapter {
  const opts: HttpAdapterOptions = typeof options === 'string' ? { endpoint: options } : options || {}
  const api = (payload: any) => callDb(payload, opts)

  const build = (state: { table: string; columns: string[]; where: Condition | null; orderBy: OrderBy[]; limit: number | null }) => {
    return {
      where(condition: Condition) {
        return build({ ...state, where: condition })
      },
      orderBy(...orders: OrderBy[]) {
        return build({ ...state, orderBy: orders })
      },
      async all(): Promise<any[]> {
        const { rows } = await api({
          operation: 'select',
          table: state.table,
          columns: state.columns,
          where: state.where,
          orderBy: state.orderBy,
          limit: state.limit,
        })
        return rows ?? []
      },
      async limit(n: number): Promise<any[]> {
        const { rows } = await api({
          operation: 'select',
          table: state.table,
          columns: state.columns,
          where: state.where,
          orderBy: state.orderBy,
          limit: n,
        })
        return rows ?? []
      },
    }
  }

  const db: QueryBuilder = {
    select(...columns: string[]) {
      const cols = columns.length > 0 ? columns : ['*']
      return {
        from(table: string) {
          return build({ table, columns: cols, where: null, orderBy: [], limit: null })
        },
      }
    },

    insert(table: string) {
      return {
        async values(data: Record<string, any>) {
          await api({ operation: 'insert', table, values: data })
        },
      }
    },

    update(table: string) {
      return {
        set(data: Record<string, any>) {
          return {
            async where(condition: Condition) {
              await api({ operation: 'update', table, where: condition, values: data })
            },
          }
        },
      }
    },

    delete(table: string) {
      return {
        async where(condition: Condition) {
          await api({ operation: 'delete', table, where: condition })
        },
      }
    },
  }

  return {
    db,
    async init() {},
    async login(username: string, password: string): Promise<AuthResult> {
      return api({ operation: 'login', username, password })
    },
    async register(username: string, password: string): Promise<AuthResult> {
      return api({ operation: 'register', username, password })
    },
  }
}
