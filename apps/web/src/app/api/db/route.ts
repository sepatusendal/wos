import { createClient } from '@libsql/client'
import { hashPassword, generateId, isoNow } from '@wos/shared'

const TURSO_URL = process.env.TURSO_URL || 'file:./wos.db'
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN || undefined

const client = createClient({ url: TURSO_URL, authToken: TURSO_AUTH_TOKEN })

const tables: Record<string, string[]> = {
  users: ['id', 'username', 'password_hash', 'vault_salt', 'vault_verify', 'session_token', 'created_at'],
  transactions: ['id', 'user_id', 'type', 'amount', 'category', 'description', 'date', 'account_id', 'created_at'],
  budgets: ['id', 'user_id', 'category', 'limit'],
  assets: ['id', 'user_id', 'name', 'type', 'ticker', 'quantity', 'unit_price', 'buy_price', 'buy_date', 'notes', 'last_updated', 'created_at'],
  net_worth_entries: ['id', 'user_id', 'date', 'total_assets', 'total_liabilities', 'net_worth', 'cash', 'investments', 'property', 'other_assets', 'mortgage', 'loans', 'credit_cards', 'other_liabilities', 'created_at'],
  vault_entries: ['id', 'user_id', 'service', 'username', 'password_encrypted', 'password_iv', 'url', 'notes_encrypted', 'notes_iv', 'category', 'created_at'],
  todos: ['id', 'user_id', 'title', 'completed', 'priority', 'tags', 'due_date', 'notes', 'parent_id', 'order', 'created_at', 'updated_at'],
  user_settings: ['user_id', 'theme', 'currency', 'locale', 'auto_lock_minutes'],
  accounts: ['id', 'user_id', 'name', 'type', 'balance', 'created_at'],
  savings_goals: ['id', 'user_id', 'name', 'target_amount', 'saved_amount', 'deadline', 'created_at'],
  recurring_transactions: ['id', 'user_id', 'name', 'type', 'amount', 'category', 'frequency', 'next_date', 'active', 'created_at'],
  subscriptions: ['id', 'user_id', 'name', 'category', 'amount', 'frequency', 'next_billing', 'icon', 'active', 'notes', 'created_at'],
  habits: ['id', 'user_id', 'name', 'emoji', 'frequency', 'target_days', 'color', 'active', 'created_at'],
  habit_logs: ['id', 'habit_id', 'user_id', 'date', 'done', 'created_at'],
  notes: ['id', 'user_id', 'title', 'content', 'tags', 'date', 'pinned', 'linked_todo_id', 'linked_transaction_id', 'created_at', 'updated_at'],
}

const quote = (c: string) => `"${c}"`

function assertColumn(table: string, col: string) {
  const cols = tables[table]
  if (!cols?.includes(col)) {
    throw new Error(`Column "${col}" not found in table "${table}"`)
  }
}

async function ensureSchema() {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      vault_salt TEXT,
      vault_verify TEXT,
      session_token TEXT,
      created_at TEXT NOT NULL
    )
  `)
  await client.execute(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      date TEXT NOT NULL,
      account_id TEXT,
      created_at TEXT NOT NULL
    )
  `)
  try { await client.execute(`ALTER TABLE transactions ADD COLUMN account_id TEXT`) } catch {}
  try { await client.execute(`ALTER TABLE users ADD COLUMN vault_verify TEXT`) } catch {}
  try { await client.execute(`ALTER TABLE users ADD COLUMN session_token TEXT`) } catch {}
  await client.execute(`
    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      category TEXT NOT NULL,
      "limit" REAL NOT NULL
    )
  `)
  await client.execute(`
    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      ticker TEXT,
      quantity REAL NOT NULL,
      unit_price REAL NOT NULL,
      buy_price REAL,
      buy_date TEXT,
      notes TEXT NOT NULL DEFAULT '',
      last_updated TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `)
  try { await client.execute(`ALTER TABLE assets ADD COLUMN buy_price REAL`) } catch {}
  try { await client.execute(`ALTER TABLE assets ADD COLUMN buy_date TEXT`) } catch {}
  try { await client.execute(`ALTER TABLE assets ADD COLUMN ticker TEXT`) } catch {}
  await client.execute(`
    CREATE TABLE IF NOT EXISTS net_worth_entries (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      date TEXT NOT NULL,
      total_assets REAL NOT NULL,
      total_liabilities REAL NOT NULL,
      net_worth REAL NOT NULL,
      cash REAL NOT NULL DEFAULT 0,
      investments REAL NOT NULL DEFAULT 0,
      property REAL NOT NULL DEFAULT 0,
      other_assets REAL NOT NULL DEFAULT 0,
      mortgage REAL NOT NULL DEFAULT 0,
      loans REAL NOT NULL DEFAULT 0,
      credit_cards REAL NOT NULL DEFAULT 0,
      other_liabilities REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )
  `)
  await client.execute(`
    CREATE TABLE IF NOT EXISTS vault_entries (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      service TEXT NOT NULL,
      username TEXT NOT NULL,
      password_encrypted TEXT NOT NULL,
      password_iv TEXT NOT NULL,
      url TEXT NOT NULL DEFAULT '',
      notes_encrypted TEXT NOT NULL DEFAULT '',
      notes_iv TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `)
  await client.execute(`
    CREATE TABLE IF NOT EXISTS todos (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      priority TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      due_date TEXT,
      notes TEXT NOT NULL DEFAULT '',
      parent_id TEXT,
      "order" INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)
  await client.execute(`
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id TEXT PRIMARY KEY REFERENCES users(id),
      theme TEXT NOT NULL DEFAULT 'light',
      currency TEXT NOT NULL DEFAULT 'IDR',
      locale TEXT NOT NULL DEFAULT 'id-ID',
      auto_lock_minutes INTEGER NOT NULL DEFAULT 10
    )
  `)
  await client.execute(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      balance REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )
  `)
  await client.execute(`
    CREATE TABLE IF NOT EXISTS savings_goals (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      target_amount REAL NOT NULL,
      saved_amount REAL NOT NULL DEFAULT 0,
      deadline TEXT,
      created_at TEXT NOT NULL
    )
  `)
  await client.execute(`
    CREATE TABLE IF NOT EXISTS recurring_transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      frequency TEXT NOT NULL,
      next_date TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    )
  `)
  await client.execute(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      frequency TEXT NOT NULL,
      next_billing TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT '📦',
      active INTEGER NOT NULL DEFAULT 1,
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    )
  `)
  await client.execute(`
    CREATE TABLE IF NOT EXISTS habits (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      emoji TEXT NOT NULL DEFAULT '✅',
      frequency TEXT NOT NULL DEFAULT 'daily',
      target_days TEXT NOT NULL DEFAULT '[]',
      color TEXT NOT NULL DEFAULT 'yellow',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    )
  `)
  await client.execute(`
    CREATE TABLE IF NOT EXISTS habit_logs (
      id TEXT PRIMARY KEY,
      habit_id TEXT NOT NULL REFERENCES habits(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      date TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    )
  `)
  try { await client.execute(`ALTER TABLE habit_logs ADD COLUMN user_id TEXT`) } catch {}
  await client.execute(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '[]',
      date TEXT NOT NULL,
      pinned INTEGER NOT NULL DEFAULT 0,
      linked_todo_id TEXT,
      linked_transaction_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)
}

async function seedAdmin() {
  const username = (process.env.SEED_ADMIN_USERNAME || 'wiraraja').trim()
  const password = process.env.SEED_ADMIN_PASSWORD || 'wir4raja'
  try {
    const result = await client.execute({ sql: 'SELECT id FROM users WHERE username = ?', args: [username] })
    if (result.rows.length > 0) return
    const passwordHash = await hashPassword(password)
    await client.execute({
      sql: 'INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)',
      args: [generateId(), username, passwordHash, isoNow()],
    })
    console.log(`[wos] Default account "${username}" created successfully`)
  } catch (err: any) {
    console.error('[wos] Failed to seed default account:', err?.message || err)
  }
}

let isInitialized = false
let initPromise: Promise<void> | null = null

async function initOnce() {
  if (isInitialized) return
  if (!initPromise) {
    initPromise = (async () => {
      await ensureSchema()
      await seedAdmin()
      isInitialized = true
    })()
  }
  await initPromise
}

export async function POST(request: Request) {
  try {
    await initOnce()
    const body = await request.json()
    const { operation, table, columns = ['*'], where: rawWhere, orderBy: rawOrderBy, limit: limitNum, values } = body

    if (!table || !tables[table]) {
      return Response.json({ error: `Table "${table}" not found` }, { status: 400 })
    }

    // ── Authentication ──
    // All operations require a valid session token, with exceptions:
    // 1. SELECT from 'users' — needed for login (password verification happens client-side)
    // 2. INSERT into 'users' — registration
    // 3. UPDATE on 'users' — session token setup after login
    const AUTH_EXEMPT = table === 'users'
    const needsAuth = !AUTH_EXEMPT

    if (needsAuth) {
      const userId = request.headers.get('x-user-id')
      const sessionToken = request.headers.get('x-session-token')

      if (!userId || !sessionToken) {
        return Response.json({ error: 'Authentication required' }, { status: 401 })
      }

      // Verify the session token matches the user
      const userCheck = await client.execute({
        sql: 'SELECT session_token FROM users WHERE id = ?',
        args: [userId],
      })
      if (userCheck.rows.length === 0) {
        return Response.json({ error: 'User not found' }, { status: 401 })
      }
      const stored = userCheck.rows[0]?.session_token
      if (!stored || String(stored) !== sessionToken) {
        return Response.json({ error: 'Invalid session token' }, { status: 401 })
      }
    }

    switch (operation) {
      case 'select': {
        const cols = columns[0] === '*' ? '*' : columns.map((c: string) => { assertColumn(table, c); return quote(c) }).join(', ')
        const whereSql = rawWhere ? buildWhere(table, rawWhere) : null
        const orderSql = rawOrderBy?.length
          ? ' ORDER BY ' + rawOrderBy.map((o: any) => {
              const cols = tables[table]
              if (!cols?.includes(o.column)) throw new Error(`Column "${o.column}" not found`)
              const dir = o.direction === 'DESC' ? 'DESC' : 'ASC'
              return `${quote(o.column)} ${dir}`
            }).join(', ')
          : ''
        const limitSql = limitNum != null ? ` LIMIT ${Number(limitNum)}` : ''

        const query = `SELECT ${cols} FROM ${quote(table)}${whereSql ? ' WHERE ' + whereSql.sql : ''}${orderSql}${limitSql}`
        const result = await client.execute({ sql: query, args: whereSql ? whereSql.args : [] })
        return Response.json({ rows: result.rows.map((r: any) => ({ ...r })) })
      }

      case 'insert': {
        if (!values || typeof values !== 'object') {
          return Response.json({ error: 'Insert values are required' }, { status: 400 })
        }
        const keys = Object.keys(values)
        if (keys.length === 0) return Response.json({ error: 'No columns to insert' }, { status: 400 })
        keys.forEach((k) => assertColumn(table, k))
        const cols = keys.map(quote).join(', ')
        const placeholders = keys.map(() => '?').join(', ')
        const query = `INSERT INTO ${quote(table)} (${cols}) VALUES (${placeholders})`
        await client.execute({ sql: query, args: Object.values(values) })
        return Response.json({ success: true })
      }

      case 'update': {
        if (!values || typeof values !== 'object') {
          return Response.json({ error: 'Update values are required' }, { status: 400 })
        }
        if (!rawWhere) return Response.json({ error: 'WHERE clause is required for update' }, { status: 400 })
        const keys = Object.keys(values)
        if (keys.length === 0) return Response.json({ error: 'No columns to update' }, { status: 400 })
        keys.forEach((k) => assertColumn(table, k))
        const setSql = keys.map((k) => `${quote(k)} = ?`).join(', ')
        const where = buildWhere(table, rawWhere)
        const query = `UPDATE ${quote(table)} SET ${setSql} WHERE ${where.sql}`
        await client.execute({ sql: query, args: [...Object.values(values), ...where.args] })
        return Response.json({ success: true })
      }

      case 'delete': {
        if (!rawWhere) return Response.json({ error: 'WHERE clause is required for delete' }, { status: 400 })
        const where = buildWhere(table, rawWhere)
        const query = `DELETE FROM ${quote(table)} WHERE ${where.sql}`
        await client.execute({ sql: query, args: where.args })
        return Response.json({ success: true })
      }

      default:
        return Response.json({ error: `Operation "${operation}" is not supported` }, { status: 400 })
    }
  } catch (err: any) {
    console.error('[wos/api]', err?.message || err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function buildWhere(table: string, rawWhere: any): { sql: string; args: any[] } {
  const { column, op, value } = rawWhere
  if (!column) throw new Error('WHERE column is required')
  assertColumn(table, column)
  const normOp = (op || '=').trim().toUpperCase()
  if (normOp === '=' || normOp === 'EQ') {
    return { sql: `${quote(column)} = ?`, args: [value] }
  }
  if (normOp === '!=' || normOp === 'NEQ') {
    return { sql: `${quote(column)} != ?`, args: [value] }
  }
  if (normOp === '>' || normOp === 'GT') {
    return { sql: `${quote(column)} > ?`, args: [value] }
  }
  if (normOp === '>=' || normOp === 'GTE') {
    return { sql: `${quote(column)} >= ?`, args: [value] }
  }
  if (normOp === '<' || normOp === 'LT') {
    return { sql: `${quote(column)} < ?`, args: [value] }
  }
  if (normOp === '<=' || normOp === 'LTE') {
    return { sql: `${quote(column)} <= ?`, args: [value] }
  }
  if (normOp === 'LIKE') {
    return { sql: `${quote(column)} LIKE ?`, args: [value] }
  }
  if (normOp === 'IN' && Array.isArray(value)) {
    if (value.length === 0) return { sql: '1=0', args: [] }
    const placeholders = value.map(() => '?').join(', ')
    return { sql: `${quote(column)} IN (${placeholders})`, args: value }
  }
  throw new Error(`Operator "${op}" is not supported`)
}
