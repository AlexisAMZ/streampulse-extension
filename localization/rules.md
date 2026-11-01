# Règles de traduction StreamPulse

Ce fichier sert à trois lecteurs : les humains qui traduisent, DeepL (via le glossaire et le paramètre de registre de `config.json`) et Claude pendant la relecture (`npm run i18n:review`, qui lui envoie la section « Général » et celle de la langue). Les règles ci-dessous sont tirées des traductions publiées au 1er novembre 2026 : elles décrivent ce qui est déjà en place, pas une préférence théorique.

## Général

- La source est l'anglais (`i18n/lang/en.js`). Traduire le sens et le ton, pas les mots : une interface courte, directe, sans jargon marketing.
- Les variables `{{count}}`, `{{name}}`… restent identiques, ni traduites ni déplacées hors de la phrase. L'ordre peut changer si la langue l'exige.
- Les balises HTML (`<strong>`, `<span class="accent">`, `<a href="…">`) restent identiques ; seul le texte entre elles se traduit.
- Les marques et noms de produits restent tels quels : StreamPulse, StreamPulse+, StreamPulse Clips, Twitch, Kick, YouTube, CHZZK, TikTok, Discord… (liste complète : `protected-terms.json`). Une langue à déclinaisons peut les décliner (« Twitcha » en polonais).
- La plateforme s'appelle toujours par son nom. Ne jamais écrire « Twitch & Kick » seuls quand le texte parle de toutes les plateformes : Twitch, Kick et YouTube.
- La terminologie du streaming suit `glossary.json` : une même notion garde le même mot sur tous les écrans d'une langue.
- « Live » est un état (« en direct ») ou un nom (« un live ») selon l'écran : traduire le sens.
- Les libellés de boutons restent courts : au-delà de 2,2 fois la longueur anglaise, ils débordent.
- Les exemples dans les champs (`you@example.com`, `@handle`) peuvent être localisés.
- Les clés `htmlLang` contiennent le code de langue, jamais une traduction.
- Pluriels : une clé de pluriel a une forme par catégorie CLDR de la langue (`one`, `few`, `many`, `other`…). Chaque forme doit être juste pour tous les nombres de sa catégorie (en ukrainien, `one` sert aussi à 21, 31…) : mettre `{{count}}`, jamais un « 1 » écrit en dur. Une tournure neutre « Libellé : {{count}} » est acceptable quand elle sonne naturel.
- Une traduction approuvée (`approved`) ne se change qu'avec une raison, consignée dans `history.jsonl`.

## fr — Français

- Tutoiement (« Clique », « Ton pseudo »). Ton chaleureux, communauté Twitch francophone.
- Anglicismes de la communauté acceptés : streamer, live, chat (« tchat » toléré), sub, raid, Drops, badge, clip, viewers.
- Espace insécable avant « : ; ! ? » quand l'interface le permet ; guillemets « ».

## es — Español

- Tutoiement (« tú »), espagnol neutre compréhensible en Espagne et en Amérique latine.
- Badges = « insignias », Drops reste « Drops », raid reste « raid ».

## pt-BR — Português (Brasil)

- « Você », registre brasilien informel (« te rendeu »).
- Badges = « emblemas » (pas « badges ») ; Drops reste « Drops » ; clip = « clipe ».

## de — Deutsch

- Duzen (« du », « dein »), comme Twitch en allemand.
- Badges = « Abzeichen » ; Drops, Raid, Clip, Streamer restent en anglais (genre masculin pour Raid et Clip).
- Composés avec trait d'union après une marque : « Twitch-Vorhersage », « StreamPulse+-Namensstil ».

## it — Italiano

- Tutoiement. Badge, Drops, raid, clip, streamer restent en anglais (invariables).

## pl — Polski

- Tutoiement (« ty »). Les marques se déclinent (« na Twitchu », « Twitcha »).
- Badges = « odznaki » ; Drops = « Dropsy » ; clip = « klip » ; chat = « czat ».
- Pluriels : one (1), few (2-4, 22-24…), many (5-21, 25…) ; respecter l'accord.

## tr — Türkçe

- Tutoiement (« sen »), registre amical.
- Raid = « baskın » (terme de Twitch en turc) ; badge = « rozet » ; streamer = « yayıncı » ; chat = « sohbet ».

## ru — Русский

- Vouvoiement (« вы », minuscule dans l'interface).
- Badges = « значки » (pas « бейджи ») ; Drops = « дропсы » ou « Drops » ; raid = « рейд » ; streamer = « стример ».
- Pluriels : one (1, 21…), few (2-4, 22-24…), many (5-20, 25…) ; une tournure « Libellé : {{count}} » évite l'accord quand elle reste naturelle.

## ja — 日本語

- Style poli (です・ます), phrases courtes. Pas de pluriel grammatical : une seule forme (`other`).
- Drops = « ドロップ » ; badge = « バッジ » ; streamer = « ストリーマー » ou « 配信者 ».
- Espace entre une marque latine et le japonais quand elle est en milieu de phrase (« Twitch の予想 »).

## ko — 한국어

- Style 해요체 (« 고쳤어요 »), amical et poli. Une seule forme de pluriel (`other`).
- CHZZK s'écrit « 치지직 », son nom officiel en Corée.
- Drops = « 드롭스 » ; badge = « 배지 » ; recap = « 리캡 » ou « 요약 ».

## ar — العربية

- Arabe standard moderne, écriture de droite à gauche (la page passe en `dir="rtl"`). Chiffres latins (locale Intl `ar-AE`).
- Les marques restent en caractères latins (Twitch, StreamPulse).
- Pluriels CLDR : zero, one, two, few (3-10), many (11-99), other. Les formes `zero`, `two`, `few`, `many` sont à relire par un arabophone.

## uk — Українська

- Vouvoiement (« ви »), registre courant d'application.
- Badges = « значки » (jamais « бейджі ») ; Drops reste en latin ; « StreamPulse Clips » reste en anglais ; channel points = « бали каналу ».
- Le site n'a pas de section `/uk` : les liens d'aide pointent vers `/en/…`.
- Pluriels : one (1, 21, 31…), few (2-4, 22-24…), many (0, 5-20, 25…). Les tournures « Libellé : {{count}} » de la première traduction sont valides pour tous les nombres et sont conservées.
- Traduction du 1er novembre 2026 : DeepL puis environ 880 clés corrigées à la main. Une relecture par un locuteur natif reste à faire avant de passer les clés en `approved`.
