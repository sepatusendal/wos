import type { DatabaseAdapter } from '@wos/db';
export interface UserSettings {
    userId: string;
    theme: string;
    currency: string;
    locale: string;
    autoLockMinutes: number;
}
interface SettingsState {
    adapter: DatabaseAdapter | null;
    settings: UserSettings | null;
    loaded: boolean;
    setAdapter: (adapter: DatabaseAdapter) => void;
    fetchSettings: (userId: string) => Promise<void>;
    updateSettings: (userId: string, patch: Partial<Omit<UserSettings, 'userId'>>) => Promise<void>;
    changePassword: (userId: string, currentPassword: string, newPassword: string) => Promise<{
        ok: boolean;
        error?: string;
    }>;
}
export declare const useSettingsStore: import("zustand").UseBoundStore<import("zustand").StoreApi<SettingsState>>;
export {};
//# sourceMappingURL=settingsStore.d.ts.map