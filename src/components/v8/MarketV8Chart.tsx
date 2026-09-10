'use client';

import { useId, useState } from 'react';
import { dateLabel, type Point } from './market-v8-fixtures';
import styles from './market-v8.module.css';

function geometry(points: Point[], width: number, height: number, min: number, max: number, pad = 0) {
    const first = Date.parse(points[0].date);
    const duration = Date.parse(points.at(-1)!.date) - first || 1;
    const rounded = (value: number) => Math.round(value * 100) / 100;
    return points.map(point => ({ x: rounded(pad + (Date.parse(point.date) - first) / duration * (width - pad * 2)), y: rounded(pad + (1 - (point.value - min) / (max - min || 1)) * (height - pad * 2)) }));
}
export function Sparkline({ points, weekly = false }: { points: Point[]; weekly?: boolean }) {
    if (points.length < 2) return <span className={styles.noHistory}>History unavailable</span>;
    const values = points.map(p => p.value);
    const locations = geometry(points, 160, 44, Math.min(...values), Math.max(...values), 3);
    return <svg className={styles.sparkline} viewBox="0 0 160 44" aria-hidden="true"><path d={locations.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ')} fill="none" stroke="currentColor" strokeWidth="2" />{weekly && locations.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="2" fill="currentColor" />)}</svg>;
}
export function MarketChart({ points, selectedDate, onSelect, raw = false, name = 'Market condition score', sourced = false }: { points: Point[]; selectedDate?: string; onSelect?: (point: Point) => void; raw?: boolean; name?: string; sourced?: boolean }) {
    const id = useId().replace(/:/g, '');
    const [cursor, setCursor] = useState(() => {
        const initial = points.findIndex(p => p.date === selectedDate);
        return initial >= 0 ? initial : points.length - 1;
    });
    if (!points.length) return <div className={styles.chartEmpty}>No historical observations are supplied.</div>;
    const minimum = raw ? Math.floor(Math.min(...points.map(p => p.value)) * 0.75) : 0;
    const maximum = raw ? Math.ceil(Math.max(...points.map(p => p.value)) * 1.15) : 100;
    const locations = geometry(points, 800, 226, minimum, maximum);
    const at = Math.min(cursor, points.length - 1);
    const position = locations[at];
    const path = locations.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ');
    return <div className={styles.chart}>
        <div className={styles.chartTopline}><span>{sourced ? raw ? 'Raw readings from archived snapshots' : '0–100 composite · stored history' : raw ? 'Raw observations · illustrative' : '0–100 composite · illustrative history'}</span><output aria-live="polite">{dateLabel(points[at].date)} <b>{points[at].value.toFixed(raw ? 2 : 0)}{raw ? '' : ' /100'}</b></output></div>
        <div className={styles.chartPlot}>
            <div className={styles.axis}>{[maximum, (maximum + minimum) / 2, minimum].map(value => <span key={value}>{value.toFixed(0)}</span>)}</div>
            <svg viewBox="-3 -8 806 242" preserveAspectRatio="none" role={onSelect ? 'slider' : 'img'} tabIndex={onSelect ? 0 : undefined} aria-label={name} aria-valuemin={onSelect ? 0 : undefined} aria-valuemax={onSelect ? points.length - 1 : undefined} aria-valuenow={onSelect ? at : undefined} aria-valuetext={onSelect ? `${dateLabel(points[at].date)}, score ${points[at].value}. Arrow keys explore, Enter selects.` : undefined}
                onKeyDown={event => {
                    if (!onSelect) return;
                    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
                        event.preventDefault();
                        setCursor(event.key === 'Home' ? 0 : event.key === 'End' ? points.length - 1 : Math.max(0, Math.min(points.length - 1, cursor + (event.key === 'ArrowRight' ? 1 : -1))));
                    } else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(points[Math.min(cursor, points.length - 1)]); }
                }}
                onClick={event => {
                    if (!onSelect) return;
                    const box = event.currentTarget.getBoundingClientRect();
                    const x = (event.clientX - box.left) / box.width * 800;
                    const nearest = locations.reduce((best, p, i) => Math.abs(p.x - x) < Math.abs(locations[best].x - x) ? i : best, 0);
                    setCursor(nearest); onSelect(points[nearest]);
                }}>
                <defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop stopColor="currentColor" stopOpacity=".2" /><stop offset="1" stopColor="currentColor" stopOpacity=".01" /></linearGradient></defs>
                {[0, 56.5, 113, 169.5, 226].map(y => <line key={y} x1="0" x2="800" y1={y} y2={y} stroke="currentColor" strokeOpacity=".12" strokeDasharray="3 5" />)}
                <path d={`${path} L800,226 L0,226 Z`} fill={`url(#${id})`} />
                <path d={path} fill="none" stroke="currentColor" strokeWidth="2.8" vectorEffect="non-scaling-stroke" />
                <line x1={position.x} x2={position.x} y1="0" y2="226" stroke="currentColor" strokeDasharray="4 5" opacity=".5" />
                <circle cx={position.x} cy={position.y} r="5" fill="white" stroke="currentColor" strokeWidth="3" />
            </svg>
        </div>
        <div className={styles.chartDates}><span>{dateLabel(points[0].date)}</span><span>{dateLabel(points[Math.floor(points.length / 2)].date)}</span><span>{dateLabel(points.at(-1)!.date)} {points.at(-1)!.date.slice(0,4)}</span></div>
        {onSelect && <span className={styles.chartHint}>Select a date to investigate · keyboard: ← → then Enter</span>}
    </div>;
}
