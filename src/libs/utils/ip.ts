import { NextRequest } from 'next/server';

/**
 * Extract client IP address from Next.js request
 * Handles various proxy headers and edge cases
 */
export function getClientIP(request: NextRequest): string {
  // Check common proxy headers in order of reliability
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const cfConnectingIP = request.headers.get('cf-connecting-ip'); // Cloudflare
  const vercelForwardedFor = request.headers.get('x-vercel-forwarded-for'); // Vercel
  const fastlyClientIP = request.headers.get('fastly-client-ip'); // Fastly
  const trueClientIP = request.headers.get('true-client-ip');

  // Priority order: Cloudflare > Vercel > Fastly > True-Client-IP > Real-IP > X-Forwarded-For
  if (cfConnectingIP) {
    return cfConnectingIP;
  }

  if (vercelForwardedFor) {
    return vercelForwardedFor;
  }

  if (fastlyClientIP) {
    return fastlyClientIP;
  }

  if (trueClientIP) {
    return trueClientIP;
  }

  if (realIP) {
    return realIP;
  }

  if (forwardedFor) {
    // X-Forwarded-For can contain multiple IPs, take the first one
    return forwardedFor.split(',')[0].trim();
  }

  // Fallback to connection remote address
  const remoteAddress = request.headers.get('x-forwarded-host') || 
                       request.headers.get('host') || 
                       '127.0.0.1';

  return remoteAddress;
}

/**
 * Validate if an IP address is valid
 */
export function isValidIP(ip: string): boolean {
  // IPv4 regex
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  
  // IPv6 regex (simplified)
  const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;

  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

/**
 * Check if IP is a private/local IP address
 */
export function isPrivateIP(ip: string): boolean {
  if (!isValidIP(ip)) {
    return false;
  }

  // Private IPv4 ranges
  const privateRanges = [
    /^10\./,                    // 10.0.0.0/8
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
    /^192\.168\./,              // 192.168.0.0/16
    /^127\./,                   // 127.0.0.0/8 (localhost)
    /^169\.254\./,              // 169.254.0.0/16 (link-local)
    /^::1$/,                    // IPv6 localhost
    /^fc00:/,                   // IPv6 unique local
    /^fe80:/                    // IPv6 link-local
  ];

  return privateRanges.some(range => range.test(ip));
}

/**
 * Sanitize IP address for logging
 */
export function sanitizeIP(ip: string): string {
  if (!ip || !isValidIP(ip)) {
    return '0.0.0.0';
  }

  // For privacy, you might want to mask the last octet of IPv4
  if (process.env.NODE_ENV === 'production') {
    const ipParts = ip.split('.');
    if (ipParts.length === 4) {
      // Mask last octet for privacy: 192.168.1.100 -> 192.168.1.xxx
      return `${ipParts.slice(0, 3).join('.')}.xxx`;
    }
  }

  return ip;
}

/**
 * Get geographical information from IP (placeholder for future implementation)
 */
export async function getIPGeolocation(ip: string): Promise<{
  country?: string;
  city?: string;
  region?: string;
  timezone?: string;
} | null> {
  // This would integrate with a geolocation service like MaxMind, IP2Location, etc.
  // For now, return null to avoid external dependencies
  
  if (isPrivateIP(ip)) {
    return {
      country: 'Unknown',
      city: 'Unknown',
      region: 'Unknown',
      timezone: 'UTC'
    };
  }

  // TODO: Implement actual geolocation service integration
  return null;
}