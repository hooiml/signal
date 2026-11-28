import type { AlertTickerInput } from '../types/research-alert';
import { defaultResearchMonitoringRules, type ResearchRecord } from '../types/research';
import { normalizeResearchListingSymbol, researchListingKey } from './listing-identity';
import { personalReviewDate, reviewMonitoringRules } from './review-lifecycle';

type ResearchAlertRequestItem = Pick<AlertTickerInput, 'symbol' | 'market' | 'targetBuyZone' | 'lastReviewedAt'>;
type ResearchAlertRequestRecord = Pick<ResearchRecord, 'symbol' | 'market' | 'lastReviewedAt' | 'acceptedEvidence' | 'monitoringRules' | 'decisionJournal' | 'reviewHistory'>;

export const researchAlertLimit = 50;

export const monitoredAlertRecords = (records: readonly ResearchRecord[]): ResearchRecord[] =>
    [...new Map(records.map((record) => [researchListingKey(record.market, record.symbol), record])).values()]
        .slice(0, researchAlertLimit);

export const buildResearchAlertRequest = (
    items: readonly ResearchAlertRequestItem[],
    records: readonly ResearchAlertRequestRecord[],
): AlertTickerInput[] => {
    const recordsByListing = new Map(records.map((record) => [researchListingKey(record.market, record.symbol), record]));

    return items.map((item) => {
        const record = recordsByListing.get(researchListingKey(item.market, item.symbol));
        return {
            symbol: normalizeResearchListingSymbol(item.symbol),
            market: item.market,
            targetBuyZone: item.targetBuyZone,
            lastReviewedAt: record ? personalReviewDate(record) : null,
            acceptedEvidence: record?.acceptedEvidence ?? [],
            monitoringRules: record ? reviewMonitoringRules(record) : defaultResearchMonitoringRules,
        };
    });
};
