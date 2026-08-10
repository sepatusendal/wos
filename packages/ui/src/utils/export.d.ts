import type { Transaction } from '@wos/shared';
export declare function exportCSV(transactions: Transaction[], filename?: string): void;
export declare function generatePDFProps(transactions: Transaction[], title?: string): {
    title: string;
    transactions: {
        type: "income" | "expense";
        id: string;
        date: string;
        createdAt: string;
        amount: number;
        category: string;
        description: string;
        accountId: string | null;
    }[];
    totalIncome: number;
    totalExpense: number;
    balance: number;
    byCategory: Record<string, {
        income: number;
        expense: number;
    }>;
};
//# sourceMappingURL=export.d.ts.map