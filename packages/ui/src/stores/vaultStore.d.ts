import type { VaultEntry } from '@wos/shared';
import type { DatabaseAdapter } from '@wos/db';
interface VaultState {
    adapter: DatabaseAdapter | null;
    entries: VaultEntry[];
    loading: boolean;
    vaultKey: CryptoKey | null;
    setAdapter: (adapter: DatabaseAdapter) => void;
    fetchAll: (userId: string) => Promise<void>;
    unlock: (userId: string, password: string) => Promise<{
        ok: boolean;
        error?: string;
    }>;
    lock: () => void;
    checkVaultSetup: (userId: string) => Promise<{
        hasPassword: boolean;
    }>;
    changeVaultPassword: (userId: string, currentPassword: string | null, newPassword: string) => Promise<{
        ok: boolean;
        error?: string;
    }>;
    addEntry: (userId: string, e: Omit<VaultEntry, 'id' | 'createdAt'>) => Promise<void>;
    editEntry: (e: {
        id: string;
        service: string;
        username: string;
        password: string;
        url: string;
        notes: string;
        category: string;
    }) => Promise<void>;
    deleteEntry: (id: string) => Promise<void>;
}
export declare const useVaultStore: import("zustand").UseBoundStore<import("zustand").StoreApi<VaultState>>;
export {};
//# sourceMappingURL=vaultStore.d.ts.map