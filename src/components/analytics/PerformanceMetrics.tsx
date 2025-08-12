'use client';

import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import { PerformanceMetrics as PerfMetrics } from '@/types/analytics';
import { 
  Zap, 
  Clock, 
  AlertCircle, 
  CheckCircle, 
  TrendingUp, 
  TrendingDown,
  Activity,
  Cpu,
  HardDrive,
  Wifi
} from 'lucide-react';

interface PerformanceMetricsProps {
  data: PerfMetrics;
  language?: 'ar' | 'en';
  className?: string;
  realtime?: boolean;
}

const PerformanceMetrics: React.FC<PerformanceMetricsProps> = ({
  data,
  language = 'ar',
  className = '',
  realtime = false,
}) => {
  const isRTL = language === 'ar';
  const [realtimeData, setRealtimeData] = useState(data);

  // Simulate real-time updates
  useEffect(() => {
    if (!realtime) return;

    const interval = setInterval(() => {
      setRealtimeData(prevData => ({
        ...prevData,
        averageResponseTime: Math.max(0.1, prevData.averageResponseTime + (Math.random() - 0.5) * 0.2),
        errorRate: Math.max(0, Math.min(1, prevData.errorRate + (Math.random() - 0.5) * 0.01)),
        throughput: Math.max(0, prevData.throughput + (Math.random() - 0.5) * 20),
        systemHealth: {
          ...prevData.systemHealth,
          cpuUsage: Math.max(0, Math.min(100, prevData.systemHealth.cpuUsage + (Math.random() - 0.5) * 10)),
          memoryUsage: Math.max(0, Math.min(100, prevData.systemHealth.memoryUsage + (Math.random() - 0.5) * 5)),
          activeConnections: Math.max(0, prevData.systemHealth.activeConnections + Math.floor((Math.random() - 0.5) * 10)),
          queueDepth: Math.max(0, prevData.systemHealth.queueDepth + Math.floor((Math.random() - 0.5) * 3)),
        },
      }));
    }, 3000);

    return () => clearInterval(interval);
  }, [realtime]);

  const currentData = realtime ? realtimeData : data;

  const labels = isRTL ? {
    performance: 'مقاييس الأداء',
    responseTime: 'زمن الاستجابة',
    errorRate: 'معدل الأخطاء',
    uptime: 'وقت التشغيل',
    throughput: 'معدل المعالجة',
    systemHealth: 'صحة النظام',
    responseDistribution: 'توزيع زمن الاستجابة',
    errorBreakdown: 'تفصيل الأخطاء',
    realTimeMetrics: 'المقاييس المباشرة',
    cpuUsage: 'استخدام المعالج',
    memoryUsage: 'استخدام الذاكرة',
    diskUsage: 'استخدام القرص',
    networkUsage: 'استخدام الشبكة',
    activeConnections: 'الاتصالات النشطة',
    queueDepth: 'عمق القائمة',
    averageResponseTime: 'متوسط زمن الاستجابة',
    p95ResponseTime: 'زمن الاستجابة P95',
    p99ResponseTime: 'زمن الاستجابة P99',
    healthy: 'سليم',
    degraded: 'منخفض الأداء',
    down: 'متوقف',
  } : {
    performance: 'Performance Metrics',
    responseTime: 'Response Time',
    errorRate: 'Error Rate',
    uptime: 'Uptime',
    throughput: 'Throughput',
    systemHealth: 'System Health',
    responseDistribution: 'Response Time Distribution',
    errorBreakdown: 'Error Breakdown',
    realTimeMetrics: 'Real-time Metrics',
    cpuUsage: 'CPU Usage',
    memoryUsage: 'Memory Usage',
    diskUsage: 'Disk Usage',
    networkUsage: 'Network Usage',
    activeConnections: 'Active Connections',
    queueDepth: 'Queue Depth',
    averageResponseTime: 'Average Response Time',
    p95ResponseTime: 'P95 Response Time',
    p99ResponseTime: 'P99 Response Time',
    healthy: 'Healthy',
    degraded: 'Degraded',
    down: 'Down',
  };

  // Prepare chart data
  const responseTimeData = currentData.responseTimeDistribution.map(item => ({
    range: item.range,
    count: item.count,
    percentage: item.percentage,
  }));

  const errorData = currentData.errorBreakdown.map((error, index) => ({
    type: error.errorType,
    count: error.count,
    percentage: error.percentage,
    fill: ['#ef4444', '#f59e0b', '#3b82f6'][index % 3],
  }));

  // System health colors
  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600';
      case 'degraded': return 'text-yellow-600';
      case 'down': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'degraded': return <AlertCircle className="h-5 w-5 text-yellow-600" />;
      case 'down': return <AlertCircle className="h-5 w-5 text-red-600" />;
      default: return <AlertCircle className="h-5 w-5 text-gray-600" />;
    }
  };

  const formatResponseTime = (time: number) => {
    return `${time.toFixed(2)}s`;
  };

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(2)}%`;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className={`bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg ${isRTL ? 'text-right' : 'text-left'}`}>
          <p className={`text-sm font-medium text-gray-900 dark:text-gray-100 mb-2 ${isRTL ? 'font-arabic' : ''}`}>
            {label}
          </p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className={`text-sm ${isRTL ? 'font-arabic' : ''}`} style={{ color: entry.color }}>
              {`${entry.name}: ${entry.value} (${entry.payload.percentage}%)`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`w-full space-y-6 ${className}`}>
      {/* Header */}
      <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className={isRTL ? 'text-right' : 'text-left'}>
          <h3 className={`text-lg font-semibold text-saudi-navy-800 dark:text-white ${isRTL ? 'font-arabic-heading' : ''}`}>
            {labels.performance}
          </h3>
          <p className={`text-sm text-gray-600 dark:text-gray-400 mt-1 ${isRTL ? 'font-arabic' : ''}`}>
            {isRTL ? 'مراقبة أداء النظام والاستجابة في الوقت الفعلي' : 'Real-time system performance and response monitoring'}
          </p>
        </div>
        {realtime && (
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <span className={`text-sm text-green-600 dark:text-green-400 ${isRTL ? 'font-arabic mr-2' : ''}`}>
              {isRTL ? 'مباشر' : 'Live'}
            </span>
          </div>
        )}
      </div>

      {/* Key Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <p className={`text-sm text-gray-600 dark:text-gray-400 ${isRTL ? 'font-arabic' : ''}`}>
                {labels.averageResponseTime}
              </p>
              <p className={`text-2xl font-bold ${
                currentData.averageResponseTime < 1 ? 'text-green-600' :
                currentData.averageResponseTime < 2 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {formatResponseTime(currentData.averageResponseTime)}
              </p>
              <p className={`text-xs text-gray-500 dark:text-gray-500 ${isRTL ? 'font-arabic' : ''}`}>
                P95: {formatResponseTime(currentData.p95ResponseTime)}
              </p>
            </div>
            <Clock className="h-8 w-8 text-saudi-navy-600" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <p className={`text-sm text-gray-600 dark:text-gray-400 ${isRTL ? 'font-arabic' : ''}`}>
                {labels.errorRate}
              </p>
              <p className={`text-2xl font-bold ${
                currentData.errorRate < 0.01 ? 'text-green-600' :
                currentData.errorRate < 0.05 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {formatPercentage(currentData.errorRate)}
              </p>
            </div>
            <AlertCircle className={`h-8 w-8 ${
              currentData.errorRate < 0.01 ? 'text-green-600' :
              currentData.errorRate < 0.05 ? 'text-yellow-600' : 'text-red-600'
            }`} />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <p className={`text-sm text-gray-600 dark:text-gray-400 ${isRTL ? 'font-arabic' : ''}`}>
                {labels.uptime}
              </p>
              <p className="text-2xl font-bold text-green-600">
                {currentData.uptime.toFixed(1)}%
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <p className={`text-sm text-gray-600 dark:text-gray-400 ${isRTL ? 'font-arabic' : ''}`}>
                {labels.throughput}
              </p>
              <p className="text-2xl font-bold text-saudi-green-600">
                {Math.round(currentData.throughput)}
              </p>
              <p className={`text-xs text-gray-500 dark:text-gray-500 ${isRTL ? 'font-arabic' : ''}`}>
                {isRTL ? 'طلب/دقيقة' : 'req/min'}
              </p>
            </div>
            <Zap className="h-8 w-8 text-saudi-green-600" />
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Response Time Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <h4 className={`text-md font-semibold text-saudi-navy-800 dark:text-white mb-4 ${isRTL ? 'font-arabic-heading text-right' : ''}`}>
            {labels.responseDistribution}
          </h4>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={responseTimeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="range" 
                tick={{ fontSize: 12, fill: '#6b7280' }}
                reversed={isRTL}
              />
              <YAxis 
                tick={{ fontSize: 12, fill: '#6b7280' }}
                orientation={isRTL ? 'right' : 'left'}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" fill="#1a365d" name="Count" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Error Breakdown */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <h4 className={`text-md font-semibold text-saudi-navy-800 dark:text-white mb-4 ${isRTL ? 'font-arabic-heading text-right' : ''}`}>
            {labels.errorBreakdown}
          </h4>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={errorData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={100}
                fill="#8884d8"
                dataKey="count"
                label={(entry) => `${entry.type} (${entry.percentage}%)`}
              >
                {errorData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* System Health Status */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <h4 className={`text-md font-semibold text-saudi-navy-800 dark:text-white ${isRTL ? 'font-arabic-heading' : ''}`}>
              {labels.systemHealth}
            </h4>
            <div className={`flex items-center space-x-2 ${isRTL ? 'space-x-reverse' : ''}`}>
              {getHealthIcon(currentData.systemHealth.status)}
              <span className={`text-sm font-medium ${getHealthColor(currentData.systemHealth.status)} ${isRTL ? 'font-arabic' : ''}`}>
                {labels[currentData.systemHealth.status as keyof typeof labels]}
              </span>
            </div>
          </div>
        </div>

        <div className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* CPU Usage */}
            <div className="flex items-center space-x-3">
              <Cpu className="h-6 w-6 text-saudi-navy-600" />
              <div className="flex-1">
                <div className={`flex justify-between items-center mb-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <span className={`text-sm font-medium text-gray-700 dark:text-gray-300 ${isRTL ? 'font-arabic' : ''}`}>
                    {labels.cpuUsage}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {currentData.systemHealth.cpuUsage}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      currentData.systemHealth.cpuUsage > 80 ? 'bg-red-500' :
                      currentData.systemHealth.cpuUsage > 60 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${currentData.systemHealth.cpuUsage}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Memory Usage */}
            <div className="flex items-center space-x-3">
              <Activity className="h-6 w-6 text-saudi-green-600" />
              <div className="flex-1">
                <div className={`flex justify-between items-center mb-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <span className={`text-sm font-medium text-gray-700 dark:text-gray-300 ${isRTL ? 'font-arabic' : ''}`}>
                    {labels.memoryUsage}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {currentData.systemHealth.memoryUsage}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      currentData.systemHealth.memoryUsage > 85 ? 'bg-red-500' :
                      currentData.systemHealth.memoryUsage > 70 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${currentData.systemHealth.memoryUsage}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Disk Usage */}
            <div className="flex items-center space-x-3">
              <HardDrive className="h-6 w-6 text-saudi-gold-600" />
              <div className="flex-1">
                <div className={`flex justify-between items-center mb-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <span className={`text-sm font-medium text-gray-700 dark:text-gray-300 ${isRTL ? 'font-arabic' : ''}`}>
                    {labels.diskUsage}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {currentData.systemHealth.diskUsage}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      currentData.systemHealth.diskUsage > 90 ? 'bg-red-500' :
                      currentData.systemHealth.diskUsage > 75 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${currentData.systemHealth.diskUsage}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Additional Metrics */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                <span className={`text-sm font-medium text-gray-700 dark:text-gray-300 ${isRTL ? 'font-arabic' : ''}`}>
                  {labels.activeConnections}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {currentData.systemHealth.activeConnections}
                </span>
              </div>
              
              <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                <span className={`text-sm font-medium text-gray-700 dark:text-gray-300 ${isRTL ? 'font-arabic' : ''}`}>
                  {labels.queueDepth}
                </span>
                <span className={`text-sm ${
                  currentData.systemHealth.queueDepth > 10 ? 'text-red-500' :
                  currentData.systemHealth.queueDepth > 5 ? 'text-yellow-500' : 'text-gray-500 dark:text-gray-400'
                }`}>
                  {currentData.systemHealth.queueDepth}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceMetrics;