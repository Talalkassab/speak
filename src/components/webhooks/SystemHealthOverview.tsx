/**
 * System Health Overview Component
 * Displays system-wide webhook health and performance metrics
 */

'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, AlertTriangle, CheckCircle } from 'lucide-react';

export function SystemHealthOverview() {
  return (
    <div className="space-y-6">
      {/* Overall System Status */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">System Health Status</h3>
          <Badge variant="success" className="flex items-center space-x-1">
            <CheckCircle className="h-4 w-4" />
            <span>All Systems Operational</span>
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600 mb-1">99.9%</div>
            <div className="text-sm text-green-700">Uptime</div>
          </div>
          
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600 mb-1">0.8s</div>
            <div className="text-sm text-blue-700">Avg Response Time</div>
          </div>
          
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600 mb-1">1,247</div>
            <div className="text-sm text-purple-700">Events Today</div>
          </div>
        </div>
      </Card>

      {/* Service Status */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Service Status</h3>
        <div className="space-y-3">
          {[
            { name: 'Webhook Delivery Service', status: 'operational', uptime: '100%' },
            { name: 'Event Processing', status: 'operational', uptime: '99.9%' },
            { name: 'Integration Services', status: 'operational', uptime: '99.8%' },
            { name: 'Monitoring & Alerts', status: 'operational', uptime: '100%' },
            { name: 'Database', status: 'operational', uptime: '99.9%' }
          ].map((service) => (
            <div key={service.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="h-3 w-3 bg-green-500 rounded-full"></div>
                <span className="font-medium">{service.name}</span>
              </div>
              <div className="flex items-center space-x-3">
                <Badge variant="success">Operational</Badge>
                <span className="text-sm text-gray-600">{service.uptime} uptime</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Recent Incidents */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Incidents</h3>
        <div className="text-center py-8">
          <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-3" />
          <p className="text-gray-500">No recent incidents to report.</p>
          <p className="text-sm text-gray-400 mt-1">All systems are running smoothly.</p>
        </div>
      </Card>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h4 className="font-semibold mb-4">System Performance</h4>
          <div className="h-64 flex items-center justify-center bg-gray-50 rounded">
            <p className="text-gray-500">System performance chart will be displayed here</p>
          </div>
        </Card>

        <Card className="p-6">
          <h4 className="font-semibold mb-4">Resource Usage</h4>
          <div className="h-64 flex items-center justify-center bg-gray-50 rounded">
            <p className="text-gray-500">Resource usage metrics will be displayed here</p>
          </div>
        </Card>
      </div>
    </div>
  );
}