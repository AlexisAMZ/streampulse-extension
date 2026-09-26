// Lecture des Drops depuis le service worker, sans onglet Twitch ouvert. La
// session vient du cookie « auth-token » de twitch.tv (permission cookies) ;
// le jeton n'est jamais écrit dans le storage. Twitch refuse la liste des
// campagnes sans l'en-tête Client-Integrity, que seule la page possède : elle
// reste lue par inject/drops-bridge.js. L'inventaire et la récupération, eux,
// passent sans.

// Identifiant public de l'application web Twitch, celui que la page envoie elle-même.
const WEB_CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko";
const GQL_URL = "https://gql.twitch.tv/gql";
const INSTANCE_ID = /^[\w#:.-]{1,300}$/;

export const INVENTORY_QUERY = `query StreamPulseDropsInventory {
  currentUser {
    id
    inventory {
      dropCampaignsInProgress {
        id name status startAt endAt
        game { id displayName }
        allow { isEnabled channels { id name displayName } }
        timeBasedDrops {
          id name startAt endAt requiredMinutesWatched
          benefitEdges { benefit { id name imageAssetURL distributionType } }
          self { currentMinutesWatched dropInstanceID isClaimed }
        }
      }
      gameEventDrops { id name imageURL lastAwardedAt game { id displayName } }
    }
  }
}`;

// Repli limité aux champs vérifiés sur twitch.tv le 2026-09-26.
export const INVENTORY_QUERY_LITE = `query StreamPulseDropsInventoryLite {
  currentUser {
    id
    inventory {
      dropCampaignsInProgress {
        id name
        game { id displayName }
        timeBasedDrops {
          id name endAt requiredMinutesWatched
          benefitEdges { benefit { id name distributionType } }
          self { currentMinutesWatched dropInstanceID isClaimed }
        }
      }
    }
  }
}`;

// Campagnes de récompenses (badges de chat, objets offerts) : un circuit séparé
// des Drops, attribué automatiquement. Lecture acceptée sans Client-Integrity
// (vérifié sur twitch.tv le 2026-09-26) ; Twitch ne donne pas l'avancée.
export const REWARDS_QUERY = `query StreamPulseRewardCampaigns {
  rewardCampaignsAvailableToUser {
    id name brand startsAt endsAt summary externalURL
    unlockRequirements { subsGoal minuteWatchedGoal }
    game { displayName }
    rewards { id name bannerImage { image1xURL } }
  }
}`;

// Tous les badges globaux de Twitch, et ceux que l'utilisateur possède déjà.
// Lecture acceptée sans Client-Integrity (vérifié sur twitch.tv le 2026-09-26).
export const BADGES_QUERY = `query StreamPulseGlobalBadges {
  badges { setID version title description clickURL imageURL(size: NORMAL) }
  currentUser { id availableBadges { setID } }
}`;

const failure = (code, detail = "") => Object.assign(new Error(code), { code, detail });

/** Jeton de session Twitch lu dans le cookie, ou "" si l'utilisateur n'est pas connecté. */
export async function twitchToken(cookies) {
  const cookie = await cookies.get({ url: "https://www.twitch.tv", name: "auth-token" }).catch(() => null);
  return cookie?.value ? decodeURIComponent(cookie.value) : "";
}

/**
 * @param {{ fetch: typeof fetch, cookies: { get(details: object): Promise<{ value: string } | null> } }} deps
 */
export function createDropsClient({ fetch, cookies }) {
  async function gql(query) {
    const token = await twitchToken(cookies);
    if (!token) throw failure("signed-out");
    const response = await fetch(GQL_URL, {
      method: "POST",
      headers: { "Client-Id": WEB_CLIENT_ID, Authorization: `OAuth ${token}`, "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify({ query }),
    });
    if (response.status === 401) throw failure("signed-out");
    const json = await response.json().catch(() => null);
    const errors = Array.isArray(json?.errors) ? json.errors.map((error) => String(error?.message || "")) : [];
    if (errors.some((message) => /integrity/i.test(message))) throw failure("integrity");
    if (!json?.data) throw failure(errors.length ? "graphql" : `http-${response.status}`, errors.join(" | ").slice(0, 300));
    return { data: json.data, errors };
  }

  async function readInventory() {
    let result;
    try {
      result = await gql(INVENTORY_QUERY);
      if (result.errors.some((message) => /Cannot query field|Unknown (type|argument)/i.test(message))) result = null;
    } catch (error) {
      if (error.code !== "graphql") throw error;
      result = null;
    }
    const { data } = result || (await gql(INVENTORY_QUERY_LITE));
    if (!data.currentUser) throw failure("signed-out");
    return { currentUser: data.currentUser };
  }

  async function claim(instanceId) {
    if (!INSTANCE_ID.test(String(instanceId || ""))) throw failure("invalid");
    const { data } = await gql(`mutation StreamPulseClaimDrop { claimDropRewards(input: { dropInstanceID: ${JSON.stringify(instanceId)} }) { status } }`);
    return { status: String(data.claimDropRewards?.status || "") };
  }

  async function readRewards() {
    const { data } = await gql(REWARDS_QUERY);
    return Array.isArray(data.rewardCampaignsAvailableToUser) ? data.rewardCampaignsAvailableToUser : [];
  }

  async function readBadges() {
    const { data } = await gql(BADGES_QUERY);
    return {
      badges: Array.isArray(data.badges) ? data.badges : [],
      owned: Array.isArray(data.currentUser?.availableBadges) ? data.currentUser.availableBadges.map((badge) => badge?.setID).filter(Boolean) : [],
    };
  }

  return { readInventory, readRewards, readBadges, claim };
}
