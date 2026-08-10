import type { ReactNode } from 'react';
interface Props {
    open: boolean;
    onClose: () => void;
    title: string;
    children: ReactNode;
}
export declare function NeubruModal({ open, onClose, title, children }: Props): import("react").JSX.Element | null;
export {};
//# sourceMappingURL=NeubruModal.d.ts.map