const ALLOWED_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const ALLOWED_OPERATORS = new Set(['=', '!=', '<', '<=', '>', '>=', 'LIKE', 'ILIKE', 'IN', 'NOT IN', 'IS', 'IS NOT']);
function sanitizeIdentifier(name) {
    if (name === '*')
        return '*';
    if (!ALLOWED_IDENTIFIER.test(name)) {
        throw new Error(`Invalid SQL identifier: "${name}"`);
    }
    return name;
}
function sanitizeOperator(op) {
    const upper = op.trim().toUpperCase();
    if (!ALLOWED_OPERATORS.has(upper)) {
        throw new Error(`Invalid SQL operator: "${op}"`);
    }
    return upper;
}
function sanitizeDirection(dir) {
    const upper = dir.trim().toUpperCase();
    if (upper !== 'ASC' && upper !== 'DESC') {
        throw new Error(`Invalid ORDER BY direction: "${dir}"`);
    }
    return upper;
}
function buildCondition(c) {
    const col = sanitizeIdentifier(c.column);
    const op = sanitizeOperator(c.op);
    if (Array.isArray(c.value)) {
        if (c.value.length === 0) {
            return { sql: op.includes('NOT') ? '1=1' : '1=0', params: [] };
        }
        const placeholders = c.value.map(() => '?').join(', ');
        return { sql: `${col} ${op} (${placeholders})`, params: c.value };
    }
    return { sql: `${col} ${op} ?`, params: [c.value] };
}
function formatOrderClause(orders) {
    return orders.map((o) => `${sanitizeIdentifier(o.column)} ${sanitizeDirection(o.direction)}`).join(', ');
}
export function createTauriSqlAdapter(tauriDb) {
    const db = {
        select(...columns) {
            const colNames = columns.length > 0 ? columns.map(sanitizeIdentifier).join(', ') : '*';
            return {
                from(tableName) {
                    const table = sanitizeIdentifier(tableName);
                    return {
                        where(condition) {
                            return {
                                orderBy(...orders) {
                                    return {
                                        async all() {
                                            const { sql, params } = buildCondition(condition);
                                            const orderClause = formatOrderClause(orders);
                                            const query = `SELECT ${colNames} FROM ${table} WHERE ${sql} ORDER BY ${orderClause}`;
                                            return tauriDb.select(query, params);
                                        },
                                        async limit(n) {
                                            const { sql, params } = buildCondition(condition);
                                            const orderClause = formatOrderClause(orders);
                                            const query = `SELECT ${colNames} FROM ${table} WHERE ${sql} ORDER BY ${orderClause} LIMIT ${Number(n)}`;
                                            return tauriDb.select(query, params);
                                        },
                                    };
                                },
                                async all() {
                                    const { sql, params } = buildCondition(condition);
                                    const query = `SELECT ${colNames} FROM ${table} WHERE ${sql}`;
                                    return tauriDb.select(query, params);
                                },
                                async limit(n) {
                                    const { sql, params } = buildCondition(condition);
                                    const query = `SELECT ${colNames} FROM ${table} WHERE ${sql} LIMIT ${Number(n)}`;
                                    return tauriDb.select(query, params);
                                },
                            };
                        },
                        orderBy(...orders) {
                            return {
                                async all() {
                                    const orderClause = formatOrderClause(orders);
                                    const query = `SELECT ${colNames} FROM ${table} ORDER BY ${orderClause}`;
                                    return tauriDb.select(query);
                                },
                                async limit(n) {
                                    const orderClause = formatOrderClause(orders);
                                    const query = `SELECT ${colNames} FROM ${table} ORDER BY ${orderClause} LIMIT ${Number(n)}`;
                                    return tauriDb.select(query);
                                },
                            };
                        },
                        async all() {
                            const query = `SELECT ${colNames} FROM ${table}`;
                            return tauriDb.select(query);
                        },
                        async limit(n) {
                            const query = `SELECT ${colNames} FROM ${table} LIMIT ${Number(n)}`;
                            return tauriDb.select(query);
                        },
                    };
                },
            };
        },
        insert(tableName) {
            const table = sanitizeIdentifier(tableName);
            return {
                async values(data) {
                    const keys = Object.keys(data).map(sanitizeIdentifier);
                    if (keys.length === 0)
                        return;
                    const vals = Object.values(data);
                    const placeholders = vals.map(() => '?');
                    const query = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders.join(', ')})`;
                    await tauriDb.execute(query, vals);
                },
            };
        },
        update(tableName) {
            const table = sanitizeIdentifier(tableName);
            return {
                set(data) {
                    return {
                        async where(condition) {
                            const keys = Object.keys(data).map(sanitizeIdentifier);
                            if (keys.length === 0)
                                return;
                            const setClauses = keys.map((k) => `${k} = ?`);
                            const { sql, params } = buildCondition(condition);
                            const vals = Object.values(data);
                            const query = `UPDATE ${table} SET ${setClauses.join(', ')} WHERE ${sql}`;
                            await tauriDb.execute(query, [...vals, ...params]);
                        },
                    };
                },
            };
        },
        delete(tableName) {
            const table = sanitizeIdentifier(tableName);
            return {
                async where(condition) {
                    const { sql, params } = buildCondition(condition);
                    const query = `DELETE FROM ${table} WHERE ${sql}`;
                    await tauriDb.execute(query, params);
                },
            };
        },
    };
    return { db, async init() { } };
}
//# sourceMappingURL=tauri.js.map