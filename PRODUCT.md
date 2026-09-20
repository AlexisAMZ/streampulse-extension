# Product

<!-- impeccable:product-schema 1 -->

> Record written on 2026-09-13 without an interview: the user delegated the redesign ("fais le design comme tu le sens, je te fais confiance"). Facts come from the repository (README.md, CHROMEWEBSTORE.md, manifest.json, source). Lines marked *(inferred)* are assumptions to confirm or correct.

## Platform

web

## Users

- Viewers of Twitch, Kick and YouTube who watch lives in a desktop Chromium browser (Chrome, Edge, Brave, Opera, Vivaldi).
- They follow a list of streamers they add by hand (handle or channel URL). No account and no import of existing follows.
- Typical scene *(inferred)*: in the evening at a desk, a Twitch or Kick tab already open. They click the toolbar icon for a two-second check of who is live, then jump into a stream. The other key moment is a desktop notification that a streamer just went live.
- A significant share follows many channels across both platforms *(inferred from sort, filters and drag reordering)*.
- Primary language is French. The interface ships in 15 languages (EN, ES, PT-BR, DE, IT, NL, PL, RU, SV, CS, ID, JA, KO…).

## Product Purpose

StreamPulse tells a viewer who is live right now among the streamers they follow, on Twitch, Kick and YouTube, from one toolbar popup. It also takes care of the repetitive chores of watching: claiming channel points, Drops and Moments, cancelling raids, keeping the player running.

Success means the viewer never misses a live they care about, and never has to click a bonus chest again.

## Positioning

- One unified popup for Twitch, Kick and YouTube together. (YouTube is alerts + watch time only: no channel points, Drops or injected player features.)
- No account, no ads, no trackers. Streamers, settings and watch time live on the device.
- It complements chat and emote extensions (BetterTTV, FrankerFaceZ, 7TV) and does not replace them.

## Operating Context

- **Toolbar popup**: capped by Chrome at 800×600 CSS px. Two tabs: Streamers (live dashboard, add bar, sort, platform filter) and Settings.
- **Pages injected into twitch.tv**: topbar button and dropdown panel, hover stream previews, predictions widget, community chat badge, "Add to StreamPulse" button.
- **Pages injected into kick.com**: player enhancer, points counter, chat filter.
- **Extension pages**: onboarding (opened at install), changelog (opened after updates), recap generator (exports a 16:9 or 9:16 image of watch time).
- **System surfaces**: Chrome desktop notifications (live start, category or title change, optional sound) and the toolbar badge.

## Capabilities and Constraints

- **Platform**: Manifest V3 extension, no remote code. Plain HTML/CSS/ES modules with no framework and no build step for the UI. The zip is packaged by `scripts/build-zip.mjs`.
- **Strings**: every UI string goes through `i18n/translations.js` (`data-i18n` attributes and `t()`). Layouts must survive long German or Russian strings.
- **Injected UI**: it lives inside Twitch's page, next to Twitch's own dark and light themes. It must not break or visually fight the host page.
- **Performance**: content scripts run on every Twitch page. The popup opens often and must paint instantly.
- **Data**: the community badge sends a hashed Twitch username to streampulse.fr at most once a day. That is the only network data the extension sends about the user.
- **Terminology**: Streamers, Live / En direct, Points de chaîne, Drops, Moments, Raids, Récap, Temps de visionnage.
- **Sibling projects**: a Firefox port (`../StreampulseFirefox`) and the website (`../StreampulseSite`) exist. Cross-project consistency is an open decision.
- **Open decision**: tutoiement vs vouvoiement in French copy (both are currently mixed).

## Brand Commitments

- **Name and mark**: the name StreamPulse and the logo mark (`images/photos/logosp.png`, store icons in `images/photos/` and `images/promo/`) are kept.
- **Platform colors**: Twitch purple `#9146FF`, Kick green `#53FC18` and YouTube red `#FF0000` belong to those platforms. They identify a streamer's platform and are not StreamPulse's own identity *(inferred from the audit's recommendation)*.
- **Developer and support**: made by AlexisAMZ, solo developer. The project is free and supported by optional donations (Revolut, PayPal).

## Evidence on Hand

- Store listing copy in 4 languages: `CHROMEWEBSTORE.md`.
- Chrome Web Store screenshots: `images/cws_screenshots/`.
- Synthetic demo data for screenshots: `scripts/store-assets/demo-data.mjs`. It must stay labeled as demo data.
- No user counts, ratings or testimonials are recorded in the repo. Never invent them.

## Product Principles

1. **One glance answers "who is live?"** Everything else in the popup is secondary to that answer.
2. **Automation is quiet and accountable.** It works in the background, reports what it did (event log, points counted) and never surprises.
3. **A guest in the platform's house.** Injected UI respects Twitch and Kick conventions and themes. (Injected UI exists on Twitch and Kick only.)
4. **Local and private by default.** No account, and data stays on the device unless the user opts in.
5. **Twitch, Kick and YouTube are equal citizens.** Neither platform's identity becomes the product's identity.

## Accessibility & Inclusion

- **Target** *(inferred)*: WCAG 2.2 AA for extension pages and injected UI. That covers contrast, keyboard operation, visible focus, status messages announced to screen readers, and reduced motion.
- **Localization**: 15 languages, so there are no hard-coded strings and layouts must tolerate text expansion.
