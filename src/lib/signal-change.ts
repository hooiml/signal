export type DriverContribution = {
    readonly key: string;
    readonly name: string;
    readonly contribution: number;
};

export type DriverChange = {
    readonly key: string;
    readonly name: string;
    readonly current_contribution: number;
    readonly previous_contribution: number;
    readonly delta: number;
};

const isDriverContribution = (value: unknown): value is DriverContribution =>
    typeof value === 'object'
    && value !== null
    && typeof Reflect.get(value, 'key') === 'string'
    && typeof Reflect.get(value, 'name') === 'string'
    && typeof Reflect.get(value, 'contribution') === 'number'
    && Number.isFinite(Reflect.get(value, 'contribution'));

export const parseStoredDriverContributions = (value: unknown): DriverContribution[] | null =>
    Array.isArray(value) ? value.filter(isDriverContribution) : null;

export const parseStoredComponentContributions = (value: unknown): DriverContribution[] | null => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;

    const contributions: DriverContribution[] = [];
    for (const [key, component] of Object.entries(value)) {
        if (typeof component !== 'object' || component === null) continue;
        const name = Reflect.get(component, 'display_name');
        const score = Reflect.get(component, 'score');
        const weight = Reflect.get(component, 'weight');
        if (typeof name !== 'string' || typeof score !== 'number' || typeof weight !== 'number') continue;
        if (!Number.isFinite(score) || !Number.isFinite(weight)) continue;
        contributions.push({ key, name, contribution: score * weight });
    }

    return contributions;
};

export const calculateDriverChanges = (
    current: readonly DriverContribution[],
    previous: readonly DriverContribution[],
): DriverChange[] => {
    const currentByKey = new Map(current.map((driver) => [driver.key, driver]));
    const previousByKey = new Map(previous.map((driver) => [driver.key, driver]));
    const keys = new Set([...currentByKey.keys(), ...previousByKey.keys()]);

    return [...keys]
        .map((key) => {
            const currentDriver = currentByKey.get(key);
            const previousDriver = previousByKey.get(key);
            const currentContribution = currentDriver?.contribution ?? 0;
            const previousContribution = previousDriver?.contribution ?? 0;

            return {
                key,
                name: currentDriver?.name ?? previousDriver?.name ?? key,
                current_contribution: currentContribution,
                previous_contribution: previousContribution,
                delta: currentContribution - previousContribution,
            };
        })
        .filter((change) => change.delta !== 0)
        .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta) || left.name.localeCompare(right.name));
};
