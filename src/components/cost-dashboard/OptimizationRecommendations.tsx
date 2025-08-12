'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Lightbulb, CheckCircle, Clock, DollarSign } from 'lucide-react';
import type { CostOptimizationRecommendation } from '@/types/enhanced-cost-analytics';

interface OptimizationRecommendationsProps {
  data: CostOptimizationRecommendation[];
  language?: 'ar' | 'en';
  className?: string;
}

const OptimizationRecommendations: React.FC<OptimizationRecommendationsProps> = ({
  data,
  language = 'ar',
  className = ''
}) => {
  const isRTL = language === 'ar';

  const labels = isRTL ? {
    title: 'توصيات التحسين',
    potentialSavings: 'التوفير المحتمل',
    implement: 'تطبيق',
    viewDetails: 'عرض التفاصيل'
  } : {
    title: 'Optimization Recommendations',
    potentialSavings: 'Potential Savings',
    implement: 'Implement',
    viewDetails: 'View Details'
  };

  // Mock data
  const mockRecommendations = [
    {
      id: '1',
      type: 'model_routing' as const,
      title: 'Implement Smart Model Routing',
      titleArabic: 'تطبيق التوجيه الذكي للنماذج',
      description: 'Route simple queries to cheaper models',
      descriptionArabic: 'توجيه الاستفسارات البسيطة إلى نماذج أقل تكلفة',
      potentialSavings: 450,
      savingsPercentage: 30,
      effort: 'medium' as const,
      impact: 'high' as const,
      priority: 'high' as const,
      status: 'pending' as const,
      actions: [],
      actionsArabic: [],
      estimatedImplementationTime: 8,
      riskLevel: 'low' as const,
      dependencies: [],
      metrics: {
        currentCost: 1500,
        projectedCost: 1050,
        timeToROI: 30,
        confidenceLevel: 85,
        affectedUsers: 100,
        qualityImpact: 'minimal' as const
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

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
      
      <div className="space-y-4">
        {mockRecommendations.map((rec) => (
          <Card key={rec.id} className="p-6">
            <div className={`flex items-start justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div className={`flex-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                <h4 className={`font-semibold text-gray-900 dark:text-white ${isRTL ? 'font-arabic-heading' : ''}`}>
                  {isRTL ? rec.titleArabic : rec.title}
                </h4>
                <p className={`text-gray-600 dark:text-gray-400 mt-2 ${isRTL ? 'font-arabic' : ''}`}>
                  {isRTL ? rec.descriptionArabic : rec.description}
                </p>
                
                <div className={`flex items-center gap-4 mt-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <DollarSign className="h-4 w-4 text-green-600" />
                    <span className="text-lg font-bold text-green-600">
                      {formatCurrency(rec.potentialSavings)}
                    </span>
                  </div>
                  
                  <Badge className="bg-blue-100 text-blue-800">
                    {rec.priority}
                  </Badge>
                </div>
              </div>
              
              <div className={`flex flex-col gap-2 ${isRTL ? 'items-start' : 'items-end'}`}>
                <Button className={isRTL ? 'font-arabic' : ''}>
                  <CheckCircle className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                  {labels.implement}
                </Button>
                <Button variant="outline" className={isRTL ? 'font-arabic' : ''}>
                  {labels.viewDetails}
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default OptimizationRecommendations;