import type { Transaction } from '@wos/shared';
interface Props {
    title: string;
    transactions: Transaction[];
    totalIncome: number;
    totalExpense: number;
    balance: number;
    byCategory: Record<string, {
        income: number;
        expense: number;
    }>;
}
export declare function TransactionPDF({ title, transactions, totalIncome, totalExpense, balance, byCategory }: Props): import("react").JSX.Element;
export {};
//# sourceMappingURL=TransactionPDF.d.ts.map