const DEFAULT_ENDPOINT = '/api/db';
async function callDb(payload, options) {
    const endpoint = options?.endpoint || DEFAULT_ENDPOINT;
    let customHeaders = {};
    if (typeof options?.headers === 'function') {
        customHeaders = await options.headers();
    }
    else if (options?.headers) {
        customHeaders = options.headers;
    }
    const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...customHeaders },
        body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.error || `DB request gagal (${res.status})`);
    }
    return data;
}
/**
 * DatabaseAdapter yang berkomunikasi lewat HTTP ke API route (mis. /api/db di Next.js).
 * Dipakai untuk web app karena libsql client di browser tidak support "file:" URL.
 */
export function createHttpAdapter(options) {
    const opts = typeof options === 'string' ? { endpoint: options } : options || {};
    const api = (payload) => callDb(payload, opts);
    const build = (state) => {
        return {
            where(condition) {
                return build({ ...state, where: condition });
            },
            orderBy(...orders) {
                return build({ ...state, orderBy: orders });
            },
            async all() {
                const { rows } = await api({
                    operation: 'select',
                    table: state.table,
                    columns: state.columns,
                    where: state.where,
                    orderBy: state.orderBy,
                    limit: state.limit,
                });
                return rows ?? [];
            },
            async limit(n) {
                const { rows } = await api({
                    operation: 'select',
                    table: state.table,
                    columns: state.columns,
                    where: state.where,
                    orderBy: state.orderBy,
                    limit: n,
                });
                return rows ?? [];
            },
        };
    };
    const db = {
        select(...columns) {
            const cols = columns.length > 0 ? columns : ['*'];
            return {
                from(table) {
                    return build({ table, columns: cols, where: null, orderBy: [], limit: null });
                },
            };
        },
        insert(table) {
            return {
                async values(data) {
                    await api({ operation: 'insert', table, values: data });
                },
            };
        },
        update(table) {
            return {
                set(data) {
                    return {
                        async where(condition) {
                            await api({ operation: 'update', table, where: condition, values: data });
                        },
                    };
                },
            };
        },
        delete(table) {
            return {
                async where(condition) {
                    await api({ operation: 'delete', table, where: condition });
                },
            };
        },
    };
    return {
        db,
        async init() { },
    };
}
//# sourceMappingURL=http.js.map