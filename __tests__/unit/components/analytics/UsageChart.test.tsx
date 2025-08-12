import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UsageChart } from '@/components/analytics/UsageChart';
import { mockAnalyticsData } from '../../../mocks/data/analytics';

// Mock Recharts components
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  LineChart: ({ children, data }: any) => (
    <div data-testid="line-chart" data-chart-data={JSON.stringify(data)}>
      {children}
    </div>
  ),
  BarChart: ({ children, data }: any) => (
    <div data-testid="bar-chart" data-chart-data={JSON.stringify(data)}>
      {children}
    </div>
  ),
  Line: ({ dataKey, stroke }: any) => (
    <div data-testid="chart-line" data-key={dataKey} data-stroke={stroke} />
  ),
  Bar: ({ dataKey, fill }: any) => (
    <div data-testid="chart-bar" data-key={dataKey} data-fill={fill} />
  ),
  XAxis: ({ dataKey }: any) => <div data-testid="x-axis" data-key={dataKey} />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: ({ content }: any) => <div data-testid="chart-tooltip">{content}</div>,
  Legend: () => <div data-testid="chart-legend" />,
}));

const mockUsageData = mockAnalyticsData.usage;

describe('UsageChart', () => {
  beforeEach(() => {
    // Reset any mocks
    jest.clearAllMocks();
  });

  it('renders usage chart with default line chart type', () => {
    render(<UsageChart data={mockUsageData.queries_by_day} />);
    
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    expect(screen.getByTestId('chart-line')).toBeInTheDocument();
    expect(screen.getByTestId('x-axis')).toBeInTheDocument();
    expect(screen.getByTestId('y-axis')).toBeInTheDocument();
  });

  it('switches to bar chart when chart type is changed', () => {
    render(
      <UsageChart 
        data={mockUsageData.queries_by_day} 
        chartType="bar"
        showChartTypeSelector={true}
      />
    );
    
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    expect(screen.getByTestId('chart-bar')).toBeInTheDocument();
  });

  it('displays chart type selector when enabled', () => {
    render(
      <UsageChart 
        data={mockUsageData.queries_by_day} 
        showChartTypeSelector={true}
      />
    );
    
    expect(screen.getByRole('button', { name: /line chart/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /bar chart/i })).toBeInTheDocument();
  });

  it('handles chart type switching', async () => {
    render(
      <UsageChart 
        data={mockUsageData.queries_by_day} 
        showChartTypeSelector={true}
      />
    );
    
    // Initially should show line chart
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    
    // Click bar chart button
    fireEvent.click(screen.getByRole('button', { name: /bar chart/i }));
    
    await waitFor(() => {
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
      expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();
    });
  });

  it('formats data correctly for chart rendering', () => {
    render(<UsageChart data={mockUsageData.queries_by_day} />);
    
    const chartElement = screen.getByTestId('line-chart');
    const chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '[]');
    
    expect(chartData).toHaveLength(7);
    expect(chartData[0]).toHaveProperty('date');
    expect(chartData[0]).toHaveProperty('count');
    expect(chartData[0].count).toBe(420);
  });

  it('displays loading state when data is empty', () => {
    render(<UsageChart data={[]} isLoading={true} />);
    
    expect(screen.getByTestId('chart-loading-skeleton')).toBeInTheDocument();
    expect(screen.getByText('Loading chart data...')).toBeInTheDocument();
  });

  it('shows error state when data loading fails', () => {
    render(<UsageChart data={[]} error="Failed to load data" />);
    
    expect(screen.getByTestId('chart-error')).toBeInTheDocument();
    expect(screen.getByText('Failed to load data')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('handles retry functionality', async () => {
    const mockRetry = jest.fn();
    
    render(
      <UsageChart 
        data={[]} 
        error="Failed to load data" 
        onRetry={mockRetry}
      />
    );
    
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    
    expect(mockRetry).toHaveBeenCalledTimes(1);
  });

  it('supports Arabic date formatting', () => {
    // Mock Arabic locale
    const mockIntl = jest.spyOn(Intl, 'DateTimeFormat').mockImplementation(
      (locale: any) => ({
        format: (date: Date) => {
          if (locale === 'ar-SA') {
            return '٢٠٢٥-٠٨-٠٥'; // Arabic numerals
          }
          return '2025-08-05';
        },
      } as any)
    );

    render(<UsageChart data={mockUsageData.queries_by_day} locale="ar-SA" />);
    
    // Verify Arabic date formatting is applied
    expect(mockIntl).toHaveBeenCalledWith('ar-SA', expect.any(Object));
    
    mockIntl.mockRestore();
  });

  it('applies correct colors based on theme', () => {
    render(<UsageChart data={mockUsageData.queries_by_day} theme="dark" />);
    
    const chartLine = screen.getByTestId('chart-line');
    expect(chartLine).toHaveAttribute('data-stroke', '#60a5fa'); // Dark theme color
  });

  it('handles responsive container properly', () => {
    render(<UsageChart data={mockUsageData.queries_by_day} height={400} />);
    
    const container = screen.getByTestId('responsive-container');
    expect(container).toBeInTheDocument();
    expect(container.parentElement).toHaveStyle('height: 400px');
  });

  it('displays custom tooltip content', () => {
    const customTooltip = ({ active, payload, label }: any) => {
      if (active && payload && payload.length) {
        return (
          <div data-testid="custom-tooltip">
            <p>{`Date: ${label}`}</p>
            <p>{`Queries: ${payload[0].value}`}</p>
          </div>
        );
      }
      return null;
    };

    render(
      <UsageChart 
        data={mockUsageData.queries_by_day} 
        tooltipContent={customTooltip}
      />
    );
    
    // The custom tooltip would be rendered by Recharts
    expect(screen.getByTestId('chart-tooltip')).toBeInTheDocument();
  });

  it('handles empty data gracefully', () => {
    render(<UsageChart data={[]} />);
    
    expect(screen.getByTestId('empty-chart-state')).toBeInTheDocument();
    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('supports data filtering by date range', async () => {
    const allData = [
      ...mockUsageData.queries_by_day,
      { date: '2025-08-12', count: 600 },
      { date: '2025-08-13', count: 700 },
    ];

    const { rerender } = render(
      <UsageChart 
        data={allData}
        dateRange={{ start: '2025-08-05', end: '2025-08-07' }}
      />
    );
    
    let chartElement = screen.getByTestId('line-chart');
    let chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '[]');
    expect(chartData).toHaveLength(3); // Only 3 days in range
    
    // Update date range
    rerender(
      <UsageChart 
        data={allData}
        dateRange={{ start: '2025-08-05', end: '2025-08-13' }}
      />
    );
    
    chartElement = screen.getByTestId('line-chart');
    chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '[]');
    expect(chartData).toHaveLength(9); // All days
  });

  it('is accessible with proper ARIA attributes', () => {
    render(<UsageChart data={mockUsageData.queries_by_day} />);
    
    const chartContainer = screen.getByRole('img', { name: /usage chart/i });
    expect(chartContainer).toBeInTheDocument();
    expect(chartContainer).toHaveAttribute('aria-label', 'Usage statistics chart');
  });

  it('handles real-time data updates', async () => {
    const { rerender } = render(<UsageChart data={mockUsageData.queries_by_day} />);
    
    const newData = [
      ...mockUsageData.queries_by_day,
      { date: '2025-08-12', count: 550 },
    ];
    
    rerender(<UsageChart data={newData} />);
    
    await waitFor(() => {
      const chartElement = screen.getByTestId('line-chart');
      const chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '[]');
      expect(chartData).toHaveLength(8);
    });
  });
});