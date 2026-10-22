import type { AlertTickerInput } from '../types/research-alert';
import { defaultResearchMonitoringRules, type ResearchRecord } from '../types/research';
import { personalReviewDate, reviewMonitoringRules } from './review-lifecycle';

type ResearchAlertRequestItem = Pick<AlertTickerInput, 'symbol' | 'market' | 'targetBuyZone' | 'lastReviewedAt'>;
type ResearchAlertRequestRecord = Pick<ResearchRecord, 'symbol' | 'lastReviewedAt' | 'acceptedEvidence' | 'monitoringRules' | 'decisionJournal' | 'reviewHistory'>;

export const buildResearchAlertRequest = (
    items: readonly ResearchAlertRequestItem[],
    records: readonly ResearchAlertRequestRecord[],
): AlertTickerInput[] => {
    const recordsBySymbol = new Map(records.map((record) => [record.symbol, record]));

    return items.map((item) => {
        const record = recordsBySymbol.get(item.symbol);
        return {
            symbol: item.symbol,
            market: item.market,
            targetBuyZone: item.targetBuyZone,
            lastReviewedAt: record ? personalReviewDate(record) : null,
            acceptedEvidence: record?.acceptedEvidence ?? [],
            monitoringRules: record ? reviewMonitoringRules(record) : defaultResearchMonitoringRules,
        };
    });
};
