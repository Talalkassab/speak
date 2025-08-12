'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Calendar,
  Target,
  AlertTriangle,
  Info,
  Eye,
  Settings,
  Download
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  ReferenceLine,
  ComposedChart,
  Bar,
  Legend
} from 'recharts';
import type { CostForecast, ForecastFactor } from '@/types/enhanced-cost-analytics';

interface CostForecastingChartProps {
  data: CostForecast[];
  language?: 'ar' | 'en';
  detailed?: boolean;
  compact?: boolean;
  className?: string;
}

const CostForecastingChart: React.FC<CostForecastingChartProps> = ({
  data,
  language = 'ar',
  detailed = false,
  compact = false,
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState('forecast');
  const [selectedPeriod, setSelectedPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'quarterly'>('monthly');
  const [showConfidenceInterval, setShowConfidenceInterval] = useState(true);

  const isRTL = language === 'ar';

  const labels = isRTL ? {
    title: 'توقعات التكلفة',
    subtitle: 'تنبؤات التكلفة المبنية على الذكاء الاصطناعي مع تحليل العوامل المؤثرة',
    forecast: 'التوقعات',
    factors: 'العوامل المؤثرة',
    scenarios: 'السيناريوهات',
    insights: 'الرؤى',
    projectedCost: 'التكلفة المتوقعة',
    actualCost: 'التكلفة الفعلية',
    confidenceInterval: 'نطاق الثقة',
    upperBound: 'الحد الأعلى',
    lowerBound: 'الحد الأدنى',
    accuracy: 'دقة التوقع',
    lastUpdated: 'آخر تحديث',
    period: 'الفترة',
    daily: 'يومي',
    weekly: 'أسبوعي',
    monthly: 'شهري',
    quarterly: 'ربع سنوي',
    forecastFactors: 'عوامل التوقع',
    positiveImpact: 'تأثير إيجابي',
    negativeImpact: 'تأثير سلبي',
    neutralImpact: 'تأثير محايد',
    highConfidence: 'ثقة عالية',
    mediumConfidence: 'ثقة متوسطة',
    lowConfidence: 'ثقة منخفضة',
    budgetTarget: 'هدف الميزانية',
    alertThreshold: 'عتبة التنبيه',
    riskLevel: 'مستوى المخاطر',
    low: 'منخفض',
    medium: 'متوسط',
    high: 'عالي',
    critical: 'حرج',
    forecastAccuracy: 'دقة التوقع التاريخية',
    trend: 'الاتجاه',
    increasing: 'متزايد',
    decreasing: 'متناقص',
    stable: 'مستقر',
    seasonality: 'الموسمية',
    usagePatterns: 'أنماط الاستخدام',
    costOptimization: 'تحسين التكلفة',
    marketTrends: 'اتجاهات السوق',
    infrastructure: 'البنية التحتية',
    settings: 'الإعدادات',
    export: 'تصدير',
    viewDetails: 'عرض التفاصيل',
    nextMonth: 'الشهر القادم',
    nextQuarter: 'الربع القادم',
    projectedIncrease: 'الزيادة المتوقعة',
    projectedDecrease: 'النقص المتوقع'
  } : {
    title: 'Cost Forecasting',
    subtitle: 'AI-powered cost predictions with factor analysis',
    forecast: 'Forecast',
    factors: 'Factors',
    scenarios: 'Scenarios',
    insights: 'Insights',
    projectedCost: 'Projected Cost',
    actualCost: 'Actual Cost',
    confidenceInterval: 'Confidence Interval',
    upperBound: 'Upper Bound',
    lowerBound: 'Lower Bound',
    accuracy: 'Accuracy',
    lastUpdated: 'Last Updated',
    period: 'Period',
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly',
    quarterly: 'Quarterly',
    forecastFactors: 'Forecast Factors',
    positiveImpact: 'Positive Impact',
    negativeImpact: 'Negative Impact',
    neutralImpact: 'Neutral Impact',
    highConfidence: 'High Confidence',
    mediumConfidence: 'Medium Confidence',
    lowConfidence: 'Low Confidence',
    budgetTarget: 'Budget Target',
    alertThreshold: 'Alert Threshold',
    riskLevel: 'Risk Level',
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    critical: 'Critical',
    forecastAccuracy: 'Historical Forecast Accuracy',
    trend: 'Trend',
    increasing: 'Increasing',
    decreasing: 'Decreasing',
    stable: 'Stable',
    seasonality: 'Seasonality',
    usagePatterns: 'Usage Patterns',
    costOptimization: 'Cost Optimization',
    marketTrends: 'Market Trends',
    infrastructure: 'Infrastructure',
    settings: 'Settings',
    export: 'Export',
    viewDetails: 'View Details',
    nextMonth: 'Next Month',
    nextQuarter: 'Next Quarter',
    projectedIncrease: 'Projected Increase',
    projectedDecrease: 'Projected Decrease'
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(isRTL ? 'ar-SA' : 'en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  // Mock forecast data
  const mockForecastData = [
    {
      period: 'monthly',
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      projectedCost: 1456.78,
      confidenceInterval: {
        lower: 1234.56,
        upper: 1678.90,
        confidence: 85
      },
      factors: [
        {
          name: 'Seasonal Usage Patterns',
          nameArabic: 'أنماط الاستخدام الموسمية',
          impact: 15,
          confidence: 85,
          description: 'Higher usage expected during business quarters',
          descriptionArabic: 'استخدام أعلى متوقع خلال أرباع العام التجارية'
        },
        {
          name: 'Model Price Changes',
          nameArabic: 'تغييرات أسعار النماذج',
          impact: -8,
          confidence: 70,
          description: 'Expected price reductions for GPT models',
          descriptionArabic: 'تخفيضات أسعار متوقعة لنماذج GPT'
        },
        {
          name: 'User Growth',
          nameArabic: 'نمو المستخدمين',
          impact: 25,
          confidence: 90,
          description: 'Projected 25% increase in active users',
          descriptionArabic: 'زيادة متوقعة بنسبة 25% في المستخدمين النشطين'
        }
      ],
      accuracy: 87.5,
      lastUpdated: new Date().toISOString()
    }
  ];

  // Generate chart data
  const generateChartData = () => {
    const months = [];
    const currentDate = new Date();
    
    for (let i = -6; i <= 6; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
      const isHistorical = i <= 0;
      const baseValue = 1200 + (Math.random() * 400);
      
      months.push({
        month: date.toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', { month: 'short' }),
        date: date.toISOString(),
        actualCost: isHistorical ? baseValue + (Math.random() * 100 - 50) : null,
        projectedCost: !isHistorical ? baseValue + (i * 50) + (Math.random() * 100 - 50) : null,
        upperBound: !isHistorical ? baseValue + (i * 50) + 150 : null,
        lowerBound: !isHistorical ? baseValue + (i * 50) - 150 : null,
        budgetTarget: 1500,
        alertThreshold: 1650,
        isHistorical
      });
    }
    
    return months;
  };

  const chartData = generateChartData();
  const currentForecast = mockForecastData[0];

  const getImpactColor = (impact: number) => {
    if (impact > 10) return 'text-red-600 bg-red-100';
    if (impact > 0) return 'text-orange-600 bg-orange-100';
    if (impact < -10) return 'text-green-600 bg-green-100';
    if (impact < 0) return 'text-blue-600 bg-blue-100';
    return 'text-gray-600 bg-gray-100';
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600 bg-green-100';
    if (confidence >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  if (compact) {
    return (
      <Card className={`p-6 ${className}`}>
        <h4 className={`text-lg font-semibold text-gray-900 dark:text-white mb-4 ${isRTL ? 'font-arabic-heading text-right' : ''}`}>
          {labels.title}
        </h4>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6b7280' }} />
            <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
            <Tooltip formatter={(value: any) => value ? formatCurrency(value) : null} />
            <Line
              type="monotone"
              dataKey="actualCost"
              stroke="#1e40af"
              strokeWidth={2}
              dot={{ fill: '#1e40af', strokeWidth: 2, r: 4 }}
              connectNulls={false}
              name={labels.actualCost}
            />
            <Line
              type="monotone"
              dataKey="projectedCost"
              stroke="#dc2626"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ fill: '#dc2626', strokeWidth: 2, r: 4 }}
              connectNulls={false}
              name={labels.projectedCost}
            />
            <ReferenceLine y={1500} stroke="#059669" strokeDasharray="3 3" />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>
    );
  }

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
          <select 
            value={selectedPeriod} 
            onChange={(e) => setSelectedPeriod(e.target.value as any)}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm"
          >
            <option value="daily">{labels.daily}</option>
            <option value="weekly">{labels.weekly}</option>
            <option value="monthly">{labels.monthly}</option>
            <option value="quarterly">{labels.quarterly}</option>
          </select>

          <Button variant="outline" size="sm" className={isRTL ? 'font-arabic' : ''}>
            <Settings className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
            {labels.settings}
          </Button>

          <Button variant="outline" size="sm" className={isRTL ? 'font-arabic' : ''}>
            <Download className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
            {labels.export}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200">
          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <p className={`text-sm font-medium text-blue-700 dark:text-blue-400 ${isRTL ? 'font-arabic' : ''}`}>
                {labels.nextMonth}
              </p>
              <p className="text-2xl font-bold text-blue-900 dark:text-blue-200">
                {formatCurrency(currentForecast.projectedCost)}
              </p>
              <p className={`text-xs text-blue-600 dark:text-blue-400 ${isRTL ? 'font-arabic' : ''}`}>
                ±{formatCurrency(currentForecast.confidenceInterval.upper - currentForecast.projectedCost)}
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-blue-600" />
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200">
          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <p className={`text-sm font-medium text-green-700 dark:text-green-400 ${isRTL ? 'font-arabic' : ''}`}>
                {labels.accuracy}
              </p>
              <p className="text-2xl font-bold text-green-900 dark:text-green-200">
                {currentForecast.accuracy.toFixed(1)}%
              </p>
              <p className={`text-xs text-green-600 dark:text-green-400 ${isRTL ? 'font-arabic' : ''}`}>
                {labels.forecastAccuracy}
              </p>
            </div>
            <Target className="h-8 w-8 text-green-600" />
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200">
          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <p className={`text-sm font-medium text-purple-700 dark:text-purple-400 ${isRTL ? 'font-arabic' : ''}`}>
                {labels.riskLevel}
              </p>
              <p className="text-2xl font-bold text-purple-900 dark:text-purple-200">
                {labels.medium}
              </p>
              <p className={`text-xs text-purple-600 dark:text-purple-400 ${isRTL ? 'font-arabic' : ''}`}>
                85% {labels.confidenceInterval}
              </p>
            </div>
            <AlertTriangle className="h-8 w-8 text-purple-600" />
          </div>
        </Card>
      </div>

      {/* Tabs */}
      {detailed && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="forecast" className={isRTL ? 'font-arabic' : ''}>
              <BarChart3 className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {labels.forecast}
            </TabsTrigger>
            <TabsTrigger value="factors" className={isRTL ? 'font-arabic' : ''}>
              <TrendingUp className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {labels.factors}
            </TabsTrigger>
            <TabsTrigger value="scenarios" className={isRTL ? 'font-arabic' : ''}>
              <Target className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {labels.scenarios}
            </TabsTrigger>
            <TabsTrigger value="insights" className={isRTL ? 'font-arabic' : ''}>
              <Info className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {labels.insights}
            </TabsTrigger>
          </TabsList>

          {/* Forecast Tab */}
          <TabsContent value="forecast" className="space-y-6">
            <Card className="p-6">
              <div className={`flex items-center justify-between mb-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <h4 className={`text-lg font-semibold text-gray-900 dark:text-white ${isRTL ? 'font-arabic-heading' : ''}`}>
                  {labels.projectedCost} - {selectedPeriod === 'monthly' ? labels.monthly : labels.quarterly}
                </h4>
                
                <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <input
                    type="checkbox"
                    checked={showConfidenceInterval}
                    onChange={(e) => setShowConfidenceInterval(e.target.checked)}
                    className="rounded"
                  />
                  <span className={`text-sm text-gray-600 ${isRTL ? 'font-arabic' : ''}`}>
                    {labels.confidenceInterval}
                  </span>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={400}>
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <Tooltip formatter={(value: any) => value ? formatCurrency(value) : null} />
                  <Legend />
                  
                  {/* Confidence Interval Area */}
                  {showConfidenceInterval && (
                    <Area
                      type="monotone"
                      dataKey="upperBound"
                      stroke="none"
                      fill="url(#confidenceGradient)"
                      fillOpacity={0.2}
                    />
                  )}
                  
                  {/* Actual Cost Line */}
                  <Line
                    type="monotone"
                    dataKey="actualCost"
                    stroke="#1e40af"
                    strokeWidth={3}
                    dot={{ fill: '#1e40af', strokeWidth: 2, r: 5 }}
                    connectNulls={false}
                    name={labels.actualCost}
                  />
                  
                  {/* Projected Cost Line */}
                  <Line
                    type="monotone"
                    dataKey="projectedCost"
                    stroke="#dc2626"
                    strokeWidth={3}
                    strokeDasharray="8 4"
                    dot={{ fill: '#dc2626', strokeWidth: 2, r: 5 }}
                    connectNulls={false}
                    name={labels.projectedCost}
                  />
                  
                  {/* Reference Lines */}
                  <ReferenceLine y={1500} stroke="#059669" strokeDasharray="5 5" label={labels.budgetTarget} />
                  <ReferenceLine y={1650} stroke="#f59e0b" strokeDasharray="5 5" label={labels.alertThreshold} />
                  
                  <defs>
                    <linearGradient id="confidenceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#dc2626" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#dc2626" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                </ComposedChart>
              </ResponsiveContainer>
            </Card>
          </TabsContent>

          {/* Factors Tab */}
          <TabsContent value="factors" className="space-y-6">
            <Card className="p-6">
              <h4 className={`text-lg font-semibold text-gray-900 dark:text-white mb-4 ${isRTL ? 'font-arabic-heading text-right' : ''}`}>
                {labels.forecastFactors}
              </h4>
              
              <div className="space-y-4">
                {currentForecast.factors.map((factor, index) => (
                  <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className={`flex items-center justify-between mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <div className={isRTL ? 'text-right' : 'text-left'}>
                        <h5 className={`font-semibold text-gray-900 dark:text-white ${isRTL ? 'font-arabic-heading' : ''}`}>
                          {isRTL ? factor.nameArabic : factor.name}
                        </h5>
                        <p className={`text-sm text-gray-600 dark:text-gray-400 ${isRTL ? 'font-arabic' : ''}`}>
                          {isRTL ? factor.descriptionArabic : factor.description}
                        </p>
                      </div>
                      
                      <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <Badge className={`${getImpactColor(factor.impact)} text-xs ${isRTL ? 'font-arabic' : ''}`}>
                          {factor.impact > 0 ? '+' : ''}{factor.impact}%
                        </Badge>
                        <Badge className={`${getConfidenceColor(factor.confidence)} text-xs ${isRTL ? 'font-arabic' : ''}`}>
                          {factor.confidence}% {labels.confidence}
                        </Badge>
                      </div>
                    </div>
                    
                    {/* Impact Bar */}
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-300 ${
                          factor.impact > 0 ? 'bg-red-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.abs(factor.impact) * 2)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          {/* Other tabs content would go here */}
          <TabsContent value="scenarios">
            <Card className="p-6">
              <p className={`text-center text-gray-500 ${isRTL ? 'font-arabic' : ''}`}>
                {isRTL ? 'سيناريوهات التكلفة - قريباً' : 'Cost scenarios - Coming soon'}
              </p>
            </Card>
          </TabsContent>

          <TabsContent value="insights">
            <Card className="p-6">
              <p className={`text-center text-gray-500 ${isRTL ? 'font-arabic' : ''}`}>
                {isRTL ? 'رؤى التوقعات - قريباً' : 'Forecast insights - Coming soon'}
              </p>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Simple chart for non-detailed view */}
      {!detailed && (
        <Card className="p-6">
          <h4 className={`text-lg font-semibold text-gray-900 dark:text-white mb-4 ${isRTL ? 'font-arabic-heading text-right' : ''}`}>
            {labels.projectedCost}
          </h4>
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6b7280' }} />
              <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
              <Tooltip formatter={(value: any) => value ? formatCurrency(value) : null} />
              <Legend />
              <Line
                type="monotone"
                dataKey="actualCost"
                stroke="#1e40af"
                strokeWidth={2}
                dot={{ fill: '#1e40af', strokeWidth: 2, r: 4 }}
                connectNulls={false}
                name={labels.actualCost}
              />
              <Line
                type="monotone"
                dataKey="projectedCost"
                stroke="#dc2626"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ fill: '#dc2626', strokeWidth: 2, r: 4 }}
                connectNulls={false}
                name={labels.projectedCost}
              />
              <ReferenceLine y={1500} stroke="#059669" strokeDasharray="3 3" />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  );
};

export default CostForecastingChart;