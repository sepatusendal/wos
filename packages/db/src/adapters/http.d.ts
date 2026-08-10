import type { DatabaseAdapter } from '../adapter';
export interface HttpAdapterOptions {
    endpoint?: string;
    headers?: Record<string, string> | (() => Record<string, string> | Promise<Record<string, string>>);
}
/**
 * DatabaseAdapter yang berkomunikasi lewat HTTP ke API route (mis. /api/db di Next.js).
 * Dipakai untuk web app karena libsql client di browser tidak support "file:" URL.
 */
export declare function createHttpAdapter(options?: string | HttpAdapterOptions): DatabaseAdapter;
//# sourceMappingURL=http.d.ts.map