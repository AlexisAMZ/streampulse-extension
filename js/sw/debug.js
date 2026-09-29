// Diagnostic : self.__SP_DEBUG__ dans la console du service worker.

import { pollStreamers } from "./polling.js";
import { notifyIncomingRaid } from "./raids.js";
import { streamerLiveState } from "./state.js";
import { DataStore } from "./stores.js";

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
