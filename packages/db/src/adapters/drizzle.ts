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

function buildCondition(c: Condition): { sql: string; params: any[] } {
  const col = sanitizeIdentifier(c.column)
  const op = sanitizeOperator(c.op)
  if (Array.isArray(c.value)) {
    if (c.value.length === 0) {
      return { sql: op.includes('NOT') ? '1=1' : '1=0', params: [] }
    }
    const placeholders = c.value.map(() => '?').join(', ')
    return { sql: `${col} ${op} (${placeholders})`, params: c.value }
  }
  return { sql: `${col} ${op} ?`, params: [c.value] }
}

function formatOrderClause(orders: OrderBy[]): string {
  return orders.map((o) => `${sanitizeIdentifier(o.column)} ${sanitizeDirection(o.direction)}`).join(', ')
}

/**
 * Wraps a Drizzle ORM database instance to implement the unified QueryBuilder interface.
 */
export function createDrizzleAdapter(drizzleDb: any): DatabaseAdapter {
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
                      return drizzleDb.all ? drizzleDb.all(query, ...params) : executeQuery(drizzleDb, query, params)
                    },
                    async limit(n: number) {
                      const { sql, params } = buildCondition(condition)
                      const orderClause = formatOrderClause(orders)
                      const query = `SELECT ${colNames} FROM ${table} WHERE ${sql} ORDER BY ${orderClause} LIMIT ${Number(n)}`
                      return drizzleDb.all ? drizzleDb.all(query, ...params) : executeQuery(drizzleDb, query, params)
                    },
                  }
                },
                async all() {
                  const { sql, params } = buildCondition(condition)
                  const query = `SELECT ${colNames} FROM ${table} WHERE ${sql}`
                  return drizzleDb.all ? drizzleDb.all(query, ...params) : executeQuery(drizzleDb, query, params)
                },
                async limit(n: number) {
                  const { sql, params } = buildCondition(condition)
                  const query = `SELECT ${colNames} FROM ${table} WHERE ${sql} LIMIT ${Number(n)}`
                  return drizzleDb.all ? drizzleDb.all(query, ...params) : executeQuery(drizzleDb, query, params)
                },
              }
            },
            orderBy(...orders: OrderBy[]) {
              return {
                async all() {
                  const orderClause = formatOrderClause(orders)
                  const query = `SELECT ${colNames} FROM ${table} ORDER BY ${orderClause}`
                  return drizzleDb.all ? drizzleDb.all(query) : executeQuery(drizzleDb, query, [])
                },
                async limit(n: number) {
                  const orderClause = formatOrderClause(orders)
                  const query = `SELECT ${colNames} FROM ${table} ORDER BY ${orderClause} LIMIT ${Number(n)}`
                  return drizzleDb.all ? drizzleDb.all(query) : executeQuery(drizzleDb, query, [])
                },
              }
            },
            async all() {
              const query = `SELECT ${colNames} FROM ${table}`
              return drizzleDb.all ? drizzleDb.all(query) : executeQuery(drizzleDb, query, [])
            },
            async limit(n: number) {
              const query = `SELECT ${colNames} FROM ${table} LIMIT ${Number(n)}`
              return drizzleDb.all ? drizzleDb.all(query) : executeQuery(drizzleDb, query, [])
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
          const vals = Object.values(data)
          const placeholders = vals.map(() => '?')
          const query = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders.join(', ')})`
          if (typeof drizzleDb.run === 'function') {
            await drizzleDb.run(query, ...vals)
          } else {
            await executeQuery(drizzleDb, query, vals)
          }
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
              const vals = Object.values(data)
              const query = `UPDATE ${table} SET ${setClauses.join(', ')} WHERE ${sql}`
              if (typeof drizzleDb.run === 'function') {
                await drizzleDb.run(query, ...vals, ...params)
              } else {
                await executeQuery(drizzleDb, query, [...vals, ...params])
              }
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
          if (typeof drizzleDb.run === 'function') {
            await drizzleDb.run(query, ...params)
          } else {
            await executeQuery(drizzleDb, query, params)
          }
        },
      }
    },
  }

  return {
    db,
    async init() {},
  }
}

/**
 * Execute a raw SQL query on a Drizzle instance.
 * Uses the underlying client's run/all methods.
 */
async function executeQuery(drizzleDb: any, query: string, params: any[]): Promise<any[]> {
  const client = drizzleDb.$client || drizzleDb
  if (typeof client.execute === 'function') {
    const result = await client.execute({ sql: query, args: params })
    return result.rows || []
  }
  if (typeof client.all === 'function') {
    return client.all(query, ...params)
  }
  if (typeof client.select === 'function') {
    return client.select(query, params)
  }
  throw new Error('Unable to execute query on this database instance')
}
