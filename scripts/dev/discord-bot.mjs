import fs from 'node:fs';

// Lecture de la configuration depuis .env
const envPath = new URL('../../.env', import.meta.url).pathname;
let TOKEN = process.env.DISCORD_BOT_TOKEN;
let GUILD_ID = process.env.DISCORD_GUILD_ID;

if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const val = match[2].trim();
      if (key === 'DISCORD_BOT_TOKEN' && !TOKEN) TOKEN = val;
      if (key === 'DISCORD_GUILD_ID' && !GUILD_ID) GUILD_ID = val;
    }
  }
}

if (!TOKEN) {
  console.error('[bot] Erreur : DISCORD_BOT_TOKEN introuvable.');
  process.exit(1);
}

const BASE = 'https://discord.com/api/v10';
const headers = {
  Authorization: `Bot ${TOKEN}`,
  'Content-Type': 'application/json',
};

// Dictionnaire des correspondances drapeaux -> rôles
const FLAG_TO_ROLE = {
  '🇫🇷': '🇫🇷 Français',
  '🇬🇧': '🇬🇧 English',
  '🇪🇸': '🇪🇸 Español',
  '🇧🇷': '🇧🇷 Português',
  '🇩🇪': '🇩🇪 Deutsch',
  '🇮🇹': '🇮🇹 Italiano',
  '🇵🇱': '🇵🇱 Polski',
  '🇹🇷': '🇹🇷 Türkçe',
  '🇷🇺': '🇷🇺 Русский',
  '🇯🇵': '🇯🇵 日本語',
  '🇰🇷': '🇰🇷 한국어',
};

let roleCache = new Map();

async function refreshRoles() {
  try {
    const res = await fetch(`${BASE}/guilds/${GUILD_ID}/roles`, { headers });
    if (res.ok) {
      const roles = await res.json();
      roleCache.clear();
      for (const r of roles) {
        roleCache.set(r.name, r.id);
      }
      console.log(`[bot] ${roleCache.size} rôles mis en cache.`);
    }
  } catch (err) {
    console.error('[bot] Impossible de charger les rôles :', err);
  }
}

const COMMAND_RESPONSES = {
  streampulse: {
    title: '🟣 StreamPulse : Le Pulse de vos Streams',
    description: 'Extension navigateur open source et ultra-légère réunissant **Twitch**, **Kick** et **YouTube** au même endroit.',
    color: 0x9146ff,
    fields: [
      { name: '✨ Multi-plateforme', value: 'Suivez tous vos streamers favoris sur une seule interface synchronisée.', inline: true },
      { name: '🎁 Twitch Drops', value: 'Détection et réclamation 100% automatique de vos récompenses.', inline: true },
      { name: '⚡ Faible empreinte', value: 'Aucune consommation inutile en arrière-plan, zéro pistage.', inline: true },
      { name: '🌐 Site officiel', value: '[streampulse.tech](https://streampulse.tech)', inline: false },
    ],
    footer: { text: 'StreamPulse · Extension disponible sur Chrome et Firefox' },
  },
  drops: {
    title: '🎁 Twitch Drops Automatiques',
    description: 'Le module Drops surveille en temps réel votre progression de visionnage et réclame automatiquement vos récompenses.',
    color: 0x9146ff,
    fields: [
      { name: 'Comment ça marche ?', value: 'Dès qu’une barre de progression de Drop atteint 100%, l’extension envoie la requête de réclamation à l’API Twitch.', inline: false },
      { name: 'Prérequis', value: 'Être connecté à son compte Twitch sur le navigateur. Aucune configuration complexe requise.', inline: false },
      { name: 'Suivi en direct', value: 'Ouvrez le popup StreamPulse pour voir vos pourcentages d’avancement en direct.', inline: false },
    ],
    footer: { text: 'StreamPulse Drops Automation' },
  },
  support: {
    title: '🛠️ Support & Assistance StreamPulse',
    description: 'Une question, une idée ou un dysfonctionnement à signaler ? Plusieurs canaux sont à votre disposition :',
    color: 0x3b82f6,
    fields: [
      { name: '🌐 Formulaire en ligne', value: '[streampulse.tech/support](https://streampulse.tech/support)', inline: true },
      { name: '🐛 Salon Discord', value: '<#1555587806901051572>', inline: true },
      { name: '📧 Contact e-mail', value: 'contact@streampulse.tech', inline: true },
    ],
    footer: { text: 'StreamPulse Support' },
  },
  links: {
    title: '🔗 Liens Officiels StreamPulse',
    description: 'Tous les accès directs pour télécharger et suivre le projet :',
    color: 0x2ecc71,
    fields: [
      { name: '💻 Chrome Web Store', value: '[Installer pour Chrome](https://chromewebstore.google.com/detail/streampulse/kgnkgddicdccfbfbjgopijhpeepkmfgh)', inline: true },
      { name: '🦊 Firefox Add-ons', value: '[Installer pour Firefox](https://addons.mozilla.org/firefox/addon/streampulse/)', inline: true },
      { name: '📂 Code GitHub', value: '[github.com/AlexisAMZ/streampulse-extension](https://github.com/AlexisAMZ/streampulse-extension)', inline: false },
      { name: '🌐 Site Web', value: '[streampulse.tech](https://streampulse.tech)', inline: false },
    ],
    footer: { text: 'StreamPulse · 100% Gratuit & Open Source' },
  },
};

let ws = null;
let heartbeatInterval = null;
let heartbeatTimer = null;
let lastSequence = null;

function sendHeartbeat() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ op: 1, d: lastSequence }));
  }
}

function startHeartbeat(ms) {
  clearInterval(heartbeatTimer);
  heartbeatInterval = ms;
  heartbeatTimer = setInterval(sendHeartbeat, heartbeatInterval);
}

async function handleInteraction(interaction) {
  if (interaction.type === 2) { // APPLICATION_COMMAND
    const cmdName = interaction.data?.name;
    const embed = COMMAND_RESPONSES[cmdName];
    if (embed) {
      await fetch(`${BASE}/interactions/${interaction.id}/${interaction.token}/callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
          data: { embeds: [embed] },
        }),
      });
      console.log(`[bot] Commande /${cmdName} traitée pour ${interaction.member?.user?.username}`);
    }
  }
}

async function handleReaction(data, isAdd) {
  const emoji = data.emoji?.name;
  const roleName = FLAG_TO_ROLE[emoji];
  if (!roleName) return;

  const roleId = roleCache.get(roleName);
  if (!roleId) return;

  const userId = data.user_id;
  const guildId = data.guild_id || GUILD_ID;

  try {
    const url = `${BASE}/guilds/${guildId}/members/${userId}/roles/${roleId}`;
    const res = await fetch(url, {
      method: isAdd ? 'PUT' : 'DELETE',
      headers,
    });
    if (res.ok || res.status === 204) {
      console.log(`[bot] Rôle ${roleName} ${isAdd ? 'attribué à' : 'retiré de'} ${userId}`);
    } else {
      const err = await res.text();
      console.warn(`[bot] Erreur attribution rôle ${roleName} :`, res.status, err);
    }
  } catch (err) {
    console.error(`[bot] Erreur réseau attribution rôle :`, err);
  }
}

function connect() {
  console.log('[bot] Connexion à la Gateway Discord...');
  ws = new WebSocket('wss://gateway.discord.gg/?v=10&encoding=json');

  ws.onopen = () => {
    console.log('[bot] WebSocket connecté.');
  };

  ws.onmessage = async (event) => {
    try {
      const message = JSON.parse(event.data);
      if (message.s) lastSequence = message.s;

      switch (message.op) {
        case 10: { // HELLO
          startHeartbeat(message.d.heartbeat_interval);
          // Authentification
          ws.send(JSON.stringify({
            op: 2,
            d: {
              token: TOKEN,
              intents: 1 | (1 << 9) | (1 << 10), // GUILDS, GUILD_MESSAGES, GUILD_MESSAGE_REACTIONS
              properties: {
                os: 'darwin',
                browser: 'StreamPulseBot',
                device: 'StreamPulseBot',
              },
              presence: {
                activities: [{ name: 'streampulse.tech · /streampulse', type: 3 }],
                status: 'online',
                afk: false,
              },
            },
          }));
          break;
        }

        case 11: // HEARTBEAT_ACK
          break;

        case 0: { // DISPATCH
          const { t, d } = message;
          if (t === 'READY') {
            console.log(`[bot] En ligne en tant que ${d.user.username}#${d.user.discriminator} (ID: ${d.user.id})`);
            await refreshRoles();
          } else if (t === 'INTERACTION_CREATE') {
            await handleInteraction(d);
          } else if (t === 'MESSAGE_REACTION_ADD') {
            await handleReaction(d, true);
          } else if (t === 'MESSAGE_REACTION_REMOVE') {
            await handleReaction(d, false);
          }
          break;
        }
      }
    } catch (e) {
      console.error('[bot] Erreur message Gateway :', e);
    }
  };

  ws.onclose = (event) => {
    clearInterval(heartbeatTimer);
    console.warn(`[bot] Déconnecté de la Gateway (${event.code} : ${event.reason}). Reconnexion dans 5s...`);
    setTimeout(connect, 5000);
  };

  ws.onerror = (err) => {
    console.error('[bot] Erreur WebSocket :', err.message);
  };
}

connect();
