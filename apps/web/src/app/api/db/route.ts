import { createClient } from '@libsql/client'
import { z } from 'zod'
import {
  hashPassword, verifyPassword, generateId, isoNow,
  TransactionSchema, BudgetSchema, AssetSchema, LiabilitySchema, NetWorthEntrySchema, VaultEntrySchema,
  TodoSchema, AccountSchema, SavingsGoalSchema, RecurringTransactionSchema, SubscriptionSchema,
  HabitSchema, HabitLogSchema, NoteSchema,
} from '@wos/shared'

const TURSO_URL = process.env.TURSO_URL || 'file:./wos.db'
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN || undefined

const client = createClient({ url: TURSO_URL, authToken: TURSO_AUTH_TOKEN })

const tables: Record<string, string[]> = {
  users: ['id', 'username', 'password_hash', 'vault_salt', 'vault_verify', 'session_token', 'created_at'],
  transactions: ['id', 'user_id', 'type', 'amount', 'category', 'description', 'date', 'account_id', 'flexibility', 'created_at'],
  budgets: ['id', 'user_id', 'category', 'limit', 'created_at', 'rollover_enabled'],
  assets: ['id', 'user_id', 'name', 'type', 'quantity', 'unit_price', 'buy_price', 'buy_date', 'ticker', 'notes', 'last_updated', 'created_at'],
  liabilities: ['id', 'user_id', 'name', 'type', 'amount', 'notes', 'created_at'],
  net_worth_entries: ['id', 'user_id', 'date', 'total_assets', 'total_liabilities', 'net_worth', 'cash', 'investments', 'property', 'other_assets', 'mortgage', 'loans', 'credit_cards', 'other_liabilities', 'created_at'],
  vault_entries: ['id', 'user_id', 'service', 'username', 'password_encrypted', 'password_iv', 'url', 'notes_encrypted', 'notes_iv', 'category', 'created_at'],
  todos: ['id', 'user_id', 'title', 'completed', 'priority', 'tags', 'due_date', 'notes', 'parent_id', 'order', 'created_at', 'updated_at'],
  user_settings: ['user_id', 'theme', 'currency', 'locale', 'auto_lock_minutes'],
  accounts: ['id', 'user_id', 'name', 'type', 'balance', 'opening_balance', 'created_at'],
  savings_goals: ['id', 'user_id', 'name', 'target_amount', 'saved_amount', 'account_id', 'deadline', 'created_at'],
  recurring_transactions: ['id', 'user_id', 'name', 'type', 'amount', 'category', 'frequency', 'next_date', 'active', 'created_at'],
  subscriptions: ['id', 'user_id', 'name', 'category', 'amount', 'frequency', 'next_billing', 'icon', 'active', 'notes', 'created_at'],
  habits: ['id', 'user_id', 'name', 'emoji', 'frequency', 'target_days', 'color', 'active', 'created_at'],
  habit_logs: ['id', 'habit_id', 'user_id', 'date', 'done', 'created_at'],
  notes: ['id', 'user_id', 'title', 'content', 'tags', 'date', 'pinned', 'linked_todo_id', 'linked_transaction_id', 'created_at', 'updated_at'],
}

// Tables that carry a user_id column and must always be scoped to the
// authenticated caller — the server, never the client, decides which rows
// a request is allowed to touch.
const USER_SCOPED_TABLES = new Set([
  'transactions', 'budgets', 'assets', 'liabilities', 'net_worth_entries', 'vault_entries',
  'todos', 'accounts', 'savings_goals', 'recurring_transactions',
  'subscriptions', 'habits', 'habit_logs', 'notes', 'user_settings',
])

// `users` is never reachable through generic select/insert/update/delete —
// not even by its own authenticated owner — except for these specific
// columns, needed by the vault (salt/canary) and account password change
// flows. `session_token`/`username` can never be read or written this way;
// session issuance only ever happens inside the dedicated login/register
// handling below, atomically with password verification.
const SELF_USER_SELECT_COLUMNS = ['id', 'username', 'vault_salt', 'vault_verify', 'password_hash', 'created_at']
const SELF_USER_UPDATE_COLUMNS = new Set(['vault_salt', 'vault_verify', 'password_hash'])

// Zod schemas used as a defense-in-depth validation layer on writes, keyed
// by table name. Client objects use snake_case (DB column names); schemas
// use camelCase, so values are converted before validating.
const TABLE_SCHEMAS: Record<string, z.ZodTypeAny> = {
  transactions: TransactionSchema,
  budgets: BudgetSchema,
  assets: AssetSchema,
  liabilities: LiabilitySchema,
  net_worth_entries: NetWorthEntrySchema,
  vault_entries: VaultEntrySchema,
  todos: TodoSchema,
  accounts: AccountSchema,
  savings_goals: SavingsGoalSchema,
  recurring_transactions: RecurringTransactionSchema,
  subscriptions: SubscriptionSchema,
  habits: HabitSchema,
  habit_logs: HabitLogSchema,
  notes: NoteSchema,
}

function snakeToCamel(s: string): string {
  return s.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase())
}

/** Unwraps ZodOptional/ZodNullable/ZodDefault to find the underlying type a field actually validates as. */
function unwrapZodType(t: z.ZodTypeAny): z.ZodTypeAny {
  let cur: any = t
  while (cur?._def && (cur._def.typeName === 'ZodOptional' || cur._def.typeName === 'ZodNullable' || cur._def.typeName === 'ZodDefault')) {
    cur = cur._def.innerType
  }
  return cur
}

/**
 * DB rows use SQLite-storable encodings — JSON-stringified arrays, 0/1 for
 * booleans — while the shared Zod schemas (also used client-side against
 * real JS values) expect real arrays/booleans. Coerce before validating, or
 * every write to a column typed as array/boolean fails validation forever.
 */
function coerceForSchema(schema: z.ZodObject<any>, camelValues: Record<string, any>): Record<string, any> {
  const shape = schema.shape
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(camelValues)) {
    const field = shape[k]
    const inner = field ? unwrapZodType(field) : null
    if (inner instanceof z.ZodArray && typeof v === 'string') {
      try { out[k] = JSON.parse(v) } catch { out[k] = v }
    } else if (inner instanceof z.ZodBoolean && typeof v === 'number') {
      out[k] = v !== 0
    } else if (inner instanceof z.ZodBoolean && typeof v === 'string') {
      out[k] = v === '1' || v.toLowerCase() === 'true'
    } else {
      out[k] = v
    }
  }
  return out
}

/** Validate a snake_case values object against its table's Zod schema (partial — only provided fields are checked). Returns an error message, or null if valid / no schema registered for this table. */
function validateValues(table: string, values: Record<string, any>): string | null {
  const schema = TABLE_SCHEMAS[table]
  if (!schema || typeof (schema as any).partial !== 'function') return null
  const camelValues: Record<string, any> = {}
  for (const [k, v] of Object.entries(values)) camelValues[snakeToCamel(k)] = v
  const coerced = coerceForSchema(schema as z.ZodObject<any>, camelValues)
  const result = (schema as z.ZodObject<any>).partial().safeParse(coerced)
  if (!result.success) {
    const issue = result.error.issues[0]
    return issue ? `${issue.path.join('.')}: ${issue.message}` : 'Validation failed'
  }
  return null
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
      flexibility TEXT NOT NULL DEFAULT 'flexible',
      created_at TEXT NOT NULL
    )
  `)
  try { await client.execute(`ALTER TABLE transactions ADD COLUMN account_id TEXT`) } catch {}
  try { await client.execute(`ALTER TABLE transactions ADD COLUMN flexibility TEXT NOT NULL DEFAULT 'flexible'`) } catch {}
  try { await client.execute(`ALTER TABLE users ADD COLUMN vault_verify TEXT`) } catch {}
  try { await client.execute(`ALTER TABLE users ADD COLUMN session_token TEXT`) } catch {}
  await client.execute(`
    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      category TEXT NOT NULL,
      "limit" REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT '',
      rollover_enabled INTEGER NOT NULL DEFAULT 0
    )
  `)
  try { await client.execute(`ALTER TABLE budgets ADD COLUMN created_at TEXT NOT NULL DEFAULT ''`) } catch {}
  try { await client.execute(`ALTER TABLE budgets ADD COLUMN rollover_enabled INTEGER NOT NULL DEFAULT 0`) } catch {}
  await client.execute(`
    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit_price REAL NOT NULL,
      buy_price REAL,
      buy_date TEXT,
      ticker TEXT,
      notes TEXT NOT NULL DEFAULT '',
      last_updated TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `)
  try { await client.execute(`ALTER TABLE assets ADD COLUMN buy_price REAL`) } catch {}
  try { await client.execute(`ALTER TABLE assets ADD COLUMN buy_date TEXT`) } catch {}
  try { await client.execute(`ALTER TABLE assets ADD COLUMN ticker TEXT`) } catch {}
  await client.execute(`
    CREATE TABLE IF NOT EXISTS liabilities (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    )
  `)
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
  try { await client.execute(`ALTER TABLE vault_entries ADD COLUMN password_iv TEXT NOT NULL DEFAULT ''`) } catch {}
  try { await client.execute(`ALTER TABLE vault_entries ADD COLUMN notes_iv TEXT NOT NULL DEFAULT ''`) } catch {}
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
  try { await client.execute(`ALTER TABLE todos ADD COLUMN parent_id TEXT`) } catch {}
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
      opening_balance REAL,
      created_at TEXT NOT NULL
    )
  `)
  try { await client.execute(`ALTER TABLE accounts ADD COLUMN opening_balance REAL`) } catch {}
  await client.execute(`
    CREATE TABLE IF NOT EXISTS savings_goals (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      target_amount REAL NOT NULL,
      saved_amount REAL NOT NULL DEFAULT 0,
      account_id TEXT,
      deadline TEXT,
      created_at TEXT NOT NULL
    )
  `)
  try { await client.execute(`ALTER TABLE savings_goals ADD COLUMN deadline TEXT`) } catch {}
  try { await client.execute(`ALTER TABLE savings_goals ADD COLUMN account_id TEXT`) } catch {}
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
  try { await client.execute(`ALTER TABLE subscriptions ADD COLUMN icon TEXT NOT NULL DEFAULT '📦'`) } catch {}
  try { await client.execute(`ALTER TABLE subscriptions ADD COLUMN notes TEXT NOT NULL DEFAULT ''`) } catch {}
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

  // ── Indexes ── every store query filters by user_id (often + date /
  // parent_id / habit_id); without these, every query is a full table scan.
  const indexes: [string, string, string][] = [
    ['idx_transactions_user', 'transactions', 'user_id'],
    ['idx_transactions_user_date', 'transactions', 'user_id, date'],
    ['idx_budgets_user', 'budgets', 'user_id'],
    ['idx_assets_user', 'assets', 'user_id'],
    ['idx_liabilities_user', 'liabilities', 'user_id'],
    ['idx_net_worth_entries_user', 'net_worth_entries', 'user_id'],
    ['idx_vault_entries_user', 'vault_entries', 'user_id'],
    ['idx_todos_user', 'todos', 'user_id'],
    ['idx_todos_parent', 'todos', 'parent_id'],
    ['idx_accounts_user', 'accounts', 'user_id'],
    ['idx_savings_goals_user', 'savings_goals', 'user_id'],
    ['idx_recurring_transactions_user', 'recurring_transactions', 'user_id'],
    ['idx_subscriptions_user', 'subscriptions', 'user_id'],
    ['idx_habits_user', 'habits', 'user_id'],
    ['idx_habit_logs_user', 'habit_logs', 'user_id'],
    ['idx_habit_logs_habit', 'habit_logs', 'habit_id'],
    ['idx_notes_user', 'notes', 'user_id'],
  ]
  for (const [name, table, cols] of indexes) {
    try { await client.execute(`CREATE INDEX IF NOT EXISTS ${name} ON ${quote(table)} (${cols})`) } catch {}
  }
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

function isEq(op: any): boolean {
  return op === undefined || op === '=' || String(op).toUpperCase() === 'EQ'
}

export async function POST(request: Request) {
  try {
    await initOnce()
    const body = await request.json()
    const { operation, table, columns = ['*'], where: rawWhere, orderBy: rawOrderBy, limit: limitNum, values } = body

    // ── Login / register ──────────────────────────────────────────────
    // The only two operations allowed before a session exists. Both verify
    // the password (or hash it, for register) and issue the session token
    // entirely server-side, atomically — the client never sees password_hash
    // and never gets to choose or bootstrap its own session_token, closing
    // the account-takeover hole a client-orchestrated "select hash, then
    // separately write session_token" flow would otherwise open.
    if (operation === 'register') {
      const { username, password } = body
      if (!username || typeof username !== 'string' || !password || typeof password !== 'string') {
        return Response.json({ ok: false, error: 'Username dan password diperlukan' }, { status: 400 })
      }
      try {
        const existing = await client.execute({ sql: 'SELECT id FROM users WHERE username = ?', args: [username] })
        if (existing.rows.length > 0) return Response.json({ ok: false, error: 'Username sudah dipakai' })
        const id = generateId()
        const passwordHash = await hashPassword(password)
        const sessionToken = crypto.randomUUID()
        await client.execute({
          sql: 'INSERT INTO users (id, username, password_hash, session_token, created_at) VALUES (?, ?, ?, ?, ?)',
          args: [id, username, passwordHash, sessionToken, isoNow()],
        })
        return Response.json({ ok: true, userId: id, username, sessionToken })
      } catch (err: any) {
        console.error('[wos/api] register failed:', err?.message || err)
        return Response.json({ ok: false, error: 'Registrasi gagal' })
      }
    }

    if (operation === 'login') {
      const { username, password } = body
      if (!username || typeof username !== 'string' || !password || typeof password !== 'string') {
        return Response.json({ ok: false, error: 'Username dan password diperlukan' }, { status: 400 })
      }
      try {
        const found = await client.execute({ sql: 'SELECT id, username, password_hash FROM users WHERE username = ?', args: [username] })
        if (found.rows.length === 0) return Response.json({ ok: false, error: 'Username tidak ditemukan' })
        const user = found.rows[0] as any
        const valid = await verifyPassword(password, user.password_hash)
        if (!valid) return Response.json({ ok: false, error: 'Password salah' })
        const sessionToken = crypto.randomUUID()
        await client.execute({ sql: 'UPDATE users SET session_token = ? WHERE id = ?', args: [sessionToken, user.id] })
        return Response.json({ ok: true, userId: user.id, username: user.username, sessionToken })
      } catch (err: any) {
        console.error('[wos/api] login failed:', err?.message || err)
        return Response.json({ ok: false, error: 'Login gagal' })
      }
    }

    if (!table || !tables[table]) {
      return Response.json({ error: `Table "${table}" not found` }, { status: 400 })
    }

    // ── Every remaining operation requires a valid session ─────────────
    const headerUserId = request.headers.get('x-user-id')
    const headerSessionToken = request.headers.get('x-session-token')
    if (!headerUserId || !headerSessionToken) {
      return Response.json({ error: 'Authentication required' }, { status: 401 })
    }
    const userCheck = await client.execute({ sql: 'SELECT session_token FROM users WHERE id = ?', args: [headerUserId] })
    const stored = userCheck.rows[0]?.session_token
    if (userCheck.rows.length === 0 || !stored || String(stored) !== headerSessionToken) {
      return Response.json({ error: 'Invalid session token' }, { status: 401 })
    }
    const authedUserId: string = headerUserId

    // `users` is otherwise walled off from generic CRUD — even for its own
    // authenticated owner — except a caller may touch their OWN row (never
    // another user's) to read/write vault salt/canary or change their
    // password. Never username, never session_token via this path.
    const isSelfUsersAccess =
      table === 'users' &&
      rawWhere?.column === 'id' && isEq(rawWhere?.op) && rawWhere?.value === authedUserId

    if (table === 'users' && !isSelfUsersAccess) {
      return Response.json({ error: 'Direct access to "users" is not allowed' }, { status: 403 })
    }

    const ownerCondition = USER_SCOPED_TABLES.has(table)
      ? { sql: `${quote('user_id')} = ?`, args: [authedUserId] as any[] }
      : null

    function scopedWhere(clientWhere: { sql: string; args: any[] } | null): { sql: string; args: any[] } | null {
      if (ownerCondition && clientWhere) {
        return { sql: `(${clientWhere.sql}) AND (${ownerCondition.sql})`, args: [...clientWhere.args, ...ownerCondition.args] }
      }
      if (ownerCondition) return ownerCondition
      return clientWhere
    }

    switch (operation) {
      case 'select': {
        if (isSelfUsersAccess) {
          // Ignore whatever `columns` the client asked for — session_token
          // can never leave the server through this path.
          const where = buildWhere(table, rawWhere)
          const query = `SELECT ${SELF_USER_SELECT_COLUMNS.map(quote).join(', ')} FROM ${quote(table)} WHERE ${where.sql} LIMIT 1`
          const result = await client.execute({ sql: query, args: where.args })
          return Response.json({ rows: result.rows.map((r: any) => ({ ...r })) })
        }

        const cols = columns[0] === '*' ? '*' : columns.map((c: string) => { assertColumn(table, c); return quote(c) }).join(', ')
        const clientWhere = rawWhere ? buildWhere(table, rawWhere) : null
        const whereFinal = scopedWhere(clientWhere)
        const orderSql = rawOrderBy?.length
          ? ' ORDER BY ' + rawOrderBy.map((o: any) => {
              const cols = tables[table]
              if (!cols?.includes(o.column)) throw new Error(`Column "${o.column}" not found`)
              const dir = o.direction === 'DESC' ? 'DESC' : 'ASC'
              return `${quote(o.column)} ${dir}`
            }).join(', ')
          : ''
        const limitSql = limitNum != null ? ` LIMIT ${Number(limitNum)}` : ''

        const query = `SELECT ${cols} FROM ${quote(table)}${whereFinal ? ' WHERE ' + whereFinal.sql : ''}${orderSql}${limitSql}`
        const result = await client.execute({ sql: query, args: whereFinal ? whereFinal.args : [] })
        return Response.json({ rows: result.rows.map((r: any) => ({ ...r })) })
      }

      case 'insert': {
        if (!values || typeof values !== 'object') {
          return Response.json({ error: 'Insert values are required' }, { status: 400 })
        }
        // Ownership is always assigned by the server, never trusted from the client.
        if (USER_SCOPED_TABLES.has(table)) {
          values.user_id = authedUserId
        }
        const keys = Object.keys(values)
        if (keys.length === 0) return Response.json({ error: 'No columns to insert' }, { status: 400 })
        keys.forEach((k) => assertColumn(table, k))
        const validationError = validateValues(table, values)
        if (validationError) return Response.json({ error: `Validation: ${validationError}` }, { status: 400 })
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
        if (isSelfUsersAccess) {
          const keys = Object.keys(values)
          if (keys.length === 0) return Response.json({ error: 'No columns to update' }, { status: 400 })
          if (!keys.every((k) => SELF_USER_UPDATE_COLUMNS.has(k))) {
            return Response.json({ error: 'Column not allowed on self users update' }, { status: 403 })
          }
          const setSql = keys.map((k) => `${quote(k)} = ?`).join(', ')
          const where = buildWhere(table, rawWhere)
          const query = `UPDATE ${quote(table)} SET ${setSql} WHERE ${where.sql}`
          await client.execute({ sql: query, args: [...Object.values(values), ...where.args] })
          return Response.json({ success: true })
        }
        // Ownership can never be reassigned through a generic update.
        if (USER_SCOPED_TABLES.has(table)) delete values.user_id
        const keys = Object.keys(values)
        if (keys.length === 0) return Response.json({ error: 'No columns to update' }, { status: 400 })
        keys.forEach((k) => assertColumn(table, k))
        const validationError = validateValues(table, values)
        if (validationError) return Response.json({ error: `Validation: ${validationError}` }, { status: 400 })
        const setSql = keys.map((k) => `${quote(k)} = ?`).join(', ')
        const clientWhere = buildWhere(table, rawWhere)
        const whereFinal = scopedWhere(clientWhere)!
        const query = `UPDATE ${quote(table)} SET ${setSql} WHERE ${whereFinal.sql}`
        await client.execute({ sql: query, args: [...Object.values(values), ...whereFinal.args] })
        return Response.json({ success: true })
      }

      case 'delete': {
        if (!rawWhere) return Response.json({ error: 'WHERE clause is required for delete' }, { status: 400 })
        const clientWhere = buildWhere(table, rawWhere)
        const whereFinal = scopedWhere(clientWhere)!
        const query = `DELETE FROM ${quote(table)} WHERE ${whereFinal.sql}`
        await client.execute({ sql: query, args: whereFinal.args })
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
