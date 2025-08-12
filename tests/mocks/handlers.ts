import { http, HttpResponse } from 'msw';
import { mockAnalyticsData } from './data/analytics';
import { mockConversationData } from './data/conversations';
import { mockDocumentData } from './data/documents';
import { mockTemplateData } from './data/templates';

const API_BASE = 'http://localhost:3000/api';

export const handlers = [
  // Analytics API endpoints
  http.get(`${API_BASE}/v1/analytics/metrics`, () => {
    return HttpResponse.json(mockAnalyticsData.metrics);
  }),

  http.get(`${API_BASE}/v1/analytics/usage`, () => {
    return HttpResponse.json(mockAnalyticsData.usage);
  }),

  http.get(`${API_BASE}/v1/analytics/performance`, () => {
    return HttpResponse.json(mockAnalyticsData.performance);
  }),

  http.get(`${API_BASE}/v1/analytics/costs`, () => {
    return HttpResponse.json(mockAnalyticsData.costs);
  }),

  http.get(`${API_BASE}/v1/analytics/compliance`, () => {
    return HttpResponse.json(mockAnalyticsData.compliance);
  }),

  http.get(`${API_BASE}/v1/analytics/realtime`, () => {
    return HttpResponse.json(mockAnalyticsData.realtime);
  }),

  // Chat/Conversation endpoints
  http.get(`${API_BASE}/v1/chat/conversations`, () => {
    return HttpResponse.json(mockConversationData.conversations);
  }),

  http.post(`${API_BASE}/v1/chat/conversations`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      id: 'new-conversation-id',
      title: body.title || 'New Conversation',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      messages: [],
    });
  }),

  http.get(`${API_BASE}/v1/chat/conversations/:id/messages`, ({ params }) => {
    const conversationId = params.id;
    const messages = mockConversationData.messages[conversationId as string] || [];
    return HttpResponse.json({ messages });
  }),

  http.post(`${API_BASE}/v1/chat/conversations/:id/messages`, async ({ request, params }) => {
    const body = await request.json();
    return HttpResponse.json({
      id: 'new-message-id',
      conversation_id: params.id,
      content: body.content,
      role: 'user',
      created_at: new Date().toISOString(),
    });
  }),

  // Document endpoints
  http.get(`${API_BASE}/v1/documents`, ({ request }) => {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const category = url.searchParams.get('category');
    
    let documents = mockDocumentData.documents;
    
    if (category) {
      documents = documents.filter(doc => doc.category === category);
    }
    
    const start = (page - 1) * limit;
    const paginatedDocs = documents.slice(start, start + limit);
    
    return HttpResponse.json({
      documents: paginatedDocs,
      total: documents.length,
      page,
      limit,
      totalPages: Math.ceil(documents.length / limit),
    });
  }),

  http.post(`${API_BASE}/documents/upload`, async ({ request }) => {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    return HttpResponse.json({
      id: 'new-document-id',
      filename: file?.name || 'uploaded-file.pdf',
      size: file?.size || 1024,
      status: 'processing',
      uploaded_at: new Date().toISOString(),
    });
  }),

  http.get(`${API_BASE}/v1/documents/:id`, ({ params }) => {
    const document = mockDocumentData.documents.find(doc => doc.id === params.id);
    if (!document) {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json(document);
  }),

  http.post(`${API_BASE}/v1/documents/:id/reprocess`, ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      status: 'processing',
      message: 'Document reprocessing started',
    });
  }),

  // Template endpoints
  http.get(`${API_BASE}/v1/templates`, ({ request }) => {
    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    
    let templates = mockTemplateData.templates;
    
    if (category) {
      templates = templates.filter(template => template.category === category);
    }
    
    return HttpResponse.json({ templates });
  }),

  http.get(`${API_BASE}/v1/templates/categories`, () => {
    return HttpResponse.json(mockTemplateData.categories);
  }),

  http.post(`${API_BASE}/v1/templates`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      id: 'new-template-id',
      ...body,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }),

  http.get(`${API_BASE}/v1/templates/:id`, ({ params }) => {
    const template = mockTemplateData.templates.find(t => t.id === params.id);
    if (!template) {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json(template);
  }),

  http.post(`${API_BASE}/v1/templates/:id/generate`, async ({ request, params }) => {
    const body = await request.json();
    return HttpResponse.json({
      id: 'generated-document-id',
      template_id: params.id,
      generated_content: 'Generated document content...',
      variables_used: body.variables,
      created_at: new Date().toISOString(),
    });
  }),

  // Voice endpoints
  http.post(`${API_BASE}/v1/voice/transcribe`, async ({ request }) => {
    const formData = await request.formData();
    const audioFile = formData.get('audio');
    
    return HttpResponse.json({
      transcript: 'مرحباً، كيف يمكنني مساعدتك اليوم؟',
      language: 'ar-SA',
      confidence: 0.95,
      duration: 3.2,
    });
  }),

  // Export endpoints
  http.post(`${API_BASE}/v1/export/conversations/:id/pdf`, ({ params }) => {
    return HttpResponse.json({
      job_id: 'export-job-id',
      status: 'processing',
      download_url: null,
      estimated_completion: new Date(Date.now() + 30000).toISOString(),
    });
  }),

  http.get(`${API_BASE}/v1/export/jobs/:jobId/status`, ({ params }) => {
    return HttpResponse.json({
      job_id: params.jobId,
      status: 'completed',
      download_url: '/downloads/conversation-export.pdf',
      completed_at: new Date().toISOString(),
    });
  }),

  // Health check endpoints
  http.get(`${API_BASE}/health`, () => {
    return HttpResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'healthy',
        redis: 'healthy',
        openai: 'healthy',
        supabase: 'healthy',
      },
    });
  }),

  // RAG endpoints
  http.post(`${API_BASE}/rag/query`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      query: body.query,
      answer: 'هذا جواب تجريبي من نظام الذكاء الاصطناعي للموارد البشرية',
      sources: [
        {
          document_id: 'doc-1',
          title: 'نظام العمل السعودي',
          excerpt: 'مقطع من القانون ذو صلة بالسؤال',
          relevance_score: 0.92,
        },
      ],
      processing_time: 1.2,
    });
  }),

  // Error simulation endpoints for testing
  http.get(`${API_BASE}/test/error`, () => {
    return new HttpResponse(null, { status: 500 });
  }),

  http.get(`${API_BASE}/test/timeout`, () => {
    return new Promise(() => {}); // Never resolves to simulate timeout
  }),

  // Supabase API mocks
  http.get('http://localhost:54321/rest/v1/*', () => {
    return HttpResponse.json({ data: [], error: null });
  }),

  http.post('http://localhost:54321/rest/v1/*', () => {
    return HttpResponse.json({ data: {}, error: null });
  }),
];