import type { PropsWithChildren, ReactNode } from 'react';

type PageHeaderProps = PropsWithChildren<{
    eyebrow: string;
    title: string;
    description?: string;
    action?: ReactNode;
}>;

export function PageHeader({ eyebrow, title, description, action, children }: PageHeaderProps) {
    return <div className="dashboard-toolbar">
        <div><p className="section-kicker">{eyebrow}</p><h2 className="ui-page-title">{title}</h2>{description && <p className="muted">{description}</p>}</div>
        {action ?? children}
    </div>;
}
