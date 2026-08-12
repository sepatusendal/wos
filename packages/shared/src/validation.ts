import { z } from 'zod'

export const TransactionType = z.enum(['income', 'expense'])
export type TransactionType = z.infer<typeof TransactionType>

export const Flexibility = z.enum(['fixed', 'flexible', 'discretionary'])
export type Flexibility = z.infer<typeof Flexibility>

export const AssetType = z.enum(['stock', 'crypto', 'real-estate', 'cash', 'bonds', 'other'])
export type AssetType = z.infer<typeof AssetType>

export const Priority = z.enum(['low', 'medium', 'high'])
export type Priority = z.infer<typeof Priority>

export const VaultCategory = z.enum(['email', 'banking', 'social', 'work', 'entertainment', 'shopping', 'other'])
export type VaultCategory = z.infer<typeof VaultCategory>

export const TransactionSchema = z.object({
  id: z.string().uuid(),
  type: TransactionType,
  amount: z.number().positive(),
  category: z.string().min(1),
  description: z.string().default(''),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  accountId: z.string().uuid().nullable().default(null),
  flexibility: Flexibility.default('flexible'),
  createdAt: z.string().datetime(),
})

export const BudgetSchema = z.object({
  id: z.string().uuid(),
  category: z.string().min(1),
  limit: z.number().positive(),
  createdAt: z.string().default(''),
  rolloverEnabled: z.boolean().default(false),
})

export const AssetSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  type: AssetType,
  quantity: z.number().positive(),
  unitPrice: z.number().positive(),
  buyPrice: z.number().positive().nullable().default(null),
  buyDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  // Ticker symbol for stock/crypto — lets unitPrice be refreshed live via
  // packages/shared/src/market.ts instead of always being typed manually.
  ticker: z.string().nullable().default(null),
  notes: z.string().default(''),
  lastUpdated: z.string().datetime(),
  createdAt: z.string().datetime(),
})

export const LiabilityType = z.enum(['mortgage', 'loan', 'credit_card', 'other'])
export type LiabilityType = z.infer<typeof LiabilityType>

export const LiabilitySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  type: LiabilityType,
  amount: z.number().positive(),
  notes: z.string().default(''),
  createdAt: z.string().datetime(),
})

export const NetWorthEntrySchema = z.object({
  id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  totalAssets: z.number(),
  totalLiabilities: z.number(),
  netWorth: z.number(),
  cash: z.number().default(0),
  investments: z.number().default(0),
  property: z.number().default(0),
  otherAssets: z.number().default(0),
  mortgage: z.number().default(0),
  loans: z.number().default(0),
  creditCards: z.number().default(0),
  otherLiabilities: z.number().default(0),
  createdAt: z.string().datetime(),
})

export const VaultEntrySchema = z.object({
  id: z.string().uuid(),
  service: z.string().min(1),
  username: z.string().min(1),
  password: z.string().min(1),
  url: z.string().default(''),
  notes: z.string().default(''),
  category: VaultCategory,
  createdAt: z.string().datetime(),
})

export const TodoSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  completed: z.boolean().default(false),
  priority: Priority,
  tags: z.array(z.string()).default([]),
  dueDate: z.string().nullable().default(null),
  notes: z.string().default(''),
  parentId: z.string().uuid().nullable().default(null),
  order: z.number().default(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const AccountType = z.enum(['cash', 'bank', 'ewallet', 'credit'])
export type AccountType = z.infer<typeof AccountType>

export const AccountSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  type: AccountType,
  balance: z.number().default(0),
  // Anchor balance can be added on top of (never mutated after creation).
  // `balance` is recomputed as openingBalance + sum(this account's
  // transactions) on every write, instead of being incrementally mutated —
  // that's what makes balance immune to float drift / partial-write desync.
  openingBalance: z.number().default(0),
  createdAt: z.string().datetime(),
})

export const SavingsGoalSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  targetAmount: z.number().positive(),
  // Manual fallback only — ignored for progress display once `accountId` is
  // set, since a linked account's live balance is the real progress. Kept
  // so goals can still exist without a dedicated account.
  savedAmount: z.number().default(0),
  // Link to an Account: "saving" = transferring money into this account via
  // the existing Transfer feature. Progress becomes the account's live
  // balance instead of a manually-typed number.
  accountId: z.string().uuid().nullable().default(null),
  deadline: z.string().nullable().default(null),
  createdAt: z.string().datetime(),
})

export const Frequency = z.enum(['daily', 'weekly', 'monthly', 'yearly'])
export type Frequency = z.infer<typeof Frequency>

export const RecurringTransactionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  type: TransactionType,
  amount: z.number().positive(),
  category: z.string().min(1),
  frequency: Frequency,
  nextDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  active: z.boolean().default(true),
  createdAt: z.string().datetime(),
})

export type Transaction = z.infer<typeof TransactionSchema>
export type Budget = z.infer<typeof BudgetSchema>
export type Asset = z.infer<typeof AssetSchema>
export type Liability = z.infer<typeof LiabilitySchema>
export type NetWorthEntry = z.infer<typeof NetWorthEntrySchema>
export type VaultEntry = z.infer<typeof VaultEntrySchema>
export type TodoItem = z.infer<typeof TodoSchema>
export type Account = z.infer<typeof AccountSchema>
export type SavingsGoal = z.infer<typeof SavingsGoalSchema>
export type RecurringTransaction = z.infer<typeof RecurringTransactionSchema>

export const ThemeColor = z.enum(['yellow', 'blue', 'green', 'pink', 'orange', 'purple', 'red'])
export type ThemeColor = z.infer<typeof ThemeColor>

export const SubscriptionCategory = z.enum(['streaming', 'music', 'cloud', 'hosting', 'software', 'gaming', 'fitness', 'news', 'other'])
export type SubscriptionCategory = z.infer<typeof SubscriptionCategory>

export const SubscriptionFrequency = z.enum(['weekly', 'monthly', 'yearly'])
export type SubscriptionFrequency = z.infer<typeof SubscriptionFrequency>

export const SubscriptionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  category: SubscriptionCategory,
  amount: z.number().positive(),
  frequency: SubscriptionFrequency,
  nextBilling: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  icon: z.string().default('📦'),
  active: z.boolean().default(true),
  notes: z.string().default(''),
  createdAt: z.string().datetime(),
})
export type Subscription = z.infer<typeof SubscriptionSchema>

export const HabitFrequency = z.enum(['daily', 'weekly'])
export type HabitFrequency = z.infer<typeof HabitFrequency>

export const HabitColor = z.enum(['yellow', 'blue', 'green', 'pink', 'orange', 'purple', 'red'])
export type HabitColor = z.infer<typeof HabitColor>

export const HabitSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  emoji: z.string().default('✅'),
  frequency: HabitFrequency.default('daily'),
  targetDays: z.array(z.string()).default([]),
  color: HabitColor.default('yellow'),
  active: z.boolean().default(true),
  createdAt: z.string().datetime(),
})
export type Habit = z.infer<typeof HabitSchema>

export const HabitLogSchema = z.object({
  id: z.string().uuid(),
  habitId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  done: z.boolean().default(true),
  createdAt: z.string().datetime(),
})
export type HabitLog = z.infer<typeof HabitLogSchema>

export const NoteSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  content: z.string().default(''),
  tags: z.array(z.string()).default([]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pinned: z.boolean().default(false),
  linkedTodoId: z.string().uuid().nullable().default(null),
  linkedTransactionId: z.string().uuid().nullable().default(null),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type Note = z.infer<typeof NoteSchema>
