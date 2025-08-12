'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { AlertTriangle, CheckCircle, XCircle, Activity, Zap, Database, Users, TrendingUp, RefreshCw } from 'lucide-react';

interface SystemMetrics {
  timestamp: string;
  system: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    metrics: {
      cpu: { usage: number; loadAverage: number[]; cores: number };
      memory: { total: number; used: number; free: number; usage_percent: number };
      disk: { usage_percent: number; available_gb: number; total_gb: number };
      process: {
        memory: NodeJS.MemoryUsage;
        cpu_usage: number;
        event_loop_lag: number;
        uptime: number;
        pid: number;
      };
      database: {
        active_connections: number;
        query_duration_avg: number;
        health_status: 'healthy' | 'degraded' | 'unhealthy';
      };
      external_services: Array<{
        name: string;
        status: 'healthy' | 'degraded' | 'unhealthy';
        response_time?: number;
        last_check: string;
      }>;
    };
    active_alerts: Array<{
      id: string;
      type: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      title: string;
      message: string;
      timestamp: string;
    }>;
  };
  performance: {
    memory: NodeJS.MemoryUsage;
    uptime: number;
    timestamp: string;
  };
  errors: {
    totalErrors: number;
    errorsByType: Record<string, number>;
    errorsBySeverity: Record<string, number>;
    recentErrors: Array<{
      id: string;
      type: string;
      severity: string;
      message: string;
      timestamp: string;
    }>;
  };
  usage: {
    organizationId: string;
    period: string;
    features: Record<string, number>;
    documents: {
      uploaded: number;
      processed: number;
      storage: number;
    };
    chat: {
      interactions: number;
      tokensUsed: number;
      cost: number;
    };
    api: {
      requests: number;
      errors: number;
      avgResponseTime: number;
    };
    users: {
      active: number;
      sessions: number;
    };
  };
  alerts: {
    active_alerts: number;
    resolved_today: number;
    by_severity: Record<string, number>;
    by_type: Record<string, number>;
    avg_resolution_time: number;
  };
}

interface HistoricalData {
  timestamp: string;
  cpu_usage: number;
  memory_usage: number;
  response_time: number;
  error_rate: number;
  requests_per_minute: number;
}

export default function SystemDashboard() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [historicalData, setHistoricalData] = useState<HistoricalData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30); // seconds

  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/metrics?format=json&type=all');
      if (!response.ok) {
        throw new Error(`Failed to fetch metrics: ${response.statusText}`);
      }
      const data = await response.json();
      setMetrics(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch metrics');
    } finally {
      setLoading(false);
    }
  };

  const fetchHistoricalData = async () => {
    try {
      // This would fetch historical metrics from your API
      // For now, we'll generate sample data
      const sampleData = Array.from({ length: 24 }, (_, i) => ({
        timestamp: new Date(Date.now() - (23 - i) * 60 * 60 * 1000).toISOString(),
        cpu_usage: Math.random() * 100,
        memory_usage: Math.random() * 100,
        response_time: Math.random() * 1000,
        error_rate: Math.random() * 10,
        requests_per_minute: Math.random() * 1000,
      }));
      setHistoricalData(sampleData);
    } catch (err) {
      console.error('Failed to fetch historical data:', err);
    }
  };

  useEffect(() => {
    fetchMetrics();
    fetchHistoricalData();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchMetrics, refreshInterval * 1000);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-500';
      case 'degraded': return 'text-yellow-500';
      case 'unhealthy': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-4 h-4" />;
      case 'degraded': return <AlertTriangle className="w-4 h-4" />;
      case 'unhealthy': return <XCircle className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'bg-blue-100 text-blue-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'critical': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatBytes = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin" />
        <span className="ml-2">Loading metrics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500">
        <XCircle className="w-8 h-8 mr-2" />
        <span>{error}</span>
        <Button onClick={fetchMetrics} className="ml-4" variant="outline">
          Retry
        </Button>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No metrics data available
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Monitoring Dashboard</h1>
          <p className="text-muted-foreground">
            Real-time system health and performance metrics
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            onClick={() => setAutoRefresh(!autoRefresh)}
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            Auto Refresh
          </Button>
          <Button onClick={fetchMetrics} variant="outline" size="sm">
            Refresh Now
          </Button>
        </div>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
            <div className={getStatusColor(metrics.system.status)}>
              {getStatusIcon(metrics.system.status)}
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">{metrics.system.status}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.system.active_alerts.length} active alerts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(metrics.system.metrics.cpu.usage)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Load: {metrics.system.metrics.cpu.loadAverage[0].toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(metrics.system.metrics.memory.usage_percent)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {formatBytes(metrics.system.metrics.memory.used)} / {formatBytes(metrics.system.metrics.memory.total)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Database</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">
              {metrics.system.metrics.database.health_status}
            </div>
            <p className="text-xs text-muted-foreground">
              {Math.round(metrics.system.metrics.database.query_duration_avg)}ms avg
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="errors">Errors</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* System Metrics Chart */}
            <Card>
              <CardHeader>
                <CardTitle>System Metrics (24h)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={historicalData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(value) => new Date(value).toLocaleString()}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="cpu_usage" stroke="#8884d8" name="CPU %" />
                    <Line type="monotone" dataKey="memory_usage" stroke="#82ca9d" name="Memory %" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Response Time Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Response Time (24h)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={historicalData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(value) => new Date(value).toLocaleString()}
                      formatter={(value: number) => [`${Math.round(value)}ms`, 'Response Time']}
                    />
                    <Area type="monotone" dataKey="response_time" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* External Services */}
          <Card>
            <CardHeader>
              <CardTitle>External Services</CardTitle>
              <CardDescription>Status of external service dependencies</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {metrics.system.metrics.external_services.map((service) => (
                  <div key={service.name} className="flex items-center justify-between p-2 border rounded">
                    <div className="flex items-center space-x-2">
                      <div className={getStatusColor(service.status)}>
                        {getStatusIcon(service.status)}
                      </div>
                      <span className="font-medium">{service.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium capitalize">{service.status}</div>
                      {service.response_time && (
                        <div className="text-xs text-muted-foreground">
                          {service.response_time}ms
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Process Memory</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Heap Used:</span>
                    <span>{formatBytes(metrics.performance.memory.heapUsed)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Heap Total:</span>
                    <span>{formatBytes(metrics.performance.memory.heapTotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>RSS:</span>
                    <span>{formatBytes(metrics.performance.memory.rss)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>External:</span>
                    <span>{formatBytes(metrics.performance.memory.external)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Event Loop</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Lag:</span>
                    <span>{Math.round(metrics.system.metrics.process.event_loop_lag)}ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Uptime:</span>
                    <span>{formatDuration(metrics.performance.uptime * 1000)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Database Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Avg Query Time:</span>
                    <span>{Math.round(metrics.system.metrics.database.query_duration_avg)}ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Active Connections:</span>
                    <span>{metrics.system.metrics.database.active_connections}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Status:</span>
                    <Badge className={getStatusColor(metrics.system.metrics.database.health_status)}>
                      {metrics.system.metrics.database.health_status}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Request Rate Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Request Rate & Error Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={historicalData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="timestamp" 
                    tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                  />
                  <YAxis yAxisId="requests" />
                  <YAxis yAxisId="errors" orientation="right" />
                  <Tooltip 
                    labelFormatter={(value) => new Date(value).toLocaleString()}
                  />
                  <Legend />
                  <Line 
                    yAxisId="requests"
                    type="monotone" 
                    dataKey="requests_per_minute" 
                    stroke="#8884d8" 
                    name="Requests/min" 
                  />
                  <Line 
                    yAxisId="errors"
                    type="monotone" 
                    dataKey="error_rate" 
                    stroke="#ff7300" 
                    name="Error Rate %" 
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="errors" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Error Statistics */}
            <Card>
              <CardHeader>
                <CardTitle>Error Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-3xl font-bold text-center">
                    {metrics.errors.totalErrors}
                  </div>
                  <div className="text-center text-muted-foreground">
                    Total Errors Today
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="font-medium">By Severity</h4>
                    {Object.entries(metrics.errors.errorsBySeverity).map(([severity, count]) => (
                      <div key={severity} className="flex items-center justify-between">
                        <Badge className={getSeverityColor(severity)}>
                          {severity}
                        </Badge>
                        <span className="font-medium">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Error Types */}
            <Card>
              <CardHeader>
                <CardTitle>Error Types</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={Object.entries(metrics.errors.errorsByType).map(([type, count]) => ({ type, count }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="type" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Recent Errors */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Errors</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {metrics.errors.recentErrors.slice(0, 10).map((error) => (
                  <div key={error.id} className="flex items-center justify-between p-3 border rounded">
                    <div className="flex items-center space-x-3">
                      <Badge className={getSeverityColor(error.severity)}>
                        {error.severity}
                      </Badge>
                      <div>
                        <div className="font-medium">{error.type}</div>
                        <div className="text-sm text-muted-foreground truncate max-w-md">
                          {error.message}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(error.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usage" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">API Requests</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.usage.api.requests.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  {metrics.usage.api.errors} errors ({((metrics.usage.api.errors / metrics.usage.api.requests) * 100).toFixed(2)}%)
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Chat Interactions</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.usage.chat.interactions.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  ${metrics.usage.chat.cost.toFixed(2)} cost
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Documents</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.usage.documents.processed}</div>
                <p className="text-xs text-muted-foreground">
                  {formatBytes(metrics.usage.documents.storage)} storage
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.usage.users.active}</div>
                <p className="text-xs text-muted-foreground">
                  {metrics.usage.users.sessions} sessions
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Feature Usage */}
          <Card>
            <CardHeader>
              <CardTitle>Feature Usage</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={Object.entries(metrics.usage.features).map(([feature, count]) => ({ feature, count }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="feature" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Active Alerts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-center text-red-500">
                  {metrics.alerts.active_alerts}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Resolved Today</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-center text-green-500">
                  {metrics.alerts.resolved_today}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Avg Resolution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-center">
                  {formatDuration(metrics.alerts.avg_resolution_time)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Active Alerts List */}
          <Card>
            <CardHeader>
              <CardTitle>Active Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {metrics.system.active_alerts.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
                    No active alerts
                  </div>
                ) : (
                  metrics.system.active_alerts.map((alert) => (
                    <div key={alert.id} className="flex items-center justify-between p-3 border rounded">
                      <div className="flex items-center space-x-3">
                        <Badge className={getSeverityColor(alert.severity)}>
                          {alert.severity}
                        </Badge>
                        <div>
                          <div className="font-medium">{alert.title}</div>
                          <div className="text-sm text-muted-foreground">
                            {alert.message}
                          </div>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(alert.timestamp).toLocaleString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}