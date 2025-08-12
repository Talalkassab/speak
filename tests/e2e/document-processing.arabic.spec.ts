import { test, expect } from '@playwright/test';
import { sampleDocuments } from '../mocks/data/sample-documents';
import { arabicSamples } from '../mocks/data/arabic-samples';

/**
 * Document Processing E2E Tests with Arabic Support
 * Tests OCR, document upload, processing, and export with Arabic content
 */

test.describe('Arabic Document Processing', () => {
  test.beforeEach(async ({ page }) => {
    // Set up Arabic locale
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'language', {
        get: () => 'ar-SA'
      });
    });
    
    await page.goto('/dashboard/documents');
    await page.waitForLoadState('networkidle');
  });

  test('should upload and process Arabic PDF documents', async ({ page }) => {
    // Navigate to upload page
    await page.goto('/dashboard/documents/upload');
    
    // Create mock Arabic PDF file
    const pdfContent = Buffer.from(
      `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT
/F1 12 Tf
72 720 Td
(${arabicSamples.text.simple}) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000173 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
267
%%EOF`
    );
    
    // Upload the file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'arabic-contract.pdf',
      mimeType: 'application/pdf',
      buffer: pdfContent,
    });
    
    // Wait for upload to complete
    await page.waitForResponse(response => 
      response.url().includes('/api/documents/upload') && 
      response.status() === 200
    );
    
    // Verify document appears in list
    const documentCard = page.locator('[data-testid="document-card"]')
      .filter({ hasText: 'arabic-contract.pdf' });
    await expect(documentCard).toBeVisible();
    
    // Verify processing status
    const statusBadge = documentCard.locator('[data-testid="processing-status"]');
    await expect(statusBadge).toContainText(/معالجة|مكتمل/); // "Processing" or "Complete" in Arabic
  });

  test('should perform OCR on Arabic document images', async ({ page }) => {
    await page.goto('/dashboard/documents/ocr');
    
    // Create mock Arabic document image
    const imageBuffer = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 800;
      const ctx = canvas.getContext('2d');
      
      // White background
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Arabic text styling
      ctx.fillStyle = 'black';
      ctx.font = 'bold 32px Arial';
      ctx.textAlign = 'right';
      ctx.direction = 'rtl';
      
      // Draw Arabic document content
      const lines = [
        'شهادة راتب',
        'اسم الموظف: أحمد محمد السالم',
        'الرقم الوظيفي: ١٢٣٤٥',
        'القسم: الموارد البشرية',
        'الراتب الأساسي: ١٥,٠٠٠ ريال',
        'البدلات: ٢,٠٠٠ ريال',
        'صافي الراتب: ١٦,٥٠٠ ريال'
      ];
      
      lines.forEach((line, index) => {
        ctx.fillText(line, canvas.width - 50, 100 + (index * 60));
      });
      
      return new Promise(resolve => {
        canvas.toBlob(blob => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsArrayBuffer(blob);
        }, 'image/png');
      });
    });
    
    // Upload image for OCR
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'salary-certificate.png',
      mimeType: 'image/png',
      buffer: Buffer.from(imageBuffer as ArrayBuffer),
    });
    
    // Click process button
    const processButton = page.locator('[data-testid="process-ocr-button"]');
    await processButton.click();
    
    // Wait for OCR processing
    await page.waitForResponse(response => 
      response.url().includes('/api/v1/ocr/process') && 
      response.status() === 200
    );
    
    // Verify extracted Arabic text
    const extractedText = page.locator('[data-testid="extracted-text"]');
    await expect(extractedText).toContainText('شهادة راتب');
    await expect(extractedText).toContainText('أحمد محمد السالم');
    await expect(extractedText).toContainText('ريال');
    
    // Test confidence score
    const confidenceScore = page.locator('[data-testid="confidence-score"]');
    await expect(confidenceScore).toBeVisible();
    
    const scoreText = await confidenceScore.textContent();
    const score = parseFloat(scoreText?.match(/\d+\.?\d*/)?.[0] || '0');
    expect(score).toBeGreaterThan(0.7); // Expect reasonable confidence
  });

  test('should enhance Arabic text quality', async ({ page }) => {
    await page.goto('/dashboard/documents/ocr');
    
    // Upload low-quality Arabic document
    const noisyText = arabicSamples.text.simple.replace(/./g, (char, index) => {
      return index % 5 === 0 ? '#' : char; // Add noise
    });
    
    // Simulate uploading noisy document
    const textarea = page.locator('[data-testid="manual-text-input"]');
    await textarea.fill(noisyText);
    
    // Click enhance button
    const enhanceButton = page.locator('[data-testid="enhance-text-button"]');
    await enhanceButton.click();
    
    // Wait for enhancement
    await page.waitForResponse(response => 
      response.url().includes('/api/v1/ocr/enhance') && 
      response.status() === 200
    );
    
    // Verify enhanced text
    const enhancedText = page.locator('[data-testid="enhanced-text"]');
    const enhanced = await enhancedText.textContent();
    
    // Should be closer to original text
    expect(enhanced).toContain('مرحباً');
    expect(enhanced).toContain('الموارد');
    expect(enhanced).not.toContain('#'); // Noise should be removed
  });

  test('should classify Arabic document types', async ({ page }) => {
    await page.goto('/dashboard/documents/classify');
    
    // Test different document types
    const testDocuments = [
      {
        content: sampleDocuments.arabicDocuments.employmentContract.content,
        expectedType: 'employment_contract',
        expectedCategory: 'عقود العمل'
      },
      {
        content: sampleDocuments.arabicDocuments.payrollSlip.content,
        expectedType: 'payroll_slip',
        expectedCategory: 'كشوف المرتبات'
      },
      {
        content: sampleDocuments.arabicDocuments.leaveRequest.content,
        expectedType: 'leave_request',
        expectedCategory: 'طلبات الإجازة'
      }
    ];
    
    for (const doc of testDocuments) {
      // Input document content
      const contentInput = page.locator('[data-testid="document-content-input"]');
      await contentInput.fill(doc.content);
      
      // Click classify button
      const classifyButton = page.locator('[data-testid="classify-button"]');
      await classifyButton.click();
      
      // Wait for classification
      await page.waitForResponse(response => 
        response.url().includes('/api/v1/documents/classify') && 
        response.status() === 200
      );
      
      // Verify classification result
      const documentType = page.locator('[data-testid="document-type"]');
      await expect(documentType).toContainText(doc.expectedCategory);
      
      const confidence = page.locator('[data-testid="classification-confidence"]');
      await expect(confidence).toBeVisible();
      
      // Clear for next test
      await contentInput.clear();
    }
  });

  test('should batch process multiple Arabic documents', async ({ page }) => {
    await page.goto('/dashboard/documents/batch');
    
    // Create multiple test files
    const testFiles = [
      {
        name: 'contract-001.pdf',
        content: sampleDocuments.arabicDocuments.employmentContract.content,
        type: 'application/pdf'
      },
      {
        name: 'payroll-001.pdf', 
        content: sampleDocuments.arabicDocuments.payrollSlip.content,
        type: 'application/pdf'
      },
      {
        name: 'leave-001.pdf',
        content: sampleDocuments.arabicDocuments.leaveRequest.content,
        type: 'application/pdf'
      }
    ];
    
    // Upload multiple files
    const fileInput = page.locator('input[type="file"][multiple]');
    
    for (const file of testFiles) {
      const buffer = Buffer.from(file.content, 'utf-8');
      await fileInput.setInputFiles({
        name: file.name,
        mimeType: file.type,
        buffer: buffer,
      });
    }
    
    // Start batch processing
    const processButton = page.locator('[data-testid="start-batch-process"]');
    await processButton.click();
    
    // Monitor progress
    const progressBar = page.locator('[data-testid="batch-progress"]');
    await expect(progressBar).toBeVisible();
    
    // Wait for completion
    await page.waitForResponse(response => 
      response.url().includes('/api/v1/documents/batch-process') && 
      response.status() === 200
    );
    
    // Verify all documents are processed
    const processedDocuments = page.locator('[data-testid="processed-document"]');
    await expect(processedDocuments).toHaveCount(testFiles.length);
    
    // Check individual results
    for (const file of testFiles) {
      const docResult = page.locator(`[data-testid="result-${file.name}"]`);
      await expect(docResult).toBeVisible();
      
      const status = docResult.locator('[data-testid="processing-status"]');
      await expect(status).toContainText(/نجح|مكتمل/); // "Success" or "Complete"
    }
  });

  test('should validate Arabic document security', async ({ page }) => {
    await page.goto('/dashboard/documents/security');
    
    // Test with potentially malicious content
    const maliciousContent = `
      عقد عمل مشبوه
      <script>alert('xss')</script>
      ${arabicSamples.text.simple}
      DROP TABLE users;
    `;
    
    const contentInput = page.locator('[data-testid="document-content"]');
    await contentInput.fill(maliciousContent);
    
    // Click validate button
    const validateButton = page.locator('[data-testid="validate-security"]');
    await validateButton.click();
    
    // Wait for security validation
    await page.waitForResponse(response => 
      response.url().includes('/api/v1/documents/validate-security') && 
      response.status() === 200
    );
    
    // Check security warnings
    const securityWarnings = page.locator('[data-testid="security-warnings"]');
    await expect(securityWarnings).toBeVisible();
    
    // Should detect script injection
    await expect(securityWarnings).toContainText(/تحذير أمني|محتوى مشبوه/);
    
    // Should detect SQL injection
    await expect(securityWarnings).toContainText(/استعلام مشبوه/);
    
    // Clean content should pass
    await contentInput.fill(arabicSamples.text.simple);
    await validateButton.click();
    
    await page.waitForResponse(response => 
      response.url().includes('/api/v1/documents/validate-security') && 
      response.status() === 200
    );
    
    const cleanResult = page.locator('[data-testid="security-status"]');
    await expect(cleanResult).toContainText(/آمن|نظيف/); // "Safe" or "Clean"
  });

  test('should extract metadata from Arabic documents', async ({ page }) => {
    await page.goto('/dashboard/documents/metadata');
    
    const testDocument = sampleDocuments.arabicDocuments.employmentContract.content;
    
    // Input document
    const documentInput = page.locator('[data-testid="document-input"]');
    await documentInput.fill(testDocument);
    
    // Extract metadata
    const extractButton = page.locator('[data-testid="extract-metadata"]');
    await extractButton.click();
    
    await page.waitForResponse(response => 
      response.url().includes('/api/v1/documents/extract-metadata') && 
      response.status() === 200
    );
    
    // Verify extracted metadata
    const metadataPanel = page.locator('[data-testid="metadata-panel"]');
    await expect(metadataPanel).toBeVisible();
    
    // Check specific metadata fields
    const employeeName = page.locator('[data-testid="metadata-employee-name"]');
    await expect(employeeName).toContainText('أحمد محمد السالم');
    
    const position = page.locator('[data-testid="metadata-position"]');
    await expect(position).toContainText('مطور برمجيات');
    
    const salary = page.locator('[data-testid="metadata-salary"]');
    await expect(salary).toContainText('12,000');
    
    const department = page.locator('[data-testid="metadata-department"]');
    await expect(department).toContainText('تقنية المعلومات');
  });

  test('should export processed Arabic documents', async ({ page }) => {
    await page.goto('/dashboard/documents');
    
    // Select processed Arabic document
    const documentCard = page.locator('[data-testid="document-card"]')
      .filter({ hasText: /عقد عمل|شهادة راتب/ }).first();
    
    await documentCard.click();
    
    // Open export menu
    const exportButton = page.locator('[data-testid="export-button"]');
    await exportButton.click();
    
    // Test PDF export with Arabic fonts
    const pdfDownloadPromise = page.waitForDownload();
    const pdfExportButton = page.locator('[data-testid="export-pdf"]');
    await pdfExportButton.click();
    const pdfDownload = await pdfDownloadPromise;
    
    expect(pdfDownload.suggestedFilename()).toMatch(/\.pdf$/);
    
    // Test Word export with RTL support
    await exportButton.click();
    const wordDownloadPromise = page.waitForDownload();
    const wordExportButton = page.locator('[data-testid="export-word"]');
    await wordExportButton.click();
    const wordDownload = await wordDownloadPromise;
    
    expect(wordDownload.suggestedFilename()).toMatch(/\.docx$/);
    
    // Test HTML export with RTL CSS
    await exportButton.click();
    const htmlDownloadPromise = page.waitForDownload();
    const htmlExportButton = page.locator('[data-testid="export-html"]');
    await htmlExportButton.click();
    const htmlDownload = await htmlDownloadPromise;
    
    expect(htmlDownload.suggestedFilename()).toMatch(/\.html$/);
  });
});