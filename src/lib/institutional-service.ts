
import { sql } from './db';

export interface InstitutionalDataEntry {
    indicator_name: string;
    value: number;
    report_date: string;
}

export async function getLatestInstitutionalData(): Promise<InstitutionalDataEntry[]> {
    try {
        // Fetch the most recent entry for each indicator
        const result = await sql`
            SELECT DISTINCT ON (indicator_name)
                indicator_name,
                value,
                report_date::text as report_date
            FROM institutional_data
            ORDER BY indicator_name, report_date DESC
        `;

        return result.map(row => ({
            indicator_name: row.indicator_name,
            value: Number(row.value),
            report_date: row.report_date
        }));
    } catch (error) {
        console.error('Error fetching institutional data:', error);
        return [];
    }
}

export async function updateInstitutionalIndicator(
    name: string,
    value: number,
    date: string
): Promise<boolean> {
    try {
        await sql`
            INSERT INTO institutional_data (indicator_name, value, report_date)
            VALUES (${name}, ${value}, ${date})
            ON CONFLICT (indicator_name, report_date)
            DO UPDATE SET value = EXCLUDED.value
        `;
        return true;
    } catch (error) {
        console.error('Error updating institutional indicator:', error);
        return false;
    }
}
