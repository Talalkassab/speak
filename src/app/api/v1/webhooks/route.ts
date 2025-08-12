/**
 * Webhooks API - Main CRUD operations
 * GET /api/v1/webhooks - List user's webhooks
 * POST /api/v1/webhooks - Create new webhook
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/libs/supabase/supabase-server-client';
import { WebhookService } from '@/libs/services/webhook-service';
import type { CreateWebhookRequest, ListOptions } from '@/types/webhooks';
import { WebhookError, WebhookValidationError } from '@/types/webhooks';

// GET /api/v1/webhooks - List webhooks
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const searchParams = url.searchParams;

    const options: ListOptions = {
      page: parseInt(searchParams.get('page') || '1'),
      limit: Math.min(parseInt(searchParams.get('limit') || '20'), 100),
      sortBy: searchParams.get('sortBy') || 'created_at',
      sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc'
    };

    // Add filters
    const filters: Record<string, any> = {};
    if (searchParams.get('active') !== null) {
      filters.is_active = searchParams.get('active') === 'true';
    }
    if (searchParams.get('integration_type')) {
      filters.integration_type = searchParams.get('integration_type');
    }
    if (searchParams.get('event_type')) {
      // Filter by event type (requires array containment)
      const eventType = searchParams.get('event_type');
      filters.event_types = `{"${eventType}"}`;
    }

    options.filters = filters;

    const webhookService = new WebhookService(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const result = await webhookService.listWebhooks(user.id, options);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error listing webhooks:', error);

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

// POST /api/v1/webhooks - Create webhook
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
    const createRequest: CreateWebhookRequest = body;

    const webhookService = new WebhookService(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const webhook = await webhookService.createWebhook(user.id, createRequest);

    return NextResponse.json(webhook, { status: 201 });

  } catch (error) {
    console.error('Error creating webhook:', error);

    if (error instanceof WebhookValidationError) {
      return NextResponse.json(
        { 
          error: error.message,
          code: error.code,
          field: error.field,
          details: error.details
        },
        { status: error.statusCode }
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