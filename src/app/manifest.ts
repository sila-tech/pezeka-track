import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Pezeka Credit',
    short_name: 'Pezeka',
    description: 'Affordable Credit, Real Opportunities',
    start_url: '/',
    display: 'standalone',
    background_color: '#F8FAFB',
    theme_color: '#5BA9D0',
    icons: [
      {
        src: '/pezeka_logo_transparent.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/pezeka_logo_transparent.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
