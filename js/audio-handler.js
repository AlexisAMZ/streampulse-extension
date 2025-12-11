class AudioManager {
  constructor() {
    this.audioElements = new Map();
    this.setupMessageListener();
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.audioCommand) {
        this.handleAudioRequest(request.audioCommand, sendResponse);
        return true;
      }
    });
  }

  async handleAudioRequest(command, callback) {
    try {
      switch (command.action) {
        case "play":
          await this.playAudioFile(command.file, command.volume || 0.8);
          callback({ success: true, message: "Audio joué" });
          break;
        case "stop":
          this.stopAllAudio();
          callback({ success: true, message: "Audio arrêté" });
          break;
        default:
          callback({ success: false, message: "Commande inconnue" });
      }
    } catch (error) {
      console.error("Erreur audio:", error);
      callback({ success: false, message: "Audio non disponible" });
    }
  }

  async playAudioFile(filePath, volume) {
    const audioId = `audio_${Date.now()}`;
    const audioUrl = filePath.startsWith("chrome-extension://")
      ? filePath
      : chrome.runtime.getURL(filePath);

    const audio = new Audio(audioUrl);

    audio.volume = Math.min(1, Math.max(0, volume));
    audio.preload = "auto";

    this.audioElements.set(audioId, audio);

    audio.addEventListener("ended", () => {
      this.audioElements.delete(audioId);
    });

    audio.addEventListener("error", (e) => {
      console.warn("Erreur lecture audio:", e);
      this.audioElements.delete(audioId);
    });

    await audio.play();
  }

  stopAllAudio() {
    this.audioElements.forEach((audio, id) => {
      audio.pause();
      audio.currentTime = 0;
      this.audioElements.delete(id);
    });
  }
}

const generalAudioManager = new AudioManager();
