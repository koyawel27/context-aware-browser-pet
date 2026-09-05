import { getRuntimeUrl } from '../shared/platform';

export const PRIVACY_COMPANION_HOST_ID =
  'arcrawls-privacy-companion-host';

export const PRIVACY_COMPANION_MESSAGE =
  "I'm paused for this page.";

const PRIVACY_COMPANION_ASSET =
  'assets/pets/arcrawls-going-away.svg';

// The going-away SVG runs a ~3s dig-away animation.
// Remove the host shortly after that animation finishes.
export const PRIVACY_COMPANION_LIFETIME_MS = 3500;

/**
 * Tiny one-shot privacy companion.
 *
 * This is NOT the normal mascot runtime. It renders a single packaged
 * SVG with a fixed predefined message and destroys itself. It has no
 * chat, voice, AI, personality, movement, triggers, listeners, or
 * background messages, and it never reads page content or field values.
 */
export class PrivacyCompanion {
  private shadowHost: HTMLElement | null = null;
  private destroyTimer: ReturnType<typeof setTimeout> | null =
    null;

  isShown(): boolean {
    return !!this.shadowHost?.isConnected;
  }

  show(size = 128): void {
    // Idempotent: repeated protected evaluations must not
    // create duplicate hosts.
    if (this.isShown()) return;

    const url = getRuntimeUrl(PRIVACY_COMPANION_ASSET);
    if (!url) return;

    const dimension = Math.max(64, size || 128);

    const host = document.createElement('div');
    host.id = PRIVACY_COMPANION_HOST_ID;
    host.setAttribute('role', 'status');
    host.setAttribute(
      'aria-label',
      PRIVACY_COMPANION_MESSAGE
    );
    host.setAttribute(
      'data-privacy-reaction',
      'active'
    );

    const shadow = host.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = [
      ':host { all: initial; }',
      '.privacy-companion {',
      '  position: fixed;',
      '  right: 16px;',
      '  bottom: 16px;',
      '  z-index: 2147483647;',
      '  display: flex;',
      '  flex-direction: column;',
      '  align-items: center;',
      '  gap: 8px;',
      '  pointer-events: none;',
      '  user-select: none;',
      '}',
      '.privacy-companion img {',
      `  width: ${dimension}px;`,
      `  height: ${dimension}px;`,
      '  image-rendering: pixelated;',
      '}',
      '.privacy-companion-bubble {',
      "  font-family: system-ui, sans-serif;",
      '  font-size: 13px;',
      '  color: #1f2937;',
      '  background: #f3f4f6;',
      '  border: 1px solid #d1d5db;',
      '  border-radius: 12px;',
      '  padding: 6px 10px;',
      '  white-space: nowrap;',
      '}',
    ].join('\n');

    const root = document.createElement('div');
    root.className = 'privacy-companion';

    const img = document.createElement('img');
    img.src = url;
    img.alt = '';
    img.setAttribute('aria-hidden', 'true');

    const bubble = document.createElement('div');
    bubble.className = 'privacy-companion-bubble';
    bubble.textContent = PRIVACY_COMPANION_MESSAGE;

    root.appendChild(img);
    root.appendChild(bubble);
    shadow.appendChild(style);
    shadow.appendChild(root);

    const target = document.documentElement;
    if (!target) return;
    target.appendChild(host);

    this.shadowHost = host;
    this.destroyTimer = setTimeout(() => {
      this.destroy();
    }, PRIVACY_COMPANION_LIFETIME_MS);
  }

  destroy(): void {
    if (this.destroyTimer) {
      clearTimeout(this.destroyTimer);
      this.destroyTimer = null;
    }

    if (this.shadowHost) {
      this.shadowHost.remove();
      this.shadowHost = null;
    }
  }
}
