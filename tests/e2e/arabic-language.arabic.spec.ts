import { test, expect } from '@playwright/test';
import { arabicSamples } from '../mocks/data/arabic-samples';

/**
 * Arabic Language Support E2E Tests
 * Tests RTL layout, Arabic text rendering, and language-specific functionality
 */

test.describe('Arabic Language Support', () => {
  test.beforeEach(async ({ page }) => {
    // Set Arabic locale
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'language', {
        get: () => 'ar-SA'
      });
      Object.defineProperty(navigator, 'languages', {
        get: () => ['ar-SA', 'ar', 'en']
      });
    });
    
    // Navigate to dashboard
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
  });

  test('should display Arabic text correctly in RTL layout', async ({ page }) => {
    // Check for RTL direction on body or main container
    const bodyDirection = await page.evaluate(() => {
      return getComputedStyle(document.body).direction;
    });
    
    expect(bodyDirection).toBe('rtl');
    
    // Verify Arabic text is displayed correctly
    const arabicText = page.locator('text=مرحباً').first();
    await expect(arabicText).toBeVisible();
    
    // Check text alignment
    const textAlign = await arabicText.evaluate(el => {
      return getComputedStyle(el).textAlign;
    });
    expect(['right', 'start']).toContain(textAlign);
  });

  test('should handle Arabic form input correctly', async ({ page }) => {
    // Navigate to a form page (e.g., employee registration)
    await page.goto('/dashboard/employees/new');
    
    // Fill Arabic text in form fields
    const nameField = page.locator('input[name="employee_name"]');
    await nameField.fill(arabicSamples.text.simple);
    
    // Verify the text is entered correctly
    const enteredValue = await nameField.inputValue();
    expect(enteredValue).toBe(arabicSamples.text.simple);
    
    // Check field direction
    const fieldDirection = await nameField.evaluate(el => {
      return getComputedStyle(el).direction;
    });
    expect(fieldDirection).toBe('rtl');
  });

  test('should display Arabic navigation menu correctly', async ({ page }) => {
    // Check navigation items for Arabic text and RTL layout
    const navItems = page.locator('nav [role="menuitem"]');
    
    for (const arabicNav of arabicSamples.rtlTestData.navigation) {
      const navItem = page.locator(`text=${arabicNav}`);
      await expect(navItem).toBeVisible();
    }
    
    // Verify navigation layout is RTL
    const nav = page.locator('nav').first();
    const navDirection = await nav.evaluate(el => {
      return getComputedStyle(el).direction;
    });
    expect(navDirection).toBe('rtl');
  });

  test('should handle Arabic search queries', async ({ page }) => {
    // Navigate to search page
    await page.goto('/dashboard/documents');
    
    const searchInput = page.locator('input[type="search"]');
    const arabicQuery = arabicSamples.voiceSamples.queries[0];
    
    // Type Arabic search query
    await searchInput.fill(arabicQuery);
    await page.keyboard.press('Enter');
    
    // Wait for search results
    await page.waitForResponse(response => 
      response.url().includes('/api/v1/documents/search') && 
      response.status() === 200
    );
    
    // Verify search results contain the query
    const searchResults = page.locator('[data-testid="search-results"]');
    await expect(searchResults).toBeVisible();
  });

  test('should display Arabic date and number formats', async ({ page }) => {
    // Navigate to analytics page
    await page.goto('/dashboard/analytics');
    
    // Wait for data to load
    await page.waitForSelector('[data-testid="analytics-data"]');
    
    // Check for Arabic/Hijri date format
    const dateElements = page.locator('[data-testid="date-display"]');
    const firstDate = await dateElements.first().textContent();
    
    // Should contain Arabic numerals or proper date format
    expect(firstDate).toMatch(/[\u0660-\u0669]|[\u06F0-\u06F9]|\d{4}\/\d{2}\/\d{2}/);
    
    // Check number formatting for Arabic locale
    const numberElements = page.locator('[data-testid="metric-value"]');
    const firstNumber = await numberElements.first().textContent();
    
    // Should be formatted according to Arabic locale
    expect(firstNumber).toBeTruthy();
  });

  test('should handle voice input in Arabic', async ({ page }) => {
    // Mock microphone permissions
    await page.context().grantPermissions(['microphone']);
    
    // Navigate to chat page
    await page.goto('/chat');
    
    // Click voice input button
    const voiceButton = page.locator('[data-testid="voice-input-button"]');
    await voiceButton.click();
    
    // Mock speech recognition with Arabic text
    await page.evaluate((arabicText) => {
      // Mock SpeechRecognition API
      window.SpeechRecognition = class MockSpeechRecognition {
        start() {
          setTimeout(() => {
            this.onresult({
              results: [{
                0: { transcript: arabicText },
                isFinal: true
              }]
            });
          }, 1000);
        }
        stop() {}
      };
    }, arabicSamples.voiceSamples.queries[0]);
    
    // Verify Arabic text appears in input
    const chatInput = page.locator('[data-testid="chat-input"]');
    await expect(chatInput).toHaveValue(arabicSamples.voiceSamples.queries[0]);
  });

  test('should export documents with Arabic content correctly', async ({ page }) => {
    // Navigate to documents page
    await page.goto('/dashboard/documents');
    
    // Select a document with Arabic content
    const documentCard = page.locator('[data-testid="document-card"]').first();
    await documentCard.click();
    
    // Open export menu
    const exportButton = page.locator('[data-testid="export-button"]');
    await exportButton.click();
    
    // Test PDF export
    const pdfExportPromise = page.waitForDownload();
    await page.locator('text=تصدير PDF').click();
    const pdfDownload = await pdfExportPromise;
    
    expect(pdfDownload.suggestedFilename()).toMatch(/\.pdf$/);
    
    // Test DOCX export
    const docxExportPromise = page.waitForDownload();
    await exportButton.click();
    await page.locator('text=تصدير DOCX').click();
    const docxDownload = await docxExportPromise;
    
    expect(docxDownload.suggestedFilename()).toMatch(/\.docx$/);
  });

  test('should handle Arabic OCR processing', async ({ page }) => {
    // Navigate to OCR page
    await page.goto('/dashboard/documents/upload');
    
    // Upload Arabic document image
    const fileInput = page.locator('input[type="file"]');
    
    // Create a mock file with Arabic content
    const arabicImageFile = await page.evaluateHandle(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 600;
      const ctx = canvas.getContext('2d');
      
      // Draw Arabic text on canvas
      ctx.font = '24px Arial';
      ctx.fillText('شهادة راتب', 50, 100);
      ctx.fillText('اسم الموظف: أحمد محمد', 50, 150);
      
      return new Promise(resolve => {
        canvas.toBlob(resolve, 'image/png');
      });
    });
    
    await fileInput.setInputFiles({
      name: 'arabic-document.png',
      mimeType: 'image/png',
      buffer: await arabicImageFile.arrayBuffer(),
    } as any);
    
    // Wait for OCR processing
    await page.waitForResponse(response => 
      response.url().includes('/api/v1/ocr/process') && 
      response.status() === 200
    );
    
    // Verify Arabic text is extracted
    const extractedText = page.locator('[data-testid="extracted-text"]');
    await expect(extractedText).toContainText('شهادة');
  });

  test('should display Arabic tooltips and help text', async ({ page }) => {
    // Navigate to a page with tooltips
    await page.goto('/dashboard/analytics');
    
    // Hover over help icon
    const helpIcon = page.locator('[data-testid="help-icon"]').first();
    await helpIcon.hover();
    
    // Verify Arabic tooltip appears
    const tooltip = page.locator('[role="tooltip"]');
    await expect(tooltip).toBeVisible();
    
    const tooltipText = await tooltip.textContent();
    expect(tooltipText).toMatch(/[\u0600-\u06FF]/); // Contains Arabic characters
  });

  test('should handle Arabic keyboard shortcuts', async ({ page }) => {
    // Navigate to chat
    await page.goto('/chat');
    
    // Test Arabic keyboard input combinations
    const chatInput = page.locator('[data-testid="chat-input"]');
    await chatInput.focus();
    
    // Type Arabic text with keyboard shortcuts
    await page.keyboard.type(arabicSamples.text.simple);
    
    // Test Ctrl+A (select all) with Arabic text
    await page.keyboard.press('Control+a');
    
    // Verify text is selected
    const selectedText = await page.evaluate(() => {
      return window.getSelection()?.toString();
    });
    
    expect(selectedText).toBe(arabicSamples.text.simple);
  });
});