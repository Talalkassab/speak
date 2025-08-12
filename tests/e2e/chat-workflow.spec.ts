import { test, expect } from '@playwright/test';

test.describe('Chat Workflow E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app and authenticate
    await page.goto('/');
    
    // Mock authentication for E2E tests
    await page.addInitScript(() => {
      // Mock session storage for authenticated user
      window.localStorage.setItem('supabase.auth.token', JSON.stringify({
        currentSession: {
          user: {
            id: 'test-user-admin-e2e',
            email: 'admin@teste2e.com',
            user_metadata: { organization_id: 'test-org-e2e' }
          },
          access_token: 'mock-token'
        }
      }));
    });
  });

  test('complete chat conversation flow', async ({ page }) => {
    test.slow(); // This test might take longer

    // Navigate to chat page
    await page.goto('/chat');
    
    // Wait for page to load
    await expect(page.getByRole('heading', { name: /chat/i })).toBeVisible();

    // Start a new conversation
    await page.getByRole('button', { name: /new conversation/i }).click();
    
    // Type a question in Arabic
    const questionInput = page.getByRole('textbox', { name: /type your message/i });
    await questionInput.fill('ما هي أنواع الإجازات المتاحة للموظفين؟');
    
    // Send the message
    await page.getByRole('button', { name: /send/i }).click();
    
    // Wait for the user message to appear
    await expect(page.getByText('ما هي أنواع الإجازات المتاحة للموظفين؟')).toBeVisible();
    
    // Wait for AI response (with timeout)
    await expect(page.getByTestId('assistant-message')).toBeVisible({ timeout: 10000 });
    
    // Verify response contains expected content
    const assistantMessage = page.getByTestId('assistant-message').first();
    await expect(assistantMessage).toContainText('إجازة');
    
    // Test message actions - copy button
    await assistantMessage.hover();
    const copyButton = page.getByTestId('copy-button').first();
    await expect(copyButton).toBeVisible();
    await copyButton.click();
    
    // Verify copy success message
    await expect(page.getByText('Copied!')).toBeVisible();
    
    // Test text-to-speech button
    const speakButton = page.getByTestId('speak-button').first();
    await expect(speakButton).toBeVisible();
    await speakButton.click();
    
    // Test follow-up question
    await questionInput.fill('كم مدة الإجازة السنوية؟');
    await page.getByRole('button', { name: /send/i }).click();
    
    // Wait for second response
    await expect(page.getByTestId('assistant-message')).toHaveCount(2, { timeout: 10000 });
    
    // Verify conversation history is maintained
    expect(await page.getByTestId('message-bubble').count()).toBeGreaterThan(2);
  });

  test('voice input functionality', async ({ page }) => {
    // Grant microphone permission
    await page.context().grantPermissions(['microphone']);
    
    await page.goto('/chat');
    
    // Start new conversation
    await page.getByRole('button', { name: /new conversation/i }).click();
    
    // Click voice input button
    const voiceButton = page.getByRole('button', { name: /voice input/i });
    await expect(voiceButton).toBeVisible();
    await voiceButton.click();
    
    // Verify recording state
    await expect(page.getByTestId('recording-indicator')).toBeVisible();
    
    // Mock voice transcript
    await page.evaluate(() => {
      // Simulate speech recognition result
      const event = new CustomEvent('speechresult', {
        detail: { transcript: 'ما هي ساعات العمل المسموحة؟' }
      });
      window.dispatchEvent(event);
    });
    
    // Stop recording
    await page.getByRole('button', { name: /stop recording/i }).click();
    
    // Verify transcript appears
    await expect(page.getByTestId('transcript-preview')).toContainText('ما هي ساعات العمل المسموحة؟');
    
    // Send transcript
    await page.getByRole('button', { name: /send transcript/i }).click();
    
    // Verify message was sent
    await expect(page.getByText('ما هي ساعات العمل المسموحة؟')).toBeVisible();
  });

  test('conversation management', async ({ page }) => {
    await page.goto('/chat');
    
    // Create multiple conversations for testing
    for (let i = 1; i <= 3; i++) {
      await page.getByRole('button', { name: /new conversation/i }).click();
      
      const input = page.getByRole('textbox', { name: /type your message/i });
      await input.fill(`اختبار محادثة رقم ${i}`);
      await page.getByRole('button', { name: /send/i }).click();
      
      // Wait for response
      await expect(page.getByTestId('assistant-message')).toBeVisible({ timeout: 5000 });
    }
    
    // Check conversation sidebar
    const sidebar = page.getByTestId('conversation-sidebar');
    await expect(sidebar).toBeVisible();
    
    // Verify conversations appear in sidebar
    await expect(sidebar.getByText('اختبار محادثة رقم')).toHaveCount(3);
    
    // Test conversation switching
    await sidebar.getByText('اختبار محادثة رقم 1').first().click();
    await expect(page.getByText('اختبار محادثة رقم 1')).toBeVisible();
    
    // Test conversation deletion
    const firstConversation = sidebar.getByText('اختبار محادثة رقم 1').first();
    await firstConversation.hover();
    await page.getByTestId('delete-conversation-button').first().click();
    
    // Confirm deletion
    await page.getByRole('button', { name: /confirm/i }).click();
    
    // Verify conversation is removed
    await expect(sidebar.getByText('اختبار محادثة رقم 1')).toHaveCount(0);
  });

  test('Arabic RTL text rendering', async ({ page }) => {
    await page.goto('/chat');
    
    await page.getByRole('button', { name: /new conversation/i }).click();
    
    // Send Arabic message
    const arabicText = 'مرحباً بك في نظام الموارد البشرية المتطور. كيف يمكنني مساعدتك اليوم؟';
    await page.getByRole('textbox').fill(arabicText);
    await page.getByRole('button', { name: /send/i }).click();
    
    // Verify Arabic text is displayed correctly
    const userMessage = page.getByTestId('user-message').first();
    await expect(userMessage).toContainText(arabicText);
    
    // Check RTL styling
    const messageContent = userMessage.getByTestId('message-content');
    await expect(messageContent).toHaveAttribute('dir', 'rtl');
    await expect(messageContent).toHaveCSS('text-align', 'right');
    
    // Wait for AI response
    await expect(page.getByTestId('assistant-message')).toBeVisible({ timeout: 10000 });
    
    // Verify AI response is also RTL formatted
    const assistantMessage = page.getByTestId('assistant-message').first();
    const assistantContent = assistantMessage.getByTestId('message-content');
    await expect(assistantContent).toHaveAttribute('dir', 'rtl');
  });

  test('source citations and references', async ({ page }) => {
    await page.goto('/chat');
    
    await page.getByRole('button', { name: /new conversation/i }).click();
    
    // Ask a question that should return sources
    await page.getByRole('textbox').fill('ما هو نظام العمل السعودي؟');
    await page.getByRole('button', { name: /send/i }).click();
    
    // Wait for response with sources
    await expect(page.getByTestId('assistant-message')).toBeVisible({ timeout: 10000 });
    
    // Check for source citations
    const sourcesPanel = page.getByTestId('message-sources');
    await expect(sourcesPanel).toBeVisible();
    
    // Verify source information is displayed
    await expect(sourcesPanel).toContainText('Source:');
    await expect(sourcesPanel).toContainText('%'); // Relevance score
    
    // Test source link functionality
    const sourceLink = sourcesPanel.getByRole('link').first();
    if (await sourceLink.isVisible()) {
      await expect(sourceLink).toHaveAttribute('href');
    }
  });

  test('error handling and retry functionality', async ({ page }) => {
    await page.goto('/chat');
    
    // Mock network failure
    await page.route('/api/v1/chat/conversations/*/messages', route => {
      route.abort('failed');
    });
    
    await page.getByRole('button', { name: /new conversation/i }).click();
    await page.getByRole('textbox').fill('اختبار خطأ الشبكة');
    await page.getByRole('button', { name: /send/i }).click();
    
    // Verify error message appears
    await expect(page.getByTestId('error-message')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/failed to send message/i)).toBeVisible();
    
    // Test retry functionality
    const retryButton = page.getByRole('button', { name: /retry/i });
    await expect(retryButton).toBeVisible();
    
    // Remove network mock and retry
    await page.unroute('/api/v1/chat/conversations/*/messages');
    await retryButton.click();
    
    // Verify message is sent successfully after retry
    await expect(page.getByText('اختبار خطأ الشبكة')).toBeVisible();
  });

  test('responsive design on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/chat');
    
    // Verify mobile layout
    const sidebar = page.getByTestId('conversation-sidebar');
    
    // On mobile, sidebar should be hidden initially
    await expect(sidebar).not.toBeVisible();
    
    // Open sidebar with menu button
    await page.getByTestId('mobile-menu-button').click();
    await expect(sidebar).toBeVisible();
    
    // Start conversation
    await page.getByRole('button', { name: /new conversation/i }).click();
    
    // Verify mobile chat layout
    const chatContainer = page.getByTestId('chat-container');
    await expect(chatContainer).toHaveCSS('width', '375px');
    
    // Send message and verify mobile formatting
    await page.getByRole('textbox').fill('اختبار الجوال');
    await page.getByRole('button', { name: /send/i }).click();
    
    // Verify message bubbles adapt to mobile width
    const messageBubble = page.getByTestId('message-bubble').first();
    await expect(messageBubble).toBeVisible();
    
    // Check that long messages wrap properly
    await page.getByRole('textbox').fill('هذه رسالة طويلة جداً لاختبار كيفية تعامل التطبيق مع النصوص الطويلة في الشاشات الصغيرة والتأكد من أن النص يلتف بشكل صحيح');
    await page.getByRole('button', { name: /send/i }).click();
    
    const longMessage = page.getByTestId('message-bubble').last();
    await expect(longMessage).toBeVisible();
  });

  test('accessibility features', async ({ page }) => {
    await page.goto('/chat');
    
    // Check for proper ARIA labels
    await expect(page.getByRole('main')).toHaveAttribute('aria-label');
    await expect(page.getByRole('textbox')).toHaveAttribute('aria-label');
    
    // Test keyboard navigation
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: /new conversation/i })).toBeFocused();
    
    await page.keyboard.press('Tab');
    await expect(page.getByRole('textbox')).toBeFocused();
    
    // Test screen reader announcements
    await page.getByRole('textbox').fill('اختبار إمكانية الوصول');
    await page.keyboard.press('Enter');
    
    // Verify ARIA live region for messages
    const messagesContainer = page.getByRole('log');
    await expect(messagesContainer).toBeVisible();
    await expect(messagesContainer).toHaveAttribute('aria-live', 'polite');
  });
});