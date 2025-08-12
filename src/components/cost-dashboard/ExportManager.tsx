'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, FileText, Calendar, Settings, Plus } from 'lucide-react';
import type { ExportJobStatus } from '@/types/enhanced-cost-analytics';

interface ExportManagerProps {
  data: ExportJobStatus[];
  language?: 'ar' | 'en';
  className?: string;
}

const ExportManager: React.FC<ExportManagerProps> = ({
  data,
  language = 'ar',
  className = ''
}) => {
  const isRTL = language === 'ar';

  const labels = isRTL ? {
    title: 'إدارة التقارير والتصدير',
    newReport: 'تقرير جديد',
    scheduled: 'المجدولة',
    recent: 'الحديثة',
    download: 'تحميل',
    status: 'الحالة',
    completed: 'مكتمل',
    processing: 'قيد المعالجة',
    pending: 'في الانتظار',
    failed: 'فشل'
  } : {
    title: 'Export & Reports Manager',
    newReport: 'New Report',
    scheduled: 'Scheduled',
    recent: 'Recent',
    download: 'Download',
    status: 'Status',
    completed: 'Completed',
    processing: 'Processing',
    pending: 'Pending',
    failed: 'Failed'
  };

  // Mock data
  const mockJobs = [
    {
      id: '1',
      type: 'cost_report' as const,
      format: 'pdf' as const,
      status: 'completed' as const,
      progress: 100,
      downloadUrl: '/downloads/cost-report.pdf',
      parameters: {
        dateRange: {
          start: new Date(),
          end: new Date(),
          period: 'month' as const
        },
        includeCharts: true,
        includeRawData: false,
        metrics: ['costs', 'usage'],
        language: 'ar' as const,
        branding: true,
        confidential: false
      },
      createdBy: 'admin',
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      fileSize: 2048
    }
  ];

  return (
    <div className={`space-y-6 ${className}`}>
      <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
        <h3 className={`text-xl font-semibold text-saudi-navy-800 dark:text-white ${isRTL ? 'font-arabic-heading' : ''}`}>
          {labels.title}
        </h3>
        <Button className={isRTL ? 'font-arabic' : ''}>
          <Plus className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
          {labels.newReport}
        </Button>
      </div>
      
      <div className="space-y-4">
        {mockJobs.map((job) => (
          <Card key={job.id} className="p-6">
            <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <FileText className="h-8 w-8 text-blue-600" />
                <div className={isRTL ? 'text-right' : 'text-left'}>
                  <h4 className={`font-semibold text-gray-900 dark:text-white ${isRTL ? 'font-arabic-heading' : ''}`}>
                    {job.type} ({job.format.toUpperCase()})
                  </h4>
                  <p className={`text-sm text-gray-600 ${isRTL ? 'font-arabic' : ''}`}>
                    {new Date(job.createdAt).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US')}
                  </p>
                </div>
              </div>
              
              <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <Badge className={`${
                  job.status === 'completed' ? 'bg-green-100 text-green-800' :
                  job.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                  job.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                } ${isRTL ? 'font-arabic' : ''}`}>
                  {job.status === 'completed' ? labels.completed :
                   job.status === 'processing' ? labels.processing :
                   job.status === 'pending' ? labels.pending : labels.failed}
                </Badge>
                
                {job.status === 'completed' && job.downloadUrl && (
                  <Button size="sm" className={isRTL ? 'font-arabic' : ''}>
                    <Download className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                    {labels.download}
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ExportManager;