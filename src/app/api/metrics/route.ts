import { NextRequest, NextResponse } from 'next/server';
import { performanceMonitor } from '@/libs/monitoring/performance-monitor';
import { systemHealthMonitor } from '@/libs/monitoring/system-health-monitor';
import { errorTracker } from '@/libs/monitoring/error-tracker';
import { usageTracker } from '@/libs/monitoring/usage-tracker';
import { alertManager } from '@/libs/monitoring/alert-manager';
import { structuredLogger } from '@/libs/logging/structured-logger';
import * as promClient from 'prom-client';

/**
 * Metrics endpoint for Prometheus scraping and monitoring dashboards
 * Supports multiple output formats: prometheus, json
 */
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') || 'prometheus';
  const type = searchParams.get('type') || 'all'; // all, system, performance, errors, usage, alerts
  
  try {
    structuredLogger.debug('Metrics requested', {
      service: 'metrics-api',
      component: 'metrics-endpoint',
      operation: 'get-metrics',
      additionalData: { format, type }
    }, { requestId });

    if (format === 'prometheus') {
      // Return Prometheus formatted metrics
      const metrics = await promClient.register.metrics();
      
      return new NextResponse(metrics, {
        status: 200,
        headers: {
          'Content-Type': promClient.register.contentType,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }

    // Return JSON formatted metrics for dashboard consumption
    const metricsData = await gatherMetricsData(type);
    
    return NextResponse.json(metricsData, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Request-ID': requestId,
      },
    });

  } catch (error) {
    structuredLogger.error('Failed to get metrics', {
      service: 'metrics-api',
      component: 'metrics-endpoint',
      operation: 'get-metrics',
      error: error instanceof Error ? error : undefined
    }, { requestId });

    return NextResponse.json(
      {
        error: 'Failed to retrieve metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
        requestId,
      },
      { status: 500 }
    );
  }
}

/**
 * Gather comprehensive metrics data
 */
async function gatherMetricsData(type: string) {
  const data: any = {
    timestamp: new Date().toISOString(),
    type,
  };

  try {
    if (type === 'all' || type === 'system') {
      data.system = await systemHealthMonitor.getSystemStatus();
    }

    if (type === 'all' || type === 'performance') {
      data.performance = await performanceMonitor.getPerformanceSnapshot();
    }

    if (type === 'all' || type === 'errors') {
      data.errors = await errorTracker.getErrorStats();
    }

    if (type === 'all' || type === 'usage') {
      // Get usage stats for the platform (no specific org)
      data.usage = await usageTracker.getUsageStats('platform', 'day');
    }

    if (type === 'all' || type === 'alerts') {
      data.alerts = await alertManager.getAlertStats();
    }

    return data;
  } catch (error) {
    throw new Error(`Failed to gather ${type} metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * POST endpoint for custom metric updates
 */
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  
  try {
    const body = await request.json();
    const { metric, value, labels, type = 'gauge' } = body;

    if (!metric || value === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: metric and value' },
        { status: 400 }
      );
    }

    // Create or update custom metric
    let customMetric;
    
    switch (type) {
      case 'counter':
        customMetric = new promClient.Counter({
          name: `custom_${metric}`,
          help: `Custom counter metric: ${metric}`,
          labelNames: Object.keys(labels || {}),
        });
        customMetric.inc(labels, value);
        break;
        
      case 'gauge':
        customMetric = new promClient.Gauge({
          name: `custom_${metric}`,
          help: `Custom gauge metric: ${metric}`,
          labelNames: Object.keys(labels || {}),
        });
        customMetric.set(labels, value);
        break;
        
      case 'histogram':
        customMetric = new promClient.Histogram({
          name: `custom_${metric}`,
          help: `Custom histogram metric: ${metric}`,
          labelNames: Object.keys(labels || {}),
        });
        customMetric.observe(labels, value);
        break;
        
      default:
        return NextResponse.json(
          { error: 'Invalid metric type. Supported: counter, gauge, histogram' },
          { status: 400 }
        );
    }

    structuredLogger.info('Custom metric updated', {
      service: 'metrics-api',
      component: 'custom-metrics',
      operation: 'update-metric',
      additionalData: { metric, value, labels, type }
    }, { requestId });

    return NextResponse.json({
      success: true,
      metric,
      value,
      labels,
      type,
      requestId,
    });

  } catch (error) {
    structuredLogger.error('Failed to update custom metric', {
      service: 'metrics-api',
      component: 'custom-metrics',
      operation: 'update-metric',
      error: error instanceof Error ? error : undefined
    }, { requestId });

    return NextResponse.json(
      {
        error: 'Failed to update metric',
        message: error instanceof Error ? error.message : 'Unknown error',
        requestId,
      },
      { status: 500 }
    );
  }
}