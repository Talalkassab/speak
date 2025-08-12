import { type NextRequest } from 'next/server';

import { updateSession } from '@/libs/supabase/supabase-middleware-client';

export async function middleware(request: NextRequest) {
  // Temporarily disable monitoring middleware for edge runtime compatibility
  // const monitoringResponse = await monitoringMiddleware.create({...});
  
  // Apply Supabase auth middleware
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};