// Captured in the webpage's MAIN world context to bypass Content Security Policies
(() => {
const currentScript = document.currentScript as HTMLScriptElement;
const BRIDGE_TOKEN = currentScript?.dataset.token;

let bridgeActive = true;
const activeSessions = new Set<any>();

function postBridgeMessage(message: Record<string, unknown>): void {
  if (!bridgeActive) return;
  window.postMessage({ ...message, token: BRIDGE_TOKEN }, '*');
}

async function closeSession(session: any): Promise<void> {
  if (!session) return;

  try {
    if (typeof session.destroy === 'function') {
      await session.destroy();
    } else if (typeof session.close === 'function') {
      await session.close();
    }
  } catch (err) {
    console.warn('[Arcrawls Main World] Failed to close local AI session:', err);
  }
}

function handlePageError(event: ErrorEvent): void {
  postBridgeMessage({ type: 'PET_PAGE_ERROR', message: event.message });
}

function handleUnhandledRejection(event: PromiseRejectionEvent): void {
  postBridgeMessage({
    type: 'PET_PAGE_ERROR',
    message: event.reason?.message || 'Unhandled rejection'
  });
}

function shutdownBridge(): void {
  if (!bridgeActive) return;
  bridgeActive = false;

  window.removeEventListener('error', handlePageError);
  window.removeEventListener('unhandledrejection', handleUnhandledRejection);
  window.removeEventListener('message', handleMessage);

  for (const session of activeSessions) {
    activeSessions.delete(session);
    void closeSession(session);
  }
}

async function handleMessage(event: MessageEvent): Promise<void> {
  if (event.source !== window || !event.data || event.data.token !== BRIDGE_TOKEN) return;

  if (event.data.type === 'PET_BRIDGE_SHUTDOWN') {
    shutdownBridge();
    return;
  }

  if (!bridgeActive) return;

  if (event.data.type === 'PET_AI_AVAILABILITY_CHECK_REQUEST') {
    const lm = (globalThis as any).ai?.languageModel || (globalThis as any).LanguageModel || (window as any).ai?.languageModel || (window as any).LanguageModel;
    let availability = 'unavailable';

    if (lm) {
      try {
        if (typeof lm.availability === 'function') {
          availability = await lm.availability();
        } else if (typeof lm.capabilities === 'function') {
          const caps = await lm.capabilities({ expectedOutputs: [{ type: 'text', languages: ['en'] }] });
          availability = caps.available;
        }
      } catch (e) {
        console.error('[Arcrawls Local AI] Availability check failed:', e);
      }
    }

    if (!bridgeActive) return;

    postBridgeMessage({
      type: 'PET_AI_AVAILABILITY_CHECK_RESPONSE',
      id: event.data.id,
      availability
    });
    return;
  }

  if (event.data.type !== 'PET_AI_PROMPT_REQUEST') return;

  const { id, systemPrompt, prompt } = event.data;
  const lm = (globalThis as any).ai?.languageModel || (globalThis as any).LanguageModel || (window as any).ai?.languageModel || (window as any).LanguageModel;

  if (!lm) {
    postBridgeMessage({
      type: 'PET_AI_PROMPT_RESPONSE',
      id,
      error: 'built-in Prompt API (LanguageModel) is not defined in this context'
    });
    return;
  }

  let session: any = null;

  try {
    let availability = 'unavailable';
    if (typeof lm.availability === 'function') {
      availability = await lm.availability();
    } else if (typeof lm.capabilities === 'function') {
      const caps = await lm.capabilities({ expectedOutputs: [{ type: 'text', languages: ['en'] }] });
      availability = caps.available;
    }

    if (!bridgeActive) return;

    if (availability !== 'available' && availability !== 'downloadable' && availability !== 'downloading') {
      postBridgeMessage({
        type: 'PET_AI_PROMPT_RESPONSE',
        id,
        error: 'Gemini Nano model is not ready: ' + availability
      });
      return;
    }

    const createOptions: any = {
      expectedOutputs: [{ type: 'text', languages: ['en'] }]
    };

    if (systemPrompt) {
      createOptions.systemPrompt = systemPrompt;
      createOptions.initialPrompts = [{ role: 'system', content: systemPrompt }];
    }

    console.log('[Arcrawls AI] Executing local Gemini Nano inference (MAIN_WORLD)...');
    session = await lm.create(createOptions);

    if (!bridgeActive) {
      await closeSession(session);
      session = null;
      return;
    }

    activeSessions.add(session);

    const resultText = await session.prompt(prompt);

    if (!bridgeActive) return;

    postBridgeMessage({
      type: 'PET_AI_PROMPT_RESPONSE',
      id,
      resultText
    });

  } catch (error: any) {
    if (!bridgeActive) return;

    postBridgeMessage({
      type: 'PET_AI_PROMPT_RESPONSE',
      id,
      error: error?.message || String(error)
    });
  } finally {
    if (session) {
      activeSessions.delete(session);
      await closeSession(session);
    }
  }
}

window.addEventListener('error', handlePageError);
window.addEventListener('unhandledrejection', handleUnhandledRejection);
window.addEventListener('message', handleMessage);
})();