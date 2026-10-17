import { playNotificationSound } from "./notification-sound-player.js";

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const command = request?.audioCommand;
  if (command?.action !== "play") return;
  // `preset` = un son du catalogue ; `file` = ancien format (fichier du zip).
  const preset = command.preset || "classic";
  playNotificationSound(preset, { volume: command.volume, getUrl: (path) => chrome.runtime.getURL(command.file || path) }).catch((err) => {
    console.warn("Audio playback failed in offscreen doc:", err);
  });
  sendResponse({ success: true });
});
