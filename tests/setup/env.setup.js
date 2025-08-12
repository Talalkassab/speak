// Environment setup for tests
process.env.NODE_ENV = 'test';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.PINECONE_API_KEY = 'test-pinecone-key';
process.env.PINECONE_ENVIRONMENT = 'test-env';
process.env.PINECONE_INDEX = 'test-index';
process.env.RESEND_API_KEY = 'test-resend-key';
process.env.STRIPE_SECRET_KEY = 'sk_test_123';
process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_123';
process.env.REDIS_URL = 'redis://localhost:6379/1';

// Test database URLs
process.env.TEST_DATABASE_URL = 'postgresql://postgres:password@localhost:54322/postgres';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;