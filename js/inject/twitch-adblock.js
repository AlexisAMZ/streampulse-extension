/**
 * StreamPulse — Twitch site-wide ad detector (M1: detect + banner).
 *
 * Runs in the PAGE main world (manifest `world: "MAIN"`, run_at document_start)
 * so it can hook Twitch's own player without the page CSP blocking it. Twitch
 * fetches its HLS playlist inside the `amazon-ivs-wasmworker`, so we hook both the
 * main-thread fetch/XHR AND wrap that worker to detect Twitch stitched-ad breaks.
 *
 * M2: blocks CSAI ads by returning an empty "no ads" payload for edge.ads.twitch.tv
 * requests, plus an "Ad blocked by StreamPulse" banner. (SSAI stitched-ad stripping
 * in the worker playlist is the next step.)
 *
 * Kill-switch (if the Twitch player ever breaks): in the page console run
 *   localStorage['sp-adblock-disabled'] = '1'
 * then reload the tab. Debug logs: set window.__SP_PREVIEWS_DEBUG__ = true.
 */
(function () {
  "use strict";

  // StreamPulse logo (48px PNG) inlined as a data URI — the MAIN-world
  // script has no chrome.runtime.getURL access.
  var SP_LOGO = "data:image/png;base64,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";

  if (window.__SP_TWITCH_ADBLOCK__) return;
  window.__SP_TWITCH_ADBLOCK__ = true;
  // Live diagnostics — inspect via window.__SP_ADBLOCK_DIAG__.
  window.__SP_ADBLOCK_DIAG__ = { seen: [], wrapped: [], workerAd: 0, stripped: 0 };

  try {
    if (localStorage.getItem("sp-adblock-disabled") === "1") return;
  } catch (_e) {}

  // M1: logs are always on and use console.log so they're visible at the default
  // console level (console.debug is hidden unless "Verbose" is enabled).
  // (Re-gate behind __SP_PREVIEWS_DEBUG__ + console.debug later.)
  function dbg() {
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
    // Remove Twitch SSAI ad segments from a media playlist: drop everything inside
    // a twitch-stitched-ad date-range until the discontinuity that resumes live.
    function stripAds(text) {
      var lines = String(text).split("\n");
      var out = [];
      var inAd = false;
      for (var i = 0; i < lines.length; i++) {
        var ln = lines[i];
        if (ln.indexOf("#EXT-X-DATERANGE") === 0 && ln.indexOf("twitch-stitched-ad") !== -1) {
          inAd = true;
          continue;
        }
        if (inAd) {
          if (ln.indexOf("#EXT-X-DISCONTINUITY") === 0) {
            inAd = false; // ad block ends; resume live (drop the discontinuity too)
            continue;
          }
          continue; // drop ad lines (#EXTINF, segment URLs, program-date-time…)
        }
        out.push(ln);
      }
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
                  signal("ssai");
                  // M2.1: strip stitched-ad segments and return the clean playlist.
                  return new Response(stripAds(t), {
                    status: res.status,
                    statusText: res.statusText,
                    headers: res.headers,
                  });
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
                if (hasAd(x.responseText)) signal("xhr");
              } catch (e) {}
            });
          }
        } catch (e) {}
        return sn.apply(this, arguments);
      };
    }
  }

  // Main thread hooks.
  try {
    applyHooks(window, function (w) {
      dbg("AD detected (main-" + w + ")");
      try {
        window.postMessage({ __sp_adblock: "ad", where: "main-" + w }, "*");
      } catch (_e) {}
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
      ")(self, function(w){try{self.postMessage({__sp_adblock:'ad',where:'worker-'+w});}catch(e){}});\n";
    function attachAdListener(w) {
      w.addEventListener("message", function (e) {
        if (e && e.data && e.data.__sp_adblock === "ad") {
          dbg("AD signal from " + (e.data.where || "worker"));
          try {
            window.__SP_ADBLOCK_DIAG__.workerAd++;
            if (String(e.data.where || "").indexOf("ssai") !== -1) window.__SP_ADBLOCK_DIAG__.stripped++;
            window.postMessage({ __sp_adblock: "ad", where: e.data.where || "worker" }, "*");
          } catch (_e) {}
        }
      });
    }
    var SPWorker = function (url, opts) {
      try {
        var u = typeof url === "string" ? url : (url && url.href) || "";
        dbg("worker seen", u);
        try { window.__SP_ADBLOCK_DIAG__.seen.push(String(u).split("?")[0].slice(-64)); } catch (_d) {}
        var isModule = opts && opts.type === "module";

        // Case A — direct IVS/player worker URL.
        if (u && u.indexOf("blob:") !== 0 && /wasmworker|amazon-ivs|player-core|\.worker\./i.test(u)) {
          dbg("wrapping worker (url)", u);
          try { window.__SP_ADBLOCK_DIAG__.wrapped.push("url"); } catch (_d) {}
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
            try { window.__SP_ADBLOCK_DIAG__.wrapped.push("blob"); } catch (_d) {}
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
    SPWorker.prototype = RealWorker.prototype;
    try {
      window.Worker = SPWorker;
    } catch (_e) {}
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
          "Ad blocked by StreamPulse";
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
      el.style.display = "block";
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = setTimeout(function () {
        if (el) el.style.display = "none";
      }, 4000);
    } catch (_e) {}
  }

  window.addEventListener("message", function (e) {
    if (e && e.source === window && e.data && e.data.__sp_adblock === "ad") showBanner();
  });

  dbg("installed");
})();
