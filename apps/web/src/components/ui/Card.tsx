import type { HTMLAttributes, PropsWithChildren } from 'react';

type CardProps = PropsWithChildren<HTMLAttributes<HTMLElement>> & {
    as?: 'article' | 'section' | 'div';
};

export function Card({ as = 'section', children, className = '', ...props }: CardProps) {
    const Component = as;
    return <Component className={`ui-card ${className}`} {...props}>{children}</Component>;
}
