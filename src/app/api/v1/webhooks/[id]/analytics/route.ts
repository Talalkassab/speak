/**
 * Webhook Analytics API
 * GET /api/v1/webhooks/[id]/analytics - Get webhook analytics and metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/libs/supabase/supabase-server-client';
import { WebhookService } from '@/libs/services/webhook-service';
import { WebhookError } from '@/types/webhooks';
import { z } from 'zod';

interface RouteContext {
  params: {
    id: string;
  };
}

const analyticsQuerySchema = z.object({
  start: z.string().datetime().optional(),
  end: z.string().datetime().optional(),
  period: z.enum(['1h', '24h', '7d', '30d']).optional().default('24h')
});

// GET /api/v1/webhooks/[id]/analytics - Get webhook analytics
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

    // Parse and validate query parameters
    const queryParams = {
      start: searchParams.get('start') || undefined,
      end: searchParams.get('end') || undefined,
      period: searchParams.get('period') || '24h'
    };

    const validatedParams = analyticsQuerySchema.parse(queryParams);

    // Calculate time period if not provided
    let startDate: string;
    let endDate: string = new Date().toISOString();

    if (validatedParams.start && validatedParams.end) {
      startDate = validatedParams.start;
      endDate = validatedParams.end;
    } else {
      const now = new Date();
      switch (validatedParams.period) {
        case '1h':
          startDate = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
          break;
        case '24h':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
          break;
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
          break;
        default:
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      }
    }

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

    const analytics = await webhookService.getWebhookAnalytics(webhookId, {
      start: startDate,
      end: endDate
    });

    return NextResponse.json({
      ...analytics,
      period: validatedParams.period,
      timeRange: {
        start: startDate,
        end: endDate
      }
    });

  } catch (error) {
    console.error('Error getting webhook analytics:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid query parameters',
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