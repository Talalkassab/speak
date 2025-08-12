'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import type { CostAttribution } from '@/types/enhanced-cost-analytics';

interface CostAttributionBreakdownProps {
  data: CostAttribution[];
  language?: 'ar' | 'en';
  className?: string;
}

const CostAttributionBreakdown: React.FC<CostAttributionBreakdownProps> = ({
  data,
  language = 'ar',
  className = ''
}) => {
  const isRTL = language === 'ar';

  const labels = isRTL ? {
    title: 'توزيع التكاليف',
    byUser: 'حسب المستخدم',
    byDepartment: 'حسب القسم',
    totalCost: 'إجمالي التكلفة',
    trend: 'الاتجاه'
  } : {
    title: 'Cost Attribution Breakdown',
    byUser: 'By User',
    byDepartment: 'By Department',
    totalCost: 'Total Cost',
    trend: 'Trend'
  };

  // Mock data
  const mockData = [
    {
      userId: '1',
      userName: 'Ahmed Al-Saudi',
      department: 'HR',
      departmentArabic: 'الموارد البشرية',
      role: 'Manager',
      totalCost: 245.50,
      costBreakdown: {
        messages: 150.30,
        documents: 60.20,
        templates: 25.00,
        voiceInteractions: 10.00,
        other: 0
      },
      utilizationRate: 85,
      costPerInteraction: 2.45,
      trend: 'increasing' as const,
      lastActivity: new Date().toISOString()
    }
  ];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(isRTL ? 'ar-SA' : 'en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const pieData = mockData.map((user, index) => ({
    name: user.userName,
    value: user.totalCost,
    fill: index === 0 ? '#1e40af' : '#7c3aed'
  }));

  return (
    <div className={`space-y-6 ${className}`}>
      <h3 className={`text-xl font-semibold text-saudi-navy-800 dark:text-white ${isRTL ? 'font-arabic-heading text-right' : ''}`}>
        {labels.title}
      </h3>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h4 className={`text-lg font-semibold text-gray-900 dark:text-white mb-4 ${isRTL ? 'font-arabic-heading text-right' : ''}`}>
            {labels.byUser}
          </h4>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
                label={({ name, value }) => `${name}: ${formatCurrency(value)}`}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip formatter={(value: any) => formatCurrency(value)} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6">
          <h4 className={`text-lg font-semibold text-gray-900 dark:text-white mb-4 ${isRTL ? 'font-arabic-heading text-right' : ''}`}>
            {labels.byDepartment}
          </h4>
          <div className="space-y-4">
            {mockData.map((user, index) => (
              <div key={index} className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div className={isRTL ? 'text-right' : 'text-left'}>
                  <p className={`font-medium text-gray-900 dark:text-white ${isRTL ? 'font-arabic' : ''}`}>
                    {user.userName}
                  </p>
                  <p className={`text-sm text-gray-600 ${isRTL ? 'font-arabic' : ''}`}>
                    {isRTL ? user.departmentArabic : user.department}
                  </p>
                </div>
                <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <span className="text-lg font-bold">
                    {formatCurrency(user.totalCost)}
                  </span>
                  {user.trend === 'increasing' ? (
                    <TrendingUp className="h-4 w-4 text-red-500" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-green-500" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default CostAttributionBreakdown;