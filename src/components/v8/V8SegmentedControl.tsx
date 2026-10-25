'use client';

import { useRef, type KeyboardEvent, type ReactNode } from 'react';

type Option<Value extends string> = { value: Value; label: ReactNode };
type Props<Value extends string> = {
    label: string;
    className: string;
    value: Value;
    onChange: (value: Value) => void;
} & ({
    kind: 'pressed';
    legendClassName: string;
    options: readonly Option<Value>[];
} | {
    kind: 'tabs';
    options: readonly (Option<Value> & { id: string; controls: string })[];
});

/** Pressed buttons keep ordinary Tab stops; automatic tabs alone use roving focus. */
export function V8SegmentedControl<Value extends string>(props: Props<Value>) {
    const list = useRef<HTMLDivElement>(null);
    const { label, className, value, onChange, options } = props;

    function tabKeys(event: KeyboardEvent<HTMLDivElement>) {
        const index = options.findIndex(option => option.value === value);
        if (index < 0) return;
        const next = event.key === 'ArrowRight' ? (index + 1) % options.length
            : event.key === 'ArrowLeft' ? (index + options.length - 1) % options.length
                : event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : null;
        if (next === null) return;
        event.preventDefault();
        onChange(options[next].value);
        list.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
    }

    if (props.kind === 'pressed') return <fieldset className={className}>
        <legend className={props.legendClassName}>{label}</legend>
        {props.options.map(option => <button type="button" key={option.value} aria-pressed={value === option.value} onClick={() => onChange(option.value)}>{option.label}</button>)}
    </fieldset>;

    return <div ref={list} className={className} role="tablist" aria-label={label} onKeyDown={tabKeys}>
        {props.options.map(option => <button type="button" key={option.value} id={option.id} role="tab" aria-selected={value === option.value} tabIndex={value === option.value ? 0 : -1} aria-controls={option.controls} onClick={() => onChange(option.value)}>{option.label}</button>)}
    </div>;
}
