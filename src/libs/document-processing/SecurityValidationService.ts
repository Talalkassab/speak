import * as fs from 'fs';
import * as crypto from 'crypto';
import { fileTypeFromBuffer } from 'file-type';

export interface SecurityCheckResult {
  isValid: boolean;
  threats: SecurityThreat[];
  fileInfo: {
    detectedMimeType: string;
    declaredMimeType: string;
    fileSize: number;
    hash: string;
    mismatch: boolean;
  };
  recommendations: string[];
}

export interface SecurityThreat {
  type: 'malware_signature' | 'suspicious_extension' | 'mime_mismatch' | 'size_anomaly' | 'embedded_executable' | 'suspicious_content';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  details?: any;
}

export class SecurityValidationService {
  
  // Comprehensive list of allowed MIME types for documents
  private static readonly ALLOWED_MIME_TYPES = new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'text/rtf',
    'application/rtf',
    'image/jpeg',
    'image/png',
    'image/tiff',
    'image/bmp',
    'image/webp'
  ]);

  // Dangerous file extensions that should never be allowed
  private static readonly BLOCKED_EXTENSIONS = new Set([
    '.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js', '.jar',
    '.app', '.deb', '.pkg', '.rpm', '.dmg', '.iso', '.img', '.bin',
    '.msi', '.dll', '.sys', '.drv', '.ocx', '.ax', '.cpl',
    '.sh', '.bash', '.zsh', '.fish', '.ps1', '.psm1',
    '.py', '.rb', '.pl', '.php', '.asp', '.aspx', '.jsp'
  ]);

  // Known malware signatures (simplified - in production use a proper AV engine)
  private static readonly MALWARE_SIGNATURES = [
    Buffer.from('4d5a', 'hex'), // PE header
    Buffer.from('5065', 'hex'), // PE signature part
    Buffer.from('7f454c46', 'hex'), // ELF header
    Buffer.from('feedface', 'hex'), // Mach-O
    Buffer.from('cafebabe', 'hex'), // Java class file
    Buffer.from('504b0304', 'hex'), // ZIP header (could contain malware)
  ];

  // Suspicious content patterns
  private static readonly SUSPICIOUS_PATTERNS = [
    /javascript:/gi,
    /vbscript:/gi,
    /data:text\/html/gi,
    /eval\(/gi,
    /document\.write/gi,
    /window\.open/gi,
    /<script[^>]*>/gi,
    /<iframe[^>]*>/gi,
    /onload\s*=/gi,
    /onerror\s*=/gi,
    /onclick\s*=/gi,
    // Arabic suspicious patterns
    /تشفير|برمجة ضارة|فيروس|تجسس/gi,
    // Base64 encoded executables
    /TVqQAAMAAAAEAAAA/g, // MZ header in base64
  ];

  /**
   * Perform comprehensive security validation on an uploaded file
   */
  static async validateFile(
    filePath: string,
    declaredMimeType: string,
    organizationId: string,
    uploadedBy: string
  ): Promise<SecurityCheckResult> {
    
    const threats: SecurityThreat[] = [];
    const recommendations: string[] = [];
    
    try {
      // Read file buffer for analysis
      const fileBuffer = fs.readFileSync(filePath);
      const fileSize = fileBuffer.length;
      
      // Calculate file hash for integrity and duplicate detection
      const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
      
      // Detect actual file type
      const detectedType = await fileTypeFromBuffer(fileBuffer);
      const detectedMimeType = detectedType?.mime || 'application/octet-stream';
      
      const fileInfo = {
        detectedMimeType,
        declaredMimeType,
        fileSize,
        hash,
        mismatch: detectedMimeType !== declaredMimeType
      };

      // Check 1: MIME type validation
      if (!this.ALLOWED_MIME_TYPES.has(detectedMimeType)) {
        threats.push({
          type: 'suspicious_extension',
          severity: 'high',
          description: `File type '${detectedMimeType}' is not allowed`,
          details: { detected: detectedMimeType, declared: declaredMimeType }
        });
      }

      // Check 2: MIME type mismatch
      if (fileInfo.mismatch && this.ALLOWED_MIME_TYPES.has(declaredMimeType)) {
        threats.push({
          type: 'mime_mismatch',
          severity: 'medium',
          description: 'Declared file type does not match actual file type',
          details: fileInfo
        });
        recommendations.push('File extension may be incorrect or file may be corrupted');
      }

      // Check 3: File extension validation
      const fileName = filePath.split('/').pop() || '';
      const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
      
      if (this.BLOCKED_EXTENSIONS.has(extension)) {
        threats.push({
          type: 'suspicious_extension',
          severity: 'critical',
          description: `File extension '${extension}' is blocked for security reasons`,
          details: { extension, fileName }
        });
      }

      // Check 4: File size anomalies
      if (fileSize === 0) {
        threats.push({
          type: 'size_anomaly',
          severity: 'medium',
          description: 'File is empty',
          details: { size: fileSize }
        });
      } else if (fileSize > 100 * 1024 * 1024) { // 100MB
        threats.push({
          type: 'size_anomaly',
          severity: 'low',
          description: 'File is unusually large',
          details: { size: fileSize }
        });
        recommendations.push('Large files may take longer to process');
      }

      // Check 5: Malware signature detection
      const malwareCheck = this.scanForMalwareSignatures(fileBuffer);
      if (malwareCheck.detected) {
        threats.push({
          type: 'malware_signature',
          severity: 'critical',
          description: 'File contains suspicious binary signatures',
          details: malwareCheck
        });
      }

      // Check 6: Embedded executable detection
      const executableCheck = this.detectEmbeddedExecutables(fileBuffer, detectedMimeType);
      if (executableCheck.detected) {
        threats.push({
          type: 'embedded_executable',
          severity: 'high',
          description: 'File may contain embedded executable code',
          details: executableCheck
        });
      }

      // Check 7: Content-based analysis (for text-based files)
      if (this.isTextBasedFile(detectedMimeType)) {
        const contentAnalysis = await this.analyzeTextContent(fileBuffer, detectedMimeType);
        if (contentAnalysis.threats.length > 0) {
          threats.push(...contentAnalysis.threats);
          recommendations.push(...contentAnalysis.recommendations);
        }
      }

      // Check 8: Organizational security policies
      const policyCheck = await this.checkOrganizationalPolicies(
        fileInfo,
        organizationId,
        uploadedBy
      );
      if (policyCheck.violations.length > 0) {
        threats.push(...policyCheck.violations);
        recommendations.push(...policyCheck.recommendations);
      }

      // Check 9: Rate limiting and abuse detection
      const rateCheck = await this.checkUploadRateLimit(organizationId, uploadedBy);
      if (!rateCheck.allowed) {
        threats.push({
          type: 'suspicious_content',
          severity: 'medium',
          description: 'Upload rate limit exceeded',
          details: rateCheck
        });
      }

      // Determine overall safety
      const criticalThreats = threats.filter(t => t.severity === 'critical').length;
      const highThreats = threats.filter(t => t.severity === 'high').length;
      
      const isValid = criticalThreats === 0 && highThreats === 0;
      
      if (!isValid) {
        recommendations.push('File should be quarantined and reviewed manually');
        recommendations.push('Consider scanning file with updated antivirus software');
      }

      return {
        isValid,
        threats,
        fileInfo,
        recommendations
      };

    } catch (error) {
      console.error('Security validation error:', error);
      return {
        isValid: false,
        threats: [{
          type: 'suspicious_content',
          severity: 'high',
          description: 'File validation failed due to processing error',
          details: { error: error instanceof Error ? error.message : 'Unknown error' }
        }],
        fileInfo: {
          detectedMimeType: 'unknown',
          declaredMimeType,
          fileSize: 0,
          hash: '',
          mismatch: true
        },
        recommendations: ['File should be rejected due to validation failure']
      };
    }
  }

  /**
   * Scan file buffer for known malware signatures
   */
  private static scanForMalwareSignatures(buffer: Buffer): {
    detected: boolean;
    signatures: string[];
    locations: number[];
  } {
    const detectedSignatures: string[] = [];
    const locations: number[] = [];

    for (const signature of this.MALWARE_SIGNATURES) {
      const index = buffer.indexOf(signature);
      if (index !== -1) {
        detectedSignatures.push(signature.toString('hex'));
        locations.push(index);
      }
    }

    return {
      detected: detectedSignatures.length > 0,
      signatures: detectedSignatures,
      locations
    };
  }

  /**
   * Detect embedded executables in documents
   */
  private static detectEmbeddedExecutables(buffer: Buffer, mimeType: string): {
    detected: boolean;
    type: string[];
    confidence: number;
  } {
    const findings: string[] = [];
    let confidence = 0;

    // Check for PE headers (Windows executables)
    if (buffer.includes(Buffer.from('This program cannot be run in DOS mode'))) {
      findings.push('PE_EXECUTABLE');
      confidence += 0.8;
    }

    // Check for ELF headers (Linux executables)
    if (buffer.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46]))) {
      findings.push('ELF_EXECUTABLE');
      confidence += 0.9;
    }

    // Check for Mach-O headers (macOS executables)
    if (buffer.subarray(0, 4).equals(Buffer.from([0xfe, 0xed, 0xfa, 0xce]))) {
      findings.push('MACHO_EXECUTABLE');
      confidence += 0.9;
    }

    // Check for ZIP-based document formats that might contain executables
    if (mimeType.includes('officedocument') && buffer.subarray(0, 4).equals(Buffer.from('PK\x03\x04'))) {
      // This is normal for Office documents, but check for suspicious entries
      const zipContent = buffer.toString('binary');
      if (zipContent.includes('.exe') || zipContent.includes('.dll') || zipContent.includes('.bat')) {
        findings.push('OFFICE_WITH_EXECUTABLE');
        confidence += 0.6;
      }
    }

    return {
      detected: findings.length > 0 && confidence > 0.5,
      type: findings,
      confidence: Math.min(confidence, 1.0)
    };
  }

  /**
   * Analyze text content for suspicious patterns
   */
  private static async analyzeTextContent(buffer: Buffer, mimeType: string): Promise<{
    threats: SecurityThreat[];
    recommendations: string[];
  }> {
    const threats: SecurityThreat[] = [];
    const recommendations: string[] = [];

    try {
      // Convert buffer to text (handle different encodings)
      let text = buffer.toString('utf8');
      
      // Try other encodings if UTF-8 fails
      if (text.includes('\uFFFD')) {
        text = buffer.toString('latin1');
      }

      // Check for suspicious patterns
      for (const pattern of this.SUSPICIOUS_PATTERNS) {
        const matches = text.match(pattern);
        if (matches) {
          threats.push({
            type: 'suspicious_content',
            severity: 'medium',
            description: 'File contains potentially malicious script content',
            details: {
              pattern: pattern.toString(),
              matches: matches.slice(0, 5), // First 5 matches only
              total_matches: matches.length
            }
          });
        }
      }

      // Check for Base64 encoded content that might be malicious
      const base64Pattern = /[A-Za-z0-9+/]{50,}/g;
      const base64Matches = text.match(base64Pattern);
      if (base64Matches && base64Matches.length > 10) {
        // Try to decode and check some samples
        let suspiciousB64Count = 0;
        for (const match of base64Matches.slice(0, 5)) {
          try {
            const decoded = Buffer.from(match, 'base64');
            if (this.scanForMalwareSignatures(decoded).detected) {
              suspiciousB64Count++;
            }
          } catch (e) {
            // Invalid base64, ignore
          }
        }

        if (suspiciousB64Count > 0) {
          threats.push({
            type: 'suspicious_content',
            severity: 'high',
            description: 'File contains Base64 encoded suspicious content',
            details: {
              base64_blocks: base64Matches.length,
              suspicious_count: suspiciousB64Count
            }
          });
        }
      }

      // Check for obfuscated content
      const obfuscationIndicators = [
        /\\x[0-9a-fA-F]{2}/g,  // Hex encoding
        /\\u[0-9a-fA-F]{4}/g,  // Unicode escapes
        /String\.fromCharCode/g, // Character code obfuscation
        /charAt\(\d+\)/g,      // Character access patterns
      ];

      let obfuscationScore = 0;
      for (const indicator of obfuscationIndicators) {
        const matches = text.match(indicator);
        if (matches) {
          obfuscationScore += matches.length;
        }
      }

      if (obfuscationScore > 10) {
        threats.push({
          type: 'suspicious_content',
          severity: 'medium',
          description: 'File contains heavily obfuscated content',
          details: { obfuscation_score: obfuscationScore }
        });
        recommendations.push('Review file content manually for legitimacy');
      }

      // Check for PII (Personal Identifiable Information)
      const piiPatterns = [
        /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
        /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, // Credit card
        // Saudi ID patterns
        /\b[12]\d{9}\b/g, // Saudi National ID
        /\+966[0-9]{9}/g, // Saudi phone numbers
      ];

      let piiMatches = 0;
      for (const pattern of piiPatterns) {
        const matches = text.match(pattern);
        if (matches) {
          piiMatches += matches.length;
        }
      }

      if (piiMatches > 5) {
        threats.push({
          type: 'suspicious_content',
          severity: 'low',
          description: 'File contains potentially sensitive personal information',
          details: { pii_matches: piiMatches }
        });
        recommendations.push('Ensure file handling complies with data protection regulations');
      }

    } catch (error) {
      console.error('Text content analysis error:', error);
    }

    return { threats, recommendations };
  }

  /**
   * Check organizational security policies
   */
  private static async checkOrganizationalPolicies(
    fileInfo: any,
    organizationId: string,
    uploadedBy: string
  ): Promise<{
    violations: SecurityThreat[];
    recommendations: string[];
  }> {
    const violations: SecurityThreat[] = [];
    const recommendations: string[] = [];

    // This would typically fetch from database - simplified for demo
    const defaultPolicies = {
      maxFileSize: 50 * 1024 * 1024, // 50MB
      allowedMimeTypes: Array.from(this.ALLOWED_MIME_TYPES),
      requiresApproval: false,
      allowPersonalData: true,
      retentionDays: 365
    };

    if (fileInfo.fileSize > defaultPolicies.maxFileSize) {
      violations.push({
        type: 'size_anomaly',
        severity: 'medium',
        description: `File exceeds organization's maximum allowed size of ${defaultPolicies.maxFileSize / 1024 / 1024}MB`,
        details: { 
          fileSize: fileInfo.fileSize, 
          maxAllowed: defaultPolicies.maxFileSize 
        }
      });
    }

    return { violations, recommendations };
  }

  /**
   * Check upload rate limiting to prevent abuse
   */
  private static async checkUploadRateLimit(
    organizationId: string,
    uploadedBy: string
  ): Promise<{
    allowed: boolean;
    current_rate: number;
    limit: number;
    reset_time: Date;
  }> {
    // This would typically use Redis or database - simplified for demo
    const rateLimit = {
      uploads_per_hour: 100,
      uploads_per_day: 500
    };

    // In production, implement actual rate limiting with Redis
    return {
      allowed: true,
      current_rate: 0,
      limit: rateLimit.uploads_per_hour,
      reset_time: new Date(Date.now() + 60 * 60 * 1000)
    };
  }

  /**
   * Check if file type is text-based for content analysis
   */
  private static isTextBasedFile(mimeType: string): boolean {
    return mimeType.startsWith('text/') || 
           mimeType.includes('json') ||
           mimeType.includes('xml') ||
           mimeType.includes('csv');
  }

  /**
   * Generate security report for file
   */
  static generateSecurityReport(result: SecurityCheckResult): {
    summary: string;
    risk_level: 'low' | 'medium' | 'high' | 'critical';
    action_required: string;
    detailed_findings: string[];
  } {
    const criticalThreats = result.threats.filter(t => t.severity === 'critical').length;
    const highThreats = result.threats.filter(t => t.severity === 'high').length;
    const mediumThreats = result.threats.filter(t => t.severity === 'medium').length;
    const lowThreats = result.threats.filter(t => t.severity === 'low').length;

    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    let actionRequired = 'File is safe to process';

    if (criticalThreats > 0) {
      riskLevel = 'critical';
      actionRequired = 'BLOCK: File must be rejected and quarantined immediately';
    } else if (highThreats > 0) {
      riskLevel = 'high';
      actionRequired = 'REVIEW: File requires manual security review before processing';
    } else if (mediumThreats > 1) {
      riskLevel = 'medium';
      actionRequired = 'CAUTION: File can be processed with additional monitoring';
    }

    const summary = `Security scan found ${result.threats.length} potential issues: ${criticalThreats} critical, ${highThreats} high, ${mediumThreats} medium, ${lowThreats} low risk.`;

    const detailedFindings = result.threats.map(threat => 
      `[${threat.severity.toUpperCase()}] ${threat.type}: ${threat.description}`
    );

    return {
      summary,
      risk_level: riskLevel,
      action_required: actionRequired,
      detailed_findings: detailedFindings
    };
  }

  /**
   * Clean up and sanitize file if possible
   */
  static async sanitizeFile(filePath: string, mimeType: string): Promise<{
    success: boolean;
    sanitized_path?: string;
    actions_taken: string[];
    error?: string;
  }> {
    const actionsTaken: string[] = [];

    try {
      // For now, basic file sanitization
      // In production, this would use specialized tools

      if (mimeType.startsWith('text/')) {
        // Remove potentially malicious script tags from text files
        let content = fs.readFileSync(filePath, 'utf8');
        const originalLength = content.length;
        
        // Remove script tags and event handlers
        content = content.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
        content = content.replace(/on\w+\s*=\s*["\'][^"\']*["\']/gi, '');
        content = content.replace(/javascript:/gi, '');
        
        if (content.length !== originalLength) {
          const sanitizedPath = filePath + '.sanitized';
          fs.writeFileSync(sanitizedPath, content);
          actionsTaken.push('Removed suspicious script content');
          
          return {
            success: true,
            sanitized_path: sanitizedPath,
            actions_taken: actionsTaken
          };
        }
      }

      return {
        success: true,
        actions_taken: ['No sanitization required']
      };

    } catch (error) {
      return {
        success: false,
        actions_taken: actionsTaken,
        error: error instanceof Error ? error.message : 'Sanitization failed'
      };
    }
  }
}