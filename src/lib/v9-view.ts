export function resolveV9View(view: string | null | undefined, ticker: string | null | undefined) {
    switch (view) {
        case 'home': return 'market';
        case 'market':
        case 'portfolio':
        case 'discover':
        case 'research':
        case 'learn': return view;
        default: return ticker?.trim() ? 'research' : 'market';
    }
}
