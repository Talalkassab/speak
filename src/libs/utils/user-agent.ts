interface DeviceInfo {
  deviceType: string;
  browser: string;
  os: string;
  version: string;
  mobile: boolean;
  tablet: boolean;
  desktop: boolean;
}

/**
 * Parse user agent string to extract device and browser information
 */
export function parseUserAgent(userAgent: string): DeviceInfo {
  const ua = userAgent.toLowerCase();

  // Device type detection
  const mobile = /mobile|android|iphone|ipod|blackberry|opera mini|iemobile|wpdesktop/.test(ua);
  const tablet = /tablet|ipad|playbook|silk/.test(ua);
  const desktop = !mobile && !tablet;

  let deviceType = 'desktop';
  if (mobile) deviceType = 'mobile';
  else if (tablet) deviceType = 'tablet';

  // Browser detection
  let browser = 'unknown';
  let version = '';

  if (ua.includes('edg/')) {
    browser = 'edge';
    version = ua.match(/edg\/([0-9.]+)/)?.[1] || '';
  } else if (ua.includes('chrome/') && !ua.includes('chromium/')) {
    browser = 'chrome';
    version = ua.match(/chrome\/([0-9.]+)/)?.[1] || '';
  } else if (ua.includes('firefox/')) {
    browser = 'firefox';
    version = ua.match(/firefox\/([0-9.]+)/)?.[1] || '';
  } else if (ua.includes('safari/') && !ua.includes('chrome/')) {
    browser = 'safari';
    version = ua.match(/version\/([0-9.]+)/)?.[1] || '';
  } else if (ua.includes('opera/') || ua.includes('opr/')) {
    browser = 'opera';
    version = ua.match(/(opera|opr)\/([0-9.]+)/)?.[2] || '';
  } else if (ua.includes('msie') || ua.includes('trident/')) {
    browser = 'internet explorer';
    version = ua.match(/(msie |rv:)([0-9.]+)/)?.[2] || '';
  }

  // Operating system detection
  let os = 'unknown';

  if (ua.includes('windows nt')) {
    os = 'windows';
    const ntVersion = ua.match(/windows nt ([0-9.]+)/)?.[1];
    switch (ntVersion) {
      case '10.0':
        os = 'windows 10';
        break;
      case '6.3':
        os = 'windows 8.1';
        break;
      case '6.2':
        os = 'windows 8';
        break;
      case '6.1':
        os = 'windows 7';
        break;
      default:
        os = 'windows';
    }
  } else if (ua.includes('mac os x')) {
    os = 'macos';
    const macVersion = ua.match(/mac os x ([0-9_.]+)/)?.[1];
    if (macVersion) {
      os = `macos ${macVersion.replace(/_/g, '.')}`;
    }
  } else if (ua.includes('linux')) {
    if (ua.includes('android')) {
      os = 'android';
      const androidVersion = ua.match(/android ([0-9.]+)/)?.[1];
      if (androidVersion) {
        os = `android ${androidVersion}`;
      }
    } else {
      os = 'linux';
    }
  } else if (ua.includes('iphone') || ua.includes('ipad')) {
    os = 'ios';
    const iosVersion = ua.match(/os ([0-9_]+)/)?.[1];
    if (iosVersion) {
      os = `ios ${iosVersion.replace(/_/g, '.')}`;
    }
  } else if (ua.includes('cros')) {
    os = 'chrome os';
  }

  return {
    deviceType,
    browser,
    os,
    version,
    mobile,
    tablet,
    desktop
  };
}

/**
 * Check if user agent is from a bot/crawler
 */
export function isBot(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  const botPatterns = [
    'bot', 'crawler', 'spider', 'scraper', 'search', 'monitor',
    'googlebot', 'bingbot', 'yandexbot', 'duckduckbot', 'slackbot',
    'facebookexternalhit', 'twitterbot', 'linkedinbot', 'whatsapp',
    'telegram', 'pinterest', 'instagram', 'snapchat', 'tiktok',
    'baiduspider', 'sogou', '360spider', 'bytedance',
    'curl', 'wget', 'postman', 'insomnia', 'httpie'
  ];

  return botPatterns.some(pattern => ua.includes(pattern));
}

/**
 * Extract browser capabilities from user agent
 */
export function getBrowserCapabilities(userAgent: string): {
  javascript: boolean;
  cookies: boolean;
  webgl: boolean;
  canvas: boolean;
  geolocation: boolean;
  localStorage: boolean;
  sessionStorage: boolean;
  indexedDB: boolean;
  webSockets: boolean;
  webWorkers: boolean;
  pushNotifications: boolean;
} {
  const ua = userAgent.toLowerCase();
  const info = parseUserAgent(userAgent);

  // These are estimates based on browser versions
  // In a real application, you'd use feature detection on the client side
  const capabilities = {
    javascript: true, // Assume true for modern browsers
    cookies: true,
    webgl: false,
    canvas: false,
    geolocation: false,
    localStorage: false,
    sessionStorage: false,
    indexedDB: false,
    webSockets: false,
    webWorkers: false,
    pushNotifications: false
  };

  // Modern browser capabilities (very simplified)
  if (info.browser === 'chrome' || info.browser === 'firefox' || 
      info.browser === 'safari' || info.browser === 'edge') {
    capabilities.webgl = true;
    capabilities.canvas = true;
    capabilities.geolocation = true;
    capabilities.localStorage = true;
    capabilities.sessionStorage = true;
    capabilities.indexedDB = true;
    capabilities.webSockets = true;
    capabilities.webWorkers = true;
    capabilities.pushNotifications = true;
  }

  return capabilities;
}

/**
 * Get device screen resolution estimate based on device type
 */
export function getEstimatedScreenResolution(deviceInfo: DeviceInfo): {
  width: number;
  height: number;
  category: string;
} {
  if (deviceInfo.mobile) {
    return {
      width: 375,
      height: 667,
      category: 'mobile'
    };
  } else if (deviceInfo.tablet) {
    return {
      width: 768,
      height: 1024,
      category: 'tablet'
    };
  } else {
    return {
      width: 1920,
      height: 1080,
      category: 'desktop'
    };
  }
}

/**
 * Generate a fingerprint hash from user agent and other data
 */
export function generateDeviceFingerprint(
  userAgent: string,
  ipAddress?: string,
  acceptLanguage?: string
): string {
  const info = parseUserAgent(userAgent);
  const fingerprintData = {
    browser: info.browser,
    os: info.os,
    deviceType: info.deviceType,
    userAgent: userAgent.substring(0, 100), // Truncate for consistency
    acceptLanguage,
    ipAddress: ipAddress?.split('.').slice(0, 3).join('.') // Partial IP for privacy
  };

  // Simple hash function (in production, use a proper crypto library)
  const str = JSON.stringify(fingerprintData);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return Math.abs(hash).toString(36);
}

/**
 * Check if the user agent indicates a supported browser
 */
export function isSupportedBrowser(userAgent: string): boolean {
  const info = parseUserAgent(userAgent);
  
  // Define minimum supported versions
  const supportedBrowsers = {
    chrome: 80,
    firefox: 75,
    safari: 13,
    edge: 80,
    opera: 67
  };

  if (!info.version) {
    return false;
  }

  const majorVersion = parseInt(info.version.split('.')[0]);
  const minVersion = supportedBrowsers[info.browser as keyof typeof supportedBrowsers];

  return minVersion ? majorVersion >= minVersion : false;
}