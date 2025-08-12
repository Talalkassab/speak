/**
 * Analytics Dashboard Component Unit Tests
 * Tests for the main analytics dashboard with Arabic language support
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';

// Mock Next.js router
import { useRouter } from 'next/navigation';
jest.mock('next/navigation');

// Mock analytics API
import { useAnalytics } from '@/hooks/useAnalytics';
jest.mock('@/hooks/useAnalytics');

// Mock chart library
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  Line: () => <div data-testid="line" />,
  Bar: () => <div data-testid="bar" />,
}));

// Import components to test
import OverviewCards from '@/components/analytics/OverviewCards';
import UsageChart from '@/components/analytics/UsageChart';
import CostBreakdown from '@/components/analytics/CostBreakdown';
import PopularQueries from '@/components/analytics/PopularQueries';
import PerformanceMetrics from '@/components/analytics/PerformanceMetrics';

// Mock data
const mockAnalyticsData = {
  overview: {
    totalQueries: 1543,
    uniqueUsers: 89,
    averageResponseTime: 1.2,
    successRate: 98.5,
    totalCost: 127.50,
    costTrend: 5.2,
  },
  usage: {
    daily: [
      { date: '2024-01-01', queries: 45, users: 12 },
      { date: '2024-01-02', queries: 67, users: 18 },
      { date: '2024-01-03', queries: 89, users: 23 },
      { date: '2024-01-04', queries: 123, users: 31 },
      { date: '2024-01-05', queries: 98, users: 27 },
    ],
    hourly: [
      { hour: 9, queries: 12, avgResponseTime: 0.8 },
      { hour: 10, queries: 23, avgResponseTime: 1.1 },
      { hour: 11, queries: 34, avgResponseTime: 1.3 },
      { hour: 14, queries: 45, avgResponseTime: 1.5 },
      { hour: 15, queries: 38, avgResponseTime: 1.2 },
    ],
  },
  costs: {
    breakdown: [
      { service: 'OpenRouter API', cost: 89.50, percentage: 70.2 },
      { service: 'Vector Storage', cost: 23.75, percentage: 18.6 },
      { service: 'OCR Processing', cost: 14.25, percentage: 11.2 },
    ],
    trend: [
      { month: '2023-10', cost: 98.20 },
      { month: '2023-11', cost: 112.45 },
      { month: '2023-12', cost: 105.30 },
      { month: '2024-01', cost: 127.50 },
    ],
  },
  popularQueries: [
    {
      query: 'ما هي أحكام الإجازة السنوية؟',
      count: 89,
      successRate: 96.6,
      avgResponseTime: 1.1,
    },
    {
      query: 'كيف يتم حساب مكافأة نهاية الخدمة؟',
      count: 76,
      successRate: 98.7,
      avgResponseTime: 1.3,
    },
    {
      query: 'ما هي حقوق العامل عند إنهاء الخدمة؟',
      count: 64,
      successRate: 95.3,
      avgResponseTime: 1.5,
    },
  ],
  performance: {
    responseTime: {
      p50: 0.8,
      p95: 2.1,
      p99: 3.4,
    },
    errorRate: 1.5,
    availability: 99.8,
    cacheHitRate: 78.3,
  },
};

// Mock hooks
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockUseAnalytics = useAnalytics as jest.MockedFunction<typeof useAnalytics>;

describe('Analytics Dashboard Components', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    mockUseRouter.mockReturnValue({
      push: jest.fn(),
      replace: jest.fn(),
      refresh: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      prefetch: jest.fn(),
    } as any);

    mockUseAnalytics.mockReturnValue({
      data: mockAnalyticsData,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    } as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    );
  };

  describe('OverviewCards Component', () => {
    it('should render all overview metrics correctly', () => {
      renderWithProviders(<OverviewCards data={mockAnalyticsData.overview} />);

      // Check total queries
      expect(screen.getByText('إجمالي الاستعلامات')).toBeInTheDocument();
      expect(screen.getByText('1,543')).toBeInTheDocument();

      // Check unique users
      expect(screen.getByText('المستخدمين الفريدين')).toBeInTheDocument();
      expect(screen.getByText('89')).toBeInTheDocument();

      // Check average response time
      expect(screen.getByText('متوسط زمن الاستجابة')).toBeInTheDocument();
      expect(screen.getByText('1.2s')).toBeInTheDocument();

      // Check success rate
      expect(screen.getByText('معدل النجاح')).toBeInTheDocument();
      expect(screen.getByText('98.5%')).toBeInTheDocument();

      // Check total cost
      expect(screen.getByText('إجمالي التكلفة')).toBeInTheDocument();
      expect(screen.getByText('$127.50')).toBeInTheDocument();
    });

    it('should display trend indicators correctly', () => {
      renderWithProviders(<OverviewCards data={mockAnalyticsData.overview} />);

      // Check for trend icons and percentages
      const trendElements = screen.getAllByTestId(/trend-/);
      expect(trendElements.length).toBeGreaterThan(0);

      // Check cost trend
      expect(screen.getByText('+5.2%')).toBeInTheDocument();
    });

    it('should handle loading state', () => {
      renderWithProviders(<OverviewCards data={null} loading={true} />);

      // Check for skeleton loaders
      expect(screen.getAllByTestId('skeleton-card')).toHaveLength(5);
    });

    it('should handle error state', () => {
      renderWithProviders(
        <OverviewCards 
          data={null} 
          error={new Error('Failed to load data')} 
        />
      );

      expect(screen.getByText('خطأ في تحميل البيانات')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /إعادة المحاولة/ })).toBeInTheDocument();
    });
  });

  describe('UsageChart Component', () => {
    it('should render usage chart with correct data', () => {
      renderWithProviders(<UsageChart data={mockAnalyticsData.usage.daily} />);

      // Check chart container
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();

      // Check chart axes
      expect(screen.getByTestId('x-axis')).toBeInTheDocument();
      expect(screen.getByTestId('y-axis')).toBeInTheDocument();

      // Check legend
      expect(screen.getByTestId('legend')).toBeInTheDocument();
    });

    it('should switch between daily and hourly views', async () => {
      const user = userEvent.setup();
      renderWithProviders(<UsageChart data={mockAnalyticsData.usage.daily} />);

      // Find and click hourly view button
      const hourlyButton = screen.getByRole('button', { name: /عرض ساعي/ });
      await user.click(hourlyButton);

      // Verify the view has changed
      expect(screen.getByRole('button', { name: /عرض يومي/ })).toBeInTheDocument();
    });

    it('should format Arabic dates correctly', () => {
      renderWithProviders(<UsageChart data={mockAnalyticsData.usage.daily} />);

      // Check for Arabic date formatting
      expect(screen.getByText(/يناير|فبراير|مارس/)).toBeInTheDocument();
    });

    it('should export chart data', async () => {
      const user = userEvent.setup();
      renderWithProviders(<UsageChart data={mockAnalyticsData.usage.daily} />);

      const exportButton = screen.getByRole('button', { name: /تصدير البيانات/ });
      await user.click(exportButton);

      // Check export menu
      expect(screen.getByText('تصدير CSV')).toBeInTheDocument();
      expect(screen.getByText('تصدير PNG')).toBeInTheDocument();
    });
  });

  describe('CostBreakdown Component', () => {
    it('should render cost breakdown correctly', () => {
      renderWithProviders(<CostBreakdown data={mockAnalyticsData.costs} />);

      // Check service costs
      expect(screen.getByText('OpenRouter API')).toBeInTheDocument();
      expect(screen.getByText('$89.50')).toBeInTheDocument();
      expect(screen.getByText('70.2%')).toBeInTheDocument();

      expect(screen.getByText('Vector Storage')).toBeInTheDocument();
      expect(screen.getByText('$23.75')).toBeInTheDocument();

      expect(screen.getByText('OCR Processing')).toBeInTheDocument();
      expect(screen.getByText('$14.25')).toBeInTheDocument();
    });

    it('should display cost trend chart', () => {
      renderWithProviders(<CostBreakdown data={mockAnalyticsData.costs} />);

      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
      expect(screen.getByText('اتجاه التكلفة')).toBeInTheDocument();
    });

    it('should highlight cost optimization opportunities', () => {
      renderWithProviders(<CostBreakdown data={mockAnalyticsData.costs} />);

      // Look for optimization suggestions
      expect(screen.getByText(/توصيات التحسين/)).toBeInTheDocument();
    });
  });

  describe('PopularQueries Component', () => {
    it('should render popular queries in Arabic', () => {
      renderWithProviders(<PopularQueries data={mockAnalyticsData.popularQueries} />);

      // Check Arabic queries
      expect(screen.getByText('ما هي أحكام الإجازة السنوية؟')).toBeInTheDocument();
      expect(screen.getByText('كيف يتم حساب مكافأة نهاية الخدمة؟')).toBeInTheDocument();
      expect(screen.getByText('ما هي حقوق العامل عند إنهاء الخدمة؟')).toBeInTheDocument();

      // Check metrics
      expect(screen.getByText('89')).toBeInTheDocument(); // Query count
      expect(screen.getByText('96.6%')).toBeInTheDocument(); // Success rate
      expect(screen.getByText('1.1s')).toBeInTheDocument(); // Response time
    });

    it('should sort queries by different metrics', async () => {
      const user = userEvent.setup();
      renderWithProviders(<PopularQueries data={mockAnalyticsData.popularQueries} />);

      // Click sort by success rate
      const sortButton = screen.getByRole('button', { name: /ترتيب حسب معدل النجاح/ });
      await user.click(sortButton);

      // Verify sorting has changed
      await waitFor(() => {
        expect(screen.getAllByTestId('query-item')[0]).toHaveTextContent('98.7%');
      });
    });

    it('should show query details on click', async () => {
      const user = userEvent.setup();
      renderWithProviders(<PopularQueries data={mockAnalyticsData.popularQueries} />);

      const firstQuery = screen.getAllByTestId('query-item')[0];
      await user.click(firstQuery);

      // Check for detailed modal or expanded view
      expect(screen.getByText('تفاصيل الاستعلام')).toBeInTheDocument();
    });
  });

  describe('PerformanceMetrics Component', () => {
    it('should render performance metrics correctly', () => {
      renderWithProviders(<PerformanceMetrics data={mockAnalyticsData.performance} />);

      // Check response time percentiles
      expect(screen.getByText('P50: 0.8s')).toBeInTheDocument();
      expect(screen.getByText('P95: 2.1s')).toBeInTheDocument();
      expect(screen.getByText('P99: 3.4s')).toBeInTheDocument();

      // Check error rate
      expect(screen.getByText('1.5%')).toBeInTheDocument();

      // Check availability
      expect(screen.getByText('99.8%')).toBeInTheDocument();

      // Check cache hit rate
      expect(screen.getByText('78.3%')).toBeInTheDocument();
    });

    it('should show performance alerts when thresholds are exceeded', () => {
      const badPerformanceData = {
        ...mockAnalyticsData.performance,
        p99: 5.0, // Exceeds threshold
        errorRate: 5.0, // Exceeds threshold
        availability: 95.0, // Below threshold
      };

      renderWithProviders(<PerformanceMetrics data={badPerformanceData} />);

      // Check for alert indicators
      expect(screen.getAllByTestId('performance-alert')).toHaveLength(3);
      expect(screen.getByText('تحذير: زمن الاستجابة مرتفع')).toBeInTheDocument();
      expect(screen.getByText('تحذير: معدل الأخطاء مرتفع')).toBeInTheDocument();
      expect(screen.getByText('تحذير: توفر النظام منخفض')).toBeInTheDocument();
    });

    it('should display performance history chart', () => {
      renderWithProviders(<PerformanceMetrics data={mockAnalyticsData.performance} />);

      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      expect(screen.getByText('تاريخ الأداء')).toBeInTheDocument();
    });
  });

  describe('Integration Tests', () => {
    it('should update all components when date range changes', async () => {
      const user = userEvent.setup();
      
      renderWithProviders(
        <div>
          <OverviewCards data={mockAnalyticsData.overview} />
          <UsageChart data={mockAnalyticsData.usage.daily} />
          <CostBreakdown data={mockAnalyticsData.costs} />
        </div>
      );

      // Find and interact with date range picker
      const dateRangeButton = screen.getByRole('button', { name: /نطاق التاريخ/ });
      await user.click(dateRangeButton);

      // Select last 7 days
      const last7DaysOption = screen.getByRole('button', { name: /آخر 7 أيام/ });
      await user.click(last7DaysOption);

      // Verify components are updated
      await waitFor(() => {
        expect(mockUseAnalytics).toHaveBeenCalledWith(
          expect.objectContaining({
            dateRange: 'last7days'
          })
        );
      });
    });

    it('should handle real-time updates', async () => {
      const { rerender } = renderWithProviders(
        <OverviewCards data={mockAnalyticsData.overview} />
      );

      // Simulate real-time data update
      const updatedData = {
        ...mockAnalyticsData.overview,
        totalQueries: 1600,
        uniqueUsers: 95,
      };

      rerender(
        <QueryClientProvider client={queryClient}>
          <OverviewCards data={updatedData} />
        </QueryClientProvider>
      );

      // Verify updated values
      expect(screen.getByText('1,600')).toBeInTheDocument();
      expect(screen.getByText('95')).toBeInTheDocument();
    });

    it('should handle Arabic number formatting', () => {
      const arabicData = {
        ...mockAnalyticsData.overview,
        totalQueries: 123456,
      };

      renderWithProviders(<OverviewCards data={arabicData} />);

      // Check for Arabic number formatting (with Arabic thousand separators)
      expect(screen.getByText('123,456')).toBeInTheDocument();
    });

    it('should be accessible with screen readers', () => {
      renderWithProviders(<OverviewCards data={mockAnalyticsData.overview} />);

      // Check ARIA labels
      expect(screen.getByLabelText('إجمالي الاستعلامات')).toBeInTheDocument();
      expect(screen.getByLabelText('المستخدمين الفريدين')).toBeInTheDocument();

      // Check heading structure
      expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
    });
  });
});