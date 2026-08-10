import type { Transaction, Budget, Account, SavingsGoal, RecurringTransaction } from '@wos/shared';
import type { DatabaseAdapter } from '@wos/db';
interface FinanceState {
    adapter: DatabaseAdapter | null;
    transactions: Transaction[];
    budgets: Budget[];
    accounts: Account[];
    savingsGoals: SavingsGoal[];
    recurring: RecurringTransaction[];
    loading: boolean;
    setAdapter: (adapter: DatabaseAdapter) => void;
    fetchAll: (userId: string) => Promise<void>;
    addTransaction: (userId: string, t: Omit<Transaction, 'id' | 'createdAt'>) => Promise<void>;
    editTransaction: (t: {
        id: string;
        type: string;
        amount: number;
        category: string;
        description: string;
        date: string;
        accountId: string | null;
    }) => Promise<void>;
    deleteTransaction: (id: string) => Promise<void>;
    addBudget: (userId: string, b: Omit<Budget, 'id'>) => Promise<void>;
    deleteBudget: (id: string) => Promise<void>;
    addAccount: (userId: string, a: {
        name: string;
        type: string;
        balance: number;
    }) => Promise<void>;
    editAccount: (a: {
        id: string;
        name: string;
        type: string;
        balance: number;
    }) => Promise<void>;
    deleteAccount: (id: string) => Promise<void>;
    addSavingsGoal: (userId: string, g: {
        name: string;
        targetAmount: number;
        savedAmount: number;
        deadline: string | null;
    }) => Promise<void>;
    editSavingsGoal: (g: {
        id: string;
        name: string;
        targetAmount: number;
        savedAmount: number;
        deadline: string | null;
    }) => Promise<void>;
    deleteSavingsGoal: (id: string) => Promise<void>;
    addRecurring: (userId: string, r: Omit<RecurringTransaction, 'id' | 'createdAt'>) => Promise<void>;
    toggleRecurring: (id: string, active: boolean) => Promise<void>;
    deleteRecurring: (id: string) => Promise<void>;
    transferBetweenAccounts: (userId: string, fromAccountId: string, toAccountId: string, amount: number, description: string) => Promise<void>;
    processRecurring: (userId: string) => Promise<string[]>;
}
export declare const useFinanceStore: import("zustand").UseBoundStore<import("zustand").StoreApi<FinanceState>>;
export {};
//# sourceMappingURL=financeStore.d.ts.map