import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function repoFile(name: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), name), 'utf8');
}

function loadManifest(): any {
  return JSON.parse(repoFile('manifest.json'));
}

const HTTP_HOSTS = ['http://*/*', 'https://*/*'];

describe('manifest trust surface (Phase 4 hardening)', () => {
  it('does not request the webRequest permission', () => {
    const manifest = loadManifest();
    expect(manifest.permissions).not.toContain('webRequest');
  });

  it('keeps the permissions the product still needs', () => {
    const manifest = loadManifest();
    for (const permission of ['storage', 'webNavigation', 'offscreen', 'alarms']) {
      expect(manifest.permissions).toContain(permission);
    }
  });

  it('restricts host permissions to exactly HTTP and HTTPS', () => {
    const manifest = loadManifest();
    expect(manifest.host_permissions).toEqual(HTTP_HOSTS);
  });

  it('restricts content-script matches to exactly HTTP and HTTPS', () => {
    const manifest = loadManifest();
    for (const script of manifest.content_scripts) {
      expect(script.matches).toEqual(HTTP_HOSTS);
    }
  });

  it('restricts web-accessible-resource matches to exactly HTTP and HTTPS', () => {
    const manifest = loadManifest();
    for (const entry of manifest.web_accessible_resources) {
      expect(entry.matches).toEqual(HTTP_HOSTS);
    }
  });

  it('contains no <all_urls> match pattern', () => {
    expect(JSON.stringify(loadManifest())).not.toContain('<all_urls>');
  });

  it('keeps Google Fonts and Ko-fi out of the content security policy', () => {
    const csp: string = loadManifest().content_security_policy.extension_pages;
    expect(csp).not.toContain('fonts.googleapis.com');
    expect(csp).not.toContain('fonts.gstatic.com');
    expect(csp).not.toContain('storage.ko-fi.com');
  });

  it('retains the Hugging Face connect destinations for the current AI architecture', () => {
    const csp: string = loadManifest().content_security_policy.extension_pages;
    for (const host of [
      'https://huggingface.co',
      'https://*.huggingface.co',
      'https://*.hf.co',
      'https://*.xethub.hf.co'
    ]) {
      expect(csp).toContain(host);
    }
  });

  it('does not register the upstream uninstall survey URL', () => {
    const background = repoFile('src/background/background.ts');
    expect(background).not.toContain('arcrawls.com/uninstall');
  });

  it('clears any previously registered uninstall URL', () => {
    const background = repoFile('src/background/background.ts');
    expect(background).toContain("setUninstallURL('')");
  });

  it('does not reintroduce Google Fonts or Ko-fi in the generated Firefox CSP', () => {
    const script = repoFile('scripts/build-firefox.mjs');
    expect(script).not.toContain('fonts.googleapis.com');
    expect(script).not.toContain('fonts.gstatic.com');
    expect(script).not.toContain('storage.ko-fi.com');
  });
});
