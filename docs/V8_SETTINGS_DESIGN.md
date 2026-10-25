# G4 / E20 — V8 settings

Status: implemented and locally verified, 25 October 2026. High verification lane.

## Scope and acceptance

One Settings button in connected Market, Research and Learn opens a native modal
over the existing page. Research editors stay mounted. The modal uses V8 tokens,
44px controls, labelled groups, visible focus, bounded scrolling, Escape/Close,
background inertness and focus restoration. Theme choices remain Light/Auto/Dark
and apply immediately through the existing theme API and boot key.
Phone headers use the existing Learn two-row pattern to keep labels intact.

Market defaults use the existing `signal-dashboard-config` key and exact
`{ mode, market, enableSocial }` shape. A shared validated reader catches blocked
storage and malformed values without writing. Explicit Save is the only settings
write. Errors stay visible; corrupt bytes survive until Save. The connected Market
waits for these defaults before mounting its request-owning view. A valid explicit
URL market wins; mode and social come from saved defaults. Defaults apply on the
next Market opening/reload. Reading defaults never synthesizes a URL market;
an explicit page market selection does update the URL. Current Market controls
stay session-only. Legacy consumers show read/write errors from the shared hook.

Guest export and clear move out of the Research Workspace menu into Settings.
Export uses the saved-only helper and warns for in-memory or recoverable drafts,
including when opened from Market/Learn. Clear requires explicit confirmation,
offers export first, and removes only guest research and draft backups through the
existing Web Lock. Successful clear notifies same-tab Research immediately;
existing storage events update other tabs. Pending writes retain the existing
guest identity checks, so cleared data cannot be recreated by an old draft.
Storage failures must preserve data; clear captures affected bytes and rolls back
partial removal if a browser operation fails, reporting any failed restoration.

Owner access remains a link to the existing `/unlock` flow with a safe complete
return path. Research opens it in a new tab to preserve drafts. Settings never
accepts secrets or writes private APIs. Existing owner lock and the Detailed view toggle stay
in Workspace; owner, holdings, Learn and preferences are outside guest clear.

## Non-goals and proof

No scoring, provider, API, schema, dependency, onboarding or legacy-route redesign.
Legacy config consumers reuse the safe read/write boundary and retain explicit
control persistence. Demo pages retain their illustrative behavior.

Proof: lint, production build then typecheck, full harness, independent review,
and fixture browser cases for storage validity/failure, reload/URL precedence and
first request, theme, dirty notes, export, confirmed clear, cross-tab isolation and
unlock return. Inspect light/dark screenshots and focus/overflow at
1280/768/375/320px, plus affected existing Research/Learn flows. Local fixtures
establish UI/storage behavior only, not deployed or live-provider health.
