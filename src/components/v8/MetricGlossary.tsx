'use client';

import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { metricLessonHref, metricLessons, type LearnMetric } from '@/lib/learn/metric-links';
import styles from './metric-glossary.module.css';

type Props = {
    metric?: LearnMetric;
    children?: ReactNode;
    /** Preserve an existing metric selection button, without nesting another control. */
    buttonProps?: ButtonHTMLAttributes<HTMLButtonElement> & { 'data-indicator'?: string; 'data-overflow'?: boolean; 'data-available'?: boolean | string };
    onInspect?: (trigger: HTMLButtonElement) => void;
};

export function MetricGlossary({ metric, children, buttonProps, onInspect }: Props) {
    if (!metric) return buttonProps ? <button type="button" {...buttonProps} onClick={onInspect ? event => onInspect(event.currentTarget) : buttonProps.onClick}>{children}</button> : <>{children}</>;
    return <GlossaryPopover metric={metric} buttonProps={buttonProps} onInspect={onInspect}>{children}</GlossaryPopover>;
}

function GlossaryPopover({ metric, children, buttonProps, onInspect }: Props & { metric: LearnMetric }) {
    const entry = metricLessons.find(lesson => lesson.id === metric)!;
    const id = useId();
    const trigger = useRef<HTMLButtonElement>(null);
    const popover = useRef<HTMLSpanElement>(null);
    const suppressFocus = useRef(false);
    const [open, setOpen] = useState(false);

    function position() {
        if (!trigger.current || !popover.current?.matches(':popover-open')) return;
        const anchor = trigger.current.getBoundingClientRect();
        const panel = popover.current.getBoundingClientRect();
        const viewport = window.visualViewport;
        const left = viewport?.offsetLeft ?? 0;
        const top = viewport?.offsetTop ?? 0;
        const width = viewport?.width ?? window.innerWidth;
        const height = viewport?.height ?? window.innerHeight;
        popover.current.style.left = `${Math.max(left + 8, Math.min(anchor.left, left + width - panel.width - 8))}px`;
        const below = anchor.bottom + 6;
        const preferred = below + panel.height <= top + height - 8 ? below : anchor.top - panel.height - 6;
        popover.current.style.top = `${Math.max(top + 8, Math.min(preferred, top + height - panel.height - 8))}px`;
    }

    useEffect(() => {
        if (!open) return;
        const update = () => position();
        const observer = new ResizeObserver(update);
        if (popover.current) observer.observe(popover.current);
        window.addEventListener('resize', update);
        window.addEventListener('scroll', update, true);
        window.visualViewport?.addEventListener('resize', update);
        window.visualViewport?.addEventListener('scroll', update);
        return () => {
            observer.disconnect();
            window.removeEventListener('resize', update);
            window.removeEventListener('scroll', update, true);
            window.visualViewport?.removeEventListener('resize', update);
            window.visualViewport?.removeEventListener('scroll', update);
        };
    }, [open]);

    function close() {
        suppressFocus.current = true;
        popover.current?.hidePopover();
        trigger.current?.focus({ preventScroll: true });
        suppressFocus.current = false;
    }

    function blur(next: EventTarget | null) {
        if (next instanceof Node && (next === trigger.current || popover.current?.contains(next))) return;
        popover.current?.hidePopover();
    }

    return <>
        <button type="button" {...buttonProps} ref={trigger}
            className={`${buttonProps ? buttonProps.className ?? '' : styles.trigger} ${styles.control}`}
            data-glossary={metric} popoverTarget={id} aria-haspopup="dialog" aria-expanded={open}
            aria-label={buttonProps?.['aria-label'] ?? `${typeof children === 'string' ? children : entry.label} definition`}
            onClick={event => {
                buttonProps?.onClick?.(event);
                event.preventDefault();
                if (popover.current?.matches(':popover-open')) popover.current.hidePopover();
                else { popover.current?.showPopover(); position(); }
            }}
            onFocus={event => {
                buttonProps?.onFocus?.(event);
                if (!suppressFocus.current && event.currentTarget.matches(':focus-visible')) {
                    popover.current?.showPopover();
                    position();
                }
            }} onBlur={event => { buttonProps?.onBlur?.(event); blur(event.relatedTarget); }}
            onKeyDown={event => {
                if (event.key === 'Escape' && popover.current?.matches(':popover-open')) { event.preventDefault(); event.stopPropagation(); close(); }
                else buttonProps?.onKeyDown?.(event);
            }}>
            {children ?? entry.label}
        </button>
        <span ref={popover} id={id} popover="auto" role="dialog" aria-labelledby={`${id}-title`}
            className={styles.popover} data-glossary-panel={metric}
            onToggle={event => { setOpen(event.newState === 'open'); if (event.newState === 'open') position(); }}
            onKeyDown={event => {
                // A glossary inside an inspector must dismiss before the containing dialog.
                if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
            }}
            onBlur={event => blur(event.relatedTarget)}>
            <span className={styles.title} id={`${id}-title`}>{entry.label}</span>
            <span className={styles.definition}>{entry.definition}</span>
            {onInspect && <button className={styles.inspect} type="button" onClick={() => { close(); if (trigger.current) onInspect(trigger.current); }}>View indicator</button>}
            <span className={styles.actions}>
                <a href={metricLessonHref(metric)} target="_blank" rel="noopener noreferrer" aria-label={`Learn more about ${entry.label} (opens in a new tab)`}>Learn more <span aria-hidden="true">↗</span></a>
                <button type="button" onClick={close} aria-label={`Close ${entry.label} definition`}>Close</button>
            </span>
        </span>
    </>;
}
