/**
 * StreamPulse — Twitch site-wide ad blocker (CSAI + SSAI).
 *
 * Runs in the PAGE main world (manifest `world: "MAIN"`, run_at document_start)
 * so it can hook Twitch's own player without the page CSP blocking it. Twitch
 * fetches its HLS playlist inside the `amazon-ivs-wasmworker`, so we hook both the
 * main-thread fetch/XHR AND wrap that worker (incl. blob: workers) to catch ads.
 *
 *  - CSAI (client-side ad creatives): the edge.ads.twitch.tv request is answered
 *    with an empty "no ads" payload.
 *  - SSAI (server-side stitched ads): the stitched-ad segments are stripped out of
 *    the HLS media playlist so the player runs straight through to live.
 *
 * An "Ad blocked by StreamPulse" banner is shown on the player when an ad is
 * caught. Resilient to other extensions that also override window.Worker (e.g.
 * 7TV) via a getter/setter chain.
 *
 * Toggle: the `adblockEnabled` preference (popup) is mirrored into the kill-switch
 * below by `adblock-bridge.js`; changes apply on the next page load.
 *
 * Kill-switch (manual, if the Twitch player ever breaks): in the page console run
 *   localStorage['sp-adblock-disabled'] = '1'   // then reload
 * Debug logs (off by default): localStorage['sp-adblock-debug'] = '1' (reload),
 * or window.__SP_PREVIEWS_DEBUG__ = true. Inspect window.__SP_ADBLOCK_DIAG__.
 */
(function () {
  "use strict";

  // StreamPulse logo (48px PNG) inlined as a data URI — the MAIN-world
  // script has no chrome.runtime.getURL access.
  var SP_LOGO = "data:image/png;base64,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";

  if (window.__SP_TWITCH_ADBLOCK__) return;
  window.__SP_TWITCH_ADBLOCK__ = true;

  // Kill-switch — set by adblock-bridge.js from the `adblockEnabled` pref (or
  // manually in the console). When disabled, install nothing.
  try {
    if (localStorage.getItem("sp-adblock-disabled") === "1") return;
  } catch (_e) {}

  // Debug logging is OFF by default (production). Enable for support with
  //   localStorage['sp-adblock-debug'] = '1'   (then reload)
  // or window.__SP_PREVIEWS_DEBUG__ = true.
  var DEBUG = false;
  try {
    DEBUG =
      localStorage.getItem("sp-adblock-debug") === "1" ||
      window.__SP_PREVIEWS_DEBUG__ === true;
  } catch (_e) {}

  // Live diagnostics (window.__SP_ADBLOCK_DIAG__): action counters are always kept
  // (cheap, useful for support); the URL sample arrays only fill in debug mode and
  // are capped to avoid unbounded growth.
  window.__SP_ADBLOCK_DIAG__ = {
    seen: [],
    wrapped: [],
    seenCount: 0,
    wrappedCount: 0,
    workerAd: 0,
    stripped: 0,
    missed: 0,
    debug: DEBUG,
  };
  var DIAG_CAP = 50;
  function diagPush(key, val) {
    try {
      var d = window.__SP_ADBLOCK_DIAG__;
      d[key + "Count"] = (d[key + "Count"] || 0) + 1; // always-on counter
      if (DEBUG) {
        var arr = d[key];
        if (arr && arr.length < DIAG_CAP) arr.push(val); // sample only in debug
      }
    } catch (_e) {}
  }

  function dbg() {
    if (!DEBUG) return;
    try {
      if (window.console) {
        console.log.apply(console, ["[SP adblock]"].concat([].slice.call(arguments)));
      }
    } catch (_e) {}
  }

  // Self-contained network hooks — called directly on the main thread AND
  // stringified into the IVS worker (so it must not reference outer scope).
  function applyHooks(scope, signal) {
    var AD = ["twitch-stitched-ad", "X-TV-TWITCH-AD"];
    function hasAd(t) {
      if (typeof t !== "string") return false;
      for (var i = 0; i < AD.length; i++) if (t.indexOf(AD[i]) !== -1) return true;
      return false;
    }
    function isPlaylist(u) {
      return /usher\.ttvnw\.net|\.m3u8/i.test(u || "");
    }
    // CSAI ads request creatives from this endpoint (not stitched into the HLS).
    function isAdReq(u) {
      return /edge\.ads\.twitch\.tv|aws\.twitch\.tv\/ads|\/ads\?/i.test(u || "");
    }
    // Remove Twitch SSAI ad segments from a media playlist.
    //
    // Twitch brackets the ad pod with #EXT-X-DISCONTINUITY and tags it with
    // CLASS="twitch-stitched-ad" date-ranges (a pod range + a per-segment quartile
    // range before each ad segment). Crucially the FIRST discontinuity *opens* the
    // ad (it is not the end), so we enter "ad mode" on a stitched-ad date-range and
    // only leave it on a discontinuity AFTER we have dropped at least one ad
    // segment — that distinguishes the closing discontinuity from the opening one.
    function stripAds(text) {
      var lines = String(text).split("\n");
      var out = [];
      var seg = []; // tags buffered for the segment currently being read
      var adMode = false;
      var adSegsDropped = 0;
      for (var i = 0; i < lines.length; i++) {
        var ln = lines[i];
        if (ln.indexOf("#EXT-X-DATERANGE") === 0) {
          if (ln.indexOf("twitch-stitched-ad") !== -1) {
            adMode = true; // entering / staying in the ad pod
            continue; // drop the ad date-range
          }
          out.push(ln); // keep non-ad metadata date-ranges
          continue;
        }
        if (ln.indexOf("#EXT-X-DISCONTINUITY") === 0) {
          if (adMode) {
            if (adSegsDropped > 0) {
              adMode = false; // closing discontinuity (we already dropped ad segments)
              adSegsDropped = 0;
            }
            continue; // drop discontinuities that bracket the ad
          }
          out.push(ln); // keep a legitimate live-stream discontinuity
          continue;
        }
        if (ln.indexOf("#EXTINF") === 0 || ln.indexOf("#EXT-X-PROGRAM-DATE-TIME") === 0) {
          seg.push(ln);
          continue;
        }
        if (ln.length > 0 && ln.charAt(0) !== "#") {
          // a media segment URL — commit or drop the buffered block
          seg.push(ln);
          if (adMode) {
            adSegsDropped++;
          } else {
            for (var j = 0; j < seg.length; j++) out.push(seg[j]);
          }
          seg = [];
          continue;
        }
        out.push(ln); // header / other tags
      }
      for (var k = 0; k < seg.length; k++) out.push(seg[k]); // flush trailing buffer
      // Fail-safe: never hand the player a playlist with zero media segments — that
      // stalls it into a retry loop (offline screen). If stripping gutted everything
      // (a pure-ad window, or a format that trapped us in ad-mode), return the
      // original untouched: the ad plays, but playback stays intact and the hook
      // reports it as "missed" rather than a block.
      var keptSegs = 0;
      for (var m = 0; m < out.length; m++) {
        if (out[m].length > 0 && out[m].charAt(0) !== "#") keptSegs++;
      }
      if (keptSegs === 0) return text;
      return out.join("\n");
    }
    var rf = scope.fetch;
    if (rf) {
      scope.fetch = function (input) {
        var url = typeof input === "string" ? input : (input && input.url) || "";
        if (isAdReq(url)) {
          signal("csai");
          // M2: block the CSAI ad request — return an empty "no ads" payload.
          return Promise.resolve(
            new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } })
          );
        }
        var p = rf.apply(this, arguments);
        if (isPlaylist(url)) {
          p = p.then(function (res) {
            return res
              .clone()
              .text()
              .then(function (t) {
                if (hasAd(t)) {
                  var clean = stripAds(t);
                  // SSAI strip reduces ads in mixed windows but can be partial on
                  // pre-rolls, so it never raises the banner/counter (only the
                  // reliable CSAI block does). If we removed nothing, report "missed".
                  if (clean !== t && clean.length < t.length) {
                    signal("ssai");
                    return new Response(clean, {
                      status: res.status,
                      statusText: res.statusText,
                      headers: res.headers,
                    });
                  }
                  signal("missed");
                  return res;
                }
                return res;
              })
              .catch(function () {
                return res;
              });
          });
        }
        return p;
      };
    }
    var RX = scope.XMLHttpRequest;
    if (RX && RX.prototype) {
      var op = RX.prototype.open;
      var sn = RX.prototype.send;
      RX.prototype.open = function (m, u) {
        this.__sp_url = u;
        if (isAdReq(u)) {
          signal("csai");
          // M2: neutralize CSAI ad XHRs by loading an empty array instead.
          return op.call(this, m, "data:application/json,%5B%5D");
        }
        return op.apply(this, arguments);
      };
      RX.prototype.send = function () {
        try {
          var x = this;
          if (isPlaylist(x.__sp_url)) {
            x.addEventListener("load", function () {
              try {
                // Detection only (we don't rewrite XHR playlists) → never claim a block.
                if (hasAd(x.responseText)) signal("missed");
              } catch (e) {}
            });
          }
        } catch (e) {}
        return sn.apply(this, arguments);
      };
    }
  }

  // Route a hook signal. Only the CSAI block (empty-payload, reliable) raises the
  // banner + counter. SSAI strips reduce ads but can be partial on pre-rolls, so we
  // track them quietly and never claim a confirmed block; "missed" is tracked too.
  function route(kind) {
    try {
      var d = window.__SP_ADBLOCK_DIAG__;
      if (kind === "csai") {
        d.csai = (d.csai || 0) + 1;
        d.workerAd++;
        dbg("CSAI ad blocked");
        window.postMessage({ __sp_adblock: "ad", where: "csai" }, "*");
      } else if (kind === "ssai") {
        d.stripped++;
      } else {
        d.missed++;
      }
    } catch (_e) {}
  }

  // Main thread hooks.
  try {
    applyHooks(window, function (w) {
      route(w);
    });
  } catch (e) {
    dbg("main hook failed", e && e.message);
  }

  // Wrap the IVS worker so the hook runs inside it too.
  var RealWorker = window.Worker;
  if (RealWorker) {
    var workerInit =
      "(" +
      applyHooks.toString() +
      ")(self, function(w){try{self.postMessage({__sp_adblock:'sig',kind:w});}catch(e){}});\n";
    function attachAdListener(w) {
      w.addEventListener("message", function (e) {
        if (e && e.data && e.data.__sp_adblock === "sig") route(e.data.kind);
      });
    }
    function makeSP(RealWorker) {
      var SPWorker = function (url, opts) {
      try {
        var u = typeof url === "string" ? url : (url && url.href) || "";
        dbg("worker seen", u);
        diagPush("seen", String(u).split("?")[0].slice(-64));
        var isModule = opts && opts.type === "module";

        // Case A — direct IVS/player worker URL.
        if (u && u.indexOf("blob:") !== 0 && /wasmworker|amazon-ivs|player-core|\.worker\./i.test(u)) {
          dbg("wrapping worker (url)", u);
          diagPush("wrapped", "url");
          var src = workerInit + "importScripts(" + JSON.stringify(u) + ");";
          var w = new RealWorker(URL.createObjectURL(new Blob([src], { type: "application/javascript" })), opts);
          attachAdListener(w);
          return w;
        }

        // Case B — Twitch ships the IVS worker as a blob: read it synchronously
        // (in-memory, instant) and prepend our hook so it runs inside the worker.
        // Only wrap blobs that look stream-related; skip module workers.
        if (u && u.indexOf("blob:") === 0 && !isModule) {
          var code = "";
          try {
            var xhr = new XMLHttpRequest();
            xhr.open("GET", u, false);
            xhr.send();
            code = xhr.responseText || "";
          } catch (_x) {}
          if (code && /usher|ttvnw|\.m3u8|amazon-ivs|wasmworker|importScripts|MediaSource/i.test(code)) {
            dbg("wrapping worker (blob)");
            diagPush("wrapped", "blob");
            var bw = new RealWorker(
              URL.createObjectURL(new Blob([workerInit + "\n;\n" + code], { type: "application/javascript" })),
              opts
            );
            attachAdListener(bw);
            return bw;
          }
        }
      } catch (err) {
        dbg("worker wrap failed -> real worker", err && err.message);
      }
      return new RealWorker(url, opts);
    };
      try { SPWorker.prototype = RealWorker.prototype; } catch (_p) {}
      return SPWorker;
    }
    // Keep our wrapper outermost even if another extension (e.g. 7TV) overrides
    // window.Worker after us: a getter/setter chains to whatever they install.
    var inner = window.Worker;
    var sp = makeSP(inner);
    try {
      Object.defineProperty(window, "Worker", {
        configurable: true,
        enumerable: true,
        get: function () { return sp; },
        set: function (v) { if (v && v !== sp) { inner = v; sp = makeSP(inner); } },
      });
    } catch (_e) {
      try { window.Worker = sp; } catch (_e2) {}
    }
  }

  // Running total of blocked ad breaks (fed by adblock-bridge.js via postMessage).
  var blockedTotal = null;
  // Donation link surfaced right at the moment of value (an ad was just blocked).
  var TIP_URL = "https://revolut.me/alexisamz";
  function bannerCountText() {
    if (blockedTotal == null) return "";
    try {
      return " · " + Number(blockedTotal).toLocaleString();
    } catch (_e) {
      return " · " + blockedTotal;
    }
  }

  // Banner shown on the player when an ad is detected.
  var hideTimer = null;
  function showBanner() {
    try {
      var el = document.getElementById("sp-adblock-banner");
      if (!el) {
        el = document.createElement("div");
        el.id = "sp-adblock-banner";
        el.innerHTML =
          '<img src="' + SP_LOGO + '" alt="" style="width:15px;height:15px;border-radius:3px;' +
          'margin-right:7px;vertical-align:-3px;object-fit:cover" />' +
          '<span style="vertical-align:middle">Ad blocked by StreamPulse</span>' +
          '<span id="sp-adblock-count" style="vertical-align:middle;opacity:.8;font-weight:500"></span>' +
          '<a id="sp-adblock-tip" href="' + TIP_URL + '" target="_blank" rel="noopener noreferrer" ' +
          'title="Offrir un Bubble Tea" style="margin-left:9px;display:inline-flex;align-items:center;' +
          'vertical-align:middle;pointer-events:auto;cursor:pointer;color:#ffd300">' +
          '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
          'stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/>' +
          '<path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/>' +
          '<line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg></a>';
        el.setAttribute(
          "style",
          [
            "position:absolute",
            "left:50%",
            "bottom:18px",
            "transform:translateX(-50%)",
            "z-index:2147483646",
            "background:rgba(14,14,20,.92)",
            "color:#fff",
            "font:600 12px/1.2 Inter,-apple-system,system-ui,sans-serif",
            "padding:8px 13px",
            "border-radius:9px",
            "box-shadow:0 8px 24px rgba(0,0,0,.55)",
            "border:1px solid rgba(145,70,255,.55)",
            "pointer-events:none",
            "letter-spacing:.02em",
            "white-space:nowrap",
          ].join(";")
        );
      }
      var host = document.querySelector(
        '.video-player, [data-a-target="video-player"], .persistent-player'
      );
      if (host) {
        if (window.getComputedStyle(host).position === "static") host.style.position = "relative";
        if (el.parentNode !== host) host.appendChild(el);
        el.style.position = "absolute";
      } else {
        el.style.position = "fixed";
        if (el.parentNode !== document.body) document.body.appendChild(el);
      }
      var cEl = el.querySelector("#sp-adblock-count");
      if (cEl) cEl.textContent = bannerCountText();
      el.style.display = "block";
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = setTimeout(function () {
        if (el) el.style.display = "none";
      }, 4000);
    } catch (_e) {}
  }

  window.addEventListener("message", function (e) {
    if (!e || e.source !== window || !e.data) return;
    if (e.data.__sp_adblock === "ad") {
      showBanner();
    } else if (typeof e.data.__sp_adblock_count === "number") {
      blockedTotal = e.data.__sp_adblock_count;
      var cEl = document.getElementById("sp-adblock-count");
      if (cEl) cEl.textContent = bannerCountText();
    }
  });

  dbg("installed");
})();
