'use client';

import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  TrendingUp, Users, MessageCircle, Clock, Star, Target,
  Activity, Zap, ThumbsUp, AlertTriangle, RefreshCw, Download
} from 'lucide-react';
import { cn } from '@/libs/utils';

interface SuggestionAnalyticsProps {
  organizationId: string;
  timeRange?: 'day' | 'week' | 'month' | 'quarter';
  language?: 'ar' | 'en' | 'both';
  className?: string;
}

interface AnalyticsData {
  overview: {
    totalSuggestions: number;
    acceptanceRate: number;
    averageResponseTime: number;
    userSatisfaction: number;
    topPerformingCategory: string;
    improvementTrend: number;
  };
  categoryPerformance: Array<{
    category: string;
    categoryArabic: string;
    suggestionsCount: number;
    acceptanceRate: number;
    averageRating: number;
    responseTime: number;
  }>;
  userEngagement: Array<{
    date: string;
    totalQueries: number;
    refinedQueries: number;
    templatesUsed: number;
    relatedQuestionsClicked: number;
  }>;
  popularSuggestions: Array<{
    text: string;
    textArabic: string;
    frequency: number;
    category: string;
    successRate: number;
  }>;
  qualityMetrics: Array<{
    metric: string;
    metricArabic: string;
    current: number;
    previous: number;
    trend: 'up' | 'down' | 'stable';
  }>;
  timeDistribution: Array<{
    hour: number;
    queries: number;
    success: number;
  }>;
}

const COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16'
];

const MetricCard: React.FC<{
  title: string;
  titleArabic: string;
  value: string | number;
  change?: number;
  icon: React.ElementType;
  language: 'ar' | 'en' | 'both';
  trend?: 'up' | 'down' | 'stable';
  format?: 'number' | 'percentage' | 'time';
}> = ({ title, titleArabic, value, change, icon: Icon, language, trend, format = 'number' }) => {
  const displayTitle = language === 'ar' ? titleArabic : title;
  
  const formatValue = (val: string | number) => {
    if (typeof val === 'string') return val;
    
    switch (format) {
      case 'percentage':
        return `${val.toFixed(1)}%`;
      case 'time':
        return `${val.toFixed(0)}ms`;
      default:
        return val.toLocaleString();
    }
  };

  const getTrendColor = () => {
    if (!trend || trend === 'stable') return 'text-gray-500';
    return trend === 'up' ? 'text-green-500' : 'text-red-500';
  };

  const getTrendIcon = () => {
    if (!trend || trend === 'stable') return '→';
    return trend === 'up' ? '↗' : '↘';
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
            <Icon size={24} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {displayTitle}
            </h3>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatValue(value)}
            </p>
          </div>
        </div>
        
        {change !== undefined && (
          <div className={cn("flex items-center gap-1 text-sm", getTrendColor())}>
            <span>{getTrendIcon()}</span>
            <span>{Math.abs(change).toFixed(1)}%</span>
          </div>
        )}
      </div>
    </div>
  );
};

export const SuggestionAnalytics: React.FC<SuggestionAnalyticsProps> = ({
  organizationId,
  timeRange = 'week',
  language = 'both',
  className
}) => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'categories' | 'engagement' | 'quality'>('overview');

  const fetchAnalytics = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        timeRange,
        language,
        organizationId
      });

      const response = await fetch(`/api/v1/analytics/suggestions?${params}`);
      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error?.message || 'Failed to fetch analytics');
      }
    } catch (err) {
      console.error('Analytics fetch error:', err);
      setError('Failed to fetch analytics data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [organizationId, timeRange, language]);

  const exportData = async () => {
    try {
      const response = await fetch('/api/v1/analytics/suggestions/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          timeRange,
          language,
          format: 'excel'
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `suggestion-analytics-${timeRange}-${Date.now()}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  if (isLoading) {
    return (
      <div className={cn("space-y-6", className)}>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">
            {language === 'ar' ? 'جاري تحميل التحليلات...' : 'Loading analytics...'}
          </p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={cn("text-center py-12", className)}>
        <AlertTriangle size={48} className="mx-auto mb-4 text-red-500 opacity-50" />
        <p className="text-red-500 mb-4">{error || 'No data available'}</p>
        <button
          onClick={fetchAnalytics}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors mx-auto"
        >
          <RefreshCw size={16} />
          {language === 'ar' ? 'إعادة المحاولة' : 'Retry'}
        </button>
      </div>
    );
  }

  const tabs = [
    { 
      id: 'overview' as const, 
      label: language === 'ar' ? 'نظرة عامة' : 'Overview',
      icon: Activity 
    },
    { 
      id: 'categories' as const, 
      label: language === 'ar' ? 'الفئات' : 'Categories',
      icon: Target 
    },
    { 
      id: 'engagement' as const, 
      label: language === 'ar' ? 'المشاركة' : 'Engagement',
      icon: Users 
    },
    { 
      id: 'quality' as const, 
      label: language === 'ar' ? 'الجودة' : 'Quality',
      icon: Star 
    }
  ];

  return (
    <div className={cn("space-y-6", className)} dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {language === 'ar' ? 'تحليلات نظام الاقتراحات' : 'Suggestion System Analytics'}
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            {language === 'ar' 
              ? `تحليل شامل لأداء نظام الاقتراحات خلال ${timeRange === 'day' ? 'اليوم' : timeRange === 'week' ? 'الأسبوع' : timeRange === 'month' ? 'الشهر' : 'الربع'} الماضي`
              : `Comprehensive analysis of suggestion system performance over the past ${timeRange}`
            }
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <select
            value={timeRange}
            onChange={(e) => window.location.search = `?timeRange=${e.target.value}&language=${language}`}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="day">{language === 'ar' ? 'اليوم' : 'Day'}</option>
            <option value="week">{language === 'ar' ? 'الأسبوع' : 'Week'}</option>
            <option value="month">{language === 'ar' ? 'الشهر' : 'Month'}</option>
            <option value="quarter">{language === 'ar' ? 'الربع' : 'Quarter'}</option>
          </select>
          
          <button
            onClick={exportData}
            className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
          >
            <Download size={16} />
            {language === 'ar' ? 'تصدير' : 'Export'}
          </button>
          
          <button
            onClick={fetchAnalytics}
            className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <RefreshCw size={20} />
          </button>
        </div>
      </div>

      {/* Overview Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Suggestions"
          titleArabic="إجمالي الاقتراحات"
          value={data.overview.totalSuggestions}
          change={data.overview.improvementTrend}
          icon={MessageCircle}
          language={language}
          trend={data.overview.improvementTrend > 0 ? 'up' : data.overview.improvementTrend < 0 ? 'down' : 'stable'}
        />
        
        <MetricCard
          title="Acceptance Rate"
          titleArabic="معدل القبول"
          value={data.overview.acceptanceRate}
          icon={ThumbsUp}
          language={language}
          format="percentage"
        />
        
        <MetricCard
          title="Avg Response Time"
          titleArabic="متوسط وقت الاستجابة"
          value={data.overview.averageResponseTime}
          icon={Zap}
          language={language}
          format="time"
        />
        
        <MetricCard
          title="User Satisfaction"
          titleArabic="رضا المستخدمين"
          value={data.overview.userSatisfaction}
          icon={Star}
          language={language}
          format="percentage"
        />
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors",
                  activeTab === tab.id
                    ? "border-blue-500 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
                )}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {activeTab === 'overview' && (
          <>
            {/* Engagement Timeline */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                {language === 'ar' ? 'مشاركة المستخدمين عبر الوقت' : 'User Engagement Over Time'}
              </h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.userEngagement}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="totalQueries" 
                      stroke={COLORS[0]} 
                      strokeWidth={2}
                      name={language === 'ar' ? 'إجمالي الاستعلامات' : 'Total Queries'}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="refinedQueries" 
                      stroke={COLORS[1]} 
                      strokeWidth={2}
                      name={language === 'ar' ? 'الاستعلامات المحسنة' : 'Refined Queries'}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="templatesUsed" 
                      stroke={COLORS[2]} 
                      strokeWidth={2}
                      name={language === 'ar' ? 'القوالب المستخدمة' : 'Templates Used'}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Popular Suggestions */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                {language === 'ar' ? 'الاقتراحات الأكثر شعبية' : 'Most Popular Suggestions'}
              </h3>
              <div className="space-y-3">
                {data.popularSuggestions.slice(0, 10).map((suggestion, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {language === 'ar' ? suggestion.textArabic : suggestion.text}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {suggestion.category} • {suggestion.frequency} {language === 'ar' ? 'مرة' : 'times'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className={cn(
                        "px-2 py-1 rounded-full text-xs font-medium",
                        suggestion.successRate >= 80 ? "bg-green-100 text-green-700" :
                        suggestion.successRate >= 60 ? "bg-yellow-100 text-yellow-700" :
                        "bg-red-100 text-red-700"
                      )}>
                        {suggestion.successRate.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {activeTab === 'categories' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category Performance Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                {language === 'ar' ? 'أداء الفئات' : 'Category Performance'}
              </h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.categoryPerformance}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey={language === 'ar' ? 'categoryArabic' : 'category'} 
                      angle={-45}
                      textAnchor="end"
                      height={100}
                    />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="acceptanceRate" fill={COLORS[0]} name={language === 'ar' ? 'معدل القبول' : 'Acceptance Rate'} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Category Distribution */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                {language === 'ar' ? 'توزيع الفئات' : 'Category Distribution'}
              </h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.categoryPerformance}
                      dataKey="suggestionsCount"
                      nameKey={language === 'ar' ? 'categoryArabic' : 'category'}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({name, percent}) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {data.categoryPerformance.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'engagement' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Time Distribution */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                {language === 'ar' ? 'توزيع الوقت اليومي' : 'Daily Time Distribution'}
              </h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.timeDistribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <Tooltip />
                    <Bar 
                      dataKey="queries" 
                      fill={COLORS[0]} 
                      name={language === 'ar' ? 'الاستعلامات' : 'Queries'} 
                    />
                    <Bar 
                      dataKey="success" 
                      fill={COLORS[1]} 
                      name={language === 'ar' ? 'ناجحة' : 'Successful'} 
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* User Engagement Metrics */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                {language === 'ar' ? 'مقاييس المشاركة' : 'Engagement Metrics'}
              </h3>
              <div className="space-y-4">
                {data.userEngagement.slice(-7).map((day, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">{day.date}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-medium">{day.totalQueries} queries</span>
                      <div className="w-20 h-2 bg-gray-200 rounded-full">
                        <div 
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${(day.relatedQuestionsClicked / day.totalQueries * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'quality' && (
          <div className="space-y-6">
            {/* Quality Metrics */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                {language === 'ar' ? 'مقاييس الجودة' : 'Quality Metrics'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.qualityMetrics.map((metric, index) => (
                  <div key={index} className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {language === 'ar' ? metric.metricArabic : metric.metric}
                      </h4>
                      <span className={cn(
                        "text-xs",
                        metric.trend === 'up' ? 'text-green-500' :
                        metric.trend === 'down' ? 'text-red-500' :
                        'text-gray-500'
                      )}>
                        {metric.trend === 'up' ? '↗' : metric.trend === 'down' ? '↘' : '→'}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-bold text-gray-900 dark:text-white">
                        {metric.current.toFixed(1)}
                      </span>
                      <span className="text-sm text-gray-500">
                        vs {metric.previous.toFixed(1)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};