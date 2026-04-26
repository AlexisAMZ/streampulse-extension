chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request?.audioCommand?.action === "play") {
    const { file, volume } = request.audioCommand;
    playAudio(file, volume);
    sendResponse({ success: true });
  }
});

function playAudio(file, volume = 1.0) {
  if (!file) return;

  const url = chrome.runtime.getURL(file);

  const audio = new Audio(url);
  audio.volume = Math.min(Math.max(volume, 0), 1);
  audio
    .play()
    .then(() => {})
    .catch((err) => {
      console.warn("Audio playback failed in offscreen doc:", err);
    });
}
