// Outil de développement, jamais livré (scripts/ est exclu du zip).
// Extension chargée depuis le dossier, dans la console du service worker :
//   (await import(chrome.runtime.getURL("scripts/dev/sw-debug.js"))).installDebugTools()
// puis self.__SP_DEBUG__.fakeTitleChange("handle"), fakeGameChange, fakeRaid.

import { pollStreamers } from "../../js/sw/polling.js";
import { notifyIncomingRaid } from "../../js/sw/raids.js";
import { streamerLiveState } from "../../js/sw/state.js";
import { DataStore } from "../../js/sw/stores.js";

// ─── Diagnostic : expose tot, meme si une erreur survient plus bas ───────────
// Console du service worker (chrome://extensions → inspect du worker).
export function installDebugTools() {
  self.__SP_DEBUG__ = {
    async fakeTitleChange(handle) {
      return this._fake(handle, "title", " [test StreamPulse]");
    },
    async fakeGameChange(handle) {
      return this._fake(handle, "game", "Tests & Démos");
    },
    async fakeRaid(handle) {
      const streamers = await DataStore.getStreamers();
      const login = String(handle || "").toLowerCase();
      const streamer = streamers.find(
        (item) => String(item.handle || item.twitch || "").toLowerCase() === login
      );
      if (!streamer) return "StreamPulse: streamer introuvable";
      await notifyIncomingRaid({
        channel: streamer.handle || streamer.twitch,
        raider: streamer.displayName || "TestRaid",
        viewers: 42,
      });
      return "StreamPulse: notification de raid envoyee (chemin d'affichage)";
    },
    async _fake(handle, field, value) {
      const streamers = await DataStore.getStreamers();
      const login = String(handle || "").toLowerCase();
      const streamer = streamers.find(
        (item) =>
          String(item.handle || item.twitch || "").toLowerCase() === login ||
          (login === "" && streamerLiveState.get(item.id)?.isLive)
      );
      if (!streamer) return "StreamPulse: streamer introuvable (essaie sans handle pour cibler n'importe quel streamer en direct)";
      const state = streamerLiveState.get(streamer.id);
      if (!state || !state.isLive) {
        return `StreamPulse: ${streamer.handle} n'est pas en direct — la simulation n'a de sens qu'en direct`;
      }
      state[field] = value;
      await pollStreamers();
      return `StreamPulse: changement de ${field} simule pour ${streamer.handle} — une alerte doit partir si l'alerte correspondante est active`;
    },
  };
}
