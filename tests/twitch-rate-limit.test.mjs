import { test } from "node:test";
import assert from "node:assert/strict";
import {
  RATE_LIMIT_PAUSE_MAX_MS,
  isRateLimitError,
  rateLimitResetAt,
} from "../js/twitch-rate-limit.js";

const NOW = 1_790_000_000_000;

test("rateLimitResetAt : Ratelimit-Reset (epoch secondes) prioritaire", () => {
  const at = rateLimitResetAt({ get: (n) => (n === "ratelimit-reset" ? String(NOW / 1000 + 30) : null) }, NOW);
  assert.equal(at, NOW + 30_000);
});

test("rateLimitResetAt : Retry-After (secondes) en repli", () => {
  const at = rateLimitResetAt({ get: (n) => (n === "retry-after" ? "15" : null) }, NOW);
  assert.equal(at, NOW + 15_000);
});

test("rateLimitResetAt : plafond de la pause", () => {
  const at = rateLimitResetAt({ get: () => String(NOW / 1000 + 6 * 3600) }, NOW);
  assert.equal(at, NOW + RATE_LIMIT_PAUSE_MAX_MS);
});

test("rateLimitResetAt : valeur passee, invalide ou absente => 0", () => {
  assert.equal(rateLimitResetAt({ get: () => String(NOW / 1000 - 60) }, NOW), 0);
  assert.equal(rateLimitResetAt({ get: () => "demain" }, NOW), 0);
  assert.equal(rateLimitResetAt({ get: () => null }, NOW), 0);
  assert.equal(rateLimitResetAt(null, NOW), 0);
});

test("isRateLimitError : reconnait une erreur 429 (message ou statusCode)", () => {
  const err = new Error("429 Too Many Requests");
  assert.equal(isRateLimitError(err), true);
  assert.equal(isRateLimitError(Object.assign(new Error("x"), { statusCode: 429 })), true);
  assert.equal(isRateLimitError(new Error("500 Internal Server Error")), false);
  assert.equal(isRateLimitError(null), false);
});
