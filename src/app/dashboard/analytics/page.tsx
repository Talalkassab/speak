'use client';

import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar,
  Download,
  Refresh,
  Settings,
  AlertCircle,
  TrendingUp,
  Users,
  MessageSquare,
  FileText,
  DollarSign,
  Clock,
  Shield,
  Activity
} from 'lucide-react';
import { AnalyticsMetrics, AnalyticsFilter, TimeRange } from '@/types/analytics';

// Import dashboard components
import OverviewCards from '@/components/analytics/OverviewCards';
import UsageChart from '@/components/analytics/UsageChart';
import CostBreakdown from '@/components/analytics/CostBreakdown';
import PerformanceMetrics from '@/components/analytics/PerformanceMetrics';
import ComplianceScore from '@/components/analytics/ComplianceScore';
import UserActivityHeatmap from '@/components/analytics/UserActivityHeatmap';
import PopularQueries from '@/components/analytics/PopularQueries';
import RealTimeIndicators from '@/components/analytics/RealTimeIndicators';
import CostOptimization from '@/components/analytics/CostOptimization';
import ExportReports from '@/components/analytics/ExportReports';
import AlertsPanel from '@/components/analytics/AlertsPanel';

interface AnalyticsDashboardPageProps {
  searchParams?: {
    tab?: string;
    period?: string;
    export?: string;
  };
}

const AnalyticsDashboardPage: React.FC<AnalyticsDashboardPageProps> = ({
  searchParams
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsMetrics | null>(null);
  const [activeTab, setActiveTab] = useState(searchParams?.tab || 'overview');
  const [timeRange, setTimeRange] = useState<TimeRange>({
    start: new Date(new Date().setDate(new Date().getDate() - 30)),
    end: new Date(),
    period: 'day'
  });
  const [language, setLanguage] = useState<'ar' | 'en'>('ar');
  const [refreshing, setRefreshing] = useState(false);

  // Fetch analytics data
  const fetchAnalyticsData = async (filters?: AnalyticsFilter) => {
    try {
      setRefreshing(true);
      const queryParams = new URLSearchParams({
        start: timeRange.start.toISOString(),
        end: timeRange.end.toISOString(),
        period: timeRange.period,
        ...(filters?.departments && { departments: filters.departments.join(',') }),
        ...(filters?.users && { users: filters.users.join(',') }),
        ...(filters?.languages && { languages: filters.languages.join(',') })
      });

      const response = await fetch(`/api/v1/analytics/metrics?${queryParams}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch analytics: ${response.statusText}`);
      }

      const result = await response.json();
      setAnalyticsData(result.data);
      setError(null);
    } catch (err) {
      console.error('Analytics fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load analytics data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Real-time updates
  useEffect(() => {
    fetchAnalyticsData();

    // Set up real-time updates every 30 seconds
    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchAnalyticsData();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [timeRange]);

  const handleRefresh = () => {
    fetchAnalyticsData();
  };

  const handleTimeRangeChange = (newRange: TimeRange) => {
    setTimeRange(newRange);
  };

  const isRTL = language === 'ar';

  const labels = isRTL ? {
    title: 'لوحة تحليلات الموارد البشرية',
    subtitle: 'رؤى شاملة حول أداء منصة الذكاء الاصطناعي للموارد البشرية',
    overview: 'نظرة عامة',
    usage: 'تحليل الاستخدام',
    costs: 'إدارة التكاليف',
    performance: 'مراقبة الأداء',
    compliance: 'الامتثال للأنظمة',
    reports: 'التقارير والتصدير',
    refresh: 'تحديث',
    export: 'تصدير',
    settings: 'الإعدادات',
    loading: 'جاري التحميل...',
    error: 'حدث خطأ في تحميل البيانات',
    retry: 'إعادة المحاولة',
    realTime: 'الوقت الفعلي',
    lastUpdated: 'آخر تحديث',
    autoRefresh: 'التحديث التلقائي',
  } : {
    title: 'HR Analytics Dashboard',
    subtitle: 'Comprehensive insights into your HR AI platform performance',
    overview: 'Overview',
    usage: 'Usage Analytics',
    costs: 'Cost Management',
    performance: 'Performance',
    compliance: 'Compliance',
    reports: 'Reports & Export',
    refresh: 'Refresh',
    export: 'Export',
    settings: 'Settings',
    loading: 'Loading...',
    error: 'Error loading analytics data',
    retry: 'Retry',
    realTime: 'Real-time',
    lastUpdated: 'Last updated',
    autoRefresh: 'Auto-refresh',
  };

  if (loading && !analyticsData) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className={`text-center ${isRTL ? 'font-arabic' : ''}`}>
          <Activity className="h-12 w-12 animate-spin text-saudi-green-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {labels.loading}
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            {isRTL ? 'جاري تحميل بيانات التحليلات...' : 'Loading analytics data...'}
          </p>
        </div>
      </div>
    );
  }

  if (error && !analyticsData) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className={`text-center max-w-md mx-auto ${isRTL ? 'font-arabic' : ''}`}>
          <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {labels.error}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {error}
          </p>
          <Button onClick={handleRefresh} className="bg-saudi-green-600 hover:bg-saudi-green-700">
            {labels.retry}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-gray-900 p-4 lg:p-8 ${isRTL ? 'rtl font-arabic' : 'ltr'}`}>
      {/* Header */}
      <div className={`mb-8 ${isRTL ? 'text-right' : 'text-left'}`}>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className={`text-3xl font-bold text-saudi-navy-800 dark:text-white ${isRTL ? 'font-arabic-heading' : ''}`}>
              {labels.title}
            </h1>
            <p className={`text-gray-600 dark:text-gray-400 mt-2 ${isRTL ? 'font-arabic' : ''}`}>
              {labels.subtitle}
            </p>
          </div>
          
          <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
            {/* Real-time Status */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className={`text-sm text-gray-600 dark:text-gray-400 ${isRTL ? 'font-arabic' : ''}`}>
                  {labels.realTime}
                </span>
              </div>
              {analyticsData && (
                <span className={`text-xs text-gray-500 ${isRTL ? 'font-arabic' : ''}`}>
                  {labels.lastUpdated}: {new Date().toLocaleTimeString(isRTL ? 'ar-SA' : 'en-US')}
                </span>
              )}
            </div>

            {/* Action Buttons */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className={isRTL ? 'font-arabic' : ''}
            >
              <Refresh className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''} ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {labels.refresh}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              className={isRTL ? 'font-arabic' : ''}
            >
              <Download className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {labels.export}
            </Button>

            <Button
              variant="outline"
              size="sm"
              className={isRTL ? 'font-arabic' : ''}
            >
              <Settings className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {labels.settings}
            </Button>
          </div>
        </div>

        {/* Real-time Indicators */}
        {analyticsData && (
          <div className="mt-6">
            <RealTimeIndicators
              data={analyticsData.activity}
              language={language}
              className="mb-4"
            />
          </div>
        )}
      </div>

      {/* Main Dashboard */}
      <div className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className={`grid w-full grid-cols-3 lg:grid-cols-6 ${isRTL ? 'font-arabic' : ''}`}>
            <TabsTrigger value="overview" className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <TrendingUp className="h-4 w-4" />
              {labels.overview}
            </TabsTrigger>
            <TabsTrigger value="usage" className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Activity className="h-4 w-4" />
              {labels.usage}
            </TabsTrigger>
            <TabsTrigger value="costs" className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <DollarSign className="h-4 w-4" />
              {labels.costs}
            </TabsTrigger>
            <TabsTrigger value="performance" className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Clock className="h-4 w-4" />
              {labels.performance}
            </TabsTrigger>
            <TabsTrigger value="compliance" className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Shield className="h-4 w-4" />
              {labels.compliance}
            </TabsTrigger>
            <TabsTrigger value="reports" className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <FileText className="h-4 w-4" />
              {labels.reports}
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6 mt-6">
            {analyticsData && (
              <>
                <OverviewCards
                  data={analyticsData}
                  language={language}
                  timeRange={timeRange}
                />
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <UsageChart
                    data={analyticsData.usage}
                    language={language}
                    chartType="line"
                  />
                  
                  <UserActivityHeatmap
                    data={analyticsData.usage.peakUsageHours}
                    language={language}
                  />
                </div>
                
                <AlertsPanel language={language} />
              </>
            )}
          </TabsContent>

          {/* Usage Analytics Tab */}
          <TabsContent value="usage" className="space-y-6 mt-6">
            {analyticsData && (
              <>
                <UsageChart
                  data={analyticsData.usage}
                  language={language}
                  chartType="area"
                  height={500}
                />
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <PopularQueries language={language} />
                  <UserActivityHeatmap
                    data={analyticsData.usage.peakUsageHours}
                    language={language}
                  />
                </div>
              </>
            )}
          </TabsContent>

          {/* Cost Management Tab */}
          <TabsContent value="costs" className="space-y-6 mt-6">
            {analyticsData && (
              <>
                <CostBreakdown
                  data={analyticsData.cost}
                  language={language}
                />
                
                <CostOptimization
                  data={analyticsData.cost}
                  language={language}
                />
              </>
            )}
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-6 mt-6">
            {analyticsData && (
              <>
                <PerformanceMetrics
                  data={analyticsData.performance}
                  language={language}
                />
              </>
            )}
          </TabsContent>

          {/* Compliance Tab */}
          <TabsContent value="compliance" className="space-y-6 mt-6">
            {analyticsData && (
              <>
                <ComplianceScore
                  data={analyticsData.compliance}
                  language={language}
                />
              </>
            )}
          </TabsContent>

          {/* Reports & Export Tab */}
          <TabsContent value="reports" className="space-y-6 mt-6">
            <ExportReports
              data={analyticsData}
              language={language}
              timeRange={timeRange}
              onTimeRangeChange={handleTimeRangeChange}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AnalyticsDashboardPage;