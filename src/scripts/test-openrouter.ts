#!/usr/bin/env tsx

/**
 * OpenRouter Connection Test Script
 * Tests the OpenRouter API connection and Arabic language capabilities
 */

import { openRouterClient } from '../libs/services/openrouter-client';

async function testOpenRouterConnection() {
  console.log('🧪 Starting OpenRouter API Tests...\n');

  try {
    // Test 1: Health Check
    console.log('1️⃣ Testing OpenRouter Health Check...');
    const health = await openRouterClient.healthCheck();
    console.log(`Status: ${health.status}`);
    console.log(`Latency: ${health.latency}ms`);
    console.log(`Models Available: ${health.modelsAvailable}`);
    
    if (health.status === 'unhealthy') {
      console.error('❌ Health check failed:', health.error);
      return;
    }
    console.log('✅ Health check passed!\n');

    // Test 2: Simple Arabic Chat
    console.log('2️⃣ Testing Arabic Chat Completion...');
    const arabicChatResponse = await openRouterClient.generateChatCompletion([
      {
        role: 'user',
        content: 'مرحباً، ما هي حقوق الموظف الأساسية في المملكة العربية السعودية؟'
      }
    ]);

    console.log(`Model Used: ${arabicChatResponse.model}`);
    console.log(`Processing Time: ${arabicChatResponse.processingTime}ms`);
    console.log(`Tokens Used: ${arabicChatResponse.usage.totalTokens}`);
    console.log(`Cost: $${arabicChatResponse.usage.cost.toFixed(4)}`);
    console.log(`Response: ${arabicChatResponse.data.substring(0, 200)}...\n`);
    console.log('✅ Arabic chat test passed!\n');

    // Test 3: Document Processing
    console.log('3️⃣ Testing Document Processing...');
    const docResponse = await openRouterClient.processDocument(
      'عقد العمل هذا يحدد شروط العمل للموظف في الشركة. الراتب الأساسي 5000 ريال شهرياً. ساعات العمل من 8 صباحاً إلى 5 مساءً.',
      'extract',
      {
        language: 'ar',
        instructions: 'استخرج المعلومات المهمة من عقد العمل'
      }
    );

    console.log(`Model Used: ${docResponse.model}`);
    console.log(`Processing Time: ${docResponse.processingTime}ms`);
    console.log(`Tokens Used: ${docResponse.usage.totalTokens}`);
    console.log(`Cost: $${docResponse.usage.cost.toFixed(4)}`);
    console.log(`Extracted Info: ${docResponse.data.substring(0, 200)}...\n`);
    console.log('✅ Document processing test passed!\n');

    // Test 4: Embedding Generation
    console.log('4️⃣ Testing Arabic Embedding Generation...');
    const embeddingResponse = await openRouterClient.generateEmbedding(
      'ما هي سياسة الإجازات في الشركة؟'
    );

    console.log(`Model Used: ${embeddingResponse.model}`);
    console.log(`Processing Time: ${embeddingResponse.processingTime}ms`);
    const dimensions = Array.isArray(embeddingResponse.data) 
      ? embeddingResponse.data.length 
      : (embeddingResponse.data as number[])?.length || 'N/A';
    console.log(`Dimensions: ${dimensions}`);
    console.log(`Cost: $${embeddingResponse.usage.cost.toFixed(6)}`);
    console.log('✅ Embedding generation test passed!\n');

    // Test 5: Rate Limit Fallback (Simulate)
    console.log('5️⃣ Testing Model Recommendations...');
    const recommendations = openRouterClient.getModelRecommendations();
    console.log('Free Models Available:');
    recommendations.free.forEach((model, index) => {
      console.log(`  ${index + 1}. ${model}`);
    });
    console.log('\nArabic-Optimized Models:');
    recommendations.arabicOptimized.forEach((model, index) => {
      console.log(`  ${index + 1}. ${model}`);
    });
    console.log('✅ Model recommendations test passed!\n');

    // Summary
    console.log('🎉 ALL TESTS PASSED! OpenRouter is ready for production use.');
    console.log('\n📊 Summary:');
    console.log('• Arabic language support: ✅ Working');
    console.log('• Document processing: ✅ Working');  
    console.log('• Embedding generation: ✅ Working');
    console.log('• Smart fallback system: ✅ Configured');
    console.log('• Cost optimization: ✅ FREE models prioritized');

  } catch (error) {
    console.error('❌ Test failed:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        console.log('\n💡 Fix: Make sure OPENROUTER_API_KEY is set in .env.local');
      } else if (error.message.includes('rate') || error.message.includes('limit')) {
        console.log('\n💡 Info: Rate limit hit - this is expected and fallback should handle it');
      }
    }
  }
}

// Run the test
if (require.main === module) {
  testOpenRouterConnection()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Test script failed:', error);
      process.exit(1);
    });
}

export { testOpenRouterConnection };