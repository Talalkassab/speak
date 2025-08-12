import winston from 'winston';
import { telemetryManager } from '../monitoring/telemetry';

export type LogLevel = 'error' | 'warn' | 'info' | 'http' | 'verbose' | 'debug' | 'silly';

export interface LogContext {
  organizationId?: string;
  userId?: string;
  requestId?: string;
  conversationId?: string;
  documentId?: string;
  sessionId?: string;
  userAgent?: string;
  ip?: string;
  method?: string;
  route?: string;
  traceId?: string;
  spanId?: string;
  [key: string]: any;
}

export interface LogMetadata {
  service: string;
  component: string;
  operation?: string;
  duration?: number;
  statusCode?: number;
  error?: Error;
  additionalData?: Record<string, any>;
}

class StructuredLogger {
  private logger: winston.Logger;
  private defaultContext: LogContext = {};

  constructor() {
    // Configure Winston logger
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          // Add trace context if available
          const traceContext = telemetryManager.getTraceContext();
          if (traceContext.traceId) {
            meta.traceId = traceContext.traceId;
          }
          if (traceContext.spanId) {
            meta.spanId = traceContext.spanId;
          }

          return JSON.stringify({
            timestamp,
            level,
            message,
            ...meta,
          });
        })
      ),
      defaultMeta: {
        service: 'hr-rag-platform',
        environment: process.env.NODE_ENV || 'development',
      },
      transports: [
        // Console transport for development
        new winston.transports.Console({
          format: process.env.NODE_ENV === 'development'
            ? winston.format.combine(
                winston.format.colorize(),
                winston.format.simple(),
                winston.format.printf(({ timestamp, level, message, ...meta }) => {
                  const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta, null, 2) : '';
                  return `${timestamp} [${level}]: ${message}${metaStr ? '\n' + metaStr : ''}`;
                })
              )
            : winston.format.json(),
        }),
      ],
    });

    // Add file transports for production
    if (process.env.NODE_ENV === 'production') {
      this.logger.add(new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        maxsize: 50 * 1024 * 1024, // 50MB
        maxFiles: 5,
      }));

      this.logger.add(new winston.transports.File({
        filename: 'logs/combined.log',
        maxsize: 100 * 1024 * 1024, // 100MB
        maxFiles: 10,
      }));
    }

    // Add custom log levels for different categories
    this.logger.addFilter((info) => {
      // Filter out sensitive data
      if (info.password) delete info.password;
      if (info.token) delete info.token;
      if (info.apiKey) delete info.apiKey;
      return info;
    });
  }

  /**
   * Set default context for all log messages
   */
  setDefaultContext(context: LogContext): void {
    this.defaultContext = { ...this.defaultContext, ...context };
  }

  /**
   * Clear default context
   */
  clearDefaultContext(): void {
    this.defaultContext = {};
  }

  /**
   * Log error message
   */
  error(
    message: string,
    metadata?: LogMetadata,
    context?: LogContext
  ): void {
    this.log('error', message, metadata, context);
  }

  /**
   * Log warning message
   */
  warn(
    message: string,
    metadata?: LogMetadata,
    context?: LogContext
  ): void {
    this.log('warn', message, metadata, context);
  }

  /**
   * Log info message
   */
  info(
    message: string,
    metadata?: LogMetadata,
    context?: LogContext
  ): void {
    this.log('info', message, metadata, context);
  }

  /**
   * Log debug message
   */
  debug(
    message: string,
    metadata?: LogMetadata,
    context?: LogContext
  ): void {
    this.log('debug', message, metadata, context);
  }

  /**
   * Log HTTP request
   */
  http(
    message: string,
    metadata?: LogMetadata & {
      method: string;
      route: string;
      statusCode: number;
      responseTime: number;
    },
    context?: LogContext
  ): void {
    this.log('http', message, metadata, context);
  }

  /**
   * Generic log method
   */
  private log(
    level: LogLevel,
    message: string,
    metadata?: LogMetadata,
    context?: LogContext
  ): void {
    const logData = {
      ...this.defaultContext,
      ...context,
      ...metadata,
      level,
      message,
    };

    // Add trace context
    const traceContext = telemetryManager.getTraceContext();
    if (traceContext.traceId) {
      logData.traceId = traceContext.traceId;
    }
    if (traceContext.spanId) {
      logData.spanId = traceContext.spanId;
    }

    this.logger.log(level, message, logData);
  }

  /**
   * Log API request start
   */
  logApiRequestStart(
    method: string,
    route: string,
    context: LogContext
  ): void {
    this.http(`API Request Started: ${method} ${route}`, {
      service: 'api',
      component: 'request-handler',
      operation: 'request-start',
      method,
      route,
    }, context);
  }

  /**
   * Log API request completion
   */
  logApiRequestComplete(
    method: string,
    route: string,
    statusCode: number,
    duration: number,
    context: LogContext
  ): void {
    this.http(`API Request Completed: ${method} ${route} - ${statusCode}`, {
      service: 'api',
      component: 'request-handler',
      operation: 'request-complete',
      method,
      route,
      statusCode,
      duration,
    }, context);
  }

  /**
   * Log database query
   */
  logDatabaseQuery(
    operation: string,
    table: string,
    duration: number,
    context: LogContext,
    error?: Error
  ): void {
    const level: LogLevel = error ? 'error' : 'debug';
    const message = error 
      ? `Database query failed: ${operation} on ${table}`
      : `Database query: ${operation} on ${table}`;

    this.log(level, message, {
      service: 'database',
      component: 'query-executor',
      operation: `db-${operation}`,
      duration,
      error,
      additionalData: { table },
    }, context);
  }

  /**
   * Log OpenRouter API call
   */
  logOpenRouterCall(
    model: string,
    operation: string,
    tokensUsed: number,
    cost: number,
    duration: number,
    context: LogContext,
    error?: Error
  ): void {
    const level: LogLevel = error ? 'error' : 'info';
    const message = error
      ? `OpenRouter API call failed: ${model} ${operation}`
      : `OpenRouter API call: ${model} ${operation}`;

    this.log(level, message, {
      service: 'openrouter',
      component: 'api-client',
      operation: `openrouter-${operation}`,
      duration,
      error,
      additionalData: {
        model,
        tokensUsed,
        cost,
      },
    }, context);
  }

  /**
   * Log document processing
   */
  logDocumentProcessing(
    operation: string,
    documentType: string,
    fileSize: number,
    duration: number,
    context: LogContext,
    error?: Error
  ): void {
    const level: LogLevel = error ? 'error' : 'info';
    const message = error
      ? `Document processing failed: ${operation} ${documentType}`
      : `Document processing: ${operation} ${documentType}`;

    this.log(level, message, {
      service: 'document-processing',
      component: 'processor',
      operation: `document-${operation}`,
      duration,
      error,
      additionalData: {
        documentType,
        fileSize,
      },
    }, context);
  }

  /**
   * Log authentication event
   */
  logAuthEvent(
    event: 'login' | 'logout' | 'register' | 'password-reset' | 'token-refresh',
    success: boolean,
    context: LogContext,
    error?: Error
  ): void {
    const level: LogLevel = error ? 'error' : 'info';
    const message = `Authentication ${event}: ${success ? 'success' : 'failed'}`;

    this.log(level, message, {
      service: 'authentication',
      component: 'auth-handler',
      operation: `auth-${event}`,
      error,
      additionalData: {
        event,
        success,
      },
    }, context);
  }

  /**
   * Log business event
   */
  logBusinessEvent(
    event: string,
    details: Record<string, any>,
    context: LogContext
  ): void {
    this.info(`Business Event: ${event}`, {
      service: 'business',
      component: 'event-tracker',
      operation: 'business-event',
      additionalData: {
        event,
        details,
      },
    }, context);
  }

  /**
   * Log security event
   */
  logSecurityEvent(
    event: 'suspicious-activity' | 'rate-limit-exceeded' | 'unauthorized-access' | 'data-access',
    severity: 'low' | 'medium' | 'high' | 'critical',
    details: Record<string, any>,
    context: LogContext
  ): void {
    const level: LogLevel = severity === 'critical' ? 'error' : severity === 'high' ? 'warn' : 'info';
    
    this.log(level, `Security Event: ${event}`, {
      service: 'security',
      component: 'security-monitor',
      operation: 'security-event',
      additionalData: {
        event,
        severity,
        details,
      },
    }, context);
  }

  /**
   * Log performance metrics
   */
  logPerformanceMetric(
    metric: string,
    value: number,
    unit: string,
    context: LogContext
  ): void {
    this.info(`Performance Metric: ${metric}`, {
      service: 'performance',
      component: 'metrics-collector',
      operation: 'performance-metric',
      additionalData: {
        metric,
        value,
        unit,
      },
    }, context);
  }

  /**
   * Create a child logger with additional context
   */
  child(childContext: LogContext): StructuredLogger {
    const childLogger = new StructuredLogger();
    childLogger.setDefaultContext({
      ...this.defaultContext,
      ...childContext,
    });
    return childLogger;
  }

  /**
   * Create logger for specific component
   */
  forComponent(component: string, service?: string): StructuredLogger {
    return this.child({
      service: service || this.defaultContext.service || 'hr-rag-platform',
      component,
    });
  }

  /**
   * Create logger for specific operation
   */
  forOperation(operation: string, context?: LogContext): StructuredLogger {
    return this.child({
      ...context,
      operation,
    });
  }

  /**
   * Get raw Winston logger (for advanced use cases)
   */
  getRawLogger(): winston.Logger {
    return this.logger;
  }

  /**
   * Flush all log transports
   */
  async flush(): Promise<void> {
    return new Promise((resolve) => {
      this.logger.on('finish', resolve);
      this.logger.end();
    });
  }

  /**
   * Query logs (for development/testing)
   */
  async queryLogs(options: {
    level?: LogLevel;
    limit?: number;
    start?: Date;
    end?: Date;
    fields?: string[];
  }): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const queryOptions = {
        limit: options.limit || 100,
        start: options.start || new Date(Date.now() - 24 * 60 * 60 * 1000), // Default: last 24 hours
        end: options.end || new Date(),
        order: 'desc',
        fields: options.fields,
        level: options.level,
      } as any;

      this.logger.query(queryOptions, (err, results) => {
        if (err) {
          reject(err);
        } else {
          resolve(results);
        }
      });
    });
  }
}

// Create singleton instance
export const structuredLogger = new StructuredLogger();

// Export convenience functions
export const logError = structuredLogger.error.bind(structuredLogger);
export const logWarn = structuredLogger.warn.bind(structuredLogger);
export const logInfo = structuredLogger.info.bind(structuredLogger);
export const logDebug = structuredLogger.debug.bind(structuredLogger);
export const logHttp = structuredLogger.http.bind(structuredLogger);

export default structuredLogger;