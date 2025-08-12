import { NodeSDK } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { trace, metrics, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import * as promClient from 'prom-client';

// Environment variables
const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || 'hr-rag-platform';
const SERVICE_VERSION = process.env.OTEL_SERVICE_VERSION || '1.0.0';
const JAEGER_ENDPOINT = process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces';
const PROMETHEUS_PORT = parseInt(process.env.PROMETHEUS_PORT || '9464');

export interface TelemetryConfig {
  serviceName: string;
  serviceVersion: string;
  environment: 'development' | 'staging' | 'production';
  jaegerEndpoint?: string;
  prometheusPort?: number;
  enableAutoInstrumentation: boolean;
  enableConsoleExport: boolean;
}

export interface CustomSpanContext {
  organizationId?: string;
  userId?: string;
  requestId?: string;
  conversationId?: string;
  documentId?: string;
  operationType?: string;
  additionalAttributes?: Record<string, string | number | boolean>;
}

class TelemetryManager {
  private sdk?: NodeSDK;
  private tracer = trace.getTracer(SERVICE_NAME);
  private meter = metrics.getMeter(SERVICE_NAME);
  private prometheusExporter?: PrometheusExporter;
  private isInitialized = false;

  constructor(private config: TelemetryConfig) {}

  /**
   * Initialize OpenTelemetry SDK
   */
  initialize(): void {
    if (this.isInitialized) {
      console.warn('Telemetry already initialized');
      return;
    }

    try {
      // Configure resource
      const resource = new Resource({
        [SEMRESATTRS_SERVICE_NAME]: this.config.serviceName,
        [SEMRESATTRS_SERVICE_VERSION]: this.config.serviceVersion,
        'environment': this.config.environment,
      });

      // Configure Prometheus exporter for metrics
      this.prometheusExporter = new PrometheusExporter({
        port: this.config.prometheusPort || PROMETHEUS_PORT,
        endpoint: '/metrics',
      });

      // Configure Jaeger exporter for traces
      const jaegerExporter = new JaegerExporter({
        endpoint: this.config.jaegerEndpoint || JAEGER_ENDPOINT,
      });

      // Configure metric reader
      const metricReader = new PeriodicExportingMetricReader({
        exporter: this.prometheusExporter,
        exportIntervalMillis: 10000, // Export every 10 seconds
      });

      // Configure SDK
      this.sdk = new NodeSDK({
        resource,
        traceExporter: jaegerExporter,
        metricReader,
        instrumentations: this.config.enableAutoInstrumentation 
          ? [getNodeAutoInstrumentations({
              // Disable some instrumentations that might be noisy
              '@opentelemetry/instrumentation-fs': {
                enabled: false,
              },
              '@opentelemetry/instrumentation-dns': {
                enabled: false,
              },
            })]
          : [],
      });

      // Start the SDK
      this.sdk.start();
      this.isInitialized = true;

      console.log('OpenTelemetry initialized successfully');
      
      // Register shutdown handler
      process.on('SIGTERM', () => this.shutdown());
      process.on('SIGINT', () => this.shutdown());
      
    } catch (error) {
      console.error('Failed to initialize OpenTelemetry:', error);
    }
  }

  /**
   * Create a custom span with context
   */
  createSpan(
    name: string,
    context?: CustomSpanContext,
    kind: SpanKind = SpanKind.INTERNAL
  ) {
    const attributes: Record<string, string | number | boolean> = {
      'service.name': this.config.serviceName,
      'service.environment': this.config.environment,
      ...(context?.additionalAttributes || {}),
    };

    // Add context attributes
    if (context) {
      if (context.organizationId) attributes['organization.id'] = context.organizationId;
      if (context.userId) attributes['user.id'] = context.userId;
      if (context.requestId) attributes['request.id'] = context.requestId;
      if (context.conversationId) attributes['conversation.id'] = context.conversationId;
      if (context.documentId) attributes['document.id'] = context.documentId;
      if (context.operationType) attributes['operation.type'] = context.operationType;
    }

    return this.tracer.startSpan(name, {
      kind,
      attributes,
    });
  }

  /**
   * Wrap an async operation with tracing
   */
  async traceOperation<T>(
    operationName: string,
    operation: () => Promise<T>,
    context?: CustomSpanContext
  ): Promise<T> {
    const span = this.createSpan(operationName, context);
    const startTime = Date.now();

    try {
      const result = await operation();
      
      const duration = Date.now() - startTime;
      span.setAttributes({
        'operation.duration_ms': duration,
        'operation.success': true,
      });
      span.setStatus({ code: SpanStatusCode.OK });
      
      return result;
    } catch (error) {
      span.setAttributes({
        'operation.success': false,
        'operation.duration_ms': Date.now() - startTime,
      });
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Create spans for OpenRouter API calls
   */
  createOpenRouterSpan(
    model: string,
    operation: string,
    context?: CustomSpanContext
  ) {
    return this.createSpan(`OpenRouter API: ${operation}`, {
      ...context,
      operationType: operation,
      additionalAttributes: {
        'openrouter.model': model,
        'openrouter.operation': operation,
        'ai.model': model,
        'ai.provider': 'openrouter',
        ...(context?.additionalAttributes || {}),
      },
    }, SpanKind.CLIENT);
  }

  /**
   * Trace OpenRouter API call
   */
  async traceOpenRouterCall<T>(
    model: string,
    operation: string,
    apiCall: () => Promise<T>,
    context?: CustomSpanContext
  ): Promise<T> {
    const span = this.createOpenRouterSpan(model, operation, context);
    const startTime = Date.now();

    try {
      const result = await apiCall();
      
      const duration = Date.now() - startTime;
      span.setAttributes({
        'operation.duration_ms': duration,
        'openrouter.success': true,
      });
      span.setStatus({ code: SpanStatusCode.OK });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      span.setAttributes({
        'operation.duration_ms': duration,
        'openrouter.success': false,
      });
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'OpenRouter API error',
      });
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Create spans for database operations
   */
  createDatabaseSpan(
    operation: string,
    table: string,
    context?: CustomSpanContext
  ) {
    return this.createSpan(`DB: ${operation} ${table}`, {
      ...context,
      operationType: operation,
      additionalAttributes: {
        'db.operation': operation,
        'db.table': table,
        'db.type': 'postgresql',
        'db.name': 'supabase',
        ...(context?.additionalAttributes || {}),
      },
    }, SpanKind.CLIENT);
  }

  /**
   * Trace database operation
   */
  async traceDatabaseOperation<T>(
    operation: string,
    table: string,
    dbCall: () => Promise<T>,
    context?: CustomSpanContext
  ): Promise<T> {
    const span = this.createDatabaseSpan(operation, table, context);
    const startTime = Date.now();

    try {
      const result = await dbCall();
      
      const duration = Date.now() - startTime;
      span.setAttributes({
        'operation.duration_ms': duration,
        'db.success': true,
      });
      span.setStatus({ code: SpanStatusCode.OK });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      span.setAttributes({
        'operation.duration_ms': duration,
        'db.success': false,
      });
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Database error',
      });
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Create spans for document processing operations
   */
  createDocumentProcessingSpan(
    operation: string,
    documentType: string,
    context?: CustomSpanContext
  ) {
    return this.createSpan(`Document: ${operation}`, {
      ...context,
      operationType: operation,
      additionalAttributes: {
        'document.operation': operation,
        'document.type': documentType,
        ...(context?.additionalAttributes || {}),
      },
    });
  }

  /**
   * Trace document processing operation
   */
  async traceDocumentProcessing<T>(
    operation: string,
    documentType: string,
    processingCall: () => Promise<T>,
    context?: CustomSpanContext
  ): Promise<T> {
    const span = this.createDocumentProcessingSpan(operation, documentType, context);
    const startTime = Date.now();

    try {
      const result = await processingCall();
      
      const duration = Date.now() - startTime;
      span.setAttributes({
        'operation.duration_ms': duration,
        'document.processing.success': true,
      });
      span.setStatus({ code: SpanStatusCode.OK });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      span.setAttributes({
        'operation.duration_ms': duration,
        'document.processing.success': false,
      });
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Document processing error',
      });
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Add custom attributes to current span
   */
  addAttributes(attributes: Record<string, string | number | boolean>): void {
    const currentSpan = trace.getActiveSpan();
    if (currentSpan) {
      currentSpan.setAttributes(attributes);
    }
  }

  /**
   * Record an exception in current span
   */
  recordException(error: Error): void {
    const currentSpan = trace.getActiveSpan();
    if (currentSpan) {
      currentSpan.recordException(error);
      currentSpan.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
    }
  }

  /**
   * Create custom metrics
   */
  createCounter(name: string, description: string, labelNames?: string[]) {
    return this.meter.createCounter(name, {
      description,
    });
  }

  createHistogram(name: string, description: string, labelNames?: string[]) {
    return this.meter.createHistogram(name, {
      description,
    });
  }

  createGauge(name: string, description: string) {
    return this.meter.createObservableGauge(name, {
      description,
    });
  }

  /**
   * Get current trace context
   */
  getTraceContext(): {
    traceId?: string;
    spanId?: string;
  } {
    const currentSpan = trace.getActiveSpan();
    if (currentSpan) {
      const spanContext = currentSpan.spanContext();
      return {
        traceId: spanContext.traceId,
        spanId: spanContext.spanId,
      };
    }
    return {};
  }

  /**
   * Create a child span from current context
   */
  createChildSpan(name: string, attributes?: Record<string, string | number | boolean>) {
    return this.tracer.startSpan(name, {
      attributes,
    });
  }

  /**
   * Get metrics endpoint
   */
  getMetricsEndpoint(): string {
    return `http://localhost:${this.config.prometheusPort}/metrics`;
  }

  /**
   * Health check for telemetry
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    details: {
      initialized: boolean;
      prometheusExporter: boolean;
      tracerAvailable: boolean;
      meterAvailable: boolean;
    };
  }> {
    const details = {
      initialized: this.isInitialized,
      prometheusExporter: !!this.prometheusExporter,
      tracerAvailable: !!this.tracer,
      meterAvailable: !!this.meter,
    };

    const healthy = Object.values(details).every(Boolean);

    return {
      status: healthy ? 'healthy' : 'unhealthy',
      details,
    };
  }

  /**
   * Shutdown telemetry
   */
  async shutdown(): Promise<void> {
    if (this.sdk) {
      try {
        await this.sdk.shutdown();
        console.log('OpenTelemetry SDK shut down successfully');
      } catch (error) {
        console.error('Error shutting down OpenTelemetry SDK:', error);
      }
    }
  }

  /**
   * Get tracer instance
   */
  getTracer() {
    return this.tracer;
  }

  /**
   * Get meter instance
   */
  getMeter() {
    return this.meter;
  }
}

// Default configuration
const defaultConfig: TelemetryConfig = {
  serviceName: SERVICE_NAME,
  serviceVersion: SERVICE_VERSION,
  environment: (process.env.NODE_ENV as 'development' | 'staging' | 'production') || 'development',
  jaegerEndpoint: JAEGER_ENDPOINT,
  prometheusPort: PROMETHEUS_PORT,
  enableAutoInstrumentation: process.env.NODE_ENV !== 'production', // Disable in production for performance
  enableConsoleExport: process.env.NODE_ENV === 'development',
};

// Create singleton instance
export const telemetryManager = new TelemetryManager(defaultConfig);

// Initialize telemetry if not in test environment
if (process.env.NODE_ENV !== 'test') {
  telemetryManager.initialize();
}

// Export convenience functions
export const createSpan = telemetryManager.createSpan.bind(telemetryManager);
export const traceOperation = telemetryManager.traceOperation.bind(telemetryManager);
export const traceOpenRouterCall = telemetryManager.traceOpenRouterCall.bind(telemetryManager);
export const traceDatabaseOperation = telemetryManager.traceDatabaseOperation.bind(telemetryManager);
export const traceDocumentProcessing = telemetryManager.traceDocumentProcessing.bind(telemetryManager);
export const addAttributes = telemetryManager.addAttributes.bind(telemetryManager);
export const recordException = telemetryManager.recordException.bind(telemetryManager);
export const getTraceContext = telemetryManager.getTraceContext.bind(telemetryManager);

export default telemetryManager;