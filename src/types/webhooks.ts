/**
 * Comprehensive webhook system types and interfaces
 * Provides type safety for the webhook infrastructure
 */

// Webhook Event Types
export type WebhookEventType = 
  // Document Events
  | 'document.uploaded'
  | 'document.processing.started'
  | 'document.processing.completed'
  | 'document.processing.failed'
  | 'document.analysis.completed'
  | 'document.deleted'
  
  // Chat Events
  | 'chat.conversation.created'
  | 'chat.message.sent'
  | 'chat.message.received'
  | 'chat.ai.response.generated'
  | 'chat.conversation.archived'
  
  // Analytics Events
  | 'analytics.usage.threshold'
  | 'analytics.cost.alert'
  | 'analytics.performance.degraded'
  | 'analytics.quota.exceeded'
  
  // Compliance Events
  | 'compliance.policy.violation'
  | 'compliance.audit.trigger'
  | 'compliance.regulatory.alert'
  | 'compliance.data.breach.detected'
  
  // System Events
  | 'system.health.alert'
  | 'system.error.critical'
  | 'system.maintenance.scheduled'
  | 'system.maintenance.started'
  | 'system.maintenance.completed'
  | 'system.backup.completed'
  | 'system.backup.failed';

export type WebhookDeliveryStatus = 
  | 'pending'
  | 'delivered'
  | 'failed'
  | 'retrying'
  | 'abandoned';

export type WebhookAuthType = 
  | 'none'
  | 'api_key'
  | 'bearer_token'
  | 'hmac_sha256'
  | 'oauth2';

export type IntegrationType = 
  | 'custom'
  | 'slack'
  | 'microsoft_teams'
  | 'email'
  | 'sms'
  | 'discord'
  | 'webhook';

// Core Webhook Interfaces

export interface WebhookConfig {
  id?: string;
  userId: string;
  name: string;
  description?: string;
  url: string;
  isActive: boolean;
  
  // Event configuration
  eventTypes: WebhookEventType[];
  eventFilters: Record<string, any>;
  
  // Authentication
  authType: WebhookAuthType;
  authConfig: WebhookAuthConfig;
  secretKey?: string;
  
  // Integration
  integrationType: IntegrationType;
  integrationConfig: IntegrationConfig;
  
  // Delivery settings
  timeoutSeconds: number;
  retryCount: number;
  retryBackoffMultiplier: number;
  maxRetryDelaySeconds: number;
  
  // Customization
  payloadTemplate?: Record<string, any>;
  customHeaders: Record<string, string>;
  
  // Rate limiting
  rateLimitPerHour: number;
  rateLimitPerDay: number;
  
  // Metadata
  createdAt?: string;
  updatedAt?: string;
  lastTriggeredAt?: string;
}

export interface WebhookAuthConfig {
  apiKey?: string;
  bearerToken?: string;
  oauth2?: {
    clientId: string;
    clientSecret: string;
    accessToken: string;
    refreshToken?: string;
    tokenExpiresAt?: string;
  };
  customAuth?: Record<string, any>;
}

export interface IntegrationConfig {
  // Slack configuration
  slack?: {
    channel: string;
    username?: string;
    iconEmoji?: string;
    iconUrl?: string;
  };
  
  // Microsoft Teams configuration
  teams?: {
    webhookUrl: string;
    theme?: string;
  };
  
  // Email configuration
  email?: {
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject?: string;
    template?: string;
  };
  
  // SMS configuration
  sms?: {
    to: string[];
    from?: string;
    provider: 'twilio' | 'aws_sns';
    providerConfig: Record<string, any>;
  };
  
  // Discord configuration
  discord?: {
    webhookUrl: string;
    username?: string;
    avatarUrl?: string;
  };
  
  // Custom configuration
  custom?: Record<string, any>;
}

export interface WebhookEvent {
  id?: string;
  eventType: WebhookEventType;
  eventId: string; // Unique identifier for idempotency
  userId?: string;
  resourceId?: string;
  resourceType?: string;
  eventData: Record<string, any>;
  metadata: Record<string, any>;
  createdAt?: string;
  processedAt?: string;
}

export interface WebhookDelivery {
  id?: string;
  webhookId: string;
  eventId: string;
  deliveryStatus: WebhookDeliveryStatus;
  attemptCount: number;
  maxAttempts: number;
  
  // Request/Response data
  requestPayload?: Record<string, any>;
  requestHeaders?: Record<string, string>;
  responseStatusCode?: number;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  
  // Timing
  createdAt?: string;
  firstAttemptAt?: string;
  lastAttemptAt?: string;
  deliveredAt?: string;
  nextRetryAt?: string;
  
  // Error tracking
  errorMessage?: string;
  errorDetails?: Record<string, any>;
}

export interface WebhookDeliveryLog {
  id?: string;
  deliveryId: string;
  attemptNumber: number;
  attemptedAt?: string;
  
  // Request details
  requestUrl: string;
  requestMethod: string;
  requestHeaders: Record<string, string>;
  requestBody?: string;
  
  // Response details
  responseStatusCode?: number;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  responseTimeMs?: number;
  
  // Error information
  errorType?: string;
  errorMessage?: string;
  isSuccess: boolean;
}

export interface WebhookRateLimit {
  id?: string;
  webhookId: string;
  hourBucket: string;
  dayBucket: string;
  hourlyCount: number;
  dailyCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface WebhookSubscription {
  id?: string;
  webhookId: string;
  eventType: WebhookEventType;
  filterConditions: Record<string, any>;
  isActive: boolean;
  createdAt?: string;
}

// Webhook Payload Interfaces

export interface BaseWebhookPayload {
  event: {
    id: string;
    type: WebhookEventType;
    timestamp: string;
    data: Record<string, any>;
  };
  webhook: {
    id: string;
    name: string;
  };
  delivery: {
    id: string;
    attempt: number;
  };
}

export interface DocumentWebhookPayload extends BaseWebhookPayload {
  event: {
    id: string;
    type: WebhookEventType;
    timestamp: string;
    data: {
      documentId: string;
      fileName: string;
      fileSize: number;
      mimeType: string;
      status?: string;
      processingResult?: any;
      error?: string;
    };
  };
}

export interface ChatWebhookPayload extends BaseWebhookPayload {
  event: {
    id: string;
    type: WebhookEventType;
    timestamp: string;
    data: {
      conversationId: string;
      messageId?: string;
      content?: string;
      role?: 'user' | 'assistant';
      metadata?: Record<string, any>;
    };
  };
}

export interface AnalyticsWebhookPayload extends BaseWebhookPayload {
  event: {
    id: string;
    type: WebhookEventType;
    timestamp: string;
    data: {
      metric: string;
      value: number;
      threshold?: number;
      severity: 'low' | 'medium' | 'high' | 'critical';
      details: Record<string, any>;
    };
  };
}

export interface ComplianceWebhookPayload extends BaseWebhookPayload {
  event: {
    id: string;
    type: WebhookEventType;
    timestamp: string;
    data: {
      violationType: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      resourceId?: string;
      resourceType?: string;
      details: Record<string, any>;
      recommendedActions?: string[];
    };
  };
}

export interface SystemWebhookPayload extends BaseWebhookPayload {
  event: {
    id: string;
    type: WebhookEventType;
    timestamp: string;
    data: {
      component: string;
      severity: 'info' | 'warning' | 'error' | 'critical';
      message: string;
      details: Record<string, any>;
      affectedServices?: string[];
    };
  };
}

// API Request/Response Types

export interface CreateWebhookRequest {
  name: string;
  description?: string;
  url: string;
  eventTypes: WebhookEventType[];
  eventFilters?: Record<string, any>;
  authType?: WebhookAuthType;
  authConfig?: WebhookAuthConfig;
  integrationType?: IntegrationType;
  integrationConfig?: IntegrationConfig;
  timeoutSeconds?: number;
  retryCount?: number;
  customHeaders?: Record<string, string>;
  rateLimitPerHour?: number;
  rateLimitPerDay?: number;
  payloadTemplate?: Record<string, any>;
}

export interface UpdateWebhookRequest extends Partial<CreateWebhookRequest> {
  isActive?: boolean;
}

export interface WebhookListResponse {
  webhooks: WebhookConfig[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface WebhookTestRequest {
  eventType: WebhookEventType;
  testData?: Record<string, any>;
}

export interface WebhookTestResponse {
  success: boolean;
  deliveryId: string;
  responseStatusCode?: number;
  responseTime?: number;
  error?: string;
}

export interface WebhookDeliveryListResponse {
  deliveries: WebhookDelivery[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface WebhookAnalytics {
  webhookId: string;
  period: {
    start: string;
    end: string;
  };
  metrics: {
    totalEvents: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    averageResponseTime: number;
    successRate: number;
  };
  eventBreakdown: Record<WebhookEventType, number>;
  statusBreakdown: Record<WebhookDeliveryStatus, number>;
}

// Service Interfaces

export interface WebhookService {
  // Webhook management
  createWebhook(userId: string, config: CreateWebhookRequest): Promise<WebhookConfig>;
  updateWebhook(webhookId: string, config: UpdateWebhookRequest): Promise<WebhookConfig>;
  deleteWebhook(webhookId: string): Promise<void>;
  getWebhook(webhookId: string): Promise<WebhookConfig | null>;
  listWebhooks(userId: string, options?: ListOptions): Promise<WebhookListResponse>;
  
  // Event publishing
  publishEvent(event: WebhookEvent): Promise<void>;
  
  // Testing
  testWebhook(webhookId: string, request: WebhookTestRequest): Promise<WebhookTestResponse>;
  
  // Analytics
  getWebhookAnalytics(webhookId: string, period: { start: string; end: string }): Promise<WebhookAnalytics>;
}

export interface WebhookDeliveryService {
  // Delivery management
  scheduleDelivery(webhookId: string, eventId: string): Promise<WebhookDelivery>;
  deliverWebhook(deliveryId: string): Promise<WebhookDelivery>;
  retryFailedDeliveries(): Promise<void>;
  
  // Delivery tracking
  getDelivery(deliveryId: string): Promise<WebhookDelivery | null>;
  listDeliveries(webhookId: string, options?: ListOptions): Promise<WebhookDeliveryListResponse>;
  getDeliveryLogs(deliveryId: string): Promise<WebhookDeliveryLog[]>;
}

export interface ListOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: Record<string, any>;
}

// Error Types

export class WebhookError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'WebhookError';
  }
}

export class WebhookDeliveryError extends WebhookError {
  constructor(
    message: string,
    public deliveryId: string,
    public attempt: number,
    details?: Record<string, any>
  ) {
    super(message, 'DELIVERY_FAILED', 500, details);
    this.name = 'WebhookDeliveryError';
  }
}

export class WebhookRateLimitError extends WebhookError {
  constructor(
    message: string,
    public webhookId: string,
    public resetTime: Date,
    details?: Record<string, any>
  ) {
    super(message, 'RATE_LIMIT_EXCEEDED', 429, details);
    this.name = 'WebhookRateLimitError';
  }
}

export class WebhookValidationError extends WebhookError {
  constructor(
    message: string,
    public field: string,
    details?: Record<string, any>
  ) {
    super(message, 'VALIDATION_FAILED', 400, details);
    this.name = 'WebhookValidationError';
  }
}

// Utility Types

export type WebhookEventHandler<T extends WebhookEventType> = (
  event: WebhookEvent & { eventType: T }
) => Promise<void>;

export type WebhookMiddleware = (
  payload: BaseWebhookPayload,
  next: () => Promise<void>
) => Promise<void>;

export interface WebhookSecurityConfig {
  enableSignatureValidation: boolean;
  allowedIpRanges?: string[];
  requireHttps: boolean;
  maxPayloadSize: number;
}

export interface WebhookRetryConfig {
  maxAttempts: number;
  initialDelay: number;
  backoffMultiplier: number;
  maxDelay: number;
  jitterEnabled: boolean;
}