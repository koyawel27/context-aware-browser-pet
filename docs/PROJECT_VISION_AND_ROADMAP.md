# Project Vision and Customization Roadmap

_Status: working source of truth for the personal noncommercial fork_  
_Last reviewed: 2026-09-05_  
_Current upstream-derived development identity: Arcrawls_

## Purpose of this document

This document explains what this fork is intended to become, which architectural principles guide decisions, what has already been completed, what is next, and which ideas remain investigations rather than commitments.

It is written so that a future reviewer, contributor, or AI coding/review agent can understand the project direction without having to infer intent from Git history alone.

The goal is not to preserve upstream Arcrawls unchanged. The goal is to evolve the fork into an independent-feeling, privacy-conscious browser companion with its own mascot, UX, technical choices, and study/development feature direction while preserving the applicable upstream license and attribution obligations.

---

## Status labels

Roadmap items use the following meanings:

- **DONE** — implemented, verified, and merged.
- **APPROVED** — agreed project direction, but not necessarily implemented yet.
- **INVESTIGATE** — requires code audit, benchmarking, compatibility testing, or design comparison before a decision is made.
- **DEFERRED** — intentionally postponed; not abandoned.
- **OUT OF SCOPE** — not part of the intended product direction unless the owner explicitly reopens the decision.

These labels matter. An investigation item must not be treated as an approved architecture decision.

---

# 1. Project Vision and End Goal

**Status: APPROVED**

The fork should become a combination of:

1. a **privacy-first browser pet/companion**, and
2. a **lightweight study and developer companion**.

The project should remain recognizable as a browser companion rather than turning into a full productivity platform, IDE, LMS, autonomous browsing agent, or cloud AI assistant.

The companion should be useful and enjoyable even when all AI features are disabled. AI is an enhancement layer, not the foundation required for the product to function.

### Core product principles

- Local-first where practical.
- Explicit user control over monitoring, site access, AI, and stored data.
- Privacy-safe defaults and fail-closed behavior where privacy state is uncertain.
- No unnecessary telemetry or server dependence.
- No requirement for AI to use the core companion.
- Brave/Chromium is the primary browser target; Firefox compatibility should be preserved where practical.
- Prefer simple, understandable architecture over unnecessary sophistication.
- Adopt upstream improvements selectively rather than automatically.
- Build an original mascot and independent visual identity later.
- Keep the project maintainable by a small owner/developer workflow.
- Preserve the PolyForm Noncommercial license obligations and applicable upstream attribution.

### Product identity in one sentence

> A privacy-conscious browser companion that remains fun as a virtual pet while becoming genuinely useful for studying, focused work, coding, debugging, and everyday browsing.

---

# 2. Privacy and Trust Foundation

**Status: largely DONE; future hardening remains APPROVED**

Privacy is intended to be a defining characteristic of the fork rather than a documentation-only promise.

The current fork already establishes the following major privacy behavior:

- Explicit privacy consent is required before the normal runtime starts.
- Consent failure/read errors fail closed.
- Sensitive domains, routes, and forms are detected by a dedicated privacy policy.
- Protected pages do not run the normal companion runtime.
- A page that becomes protected after normal runtime initialization is torn down and enters a permanent privacy lock for that document lifetime.
- A locked document remains locked even if a same-document SPA transition later appears safe.
- A fresh safe document after reload/full navigation may initialize normally again.
- User-blocked sites are respected separately from automatically detected sensitive pages.
- Protected-page companion behavior is isolated from the normal runtime.
- The privacy companion reaction does not use AI, chat, speech, page-text analysis, personality, movement engine, history, or the normal main-world bridge.
- Background page-derived processing requires a confirmed normal privacy state and otherwise fails closed.

### Privacy design rule

> Broad host access must never be interpreted as permission to process everything. Runtime privacy state, explicit consent, user exclusions, and sensitive-page boundaries control what the extension is allowed to do.

### Future privacy hardening

**APPROVED / INVESTIGATE**

- Review all locally stored history/personality/activity data, retention duration, and deletion controls.
- Make AI-context use understandable to the user: title-only, summary, selected text, page content, etc.
- Consider user-facing pause controls such as “pause on this site” or “pause everywhere temporarily.”
- Expand sensitive-site rules only when justified by real testing; avoid an unmaintainable blacklist.
- Prefer activity-level memory over persistent content-level memory.

### Memory principle

> Track activity by default; understand or retain page content only when the user explicitly asks or enables a clearly explained feature.

---

# 3. Permissions, Host Access, and External Connections

**Status: NEXT IMPLEMENTATION PHASE — INVESTIGATE first, then change only with evidence**

The next roadmap item is a complete audit of the browser powers and network destinations requested by the fork.

The current manifest includes permissions such as:

- `storage`
- `webNavigation`
- `webRequest`
- `offscreen`
- `alarms`
- broad host access through `<all_urls>`

The current direction is not “remove every broad permission.” The goal is to justify, narrow, optionalize, or remove permissions based on actual feature value and privacy/security requirements.

### Preliminary direction

- **`storage` — likely KEEP.** Required for settings, consent, shared pet state, and local companion state.
- **`webNavigation` — likely KEEP.** It now supports the sensitive-page privacy lifecycle and SPA navigation state resets.
- **`webRequest` — AUDIT CLOSELY.** Its present value appears to be mainly top-level HTTP-error reactions. The feature may not justify the permission if that is its only meaningful use.
- **`offscreen` — KEEP FOR NOW, RE-EVALUATE DURING AI/PERFORMANCE WORK.** Current local AI and some centralized audio behavior depend on it.
- **`alarms` — likely KEEP, review cadence.** Current pet/personality decay uses periodic alarms.
- **`<all_urls>` — AUDIT/NARROW rather than blindly remove.** An always-present browser companion fundamentally needs broad page availability, but the exact host patterns and runtime behavior should be made as precise as practical.

### Host-access questions to investigate

- Can `<all_urls>` be narrowed to normal `http://*/*` and `https://*/*` access without breaking required behavior?
- Which web-accessible resources truly need broad exposure?
- Could an optional restricted/site-approved mode be offered later without making the normal experience confusing?
- Does every content script or main-world resource need to exist on every eligible page?

### External-connection audit

This phase also covers non-permission trust surfaces, including:

- Hugging Face model-download hosts used by current optional AI.
- Any upstream Arcrawls website URLs still referenced by the fork, including uninstall/feedback destinations.
- Any future localhost providers such as Ollama.

### Guiding rule

> Needed for core behavior or privacy/security: justify and keep. Needed only for an optional feature: consider optionalizing. Needed only for minor novelty: challenge it. Unused: remove it.

---

# 4. AI Architecture and Performance

**Status: APPROVED direction; detailed implementation remains INVESTIGATE**

The current Arcrawls AI stack is not a single “brain.” It combines normal rules, local DistilBERT sentiment classification, and browser-provided Gemini Nano generative capabilities when available.

The fork should redesign this layer around a stronger principle:

> Use the smallest intelligence appropriate for the task.

### Intended intelligence hierarchy

1. **Deterministic rules/heuristics** for simple behavior and obvious page categories.
2. **A tiny/lightweight model only where classification provides meaningful value.**
3. **Generative AI only for tasks that genuinely benefit from generation, preferably on demand.**

The core companion must remain fully functional if all ML/generative AI paths are unavailable, disabled, unsupported, or broken.

### AI should be useful, not decorative-only

Potential high-value AI uses for this fork include:

- Better study/coding/debugging intent understanding.
- User-triggered page summarization.
- Explain selected text or documentation.
- Explain an error or code context.
- Page-aware companion chat.
- Session or daily reflections.
- Contextual companion reactions when generation is available.

AI should not be retained merely so the pet can choose a slightly better facial expression.

### Performance is part of the model-selection criteria

Any future model/provider must be evaluated on more than answer quality:

- Output quality/usefulness.
- RAM usage.
- CPU usage.
- GPU usage.
- Idle memory footprint.
- Browser responsiveness.
- Startup cost.
- Inference latency.
- Download size.
- Installed/bundled size.
- Battery impact where measurable.
- Brave/Chromium compatibility.
- Firefox implications where relevant.
- Privacy characteristics and data path.

### Current DistilBERT/ONNX stack

**INVESTIGATE**

Do not assume the current DistilBERT pipeline must remain or must be removed.

Questions for benchmarking/review:

- Does current DistilBERT materially improve the companion over rules alone?
- Can a smaller or quantized classifier provide similar value?
- Would TinyBERT/MiniLM-class models or embedding-based classification provide better value per resource?
- Is the bundled ONNX runtime justified by the capability it enables?
- Can sentiment classification be simplified or removed entirely?

### Browser-provided AI

**INVESTIGATE / preferred when practical, never required**

Browser-managed AI such as Gemini Nano is attractive because the extension does not need to ship a full generative model itself. However, support varies by browser and hardware, and Brave compatibility must be verified rather than assumed.

Expected behavior:

- Browser AI available → optional enhanced features may use it.
- Browser AI unavailable → the companion still works normally.

### Optional local desktop provider

**INVESTIGATE — not approved as a required dependency**

A localhost provider such as Ollama may allow the extension to remain lighter while advanced users run stronger local models outside the browser process.

Any such design must address:

- explicit opt-in;
- localhost permission scope;
- authentication/connection safety;
- bounded context sharing;
- what page content may leave the extension process;
- graceful behavior when the local provider is not running.

### On-demand generative model lifecycle

**APPROVED principle**

Heavy generative inference should not remain active merely because the browser is open.

Preferred behavior where technically possible:

- no generative task → no unnecessary heavyweight model/session;
- user requests AI → initialize provider/session;
- task completes;
- after a reasonable idle period → release resources where the platform/provider allows it.

### AI architecture principle for reviewers

> Do not optimize for the smartest possible model. Optimize for the best intelligence-per-resource for a browser companion.

---

# 5. Lite vs AI Build Strategy

**Status: APPROVED provisional strategy; final packaging decision depends on AI benchmark**

Do not create two manually maintained forks or duplicate source trees.

The preferred architecture is one shared codebase with optional AI boundaries.

### Current provisional decision

> Prefer a single modular extension unless measured AI dependencies make the non-AI experience unnecessarily heavy.

If unavoidable bundled AI runtime remains large, support Lite and AI build artifacts generated from the same codebase rather than maintaining separate projects.

### Decision path

1. Complete the AI/performance audit.
2. Measure the unavoidable AI runtime/package cost.
3. Determine whether the heavy runtime can be avoided through browser-managed AI or an optional external local provider.
4. If the base extension can remain lightweight, keep one modular build.
5. If large AI runtime must still ship with the extension, consider generated Lite and AI editions.

### Product rule

The Lite/non-AI experience must not be a crippled version.

It should still include the complete core companion:

- privacy behavior;
- mascot/personality;
- movement;
- focus/study/dev core behavior;
- normal context rules;
- progression where retained;
- user controls.

AI adds deeper interpretation and generation, not basic viability.

---

# 6. Original Mascot and Brand Identity

**Status: DEFERRED implementation; creative exploration may continue separately**

The fork should eventually replace the upstream-derived mascot identity with an original companion designed specifically for this project.

The current owner is using Fable for mascot concept generation. That creative work can continue without requiring immediate code integration.

### Mascot strategy

Separate:

- **art creation**, and
- **runtime integration**.

Before production replacement, define a canonical mascot-state inventory so artwork is generated against actual application needs.

Likely state categories include:

- idle/normal;
- happy;
- sad/concerned;
- coding;
- debugging/thinking;
- reading/studying;
- sleeping/resting;
- celebration;
- eating/interaction states where retained;
- movement-specific states;
- privacy/look-away/leave behavior;
- any final personality-specific or focus states justified by the runtime.

### Identity direction

The exact art design remains flexible until the final visual reference is chosen. The earlier concept direction favors a playful, curious, slightly mischievous monkey-based companion with a retro/pixel-inspired feel and study/dev-friendly expressive states, but the roadmap should not over-constrain the final art if a better concept emerges.

### Asset architecture goal

**INVESTIGATE before implementation**

Avoid hard-coding mascot filenames throughout the application. Prefer an abstraction such as semantic mascot states mapped to concrete assets so future revisions are easier.

### Naming strategy

**APPROVED**

Keep the Arcrawls name as the temporary development identity. Do the final project-wide rename only after the mascot and core architecture are stable.

This avoids repeated noisy renames across code, localization, documentation, icons, screenshots, and UI.

### Attribution/licensing

Creating an original mascot does not remove the upstream software license obligations.

Mascot-specific `clawd-pet` attribution should only be reconsidered after an audit proves that no derivative mascot assets remain in the final product.

### Guiding principle

> The goal is not to make a skin for Arcrawls. The goal is to create a recognizable companion identity that belongs to this fork.

---

# 7. Companion UX, Personality, and Accessibility

**Status: APPROVED direction**

The companion should feel useful, calm, expressive, and respectful of user attention.

A browser pet can become annoying if it competes constantly with the page. This fork should intentionally manage interruption frequency.

### Behavioral contexts

The experience should distinguish, where practical:

- casual browsing;
- focused work;
- studying/reading;
- coding/development;
- debugging;
- sensitive/protected pages.

### Attention rule

> The companion should earn the right to interrupt the user.

Expected behavior examples:

- Active reading/typing → reduce unnecessary bubbles and obstruction.
- Focus sessions → calmer behavior and fewer interruptions.
- Study/dev context → relevant poses and optional useful actions.
- Sensitive pages → privacy behavior only.

### Personality should influence more than text

Personality may eventually affect:

- dialogue tone;
- reaction frequency;
- movement energy;
- idle behavior;
- encouragement style;
- celebration style;
- study/focus prompts.

Avoid making personality nothing more than different hard-coded sentence pools.

### Settings and information architecture

Future settings should be organized around user goals rather than implementation details.

Possible grouping:

- **Companion** — mascot, appearance, movement, personality.
- **Focus & Study** — quiet behavior, schedules, focus settings, study assistance.
- **Intelligence** — AI enablement, provider/model status, context permissions.
- **Privacy** — blocked sites, site access, stored data, data clearing.
- **Performance** — resource profile and advanced controls.

The exact UI remains a later design decision.

### Privacy/AI state should be understandable

Users should be able to understand states such as:

- companion active;
- companion paused on this site;
- site blocked;
- protected page;
- AI disabled;
- local AI available/unavailable.

Do not expose internal jargon such as service-worker privacy state unless in developer diagnostics.

### Accessibility

Treat accessibility as a first-class requirement, including:

- keyboard navigation;
- focus indicators;
- screen-reader labels;
- contrast;
- scalable UI;
- reduced-motion support;
- mascot obstruction behavior;
- reduced animation intensity when requested by OS/browser preference.

---

# 8. Study, Focus, and Developer Companion Features

**Status: APPROVED product direction; implementation sequencing remains future work**

This is the main differentiation layer beyond privacy and branding.

The project should support four broad usage modes/contexts:

- **Casual** — normal virtual-pet browsing behavior.
- **Focus** — quiet companion behavior and session support.
- **Study** — reading/research assistance and study-session context.
- **Dev** — coding/documentation/debugging companion behavior.

The companion remains a browser companion first. It should not become a full LMS, IDE, note-taking suite, or project-management system.

## Focus companion

Potential non-AI features:

- focus/Pomodoro-style sessions;
- quiet companion mode during focus;
- break reminders;
- subtle completion celebration;
- optional focus streaks/progression;
- reduced interruption during active work.

Product principle:

> The pet should benefit from the user's productivity, not compete with it.

## Study companion

Potential non-AI capabilities:

- recognize broad study contexts such as documentation, long-form reading, research pages, educational video, and explicitly marked study material;
- study-session timer/history;
- quiet reading behavior;
- local activity-level study statistics;
- optional lightweight session notes if they remain simple and local.

Optional user-triggered AI capabilities:

- summarize this page;
- explain selected text;
- identify main ideas;
- ask the companion about the current page;
- generate a study-session recap.

## Developer companion

Potential non-AI capabilities:

- recognize GitHub, documentation, localhost development pages, API references, error pages, and similar contexts;
- coding-session timing;
- debugging/thinking states;
- quieter behavior during active typing;
- dev milestones or session history where useful.

Optional user-triggered AI capabilities:

- explain this error;
- explain a selected code snippet;
- summarize documentation;
- explain an API;
- help understand a GitHub issue/page.

### Context actions

**APPROVED direction; exact UI TBD**

Prefer small contextual actions over forcing every AI interaction through a giant chat interface.

Examples:

Study/documentation page:

- Summarize page
- Explain selection
- Ask about page
- Start study session

Coding/error page:

- Explain error
- Summarize docs
- Ask about page
- Start focus session

### Progression and healthy behavior

If pet progression remains, avoid rewarding raw browsing volume alone.

Prefer useful/healthy events such as:

- completed focus sessions;
- study consistency;
- coding sessions;
- healthy breaks;
- pet interactions;
- learning milestones.

Avoid punitive or manipulative behavior when the user misses a day or chooses not to be productive.

### Local session memory

Prefer activity memory such as:

- “studied for 70 minutes”;
- “completed two focus sessions”;
- “spent time in coding/documentation categories.”

Persistent content memory such as detailed records of what exact pages/topics were read requires stronger justification and explicit user control.

### Out of scope

Unless explicitly reopened, do not turn this project into:

- an autonomous web-browsing agent;
- a full IDE;
- a complete LMS;
- a cloud productivity platform;
- an always-running LLM;
- a full browser-history surveillance system;
- an assistant that reads passwords, private forms, or sensitive messages;
- a system that continuously uploads browsing context to external servers.

### Guiding rules

> The pet should support what the user is already doing, not create another workflow the user has to manage.

> Track activity by default; understand content only when the user explicitly asks.

---

# 9. Maintainability and Upstream Integration

**Status: APPROVED**

The fork should be maintained as an independent project while still benefiting selectively from upstream Arcrawls.

Upstream should be treated as a source of useful fixes and ideas, not as an authority over the fork's architecture.

### Upstream policy

Maintain remotes conceptually as:

- `origin` → this fork;
- `upstream` → original Arcrawls.

Do not blindly merge upstream releases into `main` once the fork has materially diverged.

For meaningful upstream changes:

1. compare upstream against the fork;
2. classify the change;
3. determine whether it aligns with this roadmap;
4. adapt, cherry-pick, or reimplement as appropriate;
5. reject changes that conflict with intentional fork decisions.

### Highest-priority upstream changes

Continue monitoring for:

- security fixes;
- browser/API compatibility fixes;
- Manifest V3 changes;
- dependency vulnerabilities;
- proven bug fixes;
- performance improvements that fit the fork.

### Modular customization

Gradually keep project concerns separated so that privacy, AI, mascot, study, and platform-specific behavior do not become tightly coupled.

Exact folder/module boundaries may evolve; avoid refactoring solely for aesthetic organization without a practical maintenance benefit.

### Decision documentation

Important architectural differences from upstream should be recorded so future work does not accidentally undo them.

Examples:

- sensitive-document lock lifecycle;
- why AI remains optional;
- permission decisions;
- mascot asset abstraction;
- intentionally rejected upstream behavior.

A lightweight decision-record approach is sufficient; do not introduce heavy enterprise process.

### Git/implementation workflow

Continue the current small-phase discipline:

`inspect → focused branch → implement → verify → review diff → PR → CI → merge → cleanup`

Do not mix unrelated privacy, AI, mascot, permission, UI, or branding changes into one large phase unless there is a strong technical reason.

### Browser support

- Brave/Chromium: primary target.
- Firefox: preserve where practical.

Do not degrade the primary architecture solely to force parity, but also avoid unnecessary Chromium-only coupling.

### Guiding rule

> Upstream changes must adapt to our architecture; our architecture should not continually bend back toward upstream.

---

# 10. Documentation, Release Identity, and Long-Term Project Shape

**Status: APPROVED**

The repository should clearly explain what the fork is, why it differs from upstream, and where it is going.

Future contributors and AI reviewers should not have to reverse-engineer project intent from implementation details or Git history.

### Planned documentation shape

Possible future documents include:

- `docs/PROJECT_VISION_AND_ROADMAP.md` — this source of truth.
- `docs/ARCHITECTURE.md` — current technical component boundaries and runtime flow.
- `docs/PRIVACY_MODEL.md` — consent, sensitive-page lifecycle, protected-page rules, and data boundaries.
- `docs/AI_ARCHITECTURE.md` — provider design, model benchmark results, resource behavior, and context permissions.
- `docs/UPSTREAM_SYNC.md` — selective upstream-review process.
- lightweight `docs/decisions/` records for major architectural decisions if useful.

Do not create documentation files merely to have more documentation. Add them when they reduce ambiguity or protect an important decision.

### Development identity and final branding

Keep the Arcrawls name during active architecture/customization work.

After the original mascot and major architecture are stable, perform one deliberate branding pass covering:

- final project name;
- mascot name;
- extension icon;
- wordmark/color system;
- onboarding;
- popup/options UI identity;
- README;
- screenshots/GIFs;
- documentation;
- localization strings;
- extension metadata.

### README direction

The final README should explain:

- what the fork is;
- why it exists;
- privacy philosophy;
- study/dev companion direction;
- AI architecture and what is optional;
- which data stays local;
- supported browsers;
- how it differs from upstream;
- license and attribution obligations.

### Release/versioning

The fork should eventually use an independent version/release identity rather than implicitly presenting itself as a direct continuation of upstream release numbering. The exact versioning strategy remains a later decision.

### Guiding rule

> Future contributors should not need to reverse-engineer our intentions from Git history.

---

# Completed Foundations

The following major customization work is already complete and should be treated as established foundation rather than future roadmap speculation.

## Phase 1 — Privacy consent foundation

**DONE**

- Explicit consent required before normal runtime activation.
- Settings alone do not imply consent.
- Main-world bridge, mascot runtime, background page monitoring, personality/history/decay, and related activity remain inactive before consent.
- Consent removal tears down active behavior.
- Consent read failure fails closed.
- E2E coverage verifies pre-consent absence and post-consent activation.

## Phase 2 — CI foundation

**DONE**

- GitHub Actions workflow for type-checking, unit tests, build, and Playwright E2E.
- CI remains advisory rather than branch-protection-enforced at this stage.

## Phase 3A — Sensitive-site privacy enforcement

**DONE**

- Sensitive domain/route/form detection policy.
- Runtime teardown hardening.
- Main-world bridge shutdown.
- Permanent privacy lock after an initialized document becomes protected.
- Background privacy-state boundary with unknown/normal/protected handling.
- Sensitive lifecycle E2E coverage.
- Manual Brave verification completed.

### Locked lifecycle decision — do not casually reinterpret

- Initial protected document: normal runtime never starts; document is not permanently locked solely because it began protected.
- If that same initial-protected document becomes safe before normal runtime ever existed, normal runtime may initialize.
- If normal runtime already existed and the document later becomes protected, normal runtime is torn down and the document enters a permanent one-way privacy lock for that document lifetime.
- A locked document remains locked across later safe SPA transitions.
- A fresh safe full navigation/reload may initialize normally.

This behavior is deliberate because the permanent lock is primarily required after tearing down an already-active runtime with asynchronous work that could otherwise become stale.

## Phase 3B — Privacy companion reaction

**DONE**

- Independent one-shot privacy companion reaction for `sensitive-domain`, `sensitive-route`, and `sensitive-form` reasons.
- Fixed message: `I'm paused for this page.`
- No reaction for `user-blocked`, unsupported schemes, invalid URLs, or normal state.
- Runs only after Phase 3A protection/teardown requirements are satisfied.
- No AI, chat, voice, page text, personality, history, movement engine, or normal main-world bridge.
- Explicit user blocking immediately removes a currently visible privacy reaction while preserving the document lock.
- Playwright fixture/install-readiness and teardown reliability hardened.
- Automated and manual Brave verification completed.

---

# Current Roadmap Order

The default sequence is:

1. **DONE** — Privacy consent foundation.
2. **DONE** — CI foundation.
3. **DONE** — Sensitive-site privacy enforcement.
4. **DONE** — Privacy companion reaction.
5. **NEXT** — Permissions, Host Access, and External Connections audit.
6. **INVESTIGATE** — AI architecture and performance benchmark/redesign.
7. **DECIDE AFTER BENCHMARK** — one modular build vs generated Lite/AI build artifacts.
8. **DEFERRED / creative work may continue** — original mascot integration and eventual full brand identity.
9. **APPROVED FUTURE WORK** — companion UX, personality, accessibility, and attention management.
10. **APPROVED FUTURE WORK** — study, focus, and developer companion features.
11. **ONGOING** — maintainability and selective upstream integration.
12. **LATER** — final release identity, README/onboarding refresh, and independent versioning strategy.

The order may change when risk or evidence justifies it, but architectural/privacy work should generally precede cosmetic rebranding and large feature expansion.

---

# Questions intentionally left open for future review

These are not decided yet and should be treated as investigation prompts for Astra or another reviewer:

1. Can `webRequest` be removed without losing enough value to matter?
2. Can `<all_urls>` be narrowed while preserving the always-present companion experience?
3. Which external/upstream URLs should be removed or replaced in this personal fork?
4. Does current DistilBERT provide enough quality improvement to justify ONNX/runtime/model cost?
5. Which tiny classifier or embedding model gives the best useful-context detection per MB/RAM/latency?
6. How reliably does browser-provided generative AI work in current Brave/Chromium environments?
7. Would an optional localhost provider such as Ollama improve the architecture without creating unacceptable permission/security complexity?
8. Can generative providers be initialized and released on demand in a way that meaningfully lowers idle memory?
9. Does the final AI architecture still require separate Lite/AI builds, or can one modular package remain genuinely lightweight?
10. What semantic mascot-state abstraction best reduces future asset coupling without overengineering the UI/runtime?
11. Which existing upstream features should be simplified or removed because they do not support the privacy-first + study/dev direction?
12. What exact user-facing controls should govern page content use for AI summarization/chat/explanation?

---

# Non-negotiable review constraints

Future reviewers or coding agents should not silently change the following without explicit owner approval and evidence:

- Do not remove the AI bundle/model path merely because it is large; audit dependencies and alternatives first.
- Do not make AI mandatory for normal companion behavior.
- Do not weaken the sensitive-page privacy lifecycle for convenience.
- Do not turn protected-page reaction behavior into normal runtime behavior.
- Do not add external/cloud AI transmission as a default path.
- Do not add unnecessary permissions simply to simplify implementation.
- Do not blindly merge upstream architectural changes.
- Do not perform a project-wide rename before final mascot/brand identity is stable.
- Do not remove license or attribution material without a specific license/asset audit.
- Do not commercialize or present this derivative project as commercially distributable under the current upstream PolyForm Noncommercial license without resolving rights with the original author.

---

# Target long-term shape

```text
Privacy-first companion core
        |
        +-- lightweight rules/context behavior
        +-- focus/study/dev companion features
        +-- original mascot and personality
        +-- clear privacy/site controls
        +-- accessibility and attention management
        |
        +-- optional intelligence provider layer
                +-- tiny classifier only if justified
                +-- browser-provided local AI when available
                +-- optional external local provider if approved
```

The desired outcome is an independent-feeling fork with its own technical philosophy and identity — not a collection of unrelated patches on top of upstream Arcrawls.
