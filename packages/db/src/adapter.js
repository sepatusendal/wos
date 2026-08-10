export function eq(column, value) {
    return { column, op: '=', value };
}
export function desc(column) {
    return { column, direction: 'DESC' };
}
export function asc(column) {
    return { column, direction: 'ASC' };
}
//# sourceMappingURL=adapter.js.map