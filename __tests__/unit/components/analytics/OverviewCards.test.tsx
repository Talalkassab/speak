import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { OverviewCards } from '@/components/analytics/OverviewCards';
import { mockAnalyticsData } from '../../../mocks/data/analytics';

// Mock the analytics data fetching
const mockMetrics = mockAnalyticsData.metrics;

describe('OverviewCards', () => {
  it('renders all metric cards correctly', () => {
    render(<OverviewCards metrics={mockMetrics} />);
    
    // Check if all main metrics are displayed
    expect(screen.getByText('Total Queries')).toBeInTheDocument();
    expect(screen.getByText('15,420')).toBeInTheDocument();
    
    expect(screen.getByText('Active Users')).toBeInTheDocument();
    expect(screen.getByText('342')).toBeInTheDocument();
    
    expect(screen.getByText('Avg Response Time')).toBeInTheDocument();
    expect(screen.getByText('1.24s')).toBeInTheDocument();
    
    expect(screen.getByText('Success Rate')).toBeInTheDocument();
    expect(screen.getByText('98.7%')).toBeInTheDocument();
  });

  it('displays loading state when metrics are undefined', () => {
    render(<OverviewCards metrics={undefined} />);
    
    // Should show skeleton loaders or loading indicators
    expect(screen.getAllByTestId('metric-card-skeleton')).toHaveLength(4);
  });

  it('formats large numbers correctly', () => {
    const largeMetrics = {
      ...mockMetrics,
      total_queries: 1234567,
      total_users: 9876,
    };
    
    render(<OverviewCards metrics={largeMetrics} />);
    
    expect(screen.getByText('1,234,567')).toBeInTheDocument();
    expect(screen.getByText('9,876')).toBeInTheDocument();
  });

  it('shows trend indicators correctly', () => {
    const metricsWithTrends = {
      ...mockMetrics,
      trends: {
        queries_growth: 12.5,
        users_growth: -3.2,
        response_time_change: 0.8,
        success_rate_change: -0.1,
      },
    };
    
    render(<OverviewCards metrics={metricsWithTrends} />);
    
    // Check for trend indicators
    expect(screen.getByTestId('trend-up')).toBeInTheDocument();
    expect(screen.getByTestId('trend-down')).toBeInTheDocument();
    expect(screen.getByText('+12.5%')).toBeInTheDocument();
    expect(screen.getByText('-3.2%')).toBeInTheDocument();
  });

  it('applies correct styling for different metric types', () => {
    render(<OverviewCards metrics={mockMetrics} />);
    
    const successRateCard = screen.getByTestId('success-rate-card');
    const responseTimeCard = screen.getByTestId('response-time-card');
    
    // Success rate card should have green styling for high values
    expect(successRateCard).toHaveClass('border-green-200');
    
    // Response time card should have appropriate styling
    expect(responseTimeCard).toHaveClass('border-blue-200');
  });

  it('handles Arabic numerals and RTL layout', () => {
    // Mock Arabic locale
    Object.defineProperty(navigator, 'language', {
      value: 'ar-SA',
      configurable: true,
    });
    
    render(<OverviewCards metrics={mockMetrics} />);
    
    const container = screen.getByTestId('overview-cards-container');
    expect(container).toHaveAttribute('dir', 'rtl');
  });

  it('is accessible with proper ARIA labels', () => {
    render(<OverviewCards metrics={mockMetrics} />);
    
    // Check for accessibility attributes
    expect(screen.getByRole('region', { name: /analytics overview/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Total queries: 15,420')).toBeInTheDocument();
    expect(screen.getByLabelText('Success rate: 98.7%')).toBeInTheDocument();
  });

  it('updates when metrics prop changes', async () => {
    const { rerender } = render(<OverviewCards metrics={mockMetrics} />);
    
    expect(screen.getByText('15,420')).toBeInTheDocument();
    
    const updatedMetrics = {
      ...mockMetrics,
      total_queries: 16000,
    };
    
    rerender(<OverviewCards metrics={updatedMetrics} />);
    
    await waitFor(() => {
      expect(screen.getByText('16,000')).toBeInTheDocument();
    });
  });

  it('handles edge cases with zero values', () => {
    const zeroMetrics = {
      total_queries: 0,
      total_users: 0,
      avg_response_time: 0,
      success_rate: 0,
      daily_active_users: 0,
      monthly_active_users: 0,
    };
    
    render(<OverviewCards metrics={zeroMetrics} />);
    
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('displays error state when metrics contain invalid data', () => {
    const invalidMetrics = {
      total_queries: NaN,
      total_users: null,
      avg_response_time: undefined,
      success_rate: 'invalid',
    };
    
    render(<OverviewCards metrics={invalidMetrics as any} />);
    
    // Should show fallback values or error indicators
    expect(screen.getByText('--')).toBeInTheDocument();
  });
});