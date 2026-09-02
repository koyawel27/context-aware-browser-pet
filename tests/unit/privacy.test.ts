import { describe, expect, it } from 'vitest';
import {
  evaluateUrlPrivacy,
  hasSensitiveFormFields,
  hostnameMatchesDomain,
  isSensitivePath,
  isUserBlockedDomain,
  normalizeHostname,
} from '../../src/core/privacy';

describe('Sensitive-Site Privacy Policy', () => {
  describe('normalizeHostname', () => {
    it('normalizes URLs, case, paths, and ports to a hostname', () => {
      expect(
        normalizeHostname('HTTPS://Example.COM:8443/account/login')
      ).toBe('example.com');
    });

    it('normalizes a plain hostname', () => {
      expect(normalizeHostname('Sub.Example.com')).toBe('sub.example.com');
    });

    it('returns an empty string for an invalid hostname', () => {
      expect(normalizeHostname('not a valid host name')).toBe('');
    });
  });

  describe('hostnameMatchesDomain', () => {
    it('matches the exact domain', () => {
      expect(
        hostnameMatchesDomain('paypal.com', 'paypal.com')
      ).toBe(true);
    });

    it('matches legitimate subdomains', () => {
      expect(
        hostnameMatchesDomain('secure.paypal.com', 'paypal.com')
      ).toBe(true);
    });

    it('rejects a prefixed lookalike domain', () => {
      expect(
        hostnameMatchesDomain('fakepaypal.com', 'paypal.com')
      ).toBe(false);
    });

    it('rejects a domain that only contains the protected domain as text', () => {
      expect(
        hostnameMatchesDomain('paypal.com.evil.example', 'paypal.com')
      ).toBe(false);
    });
  });

  describe('isUserBlockedDomain', () => {
    it('protects an explicitly blocked domain', () => {
      expect(
        isUserBlockedDomain('example.com', ['example.com'])
      ).toBe(true);
    });

    it('protects subdomains of a blocked parent domain', () => {
      expect(
        isUserBlockedDomain('private.example.com', ['example.com'])
      ).toBe(true);
    });

    it('does not block unrelated domains', () => {
      expect(
        isUserBlockedDomain('example.org', ['example.com'])
      ).toBe(false);
    });
  });

  describe('isSensitivePath', () => {
    it('detects login routes', () => {
      expect(isSensitivePath('/account/login')).toBe(true);
      expect(isSensitivePath('/user/sign-in')).toBe(true);
    });

    it('detects authentication and OAuth routes', () => {
      expect(isSensitivePath('/auth/callback')).toBe(true);
      expect(isSensitivePath('/common/oauth2/authorize')).toBe(true);
    });

    it('detects checkout and financial-action routes', () => {
      expect(isSensitivePath('/checkout')).toBe(true);
      expect(isSensitivePath('/account/billing/invoices')).toBe(true);
      expect(isSensitivePath('/wallet')).toBe(true);
    });

    it('does not trigger on words embedded inside ordinary route names', () => {
      expect(isSensitivePath('/docs/payment-api')).toBe(false);
      expect(isSensitivePath('/blog/authentication-guide')).toBe(false);
      expect(isSensitivePath('/account')).toBe(false);
    });
  });

  describe('evaluateUrlPrivacy', () => {
    it('protects a user-blocked site', () => {
      expect(
        evaluateUrlPrivacy(
          'https://notes.example.com/study',
          ['example.com']
        )
      ).toEqual({
        protected: true,
        reason: 'user-blocked',
      });
    });

    it('protects a known sensitive financial domain', () => {
      expect(
        evaluateUrlPrivacy('https://secure.chase.com/dashboard')
      ).toEqual({
        protected: true,
        reason: 'sensitive-domain',
      });
    });

    it('protects a sensitive route on an otherwise unknown site', () => {
      expect(
        evaluateUrlPrivacy('https://example.org/account/login')
      ).toEqual({
        protected: true,
        reason: 'sensitive-route',
      });
    });

    it('allows an ordinary HTTPS page', () => {
      expect(
        evaluateUrlPrivacy('https://developer.mozilla.org/en-US/docs/Web/API')
      ).toEqual({
        protected: false,
        reason: 'normal',
      });
    });

    it('allows local HTTP development pages', () => {
      expect(
        evaluateUrlPrivacy('http://localhost:5173/tests/spa.html')
      ).toEqual({
        protected: false,
        reason: 'normal',
      });
    });

    it('fails closed for unsupported schemes', () => {
      expect(
        evaluateUrlPrivacy('file:///C:/Users/Test/private-notes.html')
      ).toEqual({
        protected: true,
        reason: 'unsupported-scheme',
      });
    });

    it('fails closed for malformed URLs', () => {
      expect(
        evaluateUrlPrivacy('definitely not a URL')
      ).toEqual({
        protected: true,
        reason: 'invalid-url',
      });
    });
  });
});
describe('hasSensitiveFormFields', () => {
  it('detects when the query root contains a sensitive field', () => {
    let observedSelector = '';

    const root = {
      querySelector(selector: string) {
        observedSelector = selector;
        return {};
      },
    };

    expect(hasSensitiveFormFields(root)).toBe(true);

    expect(observedSelector).toContain('input[type="password"]');
    expect(observedSelector).toContain('current-password');
    expect(observedSelector).toContain('one-time-code');
    expect(observedSelector).toContain('cc-number');
    expect(observedSelector).toContain('ssn');
  });

  it('allows a document with no matching sensitive fields', () => {
    const root = {
      querySelector() {
        return null;
      },
    };

    expect(hasSensitiveFormFields(root)).toBe(false);
  });

  it('fails closed if the sensitive-field query cannot be performed', () => {
    const root = {
      querySelector() {
        throw new Error('DOM query unavailable');
      },
    };

    expect(hasSensitiveFormFields(root)).toBe(true);
  });
});
