/**
 * Webhook Security Service
 * Handles authentication, authorization, and security measures for webhooks
 */

import crypto from 'crypto';
import { z } from 'zod';
import type { 
  WebhookAuthType, 
  WebhookAuthConfig,
  WebhookSecurityConfig
} from '@/types/webhooks';
import { WebhookError, WebhookValidationError } from '@/types/webhooks';

interface SecurityValidationResult {
  isValid: boolean;
  error?: string;
  details?: Record<string, any>;
}

interface SignatureValidationOptions {
  payload: string;
  signature: string;
  secret: string;
  algorithm?: 'sha256' | 'sha1';
  timestampTolerance?: number; // seconds
}

const ipRangeSchema = z.string().regex(
  /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(?:\/(?:[0-9]|[1-2][0-9]|3[0-2]))?$/,
  'Invalid IP range format'
);

export class WebhookSecurityService {
  private securityConfig: WebhookSecurityConfig;

  constructor(securityConfig: WebhookSecurityConfig = {
    enableSignatureValidation: true,
    requireHttps: true,
    maxPayloadSize: 10 * 1024 * 1024 // 10MB
  }) {
    this.securityConfig = securityConfig;
  }

  /**
   * Validate webhook URL security requirements
   */
  validateWebhookUrl(url: string): SecurityValidationResult {
    try {
      const parsedUrl = new URL(url);

      // Check HTTPS requirement
      if (this.securityConfig.requireHttps && parsedUrl.protocol !== 'https:') {
        return {
          isValid: false,
          error: 'HTTPS is required for webhook URLs',
          details: { protocol: parsedUrl.protocol }
        };
      }

      // Check for common security issues
      const hostname = parsedUrl.hostname.toLowerCase();
      
      // Prevent localhost/private IP targeting (basic check)
      const privateRanges = [
        'localhost',
        '127.0.0.1',
        '0.0.0.0',
        '10.',
        '192.168.',
        '172.16.',
        '172.17.',
        '172.18.',
        '172.19.',
        '172.20.',
        '172.21.',
        '172.22.',
        '172.23.',
        '172.24.',
        '172.25.',
        '172.26.',
        '172.27.',
        '172.28.',
        '172.29.',
        '172.30.',
        '172.31.'
      ];

      if (privateRanges.some(range => hostname.includes(range))) {
        return {
          isValid: false,
          error: 'Webhooks cannot target private IP addresses or localhost',
          details: { hostname }
        };
      }

      // Check for suspicious TLDs or domains
      const suspiciousTlds = ['.tk', '.ml', '.ga', '.cf'];
      if (suspiciousTlds.some(tld => hostname.endsWith(tld))) {
        return {
          isValid: false,
          error: 'Suspicious domain detected',
          details: { hostname }
        };
      }

      // Validate port
      const port = parsedUrl.port;
      if (port && parseInt(port) < 1 || parseInt(port) > 65535) {
        return {
          isValid: false,
          error: 'Invalid port number',
          details: { port }
        };
      }

      return { isValid: true };

    } catch (error) {
      return {
        isValid: false,
        error: 'Invalid URL format',
        details: { originalError: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  /**
   * Validate IP address against allowed ranges
   */
  validateIpAddress(ipAddress: string, allowedRanges?: string[]): SecurityValidationResult {
    if (!allowedRanges || allowedRanges.length === 0) {
      return { isValid: true };
    }

    try {
      // Validate IP ranges format
      for (const range of allowedRanges) {
        ipRangeSchema.parse(range);
      }

      // Simple IP validation - in production, use a proper CIDR matching library
      const ip = ipAddress.split('.').map(Number);
      if (ip.length !== 4 || ip.some(octet => octet < 0 || octet > 255)) {
        return {
          isValid: false,
          error: 'Invalid IP address format',
          details: { ipAddress }
        };
      }

      // Check if IP is in any allowed range
      for (const range of allowedRanges) {
        if (range.includes('/')) {
          // CIDR notation - simplified check
          const [networkIp, prefixLength] = range.split('/');
          if (this.isIpInCidr(ipAddress, networkIp, parseInt(prefixLength))) {
            return { isValid: true };
          }
        } else {
          // Exact IP match
          if (ipAddress === range) {
            return { isValid: true };
          }
        }
      }

      return {
        isValid: false,
        error: 'IP address not in allowed ranges',
        details: { ipAddress, allowedRanges }
      };

    } catch (error) {
      return {
        isValid: false,
        error: 'Invalid IP range configuration',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  /**
   * Generate HMAC signature for webhook payload
   */
  generateSignature(payload: string, secret: string, algorithm: 'sha256' | 'sha1' = 'sha256'): string {
    return crypto
      .createHmac(algorithm, secret)
      .update(payload)
      .digest('hex');
  }

  /**
   * Validate HMAC signature
   */
  validateSignature(options: SignatureValidationOptions): SecurityValidationResult {
    if (!this.securityConfig.enableSignatureValidation) {
      return { isValid: true };
    }

    const { payload, signature, secret, algorithm = 'sha256', timestampTolerance = 300 } = options;

    try {
      // Extract signature from header (format: sha256=signature)
      let extractedSignature = signature;
      if (signature.includes('=')) {
        const parts = signature.split('=');
        if (parts.length !== 2) {
          return {
            isValid: false,
            error: 'Invalid signature format',
            details: { signature }
          };
        }
        extractedSignature = parts[1];
      }

      // Generate expected signature
      const expectedSignature = this.generateSignature(payload, secret, algorithm);

      // Use timing-safe comparison
      const isValid = crypto.timingSafeEqual(
        Buffer.from(extractedSignature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );

      if (!isValid) {
        return {
          isValid: false,
          error: 'Signature validation failed',
          details: { algorithm }
        };
      }

      // Optional timestamp validation (if webhook includes timestamp)
      if (timestampTolerance > 0) {
        const result = this.validateTimestamp(payload, timestampTolerance);
        if (!result.isValid) {
          return result;
        }
      }

      return { isValid: true };

    } catch (error) {
      return {
        isValid: false,
        error: 'Signature validation error',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  /**
   * Validate webhook authentication configuration
   */
  validateAuthConfig(authType: WebhookAuthType, authConfig: WebhookAuthConfig): SecurityValidationResult {
    switch (authType) {
      case 'none':
        return { isValid: true };

      case 'api_key':
        if (!authConfig.apiKey || authConfig.apiKey.length < 8) {
          return {
            isValid: false,
            error: 'API key must be at least 8 characters long',
            details: { authType }
          };
        }
        return { isValid: true };

      case 'bearer_token':
        if (!authConfig.bearerToken || authConfig.bearerToken.length < 16) {
          return {
            isValid: false,
            error: 'Bearer token must be at least 16 characters long',
            details: { authType }
          };
        }
        return { isValid: true };

      case 'hmac_sha256':
        // Secret key validation is handled during webhook creation
        return { isValid: true };

      case 'oauth2':
        if (!authConfig.oauth2) {
          return {
            isValid: false,
            error: 'OAuth2 configuration is required',
            details: { authType }
          };
        }

        const { clientId, clientSecret, accessToken } = authConfig.oauth2;
        if (!clientId || !clientSecret || !accessToken) {
          return {
            isValid: false,
            error: 'OAuth2 configuration must include clientId, clientSecret, and accessToken',
            details: { authType, provided: Object.keys(authConfig.oauth2) }
          };
        }

        return { isValid: true };

      default:
        return {
          isValid: false,
          error: 'Unsupported authentication type',
          details: { authType }
        };
    }
  }

  /**
   * Validate payload size
   */
  validatePayloadSize(payload: string): SecurityValidationResult {
    const payloadSize = Buffer.byteLength(payload, 'utf8');
    
    if (payloadSize > this.securityConfig.maxPayloadSize) {
      return {
        isValid: false,
        error: 'Payload exceeds maximum allowed size',
        details: {
          size: payloadSize,
          maxSize: this.securityConfig.maxPayloadSize
        }
      };
    }

    return { isValid: true };
  }

  /**
   * Sanitize webhook payload to prevent injection attacks
   */
  sanitizePayload(payload: Record<string, any>): Record<string, any> {
    return this.deepSanitize(payload);
  }

  /**
   * Generate secure webhook secret
   */
  generateWebhookSecret(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Validate webhook headers for security
   */
  validateHeaders(headers: Record<string, string>): SecurityValidationResult {
    // Check for dangerous headers
    const dangerousHeaders = [
      'authorization',
      'cookie',
      'x-forwarded-for',
      'x-real-ip',
      'host'
    ];

    const providedHeaders = Object.keys(headers).map(h => h.toLowerCase());
    const foundDangerous = providedHeaders.filter(h => dangerousHeaders.includes(h));

    if (foundDangerous.length > 0) {
      return {
        isValid: false,
        error: 'Custom headers cannot override security-sensitive headers',
        details: { dangerousHeaders: foundDangerous }
      };
    }

    // Validate header values
    for (const [key, value] of Object.entries(headers)) {
      if (typeof value !== 'string' || value.length > 1000) {
        return {
          isValid: false,
          error: `Header ${key} has invalid value or exceeds length limit`,
          details: { header: key, valueLength: value?.length }
        };
      }

      // Check for injection attempts
      if (this.containsSuspiciousPatterns(value)) {
        return {
          isValid: false,
          error: `Header ${key} contains suspicious patterns`,
          details: { header: key }
        };
      }
    }

    return { isValid: true };
  }

  /**
   * Rate limiting validation
   */
  validateRateLimits(perHour: number, perDay: number): SecurityValidationResult {
    const MAX_HOURLY = 10000;
    const MAX_DAILY = 100000;

    if (perHour <= 0 || perHour > MAX_HOURLY) {
      return {
        isValid: false,
        error: `Hourly rate limit must be between 1 and ${MAX_HOURLY}`,
        details: { perHour, maxHourly: MAX_HOURLY }
      };
    }

    if (perDay <= 0 || perDay > MAX_DAILY) {
      return {
        isValid: false,
        error: `Daily rate limit must be between 1 and ${MAX_DAILY}`,
        details: { perDay, maxDaily: MAX_DAILY }
      };
    }

    if (perDay < perHour) {
      return {
        isValid: false,
        error: 'Daily rate limit cannot be less than hourly rate limit',
        details: { perHour, perDay }
      };
    }

    return { isValid: true };
  }

  // Private Methods

  private isIpInCidr(ip: string, networkIp: string, prefixLength: number): boolean {
    // Simplified CIDR matching - in production, use a proper IP library
    const ipParts = ip.split('.').map(Number);
    const networkParts = networkIp.split('.').map(Number);

    const mask = -1 << (32 - prefixLength);
    const ipNum = (ipParts[0] << 24) + (ipParts[1] << 16) + (ipParts[2] << 8) + ipParts[3];
    const networkNum = (networkParts[0] << 24) + (networkParts[1] << 16) + (networkParts[2] << 8) + networkParts[3];

    return (ipNum & mask) === (networkNum & mask);
  }

  private validateTimestamp(payload: string, toleranceSeconds: number): SecurityValidationResult {
    try {
      const parsedPayload = JSON.parse(payload);
      const timestamp = parsedPayload.webhook?.timestamp || parsedPayload.timestamp;

      if (!timestamp) {
        return { isValid: true }; // No timestamp to validate
      }

      const webhookTime = new Date(timestamp).getTime();
      const currentTime = Date.now();
      const timeDiff = Math.abs(currentTime - webhookTime) / 1000;

      if (timeDiff > toleranceSeconds) {
        return {
          isValid: false,
          error: 'Webhook timestamp is outside tolerance window',
          details: {
            timestamp,
            timeDifference: timeDiff,
            tolerance: toleranceSeconds
          }
        };
      }

      return { isValid: true };

    } catch (error) {
      // If we can't parse timestamp, just skip validation
      return { isValid: true };
    }
  }

  private deepSanitize(obj: any, depth: number = 0): any {
    const MAX_DEPTH = 10;

    if (depth > MAX_DEPTH) {
      return '[Max depth exceeded]';
    }

    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      return this.sanitizeString(obj);
    }

    if (typeof obj === 'number' || typeof obj === 'boolean') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.deepSanitize(item, depth + 1));
    }

    if (typeof obj === 'object') {
      const sanitized: Record<string, any> = {};
      for (const [key, value] of Object.entries(obj)) {
        const sanitizedKey = this.sanitizeString(key);
        sanitized[sanitizedKey] = this.deepSanitize(value, depth + 1);
      }
      return sanitized;
    }

    return String(obj);
  }

  private sanitizeString(str: string): string {
    // Remove potentially dangerous characters and patterns
    return str
      .replace(/[<>]/g, '') // Remove angle brackets
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/data:/gi, '') // Remove data: protocol
      .replace(/vbscript:/gi, '') // Remove vbscript: protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .substring(0, 1000); // Limit length
  }

  private containsSuspiciousPatterns(value: string): boolean {
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /data:/i,
      /vbscript:/i,
      /on\w+\s*=/i,
      /\x00/,
      /\xff/,
      /eval\s*\(/i,
      /function\s*\(/i
    ];

    return suspiciousPatterns.some(pattern => pattern.test(value));
  }
}

export default WebhookSecurityService;