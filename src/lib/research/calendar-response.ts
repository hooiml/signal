import {
    researchCalendarEventTypes,
    researchCalendarFreshness,
    researchCalendarRanges,
    researchMacroCategories,
    researchMacroSources,
    type ResearchCalendarEvent,
    type ResearchCalendarResponse,
    type ResearchMacroEvent,
} from '../types/research-calendar';
import { isResearchCalendarDate, ResearchCalendarInputError } from './calendar-input';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

const parseEvent = (value: unknown): ResearchCalendarEvent => {
    if (!isRecord(value)) throw new ResearchCalendarInputError('Invalid research calendar event.');
    if (typeof value.id !== 'string' || value.id.length === 0 || value.id.length > 120) throw new ResearchCalendarInputError('Invalid calendar event id.');
    if (typeof value.symbol !== 'string' || !/^[A-Z0-9.-]{1,15}$/.test(value.symbol)) throw new ResearchCalendarInputError('Invalid calendar event symbol.');
    if (value.market !== 'US' && value.market !== 'MY') throw new ResearchCalendarInputError('Invalid calendar event market.');
    if (typeof value.type !== 'string' || !researchCalendarEventTypes.includes(value.type as ResearchCalendarEvent['type'])) throw new ResearchCalendarInputError('Invalid calendar event type.');
    if (typeof value.title !== 'string' || value.title.length === 0 || value.title.length > 160) throw new ResearchCalendarInputError('Invalid calendar event title.');
    if (typeof value.detail !== 'string' || value.detail.length > 500) throw new ResearchCalendarInputError('Invalid calendar event detail.');
    if (value.source !== 'Research journal' && value.source !== 'Nasdaq earnings calendar') throw new ResearchCalendarInputError('Invalid calendar event source.');
    if (typeof value.sourceDate !== 'string' || !isResearchCalendarDate(value.sourceDate)) throw new ResearchCalendarInputError('Invalid calendar event source date.');
    if (typeof value.displayDate !== 'string' || !isResearchCalendarDate(value.displayDate)) throw new ResearchCalendarInputError('Invalid calendar event display date.');
    if (value.timezone !== 'UTC') throw new ResearchCalendarInputError('Invalid calendar event timezone.');
    if (typeof value.freshness !== 'string' || !researchCalendarFreshness.includes(value.freshness as ResearchCalendarEvent['freshness'])) throw new ResearchCalendarInputError('Invalid calendar event freshness.');
    if (value.urgency !== 'action' && value.urgency !== 'upcoming') throw new ResearchCalendarInputError('Invalid calendar event urgency.');
    if (typeof value.targetHref !== 'string' || !/^\/research\?ticker=[A-Z0-9.%+-]+&tab=(overview&review=edit|events)$/.test(value.targetHref)) throw new ResearchCalendarInputError('Invalid calendar event destination.');
    return value as ResearchCalendarEvent;
};

const parseMacroEvent = (value: unknown): ResearchMacroEvent => {
    if (!isRecord(value)) throw new ResearchCalendarInputError('Invalid macro calendar event.');
    if (typeof value.id !== 'string' || value.id.length === 0 || value.id.length > 160) throw new ResearchCalendarInputError('Invalid macro event id.');
    if (value.market !== 'US' && value.market !== 'MY') throw new ResearchCalendarInputError('Invalid macro event market.');
    if (typeof value.category !== 'string' || !researchMacroCategories.includes(value.category as ResearchMacroEvent['category'])) throw new ResearchCalendarInputError('Invalid macro event category.');
    if (typeof value.title !== 'string' || value.title.length === 0 || value.title.length > 200) throw new ResearchCalendarInputError('Invalid macro event title.');
    if (typeof value.date !== 'string' || !isResearchCalendarDate(value.date)) throw new ResearchCalendarInputError('Invalid macro event date.');
    if (value.timeLabel !== null && (typeof value.timeLabel !== 'string' || value.timeLabel.length > 40)) throw new ResearchCalendarInputError('Invalid macro event release time.');
    if (typeof value.source !== 'string' || !researchMacroSources.includes(value.source as ResearchMacroEvent['source'])) throw new ResearchCalendarInputError('Invalid macro event source.');
    if (typeof value.sourceUrl !== 'string' || !/^https:\/\/(www\.federalreserve\.gov|www\.bls\.gov|open\.dosm\.gov\.my|www\.bnm\.gov\.my)\//.test(value.sourceUrl)) throw new ResearchCalendarInputError('Invalid macro event source URL.');
    if (typeof value.detail !== 'string' || value.detail.length > 500) throw new ResearchCalendarInputError('Invalid macro event detail.');
    if (!Array.isArray(value.trackedSymbols) || value.trackedSymbols.length > 50 || value.trackedSymbols.some((symbol) => typeof symbol !== 'string' || !/^[A-Z0-9.-]{1,15}$/.test(symbol))) throw new ResearchCalendarInputError('Invalid macro event tracked symbols.');
    return value as ResearchMacroEvent;
};

export const parseResearchCalendarResponse = (value: unknown): ResearchCalendarResponse => {
    if (!isRecord(value) || value.success !== true || !isRecord(value.data)) throw new ResearchCalendarInputError('Invalid research calendar response.');
    const data = value.data;
    if (typeof data.generatedAt !== 'string' || Number.isNaN(Date.parse(data.generatedAt))) throw new ResearchCalendarInputError('Invalid calendar generated timestamp.');
    if (typeof data.rangeDays !== 'number' || !researchCalendarRanges.includes(data.rangeDays as ResearchCalendarResponse['rangeDays'])) throw new ResearchCalendarInputError('Invalid calendar range.');
    if (data.timezone !== 'UTC') throw new ResearchCalendarInputError('Invalid calendar timezone.');
    if (!Array.isArray(data.events) || data.events.length > 250) throw new ResearchCalendarInputError('Invalid calendar event collection.');
    if (!Array.isArray(data.macroEvents) || data.macroEvents.length > 250) throw new ResearchCalendarInputError('Invalid macro event collection.');
    if (!Array.isArray(data.warnings) || data.warnings.some((warning) => typeof warning !== 'string')) throw new ResearchCalendarInputError('Invalid calendar warnings.');
    return {
        generatedAt: new Date(data.generatedAt).toISOString(),
        rangeDays: data.rangeDays as ResearchCalendarResponse['rangeDays'],
        timezone: 'UTC',
        events: data.events.map(parseEvent),
        macroEvents: data.macroEvents.map(parseMacroEvent),
        warnings: data.warnings,
    };
};
