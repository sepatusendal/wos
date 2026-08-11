import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  vaultSalt: text('vault_salt'),
  vaultVerify: text('vault_verify'),
  sessionToken: text('session_token'),
  createdAt: text('created_at').notNull(),
})

export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  type: text('type', { enum: ['income', 'expense'] }).notNull(),
  amount: real('amount').notNull(),
  category: text('category').notNull(),
  description: text('description').notNull().default(''),
  date: text('date').notNull(),
  accountId: text('account_id'),
  flexibility: text('flexibility', { enum: ['fixed', 'flexible', 'discretionary'] }).notNull().default('flexible'),
  createdAt: text('created_at').notNull(),
})

export const budgets = sqliteTable('budgets', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  category: text('category').notNull(),
  limit: real('limit').notNull(),
})

export const assets = sqliteTable('assets', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  type: text('type', { enum: ['stock', 'crypto', 'real-estate', 'cash', 'bonds', 'other'] }).notNull(),
  quantity: real('quantity').notNull(),
  unitPrice: real('unit_price').notNull(),
  buyPrice: real('buy_price'),
  buyDate: text('buy_date'),
  notes: text('notes').notNull().default(''),
  lastUpdated: text('last_updated').notNull(),
  createdAt: text('created_at').notNull(),
})

export const netWorthEntries = sqliteTable('net_worth_entries', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  date: text('date').notNull(),
  totalAssets: real('total_assets').notNull(),
  totalLiabilities: real('total_liabilities').notNull(),
  netWorth: real('net_worth').notNull(),
  cash: real('cash').notNull().default(0),
  investments: real('investments').notNull().default(0),
  property: real('property').notNull().default(0),
  otherAssets: real('other_assets').notNull().default(0),
  mortgage: real('mortgage').notNull().default(0),
  loans: real('loans').notNull().default(0),
  creditCards: real('credit_cards').notNull().default(0),
  otherLiabilities: real('other_liabilities').notNull().default(0),
  createdAt: text('created_at').notNull(),
})

export const vaultEntries = sqliteTable('vault_entries', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  service: text('service').notNull(),
  username: text('username').notNull(),
  passwordEncrypted: text('password_encrypted').notNull(),
  passwordIv: text('password_iv').notNull(),
  url: text('url').notNull().default(''),
  notesEncrypted: text('notes_encrypted').notNull().default(''),
  notesIv: text('notes_iv').notNull().default(''),
  category: text('category', { enum: ['email', 'banking', 'social', 'work', 'entertainment', 'shopping', 'other'] }).notNull(),
  createdAt: text('created_at').notNull(),
})

export const todos = sqliteTable('todos', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  title: text('title').notNull(),
  completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
  priority: text('priority', { enum: ['low', 'medium', 'high'] }).notNull(),
  tags: text('tags').notNull().default('[]'),
  dueDate: text('due_date'),
  notes: text('notes').notNull().default(''),
  parentId: text('parent_id'),
  order: integer('order').notNull().default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  type: text('type', { enum: ['cash', 'bank', 'ewallet', 'credit'] }).notNull(),
  balance: real('balance').notNull().default(0),
  // Nullable: existing rows are lazily migrated (opening_balance = balance -
  // sum(current transactions)) the first time they're loaded after this
  // column was introduced. See financeStore.ts fetchAll.
  openingBalance: real('opening_balance'),
  createdAt: text('created_at').notNull(),
})

export const savingsGoals = sqliteTable('savings_goals', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  targetAmount: real('target_amount').notNull(),
  savedAmount: real('saved_amount').notNull().default(0),
  deadline: text('deadline'),
  createdAt: text('created_at').notNull(),
})

export const recurringTransactions = sqliteTable('recurring_transactions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  type: text('type', { enum: ['income', 'expense'] }).notNull(),
  amount: real('amount').notNull(),
  category: text('category').notNull(),
  frequency: text('frequency', { enum: ['daily', 'weekly', 'monthly', 'yearly'] }).notNull(),
  nextDate: text('next_date').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
})

export const userSettings = sqliteTable('user_settings', {
  userId: text('user_id').primaryKey().references(() => users.id),
  theme: text('theme').notNull().default('light'),
  currency: text('currency').notNull().default('IDR'),
  locale: text('locale').notNull().default('id-ID'),
  autoLockMinutes: integer('auto_lock_minutes').notNull().default(10),
})

export const subscriptions = sqliteTable('subscriptions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  category: text('category', { enum: ['streaming', 'music', 'cloud', 'hosting', 'software', 'gaming', 'fitness', 'news', 'other'] }).notNull(),
  amount: real('amount').notNull(),
  frequency: text('frequency', { enum: ['weekly', 'monthly', 'yearly'] }).notNull(),
  nextBilling: text('next_billing').notNull(),
  icon: text('icon').notNull().default('📦'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  notes: text('notes').notNull().default(''),
  createdAt: text('created_at').notNull(),
})

export const habits = sqliteTable('habits', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  emoji: text('emoji').notNull().default('✅'),
  frequency: text('frequency', { enum: ['daily', 'weekly'] }).notNull().default('daily'),
  targetDays: text('target_days').notNull().default('[]'), // JSON array of weekday names for weekly habits
  color: text('color').notNull().default('yellow'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
})

export const habitLogs = sqliteTable('habit_logs', {
  id: text('id').primaryKey(),
  habitId: text('habit_id').notNull().references(() => habits.id),
  userId: text('user_id').notNull().references(() => users.id),
  date: text('date').notNull(),
  done: integer('done', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
})

export const notes = sqliteTable('notes', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  title: text('title').notNull(),
  content: text('content').notNull().default(''),
  tags: text('tags').notNull().default('[]'),
  date: text('date').notNull(),
  pinned: integer('pinned', { mode: 'boolean' }).notNull().default(false),
  linkedTodoId: text('linked_todo_id'),
  linkedTransactionId: text('linked_transaction_id'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})
