import type { ReactNode } from 'react';
import { metricLessonHref, metricLessons, type LearnMetric } from '@/lib/learn/metric-links';
import styles from './metric-learn-link.module.css';

/** Keep the current reading and any unsaved work in its original tab. */
export function MetricLearnLink({ metric, children }: { metric: LearnMetric; children?: ReactNode }) {
    const label = metricLessons.find(lesson => lesson.id === metric)!.label;
    return <a className={styles.metricLink} href={metricLessonHref(metric)} target="_blank" rel="noopener noreferrer"
        aria-label={`Learn about ${label} (opens in a new tab)`} title={`Learn about ${label} · opens in a new tab`}>
        {children ?? label}<span aria-hidden="true">↗</span>
    </a>;
}
