import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';

type ButtonProps = PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>> & {
    variant?: 'primary' | 'ghost';
};

export function Button({ children, className = '', variant = 'primary', ...props }: ButtonProps) {
    return <button className={`${variant === 'primary' ? 'primary-button' : 'ghost-button'} ${className}`} {...props}>{children}</button>;
}
