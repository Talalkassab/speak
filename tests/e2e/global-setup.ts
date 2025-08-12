import { chromium, FullConfig } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global E2E test setup...');

  // Initialize test database
  await setupTestDatabase();

  // Seed test data
  await seedTestData();

  // Start test services if needed
  await startTestServices();

  console.log('✅ Global E2E test setup completed');
}

async function setupTestDatabase() {
  console.log('📦 Setting up test database...');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';
  
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Clean up existing test data
  try {
    await supabase.from('conversations').delete().like('title', '%test%');
    await supabase.from('documents').delete().like('filename', '%test%');
    await supabase.from('organizations').delete().like('name', '%Test%');
    await supabase.from('users').delete().like('email', '%test%');
  } catch (error) {
    console.log('Note: Some cleanup operations failed (expected for fresh database)');
  }

  console.log('✅ Test database prepared');
}

async function seedTestData() {
  console.log('🌱 Seeding test data...');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';
  
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Create test organization
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .insert({
      id: 'test-org-e2e',
      name: 'Test Organization E2E',
      domain: 'teste2e.com',
      settings: {
        language: 'ar',
        timezone: 'Asia/Riyadh',
        currency: 'SAR',
      },
    })
    .select()
    .single();

  if (orgError && !orgError.message.includes('duplicate')) {
    console.error('Failed to create test organization:', orgError);
  }

  // Create test users
  const testUsers = [
    {
      id: 'test-user-admin-e2e',
      email: 'admin@teste2e.com',
      role: 'admin',
      organization_id: 'test-org-e2e',
    },
    {
      id: 'test-user-member-e2e', 
      email: 'member@teste2e.com',
      role: 'member',
      organization_id: 'test-org-e2e',
    },
  ];

  for (const user of testUsers) {
    const { error } = await supabase.from('users').upsert(user);
    if (error && !error.message.includes('duplicate')) {
      console.error(`Failed to create test user ${user.email}:`, error);
    }
  }

  // Create test documents
  const testDocuments = [
    {
      id: 'test-doc-1-e2e',
      filename: 'test-saudi-labor-law.pdf',
      title: 'Test Saudi Labor Law Document',
      category: 'legal',
      status: 'processed',
      organization_id: 'test-org-e2e',
      user_id: 'test-user-admin-e2e',
      extracted_text: 'نظام العمل السعودي - وثيقة اختبار',
      language: 'ar',
    },
    {
      id: 'test-doc-2-e2e',
      filename: 'test-hr-policies.docx',
      title: 'Test HR Policies Document',
      category: 'hr_policy',
      status: 'processed',
      organization_id: 'test-org-e2e',
      user_id: 'test-user-admin-e2e',
      extracted_text: 'HR Policies - Test Document',
      language: 'en',
    },
  ];

  for (const doc of testDocuments) {
    const { error } = await supabase.from('documents').upsert(doc);
    if (error && !error.message.includes('duplicate')) {
      console.error(`Failed to create test document ${doc.filename}:`, error);
    }
  }

  // Create test conversations
  const testConversations = [
    {
      id: 'test-conv-1-e2e',
      title: 'Test Conversation - Leave Types',
      status: 'completed',
      user_id: 'test-user-admin-e2e',
      organization_id: 'test-org-e2e',
      message_count: 4,
      created_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      updated_at: new Date(Date.now() - 1800000).toISOString(), // 30 min ago
    },
  ];

  for (const conv of testConversations) {
    const { error } = await supabase.from('conversations').upsert(conv);
    if (error && !error.message.includes('duplicate')) {
      console.error(`Failed to create test conversation:`, error);
    }
  }

  console.log('✅ Test data seeded successfully');
}

async function startTestServices() {
  console.log('🔧 Starting test services...');

  // Start any additional test services if needed
  // For example, mock email service, file upload service, etc.

  console.log('✅ Test services started');
}

export default globalSetup;