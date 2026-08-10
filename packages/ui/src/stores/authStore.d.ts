import type { DatabaseAdapter } from '@wos/db';
interface AuthState {
    adapter: DatabaseAdapter | null;
    userId: string | null;
    username: string | null;
    isAuthenticated: boolean;
    isVaultLocked: boolean;
    setAdapter: (adapter: DatabaseAdapter) => void;
    register: (username: string, password: string) => Promise<{
        ok: boolean;
        error?: string;
    }>;
    login: (username: string, password: string) => Promise<{
        ok: boolean;
        error?: string;
    }>;
    logout: () => void;
    lockVault: () => void;
    unlockVault: (password: string) => Promise<{
        ok: boolean;
        error?: string;
    }>;
    init: () => Promise<void>;
}
export declare const useAuthStore: import("zustand").UseBoundStore<import("zustand").StoreApi<AuthState>>;
export {};
//# sourceMappingURL=authStore.d.ts.map