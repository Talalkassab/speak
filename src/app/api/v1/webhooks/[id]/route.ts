/**
 * Individual Webhook API
 * GET /api/v1/webhooks/[id] - Get webhook details
 * PUT /api/v1/webhooks/[id] - Update webhook
 * DELETE /api/v1/webhooks/[id] - Delete webhook
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/libs/supabase/supabase-server-client';
import { WebhookService } from '@/libs/services/webhook-service';
import type { UpdateWebhookRequest } from '@/types/webhooks';
import { WebhookError, WebhookValidationError } from '@/types/webhooks';

interface RouteContext {
  params: {
    id: string;
  };
}

// GET /api/v1/webhooks/[id] - Get webhook
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

    // Verify ownership
    if (webhook.userId !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    return NextResponse.json(webhook);

  } catch (error) {
    console.error('Error getting webhook:', error);

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

// PUT /api/v1/webhooks/[id] - Update webhook
export async function PUT(request: NextRequest, context: RouteContext) {
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
    const updateRequest: UpdateWebhookRequest = body;

    const webhookService = new WebhookService(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Verify webhook exists and ownership
    const existingWebhook = await webhookService.getWebhook(webhookId);
    if (!existingWebhook) {
      return NextResponse.json(
        { error: 'Webhook not found' },
        { status: 404 }
      );
    }

    if (existingWebhook.userId !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const webhook = await webhookService.updateWebhook(webhookId, updateRequest);

    return NextResponse.json(webhook);

  } catch (error) {
    console.error('Error updating webhook:', error);

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

// DELETE /api/v1/webhooks/[id] - Delete webhook
export async function DELETE(request: NextRequest, context: RouteContext) {
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

    const webhookService = new WebhookService(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Verify webhook exists and ownership
    const existingWebhook = await webhookService.getWebhook(webhookId);
    if (!existingWebhook) {
      return NextResponse.json(
        { error: 'Webhook not found' },
        { status: 404 }
      );
    }

    if (existingWebhook.userId !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    await webhookService.deleteWebhook(webhookId);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error deleting webhook:', error);

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