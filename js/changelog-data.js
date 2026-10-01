/**
 * Patch notes shown after an update.
 *
 * THE ONLY FILE TO EDIT WHEN YOU SHIP A RELEASE.
 *
 * Add a new entry at the TOP of RELEASES. The `version` MUST match the
 * `version` field in manifest.json. `npm run verify` fails the build if the
 * manifest version has no matching entry here, so notes can't silently drift
 * out of sync with what users actually install.
 *
 * LOCALISATION
 * Every user-facing sentence is a map keyed by language code, not a plain
 * string. The page picks the language the user selected in StreamPulse, so a
 * Spanish install reads Spanish notes. `npm run verify` fails when a release is
 * missing one of the published languages, which is what stops French-only notes
 * from shipping to everyone.
 *
 *   text: {
 *     fr: "...",
 *     en: "...",
 *     es: "...",
 *     "pt-BR": "...",
 *   }
 *
 * The published set is whatever `AVAILABLE_LANGUAGES` exposes in
 * i18n/translations.js (today: fr, en, es, pt-BR). Publishing a new language
 * there makes every release entry below incomplete until it's covered too.
 *
 * Entry shape:
 *   version  string   Must equal manifest.json version, e.g. "26.8.9"
 *   date     string   ISO date, "YYYY-MM-DD"
 *   title    i18n     Short release headline (optional). Rendered as the big
 *                     serif hero, so keep it to ~6 words in every language:
 *                     the last two are italic + violet, like the onboarding
 *                     welcome screen.
 *   subtitle i18n     One-line summary under the hero (optional). Falls back to
 *                     a count of the changes below.
 *   changes  array    { type, area, text }: type is "new" | "fix" | "improved",
 *                     text is an i18n map. area (optional) groups a long
 *                     release by theme on the page: "drops" | "badges" |
 *                     "points" | "plus" | "interface" | "fixes". Without it,
 *                     the page groups by type.
 *   thanks   array    Contributor credits, newest release first:
 *                       handle  string  Display name / pseudo (required)
 *                       for     i18n    What they helped with (optional)
 *                       url     string  Profile link, https only (optional)
 */

/** Language used when a release has no text for the one the user picked. */
export const FALLBACK_LANGUAGE = "en";

export const RELEASES = [

  {
    version: "26.9.33",
    date: "2026-10-01",
    title: { "fr": "Ta liste te suit, YouTube aussi", "en": "Your list follows you, YouTube too", "es": "Tu lista te sigue, YouTube también", "pt-BR": "Sua lista acompanha você, YouTube também", "de": "Deine Liste folgt dir, YouTube auch", "it": "La tua lista ti segue, YouTube incluso", "pl": "Twoja lista podąża za Tobą, YouTube też", "tr": "Listen seninle gelir, YouTube dahil", "ru": "Ваш список следует за вами, и YouTube тоже", "ja": "リストは同期、YouTubeも対応", "ko": "목록이 따라갑니다, YouTube도 지원" },
    changes: [
      {
        type: "new",
        text: {
          "fr": "Synchronisation entre tes appareils, activable dans Réglages → Données : tes streamers, tes épingles, tes réglages et ta langue suivent ton navigateur, sans compte ni serveur StreamPulse. Ton temps de visionnage, tes points et tes Drops restent sur chaque appareil. Elle t'est proposée dès l'installation.",
          "en": "Sync across your devices, toggle it in Settings → Data: your streamers, pins, settings and language follow your browser — no account, no StreamPulse server. Watch time, points and Drops stay on each device. It's offered right at installation.",
          "es": "Sincronización entre tus dispositivos, activable en Ajustes → Datos: tus streamers, fijados, ajustes e idioma siguen tu navegador, sin cuenta ni servidor de StreamPulse. Tu tiempo de visualización, puntos y Drops se quedan en cada dispositivo. Se propone ya en la instalación.",
          "pt-BR": "Sincronização entre seus dispositivos, ativável em Configurações → Dados: seus streamers, fixados, configurações e idioma seguem seu navegador, sem conta nem servidor do StreamPulse. Seu tempo assistido, pontos e Drops ficam em cada dispositivo. Ela é oferecida já na instalação.",
          "de": "Synchronisierung zwischen deinen Geräten, aktivierbar unter Einstellungen → Daten: Deine Streamer, angehefteten Einträge, Einstellungen und Sprache folgen deinem Browser — ohne Konto, ohne StreamPulse-Server. Zuschauzeit, Punkte und Drops bleiben auf jedem Gerät. Sie wird schon bei der Installation vorgeschlagen.",
          "it": "Sincronizzazione tra i tuoi dispositivi, attivabile in Impostazioni → Dati: i tuoi streamer, i fissati, le impostazioni e la lingua seguono il tuo browser, senza account né server StreamPulse. Tempo di visione, punti e Drops restano su ogni dispositivo. Viene proposta già durante l'installazione.",
          "pl": "Synchronizacja między urządzeniami, do włączenia w Ustawieniach → Dane: Twoi streamerzy, przypięte, ustawienia i język podążają za Twoją przeglądarką — bez konta i bez serwera StreamPulse. Czas oglądania, punkty i dropy zostają na każdym urządzeniu. Proponowana jest już przy instalacji.",
          "tr": "Ayarlar → Veriler'den açılabilen cihazlar arası eşitleme: yayıncıların, sabitlediklerin, ayarların ve dilin tarayıcını takip eder — hesap yok, StreamPulse sunucusu yok. İzleme süren, puanların ve Drops'ların her cihazda kalır. Kurulum sırasında hemen önerilir.",
          "ru": "Синхронизация между устройствами, включается в «Настройки → Данные»: ваши стримеры, закрепления, настройки и язык следуют за вашим браузером — без аккаунта и без сервера StreamPulse. Время просмотра, баллы и дропсы остаются на каждом устройстве. Она предлагается прямо при установке.",
          "ja": "設定 → データで有効化できるデバイス間同期：配信者・ピン留め・設定・言語がブラウザに追随します。アカウントもStreamPulseのサーバーも不要。視聴時間・ポイント・ドロップは各端末に残ります。 インストール時すぐに提案されます。",
          "ko": "설정 → 데이터에서 켤 수 있는 기기 간 동기화: 스트리머, 고정, 설정, 언어가 브라우저를 따라갑니다. 계정도 StreamPulse 서버도 없습니다. 시청 시간, 포인트, 드롭은 각 기기에 남습니다. 설치 직후 바로 제안됩니다."
        },
      },
      {
        type: "new",
        text: {
          "fr": "Le temps de visionnage compte maintenant YouTube : regarde un direct d'une chaîne suivie et les minutes partent dans tes statistiques et ton Récap, avatar à l'appui. Les vidéos normales et les rediffusions ne comptent pas.  Le bouton « Ajouter à StreamPulse » est aussi là sur les pages de chaîne YouTube et Kick.",
          "en": "Watch time now counts YouTube: watch a live from a followed channel and the minutes land in your stats and Recap, avatar included. Regular videos and replays don't count.  The “Add to StreamPulse” button is there on YouTube and Kick channel pages too.",
          "es": "El tiempo de visualización ahora cuenta YouTube: mira un directo de un canal seguido y los minutos van a tus estadísticas y tu resumen, con su avatar. Los vídeos normales y las repeticiones no cuentan.  El botón «Añadir a StreamPulse» también está en las páginas de canal de YouTube y Kick.",
          "pt-BR": "O tempo assistido agora conta o YouTube: assista a uma live de um canal seguido e os minutos vão para suas estatísticas e seu resumo, com avatar. Vídeos normais e replays não contam.  O botão “Adicionar ao StreamPulse” também está nas páginas de canal do YouTube e da Kick.",
          "de": "Die Zuschauzeit zählt jetzt YouTube: Schaue einen Stream eines gefolgten Kanals, und die Minuten landen in deiner Statistik und deinem Rückblick, Avatar inklusive. Normale Videos und Wiederholungen zählen nicht.  Der Button „Zu StreamPulse hinzufügen“ ist auch auf YouTube- und Kick-Kanalseiten zu Hause.",
          "it": "Il tempo di visione ora conta YouTube: guarda una live di un canale seguito e i minuti finiscono nelle tue statistiche e nel tuo riepilogo, avatar compreso. I video normali e le repliche non contano.  Il pulsante «Aggiungi a StreamPulse» è presente anche nelle pagine dei canali YouTube e Kick.",
          "pl": "Czas oglądania liczy teraz YouTube: oglądaj transmisję na żywo obserwowanego kanału, a minuty trafią do Twoich statystyk i podsumowania, z awatarem. Zwykłe filmy i powtórki się nie liczą.  Przycisk „Dodaj do StreamPulse” jest też na stronach kanału YouTube i Kick.",
          "tr": "İzleme süresi artık YouTube'u da sayıyor: takip ettiğin bir kanalın canlı yayınını izle, dakikalar istatistiklerine ve özetine eklenir, avatarıyla birlikte. Normal videolar ve tekrarlar sayılmaz.  “StreamPulse'a ekle” düğmesi artık YouTube ve Kick kanal sayfalarında da var.",
          "ru": "Время просмотра учитывает YouTube: смотрите трансляцию канала, за которым вы следите, — минуты попадут в вашу статистику и итоги, с аватаром. Обычные видео и повторы не учитываются.  Кнопка «Добавить в StreamPulse» есть и на страницах каналов YouTube и Kick.",
          "ja": "視聴時間がYouTubeに対応：フォロー中のチャンネルのライブを見ると、分が統計とまとめに加算され、アバターも表示されます。通常動画や再再生はカウントしません。  「StreamPulseに追加」ボタンはYouTubeとKickのチャンネルページにもあります。",
          "ko": "시청 시간이 YouTube를 지원합니다: 팔로우한 채널의 라이브를 보면 분이 통계와 결산에 반영되고 아바타도 표시됩니다. 일반 영상과 다시보기는 포함되지 않습니다.  「StreamPulse에 추가」 버튼은 YouTube과 Kick 채널 페이지에도 있습니다."
        },
      },
      {
        type: "improved",
        text: {
          "fr": "Onglet Badges enrichi : progression des campagnes à objectif de minutes avec le temps qui reste (estimée sur ton temps regardé, Twitch n'expose pas l'avancée), le type de chaque récompense est affiché (Code, Badge…) et les badges sans lien de catégorie sont enfin cliquables. Les nouveaux paliers d'une série de badges sont signalés comme nouveautés.",
          "en": "Richer Badges tab: progress on minute-goal campaigns with the time left (estimated from your watch time — Twitch exposes no progress), each reward's type is shown (Code, Badge…) and badges without a category link are finally clickable. New tiers within an existing badge series are flagged as new.",
          "es": "Pestaña de insignias más rica: progreso de las campañas con objetivo de minutos y el tiempo que falta (estimado según lo que miraste, Twitch no da el avance), el tipo de cada recompensa se muestra (Código, Insignia…) y las insignias sin enlace de categoría por fin se pueden pulsar. Los nuevos niveles de una serie de insignias se marcan como novedades.",
          "pt-BR": "Aba de distintivos mais rica: progresso das campanhas com meta de minutos e o tempo que falta (estimado pelo que você assistiu, a Twitch não mostra o avanço), o tipo de cada recompensa é exibido (Código, Distintivo…) e distintivos sem link de categoria agora são clicáveis. Novos níveis de uma série de distintivos são marcados como novidades.",
          "de": "Richerer Abzeichen-Tab: Fortschritt bei Kampagnen mit Minutenziel samt Restzeit (aus deiner Zuschauzeit geschätzt, Twitch liefert keinen Fortschritt), der Typ jeder Belohnung wird angezeigt (Code, Abzeichen…) und Abzeichen ohne Kategorie-Link sind endlich anklickbar. Neue Stufen einer bestehenden Abzeichen-Serie werden als Neuheit markiert.",
          "it": "Scheda Badge più ricca: avanzamento delle campagne con obiettivo di minuti e tempo rimanente (stimato dal tuo tempo di visione, Twitch non fornisce l'avanzamento), il tipo di ogni ricompensa è mostrato (Codice, Badge…) e i badge senza link di categoria sono finalmente cliccabili. I nuovi livelli di una serie di badge sono segnalati come novità.",
          "pl": "Bogatsza karta odznak: postęp kampanii z celem minut i pozostały czas (szacowany na podstawie Twojego oglądania, Twitch nie podaje postępu), typ każdej nagrody jest wyświetlany (Kod, Odznaka…), a odznaki bez linku do kategorii są wreszcie klikalne. Nowe poziomy istniejącej serii odznak są oznaczane jako nowości.",
          "tr": "Zenginleştirilmiş Rozetler sekmesi: dakika hedefli kampanyalarda ilerleme ve kalan süre (izleme süreden tahmin edilir, Twitch ilerleme vermiyor), her ödülün türü gösteriliyor (Kod, Rozet…) ve kategori bağlantısı olmayan rozetler artık tıklanabilir. Mevcut bir rozet serisinin yeni seviyeleri yenilik olarak işaretleniyor.",
          "ru": "Обогащённая вкладка значков: прогресс кампаний с целью в минутах и оставшееся время (оценка по вашему времени просмотра — Twitch не даёт прогресса), показан тип каждой награды (Код, Значок…), а значки без ссылки на категорию наконец кликабельны. Новые уровни существующей серии значков помечаются как новинки.",
          "ja": "バッジタブが強化されました：分数目標キャンペーンの進捗と残り時間を表示（あなたの視聴時間から推定、Twitchは進捗を公開しません）、報酬の種類（コード、バッジなど）を表示、カテゴリリンクのないバッジもついにクリック可能に。 既存シリーズの新しい段位も新着として表示されます。",
          "ko": "배지 탭이 강화되었습니다: 분 목표 캠페인의 진행률과 남은 시간 표시(시청 시간 기준 추정, Twitch는 진행률을 제공하지 않음), 각 보상의 유형 표시(코드, 배지 등), 카테고리 링크 없는 배지도 드디어 클릭할 수 있습니다. 기존 시리즈의 새 단계도 새 소식으로 표시됩니다."
        },
      },
      {
        type: "improved",
        text: {
          "fr": "Les notifications de nouveaux badges ont leur propre réglage, découplé des alertes de Drops — et les cinq interrupteurs d'alertes du popup répondent de nouveau : ils n'étaient plus câblés.",
          "en": "New-badge notifications get their own setting, decoupled from Drops alerts — and the five alert switches in the pop-up respond again: they had come unwired.",
          "es": "Las notificaciones de nuevas insignias tienen su propio ajuste, separado de las alertas de Drops, y los cinco interruptores de alertas del popup vuelven a responder: habían quedado sin conectar.",
          "pt-BR": "As notificações de novos distintivos ganham configuração própria, separada das alertas de Drops — e os cinco interruptores de alerta do pop-up voltam a responder: estavam sem fiação.",
          "de": "Benachrichtigungen über neue Abzeichen haben eine eigene Einstellung, entkoppelt von den Drop-Benachrichtigungen — und die fünf Benachrichtigungsschalter im Pop-up reagieren wieder: Sie waren nicht mehr verdrahtet.",
          "it": "Le notifiche dei nuovi badge hanno un'impostazione propria, separata dagli avvisi Drops — e i cinque interruttori di notifica del pop-up rispondono di nuovo: erano rimasti scollegati.",
          "pl": "Powiadomienia o nowych odznakach mają własne ustawienie, oddzielone od alertów dropów — a pięć przełączników alertów w okienku znów działa: były odłączone.",
          "tr": "Yeni rozet bildirimleri artık kendi ayarına sahip, Drops bildirimlerinden ayrıldı — ve penceredeki beş bildirim anahtarı yeniden çalışıyor: bağlantıları kopmuştu.",
          "ru": "У уведомлений о новых значках своя настройка, отдельная от уведомлений о дропсах, — и пять переключателей уведомлений во всплывающем окне снова работают: их проводка была отсоединена.",
          "ja": "新バッジの通知に独自の設定ができ、ドロップ通知から独立しました。また、ポップアップの5つの通知スイッチが再び動作します。配線が外れていたためです。",
          "ko": "새 배지 알림에 독립적인 설정이 생겨 드롭 알림과 분리되었고, 팝업의 5개 알림 스위치가 다시 작동합니다. 배선이 빠져 있었습니다."
        },
      },
    ],
  },

  {
    version: "26.9.32",
    date: "2026-10-01",
    title: { "fr": "Le bandeau reste où tu le laisses", "en": "The strip stays where you leave it", "es": "La tira se queda donde la dejas", "pt-BR": "A faixa fica onde você deixa", "de": "Die Leiste bleibt, wo du sie lässt", "it": "La barra resta dove la lasci", "pl": "Pasek zostaje tam, gdzie go zostawisz", "tr": "Şerit bıraktığın yerde kalıyor", "ru": "Лента остаётся там, где вы её оставили", "ja": "バーは動かした位置に留まります", "ko": "스트립은 놓은 자리에 그대로 있습니다" },
    changes: [
      {
        type: "fix",
        text: {
          "fr": "Dans le popup, le bandeau des lives ne se recentre plus tout seul pendant que tu le fais défiler : il reste où tu le laisses.",
          "en": "In the pop-up, the live strip no longer snaps back on its own while you scroll it: it stays where you leave it.",
          "es": "En el popup, la tira de directos ya no se recentra sola mientras la desplazas: se queda donde la dejas.",
          "pt-BR": "No pop-up, a faixa de lives não volta mais sozinha para o centro enquanto você rola: ela fica onde você deixa.",
          "de": "Im Pop-up zentriert sich die Live-Leiste nicht mehr von selbst, während du sie scrollst: Sie bleibt, wo du sie lässt.",
          "it": "Nel pop-up, la barra delle live non si ricentra più da sola mentre la scorri: resta dove la lasci.",
          "pl": "W okienku pasek transmisji nie centruje się już sam podczas przewijania: zostaje tam, gdzie go zostawisz.",
          "tr": "Pop-up'ta canlı yayın şeridi kaydırırken kendiliğinden yeniden ortalanmıyor: bıraktığın yerde kalıyor.",
          "ru": "Во всплывающем окне лента трансляций больше не центрируется сама, пока вы её прокручиваете: она остаётся там, где вы её оставили.",
          "ja": "ポップアップでライブのバーをスクロールしても勝手に位置が戻らなくなり、動かした場所に留まります。",
          "ko": "팝업에서 라이브 스트립을 스크롤할 때 더 이상 스스로 위치가 되돌아가지 않고, 놓은 자리에 그대로 있습니다."
        },
      },
      {
        type: "fix",
        text: {
          "fr": "La liste des badges et des campagnes se met à jour dès que tu ouvres le popup, au lieu d'attendre la prochaine vérification automatique.",
          "en": "The badges and campaigns list updates as soon as you open the pop-up, instead of waiting for the next automatic check.",
          "es": "La lista de insignias y campañas se actualiza en cuanto abres el popup, en lugar de esperar la próxima comprobación automática.",
          "pt-BR": "A lista de distintivos e campanhas é atualizada assim que você abre o pop-up, em vez de esperar a próxima verificação automática.",
          "de": "Die Liste der Abzeichen und Kampagnen aktualisiert sich, sobald du das Pop-up öffnest, statt auf die nächste automatische Prüfung zu warten.",
          "it": "L'elenco di badge e campagne si aggiorna non appena apri il pop-up, invece di aspettare il prossimo controllo automatico.",
          "pl": "Lista odznak i kampanii aktualizuje się od razu po otwarciu okienka, zamiast czekać na następne automatyczne sprawdzenie.",
          "tr": "Rozet ve kampanya listesi, otomatik denetimi beklemek yerine popup'ı açar açmaz güncelleniyor.",
          "ru": "Список значков и кампаний обновляется, как только вы открываете всплывающее окно, а не ждёт следующей автоматической проверки.",
          "ja": "バッジとキャンペーンのリストが、自動チェックを待たずにポップアップを開くとすぐ更新されます。",
          "ko": "배지와 캠페인 목록이 자동 확인을 기다리지 않고 팝업을 여는 즉시 업데이트됩니다."
        },
      },
    ],
  },

  {
    version: "26.9.31",
    date: "2026-09-30",
    title: { "fr": "Les boutons de Twitch répondent de nouveau", "en": "Twitch buttons respond again", "es": "Los botones de Twitch responden de nuevo", "pt-BR": "Os botões na Twitch voltaram a responder", "de": "Die Twitch-Schaltflächen reagieren wieder", "it": "I pulsanti su Twitch rispondono di nuovo", "pl": "Przyciski na Twitchu znowu działają", "tr": "Twitch düğmeleri yeniden çalışıyor", "ru": "Кнопки на Twitch снова работают", "ja": "Twitch上のボタンが再び動作します", "ko": "Twitch의 버튼이 다시 작동합니다" },
    changes: [
      {
        type: "fix",
        text: {
          "fr": "Sur Twitch, retirer un streamer avec le bouton « Ajouter à StreamPulse » marche de nouveau, et les réglages du panneau et du tiroir StreamPulse s'enregistrent de nouveau.",
          "en": "On Twitch, removing a streamer with the “Add to StreamPulse” button works again, and the settings in the StreamPulse panel and drawer save again.",
          "es": "En Twitch, quitar un streamer con el botón «Añadir a StreamPulse» vuelve a funcionar, y los ajustes del panel y del cajón de StreamPulse se guardan de nuevo.",
          "pt-BR": "Na Twitch, remover um streamer com o botão “Adicionar ao StreamPulse” voltou a funcionar, e os ajustes do painel e da gaveta do StreamPulse voltam a ser salvos.",
          "de": "Auf Twitch funktioniert das Entfernen eines Streamers über „Zu StreamPulse hinzufügen“ wieder, und die Einstellungen im StreamPulse-Panel und -Drawer werden wieder gespeichert.",
          "it": "Su Twitch, rimuovere uno streamer con il pulsante «Aggiungi a StreamPulse» funziona di nuovo, e le impostazioni del pannello e del cassetto StreamPulse si salvano di nuovo.",
          "pl": "Na Twitchu usuwanie streamera przyciskiem „Dodaj do StreamPulse” znowu działa, a ustawienia w panelu i szufladzie StreamPulse znowu się zapisują.",
          "tr": "Twitch'te “StreamPulse'a ekle” düğmesiyle yayıncıyı kaldırma yeniden çalışıyor ve StreamPulse panelindeki ve çekmecesindeki ayarlar yeniden kaydediliyor.",
          "ru": "На Twitch снова работает удаление стримера кнопкой «Добавить в StreamPulse», а настройки в панели и выдвижном меню StreamPulse снова сохраняются.",
          "ja": "Twitchで「StreamPulseに追加」ボタンによるストリーマーの削除が再び動作し、StreamPulseのパネルとドロワーの設定も再び保存されます。",
          "ko": "Twitch에서 「StreamPulse에 추가」 버튼으로 스트리머를 제거하는 기능이 다시 작동하고, StreamPulse 패널과 서랍의 설정도 다시 저장됩니다."
        },
      },
      {
        type: "fix",
        text: {
          "fr": "Le bouton « Ajouter à StreamPulse » retrouve son fond violet sur les pages Twitch.",
          "en": "The “Add to StreamPulse” button gets its purple background back on Twitch pages.",
          "es": "El botón «Añadir a StreamPulse» recupera su fondo morado en las páginas de Twitch.",
          "pt-BR": "O botão “Adicionar ao StreamPulse” recupera o fundo roxo nas páginas da Twitch.",
          "de": "Die Schaltfläche „Zu StreamPulse hinzufügen“ hat auf Twitch-Seiten wieder ihren violetten Hintergrund.",
          "it": "Il pulsante «Aggiungi a StreamPulse» ritrova lo sfondo viola nelle pagine di Twitch.",
          "pl": "Przycisk „Dodaj do StreamPulse” odzyskuje fioletowe tło na stronach Twitcha.",
          "tr": "“StreamPulse'a ekle” düğmesi Twitch sayfalarında mor arka planına yeniden kavuştu.",
          "ru": "Кнопка «Добавить в StreamPulse» снова получила фиолетовый фон на страницах Twitch.",
          "ja": "「StreamPulseに追加」ボタンが、Twitchのページで紫の背景に戻りました。",
          "ko": "「StreamPulse에 추가」 버튼이 Twitch 페이지에서 보라색 배경으로 돌아왔습니다."
        },
      },
    ],
  },

  {
    version: "26.9.30",
    date: "2026-09-28",
    title: { "fr": "Un popup plus vif, des réglages clairs", "en": "A snappier popup, clearer settings", "es": "Un popup más ágil, ajustes más claros", "pt-BR": "Um popup mais ágil, ajustes mais claros", "de": "Schnelleres Popup, klarere Einstellungen", "it": "Popup più rapido, impostazioni più chiare", "pl": "Szybszy popup, czytelniejsze ustawienia", "tr": "Daha hızlı popup, daha net ayarlar", "ru": "Быстрее попап, понятнее настройки", "ja": "より速いポップアップ、わかりやすい設定", "ko": "더 빠른 팝업, 더 명확한 설정" },
    changes: [
      {
        type: "fix",
        text: {
          "fr": "La page d'accueil de l'installation ne déborde plus sur les écrans étroits ni en allemand ou en russe.",
          "en": "The welcome page no longer overflows on narrow screens or in German and Russian.",
          "es": "La página de bienvenida ya no se desborda en pantallas estrechas ni en alemán o ruso.",
          "pt-BR": "A página de boas-vindas não transborda mais em telas estreitas nem em alemão ou russo.",
          "de": "Die Willkommensseite läuft auf schmalen Bildschirmen sowie auf Deutsch und Russisch nicht mehr über.",
          "it": "La pagina di benvenuto non sborda più su schermi stretti né in tedesco o russo.",
          "pl": "Strona powitalna nie wychodzi już poza ekran na wąskich ekranach ani po niemiecku i rosyjsku.",
          "tr": "Karşılama sayfası dar ekranlarda, Almanca ve Rusçada artık taşmıyor.",
          "ru": "Страница приветствия больше не выходит за края на узких экранах и на немецком или русском.",
          "ja": "ウェルカムページが狭い画面やドイツ語・ロシア語ではみ出さなくなりました。",
          "ko": "환영 페이지가 좁은 화면이나 독일어·러시아어에서 더 이상 넘치지 않습니다."
        },
      },
      {
        type: "improved",
        text: {
          "fr": "Les titres coupés dans le popup s'affichent en entier au survol.",
          "en": "Truncated titles in the popup now show in full on hover.",
          "es": "Los títulos recortados del popup se muestran completos al pasar el ratón.",
          "pt-BR": "Os títulos cortados no popup aparecem inteiros ao passar o mouse.",
          "de": "Abgeschnittene Titel im Popup werden beim Überfahren vollständig angezeigt.",
          "it": "I titoli troncati nel popup si vedono per intero al passaggio del mouse.",
          "pl": "Przycięte tytuły w okienku pokazują się w całości po najechaniu kursorem.",
          "tr": "Popup'ta kesilen başlıklar üzerine gelince tam olarak görünüyor.",
          "ru": "Обрезанные заголовки в попапе показываются целиком при наведении.",
          "ja": "ポップアップで省略されたタイトルは、ホバーすると全文が表示されます。",
          "ko": "팝업에서 잘린 제목이 마우스를 올리면 전체로 표시됩니다."
        },
      },
      {
        type: "fix",
        text: {
          "fr": "La page de restauration de sauvegarde fonctionne de nouveau : le fichier est lu, l'aperçu s'affiche et « Ajouter à mes données » refait son travail.",
          "en": "The backup restore page works again: the file is read, the preview shows up and “Add to my data” works as advertised.",
          "es": "La página de restauración de copias vuelve a funcionar: el archivo se lee, aparece la vista previa y «Añadir a mis datos» hace su trabajo.",
          "pt-BR": "A página de restauração de backup voltou a funcionar: o arquivo é lido, a prévia aparece e “Adicionar aos meus dados” faz o seu trabalho.",
          "de": "Die Seite zum Wiederherstellen einer Sicherung funktioniert wieder: Die Datei wird gelesen, die Vorschau erscheint und „Zu meinen Daten hinzufügen“ tut, was es soll.",
          "it": "La pagina di ripristino del backup funziona di nuovo: il file viene letto, l'anteprima compare e «Aggiungi ai miei dati» fa il suo lavoro.",
          "pl": "Strona przywracania kopii zapasowej znowu działa: plik jest wczytywany, podgląd się wyświetla, a „Dodaj do moich danych” robi, co trzeba.",
          "tr": "Yedek geri yükleme sayfası yeniden çalışıyor: dosya okunuyor, önizleme görünüyor ve “Verilerime ekle” işini yapıyor.",
          "ru": "Страница восстановления резервной копии снова работает: файл читается, превью появляется, а «Добавить к моим данным» делает своё дело.",
          "ja": "バックアップの復元ページが再び動作します。ファイルが読み込まれ、プレビューが表示され、「自分のデータに追加」も正しく機能します。",
          "ko": "백업 복원 페이지가 다시 작동합니다. 파일을 읽고, 미리보기가 표시되며 「내 데이터에 추가」도 제대로 동작합니다."
        },
      },
      {
        type: "improved",
        text: {
          "fr": "Les réglages sont rangés en 8 rubriques claires, ouverture sur Notifications, fonctions Plus à leur place avec leur cadenas, et une section Outils : Drops, Badges, Activité, StreamPulse+, Aide. Le tiroir Twitch suit la même organisation.",
          "en": "Settings are organized into 8 clear sections, opening on Notifications, Plus features in their right place with their lock, and a Tools area: Drops, Badges, Activity, StreamPulse+, Help. The Twitch drawer follows the same layout.",
          "es": "Los ajustes se ordenan en 8 secciones claras, empiezan por Notificaciones, las funciones Plus están en su sitio con su candado y hay una sección Herramientas: Drops, Insignias, Actividad, StreamPulse+, Ayuda. El panel de Twitch sigue la misma organización.",
          "pt-BR": "Os ajustes estão organizados em 8 seções claras, abrindo em Notificações, com os recursos Plus no lugar certo com o cadeado, e uma área Ferramentas: Drops, Emblemas, Atividade, StreamPulse+, Ajuda. A gaveta da Twitch segue a mesma organização.",
          "de": "Die Einstellungen sind in 8 klare Bereiche gegliedert, starten bei Benachrichtigungen, Plus-Funktionen stehen mit Schloss an ihrem Platz, dazu ein Werkzeuge-Bereich: Drops, Abzeichen, Aktivität, StreamPulse+, Hilfe. Die Twitch-Seitenleiste folgt demselben Aufbau.",
          "it": "Le impostazioni sono ordinate in 8 sezioni chiare, si aprono su Notifiche, le funzioni Plus stanno al loro posto con il lucchetto e c'è un'area Strumenti: Drops, Badge, Attività, StreamPulse+, Aiuto. Il pannello Twitch segue la stessa struttura.",
          "pl": "Ustawienia podzielono na 8 czytelnych sekcji, zaczynając od Powiadomień, funkcje Plus są na swoim miejscu z kłódką, a sekcja Narzędzia zawiera: Dropy, Odznaki, Aktywność, StreamPulse+, Pomoc. Panel na Twitchu ma ten sam układ.",
          "tr": "Ayarlar 8 net bölüme ayrıldı: Bildirimler ile açılıyor, Plus özellikleri kilit simgesiyle yerinde, ayrıca bir Araçlar alanı var: Drop'lar, Rozetler, Etkinlik, StreamPulse+, Yardım. Twitch çekmecesi de aynı düzeni izliyor.",
          "ru": "Настройки разложены по 8 понятным разделам: открываются на «Уведомлениях», функции Plus стоят на своих местах с замком, а в разделе «Инструменты» — дропы, значки, активность, StreamPulse+, помощь. Панель на Twitch устроена так же.",
          "ja": "設定を8つのわかりやすいセクションに整理しました。通知から始まり、Plus機能は鍵マーク付きで本来の場所に、さらにツール欄(ドロップ、バッジ、アクティビティ、StreamPulse+、ヘルプ)を用意。Twitchのドロワーも同じ構成です。",
          "ko": "설정이 8개의 명확한 섹션으로 정리되었습니다. 알림부터 시작하고, Plus 기능은 자물쇠와 함께 제자리에, 도구 영역(드롭, 배지, 활동, StreamPulse+, 도움말)도 있습니다. Twitch 서랍도 같은 구성을 따릅니다."
        },
      },
      {
        type: "new",
        text: {
          "fr": "Bouton « Réinitialiser les réglages » : tout revient comme à l'installation, ta langue et ton thème sont conservés.",
          "en": "New “Reset settings” button: everything goes back to install defaults, your language and theme are kept.",
          "es": "Nuevo botón «Restablecer ajustes»: todo vuelve a como estaba al instalar, y se conservan tu idioma y tu tema.",
          "pt-BR": "Novo botão “Redefinir ajustes”: tudo volta ao padrão da instalação, mantendo seu idioma e seu tema.",
          "de": "Neue Schaltfläche „Einstellungen zurücksetzen“: Alles kehrt zum Installationszustand zurück, Sprache und Design bleiben erhalten.",
          "it": "Nuovo pulsante «Ripristina impostazioni»: tutto torna come all'installazione, lingua e tema restano quelli che hai scelto.",
          "pl": "Nowy przycisk „Resetuj ustawienia”: wszystko wraca do stanu z instalacji, a Twój język i motyw zostają.",
          "tr": "Yeni “Ayarları sıfırla” düğmesi: her şey kurulumdaki haline döner, dilin ve temanın korunur.",
          "ru": "Новая кнопка «Сбросить настройки»: всё возвращается как после установки, язык и тема сохраняются.",
          "ja": "新しい「設定をリセット」ボタン。すべてインストール時の状態に戻り、言語とテーマはそのまま残ります。",
          "ko": "새로운 「설정 초기화」 버튼: 모든 것이 설치 직후 상태로 돌아가며, 언어와 테마는 유지됩니다."
        },
      },
      {
        type: "improved",
        text: {
          "fr": "Les alertes de live, de catégorie et de titre s'appliquent à tous tes streamers d'un coup ; chaque carte reste ajustable séparément.",
          "en": "Live, category and title alerts now apply to all your streamers at once; each card can still be adjusted on its own.",
          "es": "Las alertas de directo, categoría y título se aplican a todos tus streamers a la vez; cada tarjeta se puede ajustar por separado.",
          "pt-BR": "Os alertas de live, categoria e título agora valem para todos os seus streamers de uma vez; cada cartão continua ajustável separadamente.",
          "de": "Live-, Kategorie- und Titel-Benachrichtigungen gelten jetzt für alle deine Streamer auf einmal; jede Karte lässt sich weiterhin einzeln anpassen.",
          "it": "Gli avvisi di live, categoria e titolo ora valgono per tutti i tuoi streamer in una volta; ogni scheda resta regolabile singolarmente.",
          "pl": "Alerty o live, kategorii i tytule działają teraz dla wszystkich streamerów naraz; każdą kartę nadal można ustawić osobno.",
          "tr": "Yayın, kategori ve başlık uyarıları artık tüm yayıncılarına tek seferde uygulanıyor; her kart yine ayrı ayrı ayarlanabilir.",
          "ru": "Оповещения о трансляции, категории и названии теперь применяются ко всем стримерам сразу; каждую карточку по-прежнему можно настроить отдельно.",
          "ja": "配信・カテゴリ・タイトルの通知が、すべての配信者に一括で適用されるようになりました。各カードは個別にも調整できます。",
          "ko": "방송, 카테고리, 제목 알림이 이제 모든 스트리머에게 한 번에 적용됩니다. 각 카드는 여전히 개별 조정이 가능합니다."
        },
      },
      {
        type: "fix",
        text: {
          "fr": "Le clic sur une notification rouvre la bonne chaîne, même après une mise en veille de l'extension, et les heures calmes silencient vraiment la nuit.",
          "en": "Clicking a notification opens the right channel again, even after the extension sleeps, and quiet hours really silence the night.",
          "es": "Al pulsar una notificación se abre el canal correcto, incluso si la extensión estaba en reposo, y las horas tranquilas silencian de verdad la noche.",
          "pt-BR": "Clicar numa notificação abre o canal certo de novo, mesmo depois de a extensão entrar em repouso, e o horário silencioso realmente silencia a noite.",
          "de": "Ein Klick auf eine Benachrichtigung öffnet wieder den richtigen Kanal, auch nachdem die Erweiterung geruht hat, und die Ruhezeiten sind nachts wirklich still.",
          "it": "Un clic su una notifica riapre il canale giusto, anche dopo che l'estensione è andata in pausa, e le ore silenziose zittiscono davvero la notte.",
          "pl": "Kliknięcie powiadomienia znów otwiera właściwy kanał, nawet po uśpieniu rozszerzenia, a godziny ciszy naprawdę wyciszają noc.",
          "tr": "Bir bildirime tıklamak, eklenti uykudan sonra bile doğru kanalı yeniden açıyor ve sessiz saatler geceyi gerçekten sessizleştiriyor.",
          "ru": "Клик по уведомлению снова открывает нужный канал, даже после «сна» расширения, а тихие часы действительно глушат ночь.",
          "ja": "通知をクリックすると、拡張機能がスリープした後でも正しいチャンネルが開くようになり、おやすみ時間も夜間しっかり通知を止めます。",
          "ko": "알림을 클릭하면 확장 프로그램이 절전된 후에도 올바른 채널이 다시 열리며, 방해 금지 시간이 밤에 제대로 조용해집니다."
        },
      },
      {
        type: "fix",
        text: {
          "fr": "Le temps de visionnage ne compte plus un onglet en arrière-plan ni un live en pause, et deux fenêtres sur le même live ne comptent plus double. YouTube s'y affiche correctement, avec le bon logo.",
          "en": "Watch time no longer counts a background tab or a paused stream, and two windows on the same live no longer count twice. YouTube shows up correctly there, with the right logo.",
          "es": "El tiempo de visualización ya no cuenta una pestaña en segundo plano ni un directo en pausa, y dos ventanas del mismo directo ya no cuentan doble. YouTube aparece correctamente, con su logo.",
          "pt-BR": "O tempo assistido não conta mais uma aba em segundo plano nem uma live pausada, e duas janelas na mesma live não contam em dobro. O YouTube aparece corretamente, com o logo certo.",
          "de": "Die Zuschauzeit zählt keinen Hintergrund-Tab und keinen pausierten Stream mehr, und zwei Fenster mit demselben Live zählen nicht mehr doppelt. YouTube wird dort korrekt angezeigt, mit dem richtigen Logo.",
          "it": "Il tempo di visione non conta più una scheda in background né una live in pausa, e due finestre sulla stessa live non contano più doppio. YouTube compare correttamente, con il logo giusto.",
          "pl": "Czas oglądania nie liczy już karty w tle ani wstrzymanego live'a, a dwa okna z tym samym live'em nie liczą się podwójnie. YouTube wyświetla się poprawnie, z właściwym logo.",
          "tr": "İzleme süresi artık arka plandaki bir sekmeyi ya da duraklatılmış bir yayını saymıyor, aynı yayındaki iki pencere de çift sayılmıyor. YouTube doğru logosuyla düzgün görünüyor.",
          "ru": "Время просмотра больше не учитывает фоновую вкладку и трансляцию на паузе, а два окна с одним и тем же эфиром не считаются дважды. YouTube отображается правильно, с верным логотипом.",
          "ja": "視聴時間は、バックグラウンドのタブや一時停止中の配信をカウントしなくなり、同じ配信を2つのウィンドウで開いても二重に数えません。YouTubeも正しいロゴで正しく表示されます。",
          "ko": "시청 시간이 더 이상 백그라운드 탭이나 일시 정지된 방송을 세지 않고, 같은 방송을 두 창에서 봐도 두 번 세지 않습니다. YouTube도 올바른 로고와 함께 제대로 표시됩니다."
        },
      },
      {
        type: "fix",
        text: {
          "fr": "Connexion Kick plus fiable : le jeton est réutilisé au lieu d'être redemandé à chaque mesure, et le repli qui exposait des clés côté serveur est supprimé.",
          "en": "More reliable Kick connection: the token is reused instead of being requested at every check, and the fallback that exposed keys server-side is removed.",
          "es": "Conexión con Kick más fiable: el token se reutiliza en lugar de pedirse en cada comprobación, y se elimina el mecanismo de respaldo que exponía claves en el servidor.",
          "pt-BR": "Conexão com a Kick mais confiável: o token é reutilizado em vez de ser pedido a cada verificação, e o fallback que expunha chaves no servidor foi removido.",
          "de": "Zuverlässigere Kick-Verbindung: Das Token wird wiederverwendet, statt bei jeder Prüfung neu angefordert zu werden, und der Fallback, der serverseitig Schlüssel preisgab, ist entfernt.",
          "it": "Connessione a Kick più affidabile: il token viene riutilizzato invece di essere richiesto a ogni controllo, e il ripiego che esponeva chiavi lato server è stato rimosso.",
          "pl": "Bardziej niezawodne połączenie z Kick: token jest używany ponownie zamiast pobierania go przy każdym sprawdzeniu, a usunięto mechanizm awaryjny, który ujawniał klucze po stronie serwera.",
          "tr": "Daha güvenilir Kick bağlantısı: jeton her kontrolde yeniden istenmek yerine tekrar kullanılıyor ve anahtarları sunucu tarafında açığa çıkaran yedek yol kaldırıldı.",
          "ru": "Более надёжное подключение к Kick: токен используется повторно, а не запрашивается при каждой проверке, а запасной путь, раскрывавший ключи на сервере, удалён.",
          "ja": "Kickとの接続がより安定しました。トークンはチェックのたびに再取得せず再利用され、サーバー側でキーを露出していたフォールバックは削除されました。",
          "ko": "Kick 연결이 더 안정적입니다. 토큰을 매번 다시 요청하지 않고 재사용하며, 서버 측에서 키를 노출하던 대체 경로는 제거되었습니다."
        },
      },
      {
        type: "fix",
        text: {
          "fr": "Ton pseudo se modifie de nouveau dans « Profil et badge », et couper le badge communautaire l'arrête aussitôt, sans recharger la page.",
          "en": "Your display name is editable again in “Profile & badge”, and turning the community badge off stops it right away, no reload needed.",
          "es": "Tu nombre se puede editar de nuevo en «Perfil e insignia», y desactivar la insignia de la comunidad la detiene al instante, sin recargar la página.",
          "pt-BR": "Seu nome de exibição pode ser editado de novo em “Perfil e emblema”, e desligar o emblema da comunidade o interrompe na hora, sem recarregar a página.",
          "de": "Dein Anzeigename lässt sich in „Profil & Abzeichen“ wieder ändern, und das Community-Abzeichen verschwindet beim Ausschalten sofort, ohne Neuladen.",
          "it": "Il tuo nome si modifica di nuovo in «Profilo e badge», e disattivare il badge della community lo ferma subito, senza ricaricare la pagina.",
          "pl": "Nazwę znów można zmienić w „Profil i odznaka”, a wyłączenie odznaki społeczności działa od razu, bez przeładowania strony.",
          "tr": "Görünen adın “Profil ve rozet” bölümünde yeniden düzenlenebiliyor ve topluluk rozetini kapatmak onu sayfayı yenilemeden hemen durduruyor.",
          "ru": "Никнейм снова можно изменить в «Профиле и значке», а отключение значка сообщества срабатывает сразу, без перезагрузки страницы.",
          "ja": "「プロフィールとバッジ」で表示名を再び編集できるようになり、コミュニティバッジをオフにするとページを再読み込みせずにすぐ止まります。",
          "ko": "「프로필 및 배지」에서 닉네임을 다시 수정할 수 있으며, 커뮤니티 배지를 끄면 새로고침 없이 바로 멈춥니다."
        },
      },
      {
        type: "improved",
        text: {
          "fr": "L'onboarding commence par les notifications et tient dans les petits écrans.",
          "en": "Onboarding starts with notifications and fits small screens.",
          "es": "La bienvenida empieza por las notificaciones y cabe en pantallas pequeñas.",
          "pt-BR": "As boas-vindas começam pelas notificações e cabem em telas pequenas.",
          "de": "Das Onboarding beginnt mit den Benachrichtigungen und passt auf kleine Bildschirme.",
          "it": "L'onboarding parte dalle notifiche e sta negli schermi piccoli.",
          "pl": "Wprowadzenie zaczyna się od powiadomień i mieści się na małych ekranach.",
          "tr": "Karşılama akışı bildirimlerle başlıyor ve küçük ekranlara sığıyor.",
          "ru": "Знакомство с расширением начинается с уведомлений и помещается на маленьких экранах.",
          "ja": "オンボーディングは通知の設定から始まり、小さな画面にも収まります。",
          "ko": "온보딩이 알림 설정부터 시작하며 작은 화면에도 맞게 표시됩니다."
        },
      },
      {
        type: "improved",
        text: {
          "fr": "« Regarder » bascule sur l'onglet déjà ouvert sur la chaîne au lieu d'en ouvrir un nouveau.",
          "en": "“Watch” switches to the tab already open on that channel instead of opening a new one.",
          "es": "«Ver» cambia a la pestaña que ya tiene abierto el canal en lugar de abrir otra.",
          "pt-BR": "“Assistir” muda para a aba já aberta no canal em vez de abrir uma nova.",
          "de": "„Ansehen“ wechselt zum bereits geöffneten Tab des Kanals, statt einen neuen zu öffnen.",
          "it": "«Guarda» passa alla scheda già aperta sul canale invece di aprirne una nuova.",
          "pl": "„Oglądaj” przełącza na kartę, w której kanał jest już otwarty, zamiast otwierać nową.",
          "tr": "“İzle”, yeni bir sekme açmak yerine kanalın zaten açık olduğu sekmeye geçiyor.",
          "ru": "«Смотреть» переключает на уже открытую вкладку с каналом, а не открывает новую.",
          "ja": "「視聴」は新しいタブを開かず、そのチャンネルを開いている既存のタブに切り替えます。",
          "ko": "「시청」은 새 탭을 여는 대신 해당 채널이 이미 열려 있는 탭으로 전환합니다."
        },
      },
      {
        type: "new",
        text: {
          "fr": "Après avoir retiré un streamer, « Annuler » le remet en place avec ses notifications, son épingle et son groupe.",
          "en": "After removing a streamer, “Undo” puts them back with their notifications, pin and group.",
          "es": "Tras quitar a un streamer, «Deshacer» lo devuelve a su sitio con sus notificaciones, su fijado y su grupo.",
          "pt-BR": "Depois de remover um streamer, “Desfazer” o coloca de volta com as notificações, o fixado e o grupo.",
          "de": "Nach dem Entfernen eines Streamers stellt „Rückgängig“ ihn samt Benachrichtigungen, Anheftung und Gruppe wieder her.",
          "it": "Dopo aver rimosso uno streamer, «Annulla» lo rimette al suo posto con notifiche, fissaggio e gruppo.",
          "pl": "Po usunięciu streamera „Cofnij” przywraca go razem z powiadomieniami, przypięciem i grupą.",
          "tr": "Bir yayıncıyı kaldırdıktan sonra “Geri al”, onu bildirimleri, sabitlemesi ve grubuyla birlikte geri getiriyor.",
          "ru": "После удаления стримера «Отменить» возвращает его вместе с уведомлениями, закреплением и группой.",
          "ja": "配信者を削除した後、「元に戻す」で通知設定・ピン留め・グループごと元どおりになります。",
          "ko": "스트리머를 삭제한 뒤 「실행 취소」를 누르면 알림, 고정, 그룹까지 그대로 복원됩니다."
        },
      },
      {
        type: "new",
        text: {
          "fr": "Une recherche sans résultat propose d'ajouter directement ce que tu as tapé.",
          "en": "A search with no results offers to add exactly what you typed.",
          "es": "Una búsqueda sin resultados te propone añadir directamente lo que escribiste.",
          "pt-BR": "Uma busca sem resultados sugere adicionar direto o que você digitou.",
          "de": "Findet die Suche nichts, kannst du das Eingetippte direkt hinzufügen.",
          "it": "Una ricerca senza risultati propone di aggiungere direttamente ciò che hai digitato.",
          "pl": "Wyszukiwanie bez wyników proponuje od razu dodać to, co wpisałeś.",
          "tr": "Sonuç bulunamayan bir arama, yazdığını doğrudan eklemeyi öneriyor.",
          "ru": "Если поиск ничего не нашёл, можно сразу добавить то, что ты ввёл.",
          "ja": "検索結果がないときは、入力した名前をそのまま追加できます。",
          "ko": "검색 결과가 없으면 입력한 내용을 바로 추가하도록 제안합니다."
        },
      },
      {
        type: "improved",
        text: {
          "fr": "L'accueil s'adapte quand personne n'est en direct ou que ta liste est vide.",
          "en": "The home screen adapts when nobody is live or your list is empty.",
          "es": "La pantalla de inicio se adapta cuando nadie está en directo o tu lista está vacía.",
          "pt-BR": "A tela inicial se adapta quando ninguém está ao vivo ou sua lista está vazia.",
          "de": "Die Startansicht passt sich an, wenn niemand live ist oder deine Liste leer ist.",
          "it": "La schermata iniziale si adatta quando nessuno è in diretta o la tua lista è vuota.",
          "pl": "Ekran główny dostosowuje się, gdy nikt nie nadaje lub Twoja lista jest pusta.",
          "tr": "Ana ekran, kimse yayında değilken ya da listen boşken buna göre uyum sağlıyor.",
          "ru": "Главный экран подстраивается, когда никто не в эфире или твой список пуст.",
          "ja": "誰も配信していないときやリストが空のときに合わせて、ホーム画面の表示が変わります。",
          "ko": "아무도 방송 중이 아니거나 목록이 비어 있을 때 홈 화면이 그에 맞게 바뀝니다."
        },
      },
      {
        type: "improved",
        text: {
          "fr": "Meilleure accessibilité au clavier et contrastes renforcés dans le popup.",
          "en": "Better keyboard accessibility and stronger contrast in the popup.",
          "es": "Mejor accesibilidad con teclado y más contraste en el popup.",
          "pt-BR": "Melhor acessibilidade pelo teclado e contraste reforçado no popup.",
          "de": "Bessere Tastaturbedienung und stärkere Kontraste im Popup.",
          "it": "Migliore accessibilità da tastiera e contrasti più marcati nel popup.",
          "pl": "Lepsza obsługa klawiaturą i mocniejsze kontrasty w popupie.",
          "tr": "Popup'ta daha iyi klavye erişilebilirliği ve güçlendirilmiş kontrastlar.",
          "ru": "Удобнее управлять с клавиатуры, контраст в попапе стал выше.",
          "ja": "ポップアップのキーボード操作性を改善し、コントラストを強化しました。",
          "ko": "팝업의 키보드 접근성을 개선하고 대비를 강화했습니다."
        },
      },
      {
        type: "improved",
        text: {
          "fr": "Les demandes d'avis et de badge ne cachent plus tes lives : elles attendent quelques secondes et se placent sous la scène.",
          "en": "Review and badge prompts no longer hide your lives: they wait a few seconds and sit below the stage.",
          "es": "Las peticiones de reseña y de insignia ya no tapan tus directos: esperan unos segundos y se colocan bajo el escenario.",
          "pt-BR": "Os pedidos de avaliação e de emblema não escondem mais suas lives: esperam alguns segundos e ficam abaixo do palco.",
          "de": "Bitten um Bewertung und Abzeichen verdecken deine Lives nicht mehr: Sie warten ein paar Sekunden und erscheinen unter der Bühne.",
          "it": "Le richieste di recensione e di badge non coprono più le tue live: aspettano qualche secondo e si mettono sotto la scena.",
          "pl": "Prośby o opinię i odznakę nie zasłaniają już Twoich live'ów: czekają kilka sekund i pojawiają się pod sceną.",
          "tr": "Değerlendirme ve rozet istekleri artık yayınlarını gizlemiyor: birkaç saniye bekleyip sahnenin altına yerleşiyor.",
          "ru": "Просьбы об отзыве и значке больше не закрывают твои эфиры: они ждут несколько секунд и появляются под сценой.",
          "ja": "レビューやバッジのお願いが配信を隠さなくなりました。数秒待ってからステージの下に表示されます。",
          "ko": "리뷰 및 배지 요청이 더 이상 방송을 가리지 않습니다. 몇 초 기다린 뒤 무대 아래에 표시됩니다."
        },
      },
      {
        type: "improved",
        text: {
          "fr": "Barre du haut plus calme : un seul point par nouveauté, qui s'éteint dès que tu l'as vue.",
          "en": "A calmer top bar: a single dot per new thing, gone as soon as you've seen it.",
          "es": "Barra superior más tranquila: un solo punto por novedad, que se apaga en cuanto la ves.",
          "pt-BR": "Barra superior mais calma: um único ponto por novidade, que some assim que você a vê.",
          "de": "Ruhigere obere Leiste: ein einziger Punkt pro Neuigkeit, der verschwindet, sobald du sie gesehen hast.",
          "it": "Barra in alto più calma: un solo punto per ogni novità, che si spegne appena l'hai vista.",
          "pl": "Spokojniejszy górny pasek: jedna kropka na nowość, która znika, gdy tylko ją zobaczysz.",
          "tr": "Daha sakin üst çubuk: her yenilik için tek bir nokta, gördüğün anda sönüyor.",
          "ru": "Верхняя панель спокойнее: одна точка на каждую новинку, и она гаснет, как только ты её увидел.",
          "ja": "上部バーが落ち着いた表示に。新着ごとにドットは1つだけで、確認するとすぐ消えます。",
          "ko": "상단 바가 더 차분해졌습니다. 새 소식마다 점 하나만 표시되고, 확인하면 바로 사라집니다."
        },
      },
      {
        type: "improved",
        text: {
          "fr": "StreamPulse s'ouvre plus vite : seule ta langue est chargée.",
          "en": "StreamPulse opens faster: only your language is loaded.",
          "es": "StreamPulse se abre más rápido: solo se carga tu idioma.",
          "pt-BR": "O StreamPulse abre mais rápido: só o seu idioma é carregado.",
          "de": "StreamPulse öffnet sich schneller: Nur deine Sprache wird geladen.",
          "it": "StreamPulse si apre più in fretta: viene caricata solo la tua lingua.",
          "pl": "StreamPulse otwiera się szybciej: wczytywany jest tylko Twój język.",
          "tr": "StreamPulse daha hızlı açılıyor: yalnızca senin dilin yükleniyor.",
          "ru": "StreamPulse открывается быстрее: загружается только твой язык.",
          "ja": "StreamPulseの起動が速くなりました。読み込むのは使用中の言語だけです。",
          "ko": "StreamPulse가 더 빨리 열립니다. 사용 중인 언어만 불러옵니다."
        },
      },
      {
        type: "improved",
        text: {
          "fr": "Les pages Twitch chargent moins de code et d'images StreamPulse.",
          "en": "Twitch pages load less StreamPulse code and fewer images.",
          "es": "Las páginas de Twitch cargan menos código e imágenes de StreamPulse.",
          "pt-BR": "As páginas da Twitch carregam menos código e imagens do StreamPulse.",
          "de": "Twitch-Seiten laden weniger Code und Bilder von StreamPulse.",
          "it": "Le pagine di Twitch caricano meno codice e immagini di StreamPulse.",
          "pl": "Strony Twitcha wczytują mniej kodu i obrazów StreamPulse.",
          "tr": "Twitch sayfaları daha az StreamPulse kodu ve görseli yüklüyor.",
          "ru": "Страницы Twitch загружают меньше кода и картинок StreamPulse.",
          "ja": "TwitchのページでStreamPulseが読み込むコードと画像が減りました。",
          "ko": "Twitch 페이지에서 불러오는 StreamPulse 코드와 이미지가 줄었습니다."
        },
      },
      {
        type: "improved",
        text: {
          "fr": "Textes plus clairs et traductions complètes dans les 11 langues : plus de phrases restées en anglais.",
          "en": "Clearer wording and complete translations in all 11 languages: no more sentences left in English.",
          "es": "Textos más claros y traducciones completas en los 11 idiomas: ya no quedan frases en inglés.",
          "pt-BR": "Textos mais claros e traduções completas nos 11 idiomas: nenhuma frase ficou em inglês.",
          "de": "Klarere Texte und vollständige Übersetzungen in allen 11 Sprachen: keine Sätze mehr, die auf Englisch geblieben sind.",
          "it": "Testi più chiari e traduzioni complete in tutte le 11 lingue: niente più frasi rimaste in inglese.",
          "pl": "Jaśniejsze teksty i pełne tłumaczenia we wszystkich 11 językach: koniec ze zdaniami po angielsku.",
          "tr": "Daha net metinler ve 11 dilin tamamında eksiksiz çeviriler: İngilizce kalan cümle yok.",
          "ru": "Тексты понятнее, переводы полные на всех 11 языках: больше никаких фраз, оставшихся на английском.",
          "ja": "文言をよりわかりやすくし、11言語すべてで翻訳を完成させました。英語のまま残った文はもうありません。",
          "ko": "문구를 더 명확하게 다듬고 11개 언어 모두 번역을 완성했습니다. 영어로 남은 문장은 더 이상 없습니다."
        },
      },
    ],
  },

  {
    version: "26.9.29",
    date: "2026-09-27",
    title: {
      fr: "Un badge d'ancienneté plus lisible",
      en: "A clearer seniority badge",
      es: "Una insignia de antigüedad más legible",
      "pt-BR": "Um emblema de antiguidade mais legível",
      de: "Ein besser lesbares Treueabzeichen",
      it: "Un badge di anzianità più leggibile",
      pl: "Czytelniejsza odznaka stażu",
      tr: "Daha okunaklı bir kıdem rozeti",
      ru: "Значок стажа стал четче",
      ja: "見やすくなった継続バッジ",
      ko: "더 선명해진 연속 배지",
    },
    changes: [
      {
        type: "new",
        area: "plus",
        text: {
          fr: "Le parrainage sort de sa cachette : il est maintenant dans les Réglages généraux, et un bouton « Copier mon code » attend à la fin de ton récap.",
          en: "Referrals step into the light: they now live in General settings, and a “Copy my code” button waits at the end of your recap.",
          es: "El programa de amigos sale de su escondite: ahora está en los ajustes generales y un botón «Copiar mi código» te espera al final de tu resumen.",
          "pt-BR": "O programa de indicações saiu do esconderijo: ele agora está nos ajustes gerais, e um botão “Copiar meu código” espera no final do seu resumo.",
          de: "Das Freundschaftswerben kommt aus seinem Versteck: es gibt es jetzt in den allgemeinen Einstellungen, und am Ende deines Rückblicks wartet die Schaltfläche „Code kopieren“.",
          it: "Il programma inviti esce dal nascondiglio: ora si trova nelle impostazioni generali e alla fine del tuo riepilogo ti aspetta il pulsante «Copia il mio codice».",
          pl: "Polecanie wychodzi z ukrycia: znajdziesz je teraz w ogólnych ustawieniach, a na końcu podsumowania czeka przycisk „Skopiuj mój kod”.",
          tr: "Arkadaşını davet etme artık saklanmıyor: genel ayarlarda yerini aldı, özetinin sonunda da “Kodumu kopyala” düğmesi seni bekliyor.",
          ru: "Реферальная программа больше не прячется: она появилась в общих настройках, а в конце итогов вас ждёт кнопка «Скопировать код».",
          ja: "紹介プログラムが見える場所に：全般設定に追加され、まとめの最後に「コードをコピー」ボタンが付きました。",
          ko: "추천 프로그램이 드러났습니다: 일반 설정에 추가되었고, 요약 마지막에 “내 코드 복사” 버튼이 생겼습니다.",
        },
      },
      {
        type: "fix",
        area: "badges",
        text: {
          fr: "Les badges « League of Legends Classic » et Elden Ring, liés à des événements terminés, ne sont plus proposés comme disponibles ni visés par le mode auto.",
          en: "The “League of Legends Classic” and Elden Ring badges, from events that have ended, are no longer shown as available or targeted by auto mode.",
          es: "Las insignias «League of Legends Classic» y de Elden Ring, de eventos ya terminados, ya no aparecen como disponibles ni las busca el modo automático.",
          "pt-BR": "Os selos “League of Legends Classic” e de Elden Ring, de eventos já encerrados, não aparecem mais como disponíveis nem são buscados pelo modo automático.",
          de: "Die Abzeichen „League of Legends Classic“ und Elden Ring aus beendeten Events werden nicht mehr als verfügbar angezeigt und vom Auto-Modus nicht mehr angesteuert.",
          it: "I badge «League of Legends Classic» ed Elden Ring, legati a eventi conclusi, non vengono più mostrati come disponibili né cercati dalla modalità automatica.",
          pl: "Odznaki „League of Legends Classic” i Elden Ring z zakończonych wydarzeń nie są już pokazywane jako dostępne ani wybierane przez tryb automatyczny.",
          tr: "Sona ermiş etkinliklere ait “League of Legends Classic” ve Elden Ring rozetleri artık mevcut olarak gösterilmiyor ve otomatik mod tarafından hedeflenmiyor.",
          ru: "Значки «League of Legends Classic» и Elden Ring с завершившихся событий больше не отображаются как доступные и не выбираются автоматическим режимом.",
          ja: "終了したイベントの「League of Legends Classic」と Elden Ring のバッジは、入手可能として表示されず、自動モードの対象にもならなくなりました。",
          ko: "종료된 이벤트의 ‘League of Legends Classic’ 배지와 Elden Ring 배지는 더 이상 획득 가능으로 표시되지 않으며 자동 모드 대상에서도 빠집니다.",
        },
      },
      {
        type: "improved",
        area: "plus",
        text: {
          fr: "Badge d'ancienneté : la licence à vie passe à un disque noir avec anneau et logo dorés, bien plus lisible dans le tchat, et le fondateur de StreamPulse a son propre badge.",
          en: "Loyalty badge: the lifetime license now shows a black disc with a gold ring and logo, much easier to read in chat, and the StreamPulse founder gets a dedicated badge.",
          es: "Insignia de antigüedad: la licencia de por vida pasa a un disco negro con anillo y logo dorados, mucho más legible en el chat, y el fundador de StreamPulse tiene su propia insignia.",
          "pt-BR": "Selo de fidelidade: a licença vitalícia passa a um disco preto com anel e logo dourados, bem mais legível no chat, e o fundador do StreamPulse ganha um selo próprio.",
          de: "Treue-Abzeichen: Die lebenslange Lizenz zeigt jetzt eine schwarze Scheibe mit goldenem Ring und Logo, im Chat viel besser lesbar, und der StreamPulse-Gründer hat ein eigenes Abzeichen.",
          it: "Badge di anzianità: la licenza a vita passa a un disco nero con anello e logo dorati, molto più leggibile in chat, e il fondatore di StreamPulse ha un badge tutto suo.",
          pl: "Odznaka stażu: licencja dożywotnia to teraz czarny krąg ze złotym pierścieniem i logo, znacznie czytelniejszy na czacie, a założyciel StreamPulse ma własną odznakę.",
          tr: "Kıdem rozeti: ömür boyu lisans artık altın halkalı ve altın logolu siyah bir daire, sohbette çok daha okunaklı; StreamPulse'un kurucusunun da kendine ait bir rozeti var.",
          ru: "Значок стажа: пожизненная лицензия теперь — чёрный круг с золотым кольцом и логотипом, в чате он читается гораздо лучше, а у основателя StreamPulse свой значок.",
          ja: "継続バッジ：永久ライセンスは金のリングとロゴが付いた黒い円になり、チャットでずっと見やすくなりました。StreamPulse の創設者には専用のバッジがあります。",
          ko: "구독 기간 배지: 평생 라이선스는 금색 고리와 로고가 들어간 검은 원으로 바뀌어 채팅에서 훨씬 잘 보이고, StreamPulse 창립자는 전용 배지를 갖습니다.",
        },
      },
      {
        type: "fix",
        area: "badges",
        text: {
          fr: "Le badge StreamPulse d'une personne disparaît du tchat au plus tard 7 jours après qu'elle a supprimé l'extension ou coupé son badge communautaire.",
          en: "A person's StreamPulse badge now disappears from chat at most 7 days after they remove the extension or turn off their community badge.",
          es: "La insignia StreamPulse de una persona desaparece del chat como máximo 7 días después de que elimine la extensión o desactive su insignia comunitaria.",
          "pt-BR": "O selo StreamPulse de uma pessoa some do chat no máximo 7 dias depois que ela remove a extensão ou desativa o selo da comunidade.",
          de: "Das StreamPulse-Abzeichen einer Person verschwindet spätestens 7 Tage, nachdem sie die Erweiterung entfernt oder ihr Community-Abzeichen ausgeschaltet hat, aus dem Chat.",
          it: "Il badge StreamPulse di una persona sparisce dalla chat al massimo 7 giorni dopo che ha rimosso l'estensione o disattivato il badge della community.",
          pl: "Odznaka StreamPulse danej osoby znika z czatu najpóźniej 7 dni po usunięciu rozszerzenia lub wyłączeniu odznaki społeczności.",
          tr: "Bir kişinin StreamPulse rozeti, eklentiyi kaldırdıktan ya da topluluk rozetini kapattıktan en geç 7 gün sonra sohbetten kaybolur.",
          ru: "Значок StreamPulse пропадает из чата не позже чем через 7 дней после того, как человек удалил расширение или отключил значок сообщества.",
          ja: "拡張機能を削除するか、コミュニティバッジをオフにすると、その人の StreamPulse バッジは最長 7 日でチャットから消えます。",
          ko: "확장 프로그램을 삭제하거나 커뮤니티 배지를 끄면, 해당 사용자의 StreamPulse 배지는 최대 7일 안에 채팅에서 사라집니다.",
        },
      },
      {
        type: "improved",
        area: "plus",
        text: {
          fr: "Badge d'ancienneté Jauge plus lisible dans le tchat : un disque plein de la couleur de ton palier, un anneau blanc qui se remplit et un logo bien net, avec un reflet à partir d'un an.",
          en: "The Gauge loyalty badge is easier to read in chat: a solid disc in your tier's color, a white ring that fills up and a crisp logo, with a shine from one year on.",
          es: "La insignia de antigüedad Indicador se lee mejor en el chat: un disco lleno del color de tu nivel, un anillo blanco que se llena y un logo nítido, con un brillo a partir de un año.",
          "pt-BR": "O selo de fidelidade Medidor ficou mais legível no chat: um disco cheio na cor do seu nível, um anel branco que se enche e um logo nítido, com um brilho a partir de um ano.",
          de: "Das Treue-Abzeichen Anzeige ist im Chat besser lesbar: eine volle Scheibe in der Farbe deiner Stufe, ein weißer Ring, der sich füllt, und ein scharfes Logo, ab einem Jahr mit Glanz.",
          it: "Il badge di anzianità Indicatore si legge meglio in chat: un disco pieno del colore del tuo livello, un anello bianco che si riempie e un logo nitido, con un riflesso da un anno in su.",
          pl: "Odznaka stażu Wskaźnik jest czytelniejsza na czacie: pełny krąg w kolorze twojego poziomu, biały pierścień, który się wypełnia, i wyraźne logo, z połyskiem od roku.",
          tr: "Gösterge kıdem rozeti sohbette daha okunaklı: seviyenin renginde dolu bir daire, dolan beyaz bir halka ve net bir logo; bir yıldan sonra parıltılı.",
          ru: "Значок стажа «Шкала» лучше читается в чате: сплошной круг цвета твоего уровня, белое кольцо, которое заполняется, и чёткий логотип, с бликом начиная с года.",
          ja: "継続バッジ「ゲージ」がチャットで見やすくなりました。段階の色で塗られた円、満ちていく白いリング、くっきりしたロゴで、1 年目からは光沢が入ります。",
          ko: "구독 기간 배지 ‘게이지’가 채팅에서 더 잘 보입니다. 단계 색으로 채운 원, 차오르는 흰 고리, 선명한 로고에 1년부터는 반짝임이 더해집니다.",
        },
      },
    ],
  },

  {
    version: "26.9.28",
    date: "2026-09-27",
    title: {
      fr: "Badge d'ancienneté et effets façon 7TV",
      en: "Seniority badge and 7TV-style effects",
      es: "Insignia de antigüedad y efectos estilo 7TV",
      "pt-BR": "Emblema de antiguidade e efeitos estilo 7TV",
      de: "Treueabzeichen und Effekte im 7TV-Stil",
      it: "Badge di anzianità ed effetti stile 7TV",
      pl: "Odznaka stażu i efekty jak w 7TV",
      tr: "Kıdem rozeti ve 7TV tarzı efektler",
      ru: "Значок стажа и эффекты в стиле 7TV",
      ja: "継続バッジと7TV風エフェクト",
      ko: "연속 배지와 7TV 스타일 효과",
    },
    changes: [
      {
        type: "new",
        area: "plus",
        text: {
          fr: "Badge d'ancienneté StreamPulse+ : dans l'effet du badge, choisis « Jauge », une pastille dont l'anneau se remplit au fil des mois, ou « Pager », l'écran de StreamPulse dans une coque qui change de matière. De 1 mois à 4 ans, doré pour la licence à vie. C'est le badge par défaut si tu n'as choisi aucun effet, et tes mois d'abonnement se cumulent, même après une pause.",
          en: "StreamPulse+ loyalty badge: as your badge effect, pick “Gauge”, a badge whose ring fills up month after month, or “Pager”, the StreamPulse screen in a case that changes material. From 1 month to 4 years, gold for lifetime licenses. It's the default badge if you haven't picked an effect, and your subscribed months add up, even after a break.",
          es: "Insignia de antigüedad StreamPulse+: como efecto de insignia, elige «Indicador», un anillo que se llena mes a mes, o «Pager», la pantalla de StreamPulse en una carcasa que cambia de material. De 1 mes a 4 años, dorada para la licencia de por vida. Es la insignia por defecto si no has elegido ningún efecto, y tus meses de suscripción se acumulan, incluso tras una pausa.",
          "pt-BR": "Selo de fidelidade StreamPulse+: como efeito do selo, escolha “Medidor”, um anel que se enche mês a mês, ou “Pager”, a tela do StreamPulse numa capa que muda de material. De 1 mês a 4 anos, dourado para a licença vitalícia. É o selo padrão se você não escolheu nenhum efeito, e seus meses de assinatura se acumulam, mesmo depois de uma pausa.",
          de: "StreamPulse+-Treue-Abzeichen: Wähle als Abzeichen-Effekt „Anzeige“, einen Ring, der sich Monat für Monat füllt, oder „Pager“, den StreamPulse-Bildschirm in einem Gehäuse, dessen Material wechselt. Von 1 Monat bis 4 Jahre, golden für die lebenslange Lizenz. Es ist das Standard-Abzeichen, wenn du keinen Effekt gewählt hast, und deine Abomonate addieren sich, auch nach einer Pause.",
          it: "Badge di anzianità StreamPulse+: come effetto del badge scegli «Indicatore», un anello che si riempie mese dopo mese, o «Pager», lo schermo di StreamPulse in una scocca che cambia materiale. Da 1 mese a 4 anni, dorato per la licenza a vita. È il badge predefinito se non hai scelto alcun effetto, e i mesi di abbonamento si sommano, anche dopo una pausa.",
          pl: "Odznaka stażu StreamPulse+: jako efekt odznaki wybierz „Wskaźnik”, pierścień, który wypełnia się z miesiąca na miesiąc, lub „Pager”, ekran StreamPulse w obudowie zmieniającej materiał. Od 1 miesiąca do 4 lat, złota dla licencji dożywotniej. To domyślna odznaka, jeśli nie wybrano żadnego efektu, a miesiące subskrypcji sumują się, nawet po przerwie.",
          tr: "StreamPulse+ kıdem rozeti: rozet efekti olarak ay ay dolan bir halka olan “Gösterge”yi ya da malzemesi değişen bir kasadaki StreamPulse ekranı “Çağrı cihazı”nı seç. 1 aydan 4 yıla kadar, ömür boyu lisans için altın. Hiç efekt seçmediysen varsayılan rozet budur ve abonelik ayların, ara versen bile toplanır.",
          ru: "Значок стажа StreamPulse+: в эффекте значка выбери «Шкалу» — кольцо, которое заполняется месяц за месяцем, или «Пейджер» — экран StreamPulse в корпусе, материал которого меняется. От 1 месяца до 4 лет, золотой для пожизненной лицензии. Это значок по умолчанию, если ты не выбрал эффект, а месяцы подписки суммируются, даже после перерыва.",
          ja: "StreamPulse+ 継続バッジ：バッジ効果で、月ごとにリングが満ちていく「ゲージ」か、素材が変わるケースに StreamPulse の画面が入った「ポケベル」を選べます。1 か月から 4 年まで、永久ライセンスは金色です。効果を選んでいない場合はこれが既定のバッジになり、サブスク期間は中断をはさんでも合算されます。",
          ko: "StreamPulse+ 구독 기간 배지: 배지 효과에서 달마다 고리가 채워지는 ‘게이지’나, 재질이 바뀌는 케이스 속 StreamPulse 화면인 ‘삐삐’를 고르세요. 1개월부터 4년까지, 평생 라이선스는 금색입니다. 효과를 고르지 않았다면 기본 배지가 되며, 구독 개월 수는 중간에 쉬어도 합산됩니다.",
        },
      },
      {
        type: "new",
        area: "plus",
        text: {
          fr: "Pseudo et badge repensés, comme les « paints » de 7TV : un seul nuancier pour le logo et le pseudo, 7 dégradés et 9 textures (Galaxie, Holographique, Lave, Marbre, Chrome, Paillettes, Sucre d'orge, Toxique, Océan), chacun avec son animation intégrée. Les animations à choisir à part (Pulsation, Rebond…) et les effets Néon et Glitch sont retirés : un badge qui en utilisait un revient au logo classique, et Prisme devient Arc-en-ciel.",
          en: "Name and badge redesigned, like 7TV paints: one palette for the logo and the name, 7 gradients and 9 textures (Galaxy, Holographic, Lava, Marble, Chrome, Glitter, Candy cane, Toxic, Ocean), each with its own built-in animation. Separate animations (Pulse, Bounce…) and the Neon and Glitch effects are gone: a badge that used one goes back to the classic logo, and Prism becomes Rainbow.",
          es: "Nombre e insignia rediseñados, como los «paints» de 7TV: una sola paleta para el logo y el nombre, 7 degradados y 9 texturas (Galaxia, Holográfico, Lava, Mármol, Cromo, Purpurina, Bastón de caramelo, Tóxico, Océano), cada una con su animación integrada. Se retiran las animaciones aparte (Pulso, Rebote…) y los efectos Neón y Glitch: una insignia que los usaba vuelve al logo clásico, y Prisma pasa a Arcoíris.",
          "pt-BR": "Nome e selo redesenhados, como os “paints” do 7TV: uma só paleta para o logo e o nome, 7 degradês e 9 texturas (Galáxia, Holográfico, Lava, Mármore, Cromo, Glitter, Bengala doce, Tóxico, Oceano), cada uma com sua animação embutida. As animações à parte (Pulso, Quique…) e os efeitos Neon e Glitch saem: um selo que usava um deles volta ao logo clássico, e Prisma vira Arco-íris.",
          de: "Name und Abzeichen neu gestaltet, wie die „Paints“ von 7TV: eine Palette für Logo und Namen, 7 Verläufe und 9 Texturen (Galaxie, Holografisch, Lava, Marmor, Chrom, Glitzer, Zuckerstange, Toxisch, Ozean), jede mit eigener Animation. Separate Animationen (Puls, Hüpfen…) sowie die Effekte Neon und Glitch entfallen: Ein Abzeichen mit einem davon wird wieder zum klassischen Logo, und Prisma wird zu Regenbogen.",
          it: "Nome e badge ridisegnati, come i «paint» di 7TV: una sola palette per logo e nome, 7 sfumature e 9 texture (Galassia, Olografico, Lava, Marmo, Cromo, Glitter, Bastoncino di zucchero, Tossico, Oceano), ognuna con la sua animazione integrata. Le animazioni separate (Pulsazione, Rimbalzo…) e gli effetti Neon e Glitch vengono rimossi: un badge che ne usava uno torna al logo classico, e Prisma diventa Arcobaleno.",
          pl: "Nazwa i odznaka od nowa, jak „painty” w 7TV: jedna paleta dla logo i nazwy, 7 gradientów i 9 tekstur (Galaktyka, Holograficzny, Lawa, Marmur, Chrom, Brokat, Laska cukrowa, Toksyczny, Ocean), każda z wbudowaną animacją. Osobne animacje (Puls, Odbicie…) oraz efekty Neon i Glitch znikają: odznaka, która z nich korzystała, wraca do klasycznego logo, a Pryzmat staje się Tęczą.",
          tr: "Ad ve rozet, 7TV'nin “paint”leri gibi yeniden tasarlandı: logo ve ad için tek palet, her biri kendi animasyonuyla 7 geçiş ve 9 doku (Galaksi, Holografik, Lav, Mermer, Krom, Simli, Şeker kamışı, Toksik, Okyanus). Ayrı animasyonlar (Nabız, Zıplama…) ile Neon ve Glitch efektleri kaldırıldı: bunlardan birini kullanan rozet klasik logoya döner, Prizma ise Gökkuşağı olur.",
          ru: "Ник и значок переработаны по примеру «paints» из 7TV: одна палитра для логотипа и ника, 7 градиентов и 9 текстур (Галактика, Голограмма, Лава, Мрамор, Хром, Блёстки, Леденец, Токсичный, Океан), у каждой своя встроенная анимация. Отдельные анимации (Пульс, Прыжок…) и эффекты Неон и Глитч убраны: значок с одним из них возвращается к классическому логотипу, а Призма становится Радугой.",
          ja: "名前とバッジを 7TV の「ペイント」のように刷新：ロゴと名前に共通のパレット、7 種類のグラデーションと 9 種類のテクスチャ（ギャラクシー、ホログラム、溶岩、大理石、クローム、グリッター、キャンディケイン、トキシック、オーシャン）で、それぞれにアニメーションが組み込まれています。個別のアニメーション（パルス、バウンスなど）とネオン・グリッチ効果は廃止され、それらを使っていたバッジはクラシックのロゴに戻り、プリズムはレインボーになります。",
          ko: "닉네임과 배지를 7TV의 ‘페인트’처럼 새로 디자인했습니다. 로고와 닉네임에 같은 팔레트, 각자 애니메이션이 들어간 그라데이션 7종과 텍스처 9종(갤럭시, 홀로그램, 용암, 대리석, 크롬, 글리터, 캔디 케인, 독성, 바다). 별도 애니메이션(펄스, 바운스 등)과 네온·글리치 효과는 사라지며, 이를 쓰던 배지는 클래식 로고로 돌아가고 프리즘은 무지개가 됩니다.",
        },
      },
      {
        type: "fix",
        area: "onboarding",
        text: {
          fr: "L'étape Réglages de l'installation ne propose plus la récupération automatique des Moments : Twitch a retiré cette fonctionnalité.",
          en: "The Settings step of the first-time setup no longer offers automatic Moments claiming: Twitch removed that feature.",
          es: "El paso de Ajustes de la instalación ya no ofrece el reclamo automático de Moments: Twitch eliminó esta función.",
          "pt-BR": "A etapa de Configurações da instalação não oferece mais o resgate automático de Moments: a Twitch removeu esse recurso.",
          de: "Der Einstellungsschritt der Ersteinrichtung bietet kein automatisches Abholen von Moments mehr: Twitch hat diese Funktion entfernt.",
          it: "Il passaggio Impostazioni della configurazione iniziale non propone più il riscatto automatico dei Moments: Twitch ha rimosso questa funzionalità.",
          pl: "Krok Ustawienia w pierwszej konfiguracji nie oferuje już automatycznego odbierania Moments: Twitch usunął tę funkcję.",
          tr: "Kurulumun Ayarlar adımı artık otomatik Moments almayı sunmuyor: Twitch bu özelliği kaldırdı.",
          ru: "На шаге настроек первичной настройки больше нет автоматического получения Moments: Twitch удалил эту функцию.",
          ja: "初期設定の「設定」ステップで、Moments の自動受け取りを提案しなくなりました。Twitch がこの機能を終了したためです。",
          ko: "초기 설정의 설정 단계에서 Moments 자동 수령을 더 이상 제공하지 않습니다. Twitch가 이 기능을 제거했습니다.",
        },
      },
      {
        type: "improved",
        area: "onboarding",
        text: {
          fr: "L'écran final de l'installation est repensé : un aperçu de la notification que tu recevras au prochain direct de ton premier streamer suivi, le bandeau de tes streamers, et un contenu bien ancré dans la page.",
          en: "The final screen of the first-time setup is redesigned: a preview of the notification you'll get when your first followed streamer goes live, a strip of your streamers, and content properly anchored in the page.",
          es: "La pantalla final de la instalación está rediseñada: una vista previa de la notificación que recibirás cuando tu primer streamer seguido inicie un directo, una tira con tus streamers y un contenido bien anclado en la página.",
          "pt-BR": "A tela final da instalação foi redesenhada: uma prévia da notificação que você receberá quando o primeiro streamer seguido iniciar uma live, uma faixa com seus streamers e um conteúdo bem ancorado na página.",
          de: "Der letzte Bildschirm der Ersteinrichtung ist neu gestaltet: eine Vorschau der Benachrichtigung, die du beim nächsten Live deines ersten gefolgten Streamers erhältst, eine Leiste mit deinen Streamern und ein inhaltsverankerter Seitenaufbau.",
          it: "La schermata finale della configurazione iniziale è stata ridisegnata: un'anteprima della notifica che riceverai quando il primo streamer seguito andrà in diretta, una striscia con i tuoi streamer e un contenuto ben ancorato nella pagina.",
          pl: "Ostatni ekran pierwszej konfiguracji został przeprojektowany: podgląd powiadomienia, które otrzymasz, gdy pierwszy obserwowany streamer rozpocznie transmisję, pasek twoich streamerów i treść dobrze osadzona na stronie.",
          tr: "Kurulumun son ekranı yeniden tasarlandı: takip ettiğin ilk yayıncı yayına başladığında alacağın bildirimin önizlemesi, yayıncıların bulunduğu bir şerit ve sayfaya düzgün biçimde yerleşen bir içerik.",
          ru: "Финальный экран первичной настройки переоформлен: предпросмотр уведомления, которое вы получите, когда первый отслеживаемый стример выйдет в эфир, лента ваших стримеров и содержимое, аккуратно закреплённое на странице.",
          ja: "初期設定の最終画面を刷新しました。フォロー中の最初のストリーマーが配信を始めたときに届く通知のプレビュー、フォロー中ストリーマーのリスト、ページにしっかり収まるレイアウトになります。",
          ko: "초기 설정의 마지막 화면이 새로 디자인되었습니다. 첫 번째 팔로우한 스트리머가 방송을 시작할 때 받을 알림 미리보기, 팔로우한 스트리머 목록, 페이지에 안정적으로 배치된 콘텐츠가 표시됩니다.",
        },
      },
      {
        type: "new",
        area: "badges",
        text: {
          fr: "Le badge communautaire se propose maintenant tout seul : une carte dans la popup l'active en un clic (avec le rappel de confidentialité), et l'installation met l'aperçu du tchat en avant avant l'interrupteur.",
          en: "The community badge now offers itself: a card in the popup turns it on in one click (with the privacy reminder), and the first-time setup shows the chat preview before the switch.",
          es: "La insignia comunitaria ahora se ofrece sola: una tarjeta en la ventana emergente la activa en un clic (con el recordatorio de privacidad), y la instalación muestra la vista previa del chat antes del interruptor.",
          "pt-BR": "O emblema comunitário agora se oferece sozinho: um cartão na janela o ativa com um clique (com o lembrete de privacidade), e a instalação mostra a prévia do chat antes da chave.",
          de: "Das Community-Abzeichen bietet sich jetzt von selbst an: Eine Karte im Popup aktiviert es mit einem Klick (mit dem Datenschutz-Hinweis), und die Ersteinrichtung zeigt die Chat-Vorschau vor dem Schalter.",
          it: "Il badge della community ora si propone da solo: una scheda nel popup lo attiva con un clic (con il promemoria sulla privacy), e la configurazione iniziale mostra l'anteprima della chat prima dell'interruttore.",
          pl: "Odznaka społeczności teraz sama się proponuje: karta w okienku włącza ją jednym kliknięciem (z przypomnieniem o prywatności), a pierwsza konfiguracja pokazuje podgląd czatu przed przełącznikiem.",
          tr: "Topluluk rozeti artık kendini öneriyor: popup'taki bir kart onu tek tıkla açar (gizlilik hatırlatmasıyla) ve kurulum, anahtarın önünde sohbet önizlemesini gösterir.",
          ru: "Значок сообщества теперь предлагает себя сам: карточка во всплывающем окне включает его одним щелчком (с напоминанием о конфиденциальности), а при первой настройке превью чата показано до переключателя.",
          ja: "コミュニティバッジが自分から提案されるようになりました。ポップアップのカードでワンクリックでオンになり（プライバシーの説明つき）、初期設定ではスイッチの前にチャットのプレビューを表示します。",
          ko: "커뮤니티 배지가 이제 스스로 제안됩니다. 팝업의 카드로 한 번에 켤 수 있고(개인정보 안내 포함), 초기 설정에서는 스위치 전에 채팅 미리보기를 보여줍니다.",
        },
      },
      {
        type: "fix",
        area: "badges",
        text: {
          fr: "Mode auto des badges : l'onglet franchit maintenant tout seul les écrans bloquants (contenu averti, conditions du chat) qui laissaient le live en pause sans faire progresser les badges. La qualité 360p et le volume quasi nul sont réappliqués après les pubs et les reprises de live.",
          en: "Badge auto mode: the tab now gets past blocking screens on its own (mature content, chat consent) that left the stream paused and badges frozen. The 360p quality and near-silent volume are reapplied after ads and stream restarts.",
          es: "Modo automático de insignias: la pestaña ahora supera sola las pantallas de bloqueo (contenido adulto, condiciones del chat) que dejaban el directo en pausa sin hacer avanzar las insignias. La calidad 360p y el volumen casi nulo se reaplican tras los anuncios y las reanudaciones.",
          "pt-BR": "Modo automático de emblemas: a aba agora passa sozinha pelas telas de bloqueio (conteúdo adulto, termos do chat) que deixavam a live pausada sem fazer os emblemas avançarem. A qualidade 360p e o volume quase nulo são reaplicados após anúncios e retomadas.",
          de: "Automodus für Abzeichen: Der Tab übersteht jetzt selbst die blockierenden Bildschirme (Inhalte für Erwachsene, Chat-Zustimmung), die den Stream pausiert und die Abzeichen eingefroren haben. 360p und das nahezu stumme Volumen werden nach Werbung und Stream-Neustarts erneut gesetzt.",
          it: "Modalità automatica dei badge: la scheda ora supera da sola le schermate bloccanti (contenuti per adulti, consenso della chat) che lasciavano il live in pausa senza far avanzare i badge. La qualità 360p e il volume quasi muto vengono riapplicati dopo pubblicità e riprese.",
          pl: "Tryb automatyczny odznak: karta sama przechodzi teraz przez blokujące ekrany (treści dla dorosłych, zgody czatu), które wstrzymywały transmisję i blokowały postęp odznak. Jakość 360p i niemal cisza są przywracane po reklamach i wznowieniach.",
          tr: "Rozet otomatik modu: sekme artık yayını duraklatıp rozetleri dondururan engel ekranları (yetişkin içeriği, sohbet onayı) kendi başına geçiyor. 360p kalite ve neredeyse sessiz ses, reklamlardan ve yayının devamından sonra yeniden uygulanıyor.",
          ru: "Автоматический режим значков: вкладка теперь сама проходит блокирующие экраны (контент 18+, согласие в чате), из-за которых трансляция оставалась на паузе, а значки не двигались. Качество 360p и почти нулевая громкость применяются заново после рекламы и возобновления трансляций.",
          ja: "バッジ自動モード：ライブを一時停止したままバッジが進まない原因だったブロック画面（年齢確認、チャットの同意）を、タブが自動で通過します。広告や配信の再開後も、360p とほぼ無音の音量を再適用します。",
          ko: "배지 자동 모드: 라이브를 일시정지 상태로 두어 배지가 진행되지 않던 차단 화면(성인 콘텐츠, 채팅 동의)을 탭이 이제 스스로 넘어갑니다. 광고와 재시작 후에도 360p 화질과 거의 들리지 않는 음량이 다시 적용됩니다.",
        },
      },
    ],
  },

  {
    version: "26.9.27",
    date: "2026-09-27",
    title: {
      fr: "Drops, badges, points et effets de pseudo",
      en: "Drops, badges, points and username effects",
      es: "Drops, insignias, puntos y efectos de nombre",
      "pt-BR": "Drops, emblemas, pontos e efeitos de nome",
      de: "Drops, Abzeichen, Punkte und Namenseffekte",
      it: "Drops, badge, punti ed effetti per il nome",
      pl: "Dropsy, odznaki, punkty i efekty nicku",
      tr: "Drop'lar, rozetler, puanlar ve kullanıcı adı efektleri",
      ru: "Drops, значки, баллы и эффекты ника",
      ja: "ドロップ、バッジ、ポイント、名前エフェクト",
      ko: "드롭, 배지, 포인트, 닉네임 효과",
    },
    changes: [
      {
        type: "new",
        area: "drops",
        text: {
          fr: "Nouveau panneau Drops dans les Réglages : tes Drops Twitch en cours avec leur progression et le temps restant, ceux prêts à récupérer, et les campagnes de Twitch avec des filtres (nouvelles, finissent bientôt, à venir), celles de tes jeux en premier. Avec StreamPulse+, l'historique de tous tes Drops obtenus, mois par mois, avec le jeu et la chaîne.",
          en: "New Drops panel in Settings: your Twitch Drops in progress with their progress and time left, the ones ready to claim, and Twitch's campaigns with filters (new, ending soon, upcoming), your games first. With StreamPulse+, the history of every Drop you earned, month by month, with the game and the channel.",
          es: "Nuevo panel Drops en los Ajustes: tus Drops de Twitch en curso con su progreso y el tiempo restante, los que están listos para reclamar y las campañas de Twitch con filtros (nuevas, terminan pronto, próximas), primero las de tus juegos. Con StreamPulse+, el historial de todos tus Drops obtenidos, mes a mes, con el juego y el canal.",
          "pt-BR": "Novo painel Drops nas Configurações: seus Drops da Twitch em andamento com o progresso e o tempo restante, os prontos para resgatar e as campanhas da Twitch com filtros (novas, terminam em breve, em breve), primeiro as dos seus jogos. Com o StreamPulse+, o histórico de todos os Drops obtidos, mês a mês, com o jogo e o canal.",
          de: "Neues Drops-Panel in den Einstellungen: deine laufenden Twitch-Drops mit Fortschritt und Restzeit, die abholbereiten und die Twitch-Kampagnen mit Filtern (neu, enden bald, demnächst), deine Spiele zuerst. Mit StreamPulse+ der Verlauf aller erhaltenen Drops, Monat für Monat, mit Spiel und Kanal.",
          it: "Nuovo pannello Drops nelle Impostazioni: i tuoi Drops di Twitch in corso con i progressi e il tempo rimanente, quelli pronti da riscattare e le campagne di Twitch con filtri (nuove, finiscono presto, in arrivo), prima quelle dei tuoi giochi. Con StreamPulse+, la cronologia di tutti i Drops ottenuti, mese per mese, con il gioco e il canale.",
          pl: "Nowy panel Dropsów w Ustawieniach: twoje Dropsy z Twitcha w toku z postępem i pozostałym czasem, te gotowe do odebrania oraz kampanie Twitcha z filtrami (nowe, wkrótce koniec, nadchodzące), najpierw twoje gry. Ze StreamPulse+ historia wszystkich zdobytych Dropsów, miesiąc po miesiącu, z grą i kanałem.",
          tr: "Ayarlar'da yeni Drops paneli: devam eden Twitch Drop'ların ilerlemesi ve kalan süresiyle, almaya hazır olanlar ve filtreli Twitch kampanyaları (yeni, yakında bitiyor, yakında), önce senin oyunların. StreamPulse+ ile kazandığın tüm Drop'ların geçmişi, ay ay, oyun ve kanalla birlikte.",
          ru: "Новая панель Drops в настройках: ваши Drops Twitch в процессе с прогрессом и оставшимся временем, готовые к получению и кампании Twitch с фильтрами (новые, скоро закончатся, скоро начнутся), сначала ваши игры. Со StreamPulse+ история всех полученных Drops по месяцам, с игрой и каналом.",
          ja: "設定に新しい「Drops」パネル：進行中の Twitch ドロップの進捗と残り時間、受け取り可能なドロップ、フィルター付きの Twitch キャンペーン（新着、まもなく終了、開催予定）を、あなたのゲームを先頭に表示します。StreamPulse+ なら、獲得したすべてのドロップの履歴をゲームとチャンネル付きで月ごとに確認できます。",
          ko: "설정에 새로운 Drops 패널: 진행 중인 Twitch 드롭의 진행 상황과 남은 시간, 수령 가능한 드롭, 필터(신규, 곧 종료, 예정)가 있는 Twitch 캠페인을 내 게임부터 보여줍니다. StreamPulse+로는 획득한 모든 드롭의 기록을 게임과 채널과 함께 월별로 볼 수 있습니다.",
        },
      },
      {
        type: "new",
        area: "drops",
        text: {
          fr: "Plus besoin d'ouvrir Twitch : StreamPulse relit tes Drops toutes les 10 minutes et récupère ceux qui sont prêts, même si tu regardes sur ton téléphone ou ta télé.",
          en: "No need to open Twitch anymore: StreamPulse checks your Drops every 10 minutes and claims the ready ones, even when you watch on your phone or TV.",
          es: "Ya no hace falta abrir Twitch: StreamPulse revisa tus Drops cada 10 minutos y reclama los que están listos, incluso si miras en el móvil o la tele.",
          "pt-BR": "Não é mais preciso abrir a Twitch: o StreamPulse verifica seus Drops a cada 10 minutos e resgata os prontos, mesmo se você assiste no celular ou na TV.",
          de: "Twitch muss nicht mehr offen sein: StreamPulse prüft deine Drops alle 10 Minuten und holt bereite ab, auch wenn du am Handy oder Fernseher schaust.",
          it: "Non serve più aprire Twitch: StreamPulse controlla i tuoi Drops ogni 10 minuti e riscatta quelli pronti, anche se guardi dal telefono o dalla TV.",
          pl: "Nie trzeba już otwierać Twitcha: StreamPulse co 10 minut sprawdza twoje Dropsy i odbiera gotowe, nawet gdy oglądasz na telefonie lub telewizorze.",
          tr: "Artık Twitch'i açmana gerek yok: StreamPulse Drop'larını 10 dakikada bir kontrol eder ve hazır olanları alır, telefonda ya da TV'de izlesen bile.",
          ru: "Больше не нужно открывать Twitch: StreamPulse проверяет ваши Drops каждые 10 минут и получает готовые, даже если вы смотрите с телефона или телевизора.",
          ja: "Twitch を開く必要はもうありません。StreamPulse が 10 分ごとにドロップを確認し、スマホやテレビで視聴していても受け取り可能なものを受け取ります。",
          ko: "이제 Twitch를 열 필요가 없습니다. StreamPulse가 10분마다 드롭을 확인하고, 휴대폰이나 TV로 시청해도 준비된 드롭을 수령합니다.",
        },
      },
      {
        type: "improved",
        area: "drops",
        text: {
          fr: "Sur l'accueil, la pastille Drops montre le Drop en cours avec un liseré de progression, sans prendre de place à la scène.",
          en: "On the home screen, the Drops chip shows the Drop in progress with a progress line, without taking space from the stage.",
          es: "En la pantalla de inicio, la pastilla Drops muestra el Drop en curso con una línea de progreso, sin quitarle espacio al escenario.",
          "pt-BR": "Na tela inicial, a pílula Drops mostra o Drop em andamento com uma linha de progresso, sem tirar espaço do palco.",
          de: "Auf dem Startbildschirm zeigt die Drops-Plakette den laufenden Drop mit Fortschrittslinie, ohne der Bühne Platz zu nehmen.",
          it: "Nella schermata iniziale, la pillola Drops mostra il Drop in corso con una linea di avanzamento, senza togliere spazio alla scena.",
          pl: "Na ekranie głównym plakietka Dropsów pokazuje Drop w toku z linią postępu, nie zabierając miejsca scenie.",
          tr: "Ana ekranda Drops rozeti, sahneden yer almadan devam eden Drop'u bir ilerleme çizgisiyle gösterir.",
          ru: "На главном экране плашка Drops показывает текущий Drop с полоской прогресса, не отнимая места у сцены.",
          ja: "ホーム画面の Drops チップが、進行中のドロップを進捗ラインで表示します。ステージの場所は取りません。",
          ko: "홈 화면의 Drops 칩이 무대 공간을 차지하지 않고 진행 중인 드롭을 진행선과 함께 보여줍니다.",
        },
      },
      {
        type: "improved",
        area: "drops",
        text: {
          fr: "La récupération automatique des Drops passe directement par Twitch dès qu'un Drop est prêt, sans attendre l'ouverture de l'inventaire, et chaque Drop obtenu est compté une seule fois, avec son nom.",
          en: "Drops are now auto-claimed directly through Twitch as soon as they are ready, without waiting for the inventory page, and each Drop you earn is counted once, with its name.",
          es: "Los Drops se reclaman automáticamente a través de Twitch en cuanto están listos, sin esperar a que se abra el inventario, y cada Drop obtenido se cuenta una sola vez, con su nombre.",
          "pt-BR": "Os Drops são resgatados automaticamente pela Twitch assim que ficam prontos, sem esperar a abertura do inventário, e cada Drop obtido é contado uma única vez, com o nome.",
          de: "Drops werden jetzt direkt über Twitch abgeholt, sobald sie bereit sind, ohne auf das Inventar zu warten, und jeder erhaltene Drop wird genau einmal mit seinem Namen gezählt.",
          it: "I Drops vengono riscattati automaticamente tramite Twitch appena sono pronti, senza aspettare l'apertura dell'inventario, e ogni Drop ottenuto viene contato una sola volta, con il suo nome.",
          pl: "Dropsy są odbierane automatycznie bezpośrednio przez Twitcha, gdy tylko są gotowe, bez czekania na otwarcie ekwipunku, a każdy zdobyty Drop jest liczony raz, z nazwą.",
          tr: "Drop'lar hazır olur olmaz, envanterin açılmasını beklemeden doğrudan Twitch üzerinden otomatik alınıyor ve kazanılan her Drop adıyla birlikte yalnızca bir kez sayılıyor.",
          ru: "Drops теперь получаются автоматически напрямую через Twitch, как только они готовы, без ожидания открытия инвентаря, и каждый полученный Drop учитывается один раз, с названием.",
          ja: "ドロップは受け取り可能になるとすぐに Twitch 経由で自動受け取りされ、インベントリを開くのを待ちません。獲得したドロップは名前付きで一度だけ記録されます。",
          ko: "드롭이 준비되는 즉시 인벤토리를 열 때까지 기다리지 않고 Twitch를 통해 바로 자동 수령되며, 획득한 드롭은 이름과 함께 한 번만 집계됩니다.",
        },
      },
      {
        type: "new",
        area: "badges",
        text: {
          fr: "Mode auto des badges : un bouton « Récupérer tous les badges possibles » enchaîne tout seul les badges gratuits, et tu peux en mettre plusieurs en file à la main. Un seul onglet regarde un jeu à la fois (Twitch ne compte qu'un live à la fois) : les paliers d'un même jeu (30 min, 1 h, 90 min…) avancent ensemble, puis l'onglet passe au jeu suivant. Une bannière sur la page Twitch montre les badges en cours, les minutes du Drop et la suite de la file.",
          en: "Badge auto mode: a \"Get every available badge\" button works through the free badges on its own, and you can queue several by hand. One tab watches one game at a time (Twitch only counts one live at a time): tiers of the same game (30 min, 1 h, 90 min…) progress together, then the tab moves to the next game. A banner on the Twitch page shows the badges in progress, the Drop minutes and what's next.",
          es: "Modo auto de insignias: un botón «Conseguir todas las insignias posibles» encadena solo las insignias gratuitas, y puedes poner varias en cola a mano. Una sola pestaña ve un juego a la vez (Twitch solo cuenta un directo a la vez): los niveles de un mismo juego (30 min, 1 h, 90 min…) avanzan juntos y luego pasa al siguiente juego. Un banner en la página de Twitch muestra las insignias en curso, los minutos del Drop y lo que viene.",
          "pt-BR": "Modo auto de emblemas: um botão \"Pegar todos os emblemas possíveis\" encadeia sozinho os emblemas grátis, e você pode colocar vários na fila à mão. Uma única aba assiste a um jogo por vez (a Twitch só conta uma live por vez): os níveis do mesmo jogo (30 min, 1 h, 90 min…) avançam juntos e depois a aba passa ao próximo jogo. Um banner na página da Twitch mostra os emblemas em andamento, os minutos do Drop e o que vem depois.",
          de: "Auto-Modus für Abzeichen: Ein Knopf „Alle möglichen Abzeichen holen“ arbeitet die kostenlosen Abzeichen selbst ab, und du kannst mehrere von Hand in die Warteschlange stellen. Ein Tab schaut ein Spiel nach dem anderen (Twitch zählt nur einen Livestream gleichzeitig): Stufen desselben Spiels (30 Min., 1 Std., 90 Min. …) laufen zusammen, dann geht es zum nächsten Spiel. Ein Banner auf der Twitch-Seite zeigt die laufenden Abzeichen, die Drop-Minuten und was als Nächstes kommt.",
          it: "Modalità auto dei badge: un pulsante «Ottieni tutti i badge possibili» concatena da solo i badge gratuiti, e puoi metterne diversi in coda a mano. Una sola scheda guarda un gioco alla volta (Twitch conta una live alla volta): i livelli dello stesso gioco (30 min, 1 h, 90 min…) avanzano insieme, poi si passa al gioco successivo. Un banner sulla pagina di Twitch mostra i badge in corso, i minuti del Drop e cosa viene dopo.",
          pl: "Tryb auto odznak: przycisk „Zdobądź wszystkie możliwe odznaki” sam przechodzi przez darmowe odznaki, a kilka możesz dodać do kolejki ręcznie. Jedna karta ogląda jedną grę naraz (Twitch liczy tylko jedną transmisję naraz): poziomy tej samej gry (30 min, 1 h, 90 min…) postępują razem, potem karta przechodzi do następnej gry. Baner na stronie Twitcha pokazuje bieżące odznaki, minuty dropa i dalszą kolejkę.",
          tr: "Rozet otomatik modu: \"Alınabilecek tüm rozetleri al\" düğmesi ücretsiz rozetleri kendi kendine sırayla alır, birkaçını da elle sıraya ekleyebilirsin. Tek bir sekme aynı anda bir oyunu izler (Twitch aynı anda tek yayını sayar): aynı oyunun kademeleri (30 dk, 1 sa, 90 dk…) birlikte ilerler, sonra sekme sıradaki oyuna geçer. Twitch sayfasındaki bir bant, süren rozetleri, drop dakikalarını ve sırayı gösterir.",
          ru: "Авторежим значков: кнопка «Получить все доступные значки» сама проходит по бесплатным значкам, а несколько можно поставить в очередь вручную. Одна вкладка смотрит одну игру за раз (Twitch засчитывает только одну трансляцию): уровни одной игры (30 мин, 1 ч, 90 мин…) идут вместе, затем вкладка переходит к следующей игре. Баннер на странице Twitch показывает текущие значки, минуты дропа и очередь.",
          ja: "バッジの自動モード：「取得できるバッジをすべて取る」ボタンで無料バッジを自動で順番に取得し、手動で複数を待機させることもできます。1つのタブが一度に1つのゲームを視聴します（Twitch は同時に1配信しか数えません）。同じゲームの段階（30分、1時間、90分…）はまとめて進み、その後次のゲームへ。Twitch のページのバナーに進行中のバッジ、ドロップの分数、次の予定が表示されます。",
          ko: "배지 자동 모드: \"받을 수 있는 배지 모두 받기\" 버튼이 무료 배지를 알아서 차례로 받고, 여러 개를 직접 대기열에 넣을 수도 있습니다. 탭 하나가 한 번에 한 게임을 시청합니다(Twitch는 동시에 한 방송만 인정): 같은 게임의 단계(30분, 1시간, 90분…)는 함께 진행되고 그다음 게임으로 넘어갑니다. Twitch 페이지의 배너에 진행 중인 배지, 드롭 시간, 다음 순서가 표시됩니다.",
        },
      },
      {
        type: "new",
        area: "badges",
        text: {
          fr: "Nouvel onglet Badges dans les Réglages : les campagnes de badges de chat en cours avec leurs conditions, et les nouveaux badges globaux de Twitch dès leur apparition, avec comment les obtenir, s'ils sont gratuits ou payants, et ceux que tu as déjà. Une notification t'avertit d'un nouveau badge gratuit.",
          en: "New Badges tab in Settings: running chat badge campaigns with their requirements, and new Twitch global badges as soon as they appear, with how to get them, whether they are free or paid, and the ones you already own. A notification tells you about new free badges.",
          es: "Nueva pestaña Insignias en los Ajustes: las campañas de insignias de chat en curso con sus condiciones, y las nuevas insignias globales de Twitch en cuanto aparecen, con cómo obtenerlas, si son gratis o de pago y las que ya tienes. Una notificación te avisa de cada nueva insignia gratis.",
          "pt-BR": "Nova aba Emblemas nas Configurações: as campanhas de emblemas de chat em andamento com as condições, e os novos emblemas globais da Twitch assim que surgem, com como obtê-los, se são grátis ou pagos e os que você já tem. Uma notificação avisa sobre cada novo emblema grátis.",
          de: "Neuer Tab Abzeichen in den Einstellungen: laufende Chat-Abzeichen-Kampagnen mit Bedingungen und neue globale Twitch-Abzeichen, sobald sie erscheinen, mit Anleitung, Hinweis gratis oder kostenpflichtig und deinen bereits erhaltenen. Eine Benachrichtigung meldet neue kostenlose Abzeichen.",
          it: "Nuova scheda Badge nelle Impostazioni: le campagne di badge della chat in corso con le condizioni, e i nuovi badge globali di Twitch appena compaiono, con come ottenerli, se sono gratis o a pagamento e quelli che hai già. Una notifica ti avvisa dei nuovi badge gratuiti.",
          pl: "Nowa karta Odznaki w Ustawieniach: trwające kampanie odznak czatu z warunkami oraz nowe globalne odznaki Twitcha zaraz po ich pojawieniu się, z opisem zdobycia, informacją, czy są darmowe, i tymi, które już masz. Powiadomienie informuje o nowych darmowych odznakach.",
          tr: "Ayarlar'da yeni Rozetler sekmesi: koşullarıyla devam eden sohbet rozeti kampanyaları ve yeni Twitch global rozetleri çıktıkları anda, nasıl alınacağı, ücretsiz mi ücretli mi olduğu ve zaten sahip oldukların. Yeni ücretsiz rozetler için bildirim gelir.",
          ru: "Новая вкладка «Значки» в настройках: текущие кампании значков чата с условиями и новые глобальные значки Twitch сразу после появления, с тем, как их получить, платные они или бесплатные и какие уже есть у вас. Уведомление сообщает о новых бесплатных значках.",
          ja: "設定に新しい「バッジ」タブ：開催中のチャットバッジキャンペーンと条件、登場したばかりの Twitch グローバルバッジを、入手方法、無料か有料か、取得済みかとあわせて表示します。新しい無料バッジは通知でお知らせします。",
          ko: "설정에 새로운 배지 탭: 진행 중인 채팅 배지 캠페인과 조건, 새로 나온 Twitch 글로벌 배지를 획득 방법, 무료/유료 여부, 이미 가진 배지와 함께 보여줍니다. 새 무료 배지는 알림으로 알려줍니다.",
        },
      },
      {
        type: "new",
        area: "badges",
        text: {
          fr: "Mode auto dans l'onglet Badges : « Obtenir en auto » ouvre un live de la campagne dans un onglet épinglé et muet, en qualité basse, puis le ferme et te prévient dès que le badge est à toi.",
          en: "Auto mode in the Badges tab: \"Get it automatically\" opens a live stream from the campaign in a pinned, muted tab at low quality, then closes it and lets you know as soon as the badge is yours.",
          es: "Modo auto en la pestaña Insignias: «Obtener en auto» abre un directo de la campaña en una pestaña fijada y silenciada, en baja calidad, y la cierra avisándote en cuanto la insignia es tuya.",
          "pt-BR": "Modo automático na aba Emblemas: \"Obter no automático\" abre uma live da campanha numa aba fixada e sem som, em baixa qualidade, e a fecha avisando assim que o emblema for seu.",
          de: "Auto-Modus im Tab Abzeichen: „Automatisch holen“ öffnet einen Stream der Kampagne in einem angehefteten, stummen Tab in niedriger Qualität, schließt ihn und sagt dir Bescheid, sobald das Abzeichen dir gehört.",
          it: "Modalità auto nella scheda Badge: «Ottieni in automatico» apre una diretta della campagna in una scheda fissata e muta, a bassa qualità, poi la chiude e ti avvisa appena il badge è tuo.",
          pl: "Tryb automatyczny w karcie Odznaki: „Zdobądź automatycznie” otwiera transmisję z kampanii w przypiętej, wyciszonej karcie w niskiej jakości, a potem ją zamyka i daje znać, gdy odznaka jest twoja.",
          tr: "Rozetler sekmesinde otomatik mod: \"Otomatik kazan\" kampanyadan bir yayını sabitlenmiş, sessiz bir sekmede düşük kalitede açar, rozet senin olunca sekmeyi kapatıp haber verir.",
          ru: "Автоматический режим во вкладке «Значки»: «Автополучение» открывает трансляцию кампании в закреплённой беззвучной вкладке в низком качестве, а затем закрывает её и сообщает, как только значок ваш.",
          ja: "バッジタブに自動モード：「自動で入手」でキャンペーンの配信を固定・ミュートのタブに低画質で開き、バッジを入手したらタブを閉じてお知らせします。",
          ko: "배지 탭에 자동 모드: '자동으로 받기'를 누르면 캠페인 방송을 고정된 음소거 탭에서 저화질로 열고, 배지를 받으면 탭을 닫고 알려줍니다.",
        },
      },
      {
        type: "new",
        area: "points",
        text: {
          fr: "Nouveau panneau Points dans les Réglages : StreamPulse enregistre chaque point de chaîne gagné sur Twitch et te montre combien tu en as gagné sur chaque chaîne. Avec StreamPulse+, tu vois d'où ils viennent (regarder, bonus, raids, suivis, séries, cheers et subs offerts), ce que ton abonnement t'a rapporté en plus, et une fiche par streamer avec le journal de tes gains. Le récap affiche aussi tes points gagnés.",
          en: "New Points panel in Settings: StreamPulse records every channel point you earn on Twitch and shows how many you earned on each channel. With StreamPulse+, see where they come from (watching, bonuses, raids, follows, streaks, cheers and gift subs), what your sub added on top, and a card for each streamer with a log of your gains. Your recap now shows the points you earned too.",
          es: "Nuevo panel Puntos en los Ajustes: StreamPulse registra cada punto de canal que ganas en Twitch y te muestra cuántos ganaste en cada canal. Con StreamPulse+, ves de dónde vienen (ver, bonos, raids, follows, rachas, cheers y suscripciones regaladas), lo que tu suscripción añadió y una ficha por streamer con el registro de tus ganancias. El resumen también muestra tus puntos ganados.",
          "pt-BR": "Novo painel Pontos nas Configurações: o StreamPulse registra cada ponto de canal que você ganha na Twitch e mostra quantos você ganhou em cada canal. Com o StreamPulse+, você vê de onde eles vêm (assistir, bônus, raids, follows, sequências, cheers e subs de presente), o que sua inscrição rendeu a mais e uma ficha por streamer com o registro dos seus ganhos. O resumo também mostra os pontos ganhos.",
          de: "Neues Punkte-Panel in den Einstellungen: StreamPulse erfasst jeden Kanalpunkt, den du auf Twitch verdienst, und zeigt, wie viele du auf jedem Kanal verdient hast. Mit StreamPulse+ siehst du, woher sie kommen (Zuschauen, Boni, Raids, Follows, Serien, Cheers und verschenkte Abos), was dein Abo zusätzlich gebracht hat, und eine Übersicht pro Streamer mit dem Protokoll deiner Gewinne. Auch dein Rückblick zeigt jetzt deine verdienten Punkte.",
          it: "Nuovo pannello Punti nelle Impostazioni: StreamPulse registra ogni punto canale che guadagni su Twitch e mostra quanti ne hai guadagnati su ogni canale. Con StreamPulse+ vedi da dove vengono (visione, bonus, raid, follow, serie, cheer e abbonamenti regalati), quanto ti ha fruttato in più l'abbonamento e una scheda per ogni streamer con il registro dei guadagni. Anche il riepilogo mostra i punti guadagnati.",
          pl: "Nowy panel Punkty w Ustawieniach: StreamPulse zapisuje każdy punkt kanału zdobyty na Twitchu i pokazuje, ile zdobyłeś na każdym kanale. Ze StreamPulse+ widzisz, skąd pochodzą (oglądanie, bonusy, rajdy, obserwacje, serie, cheery i podarowane suby), ile dodała twoja subskrypcja oraz kartę każdego streamera z dziennikiem zysków. Podsumowanie pokazuje też zdobyte punkty.",
          tr: "Ayarlar'da yeni Puanlar paneli: StreamPulse, Twitch'te kazandığın her kanal puanını kaydeder ve her kanalda ne kadar kazandığını gösterir. StreamPulse+ ile puanların nereden geldiğini (izleme, bonuslar, baskınlar, takipler, seriler, cheer'lar ve hediye abonelikler), aboneliğinin ne kadar ekstra kazandırdığını ve kazanç kaydıyla her yayıncı için bir kartı görürsün. Özet de artık kazandığın puanları gösteriyor.",
          ru: "Новая панель «Баллы» в настройках: StreamPulse записывает каждый балл канала, заработанный на Twitch, и показывает, сколько вы получили на каждом канале. Со StreamPulse+ видно, откуда они берутся (просмотр, бонусы, рейды, подписки на канал, серии, чиры и подаренные подписки), сколько добавила ваша подписка, и карточку каждого стримера с журналом начислений. Итоги теперь тоже показывают заработанные баллы.",
          ja: "設定に新しい「ポイント」パネル：StreamPulse が Twitch で獲得したチャンネルポイントをすべて記録し、チャンネルごとの獲得数を表示します。StreamPulse+ なら、出どころ（視聴、ボーナス、レイド、フォロー、連続視聴、チア、ギフトサブ）、サブスクで上乗せされた分、配信者ごとの獲得履歴も確認できます。まとめにも獲得ポイントが表示されます。",
          ko: "설정에 새로운 포인트 패널: StreamPulse가 Twitch에서 획득한 모든 채널 포인트를 기록하고 채널별 획득량을 보여줍니다. StreamPulse+로는 출처(시청, 보너스, 레이드, 팔로우, 연속 시청, 응원, 구독 선물), 구독으로 추가된 포인트, 획득 기록이 담긴 스트리머별 카드까지 볼 수 있습니다. 요약에도 획득 포인트가 표시됩니다.",
        },
      },
      {
        type: "new",
        area: "plus",
        text: {
          fr: "Nouvel onglet Pseudo et badge : avec StreamPulse+, choisis un effet pour ton pseudo et pour le logo StreamPulse à côté de lui dans le tchat Twitch, vus par tous les utilisateurs de StreamPulse. 25 effets, dont les nouveaux Battement, Lévitation, Secousse, Prisme, Glitch, Braise et Givre. Le réglage de couleur du badge disparaît : il prend la couleur de ton pseudo.",
          en: "New Name & badge tab: with StreamPulse+, pick an effect for your username and for the StreamPulse logo next to it in Twitch chat, seen by every StreamPulse user. 25 effects, including the new Heartbeat, Float, Wobble, Prism, Glitch, Ember and Frost. The badge colour setting is gone: the badge takes your username colour.",
          es: "Nueva pestaña Nombre e insignia: con StreamPulse+, elige un efecto para tu nombre y para el logo de StreamPulse a su lado en el chat de Twitch, visible para todos los usuarios de StreamPulse. 25 efectos, entre ellos los nuevos Latido, Levitación, Sacudida, Prisma, Glitch, Brasa y Escarcha. Desaparece el ajuste de color de la insignia: toma el color de tu nombre.",
          "pt-BR": "Nova aba Nome e emblema: com o StreamPulse+, escolha um efeito para o seu nome e para o logo do StreamPulse ao lado dele no chat da Twitch, visto por todos os usuários do StreamPulse. 25 efeitos, incluindo os novos Batimento, Levitação, Balanço, Prisma, Glitch, Brasa e Geada. A opção de cor do emblema saiu: ele usa a cor do seu nome.",
          de: "Neuer Tab Name & Abzeichen: Mit StreamPulse+ wählst du einen Effekt für deinen Namen und für das StreamPulse-Logo daneben im Twitch-Chat, sichtbar für alle StreamPulse-Nutzer. 25 Effekte, darunter die neuen Herzschlag, Schweben, Wackeln, Prisma, Glitch, Glut und Frost. Die Einstellung für die Abzeichenfarbe entfällt: Das Abzeichen nimmt die Farbe deines Namens an.",
          it: "Nuova scheda Nome e badge: con StreamPulse+, scegli un effetto per il tuo nome e per il logo di StreamPulse accanto nella chat di Twitch, visibile a tutti gli utenti di StreamPulse. 25 effetti, tra cui i nuovi Battito, Levitazione, Scossa, Prisma, Glitch, Brace e Brina. L'impostazione del colore del badge scompare: prende il colore del tuo nome.",
          pl: "Nowa karta Nick i odznaka: ze StreamPulse+ wybierz efekt dla swojego nicku i logo StreamPulse obok niego na czacie Twitcha, widoczny dla wszystkich użytkowników StreamPulse. 25 efektów, w tym nowe Bicie serca, Lewitacja, Drganie, Pryzmat, Glitch, Żar i Szron. Ustawienie koloru odznaki znika: odznaka przyjmuje kolor twojego nicku.",
          tr: "Yeni Ad ve rozet sekmesi: StreamPulse+ ile Twitch sohbetinde kullanıcı adın ve yanındaki StreamPulse logosu için bir efekt seç, tüm StreamPulse kullanıcıları görür. Yeni Kalp atışı, Süzülme, Sallanma, Prizma, Glitch, Kor ve Kırağı dahil 25 efekt. Rozet rengi ayarı kalktı: rozet kullanıcı adının rengini alır.",
          ru: "Новая вкладка «Ник и значок»: со StreamPulse+ выберите эффект для своего ника и логотипа StreamPulse рядом с ним в чате Twitch, его видят все пользователи StreamPulse. 25 эффектов, включая новые «Сердцебиение», «Левитация», «Покачивание», «Призма», «Глитч», «Угли» и «Иней». Настройка цвета значка убрана: значок берёт цвет вашего ника.",
          ja: "新しい「名前とバッジ」タブ：StreamPulse+ なら、Twitch チャットで自分の名前とその横の StreamPulse ロゴにエフェクトを付けられ、StreamPulse の全ユーザーに表示されます。新しい鼓動、浮遊、ゆらゆら、プリズム、グリッチ、残り火、霜を含む 25 種類。バッジの色の設定はなくなり、名前の色が使われます。",
          ko: "새로운 닉네임과 배지 탭: StreamPulse+로 Twitch 채팅에서 내 닉네임과 옆의 StreamPulse 로고에 효과를 적용하면 모든 StreamPulse 사용자에게 보입니다. 새로운 심장 박동, 공중 부양, 흔들림, 프리즘, 글리치, 불씨, 서리를 포함한 25가지 효과. 배지 색상 설정은 사라지고 배지가 닉네임 색을 따릅니다.",
        },
      },
      {
        type: "new",
        area: "plus",
        text: {
          fr: "Parrainage StreamPulse+ : partage ton code, ton ami a 2,99 € offerts (1er mois gratuit, ou la formule à vie à 16 €). Toi, tu touches de l'argent sur PayPal : 1 € pour chaque mois qu'il paie, ou 5 € d'un coup s'il prend la formule à vie, versé dès 10 €. En plus : un mois gratuit par ami si tu es au mois, l'effet de pseudo Ambassadeur, l'effet de badge Halo doré et un appareil de plus.",
          en: "StreamPulse+ referrals: share your code, your friend gets €2.99 off (first month free, or the lifetime plan for €16). You earn money on PayPal: €1 for every month they pay, or €5 at once if they take the lifetime plan, paid out from €10. Plus: a free month per friend on the monthly plan, the Ambassador username effect, the Golden halo badge effect and one more device.",
          es: "Invitaciones StreamPulse+: comparte tu código, tu amigo tiene 2,99 € de descuento (1.er mes gratis, o el plan de por vida a 16 €). Tú ganas dinero en PayPal: 1 € por cada mes que pague, o 5 € de una vez si elige el plan de por vida, pagado a partir de 10 €. Además: un mes gratis por amigo con el plan mensual, el efecto de nombre Embajador, el efecto de insignia Halo dorado y un dispositivo más.",
          "pt-BR": "Indicações StreamPulse+: compartilhe seu código, seu amigo ganha 2,99 € de desconto (1º mês grátis, ou o plano vitalício por 16 €). Você ganha dinheiro no PayPal: 1 € por cada mês que ele pagar, ou 5 € de uma vez se ele escolher o plano vitalício, pago a partir de 10 €. E mais: um mês grátis por amigo no plano mensal, o efeito de nome Embaixador, o efeito de emblema Halo dourado e um dispositivo a mais.",
          de: "StreamPulse+ Empfehlungen: Teile deinen Code, dein Freund bekommt 2,99 € Rabatt (1. Monat gratis oder lebenslang für 16 €). Du verdienst Geld über PayPal: 1 € für jeden Monat, den er bezahlt, oder 5 € auf einmal für den lebenslangen Plan, ausgezahlt ab 10 €. Dazu: ein Gratismonat pro Freund im Monatsabo, der Namenseffekt Botschafter, der Abzeichen-Effekt Goldener Heiligenschein und ein Gerät mehr.",
          it: "Inviti StreamPulse+: condividi il tuo codice, il tuo amico ha 2,99 € di sconto (1° mese gratis, o il piano a vita a 16 €). Tu guadagni soldi su PayPal: 1 € per ogni mese che paga, o 5 € in una volta se sceglie il piano a vita, pagati da 10 €. In più: un mese gratis per amico con il piano mensile, l'effetto nome Ambasciatore, l'effetto badge Aureola dorata e un dispositivo in più.",
          pl: "Polecenia StreamPulse+: udostępnij swój kod, znajomy dostaje 2,99 € zniżki (1. miesiąc za darmo lub plan dożywotni za 16 €). Ty zarabiasz na PayPal: 1 € za każdy opłacony przez niego miesiąc albo 5 € od razu za plan dożywotni, wypłata od 10 €. Do tego: darmowy miesiąc za każdego znajomego w planie miesięcznym, efekt nicku Ambasador, efekt odznaki Złota aureola i jedno urządzenie więcej.",
          tr: "StreamPulse+ davetleri: kodunu paylaş, arkadaşın 2,99 € indirim alsın (ilk ay ücretsiz ya da ömür boyu plan 16 €). Sen PayPal'dan para kazanırsın: ödediği her ay için 1 € ya da ömür boyu plan alırsa tek seferde 5 €, 10 €'dan itibaren ödenir. Ayrıca: aylık planda her arkadaş için bir ay ücretsiz, Elçi kullanıcı adı efekti, Altın hale rozet efekti ve bir cihaz daha.",
          ru: "Рефералы StreamPulse+: поделитесь кодом, друг получит скидку 2,99 € (первый месяц бесплатно или план навсегда за 16 €). Вы зарабатываете на PayPal: 1 € за каждый оплаченный им месяц или 5 € сразу за план навсегда, выплата от 10 €. А также: бесплатный месяц за друга на месячном плане, эффект ника «Посол», эффект значка «Золотой ореол» и ещё одно устройство.",
          ja: "StreamPulse+ の紹介：コードを共有すると友達は 2.99 € 引き（最初の1か月無料、または買い切りプランが 16 €）。あなたは PayPal で報酬を受け取れます：友達が支払う毎月 1 €、買い切りなら一度に 5 €、10 € から支払い。さらに月額プランなら友達1人につき1か月無料、アンバサダーの名前エフェクト、金の後光バッジエフェクト、デバイス1台追加。",
          ko: "StreamPulse+ 추천: 코드를 공유하면 친구는 2.99 € 할인(첫 달 무료, 또는 평생 플랜 16 €). 나는 PayPal로 돈을 받습니다: 친구가 결제하는 매달 1 €, 평생 플랜이면 한 번에 5 €, 10 €부터 지급. 그리고 월간 플랜이면 친구마다 한 달 무료, 앰배서더 닉네임 효과, 황금 후광 배지 효과, 기기 한 대 추가.",
        },
      },
      {
        type: "new",
        area: "plus",
        text: {
          fr: "La formule mensuelle de StreamPulse+ commence maintenant par 7 jours gratuits.",
          en: "The StreamPulse+ monthly plan now starts with 7 free days.",
          es: "El plan mensual de StreamPulse+ ahora empieza con 7 días gratis.",
          "pt-BR": "O plano mensal do StreamPulse+ agora começa com 7 dias grátis.",
          de: "Das Monatsabo von StreamPulse+ beginnt jetzt mit 7 Gratistagen.",
          it: "Il piano mensile di StreamPulse+ ora inizia con 7 giorni gratis.",
          pl: "Plan miesięczny StreamPulse+ zaczyna się teraz od 7 darmowych dni.",
          tr: "StreamPulse+ aylık planı artık 7 günlük ücretsiz denemeyle başlıyor.",
          ru: "Месячный план StreamPulse+ теперь начинается с 7 бесплатных дней.",
          ja: "StreamPulse+ の月額プランが 7 日間の無料体験から始まるようになりました。",
          ko: "StreamPulse+ 월간 플랜이 이제 7일 무료로 시작합니다.",
        },
      },
      {
        type: "improved",
        area: "interface",
        text: {
          fr: "Drops et Badges ont leur onglet dans la barre du haut, et les Nouveautés passent en icône à droite. Les Réglages sont réorganisés : Pseudo et badge, Drops et Badges en tête, avec une étiquette Nouveau jusqu'à ta première visite.",
          en: "Drops and Badges get their own tabs in the top bar, and What's new moves to an icon on the right. Settings are reorganised: Name & badge, Drops and Badges come first, with a New label until your first visit.",
          es: "Drops e Insignias tienen su pestaña en la barra superior, y Novedades pasa a un icono a la derecha. Los Ajustes se reorganizan: Nombre e insignia, Drops e Insignias primero, con una etiqueta Nuevo hasta tu primera visita.",
          "pt-BR": "Drops e Emblemas ganham aba na barra superior, e Novidades vira um ícone à direita. As Configurações foram reorganizadas: Nome e emblema, Drops e Emblemas primeiro, com uma etiqueta Novo até a sua primeira visita.",
          de: "Drops und Abzeichen haben eigene Tabs in der oberen Leiste, Neuigkeiten wird zum Symbol rechts. Die Einstellungen sind neu geordnet: Name & Abzeichen, Drops und Abzeichen zuerst, mit einem Neu-Label bis zum ersten Besuch.",
          it: "Drops e Badge hanno la loro scheda nella barra superiore, e Novità diventa un'icona a destra. Le Impostazioni sono riorganizzate: Nome e badge, Drops e Badge in cima, con un'etichetta Nuovo fino alla prima visita.",
          pl: "Dropsy i Odznaki mają własne karty na górnym pasku, a Nowości stają się ikoną po prawej. Ustawienia są uporządkowane na nowo: Nick i odznaka, Dropsy i Odznaki na początku, z etykietą Nowość do pierwszej wizyty.",
          tr: "Drop'lar ve Rozetler üst çubukta kendi sekmelerine kavuştu, Yenilikler sağda bir simgeye dönüştü. Ayarlar yeniden düzenlendi: Ad ve rozet, Drop'lar ve Rozetler başta, ilk ziyaretine kadar Yeni etiketiyle.",
          ru: "У Drops и значков появились свои вкладки в верхней панели, а «Что нового» стало значком справа. Настройки упорядочены: «Ник и значок», Drops и значки идут первыми, с меткой «Новое» до первого посещения.",
          ja: "ドロップとバッジが上部バーのタブに加わり、新着情報は右側のアイコンになりました。設定を整理し、名前とバッジ、ドロップ、バッジを先頭に、初めて開くまで NEW ラベルを表示します。",
          ko: "드롭과 배지가 상단 바에 탭으로 추가되고, 새 소식은 오른쪽 아이콘으로 옮겨졌습니다. 설정을 재정리해 닉네임과 배지, 드롭, 배지를 맨 위에 두고, 처음 열 때까지 NEW 라벨을 표시합니다.",
        },
      },
      {
        type: "new",
        area: "interface",
        text: {
          fr: "En tapant un pseudo pour ajouter une chaîne Twitch ou Kick, les chaînes correspondantes s'affichent comme sur Twitch, avec leur avatar et celles en direct en premier. Flèches et Entrée pour l'ajouter sans finir de taper.",
          en: "While typing a name to add a Twitch or Kick channel, matching channels show up like on Twitch, with their avatar and live ones first. Use the arrows and Enter to add one without typing it all.",
          es: "Al escribir un nombre para añadir un canal de Twitch o Kick, los canales que coinciden aparecen como en Twitch, con su avatar y los que están en directo primero. Flechas y Enter para añadirlo sin terminar de escribir.",
          "pt-BR": "Ao digitar um nome para adicionar um canal da Twitch ou da Kick, os canais correspondentes aparecem como na Twitch, com avatar e os ao vivo primeiro. Setas e Enter para adicionar sem terminar de digitar.",
          de: "Beim Eintippen eines Namens für einen Twitch- oder Kick-Kanal erscheinen passende Kanäle wie auf Twitch, mit Avatar und Live-Kanälen zuerst. Mit Pfeiltasten und Enter hinzufügen, ohne fertig zu tippen.",
          it: "Mentre scrivi un nome per aggiungere un canale Twitch o Kick, i canali corrispondenti compaiono come su Twitch, con avatar e quelli in diretta per primi. Frecce e Invio per aggiungerlo senza finire di scrivere.",
          pl: "Podczas wpisywania nazwy, by dodać kanał z Twitcha lub Kicka, pasujące kanały pojawiają się jak na Twitchu, z awatarem i transmisjami na żywo na początku. Strzałki i Enter, by dodać bez dopisywania.",
          tr: "Twitch veya Kick kanalı eklemek için bir ad yazarken eşleşen kanallar Twitch'teki gibi avatarlarıyla ve canlı olanlar önce gelecek şekilde görünür. Yazmayı bitirmeden eklemek için ok tuşları ve Enter.",
          ru: "Когда вы вводите имя, чтобы добавить канал Twitch или Kick, подходящие каналы появляются как на Twitch — с аватаром, сначала те, что в эфире. Стрелки и Enter — и канал добавлен без полного ввода.",
          ja: "Twitch や Kick のチャンネルを追加するために名前を入力すると、Twitch のように一致するチャンネルがアバター付きで表示され、配信中のものが先頭に並びます。矢印キーと Enter で入力を終える前に追加できます。",
          ko: "Twitch나 Kick 채널을 추가하려고 이름을 입력하면 Twitch처럼 일치하는 채널이 아바타와 함께, 생방송 중인 채널부터 표시됩니다. 방향키와 Enter로 끝까지 입력하지 않고 추가하세요.",
        },
      },
      {
        type: "new",
        area: "interface",
        text: {
          fr: "Disposition : dans Général et aide, change l'ordre des onglets de la barre du haut et des rubriques des Réglages, et masque ceux dont tu ne te sers pas (l'Historique, par exemple).",
          en: "Layout: in General & help, reorder the top bar tabs and the Settings sections, and hide the ones you don't use (History, for example).",
          es: "Disposición: en General y ayuda, cambia el orden de las pestañas de la barra superior y de las secciones de Ajustes, y oculta las que no uses (Historial, por ejemplo).",
          "pt-BR": "Disposição: em Geral e ajuda, mude a ordem das abas da barra superior e das seções das Configurações, e oculte as que você não usa (Histórico, por exemplo).",
          de: "Anordnung: Unter Allgemein & Hilfe änderst du die Reihenfolge der Tabs oben und der Einstellungsbereiche und blendest ungenutzte aus (zum Beispiel den Verlauf).",
          it: "Disposizione: in Generale e aiuto, cambia l'ordine delle schede della barra superiore e delle sezioni delle Impostazioni, e nascondi quelle che non usi (la Cronologia, per esempio).",
          pl: "Układ: w sekcji Ogólne i pomoc zmień kolejność kart górnego paska i sekcji Ustawień oraz ukryj te, których nie używasz (na przykład Historię).",
          tr: "Düzen: Genel ve yardım bölümünde üst çubuk sekmelerinin ve Ayarlar bölümlerinin sırasını değiştir, kullanmadıklarını gizle (örneğin Geçmiş).",
          ru: "Расположение: в разделе «Общие и помощь» меняйте порядок вкладок верхней панели и разделов настроек и скрывайте ненужные (например, «Историю»).",
          ja: "レイアウト：「一般とヘルプ」で上部バーのタブと設定の項目の並び順を変更し、使わないもの（履歴など）を非表示にできます。",
          ko: "배치: 일반 및 도움말에서 상단 바 탭과 설정 항목의 순서를 바꾸고, 쓰지 않는 것(예: 기록)을 숨길 수 있습니다.",
        },
      },
      {
        type: "improved",
        area: "interface",
        text: {
          fr: "Des libellés trop longs pour leur bouton ont été raccourcis en italien, polonais, turc, russe et français (aperçus au survol, aide et FAQ, temps de visionnage…).",
          en: "Labels that overflowed their buttons were shortened in Italian, Polish, Turkish, Russian and French (hover previews, help & FAQ, watch time…).",
          es: "Se acortaron etiquetas demasiado largas para su botón en italiano, polaco, turco, ruso y francés (vistas previas al pasar el ratón, ayuda y FAQ, tiempo de visualización…).",
          "pt-BR": "Rótulos longos demais para o botão foram encurtados em italiano, polonês, turco, russo e francês (prévias ao passar o mouse, ajuda e FAQ, tempo assistido…).",
          de: "Zu lange Beschriftungen wurden auf Italienisch, Polnisch, Türkisch, Russisch und Französisch gekürzt (Hover-Vorschau, Hilfe & FAQ, Wiedergabezeit…).",
          it: "Le etichette troppo lunghe per il loro pulsante sono state accorciate in italiano, polacco, turco, russo e francese (anteprime al passaggio, aiuto e FAQ, tempo di visione…).",
          pl: "Skrócono zbyt długie etykiety w językach włoskim, polskim, tureckim, rosyjskim i francuskim (podgląd po najechaniu, pomoc i FAQ, czas oglądania…).",
          tr: "Düğmesine sığmayan etiketler İtalyanca, Lehçe, Türkçe, Rusça ve Fransızcada kısaltıldı (fareyle önizleme, yardım ve SSS, izleme süresi…).",
          ru: "Слишком длинные подписи сокращены на итальянском, польском, турецком, русском и французском (превью при наведении, справка и FAQ, время просмотра…).",
          ja: "ボタンに収まらなかったラベルを、イタリア語・ポーランド語・トルコ語・ロシア語・フランス語で短くしました（ホバープレビュー、ヘルプと FAQ、視聴時間など）。",
          ko: "버튼에 들어가지 않던 라벨을 이탈리아어, 폴란드어, 터키어, 러시아어, 프랑스어에서 짧게 줄였습니다(마우스 오버 미리보기, 도움말 및 FAQ, 시청 시간 등).",
        },
      },
      {
        type: "new",
        area: "interface",
        text: {
          fr: "Une notification annonce chaque mise à jour de StreamPulse, une seule fois par version, et un clic ouvre les nouveautés. Ça se désactive dans les Réglages, onglet Alertes.",
          en: "A notification announces every StreamPulse update, once per version, and a click opens What's new. It can be turned off in Settings, Alerts tab.",
          es: "Una notificación anuncia cada actualización de StreamPulse, una sola vez por versión, y un clic abre las novedades. Se puede desactivar en los Ajustes, pestaña Alertas.",
          "pt-BR": "Uma notificação anuncia cada atualização do StreamPulse, uma vez por versão, e um clique abre as novidades. Dá para desativar nas Configurações, aba Alertas.",
          de: "Eine Benachrichtigung kündigt jedes StreamPulse-Update an, einmal pro Version, ein Klick öffnet die Neuigkeiten. Deaktivierbar in den Einstellungen, Tab Alarme.",
          it: "Una notifica annuncia ogni aggiornamento di StreamPulse, una sola volta per versione, e un clic apre le novità. Disattivabile nelle Impostazioni, scheda Avvisi.",
          pl: "Powiadomienie zapowiada każdą aktualizację StreamPulse, raz na wersję, a kliknięcie otwiera nowości. Można je wyłączyć w Ustawieniach, karcie Alerty.",
          tr: "Bir bildirim, StreamPulse'un her güncellemesini sürüm başına bir kez duyurur ve tıklamak yenilikleri açar. Ayarlar'daki Uyarılar sekmesinden kapatılabilir.",
          ru: "Уведомление сообщает о каждом обновлении StreamPulse — один раз на версию, а клик открывает новинки. Отключается в настройках, вкладка «Оповещения».",
          ja: "StreamPulse の更新をバージョンごとに1回、通知でお知らせし、クリックで新着情報を開けます。設定の「アラート」タブでオフにできます。",
          ko: "StreamPulse 업데이트를 버전당 한 번 알림으로 알려주고, 클릭하면 새 소식이 열립니다. 설정의 알림 탭에서 끌 수 있습니다.",
        },
      },
      {
        type: "improved",
        area: "interface",
        text: {
          fr: "L'indicateur de latence se place où tu veux : sous le lecteur à côté des spectateurs, comme aujourd'hui, ou dans l'en-tête du tchat à la place du titre « Chat du stream ». Ça se règle dans Lecteur.",
          en: "The latency indicator goes where you want: under the player next to the viewer count, as today, or in the chat header in place of the \"Stream Chat\" title. Set it in Player.",
          es: "El indicador de latencia se coloca donde quieras: bajo el reproductor junto a los espectadores, como ahora, o en el encabezado del chat en lugar del título «Chat del stream». Se ajusta en Reproductor.",
          "pt-BR": "O indicador de latência fica onde você quiser: sob o player ao lado dos espectadores, como hoje, ou no cabeçalho do chat no lugar do título \"Chat da transmissão\". Ajuste em Player.",
          de: "Die Latenzanzeige sitzt, wo du willst: unter dem Player neben der Zuschauerzahl wie bisher oder in der Chat-Kopfzeile anstelle des Titels „Stream-Chat“. Einstellbar unter Player.",
          it: "L'indicatore di latenza sta dove vuoi: sotto il player accanto agli spettatori, come oggi, o nell'intestazione della chat al posto del titolo \"Chat dello stream\". Si imposta in Player.",
          pl: "Wskaźnik opóźnienia stawia tam, gdzie chcesz: pod odtwarzaczem obok liczby widzów, jak teraz, albo w nagłówku czatu zamiast tytułu „Czat transmisji”. Ustawisz to w Odtwarzaczu.",
          tr: "Gecikme göstergesi istediğin yerde: bugünkü gibi oynatıcının altında izleyici sayısının yanında ya da \"Yayın sohbeti\" başlığının yerine sohbet başlığında. Oynatıcı bölümünden ayarlanır.",
          ru: "Индикатор задержки ставится куда угодно: под плеером рядом со зрителями, как сейчас, или в шапке чата вместо заголовка «Чат трансляции». Настраивается в разделе «Плеер».",
          ja: "遅延の表示を好きな場所に置けます：これまで通りプレーヤーの下の視聴者数の横、または「配信チャット」のタイトルの代わりにチャットのヘッダーへ。「プレーヤー」で設定できます。",
          ko: "지연 표시를 원하는 곳에 둘 수 있습니다: 지금처럼 플레이어 아래 시청자 수 옆, 또는 '방송 채팅' 제목 대신 채팅 헤더에. '플레이어'에서 설정합니다.",
        },
      },
      {
        type: "improved",
        area: "points",
        text: {
          fr: "Les points gagnés sur l'image du récap sont les vrais points de la période : le nouveau suivi par jour, et avant lui les coffres récupérés que l'extension avait datés. Si le suivi ne couvre qu'une partie de la période, l'image l'indique (« Points depuis le 26 sept. »). Le Wrapped annuel reprend ton total depuis l'installation.",
          en: "The points on the recap image are the real points of the period: the new daily tracking, and before it the bonus chests the extension had dated. If tracking only covers part of the period, the image says so (\"Points since Sep 26\"). The yearly Wrapped uses your total since install.",
          es: "Los puntos de la imagen del resumen son los puntos reales del periodo: el nuevo registro diario y, antes de él, los cofres que la extensión había fechado. Si el registro solo cubre parte del periodo, la imagen lo indica («Puntos desde el 26 sept.»). El Wrapped anual usa tu total desde la instalación.",
          "pt-BR": "Os pontos na imagem do resumo são os pontos reais do período: o novo registro diário e, antes dele, os baús que a extensão tinha datado. Se o registro cobre só parte do período, a imagem avisa (\"Pontos desde 26 de set.\"). O Wrapped anual usa seu total desde a instalação.",
          de: "Die Punkte im Rückblick-Bild sind die echten Punkte des Zeitraums: die neue tägliche Erfassung und davor die Bonustruhen, die die Erweiterung datiert hatte. Deckt die Erfassung nur einen Teil ab, steht es im Bild („Punkte seit 26. Sept.“). Der Jahres-Wrapped nutzt deine Summe seit der Installation.",
          it: "I punti nell'immagine del riepilogo sono i punti reali del periodo: il nuovo registro giornaliero e, prima, i forzieri che l'estensione aveva datato. Se il registro copre solo una parte del periodo, l'immagine lo indica («Punti dal 26 set»). Il Wrapped annuale usa il tuo totale dall'installazione.",
          pl: "Punkty na obrazku podsumowania to prawdziwe punkty z okresu: nowe śledzenie dzienne, a przed nim skrzynki, którym rozszerzenie nadało datę. Jeśli śledzenie obejmuje tylko część okresu, obrazek to pokazuje („Punkty od 26 wrz”). Roczny Wrapped używa sumy od instalacji.",
          tr: "Özet görselindeki puanlar dönemin gerçek puanlarıdır: yeni günlük takip ve ondan önce eklentinin tarihlediği bonus sandıkları. Takip dönemin yalnızca bir kısmını kapsıyorsa görselde yazar (\"26 Eyl tarihinden beri puan\"). Yıllık Wrapped, kurulumdan beri toplamını kullanır.",
          ru: "Баллы на картинке итогов — настоящие баллы за период: новый ежедневный учёт, а до него сундуки, которые расширение успело датировать. Если учёт покрывает только часть периода, это видно на картинке («Баллы с 26 сент.»). Годовой Wrapped берёт итог с момента установки.",
          ja: "まとめ画像のポイントは期間中の実際のポイントです：新しい日別記録と、それ以前に拡張機能が日付付きで記録したボーナス宝箱。記録が期間の一部しかない場合は画像に表示されます（「9月26日からのポイント」）。年間 Wrapped はインストール以来の合計を使います。",
          ko: "결산 이미지의 포인트는 해당 기간의 실제 포인트입니다: 새 일별 기록과, 그 이전에 확장 프로그램이 날짜를 기록한 보너스 상자. 기록이 기간 일부만 포함하면 이미지에 표시됩니다(\"9월 26일부터 포인트\"). 연간 Wrapped는 설치 이후 합계를 사용합니다.",
        },
      },
      {
        type: "fix",
        area: "fixes",
        text: {
          fr: "Image du récap : le temps regardé ne déborde plus au-delà de 100 heures, le nom de ta chaîne favorite s'affiche en entier, StreamPulse n'est plus écrit trois fois, et l'image téléchargée est deux fois plus nette tout en pesant moins de 1 Mo (JPEG), assez léger pour X.",
          en: "Recap image: watch time no longer overflows past 100 hours, your favorite channel's name is shown in full, StreamPulse is no longer written three times, and the downloaded image is twice as sharp while weighing under 1 MB (JPEG), light enough for X.",
          es: "Imagen del resumen: el tiempo visto ya no se desborda a partir de 100 horas, el nombre de tu canal favorito se ve completo, StreamPulse ya no aparece tres veces y la imagen descargada es el doble de nítida y pesa menos de 1 MB (JPEG), ligera para X.",
          "pt-BR": "Imagem do resumo: o tempo assistido não transborda mais acima de 100 horas, o nome do seu canal favorito aparece inteiro, StreamPulse não aparece mais três vezes e a imagem baixada é duas vezes mais nítida e pesa menos de 1 MB (JPEG), leve para o X.",
          de: "Rückblick-Bild: Die Zuschauzeit läuft über 100 Stunden nicht mehr über, der Name deines Lieblingskanals erscheint vollständig, StreamPulse steht nicht mehr dreimal da und das heruntergeladene Bild ist doppelt so scharf und wiegt unter 1 MB (JPEG), leicht genug für X.",
          it: "Immagine del riepilogo: il tempo guardato non trabocca più oltre le 100 ore, il nome del tuo canale preferito appare per intero, StreamPulse non è più scritto tre volte e l'immagine scaricata è due volte più nitida e pesa meno di 1 MB (JPEG), leggera per X.",
          pl: "Obrazek podsumowania: czas oglądania nie wychodzi już poza ramkę powyżej 100 godzin, nazwa ulubionego kanału jest widoczna w całości, StreamPulse nie pojawia się już trzy razy, a pobrany obrazek jest dwa razy ostrzejszy i waży poniżej 1 MB (JPEG), lekki dla X.",
          tr: "Özet görseli: izleme süresi 100 saati aşınca artık taşmıyor, favori kanalının adı tam görünüyor, StreamPulse artık üç kez yazılmıyor ve indirilen görsel iki kat daha net, üstelik 1 MB'tan hafif (JPEG), X için yeterince hafif.",
          ru: "Картинка итогов: время просмотра больше не вылезает за край после 100 часов, название любимого канала видно целиком, StreamPulse больше не написан трижды, а скачанная картинка вдвое чётче и весит меньше 1 МБ (JPEG) — достаточно легко для X.",
          ja: "まとめ画像：100時間を超えても視聴時間がはみ出さなくなり、一番見たチャンネル名が全部表示され、StreamPulse が3回書かれなくなり、ダウンロード画像が2倍鮮明になり、1 MB 未満（JPEG）で X にも投稿しやすくなりました。",
          ko: "결산 이미지: 시청 시간이 100시간을 넘어도 더 이상 넘치지 않고, 가장 많이 본 채널 이름이 전부 보이며, StreamPulse가 세 번 쓰이지 않고, 다운로드 이미지가 두 배 선명해지고 1MB 미만(JPEG)이라 X에도 올리기 쉽습니다.",
        },
      },
      {
        type: "fix",
        area: "fixes",
        text: {
          fr: "Le compteur « Drops aujourd'hui » de l'accueil est de retour : il compte les Drops réellement obtenus, et non plus les clics sur les boutons de Twitch.",
          en: "The \"Drops today\" counter on the home screen is back: it counts the Drops you actually earned, no longer clicks on Twitch buttons.",
          es: "El contador «Drops de hoy» de la pantalla de inicio vuelve: cuenta los Drops realmente obtenidos, ya no los clics en los botones de Twitch.",
          "pt-BR": "O contador «Drops hoje» da tela inicial está de volta: ele conta os Drops realmente obtidos, e não mais os cliques nos botões da Twitch.",
          de: "Der Zähler „Drops heute“ auf dem Startbildschirm ist zurück: Er zählt die tatsächlich erhaltenen Drops statt Klicks auf Twitch-Schaltflächen.",
          it: "Il contatore «Drops di oggi» nella schermata iniziale è tornato: conta i Drops davvero ottenuti, non più i clic sui pulsanti di Twitch.",
          pl: "Licznik „Dropsy dzisiaj” na ekranie głównym wrócił: liczy naprawdę zdobyte Dropsy, a nie kliknięcia w przyciski Twitcha.",
          tr: "Ana ekrandaki «Bugünkü Drops» sayacı geri döndü: artık Twitch düğmelerine yapılan tıklamaları değil, gerçekten kazanılan Drop'ları sayıyor.",
          ru: "Счётчик «Drops сегодня» на главном экране вернулся: он считает реально полученные Drops, а не нажатия на кнопки Twitch.",
          ja: "ホーム画面の「今日のドロップ」カウンターが復活しました。Twitch のボタンのクリック数ではなく、実際に獲得したドロップを数えます。",
          ko: "홈 화면의 「오늘 드롭」 카운터가 돌아왔습니다. 이제 Twitch 버튼 클릭이 아니라 실제로 획득한 드롭을 셉니다.",
        },
      },
      {
        type: "fix",
        area: "fixes",
        text: {
          fr: "Le Wrapped annuel pouvait afficher moins d'heures que l'un de ses mois (par exemple 120 h pour 2026 contre 160 h pour septembre) : le mois en cours n'était compté qu'à partir de l'arrivée du suivi par jour. Chaque mois est maintenant compté en entier.",
          en: "The yearly Wrapped could show fewer hours than one of its months (for example 120 h for 2026 versus 160 h for September): the current month only counted from when daily tracking arrived. Every month is now counted in full.",
          es: "El Wrapped anual podía mostrar menos horas que uno de sus meses (por ejemplo 120 h para 2026 frente a 160 h para septiembre): el mes en curso solo se contaba desde la llegada del registro diario. Ahora cada mes se cuenta entero.",
          "pt-BR": "O Wrapped anual podia mostrar menos horas que um dos seus meses (por exemplo 120 h em 2026 contra 160 h em setembro): o mês atual só era contado a partir da chegada do registro diário. Agora cada mês é contado por inteiro.",
          de: "Der Jahres-Wrapped konnte weniger Stunden zeigen als einer seiner Monate (zum Beispiel 120 h für 2026 gegenüber 160 h für September): Der laufende Monat wurde erst ab Einführung der Tageserfassung gezählt. Jetzt wird jeder Monat vollständig gezählt.",
          it: "Il Wrapped annuale poteva mostrare meno ore di uno dei suoi mesi (per esempio 120 h per il 2026 contro 160 h per settembre): il mese in corso veniva contato solo dall'arrivo del monitoraggio giornaliero. Ora ogni mese viene contato per intero.",
          pl: "Roczny Wrapped mógł pokazywać mniej godzin niż jeden z jego miesięcy (na przykład 120 h w 2026 wobec 160 h we wrześniu): bieżący miesiąc liczono dopiero od wprowadzenia śledzenia dziennego. Teraz każdy miesiąc jest liczony w całości.",
          tr: "Yıllık Wrapped, aylarından birinden daha az saat gösterebiliyordu (örneğin Eylül için 160 saate karşı 2026 için 120 saat): içinde bulunulan ay yalnızca günlük takibin geldiği andan itibaren sayılıyordu. Artık her ay eksiksiz sayılıyor.",
          ru: "Годовой Wrapped мог показывать меньше часов, чем один из его месяцев (например, 120 ч за 2026 год против 160 ч за сентябрь): текущий месяц учитывался только с момента появления ежедневного учёта. Теперь каждый месяц считается полностью.",
          ja: "年間 Wrapped が、その年のある月より少ない時間を表示することがありました（例：9月は160時間なのに2026年は120時間）。当月は日別記録の開始以降しか数えていなかったためです。現在は各月をすべて数えます。",
          ko: "연간 Wrapped가 해당 연도의 한 달보다 적은 시간을 보여줄 수 있었습니다(예: 9월은 160시간인데 2026년은 120시간). 이번 달은 일별 기록이 시작된 이후만 집계되었기 때문입니다. 이제 모든 달을 빠짐없이 집계합니다.",
        },
      },
    ],
    thanks: [
      {
        handle: "shiroa",
        for: {
          fr: "idée du suivi des points par chaîne",
          en: "the idea of per-channel points tracking",
          es: "la idea del registro de puntos por canal",
          "pt-BR": "a ideia do registro de pontos por canal",
          de: "die Idee der Punkteerfassung pro Kanal",
          it: "l'idea del registro dei punti per canale",
          pl: "pomysł śledzenia punktów na każdym kanale",
          tr: "kanal başına puan takibi fikri",
          ru: "идея учёта баллов по каналам",
          ja: "チャンネル別ポイント記録のアイデア",
          ko: "채널별 포인트 기록 아이디어",
        },
      },
    ],
  },

];



/**
 * Texte d'un champ i18n pour une langue donnee.
 *
 * Ces trois fonctions vivaient ici jusqu'a la 26.8.9, puis ont disparu quand
 * fab414f a regenere le fichier pour les 11 nouvelles langues. changelog.js les
 * importe toujours : l'import echouait, le module entier ne s'executait pas, et
 * la page de notes de version ne montrait plus que sa coquille vide. Le controle
 * de `npm run verify` ne l'attrapait pas : il verifie que les fichiers JS
 * parsent, pas que leurs imports se resolvent.
 */
export function pickLocalized(value, lang) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value !== "object") return "";

  const picked = value[lang] ?? value[FALLBACK_LANGUAGE];
  if (typeof picked === "string") return picked;

  // Last resort: any language at all beats an empty line in the notes.
  const any = Object.values(value).find((entry) => typeof entry === "string");
  return any ?? "";
}

/** Release la plus recente, soit la premiere du tableau. */
export function getLatestRelease() {
  return RELEASES.length ? RELEASES[0] : null;
}

