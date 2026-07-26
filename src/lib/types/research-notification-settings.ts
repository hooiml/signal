export const researchNotificationModes = ['daily', 'urgent-only'] as const;
export type ResearchNotificationMode = typeof researchNotificationModes[number];

export type ResearchNotificationSettings = {
    readonly enabled: boolean;
    readonly mode: ResearchNotificationMode;
    readonly quietHoursEnabled: boolean;
    readonly quietHoursStartUtc: number;
    readonly quietHoursEndUtc: number;
};

export type ResearchNotificationDeliveryStatus = 'delivered' | 'failed' | 'duplicate';

export type ResearchNotificationDeliveryHistory = {
    readonly digestKey: string;
    readonly itemCount: number;
    readonly status: ResearchNotificationDeliveryStatus;
    readonly detail: string | null;
    readonly createdAt: string;
};

export const defaultResearchNotificationSettings: ResearchNotificationSettings = {
    enabled: true,
    mode: 'daily',
    quietHoursEnabled: false,
    quietHoursStartUtc: 22,
    quietHoursEndUtc: 7,
};

export class ResearchNotificationSettingsError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ResearchNotificationSettingsError';
    }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const hour = (value: unknown, label: string): number => {
    if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > 23) {
        throw new ResearchNotificationSettingsError(`${label} must be a whole UTC hour from 0 to 23.`);
    }
    return value as number;
};

export const parseResearchNotificationSettings = (value: unknown): ResearchNotificationSettings => {
    if (!isRecord(value)) throw new ResearchNotificationSettingsError('Invalid notification settings.');
    if (typeof value.enabled !== 'boolean' || typeof value.quietHoursEnabled !== 'boolean') {
        throw new ResearchNotificationSettingsError('Notification toggles must be boolean.');
    }
    if (value.mode !== 'daily' && value.mode !== 'urgent-only') {
        throw new ResearchNotificationSettingsError('Notification mode must be daily or urgent-only.');
    }
    return {
        enabled: value.enabled,
        mode: value.mode,
        quietHoursEnabled: value.quietHoursEnabled,
        quietHoursStartUtc: hour(value.quietHoursStartUtc, 'Quiet-hours start'),
        quietHoursEndUtc: hour(value.quietHoursEndUtc, 'Quiet-hours end'),
    };
};

export const isResearchNotificationQuietHour = (
    settings: ResearchNotificationSettings,
    date: Date,
): boolean => {
    if (!settings.quietHoursEnabled) return false;
    const hourUtc = date.getUTCHours();
    if (settings.quietHoursStartUtc === settings.quietHoursEndUtc) return true;
    if (settings.quietHoursStartUtc < settings.quietHoursEndUtc) {
        return hourUtc >= settings.quietHoursStartUtc && hourUtc < settings.quietHoursEndUtc;
    }
    return hourUtc >= settings.quietHoursStartUtc || hourUtc < settings.quietHoursEndUtc;
};
