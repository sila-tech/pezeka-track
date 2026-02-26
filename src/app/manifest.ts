import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Pezeka Credit Ltd',
    short_name: 'Pezeka',
    description: 'In-house credit management system',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#166534',
    icons: [
      {
        src: 'https://picsum.photos/seed/pezeka-192/192/192',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: 'https://picsum.photos/seed/pezeka-512/512/512',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
