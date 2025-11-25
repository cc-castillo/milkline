/**
 * Shared route segment configuration for API routes
 * 
 * This ensures all API routes that use dynamic features (like headers)
 * are properly configured to avoid static rendering errors.
 * 
 * Usage in route files:
 *   export { dynamic } from '@/lib/route-config';
 */
export const dynamic = 'force-dynamic';

