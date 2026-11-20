'use client';

import { useEffect, useState } from 'react';

/** Refresh UTC review deadlines at midnight and when a suspended tab is reopened. */
export function useReviewDay() {
    const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10));
    useEffect(() => {
        let timer: ReturnType<typeof setTimeout>;
        const update = () => {
            const now = new Date();
            setDay(now.toISOString().slice(0, 10));
            clearTimeout(timer);
            const tomorrow = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
            timer = setTimeout(update, tomorrow - now.getTime() + 50);
        };
        update();
        document.addEventListener('visibilitychange', update);
        return () => {
            clearTimeout(timer);
            document.removeEventListener('visibilitychange', update);
        };
    }, []);
    return day;
}
