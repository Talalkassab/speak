/**
 * Webhook Edit Dialog Component
 * Modal for editing existing webhooks
 */

'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Save } from 'lucide-react';
import type { WebhookConfig, UpdateWebhookRequest } from '@/types/webhooks';

interface WebhookEditDialogProps {
  webhook: WebhookConfig;
  open: boolean;
  onClose: () => void;
  onWebhookUpdated: (webhook: WebhookConfig) => void;
}

export function WebhookEditDialog({ webhook, open, onClose, onWebhookUpdated }: WebhookEditDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<UpdateWebhookRequest>({
    name: webhook.name,
    description: webhook.description || '',
    url: webhook.url,
    timeoutSeconds: webhook.timeoutSeconds,
    retryCount: webhook.retryCount,
    rateLimitPerHour: webhook.rateLimitPerHour,
    rateLimitPerDay: webhook.rateLimitPerDay,
    isActive: webhook.isActive
  });

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/webhooks/${webhook.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update webhook');
      }

      const updatedWebhook = await response.json();
      onWebhookUpdated(updatedWebhook);
    } catch (error) {
      console.error('Error updating webhook:', error);
      setError(error instanceof Error ? error.message : 'Failed to update webhook');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Webhook</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
                <div>
                  <h5 className="font-semibold text-red-900">Error</h5>
                  <p className="text-red-800 text-sm mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="url">URL *</Label>
            <Input
              id="url"
              type="url"
              value={formData.url}
              onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="timeout">Timeout (seconds)</Label>
              <Input
                id="timeout"
                type="number"
                min="5"
                max="300"
                value={formData.timeoutSeconds}
                onChange={(e) => setFormData(prev => ({ ...prev, timeoutSeconds: parseInt(e.target.value) }))}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="retries">Max Retries</Label>
              <Input
                id="retries"
                type="number"
                min="0"
                max="10"
                value={formData.retryCount}
                onChange={(e) => setFormData(prev => ({ ...prev, retryCount: parseInt(e.target.value) }))}
                className="mt-1"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              id="active"
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
              className="rounded border-gray-300"
            />
            <Label htmlFor="active">Active</Label>
          </div>
        </div>

        <div className="flex justify-end space-x-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!formData.name || !formData.url || isSubmitting}
            className="flex items-center space-x-2"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>Save Changes</span>
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}