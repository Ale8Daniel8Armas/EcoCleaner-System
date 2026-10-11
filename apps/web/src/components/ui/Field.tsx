import type { InputHTMLAttributes } from 'react';

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
    label: string;
};

export function Field({ label, id, ...props }: FieldProps) {
    return <label className="site-name-label" htmlFor={id}>{label}<input id={id} {...props} /></label>;
}
