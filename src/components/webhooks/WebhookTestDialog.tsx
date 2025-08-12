/**
 * Webhook Test Dialog Component
 * Modal for testing webhook delivery
 */

'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { TestTube, CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import type { WebhookConfig, WebhookTestRequest, WebhookTestResponse } from '@/types/webhooks';

interface WebhookTestDialogProps {
  webhook: WebhookConfig;
  open: boolean;
  onClose: () => void;
}

const testEventTypes = [
  { type: 'document.uploaded', label: 'Document Uploaded', category: 'Document' },
  { type: 'chat.conversation.created', label: 'Chat Created', category: 'Chat' },
  { type: 'analytics.usage.threshold', label: 'Usage Alert', category: 'Analytics' },
  { type: 'system.health.alert', label: 'Health Alert', category: 'System' }
];

export function WebhookTestDialog({ webhook, open, onClose }: WebhookTestDialogProps) {
  const [selectedEventType, setSelectedEventType] = useState(testEventTypes[0].type);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<WebhookTestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTest = async () => {
    setIsTesting(true);
    setError(null);
    setTestResult(null);

    try {
      const testData: WebhookTestRequest = {
        eventType: selectedEventType as any,
        testData: {
          test: true,
          timestamp: new Date().toISOString(),
          source: 'webhook_test'
        }
      };

      const response = await fetch(`/api/v1/webhooks/${webhook.id}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Test failed');
      }

      const result = await response.json();
      setTestResult(result);
    } catch (error) {
      console.error('Error testing webhook:', error);
      setError(error instanceof Error ? error.message : 'Test failed');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <TestTube className="h-5 w-5" />
            <span>Test Webhook</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2">Testing: {webhook.name}</h4>
            <p className="text-blue-800 text-sm">
              <span className="font-medium">URL:</span> {webhook.url}
            </p>
            <p className="text-blue-800 text-sm">
              <span className="font-medium">Type:</span> {webhook.integrationType}
            </p>
          </div>

          <div>
            <Label htmlFor="eventType">Event Type to Test</Label>
            <select
              id="eventType"
              value={selectedEventType}
              onChange={(e) => setSelectedEventType(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
            >
              {testEventTypes.map((event) => (
                <option key={event.type} value={event.type}>
                  {event.label} ({event.category})
                </option>
              ))}
            </select>
          </div>

          {/* Test Results */}
          {testResult && (
            <div className={`border rounded-lg p-4 ${
              testResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-start space-x-3">
                {testResult.success ? (
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
                )}
                <div className="flex-1">
                  <h5 className={`font-semibold ${
                    testResult.success ? 'text-green-900' : 'text-red-900'
                  }`}>
                    {testResult.success ? 'Test Successful' : 'Test Failed'}
                  </h5>
                  
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Delivery ID:</span>
                      <Badge variant="outline" className="font-mono text-xs">
                        {testResult.deliveryId}
                      </Badge>
                    </div>
                    
                    {testResult.statusCode && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Status Code:</span>
                        <Badge variant={testResult.statusCode < 300 ? "success" : "destructive"}>
                          {testResult.statusCode}
                        </Badge>
                      </div>
                    )}

                    {testResult.responseTime && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Response Time:</span>
                        <Badge variant="outline">
                          {testResult.responseTime}ms
                        </Badge>
                      </div>
                    )}

                    {testResult.error && (
                      <div className="mt-2">
                        <span className="text-sm font-medium text-red-900">Error:</span>
                        <p className="text-sm text-red-800 mt-1 font-mono bg-red-100 p-2 rounded">
                          {testResult.error}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && !testResult && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
                <div>
                  <h5 className="font-semibold text-red-900">Test Error</h5>
                  <p className="text-red-800 text-sm mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Clock className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <h5 className="font-semibold text-yellow-900">Test Information</h5>
                <p className="text-yellow-800 text-sm mt-1">
                  This will send a test event to your webhook endpoint. The test payload will be marked 
                  as a test event and should not trigger production workflows.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={isTesting}>
            Close
          </Button>
          <Button 
            onClick={handleTest}
            disabled={isTesting}
            className="flex items-center space-x-2"
          >
            {isTesting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Testing...</span>
              </>
            ) : (
              <>
                <TestTube className="h-4 w-4" />
                <span>Send Test</span>
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}