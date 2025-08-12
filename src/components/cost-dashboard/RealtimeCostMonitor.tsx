'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Activity,
  Clock,
  DollarSign,
  TrendingUp,
  Zap,
  AlertTriangle,
  PlayCircle,
  PauseCircle,
  RefreshCw,
  BarChart3,
  Users,
  Server,
  Eye
} from 'lucide-react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import type { RealtimeMetrics } from '@/types/enhanced-cost-analytics';

interface RealtimeCostMonitorProps {
  data: RealtimeMetrics;
  language?: 'ar' | 'en';
  className?: string;
}

const RealtimeCostMonitor: React.FC<RealtimeCostMonitorProps> = ({
  data,
  language = 'ar',
  className = ''
}) => {
  const [isLive, setIsLive] = useState(true);
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const [currentMetrics, setCurrentMetrics] = useState(data);

  const isRTL = language === 'ar';

  const labels = isRTL ? {
    title: 'المراقبة المباشرة للتكاليف',
    subtitle: 'تتبع التكاليف والاستخدام في الوقت الفعلي',
    currentHourCost: 'تكلفة الساعة الحالية',
    activeRequests: 'الطلبات النشطة',
    avgCostPerRequest: 'متوسط التكلفة لكل طلب',
    costVelocity: 'سرعة التكلفة',
    peakHourProjection: 'توقع ساعة الذروة',
    alertsActive: 'التنبيهات النشطة',
    optimizationsActive: 'التحسينات النشطة',
    liveMonitoring: 'المراقبة المباشرة',
    pauseMonitoring: 'إيقاف المراقبة',
    resumeMonitoring: 'استئناف المراقبة',
    refreshData: 'تحديث البيانات',
    lastUpdated: 'آخر تحديث',
    costTrend: 'اتجاه التكلفة',
    requestVolume: 'حجم الطلبات',
    systemLoad: 'حمولة النظام',
    costBreakdown: 'تفكيك التكلفة',
    hourlyTrend: 'الاتجاه بالساعة',
    requestTypes: 'أنواع الطلبات',
    perHour: 'في الساعة',
    requests: 'طلبات',
    realTimeActivity: 'النشاط المباشر',
    high: 'عالي',
    medium: 'متوسط',
    low: 'منخفض',
    critical: 'حرج',
    normal: 'طبيعي',
    elevated: 'مرتفع',
    status: 'الحالة',
    healthy: 'صحي',
    warning: 'تحذير',
    error: 'خطأ'
  } : {
    title: 'Real-time Cost Monitor',
    subtitle: 'Track costs and usage in real-time',
    currentHourCost: 'Current Hour Cost',
    activeRequests: 'Active Requests',
    avgCostPerRequest: 'Avg Cost Per Request',
    costVelocity: 'Cost Velocity',
    peakHourProjection: 'Peak Hour Projection',
    alertsActive: 'Active Alerts',
    optimizationsActive: 'Active Optimizations',
    liveMonitoring: 'Live Monitoring',
    pauseMonitoring: 'Pause Monitoring',
    resumeMonitoring: 'Resume Monitoring',
    refreshData: 'Refresh Data',
    lastUpdated: 'Last Updated',
    costTrend: 'Cost Trend',
    requestVolume: 'Request Volume',
    systemLoad: 'System Load',
    costBreakdown: 'Cost Breakdown',
    hourlyTrend: 'Hourly Trend',
    requestTypes: 'Request Types',
    perHour: 'per hour',
    requests: 'requests',
    realTimeActivity: 'Real-time Activity',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
    critical: 'Critical',
    normal: 'Normal',
    elevated: 'Elevated',
    status: 'Status',
    healthy: 'Healthy',
    warning: 'Warning',
    error: 'Error'
  };

  useEffect(() => {
    if (!isLive) return;

    const interval = setInterval(() => {
      // Simulate real-time data updates
      const newDataPoint = {
        time: new Date().toLocaleTimeString(),
        cost: currentMetrics.currentHourCost + (Math.random() - 0.5) * 0.1,
        requests: currentMetrics.activeRequests + Math.floor((Math.random() - 0.5) * 10),
        velocity: currentMetrics.costVelocity + (Math.random() - 0.5) * 0.2
      };

      setHistoricalData(prev => {
        const updated = [...prev, newDataPoint].slice(-20); // Keep last 20 points
        return updated;
      });

      // Update current metrics
      setCurrentMetrics(prev => ({
        ...prev,
        currentHourCost: newDataPoint.cost,
        activeRequests: Math.max(0, newDataPoint.requests),
        costVelocity: newDataPoint.velocity,
        lastUpdated: new Date().toISOString()
      }));
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [isLive, currentMetrics]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(isRTL ? 'ar-SA' : 'en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 3,
    }).format(amount);
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString(isRTL ? 'ar-SA' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getStatusColor = (value: number, thresholds: { low: number; high: number }) => {
    if (value <= thresholds.low) return 'text-green-600 bg-green-100';
    if (value <= thresholds.high) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getVelocityStatus = (velocity: number) => {
    if (velocity < 1) return { label: labels.low, color: 'bg-green-100 text-green-800' };
    if (velocity < 2) return { label: labels.normal, color: 'bg-blue-100 text-blue-800' };
    if (velocity < 3) return { label: labels.elevated, color: 'bg-yellow-100 text-yellow-800' };
    return { label: labels.critical, color: 'bg-red-100 text-red-800' };
  };

  const requestTypesData = [
    { name: isRTL ? 'رسائل الدردشة' : 'Chat Messages', value: 45, fill: '#1e40af' },
    { name: isRTL ? 'معالجة المستندات' : 'Document Processing', value: 30, fill: '#7c3aed' },
    { name: isRTL ? 'إنشاء القوالب' : 'Template Generation', value: 15, fill: '#059669' },
    { name: isRTL ? 'أخرى' : 'Other', value: 10, fill: '#dc2626' }
  ];

  const velocityStatus = getVelocityStatus(currentMetrics.costVelocity);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className={isRTL ? 'text-right' : 'text-left'}>
          <h3 className={`text-xl font-semibold text-saudi-navy-800 dark:text-white ${isRTL ? 'font-arabic-heading' : ''}`}>
            {labels.title}
          </h3>
          <p className={`text-sm text-gray-600 dark:text-gray-400 mt-1 ${isRTL ? 'font-arabic' : ''}`}>
            {labels.subtitle}
          </p>
        </div>

        <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
          {/* Live Status */}
          <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={`w-3 h-3 rounded-full ${isLive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
            <span className={`text-sm font-medium ${isLive ? 'text-green-600' : 'text-gray-500'} ${isRTL ? 'font-arabic' : ''}`}>
              {isLive ? labels.liveMonitoring : labels.pauseMonitoring}
            </span>
          </div>

          {/* Controls */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsLive(!isLive)}
            className={isRTL ? 'font-arabic' : ''}
          >
            {isLive ? (
              <PauseCircle className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
            ) : (
              <PlayCircle className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
            )}
            {isLive ? labels.pauseMonitoring : labels.resumeMonitoring}
          </Button>

          <Button variant="outline" size="sm" className={isRTL ? 'font-arabic' : ''}>
            <RefreshCw className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
            {labels.refreshData}
          </Button>
        </div>
      </div>

      {/* Real-time Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200">
          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <p className={`text-sm font-medium text-blue-700 dark:text-blue-400 ${isRTL ? 'font-arabic' : ''}`}>
                {labels.currentHourCost}
              </p>
              <p className="text-2xl font-bold text-blue-900 dark:text-blue-200">
                {formatCurrency(currentMetrics.currentHourCost)}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-blue-600" />
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200">
          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <p className={`text-sm font-medium text-green-700 dark:text-green-400 ${isRTL ? 'font-arabic' : ''}`}>
                {labels.activeRequests}
              </p>
              <p className="text-2xl font-bold text-green-900 dark:text-green-200">
                {currentMetrics.activeRequests}
              </p>
            </div>
            <Activity className="h-8 w-8 text-green-600" />
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200">
          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <p className={`text-sm font-medium text-purple-700 dark:text-purple-400 ${isRTL ? 'font-arabic' : ''}`}>
                {labels.avgCostPerRequest}
              </p>
              <p className="text-2xl font-bold text-purple-900 dark:text-purple-200">
                {formatCurrency(currentMetrics.avgCostPerRequest)}
              </p>
            </div>
            <BarChart3 className="h-8 w-8 text-purple-600" />
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border-orange-200">
          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <p className={`text-sm font-medium text-orange-700 dark:text-orange-400 ${isRTL ? 'font-arabic' : ''}`}>
                {labels.costVelocity}
              </p>
              <p className="text-2xl font-bold text-orange-900 dark:text-orange-200">
                {currentMetrics.costVelocity.toFixed(2)}
              </p>
              <Badge className={`${velocityStatus.color} text-xs mt-1 ${isRTL ? 'font-arabic' : ''}`}>
                {velocityStatus.label}
              </Badge>
            </div>
            <TrendingUp className="h-8 w-8 text-orange-600" />
          </div>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Real-time Cost Trend */}
        <Card className="p-6">
          <h4 className={`text-lg font-semibold text-gray-900 dark:text-white mb-4 ${isRTL ? 'font-arabic-heading text-right' : ''}`}>
            {labels.costTrend}
          </h4>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={historicalData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="time" tick={{ fontSize: 12, fill: '#6b7280' }} />
              <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
              <Tooltip 
                formatter={(value: any) => [formatCurrency(value), labels.currentHourCost]}
                labelFormatter={(label) => `${labels.lastUpdated}: ${label}`}
              />
              <Area
                type="monotone"
                dataKey="cost"
                stroke="#1e40af"
                fill="url(#costGradient)"
                strokeWidth={2}
              />
              <defs>
                <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1e40af" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#1e40af" stopOpacity={0}/>
                </linearGradient>
              </defs>
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Request Types Distribution */}
        <Card className="p-6">
          <h4 className={`text-lg font-semibold text-gray-900 dark:text-white mb-4 ${isRTL ? 'font-arabic-heading text-right' : ''}`}>
            {labels.requestTypes}
          </h4>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={requestTypesData}
                cx="50%"
                cy="50%"
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              >
                {requestTypesData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <p className={`text-sm font-medium text-gray-600 dark:text-gray-400 ${isRTL ? 'font-arabic' : ''}`}>
                {labels.peakHourProjection}
              </p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(currentMetrics.peakHourProjection)}
              </p>
            </div>
            <Clock className="h-6 w-6 text-gray-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <p className={`text-sm font-medium text-gray-600 dark:text-gray-400 ${isRTL ? 'font-arabic' : ''}`}>
                {labels.alertsActive}
              </p>
              <div className="flex items-center gap-2">
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {currentMetrics.alertsActive}
                </p>
                {currentMetrics.alertsActive > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {labels.critical}
                  </Badge>
                )}
              </div>
            </div>
            <AlertTriangle className={`h-6 w-6 ${currentMetrics.alertsActive > 0 ? 'text-red-500' : 'text-gray-500'}`} />
          </div>
        </Card>

        <Card className="p-4">
          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <p className={`text-sm font-medium text-gray-600 dark:text-gray-400 ${isRTL ? 'font-arabic' : ''}`}>
                {labels.optimizationsActive}
              </p>
              <div className="flex items-center gap-2">
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {currentMetrics.optimizationsActive}
                </p>
                {currentMetrics.optimizationsActive > 0 && (
                  <Badge variant="secondary" className={`text-xs ${isRTL ? 'font-arabic' : ''}`}>
                    {labels.normal}
                  </Badge>
                )}
              </div>
            </div>
            <Zap className={`h-6 w-6 ${currentMetrics.optimizationsActive > 0 ? 'text-blue-500' : 'text-gray-500'}`} />
          </div>
        </Card>
      </div>

      {/* Footer */}
      <div className={`text-sm text-gray-500 dark:text-gray-400 ${isRTL ? 'text-right font-arabic' : 'text-left'}`}>
        {labels.lastUpdated}: {formatTime(currentMetrics.lastUpdated)}
      </div>
    </div>
  );
};

export default RealtimeCostMonitor;