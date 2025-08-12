/**
 * Webhook Dashboard Component
 * Main dashboard for webhook management and monitoring
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  TrendingUp,
  Settings,
  Eye,
  TestTube
} from 'lucide-react';
import { WebhookList } from './WebhookList';
import { WebhookCreateDialog } from './WebhookCreateDialog';
import { WebhookAnalytics } from './WebhookAnalytics';
import { SystemHealthOverview } from './SystemHealthOverview';
import type { WebhookConfig } from '@/types/webhooks';

interface WebhookDashboardProps {
  userId: string;
}

interface DashboardStats {
  totalWebhooks: number;
  activeWebhooks: number;
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  averageSuccessRate: number;
  averageResponseTime: number;
  recentAlerts: number;
}

export function WebhookDashboard({ userId }: WebhookDashboardProps) {
  const [activeTab, setActiveTab] = useState('webhooks');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    totalWebhooks: 0,
    activeWebhooks: 0,
    totalDeliveries: 0,
    successfulDeliveries: 0,
    failedDeliveries: 0,
    averageSuccessRate: 0,
    averageResponseTime: 0,
    recentAlerts: 0
  });
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, [userId]);

  const loadDashboardData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Load webhooks
      const webhooksResponse = await fetch('/api/v1/webhooks');
      if (!webhooksResponse.ok) {
        throw new Error('Failed to load webhooks');
      }
      const webhooksData = await webhooksResponse.json();
      setWebhooks(webhooksData.webhooks || []);

      // Calculate stats from webhooks data
      const totalWebhooks = webhooksData.webhooks?.length || 0;
      const activeWebhooks = webhooksData.webhooks?.filter((w: WebhookConfig) => w.isActive).length || 0;

      setStats({
        totalWebhooks,
        activeWebhooks,
        totalDeliveries: 0, // Will be loaded from analytics
        successfulDeliveries: 0,
        failedDeliveries: 0,
        averageSuccessRate: 95, // Placeholder
        averageResponseTime: 1200, // Placeholder
        recentAlerts: 2 // Placeholder
      });

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleWebhookCreated = (webhook: WebhookConfig) => {
    setWebhooks(prev => [...prev, webhook]);
    setShowCreateDialog(false);
    setStats(prev => ({
      ...prev,
      totalWebhooks: prev.totalWebhooks + 1,
      activeWebhooks: webhook.isActive ? prev.activeWebhooks + 1 : prev.activeWebhooks
    }));
  };

  const handleWebhookUpdated = (updatedWebhook: WebhookConfig) => {
    setWebhooks(prev => prev.map(w => w.id === updatedWebhook.id ? updatedWebhook : w));
  };

  const handleWebhookDeleted = (webhookId: string) => {
    const deletedWebhook = webhooks.find(w => w.id === webhookId);
    setWebhooks(prev => prev.filter(w => w.id !== webhookId));
    setStats(prev => ({
      ...prev,
      totalWebhooks: prev.totalWebhooks - 1,
      activeWebhooks: deletedWebhook?.isActive ? prev.activeWebhooks - 1 : prev.activeWebhooks
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-500">Loading webhook dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center space-x-3">
          <AlertTriangle className="h-6 w-6 text-red-500" />
          <div>
            <h3 className="text-red-800 font-semibold">Error Loading Dashboard</h3>
            <p className="text-red-600">{error}</p>
          </div>
        </div>
        <Button 
          onClick={loadDashboardData}
          className="mt-4"
          variant="outline"
        >
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Webhook Management</h1>
          <p className="text-gray-500 mt-1">
            Manage your webhook endpoints and monitor their performance
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="flex items-center space-x-2">
          <Plus className="h-4 w-4" />
          <span>Create Webhook</span>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Webhooks</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalWebhooks}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <Settings className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center">
            <Badge variant={stats.activeWebhooks > 0 ? "success" : "secondary"}>
              {stats.activeWebhooks} active
            </Badge>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Success Rate</p>
              <p className="text-3xl font-bold text-gray-900">{stats.averageSuccessRate}%</p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <div className="mt-4">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-green-600 h-2 rounded-full" 
                style={{ width: `${stats.averageSuccessRate}%` }}
              />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Avg Response Time</p>
              <p className="text-3xl font-bold text-gray-900">{stats.averageResponseTime}ms</p>
            </div>
            <div className="p-3 bg-yellow-50 rounded-lg">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
          <div className="mt-4">
            <Badge variant={stats.averageResponseTime < 1000 ? "success" : 
                           stats.averageResponseTime < 3000 ? "warning" : "destructive"}>
              {stats.averageResponseTime < 1000 ? 'Excellent' :
               stats.averageResponseTime < 3000 ? 'Good' : 'Slow'}
            </Badge>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Recent Alerts</p>
              <p className="text-3xl font-bold text-gray-900">{stats.recentAlerts}</p>
            </div>
            <div className="p-3 bg-red-50 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
          </div>
          <div className="mt-4">
            <Badge variant={stats.recentAlerts === 0 ? "success" : 
                           stats.recentAlerts < 5 ? "warning" : "destructive"}>
              {stats.recentAlerts === 0 ? 'All Clear' : 'Attention Required'}
            </Badge>
          </div>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="webhooks" className="flex items-center space-x-2">
            <Settings className="h-4 w-4" />
            <span>Webhooks</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center space-x-2">
            <TrendingUp className="h-4 w-4" />
            <span>Analytics</span>
          </TabsTrigger>
          <TabsTrigger value="monitoring" className="flex items-center space-x-2">
            <Activity className="h-4 w-4" />
            <span>Monitoring</span>
          </TabsTrigger>
          <TabsTrigger value="system" className="flex items-center space-x-2">
            <Eye className="h-4 w-4" />
            <span>System Health</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="webhooks" className="space-y-6">
          <WebhookList 
            webhooks={webhooks}
            onWebhookUpdated={handleWebhookUpdated}
            onWebhookDeleted={handleWebhookDeleted}
          />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <WebhookAnalytics 
            webhooks={webhooks}
            stats={stats}
          />
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Webhook Health Status */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Webhook Health Status</h3>
              <div className="space-y-4">
                {webhooks.length === 0 ? (
                  <p className="text-gray-500">No webhooks configured yet.</p>
                ) : (
                  webhooks.slice(0, 5).map((webhook) => (
                    <div key={webhook.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className={`h-3 w-3 rounded-full ${webhook.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                        <div>
                          <p className="font-medium">{webhook.name}</p>
                          <p className="text-sm text-gray-500">{webhook.integrationType}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={webhook.isActive ? "success" : "secondary"}>
                          {webhook.isActive ? 'Healthy' : 'Inactive'}
                        </Badge>
                        <Button size="sm" variant="ghost">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>

            {/* Recent Activity */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
              <div className="space-y-4">
                <div className="text-center text-gray-500 py-8">
                  <Activity className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No recent webhook activity to display.</p>
                  <p className="text-sm">Activity will appear here once webhooks start receiving events.</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Event Log */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Event Delivery Log</h3>
              <Button variant="outline" size="sm">
                <TestTube className="h-4 w-4 mr-2" />
                Test Event
              </Button>
            </div>
            <div className="text-center text-gray-500 py-8">
              <Clock className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>No webhook deliveries yet.</p>
              <p className="text-sm">Delivery logs will appear here once events are sent to your webhooks.</p>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-6">
          <SystemHealthOverview />
        </TabsContent>
      </Tabs>

      {/* Create Webhook Dialog */}
      <WebhookCreateDialog 
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onWebhookCreated={handleWebhookCreated}
      />
    </div>
  );
}