'use client';

import React, { useState, useEffect } from 'react';
import { Activity, Zap, Users, MessageSquare, AlertCircle, CheckCircle, WifiOff, Wifi } from 'lucide-react';
import { ActivityMetrics } from '@/types/analytics';
import { Badge } from '@/components/ui/badge';

interface RealTimeIndicatorsProps {
  data: ActivityMetrics;
  language?: 'ar' | 'en';
  className?: string;
}

interface RealTimeMetric {
  id: string;
  label: string;
  value: string | number;
  trend: 'up' | 'down' | 'stable';
  status: 'healthy' | 'warning' | 'error';
  icon: React.ElementType;
  lastUpdated: Date;
}

const RealTimeIndicators: React.FC<RealTimeIndicatorsProps> = ({
  data,
  language = 'ar',
  className = ''
}) => {
  const [isConnected, setIsConnected] = useState(true);
  const [realTimeMetrics, setRealTimeMetrics] = useState<RealTimeMetric[]>([]);
  const [lastUpdateTime, setLastUpdateTime] = useState(new Date());
  
  const isRTL = language === 'ar';

  const labels = isRTL ? {
    realTimeStatus: 'الحالة في الوقت الفعلي',
    connectedUsers: 'المستخدمون المتصلون',
    activeConversations: 'المحادثات النشطة',
    systemLoad: 'حمولة النظام',
    responseRate: 'معدل الاستجابة',
    connected: 'متصل',
    disconnected: 'منقطع',
    healthy: 'صحي',
    warning: 'تحذير',
    error: 'خطأ',
    lastUpdated: 'آخر تحديث',
    secondsAgo: 'ثانية مضت',
    minutesAgo: 'دقيقة مضت',
    justNow: 'الآن',
    autoRefresh: 'التحديث التلقائي'
  } : {
    realTimeStatus: 'Real-time Status',
    connectedUsers: 'Connected Users',
    activeConversations: 'Active Conversations',
    systemLoad: 'System Load',
    responseRate: 'Response Rate',
    connected: 'Connected',
    disconnected: 'Disconnected',
    healthy: 'Healthy',
    warning: 'Warning',
    error: 'Error',
    lastUpdated: 'Last updated',
    secondsAgo: 'sec ago',
    minutesAgo: 'min ago',
    justNow: 'Just now',
    autoRefresh: 'Auto-refresh'
  };

  // Simulate real-time metrics
  useEffect(() => {
    const updateMetrics = () => {
      const now = new Date();
      
      // Simulate real-time data with slight variations
      const baseMetrics: RealTimeMetric[] = [
        {
          id: 'connected-users',
          label: labels.connectedUsers,
          value: Math.floor(data.activeUsers * (0.8 + Math.random() * 0.4)),
          trend: Math.random() > 0.5 ? 'up' : 'stable',
          status: 'healthy',
          icon: Users,
          lastUpdated: now
        },
        {
          id: 'active-conversations',
          label: labels.activeConversations,
          value: Math.floor(data.totalUsers * 0.15 * (0.7 + Math.random() * 0.6)),
          trend: Math.random() > 0.6 ? 'up' : Math.random() > 0.3 ? 'stable' : 'down',
          status: 'healthy',
          icon: MessageSquare,
          lastUpdated: now
        },
        {
          id: 'system-load',
          label: labels.systemLoad,
          value: `${Math.floor(20 + Math.random() * 50)}%`,
          trend: Math.random() > 0.7 ? 'up' : 'stable',
          status: Math.random() > 0.8 ? 'warning' : 'healthy',
          icon: Activity,
          lastUpdated: now
        },
        {
          id: 'response-rate',
          label: labels.responseRate,
          value: `${(95 + Math.random() * 4).toFixed(1)}%`,
          trend: Math.random() > 0.3 ? 'stable' : 'up',
          status: Math.random() > 0.9 ? 'warning' : 'healthy',
          icon: Zap,
          lastUpdated: now
        }
      ];

      setRealTimeMetrics(baseMetrics);
      setLastUpdateTime(now);
    };

    // Initial update
    updateMetrics();

    // Update every 5 seconds
    const interval = setInterval(updateMetrics, 5000);

    // Simulate connection status changes occasionally
    const connectionInterval = setInterval(() => {
      if (Math.random() > 0.95) {
        setIsConnected(false);
        setTimeout(() => setIsConnected(true), 2000);
      }
    }, 10000);

    return () => {
      clearInterval(interval);
      clearInterval(connectionInterval);
    };
  }, [data, labels]);

  // Format time ago
  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 10) {
      return labels.justNow;
    } else if (diffInSeconds < 60) {
      return `${diffInSeconds} ${labels.secondsAgo}`;
    } else {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} ${labels.minutesAgo}`;
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800';
      case 'error':
        return 'text-red-600 bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200 dark:bg-gray-700 dark:border-gray-600';
    }
  };

  // Get trend icon and color
  const getTrendIndicator = (trend: string) => {
    switch (trend) {
      case 'up':
        return <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />;
      case 'down':
        return <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />;
      default:
        return <div className="w-2 h-2 bg-gray-400 rounded-full" />;
    }
  };

  return (
    <div className={`${className}`}>
      {/* Header */}
      <div className={`flex items-center justify-between mb-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <h3 className={`text-lg font-semibold text-saudi-navy-800 dark:text-white ${isRTL ? 'font-arabic-heading' : ''}`}>
            {labels.realTimeStatus}
          </h3>
          
          {/* Connection Status */}
          <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            {isConnected ? (
              <>
                <Wifi className="h-4 w-4 text-green-600" />
                <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                  {labels.connected}
                </Badge>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-red-600" />
                <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
                  {labels.disconnected}
                </Badge>
              </>
            )}
          </div>
        </div>

        {/* Last Updated */}
        <div className={`text-sm text-gray-500 dark:text-gray-400 ${isRTL ? 'font-arabic' : ''}`}>
          {labels.lastUpdated}: {formatTimeAgo(lastUpdateTime)}
        </div>
      </div>

      {/* Real-time Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {realTimeMetrics.map((metric) => {
          const IconComponent = metric.icon;
          const statusColor = getStatusColor(metric.status);
          
          return (
            <div
              key={metric.id}
              className={`
                ${statusColor} 
                border rounded-lg p-4 transition-all duration-300
                ${!isConnected ? 'opacity-50' : 'hover:scale-105'}
              `}
            >
              <div className={`flex items-start justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div className={`${isRTL ? 'text-right' : 'text-left'} flex-1`}>
                  <div className={`flex items-center gap-2 mb-2 ${isRTL ? 'flex-row-reverse justify-start' : 'justify-start'}`}>
                    <p className={`text-sm font-medium ${isRTL ? 'font-arabic' : ''}`}>
                      {metric.label}
                    </p>
                    {getTrendIndicator(metric.trend)}
                  </div>
                  
                  <div className="flex items-baseline gap-2">
                    <p className="text-2xl font-bold">
                      {typeof metric.value === 'number' 
                        ? new Intl.NumberFormat(isRTL ? 'ar-SA' : 'en-US').format(metric.value)
                        : metric.value
                      }
                    </p>
                    
                    {/* Status Indicator */}
                    {metric.status === 'healthy' && (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    )}
                    {metric.status === 'warning' && (
                      <AlertCircle className="h-4 w-4 text-yellow-600" />
                    )}
                    {metric.status === 'error' && (
                      <AlertCircle className="h-4 w-4 text-red-600" />
                    )}
                  </div>

                  {/* Last Updated for this metric */}
                  <p className={`text-xs text-gray-500 mt-2 ${isRTL ? 'font-arabic' : ''}`}>
                    {formatTimeAgo(metric.lastUpdated)}
                  </p>
                </div>

                <div className={`${isRTL ? 'ml-3' : 'mr-3'}`}>
                  <IconComponent className="h-6 w-6" />
                  {/* Live indicator dot */}
                  {isConnected && (
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-ping absolute -mt-8 ml-5" />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Connection Quality Indicator */}
      <div className="mt-4 flex items-center justify-center">
        <div className={`flex items-center gap-2 px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-full text-sm ${isRTL ? 'flex-row-reverse font-arabic' : ''}`}>
          <div className={`flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className={`w-1 h-3 rounded-full ${
                  isConnected 
                    ? i < 3 ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                    : 'bg-red-500 animate-pulse'
                } ${i === 0 ? 'animate-pulse' : ''}`}
              />
            ))}
          </div>
          <span className="text-gray-600 dark:text-gray-400">
            {labels.autoRefresh}
          </span>
        </div>
      </div>
    </div>
  );
};

export default RealTimeIndicators;