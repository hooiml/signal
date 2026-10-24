// Shared by the server page (URL parsing) and the client Discover panel.
export const discoverViews = ['trending', 'picker', 'calendar'] as const;
export type DiscoverView = typeof discoverViews[number];
export const parseDiscoverView = (value: unknown): DiscoverView | undefined => discoverViews.find(view => view === value);
