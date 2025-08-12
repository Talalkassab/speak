# HR Intelligence Platform - Analytics Dashboard

## Overview

A comprehensive analytics dashboard for the HR Intelligence Platform built with Next.js, TypeScript, and Tailwind CSS. The dashboard provides real-time insights into system usage, costs, performance, and Saudi Labor Law compliance.

## Features

### 🎯 Main Dashboard (`/dashboard/analytics`)

#### 1. **Overview Tab**
- **Key Metrics Cards**: Total users, conversations, documents processed, costs, response times, system uptime, compliance scores
- **Real-time Indicators**: Live system status with auto-refresh every 30 seconds
- **Usage Trends**: Interactive charts showing daily/weekly/monthly usage patterns
- **Activity Heatmap**: Peak usage hours and user activity patterns
- **Alert Panel**: System alerts and recommendations with severity filtering

#### 2. **Usage Analytics Tab**
- **Interactive Charts**: Line, area, and bar charts for usage trends
- **Popular Queries**: Most requested queries and topics with Arabic/English support
- **User Engagement**: Activity metrics and engagement patterns
- **Document Processing**: Statistics on document processing and template generation

#### 3. **Cost Management Tab**
- **OpenRouter Cost Breakdown**: Detailed analysis by AI model (GPT-4, GPT-3.5, etc.)
- **Cost Optimization**: Recommendations to reduce spending with potential savings calculations
- **Budget Tracking**: Budget utilization with alerts for overspending
- **Model Performance vs Cost**: Efficiency analysis of different AI models

#### 4. **Performance Monitoring Tab**
- **Response Time Charts**: P50, P95, P99 response times with distribution analysis
- **System Health**: CPU, memory, disk usage with real-time monitoring
- **Error Rate Tracking**: Success/failure rates with error categorization
- **Throughput Analysis**: Request volume and processing capacity

#### 5. **Compliance Tab**
- **Saudi Labor Law Compliance Scores**: Comprehensive assessment with category breakdown
- **Issue Tracking**: Active and resolved compliance issues with recommendations
- **Risk Assessment**: Risk levels with actionable remediation steps
- **Audit Trail**: Complete compliance monitoring history

#### 6. **Reports & Export Tab**
- **Quick Export**: Pre-configured reports (All metrics PDF, Cost Excel, Usage CSV)
- **Custom Export**: Configurable metrics selection with multiple formats
- **Scheduled Reports**: Automated report generation with email delivery
- **Export History**: Download and sharing of generated reports

## Technical Implementation

### Components Architecture

```
src/components/analytics/
├── OverviewCards.tsx          # Key metrics overview cards
├── RealTimeIndicators.tsx     # Live system status indicators  
├── UsageChart.tsx            # Usage trends visualization
├── UserActivityHeatmap.tsx   # Activity heatmap visualization
├── PopularQueries.tsx        # Popular queries and topics
├── AlertsPanel.tsx           # System alerts and notifications
├── CostBreakdown.tsx         # Cost analysis and breakdown
├── CostOptimization.tsx      # Cost optimization recommendations
├── PerformanceMetrics.tsx    # Performance monitoring charts
├── ComplianceScore.tsx       # Saudi Labor Law compliance
├── ExportReports.tsx         # Report generation and export
└── index.ts                  # Component exports
```

### Data Types

```typescript
// Core analytics data structure
interface AnalyticsMetrics {
  usage: UsageMetrics;
  cost: CostMetrics;
  performance: PerformanceMetrics;
  compliance: ComplianceMetrics;
  activity: ActivityMetrics;
}
```

### Key Features

#### 🌐 Multi-language Support (Arabic/English)
- RTL layout support for Arabic
- Localized date/time formatting
- Arabic font integration
- Right-to-left component layouts

#### 📊 Interactive Visualizations
- Built with Recharts for consistent charting
- Responsive design for all screen sizes
- Dark mode compatibility
- Saudi Arabia theme colors

#### ⚡ Real-time Updates
- WebSocket integration for live data
- 30-second auto-refresh intervals
- Connection status indicators
- Optimistic UI updates

#### 🎨 Design System
- Saudi Arabia color palette (Navy, Green, Gold)
- Consistent spacing and typography
- Accessible color contrasts
- Mobile-first responsive design

## API Endpoints

### Analytics Data
```typescript
GET /api/v1/analytics/metrics
GET /api/v1/analytics/usage
GET /api/v1/analytics/realtime
GET /api/v1/analytics/compliance
```

### Export & Reports
```typescript
POST /api/v1/export/analytics/report
GET /api/v1/export/jobs/:jobId/status
POST /api/v1/analytics/export
```

## Usage Examples

### Basic Dashboard Implementation

```typescript
import { AnalyticsDashboardPage } from '@/app/dashboard/analytics/page';

// The dashboard automatically handles:
// - Data fetching with error handling
// - Real-time updates
// - Loading states
// - Multi-language support
```

### Custom Analytics Component

```typescript
import { UsageChart, CostBreakdown } from '@/components/analytics';

function CustomDashboard() {
  const [data, setData] = useState<AnalyticsMetrics | null>(null);
  
  return (
    <div className="space-y-6">
      <UsageChart 
        data={data?.usage} 
        language="ar" 
        chartType="line" 
      />
      <CostBreakdown 
        data={data?.cost} 
        currency="SAR" 
        language="ar" 
      />
    </div>
  );
}
```

### Export Functionality

```typescript
import { ExportReports } from '@/components/analytics';

function ReportsPage() {
  const handleExport = async (options: ExportOptions) => {
    const response = await fetch('/api/v1/analytics/export', {
      method: 'POST',
      body: JSON.stringify(options)
    });
    
    const { jobId } = await response.json();
    // Poll for completion...
  };
  
  return (
    <ExportReports
      data={analyticsData}
      language="ar"
      timeRange={timeRange}
      onTimeRangeChange={setTimeRange}
    />
  );
}
```

## Performance Optimizations

### Data Loading
- Lazy loading for heavy components
- Incremental data fetching
- Background data refresh
- Error boundary implementation

### Chart Rendering
- Virtual scrolling for large datasets  
- Chart data memoization
- Responsive container sizing
- Progressive enhancement

### Memory Management
- Component cleanup on unmount
- WebSocket connection management
- Interval cleanup
- State optimization

## Accessibility Features

### WCAG 2.1 AA Compliance
- Keyboard navigation support
- Screen reader compatibility
- High contrast mode
- Focus management

### Semantic HTML
- Proper heading hierarchy
- ARIA labels and descriptions
- Form accessibility
- Table accessibility

## Deployment Considerations

### Environment Variables
```env
# Analytics API endpoints
NEXT_PUBLIC_ANALYTICS_API_URL=
ANALYTICS_API_SECRET=

# Export functionality
EXPORT_STORAGE_BUCKET=
EXPORT_API_KEY=

# Real-time features
WEBSOCKET_URL=
REDIS_URL=
```

### Performance Monitoring
- Core Web Vitals tracking
- Error monitoring with Sentry
- Performance analytics
- User experience metrics

## Future Enhancements

### Planned Features
- 📈 Advanced forecasting and predictions
- 🤖 AI-powered insights and recommendations  
- 📱 Mobile application companion
- 🔔 Advanced alerting with SMS/Slack integration
- 📊 Custom dashboard builder
- 🎯 Goal tracking and KPI management

### Technical Improvements
- Server-side rendering optimization
- Edge caching implementation
- Advanced data filtering
- Bulk data operations
- Advanced export formats

## Support

For technical support or feature requests:
- Create an issue in the project repository
- Contact the development team
- Review the troubleshooting guide

## License

This analytics dashboard is part of the HR Intelligence Platform and follows the same licensing terms.