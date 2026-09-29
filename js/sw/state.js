// État en mémoire partagé entre les modules du service worker (perdu à chaque
// redémarrage du SW : le sondage le restaure depuis le stockage).

export const streamerStates = new Map();
export const streamerCache = new Map();
export const streamerLiveState = new Map();
