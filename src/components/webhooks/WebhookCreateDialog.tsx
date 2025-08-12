/**
 * Webhook Create Dialog Component
 * Modal for creating new webhooks
 */

'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, 
  X, 
  AlertTriangle, 
  CheckCircle,
  Settings,
  Shield,
  Zap,
  Mail
} from 'lucide-react';
import type { 
  CreateWebhookRequest, 
  WebhookConfig, 
  IntegrationType,
  WebhookAuthType,
  WebhookEventType 
} from '@/types/webhooks';

interface WebhookCreateDialogProps {
  open: boolean;
  onClose: () => void;
  onWebhookCreated: (webhook: WebhookConfig) => void;
}

const integrationTypes: Array<{
  type: IntegrationType;
  name: string;
  description: string;
  icon: string;
  isAvailable: boolean;
}> = [
  {
    type: 'custom',
    name: 'Custom HTTP',
    description: 'Send webhooks to any HTTP endpoint',
    icon: '🔗',
    isAvailable: true
  },
  {
    type: 'slack',
    name: 'Slack',
    description: 'Send notifications to Slack channels',
    icon: '💬',
    isAvailable: true
  },
  {
    type: 'microsoft_teams',
    name: 'Microsoft Teams',
    description: 'Send notifications to Teams channels',
    icon: '👥',
    isAvailable: true
  },
  {
    type: 'email',
    name: 'Email',
    description: 'Send notifications via email',
    icon: '📧',
    isAvailable: true
  },
  {
    type: 'sms',
    name: 'SMS',
    description: 'Send notifications via SMS',
    icon: '📱',
    isAvailable: false
  },
  {
    type: 'discord',
    name: 'Discord',
    description: 'Send notifications to Discord channels',
    icon: '🎮',
    isAvailable: false
  }
];

const availableEventTypes: Array<{
  type: WebhookEventType;
  category: string;
  description: string;
}> = [
  // Document Events
  { type: 'document.uploaded', category: 'Document', description: 'New document uploaded' },
  { type: 'document.processing.completed', category: 'Document', description: 'Document processing finished' },
  { type: 'document.processing.failed', category: 'Document', description: 'Document processing failed' },
  { type: 'document.analysis.completed', category: 'Document', description: 'Document analysis completed' },
  
  // Chat Events
  { type: 'chat.conversation.created', category: 'Chat', description: 'New chat conversation started' },
  { type: 'chat.ai.response.generated', category: 'Chat', description: 'AI response generated' },
  { type: 'chat.conversation.archived', category: 'Chat', description: 'Conversation archived' },
  
  // Analytics Events
  { type: 'analytics.usage.threshold', category: 'Analytics', description: 'Usage threshold exceeded' },
  { type: 'analytics.cost.alert', category: 'Analytics', description: 'Cost alert triggered' },
  { type: 'analytics.performance.degraded', category: 'Analytics', description: 'Performance degradation detected' },
  
  // Compliance Events
  { type: 'compliance.policy.violation', category: 'Compliance', description: 'Policy violation detected' },
  { type: 'compliance.audit.trigger', category: 'Compliance', description: 'Audit event triggered' },
  
  // System Events
  { type: 'system.health.alert', category: 'System', description: 'System health alert' },
  { type: 'system.error.critical', category: 'System', description: 'Critical system error' },
  { type: 'system.maintenance.scheduled', category: 'System', description: 'Maintenance scheduled' }
];

export function WebhookCreateDialog({ open, onClose, onWebhookCreated }: WebhookCreateDialogProps) {
  const [currentStep, setCurrentStep] = useState<'integration' | 'configuration' | 'events' | 'authentication'>('integration');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<CreateWebhookRequest>({
    name: '',
    description: '',
    url: '',
    eventTypes: [],
    integrationType: 'custom',
    authType: 'none',
    timeoutSeconds: 30,
    retryCount: 3,
    rateLimitPerHour: 1000,
    rateLimitPerDay: 10000
  });

  const handleIntegrationSelect = (type: IntegrationType) => {
    setFormData(prev => ({
      ...prev,
      integrationType: type,
      // Reset URL and auth when changing integration type
      url: '',
      authConfig: {}
    }));
    setCurrentStep('configuration');
  };

  const handleEventToggle = (eventType: WebhookEventType) => {
    setFormData(prev => ({
      ...prev,
      eventTypes: prev.eventTypes.includes(eventType)
        ? prev.eventTypes.filter(et => et !== eventType)
        : [...prev.eventTypes, eventType]
    }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/v1/webhooks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create webhook');
      }

      const webhook = await response.json();
      onWebhookCreated(webhook);
      onClose();
    } catch (error) {
      console.error('Error creating webhook:', error);
      setError(error instanceof Error ? error.message : 'Failed to create webhook');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'integration':
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Choose Integration Type</h3>
              <p className="text-gray-600 mb-6">
                Select how you want to receive webhook notifications
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {integrationTypes.map((integration) => (
                <div
                  key={integration.type}
                  className={`relative p-4 border rounded-lg cursor-pointer transition-colors ${
                    integration.isAvailable
                      ? 'hover:border-blue-300 hover:bg-blue-50'
                      : 'opacity-50 cursor-not-allowed bg-gray-50'
                  } ${formData.integrationType === integration.type ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
                  onClick={() => integration.isAvailable && handleIntegrationSelect(integration.type)}
                >
                  <div className="flex items-start space-x-3">
                    <div className="text-2xl">{integration.icon}</div>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{integration.name}</h4>
                      <p className="text-sm text-gray-600">{integration.description}</p>
                    </div>
                    {!integration.isAvailable && (
                      <Badge variant="secondary" className="text-xs">
                        Coming Soon
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'configuration':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">Webhook Configuration</h3>
              <p className="text-gray-600 mb-6">
                Configure your webhook endpoint details
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Webhook Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Production Alerts"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Optional description for this webhook"
                  rows={3}
                  className="mt-1"
                />
              </div>

              {renderIntegrationSpecificFields()}

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
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentStep('integration')}>
                Back
              </Button>
              <Button onClick={() => setCurrentStep('events')}>
                Next: Select Events
              </Button>
            </div>
          </div>
        );

      case 'events':
        const eventsByCategory = availableEventTypes.reduce((acc, event) => {
          if (!acc[event.category]) {
            acc[event.category] = [];
          }
          acc[event.category].push(event);
          return acc;
        }, {} as Record<string, typeof availableEventTypes>);

        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">Select Events</h3>
              <p className="text-gray-600 mb-6">
                Choose which events should trigger this webhook
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFormData(prev => ({ ...prev, eventTypes: availableEventTypes.map(e => e.type) }))}
                >
                  Select All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFormData(prev => ({ ...prev, eventTypes: [] }))}
                >
                  Select None
                </Button>
                <Badge variant="secondary">
                  {formData.eventTypes.length} selected
                </Badge>
              </div>

              {Object.entries(eventsByCategory).map(([category, events]) => (
                <div key={category} className="border rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">{category}</h4>
                  <div className="space-y-2">
                    {events.map((event) => (
                      <label
                        key={event.type}
                        className="flex items-center space-x-3 cursor-pointer hover:bg-gray-50 p-2 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={formData.eventTypes.includes(event.type)}
                          onChange={() => handleEventToggle(event.type)}
                          className="rounded border-gray-300"
                        />
                        <div>
                          <div className="font-medium text-sm">{event.type}</div>
                          <div className="text-xs text-gray-600">{event.description}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentStep('configuration')}>
                Back
              </Button>
              <Button onClick={() => setCurrentStep('authentication')}>
                Next: Authentication
              </Button>
            </div>
          </div>
        );

      case 'authentication':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">Authentication</h3>
              <p className="text-gray-600 mb-6">
                Configure authentication for your webhook endpoint
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="authType">Authentication Type</Label>
                <select
                  id="authType"
                  value={formData.authType}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    authType: e.target.value as WebhookAuthType,
                    authConfig: {}
                  }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                >
                  <option value="none">None</option>
                  <option value="api_key">API Key</option>
                  <option value="bearer_token">Bearer Token</option>
                  <option value="hmac_sha256">HMAC SHA256 (Recommended)</option>
                </select>
              </div>

              {renderAuthenticationFields()}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <h5 className="font-semibold text-blue-900">Security Recommendation</h5>
                    <p className="text-blue-800 text-sm mt-1">
                      We recommend using HMAC SHA256 authentication to verify webhook authenticity. 
                      A secret key will be generated automatically.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentStep('events')}>
                Back
              </Button>
              <Button 
                onClick={handleSubmit}
                disabled={!formData.name || !formData.url || isSubmitting}
                className="flex items-center space-x-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    <span>Create Webhook</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const renderIntegrationSpecificFields = () => {
    switch (formData.integrationType) {
      case 'custom':
      case 'webhook':
        return (
          <div>
            <Label htmlFor="url">Endpoint URL *</Label>
            <Input
              id="url"
              type="url"
              value={formData.url}
              onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
              placeholder="https://your-app.com/webhooks"
              className="mt-1"
            />
          </div>
        );

      case 'slack':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="slackUrl">Slack Webhook URL *</Label>
              <Input
                id="slackUrl"
                type="url"
                value={formData.url}
                onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                placeholder="https://hooks.slack.com/services/..."
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="slackChannel">Channel</Label>
              <Input
                id="slackChannel"
                value={formData.integrationConfig?.slack?.channel || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  integrationConfig: {
                    ...prev.integrationConfig,
                    slack: { ...prev.integrationConfig?.slack, channel: e.target.value }
                  }
                }))}
                placeholder="#general"
                className="mt-1"
              />
            </div>
          </div>
        );

      case 'microsoft_teams':
        return (
          <div>
            <Label htmlFor="teamsUrl">Teams Webhook URL *</Label>
            <Input
              id="teamsUrl"
              type="url"
              value={formData.url}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                url: e.target.value,
                integrationConfig: {
                  ...prev.integrationConfig,
                  teams: { webhookUrl: e.target.value }
                }
              }))}
              placeholder="https://outlook.office.com/webhook/..."
              className="mt-1"
            />
          </div>
        );

      case 'email':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="emailTo">Recipient Email(s) *</Label>
              <Input
                id="emailTo"
                type="email"
                value={formData.integrationConfig?.email?.to?.join(', ') || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  integrationConfig: {
                    ...prev.integrationConfig,
                    email: { 
                      ...prev.integrationConfig?.email, 
                      to: e.target.value.split(',').map(email => email.trim()) 
                    }
                  }
                }))}
                placeholder="alerts@company.com"
                className="mt-1"
              />
              <p className="text-sm text-gray-500 mt-1">
                Separate multiple emails with commas
              </p>
            </div>
            <div>
              <Label htmlFor="emailSubject">Subject Template</Label>
              <Input
                id="emailSubject"
                value={formData.integrationConfig?.email?.subject || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  integrationConfig: {
                    ...prev.integrationConfig,
                    email: { ...prev.integrationConfig?.email, subject: e.target.value }
                  }
                }))}
                placeholder="HR Intelligence Alert: {{event.type}}"
                className="mt-1"
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const renderAuthenticationFields = () => {
    switch (formData.authType) {
      case 'api_key':
        return (
          <div>
            <Label htmlFor="apiKey">API Key</Label>
            <Input
              id="apiKey"
              type="password"
              value={formData.authConfig?.apiKey || ''}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                authConfig: { ...prev.authConfig, apiKey: e.target.value }
              }))}
              placeholder="Enter your API key"
              className="mt-1"
            />
          </div>
        );

      case 'bearer_token':
        return (
          <div>
            <Label htmlFor="bearerToken">Bearer Token</Label>
            <Input
              id="bearerToken"
              type="password"
              value={formData.authConfig?.bearerToken || ''}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                authConfig: { ...prev.authConfig, bearerToken: e.target.value }
              }))}
              placeholder="Enter your bearer token"
              className="mt-1"
            />
          </div>
        );

      case 'hmac_sha256':
        return (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <h5 className="font-semibold text-green-900">HMAC SHA256 Authentication</h5>
                <p className="text-green-800 text-sm mt-1">
                  A secure secret key will be generated automatically for signature verification.
                  You can find this key in the webhook details after creation.
                </p>
              </div>
            </div>
          </div>
        );

      case 'none':
      default:
        return (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <h5 className="font-semibold text-yellow-900">No Authentication</h5>
                <p className="text-yellow-800 text-sm mt-1">
                  Your webhook endpoint will not include authentication headers. 
                  Make sure your endpoint can handle unauthenticated requests securely.
                </p>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Zap className="h-5 w-5" />
            <span>Create New Webhook</span>
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {/* Step Indicator */}
          <div className="flex items-center space-x-4 mb-8">
            {[
              { step: 'integration', label: 'Integration', icon: Settings },
              { step: 'configuration', label: 'Configuration', icon: Settings },
              { step: 'events', label: 'Events', icon: Zap },
              { step: 'authentication', label: 'Security', icon: Shield }
            ].map(({ step, label, icon: Icon }, index) => (
              <div
                key={step}
                className={`flex items-center space-x-2 ${
                  currentStep === step ? 'text-blue-600' : 'text-gray-400'
                }`}
              >
                <div className={`p-2 rounded-full ${
                  currentStep === step ? 'bg-blue-100' : 'bg-gray-100'
                }`}>
                  <Icon className="h-4 w-4" />
                </div>
                <span className="text-sm font-medium">{label}</span>
                {index < 3 && (
                  <div className="w-8 h-px bg-gray-300 ml-2" />
                )}
              </div>
            ))}
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
                <div>
                  <h5 className="font-semibold text-red-900">Error Creating Webhook</h5>
                  <p className="text-red-800 text-sm mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Step Content */}
          {renderStepContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
}