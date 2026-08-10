import type { Asset } from '@wos/shared';
import type { DatabaseAdapter } from '@wos/db';
interface WealthState {
    adapter: DatabaseAdapter | null;
    assets: Asset[];
    loading: boolean;
    setAdapter: (adapter: DatabaseAdapter) => void;
    fetchAll: (userId: string) => Promise<void>;
    addAsset: (userId: string, a: Omit<Asset, 'id' | 'lastUpdated' | 'createdAt'>) => Promise<void>;
    editAsset: (a: {
        id: string;
        name: string;
        type: string;
        quantity: number;
        unitPrice: number;
        notes: string;
    }) => Promise<void>;
    deleteAsset: (id: string) => Promise<void>;
}
export declare const useWealthStore: import("zustand").UseBoundStore<import("zustand").StoreApi<WealthState>>;
export {};
//# sourceMappingURL=wealthStore.d.ts.map