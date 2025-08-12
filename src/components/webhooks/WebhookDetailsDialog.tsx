/**
 * Webhook Details Dialog Component
 * Modal for viewing detailed webhook information and analytics
 */

'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Eye } from 'lucide-react';
import type { WebhookConfig } from '@/types/webhooks';

interface WebhookDetailsDialogProps {
  webhook: WebhookConfig;
  open: boolean;
  onClose: () => void;
  onWebhookUpdated: (webhook: WebhookConfig) => void;
}

export function WebhookDetailsDialog({ webhook, open, onClose }: WebhookDetailsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Eye className="h-5 w-5" />
            <span>Webhook Details</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Basic Information */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Basic Information</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Name:</label>
                <p className="text-gray-900">{webhook.name}</p>
              </div>
              {webhook.description && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Description:</label>
                  <p className="text-gray-900">{webhook.description}</p>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-gray-700">Status:</label>
                <Badge variant={webhook.isActive ? "success" : "secondary"}>
                  {webhook.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </div>
          </div>

          {/* Configuration */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Configuration</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <label className="font-medium text-gray-700">Integration Type:</label>
                <p className="text-gray-900">{webhook.integrationType}</p>
              </div>
              <div>
                <label className="font-medium text-gray-700">Timeout:</label>
                <p className="text-gray-900">{webhook.timeoutSeconds}s</p>
              </div>
              <div>
                <label className="font-medium text-gray-700">Max Retries:</label>
                <p className="text-gray-900">{webhook.retryCount}</p>
              </div>
              <div>
                <label className="font-medium text-gray-700">Auth Type:</label>
                <p className="text-gray-900">{webhook.authType}</p>
              </div>
            </div>
          </div>

          {/* Event Types */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Subscribed Events</h3>
            <div className="flex flex-wrap gap-2">
              {webhook.eventTypes.map((eventType) => (
                <Badge key={eventType} variant="outline">
                  {eventType}
                </Badge>
              ))}
            </div>
          </div>

          {/* Recent Activity Placeholder */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
            <div className="text-center text-gray-500 py-8">
              <p>Detailed webhook analytics and recent delivery logs would be displayed here.</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}