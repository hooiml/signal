import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
    return {
        id: '/',
        name: 'Signal Market Research',
        short_name: 'Signal',
        description: 'Privacy-bounded market conditions and investment research workspace.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#071019',
        theme_color: '#0f766e',
        categories: ['finance', 'productivity'],
        icons: [
            {
                src: '/icons/signal-192.svg',
                sizes: '192x192',
                type: 'image/svg+xml',
                purpose: 'any',
            },
            {
                src: '/icons/signal-512.svg',
                sizes: '512x512',
                type: 'image/svg+xml',
                purpose: 'maskable',
            },
        ],
    };
}
