import type { ReactNode } from 'react';
declare const PAGES: readonly [{
    readonly id: "dashboard";
    readonly label: "Dashboard";
    readonly icon: "🏠";
}, {
    readonly id: "finance";
    readonly label: "Finance";
    readonly icon: "💸";
}, {
    readonly id: "wealth";
    readonly label: "Wealth";
    readonly icon: "📈";
}, {
    readonly id: "networth";
    readonly label: "Net Worth";
    readonly icon: "🏦";
}, {
    readonly id: "vault";
    readonly label: "Vault";
    readonly icon: "🔐";
}, {
    readonly id: "todo";
    readonly label: "Todo";
    readonly icon: "✅";
}, {
    readonly id: "settings";
    readonly label: "Settings";
    readonly icon: "⚙️";
}];
export type PageId = typeof PAGES[number]['id'];
interface Props {
    activePage: PageId;
    onNavigate: (page: PageId) => void;
    children?: ReactNode;
}
export default function Sidebar({ activePage, onNavigate, children }: Props): import("react").JSX.Element;
export {};
//# sourceMappingURL=Sidebar.d.ts.map