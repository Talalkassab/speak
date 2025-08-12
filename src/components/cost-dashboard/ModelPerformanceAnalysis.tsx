'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Zap, TrendingUp, TrendingDown, CheckCircle, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { ModelPerformanceMetrics } from '@/types/enhanced-cost-analytics';

interface ModelPerformanceAnalysisProps {
  data: ModelPerformanceMetrics[];
  language?: 'ar' | 'en';
  compact?: boolean;
  className?: string;
}

const ModelPerformanceAnalysis: React.FC<ModelPerformanceAnalysisProps> = ({
  data,
  language = 'ar',
  compact = false,
  className = ''
}) => {
  const isRTL = language === 'ar';

  const labels = isRTL ? {
    title: 'تحليل أداء النماذج',
    costEfficiency: 'كفاءة التكلفة',
    performance: 'الأداء',
    reliability: 'الموثوقية',
    usage: 'الاستخدام'
  } : {
    title: 'Model Performance Analysis',
    costEfficiency: 'Cost Efficiency',
    performance: 'Performance',
    reliability: 'Reliability',
    usage: 'Usage'
  };

  // Mock data
  const mockData = [
    {
      modelName: 'GPT-4',
      provider: 'OpenAI',
      costPerToken: 0.0001,
      avgResponseTime: 1.2,
      qualityScore: 95,
      reliabilityScore: 98,
      usageVolume: 50000,
      costEfficiency: 85,
      userSatisfaction: 92,
      errorRate: 0.5,
      uptime: 99.9,
      recommendedUseCases: ['Complex Analysis'],
      trends: {
        cost: 'stable' as const,
        performance: 'improving' as const,
        usage: 'growing' as const
      }
    }
  ];

  return (
    <Card className={`p-6 ${className}`}>
      <h4 className={`text-lg font-semibold text-gray-900 dark:text-white mb-4 ${isRTL ? 'font-arabic-heading text-right' : ''}`}>
        {labels.title}
      </h4>
      
      <div className="space-y-4">
        {mockData.map((model, index) => (
          <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div>
                <h5 className={`font-semibold text-gray-900 dark:text-white ${isRTL ? 'font-arabic-heading' : ''}`}>
                  {model.modelName}
                </h5>
                <p className="text-sm text-gray-600">{model.provider}</p>
              </div>
              <Badge className="bg-green-100 text-green-800">
                {model.costEfficiency}/100
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default ModelPerformanceAnalysis;