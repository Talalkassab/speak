/**
 * Webhook List Component
 * Displays and manages a list of webhooks
 */

'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Settings, 
  Trash2, 
  Edit3, 
  TestTube, 
  Eye, 
  ExternalLink,
  Power,
  PowerOff,
  MoreVertical,
  Copy
} from 'lucide-react';
import { WebhookEditDialog } from './WebhookEditDialog';
import { WebhookTestDialog } from './WebhookTestDialog';
import { WebhookDetailsDialog } from './WebhookDetailsDialog';
import type { WebhookConfig, IntegrationType } from '@/types/webhooks';

interface WebhookListProps {
  webhooks: WebhookConfig[];
  onWebhookUpdated: (webhook: WebhookConfig) => void;
  onWebhookDeleted: (webhookId: string) => void;
}

export function WebhookList({ webhooks, onWebhookUpdated, onWebhookDeleted }: WebhookListProps) {
  const [editingWebhook, setEditingWebhook] = useState<WebhookConfig | null>(null);
  const [testingWebhook, setTestingWebhook] = useState<WebhookConfig | null>(null);
  const [viewingWebhook, setViewingWebhook] = useState<WebhookConfig | null>(null);
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});

  const formatLastTriggered = (date: string | undefined) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleString();
  };

  const getIntegrationIcon = (type: IntegrationType) => {
    const icons = {
      custom: '🔗',
      webhook: '🔗',
      slack: '💬',
      microsoft_teams: '👥',
      email: '📧',
      sms: '📱',
      discord: '🎮'
    };
    return icons[type] || '🔗';
  };

  const getIntegrationName = (type: IntegrationType) => {
    const names = {
      custom: 'Custom HTTP',
      webhook: 'HTTP Webhook',
      slack: 'Slack',
      microsoft_teams: 'Microsoft Teams',
      email: 'Email',
      sms: 'SMS',
      discord: 'Discord'
    };
    return names[type] || type;
  };

  const handleToggleStatus = async (webhook: WebhookConfig) => {
    const webhookId = webhook.id!;
    setLoadingStates(prev => ({ ...prev, [webhookId]: true }));

    try {
      const response = await fetch(`/api/v1/webhooks/${webhookId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isActive: !webhook.isActive
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update webhook status');
      }

      const updatedWebhook = await response.json();
      onWebhookUpdated(updatedWebhook);
    } catch (error) {
      console.error('Error updating webhook status:', error);
      // TODO: Add toast notification for error
    } finally {
      setLoadingStates(prev => ({ ...prev, [webhookId]: false }));
    }
  };

  const handleDeleteWebhook = async (webhook: WebhookConfig) => {
    if (!window.confirm('Are you sure you want to delete this webhook? This action cannot be undone.')) {
      return;
    }

    const webhookId = webhook.id!;
    setLoadingStates(prev => ({ ...prev, [webhookId]: true }));

    try {
      const response = await fetch(`/api/v1/webhooks/${webhookId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete webhook');
      }

      onWebhookDeleted(webhookId);
    } catch (error) {
      console.error('Error deleting webhook:', error);
      // TODO: Add toast notification for error
    } finally {
      setLoadingStates(prev => ({ ...prev, [webhookId]: false }));
    }
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    // TODO: Add toast notification for success
  };

  if (webhooks.length === 0) {
    return (
      <Card className="p-12 text-center">
        <Settings className="h-16 w-16 mx-auto text-gray-300 mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">No webhooks configured</h3>
        <p className="text-gray-500 mb-6 max-w-md mx-auto">
          Get started by creating your first webhook endpoint to receive real-time notifications 
          about events in your HR Intelligence Platform.
        </p>
        <div className="flex justify-center space-x-4">
          <Button variant="outline" className="flex items-center space-x-2">
            <ExternalLink className="h-4 w-4" />
            <span>View Documentation</span>
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {webhooks.map((webhook) => (
        <Card key={webhook.id} className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {/* Status Indicator */}
              <div className={`h-3 w-3 rounded-full ${
                webhook.isActive ? 'bg-green-500' : 'bg-gray-400'
              }`} />

              {/* Webhook Info */}
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {webhook.name}
                  </h3>
                  <Badge variant="outline" className="flex items-center space-x-1">
                    <span>{getIntegrationIcon(webhook.integrationType)}</span>
                    <span>{getIntegrationName(webhook.integrationType)}</span>
                  </Badge>
                  <Badge variant={webhook.isActive ? "success" : "secondary"}>
                    {webhook.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                
                {webhook.description && (
                  <p className="text-gray-600 mb-2">{webhook.description}</p>
                )}

                <div className="flex items-center space-x-6 text-sm text-gray-500">
                  <div className="flex items-center space-x-1">
                    <ExternalLink className="h-4 w-4" />
                    <span className="font-mono max-w-md truncate">
                      {webhook.url}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCopyUrl(webhook.url)}
                      className="h-6 w-6 p-0"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <div>
                    Events: {webhook.eventTypes.length}
                  </div>
                  <div>
                    Last triggered: {formatLastTriggered(webhook.lastTriggeredAt)}
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setViewingWebhook(webhook)}
                className="flex items-center space-x-1"
              >
                <Eye className="h-4 w-4" />
                <span>Details</span>
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => setTestingWebhook(webhook)}
                className="flex items-center space-x-1"
              >
                <TestTube className="h-4 w-4" />
                <span>Test</span>
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => handleToggleStatus(webhook)}
                disabled={loadingStates[webhook.id!]}
                className="flex items-center space-x-1"
              >
                {webhook.isActive ? (
                  <>
                    <PowerOff className="h-4 w-4" />
                    <span>Disable</span>
                  </>
                ) : (
                  <>
                    <Power className="h-4 w-4" />
                    <span>Enable</span>
                  </>
                )}
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditingWebhook(webhook)}
                className="flex items-center space-x-1"
              >
                <Edit3 className="h-4 w-4" />
                <span>Edit</span>
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDeleteWebhook(webhook)}
                disabled={loadingStates[webhook.id!]}
                className="flex items-center space-x-1 text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete</span>
              </Button>
            </div>
          </div>

          {/* Event Types */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-sm font-medium text-gray-700">Subscribed Events:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {webhook.eventTypes.length === 0 ? (
                <Badge variant="secondary">All events</Badge>
              ) : (
                webhook.eventTypes.slice(0, 5).map((eventType) => (
                  <Badge key={eventType} variant="outline">
                    {eventType}
                  </Badge>
                ))
              )}
              {webhook.eventTypes.length > 5 && (
                <Badge variant="secondary">
                  +{webhook.eventTypes.length - 5} more
                </Badge>
              )}
            </div>
          </div>

          {/* Configuration Summary */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Timeout:</span>
                <span className="ml-1 font-medium">{webhook.timeoutSeconds}s</span>
              </div>
              <div>
                <span className="text-gray-500">Retries:</span>
                <span className="ml-1 font-medium">{webhook.retryCount}</span>
              </div>
              <div>
                <span className="text-gray-500">Rate Limit:</span>
                <span className="ml-1 font-medium">{webhook.rateLimitPerHour}/hr</span>
              </div>
              <div>
                <span className="text-gray-500">Auth:</span>
                <span className="ml-1 font-medium">
                  {webhook.authType === 'none' ? 'None' : 
                   webhook.authType === 'api_key' ? 'API Key' :
                   webhook.authType === 'bearer_token' ? 'Bearer Token' :
                   webhook.authType === 'hmac_sha256' ? 'HMAC SHA256' :
                   webhook.authType === 'oauth2' ? 'OAuth2' : 'Unknown'}
                </span>
              </div>
            </div>
          </div>
        </Card>
      ))}

      {/* Edit Dialog */}
      {editingWebhook && (
        <WebhookEditDialog
          webhook={editingWebhook}
          open={!!editingWebhook}
          onClose={() => setEditingWebhook(null)}
          onWebhookUpdated={(updated) => {
            onWebhookUpdated(updated);
            setEditingWebhook(null);
          }}
        />
      )}

      {/* Test Dialog */}
      {testingWebhook && (
        <WebhookTestDialog
          webhook={testingWebhook}
          open={!!testingWebhook}
          onClose={() => setTestingWebhook(null)}
        />
      )}

      {/* Details Dialog */}
      {viewingWebhook && (
        <WebhookDetailsDialog
          webhook={viewingWebhook}
          open={!!viewingWebhook}
          onClose={() => setViewingWebhook(null)}
          onWebhookUpdated={onWebhookUpdated}
        />
      )}
    </div>
  );
}