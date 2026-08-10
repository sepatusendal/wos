import type { NetWorthEntry } from '@wos/shared';
import type { DatabaseAdapter } from '@wos/db';
interface NetWorthState {
    adapter: DatabaseAdapter | null;
    entries: NetWorthEntry[];
    loading: boolean;
    setAdapter: (adapter: DatabaseAdapter) => void;
    fetchAll: (userId: string) => Promise<void>;
    addEntry: (userId: string, e: Omit<NetWorthEntry, 'id' | 'createdAt'>) => Promise<void>;
    deleteEntry: (id: string) => Promise<void>;
}
export declare const useNetWorthStore: import("zustand").UseBoundStore<import("zustand").StoreApi<NetWorthState>>;
export {};
//# sourceMappingURL=netWorthStore.d.ts.map