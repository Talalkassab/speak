'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, DollarSign, Clock, Target } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { ROIAnalysis } from '@/types/enhanced-cost-analytics';

interface ROIAnalysisPanelProps {
  data: ROIAnalysis;
  language?: 'ar' | 'en';
  className?: string;
}

const ROIAnalysisPanel: React.FC<ROIAnalysisPanelProps> = ({
  data,
  language = 'ar',
  className = ''
}) => {
  const isRTL = language === 'ar';

  const labels = isRTL ? {
    title: 'تحليل عائد الاستثمار',
    totalInvestment: 'إجمالي الاستثمار',
    totalSavings: 'إجمالي التوفير',
    netROI: 'صافي العائد',
    paybackPeriod: 'فترة الاسترداد',
    months: 'شهر'
  } : {
    title: 'ROI Analysis',
    totalInvestment: 'Total Investment',
    totalSavings: 'Total Savings',
    netROI: 'Net ROI',
    paybackPeriod: 'Payback Period',
    months: 'months'
  };

  // Mock data
  const mockROI = {
    totalInvestment: 10000,
    totalSavings: 15000,
    netROI: 5000,
    roiPercentage: 50,
    paybackPeriod: 8,
    productivity: {
      timesSaved: 120,
      errorReduction: 25,
      processEfficiency: 30
    },
    qualitativeImpacts: [],
    projectedBenefits: [
      { period: 'Q1', costSavings: 2500, productivityGains: 1500, qualityImprovements: 500, cumulativeSavings: 2500 },
      { period: 'Q2', costSavings: 3000, productivityGains: 1800, qualityImprovements: 600, cumulativeSavings: 5500 },
      { period: 'Q3', costSavings: 3500, productivityGains: 2000, qualityImprovements: 700, cumulativeSavings: 9000 },
      { period: 'Q4', costSavings: 4000, productivityGains: 2200, qualityImprovements: 800, cumulativeSavings: 13000 }
    ]
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(isRTL ? 'ar-SA' : 'en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <h3 className={`text-xl font-semibold text-saudi-navy-800 dark:text-white ${isRTL ? 'font-arabic-heading text-right' : ''}`}>
        {labels.title}
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <p className={`text-sm font-medium text-blue-700 ${isRTL ? 'font-arabic' : ''}`}>
                {labels.totalInvestment}
              </p>
              <p className="text-2xl font-bold text-blue-900">
                {formatCurrency(mockROI.totalInvestment)}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-blue-600" />
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <p className={`text-sm font-medium text-green-700 ${isRTL ? 'font-arabic' : ''}`}>
                {labels.totalSavings}
              </p>
              <p className="text-2xl font-bold text-green-900">
                {formatCurrency(mockROI.totalSavings)}
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-600" />
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <p className={`text-sm font-medium text-purple-700 ${isRTL ? 'font-arabic' : ''}`}>
                {labels.netROI}
              </p>
              <p className="text-2xl font-bold text-purple-900">
                {mockROI.roiPercentage}%
              </p>
            </div>
            <Target className="h-8 w-8 text-purple-600" />
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <p className={`text-sm font-medium text-orange-700 ${isRTL ? 'font-arabic' : ''}`}>
                {labels.paybackPeriod}
              </p>
              <p className="text-2xl font-bold text-orange-900">
                {mockROI.paybackPeriod} {labels.months}
              </p>
            </div>
            <Clock className="h-8 w-8 text-orange-600" />
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h4 className={`text-lg font-semibold text-gray-900 dark:text-white mb-4 ${isRTL ? 'font-arabic-heading text-right' : ''}`}>
          {isRTL ? 'الفوائد المتوقعة' : 'Projected Benefits'}
        </h4>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={mockROI.projectedBenefits}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="period" tick={{ fontSize: 12, fill: '#6b7280' }} />
            <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
            <Tooltip formatter={(value: any) => formatCurrency(value)} />
            <Line
              type="monotone"
              dataKey="cumulativeSavings"
              stroke="#059669"
              strokeWidth={2}
              name={isRTL ? 'التوفير التراكمي' : 'Cumulative Savings'}
            />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
};

export default ROIAnalysisPanel;