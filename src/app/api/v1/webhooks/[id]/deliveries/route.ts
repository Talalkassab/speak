/**
 * Webhook Deliveries API
 * GET /api/v1/webhooks/[id]/deliveries - List webhook deliveries
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/libs/supabase/supabase-server-client';
import { WebhookService } from '@/libs/services/webhook-service';
import { WebhookDeliveryService } from '@/libs/services/webhook-delivery-service';
import type { ListOptions } from '@/types/webhooks';
import { WebhookError } from '@/types/webhooks';

interface RouteContext {
  params: {
    id: string;
  };
}

// GET /api/v1/webhooks/[id]/deliveries - List webhook deliveries
export async function GET(request: NextRequest, context: RouteContext) {
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
    const url = new URL(request.url);
    const searchParams = url.searchParams;

    // Verify webhook ownership
    const webhookService = new WebhookService(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

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

    const options: ListOptions = {
      page: parseInt(searchParams.get('page') || '1'),
      limit: Math.min(parseInt(searchParams.get('limit') || '20'), 100),
      sortBy: searchParams.get('sortBy') || 'created_at',
      sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc'
    };

    // Add filters
    const filters: Record<string, any> = {};
    if (searchParams.get('status')) {
      filters.delivery_status = searchParams.get('status');
    }
    if (searchParams.get('event_type')) {
      // This would require a join with webhook_events table
      filters.event_type = searchParams.get('event_type');
    }

    options.filters = filters;

    const deliveryService = new WebhookDeliveryService(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const result = await deliveryService.listDeliveries(webhookId, options);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error listing webhook deliveries:', error);

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