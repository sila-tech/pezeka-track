import { MetadataRoute } from 'next'

// Manifest is disabled in development environment to prevent CORS/Auth redirect issues
export default function manifest(): MetadataRoute.Manifest {
  return {} as MetadataRoute.Manifest;
}
