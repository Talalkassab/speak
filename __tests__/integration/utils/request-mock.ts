import { NextRequest } from 'next/server';

interface MockRequestOptions {
  headers?: Record<string, string>;
  searchParams?: URLSearchParams;
  body?: any;
  method?: string;
}

export const createMockRequest = (
  method: string = 'GET',
  url: string = '/api/test',
  options: MockRequestOptions = {}
): NextRequest => {
  const { headers = {}, searchParams, body } = options;
  
  // Construct the full URL with search params
  let fullUrl = `http://localhost:3000${url}`;
  if (searchParams) {
    fullUrl += `?${searchParams.toString()}`;
  }

  const mockHeaders = new Headers(headers);
  
  const requestInit: RequestInit = {
    method,
    headers: mockHeaders,
  };

  if (body && method !== 'GET' && method !== 'HEAD') {
    if (typeof body === 'object' && !(body instanceof FormData)) {
      requestInit.body = JSON.stringify(body);
      mockHeaders.set('Content-Type', 'application/json');
    } else {
      requestInit.body = body;
    }
  }

  return new NextRequest(fullUrl, requestInit);
};

export const createMockFormDataRequest = (
  url: string,
  formData: FormData,
  headers: Record<string, string> = {}
): NextRequest => {
  return createMockRequest('POST', url, {
    headers,
    body: formData,
  });
};

export const createMockJSONRequest = (
  method: string,
  url: string,
  data: any,
  headers: Record<string, string> = {}
): NextRequest => {
  return createMockRequest(method, url, {
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: data,
  });
};