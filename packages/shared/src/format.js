const currencyFormatter = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
});
export function formatCurrency(amount) {
    return currencyFormatter.format(amount);
}
export function formatDate(dateStr) {
    const parts = dateStr.split('-');
    if (parts.length !== 3)
        return dateStr;
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    if (isNaN(d.getTime()))
        return dateStr;
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}
export function formatDateInput(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
export function todayStr() {
    return formatDateInput(new Date());
}
export function isoNow() {
    return new Date().toISOString();
}
export function getMonthRange(year, month) {
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return { start, end };
}
export function cn(...classes) {
    return classes.filter(Boolean).join(' ');
}
export function formatMonthShort(monthStr) {
    const d = new Date(`${monthStr}-01`);
    if (isNaN(d.getTime()))
        return monthStr;
    return d.toLocaleDateString('id-ID', { month: 'short' });
}
export function formatShortDate(dateStr) {
    const parts = dateStr.split('-');
    if (parts.length < 2)
        return dateStr;
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, parts[2] ? Number(parts[2]) : 1);
    if (isNaN(d.getTime()))
        return dateStr;
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}
//# sourceMappingURL=format.js.map