import test from "node:test";
import assert from "node:assert/strict";
import { applyCampaignDetails, campaignsNeedingDetails, mergeCampaigns, normalizeCampaigns } from "../js/drops-data.js";
import { CAMPAIGNS_RAW, DAY, HOUR, NOW } from "./helpers/badges-fixtures.mjs";

const iso = (at) => new Date(at).toISOString();
const raw = (id) => CAMPAIGNS_RAW.find((campaign) => campaign.id === id);

test("normalizeCampaigns garde les Drops détaillés : dates, condition et badges donnés", () => {
  const [er, sm, p3] = normalizeCampaigns([raw("c-er"), raw("c-sm"), raw("c-p3")]);
  assert.deepEqual(er.drops, [{
    id: "d-er", name: "Bloody Finger ELDEN RING",
    startsAt: Date.parse("2026-10-01T07:00:00Z"), endsAt: Date.parse("2026-10-29T06:59:00Z"),
    minutes: 0, subs: 1, badges: ["Bloody Finger ELDEN RING"],
  }]);
  assert.deepEqual(sm.drops.map((drop) => drop.badges), [["Ultramarine"], []]);
  assert.equal(sm.drops[1].minutes, 120);
  assert.equal(p3.drops, null, "sans Drops dans la réponse, le détail reste à demander");
  assert.equal(er.detailedAt, 0);
});

test("mergeCampaigns garde le détail connu et les campagnes finies depuis moins de 7 jours", () => {
  const before = mergeCampaigns([], normalizeCampaigns([raw("c-er"), raw("c-p3")]), NOW - HOUR);
  assert.equal(before.find((c) => c.id === "c-er").detailedAt, NOW - HOUR);
  const runescape = { id: "c-old-rs", name: "RuneScape", owner: "Twitch Gaming", game: "RuneScape", startsAt: NOW - 2 * DAY, endsAt: NOW - DAY, status: "EXPIRED", drops: null, detailedAt: 0 };
  const old = { ...runescape, id: "c-old", endsAt: NOW - 8 * DAY };
  const gone = { ...runescape, id: "c-gone", endsAt: NOW + DAY, status: "ACTIVE" };
  const incoming = normalizeCampaigns([{ ...raw("c-er"), timeBasedDrops: undefined }, raw("c-p3")]);
  const merged = mergeCampaigns([...before, runescape, old, gone], incoming, NOW);
  const er = merged.find((c) => c.id === "c-er");
  assert.equal(er.drops[0].badges[0], "Bloody Finger ELDEN RING", "la liste revenue sans Drops n'efface pas le détail");
  assert.equal(er.detailedAt, NOW - HOUR);
  assert.deepEqual(merged.map((c) => c.id).sort(), ["c-er", "c-old-rs", "c-p3"], "finie hier : gardée ; finie il y a 8 jours ou disparue en cours : retirée");
});

test("campaignsNeedingDetails : Twitch Gaming sans détail frais, en cours d'abord, 5 au plus", () => {
  const extra = [1, 2, 3, 4, 5].map((n) => ({ ...raw("c-p3"), id: `c-x${n}`, endAt: iso(NOW + (6 + n) * DAY) }));
  const merged = mergeCampaigns([], normalizeCampaigns([raw("c-er"), raw("c-p3"), raw("c-lol"), ...extra]), NOW);
  const ids = campaignsNeedingDetails(merged, NOW);
  assert.deepEqual(ids, ["c-p3", "c-x1", "c-x2", "c-x3", "c-x4"], "celle qui finit la première d'abord ; ni ELDEN RING (détaillée) ni LoL (éditeur)");
  const stale = merged.map((c) => (c.id === "c-er" ? { ...c, detailedAt: NOW - 25 * HOUR } : c));
  assert.ok(campaignsNeedingDetails(stale, NOW, 10).includes("c-er"), "détail de plus de 24 h : redemandé");
});

test("applyCampaignDetails range les Drops reçus et date aussi les campagnes restées sans réponse", () => {
  const campaigns = mergeCampaigns([], normalizeCampaigns([raw("c-p3"), { ...raw("c-p3"), id: "c-p5" }]), NOW);
  const details = [{ id: "c-p3", timeBasedDrops: [{ id: "d-k", name: "Koromaru", startAt: raw("c-p3").startAt, endAt: raw("c-p3").endAt, requiredSubs: 1, benefitEdges: [{ benefit: { id: "b-k", name: "Koromaru", distributionType: "BADGE" } }] }] }];
  const next = applyCampaignDetails(campaigns, details, ["c-p3", "c-p5"], NOW + 1);
  const p3 = next.find((c) => c.id === "c-p3");
  assert.deepEqual(p3.drops[0].badges, ["Koromaru"]);
  assert.equal(p3.badgeOnly, true);
  assert.equal(p3.detailedAt, NOW + 1);
  const p5 = next.find((c) => c.id === "c-p5");
  assert.equal(p5.drops, null);
  assert.equal(p5.detailedAt, NOW + 1, "pas de nouvelle demande pendant 24 h");
  assert.equal(campaigns[0].detailedAt, 0, "aucune mutation");
});

test("un détail vide garde sa date : pas de nouvelle demande avant 24 h, même après une relecture de la liste", () => {
  const listed = mergeCampaigns([], normalizeCampaigns([raw("c-p3")]), NOW);
  const answered = applyCampaignDetails(listed, [], ["c-p3"], NOW);
  const relisted = mergeCampaigns(answered, normalizeCampaigns([raw("c-p3")]), NOW + 30 * 60_000);
  assert.equal(relisted[0].detailedAt, NOW);
  assert.deepEqual(campaignsNeedingDetails(relisted, NOW + 30 * 60_000), []);
  assert.deepEqual(campaignsNeedingDetails(relisted, NOW + 25 * HOUR), ["c-p3"]);
});
