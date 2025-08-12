import { defineConfig, devices } from '@playwright/test';

/**
 * Enhanced Playwright Configuration with Arabic Language Support
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests/e2e',
  
  /* Run tests in files in parallel */
  fullyParallel: true,
  
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  
  /* Retry on CI only */
  retries: process.env.CI ? 3 : 1,
  
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 2 : undefined,
  
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results/e2e-results.json' }],
    ['junit', { outputFile: 'test-results/e2e-results.xml' }],
    ['allure-playwright', { detail: true, outputFolder: 'allure-results' }],
    ['github'],
  ],
  
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    
    /* Take screenshot on failure */
    screenshot: 'only-on-failure',
    
    /* Video recording */
    video: 'retain-on-failure',
    
    /* Timeout for each test */
    actionTimeout: 30000,
    navigationTimeout: 30000,
    
    /* Default locale and timezone for Arabic support */
    locale: 'ar-SA',
    timezoneId: 'Asia/Riyadh',
    
    /* Extra HTTP headers for all requests */
    extraHTTPHeaders: {
      'Accept-Language': 'ar-SA,ar;q=0.9,en;q=0.8',
      'Content-Language': 'ar',
    },
    
    /* Ignore HTTPS errors in development */
    ignoreHTTPSErrors: true,
    
    /* Permissions for voice and file features */
    permissions: ['clipboard-read', 'clipboard-write', 'microphone', 'camera'],
    
    /* Enable strict selectors */
    strictSelectors: true,
  },

  /* Configure projects for comprehensive testing */
  projects: [
    // Setup project
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      teardown: 'cleanup',
    },
    
    // Cleanup project 
    {
      name: 'cleanup',
      testMatch: /.*\.teardown\.ts/,
    },

    // Desktop browsers with Arabic support
    {
      name: 'chromium-arabic-desktop',
      use: { 
        ...devices['Desktop Chrome'],
        locale: 'ar-SA',
        timezoneId: 'Asia/Riyadh',
        viewport: { width: 1920, height: 1080 },
        extraHTTPHeaders: {
          'Accept-Language': 'ar-SA,ar;q=0.9',
          'Content-Language': 'ar',
        },
      },
      dependencies: ['setup'],
      testMatch: ['**/*.arabic.spec.ts', '**/*.rtl.spec.ts'],
    },
    
    {
      name: 'firefox-arabic-desktop',
      use: { 
        ...devices['Desktop Firefox'],
        locale: 'ar-SA',
        timezoneId: 'Asia/Riyadh',
        viewport: { width: 1920, height: 1080 },
        extraHTTPHeaders: {
          'Accept-Language': 'ar-SA,ar;q=0.9',
        },
      },
      dependencies: ['setup'],
      testMatch: ['**/*.arabic.spec.ts', '**/*.rtl.spec.ts'],
    },

    {
      name: 'webkit-arabic-desktop',
      use: { 
        ...devices['Desktop Safari'],
        locale: 'ar-SA',
        timezoneId: 'Asia/Riyadh',
        viewport: { width: 1920, height: 1080 },
      },
      dependencies: ['setup'],
      testMatch: ['**/*.arabic.spec.ts', '**/*.rtl.spec.ts'],
    },

    // English language testing
    {
      name: 'chromium-english-desktop',
      use: { 
        ...devices['Desktop Chrome'],
        locale: 'en-US',
        timezoneId: 'America/New_York',
        viewport: { width: 1920, height: 1080 },
        extraHTTPHeaders: {
          'Accept-Language': 'en-US,en;q=0.9',
        },
      },
      dependencies: ['setup'],
      testMatch: ['**/*.english.spec.ts', '**/*.ltr.spec.ts'],
    },

    // Mobile browsers with Arabic support
    {
      name: 'mobile-chrome-arabic',
      use: { 
        ...devices['Pixel 5'],
        locale: 'ar-SA',
        timezoneId: 'Asia/Riyadh',
        extraHTTPHeaders: {
          'Accept-Language': 'ar-SA,ar;q=0.9',
        },
        // Mobile-specific settings
        hasTouch: true,
        isMobile: true,
      },
      dependencies: ['setup'],
      testMatch: ['**/*.mobile.spec.ts', '**/*.arabic.mobile.spec.ts'],
    },
    
    {
      name: 'mobile-safari-arabic',
      use: { 
        ...devices['iPhone 12'],
        locale: 'ar-SA',
        timezoneId: 'Asia/Riyadh',
        hasTouch: true,
        isMobile: true,
      },
      dependencies: ['setup'],
      testMatch: ['**/*.mobile.spec.ts', '**/*.arabic.mobile.spec.ts'],
    },

    // Performance testing
    {
      name: 'performance-testing',
      use: {
        ...devices['Desktop Chrome'],
        locale: 'ar-SA',
        timezoneId: 'Asia/Riyadh',
      },
      dependencies: ['setup'],
      testMatch: ['**/*.performance.spec.ts'],
    },

    // Accessibility testing
    {
      name: 'accessibility-testing',
      use: {
        ...devices['Desktop Chrome'],
        locale: 'ar-SA',
        timezoneId: 'Asia/Riyadh',
        // Enable accessibility features
        contextOptions: {
          reducedMotion: 'reduce',
          forcedColors: 'none',
        },
      },
      dependencies: ['setup'],
      testMatch: ['**/*.a11y.spec.ts'],
    },

    // Visual regression testing
    {
      name: 'visual-regression',
      use: {
        ...devices['Desktop Chrome'],
        locale: 'ar-SA',
        timezoneId: 'Asia/Riyadh',
        viewport: { width: 1920, height: 1080 },
      },
      dependencies: ['setup'],
      testMatch: ['**/*.visual.spec.ts'],
    },

    // API testing
    {
      name: 'api-testing',
      use: {
        baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000',
        extraHTTPHeaders: {
          'Accept': 'application/json',
          'Accept-Language': 'ar-SA,ar;q=0.9,en;q=0.8',
        },
      },
      dependencies: ['setup'],
      testMatch: ['**/*.api.spec.ts'],
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      NODE_ENV: 'test',
    },
  },

  /* Global setup for all tests */
  globalSetup: require.resolve('./tests/e2e/global-setup.ts'),
  
  /* Global teardown for all tests */
  globalTeardown: require.resolve('./tests/e2e/global-teardown.ts'),

  /* Expect configuration */
  expect: {
    /* Maximum time expect() should wait for the condition to be met. */
    timeout: 10000,
    
    /* Configuration for visual comparisons */
    toHaveScreenshot: {
      /* Threshold for pixel difference */
      threshold: 0.2,
      /* Animation handling */
      animations: 'disabled',
      /* Clip for consistent screenshots */
      clip: { x: 0, y: 0, width: 1920, height: 1080 },
      /* Full page screenshots */
      fullPage: true,
      /* Different thresholds for different platforms */
      thresholds: {
        desktop: 0.2,
        mobile: 0.3,
      },
    },
    
    /* API response expectations */
    toHaveResponse: {
      timeout: 30000,
    },
  },

  /* Output directory */
  outputDir: 'test-results/',
  
  /* Test timeout */
  timeout: 60000,
  
  /* Maximum failures */
  maxFailures: process.env.CI ? 10 : undefined,
  
  /* Global test metadata */
  metadata: {
    'test-platform': 'Playwright',
    'test-environment': process.env.NODE_ENV || 'development',
    'arabic-support': 'enabled',
    'rtl-testing': 'enabled',
  },
});