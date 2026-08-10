import { z } from 'zod';
export declare const TransactionType: z.ZodEnum<["income", "expense"]>;
export type TransactionType = z.infer<typeof TransactionType>;
export declare const AssetType: z.ZodEnum<["stock", "crypto", "real-estate", "cash", "bonds", "other"]>;
export type AssetType = z.infer<typeof AssetType>;
export declare const Priority: z.ZodEnum<["low", "medium", "high"]>;
export type Priority = z.infer<typeof Priority>;
export declare const VaultCategory: z.ZodEnum<["email", "banking", "social", "work", "entertainment", "shopping", "other"]>;
export type VaultCategory = z.infer<typeof VaultCategory>;
export declare const TransactionSchema: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodEnum<["income", "expense"]>;
    amount: z.ZodNumber;
    category: z.ZodString;
    description: z.ZodDefault<z.ZodString>;
    date: z.ZodString;
    accountId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "income" | "expense";
    id: string;
    date: string;
    createdAt: string;
    amount: number;
    category: string;
    description: string;
    accountId: string | null;
}, {
    type: "income" | "expense";
    id: string;
    date: string;
    createdAt: string;
    amount: number;
    category: string;
    description?: string | undefined;
    accountId?: string | null | undefined;
}>;
export declare const BudgetSchema: z.ZodObject<{
    id: z.ZodString;
    category: z.ZodString;
    limit: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    id: string;
    category: string;
    limit: number;
}, {
    id: string;
    category: string;
    limit: number;
}>;
export declare const AssetSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    type: z.ZodEnum<["stock", "crypto", "real-estate", "cash", "bonds", "other"]>;
    quantity: z.ZodNumber;
    unitPrice: z.ZodNumber;
    notes: z.ZodDefault<z.ZodString>;
    lastUpdated: z.ZodString;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    type: "stock" | "crypto" | "real-estate" | "cash" | "bonds" | "other";
    id: string;
    createdAt: string;
    quantity: number;
    unitPrice: number;
    notes: string;
    lastUpdated: string;
}, {
    name: string;
    type: "stock" | "crypto" | "real-estate" | "cash" | "bonds" | "other";
    id: string;
    createdAt: string;
    quantity: number;
    unitPrice: number;
    lastUpdated: string;
    notes?: string | undefined;
}>;
export declare const NetWorthEntrySchema: z.ZodObject<{
    id: z.ZodString;
    date: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    totalAssets: z.ZodNumber;
    totalLiabilities: z.ZodNumber;
    netWorth: z.ZodNumber;
    cash: z.ZodDefault<z.ZodNumber>;
    investments: z.ZodDefault<z.ZodNumber>;
    property: z.ZodDefault<z.ZodNumber>;
    otherAssets: z.ZodDefault<z.ZodNumber>;
    mortgage: z.ZodDefault<z.ZodNumber>;
    loans: z.ZodDefault<z.ZodNumber>;
    creditCards: z.ZodDefault<z.ZodNumber>;
    otherLiabilities: z.ZodDefault<z.ZodNumber>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    property: number;
    createdAt: string;
    cash: number;
    totalAssets: number;
    totalLiabilities: number;
    netWorth: number;
    investments: number;
    otherAssets: number;
    mortgage: number;
    loans: number;
    creditCards: number;
    otherLiabilities: number;
    date?: string | null | undefined;
}, {
    id: string;
    createdAt: string;
    totalAssets: number;
    totalLiabilities: number;
    netWorth: number;
    property?: number | undefined;
    date?: string | null | undefined;
    cash?: number | undefined;
    investments?: number | undefined;
    otherAssets?: number | undefined;
    mortgage?: number | undefined;
    loans?: number | undefined;
    creditCards?: number | undefined;
    otherLiabilities?: number | undefined;
}>;
export declare const VaultEntrySchema: z.ZodObject<{
    id: z.ZodString;
    service: z.ZodString;
    username: z.ZodString;
    password: z.ZodString;
    url: z.ZodDefault<z.ZodString>;
    notes: z.ZodDefault<z.ZodString>;
    category: z.ZodEnum<["email", "banking", "social", "work", "entertainment", "shopping", "other"]>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    url: string;
    password: string;
    username: string;
    createdAt: string;
    category: "email" | "other" | "banking" | "social" | "work" | "entertainment" | "shopping";
    notes: string;
    service: string;
}, {
    id: string;
    password: string;
    username: string;
    createdAt: string;
    category: "email" | "other" | "banking" | "social" | "work" | "entertainment" | "shopping";
    service: string;
    url?: string | undefined;
    notes?: string | undefined;
}>;
export declare const TodoSchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    completed: z.ZodDefault<z.ZodBoolean>;
    priority: z.ZodEnum<["low", "medium", "high"]>;
    tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    dueDate: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    notes: z.ZodDefault<z.ZodString>;
    parentId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    order: z.ZodDefault<z.ZodNumber>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    title: string;
    createdAt: string;
    notes: string;
    completed: boolean;
    priority: "low" | "medium" | "high";
    tags: string[];
    dueDate: string | null;
    parentId: string | null;
    order: number;
    updatedAt: string;
}, {
    id: string;
    title: string;
    createdAt: string;
    priority: "low" | "medium" | "high";
    updatedAt: string;
    notes?: string | undefined;
    completed?: boolean | undefined;
    tags?: string[] | undefined;
    dueDate?: string | null | undefined;
    parentId?: string | null | undefined;
    order?: number | undefined;
}>;
export declare const AccountType: z.ZodEnum<["cash", "bank", "ewallet", "credit"]>;
export type AccountType = z.infer<typeof AccountType>;
export declare const AccountSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    type: z.ZodEnum<["cash", "bank", "ewallet", "credit"]>;
    balance: z.ZodDefault<z.ZodNumber>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    type: "cash" | "bank" | "ewallet" | "credit";
    id: string;
    createdAt: string;
    balance: number;
}, {
    name: string;
    type: "cash" | "bank" | "ewallet" | "credit";
    id: string;
    createdAt: string;
    balance?: number | undefined;
}>;
export declare const SavingsGoalSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    targetAmount: z.ZodNumber;
    savedAmount: z.ZodDefault<z.ZodNumber>;
    deadline: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    id: string;
    createdAt: string;
    targetAmount: number;
    savedAmount: number;
    deadline: string | null;
}, {
    name: string;
    id: string;
    createdAt: string;
    targetAmount: number;
    savedAmount?: number | undefined;
    deadline?: string | null | undefined;
}>;
export declare const Frequency: z.ZodEnum<["daily", "weekly", "monthly", "yearly"]>;
export type Frequency = z.infer<typeof Frequency>;
export declare const RecurringTransactionSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    type: z.ZodEnum<["income", "expense"]>;
    amount: z.ZodNumber;
    category: z.ZodString;
    frequency: z.ZodEnum<["daily", "weekly", "monthly", "yearly"]>;
    nextDate: z.ZodString;
    active: z.ZodDefault<z.ZodBoolean>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    type: "income" | "expense";
    id: string;
    createdAt: string;
    amount: number;
    category: string;
    frequency: "daily" | "weekly" | "monthly" | "yearly";
    nextDate: string;
    active: boolean;
}, {
    name: string;
    type: "income" | "expense";
    id: string;
    createdAt: string;
    amount: number;
    category: string;
    frequency: "daily" | "weekly" | "monthly" | "yearly";
    nextDate: string;
    active?: boolean | undefined;
}>;
export type Transaction = z.infer<typeof TransactionSchema>;
export type Budget = z.infer<typeof BudgetSchema>;
export type Asset = z.infer<typeof AssetSchema>;
export type NetWorthEntry = z.infer<typeof NetWorthEntrySchema>;
export type VaultEntry = z.infer<typeof VaultEntrySchema>;
export type TodoItem = z.infer<typeof TodoSchema>;
export type Account = z.infer<typeof AccountSchema>;
export type SavingsGoal = z.infer<typeof SavingsGoalSchema>;
export type RecurringTransaction = z.infer<typeof RecurringTransactionSchema>;
export declare const ThemeColor: z.ZodEnum<["yellow", "blue", "green", "pink", "orange", "purple", "red"]>;
export type ThemeColor = z.infer<typeof ThemeColor>;
//# sourceMappingURL=validation.d.ts.map