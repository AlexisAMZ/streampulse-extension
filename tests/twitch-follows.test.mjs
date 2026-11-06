import test from "node:test";
import assert from "node:assert/strict";
import {
  FOLLOWS_SCOPE,
  buildAuthorizeUrl,
  parseAuthRedirect,
  followsToRows,
  fetchAllFollows,
  readFollowsThenRevoke,
  revokeToken,
} from "../js/twitch-follows.js";

const REDIRECT = "https://abcdefgh.chromiumapp.org/";

test("l'URL d'autorisation demande la seule lecture des follows, en jeton implicite", () => {
  const url = new URL(buildAuthorizeUrl({ clientId: "cid", redirectUri: REDIRECT, state: "st4te" }));
  assert.equal(url.origin + url.pathname, "https://id.twitch.tv/oauth2/authorize");
  assert.equal(url.searchParams.get("client_id"), "cid");
  assert.equal(url.searchParams.get("redirect_uri"), REDIRECT);
  assert.equal(url.searchParams.get("response_type"), "token");
  assert.equal(url.searchParams.get("scope"), FOLLOWS_SCOPE);
  assert.equal(FOLLOWS_SCOPE, "user:read:follows");
  assert.equal(url.searchParams.get("state"), "st4te");
  assert.equal(url.searchParams.get("force_verify"), "true");
});

test("l'URL d'autorisation refuse un clientId, une redirection ou un state vide", () => {
  assert.throws(() => buildAuthorizeUrl({ clientId: "", redirectUri: REDIRECT, state: "s" }));
  assert.throws(() => buildAuthorizeUrl({ clientId: "c", redirectUri: "", state: "s" }));
  assert.throws(() => buildAuthorizeUrl({ clientId: "c", redirectUri: REDIRECT, state: "" }));
});

test("le retour OAuth rend le jeton quand le state correspond", () => {
  const redirect = `${REDIRECT}#access_token=tok123&scope=user%3Aread%3Afollows&state=st4te&token_type=bearer`;
  assert.deepEqual(parseAuthRedirect(redirect, "st4te"), { ok: true, token: "tok123" });
});

test("le retour OAuth rejette un state différent (forgerie) ou absent", () => {
  const forged = `${REDIRECT}#access_token=tok123&state=autre&token_type=bearer`;
  assert.deepEqual(parseAuthRedirect(forged, "st4te"), { ok: false, reason: "state" });
  const none = `${REDIRECT}#access_token=tok123&token_type=bearer`;
  assert.deepEqual(parseAuthRedirect(none, "st4te"), { ok: false, reason: "state" });
});

test("le retour OAuth distingue le refus de l'utilisateur d'une erreur", () => {
  const denied = `${REDIRECT}?error=access_denied&error_description=x&state=st4te`;
  assert.deepEqual(parseAuthRedirect(denied, "st4te"), { ok: false, reason: "denied" });
  assert.deepEqual(parseAuthRedirect("", "st4te"), { ok: false, reason: "invalid" });
  assert.deepEqual(parseAuthRedirect(undefined, "st4te"), { ok: false, reason: "invalid" });
  assert.deepEqual(parseAuthRedirect(`${REDIRECT}#state=st4te`, "st4te"), { ok: false, reason: "invalid" });
});

test("followsToRows : rien de coché, doublons et déjà suivis signalés, invalides écartés", () => {
  const follows = ["Alpha", "beta", "alpha", "gamma", "bad name!", ""];
  const rows = followsToRows(follows, [{ platform: "twitch", handle: "beta", id: "beta" }]);
  assert.deepEqual(rows.map((r) => [r.handle, r.status, r.selected, r.platform]), [
    ["alpha", "ready", false, "twitch"],
    ["beta", "existing", false, "twitch"],
    ["gamma", "ready", false, "twitch"],
  ]);
});

function page(logins, cursor) {
  return { ok: true, status: 200, json: async () => ({ data: logins.map((l) => ({ broadcaster_login: l })), pagination: cursor ? { cursor } : {} }) };
}

test("fetchAllFollows parcourt les pages et ne garde que les pseudos", async () => {
  const urls = [];
  const fetchImpl = async (url, init) => {
    urls.push(url);
    assert.equal(init.headers.Authorization, "Bearer tok");
    assert.equal(init.headers["Client-Id"], "cid");
    if (url.includes("/users")) return { ok: true, status: 200, json: async () => ({ data: [{ id: "42" }] }) };
    return url.includes("after=c1") ? page(["c"], null) : page(["a", "b"], "c1");
  };
  const out = await fetchAllFollows({ token: "tok", clientId: "cid", fetchImpl });
  assert.deepEqual(out, ["a", "b", "c"]);
  assert.ok(urls.some((u) => u.includes("user_id=42") && u.includes("first=100")));
});

test("fetchAllFollows lève une erreur typée si le jeton est refusé", async () => {
  const fetchImpl = async () => ({ ok: false, status: 401, json: async () => ({}) });
  await assert.rejects(fetchAllFollows({ token: "t", clientId: "c", fetchImpl }), (e) => e.code === "unauthorized");
});

test("fetchAllFollows plafonne le parcours pour ne jamais boucler", async () => {
  const fetchImpl = async (url) => (url.includes("/users")
    ? { ok: true, status: 200, json: async () => ({ data: [{ id: "1" }] }) }
    : page(["x"], "toujours"));
  const out = await fetchAllFollows({ token: "t", clientId: "c", fetchImpl, maxPages: 3 });
  assert.equal(out.length, 3);
});

test("revokeToken annule le jeton sur Twitch, sans le mettre dans l'adresse", async () => {
  const calls = [];
  const done = await revokeToken({ token: "secret", clientId: "cid", fetchImpl: async (url, init) => { calls.push({ url, init }); return { ok: true }; } });
  assert.equal(done, true);
  assert.equal(calls[0].url, "https://id.twitch.tv/oauth2/revoke");
  assert.ok(!calls[0].url.includes("secret"));
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.body.get("client_id"), "cid");
  assert.equal(calls[0].init.body.get("token"), "secret");
});

test("revokeToken ne lève jamais : un échec réseau ne casse pas l'import", async () => {
  assert.equal(await revokeToken({ token: "t", clientId: "c", fetchImpl: async () => { throw new Error("réseau"); } }), false);
});

test("le jeton est annulé après la lecture, même quand elle échoue", async () => {
  const revoked = [];
  const okFetch = async (url) => {
    if (url.includes("revoke")) { revoked.push("ok"); return { ok: true }; }
    if (url.includes("/users")) return { ok: true, status: 200, json: async () => ({ data: [{ id: "1" }] }) };
    return page(["a"], null);
  };
  assert.deepEqual(await readFollowsThenRevoke({ token: "t", clientId: "c", fetchImpl: okFetch }), ["a"]);
  assert.equal(revoked.length, 1);
  const badFetch = async (url) => {
    if (url.includes("revoke")) { revoked.push("ko"); return { ok: true }; }
    return { ok: false, status: 401, json: async () => ({}) };
  };
  await assert.rejects(readFollowsThenRevoke({ token: "t", clientId: "c", fetchImpl: badFetch }), (e) => e.code === "unauthorized");
  assert.deepEqual(revoked, ["ok", "ko"]);
});
