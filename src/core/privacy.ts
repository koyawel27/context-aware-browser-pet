export type PagePrivacyReason =
  | 'normal'
  | 'user-blocked'
  | 'sensitive-domain'
  | 'sensitive-route'
  | 'sensitive-form'
  | 'unsupported-scheme'
  | 'invalid-url';

export interface PagePrivacyDecision {
  protected: boolean;
  reason: PagePrivacyReason;
}

/**
 * Deliberately conservative whole-domain protection.
 *
 * This is not intended to be an exhaustive list of sensitive websites.
 * Generic route and sensitive-form protection provide additional coverage.
 *
 * Mixed-use services should prefer a dedicated sensitive subdomain instead
 * of protecting the entire parent domain where practical.
 */
const SENSITIVE_DOMAINS = [
  'paypal.com',
  'chase.com',
  'bankofamerica.com',
  'wellsfargo.com',
  'fidelity.com',
  'vanguard.com',
  'coinbase.com',
  'binance.com',
  'dashboard.stripe.com',
  'checkout.stripe.com',
] as const;

const SENSITIVE_ROUTE_SEGMENT_PATTERNS = [
  /^(?:log-?in|sign-?in)(?:\.[a-z0-9]+)?$/i,
  /^(?:auth|authenticate|authentication|authorize|authorization)(?:\.[a-z0-9]+)?$/i,
  /^oauth2?(?:\.[a-z0-9]+)?$/i,
  /^(?:checkout|payments?|billing|wallet)(?:\.[a-z0-9]+)?$/i,
] as const;

export function normalizeHostname(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return '';

  try {
    const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;

    return new URL(candidate).hostname.toLowerCase().replace(/\.$/, '');
  } catch {
    return '';
  }
}

export function hostnameMatchesDomain(hostname: string, domain: string): boolean {
  const normalizedHost = normalizeHostname(hostname);
  const normalizedDomain = normalizeHostname(domain);

  if (!normalizedHost || !normalizedDomain) return false;

  return (
    normalizedHost === normalizedDomain ||
    normalizedHost.endsWith(`.${normalizedDomain}`)
  );
}

export function isUserBlockedDomain(
  hostname: string,
  blockedDomains: string[] = []
): boolean {
  return blockedDomains.some((domain) =>
    hostnameMatchesDomain(hostname, domain)
  );
}

export function isSensitiveHostname(hostname: string): boolean {
  return SENSITIVE_DOMAINS.some((domain) =>
    hostnameMatchesDomain(hostname, domain)
  );
}

function normalizePathSegment(segment: string): string {
  let decoded = segment;

  try {
    decoded = decodeURIComponent(segment);
  } catch {
    // Keep the original segment if malformed percent-encoding is present.
  }

  // Ignore matrix parameters such as /login;jsessionid=...
  return decoded.split(';', 1)[0].trim().toLowerCase();
}

export function isSensitivePath(pathname: string): boolean {
  const segments = pathname
    .split('/')
    .filter(Boolean)
    .map(normalizePathSegment);

  return segments.some((segment) =>
    SENSITIVE_ROUTE_SEGMENT_PATTERNS.some((pattern) =>
      pattern.test(segment)
    )
  );
}

export function evaluateUrlPrivacy(
  rawUrl: string,
  blockedDomains: string[] = []
): PagePrivacyDecision {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    // Privacy decisions fail closed when the page URL cannot be understood.
    return {
      protected: true,
      reason: 'invalid-url',
    };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return {
      protected: true,
      reason: 'unsupported-scheme',
    };
  }

  if (isUserBlockedDomain(url.hostname, blockedDomains)) {
    return {
      protected: true,
      reason: 'user-blocked',
    };
  }

  if (isSensitiveHostname(url.hostname)) {
    return {
      protected: true,
      reason: 'sensitive-domain',
    };
  }

  if (isSensitivePath(url.pathname)) {
    return {
      protected: true,
      reason: 'sensitive-route',
    };
  }

  return {
    protected: false,
    reason: 'normal',
  };
}
/**
 * Minimal DOM signals that indicate a page may contain credentials,
 * authentication codes, payment-card data, or Social Security numbers.
 *
 * Arcrawls checks only whether matching fields exist. It never reads
 * their values as part of this privacy decision.
 */
const SENSITIVE_FORM_FIELD_SELECTOR = [
  'input[type="password"]',
  'input[autocomplete~="current-password" i]',
  'input[autocomplete~="new-password" i]',
  'input[autocomplete~="one-time-code" i]',
  'input[autocomplete~="cc-number" i]',
  'input[autocomplete~="cc-csc" i]',
  'input[autocomplete~="cc-exp" i]',
  'input[name*="ssn" i]',
  'input[id*="ssn" i]',
].join(', ');

export interface SensitiveFieldQueryRoot {
  querySelector(selectors: string): unknown;
}

export function hasSensitiveFormFields(
  root: SensitiveFieldQueryRoot
): boolean {
  try {
    return root.querySelector(SENSITIVE_FORM_FIELD_SELECTOR) !== null;
  } catch {
    // The privacy check fails closed if the DOM query unexpectedly fails.
    return true;
  }
}
