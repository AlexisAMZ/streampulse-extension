# Hover Previews — Design Spec

- **Date:** 2026-06-01
- **Status:** Approved (design) → ready for implementation plan
- **Feature:** On-page live **hover previews** for Twitch (directory, sidebar, clips, search), inspired by the "Twitch Previews" (TP) extension, rebuilt natively in StreamPulse style.
- **Platform scope (v1):** Twitch only (`www.twitch.tv`, `clips.twitch.tv`). Kick previews and "see your own thumbnail" are out of scope (later rounds).

---

## 1. Goal

When the user hovers a stream/channel/clip card on Twitch, show a floating preview card with the live media, styled like StreamPulse's existing popup preview cards. Two modes: a lightweight **image** mode (default) and a **video** mode (live `player.twitch.tv` iframe).

## 2. Non-goals (v1)

- Kick / YouTube / Facebook previews.
- "See your own live thumbnail" on the Twitch logo.
- Multi-preview (more than one visible at a time).
- Any feature requiring a page-context script injection bridge (not needed here).

## 3. User-facing behavior

### 3.1 Modes
- **Image (default):** Twitch's public live-preview thumbnail in an `<img>`, refreshed every **~3 s** (only while hovered) with a cache-bust query for a pseudo-animated effect. No audio. Reuses SP's preview-card visual language and fallback (avatar + game) exactly.
- **Video (opt-in toggle):** a single `player.twitch.tv` `<iframe>` (live motion, optional audio). At most **one** iframe exists at any time; it is torn down (`src=""`) on hide.

### 3.2 Surfaces (all enabled by default)
- **Directory / browse** grid (categories, browse, home).
- **Left sidebar** followed-channels list.
- **Clips** cards (and `clips.twitch.tv` pages).
- **Search** results (same selectors as directory).

Each surface has its own on/off checkbox.

### 3.3 Card content
- Media (image or iframe).
- Overlay (best-effort, read from the hovered card DOM): stream title, category, viewer count.
- Fallback when the thumbnail fails or data is missing: avatar + game label (reuse SP's `showFallbackPreview` pattern from `js/ui.js`).

### 3.4 Settings (Settings tab, "Previews au survol" group, styled à l'image de SP)
| Setting | Type | Default |
|---|---|---|
| Master enable | toggle | ON |
| Mode | segmented Image/Vidéo | Image |
| Surface: Directory | checkbox | ON |
| Surface: Sidebar | checkbox | ON |
| Surface: Clips | checkbox | ON |
| Surface: Search | checkbox | ON |
| Size | S / M / L | M |
| Audio (video mode) | toggle | OFF (muted) |
| Unmute on hover (video mode) | toggle | OFF |
| Show delay | ms (slider) | 200 |
| Animations | toggle | ON (respects `prefers-reduced-motion`) |

Size presets (16:9): **S** 280×157, **M** 360×202, **L** 440×247.

## 4. Architecture

No build step (extension files load directly; `package.json` is tooling-only). MV3 content scripts are **not** ES modules, so the preview files share the isolated-world global and expose themselves on a single namespace object `window.__SP_PREVIEWS__` (consistent with SP's existing plain-script content scripts). Load order is defined by the manifest.

```
js/previews/
  sources.js        # pure: media URL builders + size presets (no DOM)
  card.js           # the single floating preview card: render/position/show/hide/destroy
  targets-twitch.js # Twitch DOM adapter: per-surface selectors + descriptor extraction
  observer.js       # SPA lifecycle: MutationObserver + event delegation + debounce
js/twitchPreviews.js # entry: reads prefs, wires observer→targets→card, route-guard, teardown
css/previews.css     # card styles, reusing popup.css design tokens (radius/shadow/overlay)
```

### 4.1 Module interfaces

**`sources.js`** → `window.__SP_PREVIEWS__.sources`
- `SIZE_PRESETS: { s:{w,h}, m:{w,h}, l:{w,h} }`
- `twitchPreviewImageUrl(login, width, height, cacheBust)` → `https://static-cdn.jtvnw.net/previews-ttv/live_user_{login}-{width}x{height}.jpg?cb={cacheBust}`
- `twitchPlayerEmbedUrl(login, { muted, parent })` → `https://player.twitch.tv/?channel={login}&parent={parent}&muted={bool}&autoplay=true`
- `clipEmbedUrl(slug, { autoplay, muted, parent })` → `https://clips.twitch.tv/embed?clip={slug}&parent={parent}&autoplay={bool}&muted={bool}`
- Pure, unit-testable. `parent` is the current hostname (`twitch.tv` / `www.twitch.tv` / `clips.twitch.tv`) — **required** by Twitch embeds.

**`card.js`** → `window.__SP_PREVIEWS__.PreviewCard`
- `mount()` — create the single reused node, append to `body`, hidden.
- `show(anchorEl, descriptor, opts)` — `descriptor = { kind:'channel'|'clip', login?, slug?, title?, category?, viewers?, avatarUrl? }`, `opts = { mode, size, audio, unmuteOnHover, animations }`.
- `hide()` — `iframe.src=""`, `display:none`, stop refresh timer (keep node for reuse).
- `destroy()` — remove node + listeners.
- `computePosition(anchorRect, cardSize, viewport)` — **pure** helper (above/below + left/right, clamped to viewport), unit-testable.

**`targets-twitch.js`** → `window.__SP_PREVIEWS__.targets`
- `SELECTORS` — per-surface selector lists with fallbacks.
- `detectSurface(location)` → `'directory'|'following'|'search'|'clips'|null`.
- `findHoverRoot()` → the container to attach delegation to.
- `extractFromAnchor(anchorEl)` → `descriptor | null` (login from `href` pathname; clip slug from `/clip/…` or `clips.twitch.tv/{slug}`; overlay fields best-effort from card DOM).

**`observer.js`** → `window.__SP_PREVIEWS__.observe`
- `observeSpa(onRouteOrDomChange)` — `MutationObserver` on sidebar + content towers + `<title>` (route changes), debounced.
- `attachDelegation(root, { onEnter, onLeave }, { showDelayMs, hideDelayMs })` — one delegated `mouseover`/`mouseout` listener; returns a `detach()` fn.

**`js/twitchPreviews.js`** (entry)
- Read `preferences.previews` from `chrome.storage.local`; subscribe to `chrome.storage.onChanged`.
- If disabled → ensure full teardown. If enabled → `mount()` card, `observeSpa`, `attachDelegation`, gate by surface + route.
- Hide on `mouseout`, route change, and tab `visibilitychange:hidden`.

### 4.2 Data flow
`mouseover` on a matched anchor → `targets.extractFromAnchor` → entry checks surface enabled + route → `card.show(anchor, descriptor, opts)` (image `<img>` or video `<iframe>` per mode) → `computePosition` → on `mouseout` (debounced) → `card.hide()`.

## 5. Manifest changes
Add a content-script entry (new, alongside the existing Twitch entry):
```json
{
  "matches": ["https://www.twitch.tv/*", "https://clips.twitch.tv/*"],
  "all_frames": false,
  "js": [
    "js/previews/sources.js",
    "js/previews/card.js",
    "js/previews/targets-twitch.js",
    "js/previews/observer.js",
    "js/twitchPreviews.js"
  ],
  "css": ["css/previews.css"],
  "run_at": "document_idle"
}
```
- `css` injected via manifest → **no** `web_accessible_resources` needed for the stylesheet.
- `static-cdn.jtvnw.net` images and `player.twitch.tv` / `clips.twitch.tv` iframes are embeds → **no** host_permission required.
- Optional SP logo on the card: use an inline SVG (avoid adding a WAR entry).

## 6. Storage & i18n
- Preferences are **flat keys** inside the existing `betaGeneralPreferences` object in `chrome.storage.local` (StreamPulse convention — same bag as `enableFastForwardButton`, `chatKeywords`, …). Writes go through the background `updatePreferences` message, which validates against an explicit whitelist, so each new key is also declared there:
```js
previewsEnabled: true,            // bool
previewsMode: "image",           // "image" | "video"
previewsSurfaceDirectory: true,  // bool
previewsSurfaceSidebar: true,    // bool
previewsSurfaceClips: true,      // bool
previewsSurfaceSearch: true,     // bool
previewsSize: "m",               // "s" | "m" | "l"
previewsAudio: false,            // bool
previewsShowDelayMs: 200,        // number, clamped 0–2000
previewsAnimations: true,        // bool
```
- The content script reads the whole `betaGeneralPreferences` and maps these into its internal shape; absent keys → defaults (non-destructive).
- i18n: keys added under `popup.settings.*` in `i18n/translations.js` for every shipped locale (fr, en, es, pt-BR).

## 7. Robustness, performance, errors
- **Single reused card node**; **max one iframe**.
- **Event delegation** (one listener on a stable root) → survives Twitch's virtualized lists; no per-card listeners.
- Debounce: show ~200 ms (configurable), hide ~120 ms.
- Route-guard: sidebar previews wherever the sidebar exists; directory previews on browse/following/search; clip previews on clip surfaces; never on the watch-page video itself.
- Thumbnail load error → fallback avatar + game.
- Tolerant selectors with fallbacks; if Twitch's DOM changes, fail to a clean no-op (never throw into the page).
- Full cleanup (listeners, observers, timers, node) when disabled or on teardown.
- Respect `prefers-reduced-motion` and the animations toggle.

## 8. Testing
SP has no test harness yet. Add a light one (devDependencies only — not bundled into the extension):
- **Runner:** vitest + jsdom.
- **Unit tests:**
  - `sources.js` — URL builders (login/slug encoding, `parent`, muted flags, cache-bust), size presets.
  - `card.computePosition` — above/below + left/right selection and viewport clamping across edge cases.
  - `targets.extractFromAnchor` — descriptor extraction from fixture DOM for each surface (directory, sidebar, clip, search).
- **Manual E2E:** verify on real Twitch (directory, sidebar, clips, search) in both modes; verify teardown leaves no orphan iframe.
- Target: 80%+ on the pure modules (`sources`, positioning, extraction). DOM-glue (`observer`, entry) covered by manual E2E.

## 9. Risks / open questions
- **Twitch DOM drift:** selectors may break on Twitch UI changes → centralized in `targets-twitch.js` with fallbacks; degrade to no-op.
- **Unmuted autoplay** (video mode, audio ON): browsers may block until user gesture → audio is best-effort; default OFF/muted.
- **Animated image effect:** `live_user_*.jpg` is a periodically-updated still; "animation" = timed cache-bust refresh, not true motion. True motion requires video mode.
- **Pre-existing secret:** `config.js` ships a hardcoded Twitch `accessToken` exposed via `web_accessible_resources`. Not used by this feature and out of scope here — flagged separately for follow-up.

## 10. Rough milestones
1. `sources.js` + unit tests.
2. `card.js` (render/position/show/hide) + `css/previews.css` (image mode) + positioning tests.
3. `targets-twitch.js` (directory first) + extraction tests.
4. `observer.js` + `js/twitchPreviews.js` entry; wire image mode end-to-end on directory.
5. Add sidebar, clips, search surfaces.
6. Video mode (iframe + audio handling).
7. Settings UI + storage + i18n.
8. Manifest wiring; manual E2E pass; polish.
