/**
 * Webhook Test API
 * POST /api/v1/webhooks/[id]/test - Test webhook delivery
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/libs/supabase/supabase-server-client';
import { WebhookService } from '@/libs/services/webhook-service';
import type { WebhookTestRequest } from '@/types/webhooks';
import { WebhookError, WebhookValidationError } from '@/types/webhooks';
import { z } from 'zod';

interface RouteContext {
  params: {
    id: string;
  };
}

const testRequestSchema = z.object({
  eventType: z.string(),
  testData: z.record(z.any()).optional()
});

// POST /api/v1/webhooks/[id]/test - Test webhook
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const webhookId = context.params.id;
    const body = await request.json();

    // Validate request body
    const validatedRequest = testRequestSchema.parse(body);

    const testRequest: WebhookTestRequest = {
      eventType: validatedRequest.eventType as any,
      testData: validatedRequest.testData
    };

    const webhookService = new WebhookService(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Verify webhook exists and ownership
    const webhook = await webhookService.getWebhook(webhookId);
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

    const result = await webhookService.testWebhook(webhookId, testRequest);

    return NextResponse.json({
      success: result.success,
      deliveryId: result.deliveryId,
      statusCode: result.responseStatusCode,
      responseTime: result.responseTime,
      error: result.error,
      message: result.success ? 'Webhook test completed successfully' : 'Webhook test failed'
    });

  } catch (error) {
    console.error('Error testing webhook:', error);

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