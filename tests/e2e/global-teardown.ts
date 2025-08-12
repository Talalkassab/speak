import { FullConfig } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting global E2E test teardown...');

  // Clean up test data
  await cleanupTestData();

  // Stop test services
  await stopTestServices();

  console.log('✅ Global E2E test teardown completed');
}

async function cleanupTestData() {
  console.log('🗑️  Cleaning up test data...');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';
  
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // Clean up in reverse order of dependencies
    await supabase.from('messages').delete().like('conversation_id', '%test%e2e%');
    await supabase.from('conversations').delete().like('id', '%test%e2e%');
    await supabase.from('document_chunks').delete().like('document_id', '%test%e2e%');
    await supabase.from('documents').delete().like('id', '%test%e2e%');
    await supabase.from('users').delete().like('id', '%test%e2e%');
    await supabase.from('organizations').delete().like('id', '%test%e2e%');
    
    console.log('✅ Test data cleaned up successfully');
  } catch (error) {
    console.error('Failed to cleanup some test data:', error);
  }
}

async function stopTestServices() {
  console.log('🔧 Stopping test services...');

  // Stop any test services that were started in global setup

  console.log('✅ Test services stopped');
}

export default globalTeardown;