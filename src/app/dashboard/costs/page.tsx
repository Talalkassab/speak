'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Target,
  Zap,
  AlertTriangle,
  Download,
  Settings,
  RefreshCw,
  Calendar,
  BarChart3,
  PieChart,
  Activity,
  Users,
  Clock,
  Lightbulb,
  CheckCircle,
  XCircle,
  Bell
} from 'lucide-react';

// Components
import CostOverviewCards from '@/components/cost-dashboard/CostOverviewCards';
import RealtimeCostMonitor from '@/components/cost-dashboard/RealtimeCostMonitor';
import BudgetManagement from '@/components/cost-dashboard/BudgetManagement';
import CostForecastingChart from '@/components/cost-dashboard/CostForecastingChart';
import ModelPerformanceAnalysis from '@/components/cost-dashboard/ModelPerformanceAnalysis';
import OptimizationRecommendations from '@/components/cost-dashboard/OptimizationRecommendations';
import CostAttributionBreakdown from '@/components/cost-dashboard/CostAttributionBreakdown';
import AlertsPanel from '@/components/cost-dashboard/AlertsPanel';
import ExportManager from '@/components/cost-dashboard/ExportManager';
import ROIAnalysisPanel from '@/components/cost-dashboard/ROIAnalysisPanel';

// Types
import type { ComprehensiveCostDashboardData } from '@/types/enhanced-cost-analytics';
import { useLanguage } from '@/hooks/useLanguage';

const CostOptimizationDashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<ComprehensiveCostDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const { language, toggleLanguage } = useLanguage();
  
  const isRTL = language === 'ar';

  const labels = isRTL ? {
    title: 'لوحة تحكم تحسين التكاليف',
    subtitle: 'مراقبة وتحسين تكاليف API للمنصة الذكية للموارد البشرية',
    overview: 'نظرة عامة',
    realtime: 'المراقبة المباشرة',
    budget: 'إدارة الميزانية',
    forecasting: 'التنبؤ',
    optimization: 'التحسين',
    models: 'أداء النماذج',
    attribution: 'توزيع التكاليف',
    alerts: 'التنبيهات',
    reports: 'التقارير',
    roi: 'عائد الاستثمار',
    autoRefresh: 'التحديث التلقائي',
    lastUpdated: 'آخر تحديث',
    refreshNow: 'تحديث الآن',
    settings: 'الإعدادات',
    export: 'تصدير',
    language: 'اللغة',
    loading: 'جاري التحميل...',
    error: 'حدث خطأ في تحميل البيانات',
    retry: 'إعادة المحاولة',
    activeAlerts: 'التنبيهات النشطة',
    totalSavings: 'إجمالي التوفير المحتمل',
    budgetUtilization: 'استخدام الميزانية',
    costTrend: 'اتجاه التكلفة',
    monthlyProjection: 'التوقع الشهري',
    currentSpend: 'الإنفاق الحالي',
    optimizationScore: 'نقاط التحسين'
  } : {
    title: 'Cost Optimization Dashboard',
    subtitle: 'Monitor and optimize API costs for HR Intelligence Platform',
    overview: 'Overview',
    realtime: 'Real-time Monitor',
    budget: 'Budget Management',
    forecasting: 'Forecasting',
    optimization: 'Optimization',
    models: 'Model Performance',
    attribution: 'Cost Attribution',
    alerts: 'Alerts',
    reports: 'Reports',
    roi: 'ROI Analysis',
    autoRefresh: 'Auto Refresh',
    lastUpdated: 'Last Updated',
    refreshNow: 'Refresh Now',
    settings: 'Settings',
    export: 'Export',
    language: 'Language',
    loading: 'Loading...',
    error: 'Error loading dashboard data',
    retry: 'Retry',
    activeAlerts: 'Active Alerts',
    totalSavings: 'Total Potential Savings',
    budgetUtilization: 'Budget Utilization',
    costTrend: 'Cost Trend',
    monthlyProjection: 'Monthly Projection',
    currentSpend: 'Current Spend',
    optimizationScore: 'Optimization Score'
  };

  // Load dashboard data
  useEffect(() => {
    loadDashboardData();
  }, []);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadDashboardData(true); // Silent refresh
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const loadDashboardData = async (silent = false) => {
    if (!silent) setLoading(true);
    
    try {
      const response = await fetch('/api/v1/analytics/costs/comprehensive', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load dashboard data');
      }

      const data = await response.json();
      setDashboardData(data.data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      // Mock data for development
      setDashboardData(mockDashboardData);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleRefresh = () => {
    loadDashboardData();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(isRTL ? 'ar-SA' : 'en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString(isRTL ? 'ar-SA' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className={`text-center ${isRTL ? 'font-arabic' : ''}`}>
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-saudi-blue-600" />
          <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
            {labels.loading}
          </p>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className={`text-center ${isRTL ? 'font-arabic' : ''}`}>
          <XCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
          <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-4">
            {labels.error}
          </p>
          <Button onClick={handleRefresh} className={isRTL ? 'font-arabic' : ''}>
            {labels.retry}
          </Button>
        </div>
      </div>
    );
  }

  const activeAlertsCount = dashboardData.alerts.filter(alert => !alert.acknowledged).length;
  const criticalAlertsCount = dashboardData.alerts.filter(
    alert => !alert.acknowledged && alert.severity === 'critical'
  ).length;

  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-gray-900 ${isRTL ? 'rtl' : 'ltr'}`}>
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4">
          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <h1 className={`text-2xl font-bold text-saudi-navy-800 dark:text-white ${isRTL ? 'font-arabic-heading' : ''}`}>
                {labels.title}
              </h1>
              <p className={`text-sm text-gray-600 dark:text-gray-400 mt-1 ${isRTL ? 'font-arabic' : ''}`}>
                {labels.subtitle}
              </p>
            </div>

            <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
              {/* Active Alerts Badge */}
              {activeAlertsCount > 0 && (
                <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <Badge 
                    variant={criticalAlertsCount > 0 ? "destructive" : "secondary"}
                    className={`${isRTL ? 'font-arabic' : ''}`}
                  >
                    <Bell className={`h-3 w-3 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                    {activeAlertsCount} {labels.activeAlerts}
                  </Badge>
                </div>
              )}

              {/* Auto Refresh Toggle */}
              <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <Button
                  variant={autoRefresh ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  className={isRTL ? 'font-arabic' : ''}
                >
                  <Activity className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                  {labels.autoRefresh}
                </Button>
              </div>

              {/* Manual Refresh */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                className={isRTL ? 'font-arabic' : ''}
              >
                <RefreshCw className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                {labels.refreshNow}
              </Button>

              {/* Language Toggle */}
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleLanguage}
                className={isRTL ? 'font-arabic' : ''}
              >
                {language === 'ar' ? 'EN' : 'العربية'}
              </Button>

              {/* Settings */}
              <Button variant="ghost" size="sm">
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Last Updated */}
          <div className={`mt-2 text-xs text-gray-500 dark:text-gray-400 ${isRTL ? 'text-right font-arabic' : 'text-left'}`}>
            {labels.lastUpdated}: {formatTime(lastUpdated)}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className={`grid w-full ${isRTL ? 'grid-cols-10' : 'grid-cols-10'} mb-6`}>
            <TabsTrigger value="overview" className={isRTL ? 'font-arabic' : ''}>
              <BarChart3 className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {labels.overview}
            </TabsTrigger>
            <TabsTrigger value="realtime" className={isRTL ? 'font-arabic' : ''}>
              <Activity className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {labels.realtime}
            </TabsTrigger>
            <TabsTrigger value="budget" className={isRTL ? 'font-arabic' : ''}>
              <Target className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {labels.budget}
            </TabsTrigger>
            <TabsTrigger value="forecasting" className={isRTL ? 'font-arabic' : ''}>
              <TrendingUp className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {labels.forecasting}
            </TabsTrigger>
            <TabsTrigger value="optimization" className={isRTL ? 'font-arabic' : ''}>
              <Lightbulb className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {labels.optimization}
            </TabsTrigger>
            <TabsTrigger value="models" className={isRTL ? 'font-arabic' : ''}>
              <Zap className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {labels.models}
            </TabsTrigger>
            <TabsTrigger value="attribution" className={isRTL ? 'font-arabic' : ''}>
              <Users className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {labels.attribution}
            </TabsTrigger>
            <TabsTrigger value="alerts" className={isRTL ? 'font-arabic' : ''}>
              <AlertTriangle className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {labels.alerts}
            </TabsTrigger>
            <TabsTrigger value="roi" className={isRTL ? 'font-arabic' : ''}>
              <DollarSign className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {labels.roi}
            </TabsTrigger>
            <TabsTrigger value="reports" className={isRTL ? 'font-arabic' : ''}>
              <Download className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {labels.reports}
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <CostOverviewCards 
              data={dashboardData.overview} 
              language={language}
            />
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <CostForecastingChart 
                data={dashboardData.forecasting}
                language={language}
              />
              <ModelPerformanceAnalysis 
                data={dashboardData.modelPerformance}
                language={language}
                compact={true}
              />
            </div>
          </TabsContent>

          {/* Real-time Tab */}
          <TabsContent value="realtime" className="space-y-6">
            <RealtimeCostMonitor 
              data={dashboardData.realtime}
              language={language}
            />
          </TabsContent>

          {/* Budget Tab */}
          <TabsContent value="budget" className="space-y-6">
            <BudgetManagement 
              data={dashboardData.budgetConfiguration}
              language={language}
            />
          </TabsContent>

          {/* Forecasting Tab */}
          <TabsContent value="forecasting" className="space-y-6">
            <CostForecastingChart 
              data={dashboardData.forecasting}
              language={language}
              detailed={true}
            />
          </TabsContent>

          {/* Optimization Tab */}
          <TabsContent value="optimization" className="space-y-6">
            <OptimizationRecommendations 
              data={dashboardData.recommendations}
              language={language}
            />
          </TabsContent>

          {/* Models Tab */}
          <TabsContent value="models" className="space-y-6">
            <ModelPerformanceAnalysis 
              data={dashboardData.modelPerformance}
              language={language}
            />
          </TabsContent>

          {/* Attribution Tab */}
          <TabsContent value="attribution" className="space-y-6">
            <CostAttributionBreakdown 
              data={dashboardData.costAttribution}
              language={language}
            />
          </TabsContent>

          {/* Alerts Tab */}
          <TabsContent value="alerts" className="space-y-6">
            <AlertsPanel 
              data={dashboardData.alerts}
              language={language}
            />
          </TabsContent>

          {/* ROI Tab */}
          <TabsContent value="roi" className="space-y-6">
            <ROIAnalysisPanel 
              data={dashboardData.roiAnalysis}
              language={language}
            />
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports" className="space-y-6">
            <ExportManager 
              data={dashboardData.exportJobs}
              language={language}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

// Mock data for development
const mockDashboardData: ComprehensiveCostDashboardData = {
  overview: {
    totalCost: 1245.67,
    dailyCost: 41.52,
    weeklyCost: 290.64,
    monthlyCost: 1245.67,
    projectedMonthlyCost: 1380.24,
    costTrend: 12.5,
    budgetUtilization: 78.3,
    topCostDrivers: [
      {
        category: 'GPT-4 API Calls',
        categoryArabic: 'استدعاءات GPT-4',
        cost: 623.45,
        percentage: 50.1,
        trend: 'increasing',
        changePercentage: 15.2
      },
      {
        category: 'Document Processing',
        categoryArabic: 'معالجة المستندات',
        cost: 312.67,
        percentage: 25.1,
        trend: 'stable',
        changePercentage: 2.1
      }
    ],
    savingsOpportunities: 187.85,
    costEfficiencyScore: 82.5
  },
  realtime: {
    currentHourCost: 2.15,
    activeRequests: 47,
    avgCostPerRequest: 0.045,
    costVelocity: 1.8,
    peakHourProjection: 3.2,
    alertsActive: 2,
    optimizationsActive: 3,
    lastUpdated: new Date().toISOString()
  },
  forecasting: [],
  recommendations: [],
  budgetConfiguration: {} as any,
  modelPerformance: [],
  costAttribution: [],
  alerts: [],
  roiAnalysis: {} as any,
  exportJobs: []
};

export default CostOptimizationDashboard;