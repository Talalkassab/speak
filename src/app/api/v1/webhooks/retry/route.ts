/**
 * Webhook Retry API
 * POST /api/v1/webhooks/retry - Manually retry failed webhook deliveries
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/libs/supabase/supabase-server-client';
import { WebhookService } from '@/libs/services/webhook-service';
import { WebhookDeliveryService } from '@/libs/services/webhook-delivery-service';
import { WebhookError } from '@/types/webhooks';
import { z } from 'zod';

const retryRequestSchema = z.object({
  webhookId: z.string().uuid().optional(),
  deliveryIds: z.array(z.string().uuid()).optional(),
  status: z.enum(['failed', 'abandoned']).optional().default('failed'),
  maxAge: z.number().min(1).max(168).optional().default(24) // Max age in hours
}).refine(data => data.webhookId || data.deliveryIds, {
  message: 'Either webhookId or deliveryIds must be provided'
});

// POST /api/v1/webhooks/retry - Retry failed deliveries
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedRequest = retryRequestSchema.parse(body);

    const webhookService = new WebhookService(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const deliveryService = new WebhookDeliveryService(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let deliveryIds: string[] = [];
    let retryResults: { success: number; failed: number; errors: string[] } = {
      success: 0,
      failed: 0,
      errors: []
    };

    if (validatedRequest.deliveryIds) {
      // Retry specific deliveries
      deliveryIds = validatedRequest.deliveryIds;

      // Verify all deliveries belong to user's webhooks
      for (const deliveryId of deliveryIds) {
        const delivery = await deliveryService.getDelivery(deliveryId);
        if (!delivery) {
          return NextResponse.json(
            { error: `Delivery ${deliveryId} not found` },
            { status: 404 }
          );
        }

        const webhook = await webhookService.getWebhook(delivery.webhookId);
        if (!webhook || webhook.userId !== user.id) {
          return NextResponse.json(
            { error: 'Forbidden' },
            { status: 403 }
          );
        }
      }

    } else if (validatedRequest.webhookId) {
      // Retry all failed deliveries for a specific webhook
      const webhook = await webhookService.getWebhook(validatedRequest.webhookId);
      if (!webhook) {
        return NextResponse.json(
          { error: 'Webhook not found' },
          { status: 404 }
        );
      }

      if (webhook.userId !== user.id) {
        return NextResponse.json(
          { error: 'Forbidden' },
          { status: 403 }
        );
      }

      // Get failed deliveries for the webhook
      const maxAgeDate = new Date(Date.now() - validatedRequest.maxAge * 60 * 60 * 1000);

      const { data: failedDeliveries, error: queryError } = await supabase
        .from('webhook_deliveries')
        .select('id')
        .eq('webhook_id', validatedRequest.webhookId)
        .eq('delivery_status', validatedRequest.status)
        .gte('created_at', maxAgeDate.toISOString())
        .order('created_at', { ascending: false });

      if (queryError) {
        throw new WebhookError(`Failed to query deliveries: ${queryError.message}`, 'QUERY_FAILED');
      }

      deliveryIds = failedDeliveries?.map(d => d.id) || [];
    }

    if (deliveryIds.length === 0) {
      return NextResponse.json({
        message: 'No deliveries found to retry',
        results: {
          total: 0,
          success: 0,
          failed: 0,
          errors: []
        }
      });
    }

    // Process retries with concurrency limit
    const BATCH_SIZE = 5;
    const batches: string[][] = [];
    
    for (let i = 0; i < deliveryIds.length; i += BATCH_SIZE) {
      batches.push(deliveryIds.slice(i, i + BATCH_SIZE));
    }

    for (const batch of batches) {
      const batchPromises = batch.map(async (deliveryId) => {
        try {
          // Reset delivery status to pending for retry
          const { error: resetError } = await supabase
            .from('webhook_deliveries')
            .update({
              delivery_status: 'pending',
              next_retry_at: new Date().toISOString(),
              error_message: null
            })
            .eq('id', deliveryId);

          if (resetError) {
            throw new Error(`Failed to reset delivery status: ${resetError.message}`);
          }

          // Attempt delivery
          await deliveryService.deliverWebhook(deliveryId);
          retryResults.success++;
          
          return { success: true, deliveryId };
        } catch (error) {
          retryResults.failed++;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          retryResults.errors.push(`Delivery ${deliveryId}: ${errorMessage}`);
          
          return { success: false, deliveryId, error: errorMessage };
        }
      });

      // Wait for current batch to complete before processing next batch
      await Promise.allSettled(batchPromises);
    }

    return NextResponse.json({
      message: `Processed ${deliveryIds.length} deliveries for retry`,
      results: {
        total: deliveryIds.length,
        success: retryResults.success,
        failed: retryResults.failed,
        errors: retryResults.errors.slice(0, 10) // Limit error messages to first 10
      }
    });

  } catch (error) {
    console.error('Error retrying webhook deliveries:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          details: error.errors
        },
        { status: 400 }
      );
    }

    if (error instanceof WebhookError) {
      return NextResponse.json(
        { 
          error: error.message,
          code: error.code,
          details: error.details
        },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}