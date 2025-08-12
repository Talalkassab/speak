'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle, Bell, X } from 'lucide-react';
import type { BudgetAlert } from '@/types/enhanced-cost-analytics';

interface AlertsPanelProps {
  data: BudgetAlert[];
  language?: 'ar' | 'en';
  className?: string;
}

const AlertsPanel: React.FC<AlertsPanelProps> = ({
  data,
  language = 'ar',
  className = ''
}) => {
  const isRTL = language === 'ar';

  const labels = isRTL ? {
    title: 'تنبيهات الميزانية',
    acknowledge: 'إقرار',
    dismiss: 'تجاهل',
    noAlerts: 'لا توجد تنبيهات',
    critical: 'حرج',
    warning: 'تحذير',
    info: 'معلومات'
  } : {
    title: 'Budget Alerts',
    acknowledge: 'Acknowledge',
    dismiss: 'Dismiss',
    noAlerts: 'No alerts',
    critical: 'Critical',
    warning: 'Warning',
    info: 'Info'
  };

  // Mock data
  const mockAlerts = [
    {
      id: '1',
      organizationId: 'org1',
      type: 'threshold_reached' as const,
      severity: 'warning' as const,
      title: 'Budget Threshold Reached',
      titleArabic: 'تم الوصول لعتبة الميزانية',
      message: '75% of monthly budget has been used',
      messageArabic: 'تم استخدام 75% من الميزانية الشهرية',
      threshold: 75,
      currentValue: 75.5,
      triggeredAt: new Date().toISOString(),
      acknowledged: false,
      autoResolved: false,
      resolutionActions: [],
      resolutionActionsArabic: []
    }
  ];

  return (
    <div className={`space-y-6 ${className}`}>
      <h3 className={`text-xl font-semibold text-saudi-navy-800 dark:text-white ${isRTL ? 'font-arabic-heading text-right' : ''}`}>
        {labels.title}
      </h3>
      
      {mockAlerts.length === 0 ? (
        <Card className="p-8 text-center">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <p className={`text-gray-600 ${isRTL ? 'font-arabic' : ''}`}>
            {labels.noAlerts}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {mockAlerts.map((alert) => (
            <Card key={alert.id} className={`p-6 border-l-4 ${
              alert.severity === 'critical' ? 'border-red-500' :
              alert.severity === 'warning' ? 'border-yellow-500' : 'border-blue-500'
            }`}>
              <div className={`flex items-start justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div className={`flex-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                  <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <AlertTriangle className={`h-5 w-5 ${
                      alert.severity === 'critical' ? 'text-red-500' :
                      alert.severity === 'warning' ? 'text-yellow-500' : 'text-blue-500'
                    }`} />
                    <h4 className={`font-semibold text-gray-900 dark:text-white ${isRTL ? 'font-arabic-heading' : ''}`}>
                      {isRTL ? alert.titleArabic : alert.title}
                    </h4>
                    <Badge className={`${
                      alert.severity === 'critical' ? 'bg-red-100 text-red-800' :
                      alert.severity === 'warning' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'
                    } ${isRTL ? 'font-arabic' : ''}`}>
                      {alert.severity === 'critical' ? labels.critical :
                       alert.severity === 'warning' ? labels.warning : labels.info}
                    </Badge>
                  </div>
                  
                  <p className={`text-gray-600 dark:text-gray-400 mt-2 ${isRTL ? 'font-arabic' : ''}`}>
                    {isRTL ? alert.messageArabic : alert.message}
                  </p>
                  
                  <p className={`text-sm text-gray-500 mt-2 ${isRTL ? 'font-arabic' : ''}`}>
                    {new Date(alert.triggeredAt).toLocaleString(isRTL ? 'ar-SA' : 'en-US')}
                  </p>
                </div>
                
                <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <Button size="sm" className={isRTL ? 'font-arabic' : ''}>
                    <CheckCircle className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                    {labels.acknowledge}
                  </Button>
                  <Button variant="outline" size="sm" className={isRTL ? 'font-arabic' : ''}>
                    <X className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                    {labels.dismiss}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AlertsPanel;