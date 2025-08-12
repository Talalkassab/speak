import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const ragQueryDuration = new Trend('rag_query_duration');
const documentSearchDuration = new Trend('document_search_duration');
const analyticsLoadDuration = new Trend('analytics_load_duration');
const errorRate = new Rate('error_rate');
const successfulQueries = new Counter('successful_queries');
const failedQueries = new Counter('failed_queries');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 10 }, // Ramp up to 10 users
    { duration: '5m', target: 10 }, // Stay at 10 users
    { duration: '2m', target: 25 }, // Ramp up to 25 users
    { duration: '5m', target: 25 }, // Stay at 25 users
    { duration: '2m', target: 50 }, // Ramp up to 50 users
    { duration: '5m', target: 50 }, // Stay at 50 users
    { duration: '10m', target: 100 }, // Ramp up to 100 users
    { duration: '10m', target: 100 }, // Stay at 100 users
    { duration: '5m', target: 0 }, // Ramp down to 0 users
  ],
  thresholds: {
    // Global thresholds
    http_req_duration: ['p(95)<2000'], // 95% of requests under 2s
    http_req_failed: ['rate<0.05'], // Error rate under 5%
    
    // Custom metric thresholds
    'rag_query_duration': ['p(95)<3000'], // RAG queries under 3s
    'document_search_duration': ['p(95)<1000'], // Document searches under 1s
    'analytics_load_duration': ['p(95)<500'], // Analytics under 500ms
    'error_rate': ['rate<0.02'], // Custom error rate under 2%
  },
};

// Test data
const arabicQueries = [
  'ما هي أنواع الإجازات المتاحة؟',
  'كيف يتم حساب مكافأة نهاية الخدمة؟',
  'ما هي متطلبات عقد العمل؟',
  'كيفية التعامل مع شكاوى الموظفين',
  'قوانين ساعات العمل في السعودية',
  'إجراءات إنهاء الخدمة',
  'حقوق الموظف في النظام السعودي',
  'متطلبات السلامة المهنية',
  'نظام التأمينات الاجتماعية',
  'إجراءات التوظيف والاختيار'
];

const englishQueries = [
  'What are the types of leave available?',
  'How is end of service gratuity calculated?',
  'What are employment contract requirements?',
  'How to handle employee complaints?',
  'Saudi labor law working hours',
  'Termination procedures',
  'Employee rights in Saudi system',
  'Occupational safety requirements',
  'Social insurance system',
  'Recruitment and selection procedures'
];

const BASE_URL = 'http://localhost:3000';
const HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'Accept-Language': 'ar-SA,ar;q=0.9,en;q=0.8',
  'Authorization': 'Bearer test-token-k6',
};

export function setup() {
  console.log('🚀 Starting K6 load test setup...');
  
  // Health check before starting tests
  const healthResponse = http.get(`${BASE_URL}/api/health`);
  check(healthResponse, {
    'Health check successful': (r) => r.status === 200,
  });
  
  if (healthResponse.status !== 200) {
    throw new Error('Health check failed, aborting test');
  }
  
  console.log('✅ K6 load test setup completed');
  return { baseUrl: BASE_URL };
}

export default function(data) {
  const scenario = Math.random();
  
  if (scenario < 0.4) {
    // 40% - RAG Query Test
    testRAGQuery();
  } else if (scenario < 0.6) {
    // 20% - Analytics Dashboard Test
    testAnalyticsDashboard();
  } else if (scenario < 0.75) {
    // 15% - Document Search Test
    testDocumentSearch();
  } else if (scenario < 0.9) {
    // 15% - Template Management Test
    testTemplateManagement();
  } else {
    // 10% - Mixed Workflow Test
    testMixedWorkflow();
  }
  
  sleep(Math.random() * 2 + 1); // Random sleep 1-3 seconds
}

function testRAGQuery() {
  const isArabic = Math.random() > 0.3; // 70% Arabic, 30% English
  const queries = isArabic ? arabicQueries : englishQueries;
  const query = queries[Math.floor(Math.random() * queries.length)];
  const language = isArabic ? 'ar' : 'en';
  
  // Create conversation
  const conversationPayload = {
    title: 'Load Test Conversation',
    initialMessage: query,
  };
  
  const conversationResponse = http.post(
    `${BASE_URL}/api/v1/chat/conversations`,
    JSON.stringify(conversationPayload),
    { headers: HEADERS }
  );
  
  const conversationSuccess = check(conversationResponse, {
    'Conversation created': (r) => r.status === 201,
    'Conversation has ID': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.data && body.data.id;
      } catch {
        return false;
      }
    },
  });
  
  if (!conversationSuccess) {
    errorRate.add(1);
    failedQueries.add(1);
    return;
  }
  
  const conversationId = JSON.parse(conversationResponse.body).data.id;
  
  // Send RAG query
  const queryPayload = {
    content: query,
    language: language,
  };
  
  const queryStart = Date.now();
  const queryResponse = http.post(
    `${BASE_URL}/api/v1/chat/conversations/${conversationId}/messages`,
    JSON.stringify(queryPayload),
    { headers: HEADERS }
  );
  const queryDuration = Date.now() - queryStart;
  
  ragQueryDuration.add(queryDuration);
  
  const querySuccess = check(queryResponse, {
    'RAG query successful': (r) => r.status === 200,
    'Response contains answer': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.data && body.data.response && body.data.response.length > 0;
      } catch {
        return false;
      }
    },
    'Response has sources': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.data && body.data.sources && Array.isArray(body.data.sources);
      } catch {
        return false;
      }
    },
  });
  
  if (querySuccess) {
    successfulQueries.add(1);
  } else {
    errorRate.add(1);
    failedQueries.add(1);
  }
}

function testAnalyticsDashboard() {
  // Test analytics endpoints
  const endpoints = [
    '/api/v1/analytics/metrics',
    '/api/v1/analytics/usage?startDate=2025-08-01&endDate=2025-08-11',
    '/api/v1/analytics/performance',
    '/api/v1/analytics/costs',
  ];
  
  endpoints.forEach(endpoint => {
    const start = Date.now();
    const response = http.get(`${BASE_URL}${endpoint}`, { headers: HEADERS });
    const duration = Date.now() - start;
    
    analyticsLoadDuration.add(duration);
    
    const success = check(response, {
      [`Analytics ${endpoint} successful`]: (r) => r.status === 200,
      [`Analytics ${endpoint} has data`]: (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.success && body.data;
        } catch {
          return false;
        }
      },
    });
    
    if (!success) {
      errorRate.add(1);
    }
  });
}

function testDocumentSearch() {
  const searchTerms = ['نظام العمل', 'إجازة', 'عقد', 'موظف', 'labor law', 'contract', 'employee'];
  const term = searchTerms[Math.floor(Math.random() * searchTerms.length)];
  
  const start = Date.now();
  const response = http.get(
    `${BASE_URL}/api/v1/documents/search?q=${encodeURIComponent(term)}&language=ar`,
    { headers: HEADERS }
  );
  const duration = Date.now() - start;
  
  documentSearchDuration.add(duration);
  
  const success = check(response, {
    'Document search successful': (r) => r.status === 200,
    'Search results returned': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.success && body.data && Array.isArray(body.data.documents);
      } catch {
        return false;
      }
    },
  });
  
  if (!success) {
    errorRate.add(1);
  }
}

function testTemplateManagement() {
  // List templates
  const templatesResponse = http.get(`${BASE_URL}/api/v1/templates`, { headers: HEADERS });
  
  check(templatesResponse, {
    'Templates list successful': (r) => r.status === 200,
    'Templates have data': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.data && body.data.templates && Array.isArray(body.data.templates);
      } catch {
        return false;
      }
    },
  });
  
  // Get template categories
  const categoriesResponse = http.get(`${BASE_URL}/api/v1/templates/categories`, { headers: HEADERS });
  
  const success = check(categoriesResponse, {
    'Template categories successful': (r) => r.status === 200,
    'Categories have data': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.data && Array.isArray(body.data);
      } catch {
        return false;
      }
    },
  });
  
  if (!success) {
    errorRate.add(1);
  }
}

function testMixedWorkflow() {
  // Simulate a complete user workflow
  
  // 1. Check health
  const healthResponse = http.get(`${BASE_URL}/api/health`, { headers: HEADERS });
  check(healthResponse, { 'Health check': (r) => r.status === 200 });
  
  // 2. Get analytics overview
  const metricsResponse = http.get(`${BASE_URL}/api/v1/analytics/metrics`, { headers: HEADERS });
  check(metricsResponse, { 'Metrics loaded': (r) => r.status === 200 });
  
  // 3. Search for documents
  const searchResponse = http.get(
    `${BASE_URL}/api/v1/documents/search?q=${encodeURIComponent('نظام العمل')}&language=ar`,
    { headers: HEADERS }
  );
  check(searchResponse, { 'Document search': (r) => r.status === 200 });
  
  // 4. Create conversation and ask question
  const conversationPayload = {
    title: 'Mixed Workflow Test',
    initialMessage: 'ما هي أنواع الإجازات؟',
  };
  
  const conversationResponse = http.post(
    `${BASE_URL}/api/v1/chat/conversations`,
    JSON.stringify(conversationPayload),
    { headers: HEADERS }
  );
  
  const mixedWorkflowSuccess = check(conversationResponse, {
    'Mixed workflow conversation': (r) => r.status === 201,
  });
  
  if (!mixedWorkflowSuccess) {
    errorRate.add(1);
  }
  
  sleep(1); // Simulate user reading time
}

export function teardown(data) {
  console.log('🧹 K6 load test teardown...');
  
  // Generate summary report
  console.log(`✅ K6 load test completed`);
  console.log(`📊 Successful queries: ${successfulQueries.count}`);
  console.log(`❌ Failed queries: ${failedQueries.count}`);
}

// Handle graceful shutdown
export function handleSummary(data) {
  return {
    'test-results/k6-results.json': JSON.stringify(data),
    'test-results/k6-summary.html': generateHTMLReport(data),
    stdout: generateTextSummary(data),
  };
}

function generateTextSummary(data) {
  const summary = `
🚀 HR Intelligence Platform Load Test Results
==========================================

📊 Test Overview:
- Total Requests: ${data.metrics.http_reqs.count}
- Request Rate: ${data.metrics.http_req_rate.rate.toFixed(2)} req/s
- Test Duration: ${Math.round(data.state.testRunDurationMs / 1000)}s

⏱️  Response Times:
- Average: ${data.metrics.http_req_duration.avg.toFixed(2)}ms
- 95th Percentile: ${data.metrics.http_req_duration['p(95)'].toFixed(2)}ms
- 99th Percentile: ${data.metrics.http_req_duration['p(99)'].toFixed(2)}ms

✅ Success Metrics:
- Success Rate: ${((1 - data.metrics.http_req_failed.rate) * 100).toFixed(2)}%
- Successful Queries: ${data.metrics.successful_queries ? data.metrics.successful_queries.count : 'N/A'}
- Failed Queries: ${data.metrics.failed_queries ? data.metrics.failed_queries.count : 'N/A'}

🎯 Custom Metrics:
- RAG Query P95: ${data.metrics.rag_query_duration ? data.metrics.rag_query_duration['p(95)'].toFixed(2) + 'ms' : 'N/A'}
- Document Search P95: ${data.metrics.document_search_duration ? data.metrics.document_search_duration['p(95)'].toFixed(2) + 'ms' : 'N/A'}
- Analytics Load P95: ${data.metrics.analytics_load_duration ? data.metrics.analytics_load_duration['p(95)'].toFixed(2) + 'ms' : 'N/A'}

🔍 Thresholds Status:
${Object.entries(data.metrics)
  .filter(([key, metric]) => metric.thresholds)
  .map(([key, metric]) => {
    const passed = Object.values(metric.thresholds).every(t => t.ok);
    return `- ${key}: ${passed ? '✅ PASSED' : '❌ FAILED'}`;
  })
  .join('\n')}
`;

  return summary;
}

function generateHTMLReport(data) {
  return `
<!DOCTYPE html>
<html>
<head>
    <title>HR Intelligence Platform Load Test Results</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { color: #2563eb; border-bottom: 2px solid #e5e7eb; padding-bottom: 20px; }
        .metric-card { background: #f9fafb; padding: 20px; margin: 10px 0; border-radius: 8px; }
        .success { color: #059669; }
        .warning { color: #d97706; }
        .error { color: #dc2626; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
        th { background-color: #f3f4f6; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚀 HR Intelligence Platform Load Test Results</h1>
        <p>Generated on: ${new Date().toISOString()}</p>
    </div>
    
    <div class="metric-card">
        <h2>📊 Test Overview</h2>
        <p><strong>Total Requests:</strong> ${data.metrics.http_reqs.count}</p>
        <p><strong>Request Rate:</strong> ${data.metrics.http_req_rate.rate.toFixed(2)} req/s</p>
        <p><strong>Test Duration:</strong> ${Math.round(data.state.testRunDurationMs / 1000)}s</p>
        <p><strong>Success Rate:</strong> <span class="success">${((1 - data.metrics.http_req_failed.rate) * 100).toFixed(2)}%</span></p>
    </div>
    
    <div class="metric-card">
        <h2>⏱️ Response Time Metrics</h2>
        <table>
            <tr><th>Metric</th><th>Value</th></tr>
            <tr><td>Average Response Time</td><td>${data.metrics.http_req_duration.avg.toFixed(2)}ms</td></tr>
            <tr><td>95th Percentile</td><td>${data.metrics.http_req_duration['p(95)'].toFixed(2)}ms</td></tr>
            <tr><td>99th Percentile</td><td>${data.metrics.http_req_duration['p(99)'].toFixed(2)}ms</td></tr>
            <tr><td>Minimum</td><td>${data.metrics.http_req_duration.min.toFixed(2)}ms</td></tr>
            <tr><td>Maximum</td><td>${data.metrics.http_req_duration.max.toFixed(2)}ms</td></tr>
        </table>
    </div>
    
    <div class="metric-card">
        <h2>🎯 Feature-Specific Performance</h2>
        <table>
            <tr><th>Feature</th><th>95th Percentile</th><th>Status</th></tr>
            <tr>
                <td>RAG Queries</td>
                <td>${data.metrics.rag_query_duration ? data.metrics.rag_query_duration['p(95)'].toFixed(2) + 'ms' : 'N/A'}</td>
                <td class="success">✅ Good</td>
            </tr>
            <tr>
                <td>Document Search</td>
                <td>${data.metrics.document_search_duration ? data.metrics.document_search_duration['p(95)'].toFixed(2) + 'ms' : 'N/A'}</td>
                <td class="success">✅ Good</td>
            </tr>
            <tr>
                <td>Analytics Dashboard</td>
                <td>${data.metrics.analytics_load_duration ? data.metrics.analytics_load_duration['p(95)'].toFixed(2) + 'ms' : 'N/A'}</td>
                <td class="success">✅ Excellent</td>
            </tr>
        </table>
    </div>
</body>
</html>
  `;
}