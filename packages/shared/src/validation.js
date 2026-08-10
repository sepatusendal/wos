import { z } from 'zod';
export const TransactionType = z.enum(['income', 'expense']);
export const AssetType = z.enum(['stock', 'crypto', 'real-estate', 'cash', 'bonds', 'other']);
export const Priority = z.enum(['low', 'medium', 'high']);
export const VaultCategory = z.enum(['email', 'banking', 'social', 'work', 'entertainment', 'shopping', 'other']);
export const TransactionSchema = z.object({
    id: z.string().uuid(),
    type: TransactionType,
    amount: z.number().positive(),
    category: z.string().min(1),
    description: z.string().default(''),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    accountId: z.string().uuid().nullable().default(null),
    createdAt: z.string().datetime(),
});
export const BudgetSchema = z.object({
    id: z.string().uuid(),
    category: z.string().min(1),
    limit: z.number().positive(),
});
export const AssetSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1),
    type: AssetType,
    quantity: z.number().positive(),
    unitPrice: z.number().positive(),
    notes: z.string().default(''),
    lastUpdated: z.string().datetime(),
    createdAt: z.string().datetime(),
});
export const NetWorthEntrySchema = z.object({
    id: z.string().uuid(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
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
});
export const VaultEntrySchema = z.object({
    id: z.string().uuid(),
    service: z.string().min(1),
    username: z.string().min(1),
    password: z.string().min(1),
    url: z.string().default(''),
    notes: z.string().default(''),
    category: VaultCategory,
    createdAt: z.string().datetime(),
});
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
});
export const AccountType = z.enum(['cash', 'bank', 'ewallet', 'credit']);
export const AccountSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1),
    type: AccountType,
    balance: z.number().default(0),
    createdAt: z.string().datetime(),
});
export const SavingsGoalSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1),
    targetAmount: z.number().positive(),
    savedAmount: z.number().default(0),
    deadline: z.string().nullable().default(null),
    createdAt: z.string().datetime(),
});
export const Frequency = z.enum(['daily', 'weekly', 'monthly', 'yearly']);
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
});
export const ThemeColor = z.enum(['yellow', 'blue', 'green', 'pink', 'orange', 'purple', 'red']);
//# sourceMappingURL=validation.js.map