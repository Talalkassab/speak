/**
 * Webhook Job Processor
 * Background job processor for reliable webhook delivery and retry handling
 */

import { createClient } from '@supabase/supabase-js';
import { WebhookDeliveryService } from './webhook-delivery-service';
import { WebhookMonitoringService } from './webhook-monitoring-service';
import type { WebhookDelivery, WebhookEvent } from '@/types/webhooks';
import { EventEmitter } from 'events';

interface JobProcessorConfig {
  enabled: boolean;
  concurrency: number; // Number of parallel jobs
  batchSize: number; // Number of jobs to process in each batch
  pollInterval: number; // Polling interval in milliseconds
  retryInterval: number; // Interval to check for retries in milliseconds
  maxRetryDelay: number; // Maximum delay between retries in milliseconds
  deadLetterThreshold: number; // Hours after which failed jobs go to dead letter queue
  enableHealthChecks: boolean;
  enableCleanup: boolean;
  cleanupInterval: number; // Cleanup interval in milliseconds
}

interface JobStats {
  processed: number;
  failed: number;
  retried: number;
  deadLettered: number;
  uptime: number;
  lastProcessedAt?: string;
  currentLoad: number;
  queueSize: number;
}

interface JobProcessorStatus {
  isRunning: boolean;
  isHealthy: boolean;
  stats: JobStats;
  workers: Array<{
    id: string;
    status: 'idle' | 'busy' | 'error';
    currentJob?: string;
    lastActivity: string;
  }>;
  lastError?: string;
}

export class WebhookJobProcessor extends EventEmitter {
  private supabase;
  private deliveryService: WebhookDeliveryService;
  private monitoringService?: WebhookMonitoringService;
  private config: JobProcessorConfig;
  
  private isRunning = false;
  private workers: Map<string, any> = new Map();
  private stats: JobStats = {
    processed: 0,
    failed: 0,
    retried: 0,
    deadLettered: 0,
    uptime: 0,
    currentLoad: 0,
    queueSize: 0
  };
  
  private startTime: number = 0;
  private pollTimer?: NodeJS.Timeout;
  private retryTimer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;
  private healthCheckTimer?: NodeJS.Timeout;

  constructor(
    supabaseUrl: string,
    supabaseServiceKey: string,
    config: Partial<JobProcessorConfig> = {}
  ) {
    super();
    
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
    this.deliveryService = new WebhookDeliveryService(supabaseUrl, supabaseServiceKey);
    
    if (config.enableHealthChecks !== false) {
      this.monitoringService = new WebhookMonitoringService(supabaseUrl, supabaseServiceKey);
    }

    this.config = {
      enabled: true,
      concurrency: 5,
      batchSize: 10,
      pollInterval: 5000, // 5 seconds
      retryInterval: 30000, // 30 seconds
      maxRetryDelay: 3600000, // 1 hour
      deadLetterThreshold: 24, // 24 hours
      enableHealthChecks: true,
      enableCleanup: true,
      cleanupInterval: 3600000, // 1 hour
      ...config
    };

    // Initialize workers
    this.initializeWorkers();
  }

  /**
   * Start the job processor
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Webhook job processor is already running');
      return;
    }

    if (!this.config.enabled) {
      console.log('Webhook job processor is disabled');
      return;
    }

    console.log('Starting webhook job processor...');
    
    this.isRunning = true;
    this.startTime = Date.now();
    
    // Start polling for new jobs
    this.pollTimer = setInterval(() => {
      this.pollForJobs();
    }, this.config.pollInterval);

    // Start retry processor
    this.retryTimer = setInterval(() => {
      this.processRetries();
    }, this.config.retryInterval);

    // Start cleanup processor
    if (this.config.enableCleanup) {
      this.cleanupTimer = setInterval(() => {
        this.performCleanup();
      }, this.config.cleanupInterval);
    }

    // Start health checks
    if (this.config.enableHealthChecks && this.monitoringService) {
      this.healthCheckTimer = setInterval(() => {
        this.performHealthCheck();
      }, 60000); // Every minute
    }

    this.emit('processor:started');
    console.log(`Webhook job processor started with ${this.config.concurrency} workers`);
  }

  /**
   * Stop the job processor
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log('Stopping webhook job processor...');
    
    this.isRunning = false;

    // Clear timers
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.retryTimer) clearInterval(this.retryTimer);
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    if (this.healthCheckTimer) clearInterval(this.healthCheckTimer);

    // Wait for workers to finish current jobs
    await this.waitForWorkersToFinish();

    this.emit('processor:stopped');
    console.log('Webhook job processor stopped');
  }

  /**
   * Get processor status
   */
  getStatus(): JobProcessorStatus {
    this.stats.uptime = this.isRunning ? Date.now() - this.startTime : 0;
    this.stats.currentLoad = this.getActiveWorkerCount() / this.config.concurrency;

    const workers = Array.from(this.workers.entries()).map(([id, worker]) => ({
      id,
      status: worker.status,
      currentJob: worker.currentJob,
      lastActivity: worker.lastActivity
    }));

    return {
      isRunning: this.isRunning,
      isHealthy: this.isHealthy(),
      stats: this.stats,
      workers,
      lastError: this.getLastError()
    };
  }

  /**
   * Initialize worker pool
   */
  private initializeWorkers(): void {
    for (let i = 0; i < this.config.concurrency; i++) {
      const workerId = `worker-${i}`;
      this.workers.set(workerId, {
        id: workerId,
        status: 'idle',
        currentJob: null,
        lastActivity: new Date().toISOString(),
        lastError: null
      });
    }
  }

  /**
   * Poll for new jobs
   */
  private async pollForJobs(): Promise<void> {
    if (!this.isRunning) return;

    try {
      // Get available workers
      const availableWorkers = Array.from(this.workers.values()).filter(w => w.status === 'idle');
      if (availableWorkers.length === 0) {
        return;
      }

      // Get pending deliveries
      const { data: pendingDeliveries, error } = await this.supabase
        .from('webhook_deliveries')
        .select('id, webhook_id, created_at')
        .eq('delivery_status', 'pending')
        .order('created_at', { ascending: true })
        .limit(Math.min(availableWorkers.length, this.config.batchSize));

      if (error) {
        console.error('Error fetching pending deliveries:', error);
        return;
      }

      if (!pendingDeliveries?.length) {
        this.stats.queueSize = 0;
        return;
      }

      this.stats.queueSize = pendingDeliveries.length;

      // Assign jobs to workers
      const jobPromises = pendingDeliveries.slice(0, availableWorkers.length).map((delivery, index) => {
        const worker = availableWorkers[index];
        return this.processDelivery(worker, delivery.id);
      });

      await Promise.allSettled(jobPromises);

    } catch (error) {
      console.error('Error polling for jobs:', error);
      this.emit('processor:error', error);
    }
  }

  /**
   * Process a webhook delivery
   */
  private async processDelivery(worker: any, deliveryId: string): Promise<void> {
    worker.status = 'busy';
    worker.currentJob = deliveryId;
    worker.lastActivity = new Date().toISOString();

    try {
      const result = await this.deliveryService.deliverWebhook(deliveryId);
      
      if (result.deliveryStatus === 'delivered') {
        this.stats.processed++;
        this.emit('job:completed', { deliveryId, worker: worker.id });
      } else {
        this.stats.failed++;
        this.emit('job:failed', { deliveryId, worker: worker.id, status: result.deliveryStatus });
      }

      this.stats.lastProcessedAt = new Date().toISOString();

    } catch (error) {
      console.error(`Worker ${worker.id} failed to process delivery ${deliveryId}:`, error);
      this.stats.failed++;
      worker.lastError = error instanceof Error ? error.message : 'Unknown error';
      this.emit('job:error', { deliveryId, worker: worker.id, error });

    } finally {
      worker.status = 'idle';
      worker.currentJob = null;
      worker.lastActivity = new Date().toISOString();
    }
  }

  /**
   * Process retry deliveries
   */
  private async processRetries(): Promise<void> {
    if (!this.isRunning) return;

    try {
      await this.deliveryService.retryFailedDeliveries();
      
      // Count retried deliveries
      const { count } = await this.supabase
        .from('webhook_deliveries')
        .select('id', { count: 'exact', head: true })
        .eq('delivery_status', 'retrying');

      if (count && count > 0) {
        this.stats.retried += count;
        this.emit('retries:processed', { count });
      }

    } catch (error) {
      console.error('Error processing retries:', error);
    }
  }

  /**
   * Move old failed deliveries to dead letter queue
   */
  private async processDeadLetterQueue(): Promise<void> {
    try {
      const deadLetterThreshold = new Date(Date.now() - this.config.deadLetterThreshold * 60 * 60 * 1000);

      // Find deliveries that should be moved to dead letter queue
      const { data: expiredDeliveries, error } = await this.supabase
        .from('webhook_deliveries')
        .select('id')
        .in('delivery_status', ['failed', 'retrying'])
        .lt('created_at', deadLetterThreshold.toISOString());

      if (error || !expiredDeliveries?.length) {
        return;
      }

      // Update status to abandoned
      const { error: updateError } = await this.supabase
        .from('webhook_deliveries')
        .update({
          delivery_status: 'abandoned',
          error_message: 'Moved to dead letter queue after exceeding retry threshold'
        })
        .in('id', expiredDeliveries.map(d => d.id));

      if (!updateError) {
        this.stats.deadLettered += expiredDeliveries.length;
        this.emit('dead_letter:processed', { count: expiredDeliveries.length });
      }

    } catch (error) {
      console.error('Error processing dead letter queue:', error);
    }
  }

  /**
   * Perform system cleanup
   */
  private async performCleanup(): Promise<void> {
    if (!this.isRunning) return;

    try {
      // Clean up old successful deliveries (older than 7 days)
      const cleanupDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      const { error: cleanupError } = await this.supabase
        .from('webhook_deliveries')
        .delete()
        .eq('delivery_status', 'delivered')
        .lt('delivered_at', cleanupDate.toISOString());

      if (cleanupError) {
        console.error('Error during cleanup:', cleanupError);
      }

      // Process dead letter queue
      await this.processDeadLetterQueue();

      this.emit('cleanup:completed');

    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  /**
   * Perform health check
   */
  private async performHealthCheck(): Promise<void> {
    if (!this.monitoringService) return;

    try {
      // This would check system health and create alerts if needed
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      // Check if there are any critical issues
      const { data: failedDeliveries, error } = await this.supabase
        .from('webhook_deliveries')
        .select('count', { count: 'exact', head: true })
        .eq('delivery_status', 'failed')
        .gte('created_at', oneHourAgo.toISOString());

      if (error) return;

      // Alert if too many failures
      const failureCount = failedDeliveries || 0;
      if (failureCount > 50) { // Threshold for high failure rate
        this.emit('health:alert', {
          type: 'high_failure_rate',
          count: failureCount,
          threshold: 50
        });
      }

    } catch (error) {
      console.error('Error during health check:', error);
    }
  }

  /**
   * Wait for all workers to finish their current jobs
   */
  private async waitForWorkersToFinish(timeout: number = 30000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const busyWorkers = Array.from(this.workers.values()).filter(w => w.status === 'busy');
      if (busyWorkers.length === 0) {
        return;
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.warn('Timeout waiting for workers to finish, forcing shutdown');
  }

  /**
   * Get number of active workers
   */
  private getActiveWorkerCount(): number {
    return Array.from(this.workers.values()).filter(w => w.status === 'busy').length;
  }

  /**
   * Check if the processor is healthy
   */
  private isHealthy(): boolean {
    const activeWorkers = this.getActiveWorkerCount();
    const errorWorkers = Array.from(this.workers.values()).filter(w => w.lastError).length;
    
    return this.isRunning && (errorWorkers / this.config.concurrency) < 0.5;
  }

  /**
   * Get the last error from any worker
   */
  private getLastError(): string | undefined {
    const workersWithErrors = Array.from(this.workers.values())
      .filter(w => w.lastError)
      .sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());
    
    return workersWithErrors[0]?.lastError;
  }
}

export default WebhookJobProcessor;