import type { ComponentPropsWithoutRef, HTMLAttributes, ReactNode } from 'react';
import base from './market-v8.module.css';

/** The existing panel surface, without an extra wrapper or a change of landmark. */
export function V8Card({ as: Element = 'section', className, ...props }: HTMLAttributes<HTMLElement> & { as?: 'section' | 'div' }) {
    return <Element {...props} className={`${base.panel}${className ? ` ${className}` : ''}`} />;
}

/** Native disclosure semantics and direct summary selectors belong to the browser. */
export function V8Disclosure({ summary, children, ...props }: ComponentPropsWithoutRef<'details'> & { summary: ReactNode }) {
    return <details {...props}><summary>{summary}</summary>{children}</details>;
}

/** A compact empty message with an optional inline next action; no loading/error inference. */
export function V8EmptyState({ message, action, ...props }: Omit<ComponentPropsWithoutRef<'p'>, 'children'> & { message: ReactNode; action?: ReactNode }) {
    return <p {...props}>{message}{action != null && <> {action}</>}</p>;
}

/** Callers retain provenance, formatting and missing-time wording. Never infer a clock here. */
export function V8FreshnessLine({ as: Element = 'span', label, value, separator = ': ', ...props }: Omit<HTMLAttributes<HTMLElement>, 'children'> & {
    as?: 'span' | 'small';
    label: string;
    value: string;
    separator?: string;
}) {
    return <Element {...props}>{label}{separator}{value}</Element>;
}
