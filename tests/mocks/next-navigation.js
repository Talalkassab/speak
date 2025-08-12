/**
 * Mock for Next.js navigation hooks
 */

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockPrefetch = jest.fn();
const mockBack = jest.fn();
const mockForward = jest.fn();
const mockRefresh = jest.fn();

export const useRouter = () => ({
  push: mockPush,
  replace: mockReplace,
  prefetch: mockPrefetch,
  back: mockBack,
  forward: mockForward,
  refresh: mockRefresh,
  pathname: '/',
  query: {},
  asPath: '/',
  route: '/',
  events: {
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
  },
  isFallback: false,
  isLocaleDomain: false,
  isReady: true,
  defaultLocale: 'en',
  domainLocales: [],
  isPreview: false,
});

export const usePathname = () => '/';

export const useSearchParams = () => {
  const searchParams = new URLSearchParams();
  return {
    ...searchParams,
    get: jest.fn((key) => null),
    getAll: jest.fn((key) => []),
    has: jest.fn((key) => false),
    toString: jest.fn(() => ''),
  };
};

export const useParams = () => ({});

export const redirect = jest.fn();
export const permanentRedirect = jest.fn();
export const notFound = jest.fn();

// Reset mocks
export const __resetMocks = () => {
  mockPush.mockReset();
  mockReplace.mockReset();
  mockPrefetch.mockReset();
  mockBack.mockReset();
  mockForward.mockReset();
  mockRefresh.mockReset();
  redirect.mockReset();
  permanentRedirect.mockReset();
  notFound.mockReset();
};