import { type ButtonHTMLAttributes, type ReactNode } from 'react';
interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
    color?: 'yellow' | 'blue' | 'green' | 'pink' | 'orange' | 'purple' | 'red';
    size?: 'sm' | 'md';
    children: ReactNode;
}
export declare function NeubruBtn({ color, size, children, className, ...props }: Props): import("react").JSX.Element;
export {};
//# sourceMappingURL=NeubruBtn.d.ts.map