# Organisation des assets : StreamPulseExtension

Produit : StreamPulse (extension Chrome / Edge) · bibliothèque marketing : `~/dev/_Vault/StreamPulse/` · audit du 2026-10-29.
À lire avant de déplacer, renommer ou ajouter une image, une vidéo, un logo ou un texte de fiche.

## Où sont les ressources

- Marketing indépendant : `~/dev/_Vault/StreamPulse/Marketing/` (posts X, visuels 500/1800/1900 utilisateurs, posts Reddit, overlays et rendus TikTok, tuiles Opera, vidéo de fiche, démo, textes de lancement). Index : `~/dev/_Vault/StreamPulse/MEMORY.md`.
- Migré le 2026-10-29 depuis ce dépôt : `DevKit/{opera-kit,social,reddit,tiktok-assets,promo}`, `DevKit/launch/{posts-lancement.md,streampulse-demo.mp4,streampulse-demo.gif}`, `promo/x-1900/`. `DevKit/streampulse-cws.mp4` (doublon exact) a été supprimé : la vidéo de fiche est dans `_Vault/StreamPulse/Marketing/Chrome-Web-Store/Video/`.
- Kits des stores générés : `DevKit/store-images/{cws_screenshots,promo}`, `DevKit/chrome-kit/<LANGUE>/`, `DevKit/edge-kit/<LANGUE>/`, `DevKit/listing-<version>/{chrome,edge}`, stories `DevKit/launch/stories/`.
- Logos et icônes de l'extension : `images/photos/` (`logosp.png`, `16px.png` ... `128px.png`, `badge-mark.svg`).
- Logos de plateformes : `images/platforms/`, `images/social/`.
- Promo vidéo : `promo/tiktok-capcut/` (suivi), `promo/tiktok-voix/` (travail en cours non suivi).

## À garder dans le dépôt (assets d'exécution)

- `images/photos/`, `images/platforms/`, `images/social/`, `images/icons/` : chargés par l'extension.
- `images/promo/marquee_1400x560.png`, `images/promo/demo.gif`, `images/cws_screenshots/EN/01-dashboard.png`, `02-drops.png` : images du README, seules autorisées par `.gitignore` ; `scripts/build-zip.mjs` les exclut du zip.
- `_locales/<langue>/messages.json` porte la description courte lue par le store.

## Ne pas déplacer ni restructurer sans audit des dépendances

- Ce qui reste dans `DevKit/` : `package.json` appelle `DevKit/scripts/*` (`store:assets`, `store:chrome-kit`, `store:edge-kit`, `listing`, `publish:*`, `promo:mp4`). Ces scripts écrivent dans `DevKit/store-images`, `chrome-kit`, `edge-kit`, `listing-*`, `launch/stories` et `images/cws_screenshots/`, puis les relisent pour publier.
- `DevKit/secrets/` (clé privée de signature de licence) et `DevKit/outreach/` (contacts, scripts d'envoi) : jamais vers `_Vault`.
- `promo/tiktok-capcut/` : lu par `DevKit/scripts/render-tiktok-promo.mjs`.
- `promo/tiktok-voix/` : `monter.mjs` lit `font/` et `images/cws_screenshots/FR/` du dépôt par chemin relatif ; ses vidéos finies (`videos/`) peuvent aller dans `_Vault/StreamPulse/Marketing/Social-Media/TikTok/fr-FR/`.
- `DevKit/` n'est jamais commité ni poussé ; `.gitignore` et `eslint.config.mjs` l'ignorent.

## Exceptions constatées

- Les kits générés utilisent des codes `EN`, `FR`, `PT-BR` : ne pas les renommer, les scripts les attendent.
- `DevKit/diag-ventes.sh` : outil, reste dans `DevKit/`.
- `sol.md` cite encore `streampulse-cws.mp4` (« ne pas stager ») : note historique, sans effet.

## Règles durables

- Le code et les ressources nécessaires à l'exécution restent dans ce dépôt.
- Les ressources marketing indépendantes vont dans `~/dev/_Vault/StreamPulse/` (règles complètes : `~/dev/_Vault/MEMORY.md`).
- `~/dev/_Vault/_shared/` ne reçoit que ce qui sert réellement à plusieurs produits.
- Un fichier utilisé par le code, servi par URL ou écrit par un script n'est jamais déplacé ni renommé sans rechercher toutes ses références (code, CSS, HTML, scripts, `package.json`, docs, fichiers `*ignore`). Une recherche sans résultat ne prouve pas qu'il est inutilisé (chargement dynamique, URL publique) : dans le doute, il reste et on le note ici.
- Aucun fichier suivi par Git n'est sorti vers `_Vault` (non versionné : l'historique serait perdu).
- Langues dans `_Vault` : codes `fr-FR`, `en-US`, `de-DE`... uniquement pour les langues produites. Les kits générés dans le dépôt gardent leurs codes d'origine.
- Nommage : minuscules et tirets, préfixe `01-`, `02-` quand l'ordre compte, mêmes noms et même ordre entre les langues, dimensions en suffixe (`tile-440x280.png`), jamais `final`, `v2-new`, `copie`.
- Une ressource n'a qu'une copie modifiable. Toute copie volontaire est notée ici avec la copie qui fait foi.

## Ajouter une ressource marketing

1. Lue par le code, servie par le site ou produite par un script du dépôt ? Elle reste dans le dépôt, à l'emplacement listé ci-dessus.
2. Sinon : `~/dev/_Vault/StreamPulse/Brand/...` ou `~/dev/_Vault/StreamPulse/Marketing/<Canal>/<langue>/<Type>/`, puis mettre à jour `~/dev/_Vault/StreamPulse/MEMORY.md` (le créer s'il n'existe pas encore).
