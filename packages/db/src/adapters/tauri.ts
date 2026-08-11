import type { Condition, OrderBy, DatabaseAdapter, QueryBuilder } from '../adapter'

const ALLOWED_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/
const ALLOWED_OPERATORS = new Set(['=', '!=', '<', '<=', '>', '>=', 'LIKE', 'ILIKE', 'IN', 'NOT IN', 'IS', 'IS NOT'])

function sanitizeIdentifier(name: string): string {
  if (name === '*') return '*'
  if (!ALLOWED_IDENTIFIER.test(name)) {
    throw new Error(`Invalid SQL identifier: "${name}"`)
  }
  return `"${name}"`
}

function sanitizeOperator(op: string): string {
  const upper = op.trim().toUpperCase()
  if (!ALLOWED_OPERATORS.has(upper)) {
    throw new Error(`Invalid SQL operator: "${op}"`)
  }
  return upper
}

function sanitizeDirection(dir: string): 'ASC' | 'DESC' {
  const upper = dir.trim().toUpperCase()
  if (upper !== 'ASC' && upper !== 'DESC') {
    throw new Error(`Invalid ORDER BY direction: "${dir}"`)
  }
  return upper as 'ASC' | 'DESC'
}

// SQLite has no native boolean type — the Tauri SQL plugin only special-cases
// null/string/number when binding, so a raw JS boolean gets stored as the
// TEXT string "true"/"false" instead of 1/0 (and reads back inverted, since
// Boolean("false") === true). Every value that reaches the driver must be
// coerced first; every other adapter in this codebase already does this.
function coerceValue(v: any): any {
  if (typeof v === 'boolean') return v ? 1 : 0
  return v
}

function normalizeDbError(e: any): Error {
  if (e instanceof Error) return e
  return new Error(typeof e === 'string' ? e : e?.message || 'DB request gagal')
}

function buildCondition(c: Condition): { sql: string; params: any[] } {
  const col = sanitizeIdentifier(c.column)
  const op = sanitizeOperator(c.op)
  if (Array.isArray(c.value)) {
    if (c.value.length === 0) {
      return { sql: op.includes('NOT') ? '1=1' : '1=0', params: [] }
    }
    const placeholders = c.value.map(() => '?').join(', ')
    return { sql: `${col} ${op} (${placeholders})`, params: c.value.map(coerceValue) }
  }
  return { sql: `${col} ${op} ?`, params: [coerceValue(c.value)] }
}

function formatOrderClause(orders: OrderBy[]): string {
  return orders.map((o) => `${sanitizeIdentifier(o.column)} ${sanitizeDirection(o.direction)}`).join(', ')
}

export function createTauriSqlAdapter(tauriDb: any, _dbPath?: string): DatabaseAdapter {
  async function runSelect(query: string, params?: any[]) {
    try {
      return await tauriDb.select(query, params)
    } catch (e) {
      throw normalizeDbError(e)
    }
  }
  async function runExecute(query: string, params?: any[]) {
    try {
      return await tauriDb.execute(query, params)
    } catch (e) {
      throw normalizeDbError(e)
    }
  }

  const db: QueryBuilder = {
    select(...columns: string[]) {
      const colNames = columns.length > 0 ? columns.map(sanitizeIdentifier).join(', ') : '*'
      return {
        from(tableName: string) {
          const table = sanitizeIdentifier(tableName)
          return {
            where(condition: Condition) {
              return {
                orderBy(...orders: OrderBy[]) {
                  return {
                    async all() {
                      const { sql, params } = buildCondition(condition)
                      const orderClause = formatOrderClause(orders)
                      const query = `SELECT ${colNames} FROM ${table} WHERE ${sql} ORDER BY ${orderClause}`
                      return runSelect(query, params)
                    },
                    async limit(n: number) {
                      const { sql, params } = buildCondition(condition)
                      const orderClause = formatOrderClause(orders)
                      const query = `SELECT ${colNames} FROM ${table} WHERE ${sql} ORDER BY ${orderClause} LIMIT ${Number(n)}`
                      return runSelect(query, params)
                    },
                  }
                },
                async all() {
                  const { sql, params } = buildCondition(condition)
                  const query = `SELECT ${colNames} FROM ${table} WHERE ${sql}`
                  return runSelect(query, params)
                },
                async limit(n: number) {
                  const { sql, params } = buildCondition(condition)
                  const query = `SELECT ${colNames} FROM ${table} WHERE ${sql} LIMIT ${Number(n)}`
                  return runSelect(query, params)
                },
              }
            },
            orderBy(...orders: OrderBy[]) {
              return {
                async all() {
                  const orderClause = formatOrderClause(orders)
                  const query = `SELECT ${colNames} FROM ${table} ORDER BY ${orderClause}`
                  return runSelect(query)
                },
                async limit(n: number) {
                  const orderClause = formatOrderClause(orders)
                  const query = `SELECT ${colNames} FROM ${table} ORDER BY ${orderClause} LIMIT ${Number(n)}`
                  return runSelect(query)
                },
              }
            },
            async all() {
              const query = `SELECT ${colNames} FROM ${table}`
              return runSelect(query)
            },
            async limit(n: number) {
              const query = `SELECT ${colNames} FROM ${table} LIMIT ${Number(n)}`
              return runSelect(query)
            },
          }
        },
      }
    },

    insert(tableName: string) {
      const table = sanitizeIdentifier(tableName)
      return {
        async values(data: Record<string, any>) {
          const keys = Object.keys(data).map(sanitizeIdentifier)
          if (keys.length === 0) return
          const vals = Object.values(data).map(coerceValue)
          const placeholders = vals.map(() => '?')
          const query = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders.join(', ')})`
          await runExecute(query, vals)
        },
      }
    },

    update(tableName: string) {
      const table = sanitizeIdentifier(tableName)
      return {
        set(data: Record<string, any>) {
          return {
            async where(condition: Condition) {
              const keys = Object.keys(data).map(sanitizeIdentifier)
              if (keys.length === 0) return
              const setClauses = keys.map((k) => `${k} = ?`)
              const { sql, params } = buildCondition(condition)
              const vals = Object.values(data).map(coerceValue)
              const query = `UPDATE ${table} SET ${setClauses.join(', ')} WHERE ${sql}`
              await runExecute(query, [...vals, ...params])
            },
          }
        },
      }
    },

    delete(tableName: string) {
      const table = sanitizeIdentifier(tableName)
      return {
        async where(condition: Condition) {
          const { sql, params } = buildCondition(condition)
          const query = `DELETE FROM ${table} WHERE ${sql}`
          await runExecute(query, params)
        },
      }
    },
  }

  return { db, async init() {} }
}
