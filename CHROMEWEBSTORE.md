# Chrome Web Store Listing : StreamPulse

> Dernière mise à jour : 2026-08-06

---

## 1. Informations Principales du Store (Store Listing)

### Nom de l'extension
**FR** : `StreamPulse : extension Twitch & Kick` (37 / 75 caractères)  
**EN** : `StreamPulse: Twitch & Kick extension` (36 / 75 caractères)

### Description Courte (Short Description)
**FR** : `Collecte auto des points de chaîne, alertes live, aperçus au survol et filtres chat Twitch & Kick. Dispo en 15 langues ! Gratuit.` (130 / 132 caractères)  
**EN** : `Auto-claim Channel Points, live alerts, hover previews & chat filters for Twitch & Kick. Available in 15 languages! Free.` (122 / 132 caractères)

### Description Détaillée (Detailed Description - FR)
```text
StreamPulse est l'extension incontournable pour révolutionner votre expérience sur Twitch et Kick. Conçue pour être ultra-légère et rapide, elle centralise vos notifications et automatise vos actions sans ralentir votre navigateur.

✨ NOUVEAUTÉ : L'extension est désormais entièrement traduite et disponible dans plus de 15 langues ! 

Fonctionnalités principales :
• Récolte automatique des Points de Chaîne : Ne laissez plus filer vos points Twitch et récompenses Kick ! StreamPulse les collecte automatiquement en arrière-plan pendant que vous regardez.
• Alertes Live en temps réel : Soyez le premier averti. Recevez une notification native sur votre bureau dès que vos streamers préférés lancent leur direct.
• Aperçus vidéo au survol : Gagnez du temps en prévisualisant n'importe quel stream en direct d'un simple survol de la souris, sans même quitter la page en cours.
• Anti-Pause & Faible Latence : Empêchez la mise en pause automatique de vos streams lorsque vous changez d'onglet, et profitez d'une correction automatique de l'erreur réseau #2000 sur Twitch.
• Filtre de Chat & Temps de visionnage : Bloquez le spam grâce à des filtres par mots-clés et suivez le temps total que vous passez sur vos chaînes favorites.
• Tableau de bord unifié : Un pop-up élégant regroupant Twitch et Kick pour voir tous vos streamers en direct d'un seul coup d'œil.

Respect absolu de la vie privée :
StreamPulse ne collecte AUCUNE donnée personnelle, ne nécessite AUCUN compte et ne contient AUCUNE publicité. Vos préférences restent stockées en toute sécurité, localement sur votre ordinateur.
```

### Detailed Description (EN)
```text
StreamPulse is the ultimate browser extension to elevate your Twitch and Kick viewing experience. Ultra-lightweight and lightning fast, it automates your workflow without slowing down your browser.

✨ NEW: The extension is now fully translated and available in over 15 languages!

Key Features:
• Auto-Collect Channel Points: Never miss out on Twitch channel points or Kick rewards! StreamPulse claims them automatically in the background while you enjoy the stream.
• Real-Time Live Alerts: Be the first in chat. Get instant desktop notifications the second your favorite streamers go live.
• Live Hover Previews: Save time by previewing any live stream just by hovering over a channel link, no need to leave your current tab.
• Anti-Pause & Player Optimization: Prevent streams from pausing automatically when you switch tabs, and enjoy auto-recovery from annoying network errors (like Twitch #2000).
• Chat Filtering & Watch Time Tracker: Hide unwanted spam using keyword filters, and track your exact watch time across your favorite channels.
• Unified Dashboard: A sleek, all-in-one pop-up that seamlessly brings Twitch and Kick together to show who's live at a glance.

Privacy First:
StreamPulse does NOT collect any personal data, requires NO account, and contains ZERO ads or trackers. All your settings are securely saved locally on your device.
```

### Catégorie
`Productivité` (Productivity) ou `Outils de recherche` (Search Tools / Developer Tools)

### Objectif Unique (Single Purpose)
**FR** : `Centraliser les alertes de direct, la collecte automatique de points de chaîne et le filtrage de chat pour Twitch et Kick dans une interface unique.`  
**EN** : `Provide live stream notifications, automatic channel points collection, and chat filtering for Twitch and Kick in a single extension.`

### Langue Principale
`Français` (Primary), `Anglais` (Secondary)

---

## 2. Visuels et Assets (Graphics & Assets)

| Asset | Dimensions | Statut | Fichier |
|-------|-----------|--------|---------|
| Icône du Store | 128×128 PNG | ✅ Prêt | `images/photos/128px.png` |
| Capture d'écran 1 (Popup Dashboard) | 1280×800 ou 640×400 | ✅ Prêt | `images/screenshots/dashboard.png` |
| Capture d'écran 2 (Aperçu au survol) | 1280×800 ou 640×400 | ✅ Prêt | `images/screenshots/preview.png` |
| Capture d'écran 3 (Points de chaîne) | 1280×800 ou 640×400 | ✅ Prêt | `images/screenshots/points.png` |
| Capture d'écran 4 (Filtres chat) | 1280×800 ou 640×400 | ✅ Prêt | `images/screenshots/chat_filter.png` |
| Petite tuile promotionnelle | 440×280 PNG | 🟡 À générer | `images/promo/small_tile.png` |
| Grande tuile promotionnelle | 1400×560 PNG | 🟡 À générer | `images/promo/marquee.png` |

---

## 3. Justification des Permissions (Permissions Justification)

| Permission | Type | Justification explicite pour le Chrome Web Store |
|------------|------|--------------------------------------------------|
| `storage` | `permissions` | Permet d'enregistrer localement les préférences utilisateur, la liste des chaînes suivies, les filtres de chat et les statistiques sans serveur externe. |
| `alarms` | `permissions` | Permet d'exécuter des vérifications périodiques légères en arrière-plan pour détecter les prises de live Twitch/Kick et mettre à jour le statut des streams. |
| `notifications` | `permissions` | Permet d'afficher des notifications système natives à l'utilisateur lorsqu'un streamer suivi démarre son direct. |
| `offscreen` | `permissions` | Permet de créer un document hors écran dédié à la lecture des sons d'alerte et à la gestion audio sans bloquer le service worker. |
| `tabs` | `permissions` | Permet de détecter si des onglets Twitch ou Kick sont ouverts afin d'appliquer l'anti-pause vidéo et la synchronisation du lecteur. |
| `https://api.twitch.tv/*` | `host_permissions` | Permet d'interroger l'API officielle Twitch pour vérifier l'état en direct des chaînes et obtenir les métadonnées des streams. |
| `https://tmi.twitch.tv/*` | `host_permissions` | Permet de communiquer avec les serveurs de messagerie Twitch pour les fonctionnalités de chat et d'interaction. |
| `https://gql.twitch.tv/*` | `host_permissions` | Permet d'interagir avec l'API GraphQL Twitch pour la récupération automatique des Channel Points et l'affichage des prévisualisations. |
| `https://www.twitch.tv/*` | `host_permissions` | Permet d'injecter les scripts de prévisualisation au survol, l'anti-pause et le filtre de chat directement sur les pages Twitch. |
| `https://clips.twitch.tv/*` | `host_permissions` | Permet d'afficher les aperçus et lecteurs légers sur les clips Twitch. |
| `https://kick.com/*` | `host_permissions` | Permet d'injecter les scripts d'amélioration de lecteur, la récolte des points et le filtre de chat sur Kick.com. |
| `https/*.kick.com/*` | `host_permissions` | Permet de prendre en compte l'ensemble des sous-domaines Kick pour le monitoring et la prévisualisation. |
| `https://files.kick.com/*` | `host_permissions` | Permet de charger les images de profil, avatars et badges des streamers Kick. |
| `https://images.kick.com/*` | `host_permissions` | Permet d'afficher les vignettes et captures de couverture des lives Kick dans la pop-up. |
| `https://stream.kick.com/*` | `host_permissions` | Permet de récupérer les flux vidéo et prévisualisations de stream Kick. |
| `https://id.kick.com/*` | `host_permissions` | Permet de vérifier l'état de session utilisateur pour la récolte des récompenses Kick. |
| `https://api.kick.com/*` | `host_permissions` | Permet d'interroger l'API Kick pour obtenir les statuts en direct des streamers suivis. |

---

## 4. Confidentialité et Utilisation des Données (Privacy & Data Use)

### Collecte de données
- **L'extension collecte-t-elle des données utilisateur ?** : **Non**
- **Données transmises hors de l'appareil ?** : **Non**
- **Vente à des tiers ?** : **Non**
- **Utilisation à des fins publicitaires / crédit ?** : **Non**

### Déclaration d'utilisation des données
- Toutes les données (options, filtres, streamers enregistrés) sont conservées exclusivement en local via `chrome.storage.local`.
- Aucun serveur tiers d'analyse, de tracking ou de télémétrie n'est utilisé.

---

## 5. Politique de Confidentialité (Privacy Policy)

**URL de la politique de confidentialité** : `https://streampulse.fr/privacy` (ou via la page support `https://streampulse.fr/support.html`)

---

## 6. Informations Développeur & Support

- **Editeur** : `AlexisAMZ`
- **Email de contact** : `contact@streampulse.fr`
- **Site web officiel** : `https://streampulse.fr`
- **Support / Feedback** : `https://streampulse.fr/support.html`

---

## 7. Historique des Versions (Version History)

| Version | Date | Description des changements | Statut CWS |
|---------|------|-----------------------------|------------|
| 26.8.11 | 2026-08-11 | Bouton « Ajouter à StreamPulse » sur les pages de chaîne Twitch, page de notes de version localisée, traductions dans 15 langues ajoutées, ajustements d'interface (indicateur de latence). | Prêt pour publication |
| 26.8.6 | 2026-08-06 | Amélioration des aperçus vidéo Twitch/Kick, optimisation anti-pause du lecteur et gestion i18n FR/EN. | Prêt pour publication |

---

## 8. Traductions pour le Chrome Web Store (Prêt à copier-coller)

Les textes suivants sont formatés en texte brut pur, sans tiret cadratin ni markdown incompatible avec le Chrome Web Store.

### 🇪🇸 Espagnol (ES)
**Short Description**:
`Reclama Puntos del Canal automáticamente, alertas en vivo, vistas previas y filtros de chat para Twitch y Kick. ¡En 15 idiomas! Gratis.`

**Detailed Description**:
```text
StreamPulse es la extensión definitiva para mejorar tu experiencia en Twitch y Kick. Ultraligera y súper rápida, automatiza tus tareas sin ralentizar tu navegador.

✨ NUEVO: ¡La extensión ahora está completamente traducida y disponible en más de 15 idiomas!

Características principales:
• Reclamo automático de Puntos del Canal: ¡Nunca más te pierdas los puntos de Twitch o las recompensas de Kick! StreamPulse los recoge automáticamente en segundo plano mientras disfrutas del stream.
• Alertas en vivo en tiempo real: Sé el primero en el chat. Recibe notificaciones de escritorio al instante en cuanto tus streamers favoritos empiecen a transmitir.
• Vistas previas en vivo al pasar el cursor: Ahorra tiempo previsualizando cualquier stream en vivo con solo pasar el ratón por encima del enlace de un canal, sin tener que salir de la pestaña actual.
• Anti-Pausa y optimización del reproductor: Evita que los streams se pausen automáticamente al cambiar de pestaña y disfruta de la recuperación automática de errores de red (como el error #2000 de Twitch).
• Filtros de chat y rastreador de tiempo de visualización: Oculta el spam no deseado usando filtros de palabras clave y haz un seguimiento exacto de tu tiempo de visualización en tus canales favoritos.
• Panel unificado: Una ventana emergente elegante que reúne a Twitch y Kick para mostrarte quién está en vivo de un vistazo.

Privacidad ante todo:
StreamPulse NO recopila ningún dato personal, NO requiere cuenta y NO contiene anuncios ni rastreadores. Toda tu configuración se guarda de forma segura localmente en tu dispositivo.
```

### 🇧🇷 Portugais (PT-BR)
**Short Description**:
`Resgate automático de Pontos do Canal, alertas ao vivo, prévias e filtros de chat para Twitch e Kick. Em 15 idiomas! Grátis.`

**Detailed Description**:
```text
StreamPulse é a extensão definitiva para melhorar sua experiência na Twitch e na Kick. Super leve e extremamente rápida, ela automatiza suas tarefas sem deixar seu navegador lento.

✨ NOVIDADE: A extensão agora está totalmente traduzida e disponível em mais de 15 idiomas!

Principais Recursos:
• Coleta automática de Pontos do Canal: Nunca mais perca os pontos da Twitch ou recompensas da Kick! O StreamPulse coleta tudo automaticamente em segundo plano enquanto você assiste.
• Alertas ao vivo em tempo real: Seja o primeiro no chat. Receba notificações na área de trabalho instantaneamente quando seus streamers favoritos entrarem ao vivo.
• Prévias ao vivo ao passar o mouse: Economize tempo visualizando qualquer stream ao vivo apenas passando o mouse sobre o link de um canal, sem precisar sair da aba atual.
• Anti-Pausa e otimização do player: Impede que as transmissões pausem automaticamente quando você muda de aba e oferece recuperação automática de erros de rede (como o erro #2000 da Twitch).
• Filtro de chat e rastreador de tempo: Oculte spam indesejado usando filtros de palavras-chave e acompanhe exatamente o seu tempo assistido nos canais favoritos.
• Painel unificado: Um pop-up elegante que junta Twitch e Kick para mostrar quem está ao vivo de forma rápida e prática.

Privacidade em primeiro lugar:
O StreamPulse NÃO coleta dados pessoais, NÃO exige conta e NÃO contém anúncios ou rastreadores. Todas as suas configurações são salvas com segurança localmente no seu dispositivo.
```

### 🇩🇪 Allemand (DE)
**Short Description**:
`Auto-Sammeln von Kanalpunkten, Live-Warnungen, Vorschauen & Chat-Filter für Twitch & Kick. Verfügbar in 15 Sprachen! Kostenlos.`

**Detailed Description**:
```text
StreamPulse ist die ultimative Browser-Erweiterung, um dein Twitch- und Kick-Erlebnis zu verbessern. Ultraleicht und blitzschnell, automatisiert es deine Abläufe, ohne deinen Browser zu verlangsamen.

✨ NEU: Die Erweiterung ist jetzt vollständig übersetzt und in über 15 Sprachen verfügbar!

Hauptfunktionen:
• Automatisches Sammeln von Kanalpunkten: Verpasse nie wieder Twitch-Kanalpunkte oder Kick-Belohnungen! StreamPulse sammelt sie automatisch im Hintergrund, während du den Stream genießt.
• Echtzeit-Live-Benachrichtigungen: Sei der Erste im Chat. Erhalte sofortige Desktop-Benachrichtigungen, sobald deine Lieblings-Streamer online gehen.
• Live-Vorschau beim Darüberfahren: Spare Zeit, indem du jeden Live-Stream in der Vorschau ansiehst, indem du einfach mit der Maus über einen Kanal-Link fährst, ohne deinen aktuellen Tab zu verlassen.
• Anti-Pause & Player-Optimierung: Verhindere, dass Streams automatisch pausieren, wenn du den Tab wechselst, und profitiere von der automatischen Wiederherstellung bei Netzwerkfehlern (wie Twitch #2000).
• Chat-Filter & Watchtime-Tracker: Verstecke unerwünschten Spam mithilfe von Stichwortfiltern und verfolge deine genaue Wiedergabezeit auf deinen Lieblingskanälen.
• Einheitliches Dashboard: Ein elegantes Pop-up, das Twitch und Kick nahtlos zusammenführt, um auf einen Blick zu zeigen, wer live ist.

Datenschutz an erster Stelle:
StreamPulse sammelt KEINE persönlichen Daten, erfordert KEIN Konto und enthält KEINE Werbung oder Tracker. Alle deine Einstellungen werden sicher und lokal auf deinem Gerät gespeichert.
```


### 🇮🇹 Italien (IT)
**Short Description**:
`Ritiro automatico dei Punti Canale, avvisi live, anteprime e filtri chat per Twitch e Kick. Disponibile in 15 lingue! Gratis.`

**Detailed Description**:
```text
StreamPulse è l'estensione definitiva per migliorare la tua esperienza su Twitch e Kick. Ultraleggera e velocissima, automatizza il tuo flusso di lavoro senza rallentare il browser.

✨ NOVITÀ: L'estensione è ora completamente tradotta e disponibile in oltre 15 lingue!

Caratteristiche principali:
• Ritiro automatico dei Punti Canale: Non perderti più i punti canale di Twitch o le ricompense di Kick! StreamPulse li raccoglie automaticamente in background mentre ti godi la diretta.
• Avvisi in tempo reale: Sii il primo in chat. Ricevi notifiche desktop istantanee non appena i tuoi streamer preferiti vanno in onda.
• Anteprime live al passaggio del mouse: Risparmia tempo visualizzando l'anteprima di qualsiasi diretta passando semplicemente il mouse sul link del canale, senza dover lasciare la scheda attuale.
• Anti-Pausa e ottimizzazione del player: Evita che gli stream vadano in pausa automaticamente quando cambi scheda e sfrutta il ripristino automatico in caso di fastidiosi errori di rete (come Twitch #2000).
• Filtri chat e contatore del tempo di visione: Nascondi lo spam indesiderato usando filtri per parole chiave e tieni traccia del tempo trascorso a guardare i tuoi canali preferiti.
• Dashboard unificata: Un elegante pop-up che unisce perfettamente Twitch e Kick per mostrare chi è live a colpo d'occhio.

La privacy prima di tutto:
StreamPulse NON raccoglie alcun dato personale, NON richiede un account e NON contiene annunci o tracker. Tutte le tue impostazioni vengono salvate in modo sicuro a livello locale sul tuo dispositivo.
```

### 🇵🇱 Polonais (PL)
**Short Description**:
`Automatyczne zbieranie Punktów Kanału, alerty na żywo, podglądy i filtry czatu dla Twitch i Kick. Dostępne w 15 językach! Za darmo.`

**Detailed Description**:
```text
StreamPulse to najlepsze rozszerzenie do przeglądarki, które przeniesie Twoje doświadczenia z Twitcha i Kicka na wyższy poziom. Ultralekkie i błyskawiczne, automatyzuje Twoje działania bez spowalniania przeglądarki.

✨ NOWOŚĆ: Rozszerzenie jest teraz w pełni przetłumaczone i dostępne w ponad 15 językach!

Kluczowe funkcje:
• Automatyczne zbieranie Punktów Kanału: Nigdy więcej nie przegap punktów na Twitchu ani nagród na Kicku! StreamPulse zbiera je automatycznie w tle, podczas gdy Ty oglądasz stream.
• Alerty na żywo w czasie rzeczywistym: Bądź pierwszy na czacie. Otrzymuj błyskawiczne powiadomienia na pulpit w sekundę po tym, jak Twoi ulubieni streamerzy rozpoczną transmisję.
• Podgląd na żywo po najechaniu kursorem: Oszczędzaj czas podglądając dowolny stream na żywo najeżdżając kursorem na link do kanału, bez konieczności opuszczania bieżącej karty.
• Anti-Pause i optymalizacja odtwarzacza: Zapobiega automatycznemu wstrzymywaniu transmisji po zmianie karty i umożliwia automatyczne wznawianie po uciążliwych błędach sieciowych (jak np. Twitch #2000).
• Filtrowanie czatu i śledzenie czasu oglądania: Ukrywaj niechciany spam za pomocą filtrów słów kluczowych i dokładnie śledź czas oglądania na swoich ulubionych kanałach.
• Zintegrowany panel główny: Eleganckie wyskakujące okienko, które łączy Twitcha i Kicka pokazując na pierwszy rzut oka, kto jest na żywo.

Prywatność przede wszystkim:
StreamPulse NIE zbiera żadnych danych osobowych, NIE wymaga konta i NIE zawiera ŻADNYCH reklam ani trackerów. Wszystkie ustawienia są bezpiecznie zapisywane lokalnie na Twoim urządzeniu.
```

### 🇹🇷 Turc (TR)
**Short Description**:
`Twitch ve Kick için otomatik Kanal Puanı toplama, canlı bildirimler, önizlemeler ve sohbet filtreleri. 15 dilde mevcut! Ücretsiz.`

**Detailed Description**:
```text
StreamPulse, Twitch ve Kick izleme deneyiminizi bir üst seviyeye taşıyacak en iyi tarayıcı eklentisidir. Ultra hafif ve şimşek hızında olan bu eklenti, tarayıcınızı yavaşlatmadan işlemlerinizi otomatikleştirir.

✨ YENİ: Eklenti artık tamamen çevrilmiş durumda ve 15'ten fazla dilde kullanılabilir!

Temel Özellikler:
• Otomatik Kanal Puanı Toplama: Twitch kanal puanlarını veya Kick ödüllerini bir daha asla kaçırmayın! Siz yayının keyfini çıkarırken StreamPulse bunları arka planda otomatik olarak toplar.
• Gerçek Zamanlı Canlı Bildirimler: Sohbette ilk siz olun. Favori yayıncılarınız canlı yayına geçtiği saniye anında masaüstü bildirimleri alın.
• Üzerine Gelince Canlı Önizleme: Sadece bir kanal bağlantısının üzerine gelerek herhangi bir canlı yayını önizleyin, mevcut sekmenizden ayrılmanıza gerek kalmaz.
• Otomatik Duraklatma Engeli ve Oynatıcı Optimizasyonu: Sekme değiştirdiğinizde yayınların otomatik olarak duraklatılmasını önleyin ve sinir bozucu ağ hatalarından (Twitch #2000 gibi) otomatik olarak kurtulun.
• Sohbet Filtreleme ve İzleme Süresi Takibi: İstenmeyen spam'i anahtar kelime filtreleri kullanarak gizleyin ve favori kanallarınızda tam izleme sürenizi takip edin.
• Birleştirilmiş Kontrol Paneli: Twitch ve Kick'i bir araya getirerek kimin canlı yayında olduğunu tek bakışta gösteren şık bir açılır pencere.

Önce Gizlilik:
StreamPulse HİÇBİR kişisel veri toplamaz, hesap GEREKTİRMEZ ve SIFIR reklam veya izleyici içerir. Tüm ayarlarınız cihazınıza yerel olarak ve güvenli bir şekilde kaydedilir.
```

### 🇷🇺 Russe (RU)
**Short Description**:
`Автоматический сбор Баллов канала, уведомления, превью и фильтры чата для Twitch и Kick. Доступно на 15 языках! Бесплатно.`

**Detailed Description**:
```text
StreamPulse — лучшее браузерное расширение для улучшения вашего опыта просмотра Twitch и Kick. Ультралегкое и невероятно быстрое, оно автоматизирует ваши действия, не замедляя работу браузера.

✨ НОВИНКА: Расширение полностью переведено и доступно более чем на 15 языках!

Ключевые особенности:
• Автоматический сбор Баллов канала: Никогда не упускайте баллы Twitch и награды Kick! StreamPulse собирает их автоматически в фоновом режиме, пока вы наслаждаетесь стримом.
• Уведомления о прямых трансляциях в реальном времени: Будьте первым в чате. Получайте мгновенные уведомления на рабочий стол в ту секунду, когда ваши любимые стримеры выходят в эфир.
• Предварительный просмотр при наведении: Экономьте время, просматривая любой стрим в прямом эфире, просто наведя курсор на ссылку канала, без необходимости покидать текущую вкладку.
• Защита от пауз и оптимизация плеера: Предотвращает автоматическую паузу стримов при переключении вкладок и обеспечивает автоматическое восстановление после сетевых ошибок (например, Twitch #2000).
• Фильтрация чата и трекер времени просмотра: Скрывайте нежелательный спам с помощью фильтров по ключевым словам и точно отслеживайте время, проведенное на любимых каналах.
• Единая панель управления: Изящное всплывающее окно, которое объединяет Twitch и Kick, показывая, кто находится в прямом эфире с одного взгляда.

Конфиденциальность превыше всего:
StreamPulse НЕ собирает личные данные, НЕ требует учетной записи и НЕ содержит рекламы или трекеров. Все ваши настройки надежно сохраняются локально на вашем устройстве.
```

### 🇯🇵 Japonais (JA)
**Short Description**:
`TwitchとKick用の自動チャンネルポイント獲得、ライブ通知、プレビュー、チャットフィルター。15言語対応！無料。`

**Detailed Description**:
```text
StreamPulseは、TwitchとKickの視聴体験を向上させる究極のブラウザ拡張機能です。超軽量で非常に高速であり、ブラウザを遅くすることなく作業を自動化します。

✨ 新機能：拡張機能が完全に翻訳され、15以上の言語で利用可能になりました！

主な機能：
• チャンネルポイントの自動獲得：TwitchのチャンネルポイントやKickの報酬を二度と逃しません！配信を楽しんでいる間に、StreamPulseがバックグラウンドで自動的にポイントを獲得します。
• リアルタイムのライブ通知：チャットで一番乗りしましょう。お気に入りのストリーマーが配信を開始した瞬間に、デスクトップ通知をすぐに受け取れます。
• ホバー時のライブプレビュー：チャンネルのリンクにカーソルを合わせるだけで、現在のタブから移動することなく、ライブ配信をプレビューして時間を節約できます。
• 自動一時停止の防止とプレイヤーの最適化：タブを切り替えたときに配信が自動的に一時停止するのを防ぎ、（Twitchエラー #2000 のような）ネットワークエラーからの自動復旧機能を利用できます。
• チャットのフィルタリングと視聴時間トラッカー：キーワードフィルターを使用して不要なスパムを非表示にし、お気に入りのチャンネルでの正確な視聴時間を追跡します。
• 統合ダッシュボード：TwitchとKickを統合し、誰が配信中であるかを一目で確認できる洗練されたポップアップ。

プライバシー第一：
StreamPulseは個人データを一切収集せず、アカウントも不要で、広告やトラッカーもゼロです。すべての設定はお使いのデバイスにローカルかつ安全に保存されます。
```

### 🇰🇷 Coréen (KO)
**Short Description**:
`Twitch 및 Kick용 채널 포인트 자동 획득, 라이브 알림, 미리보기 및 채팅 필터. 15개 언어 지원! 무료.`

**Detailed Description**:
```text
StreamPulse는 Twitch 및 Kick 시청 경험을 향상시키는 최고의 브라우저 확장 프로그램입니다. 초경량이며 매우 빠르기 때문에 브라우저 속도를 저하시키지 않고 작업을 자동화합니다.

✨ 새로운 기능: 확장 프로그램이 완전히 번역되어 15개 이상의 언어로 제공됩니다!

주요 기능:
• 채널 포인트 자동 수집: Twitch 채널 포인트나 Kick 보상을 다시는 놓치지 마세요! 스트리밍을 즐기는 동안 StreamPulse가 백그라운드에서 자동으로 포인트를 수집합니다.
• 실시간 라이브 알림: 채팅에서 1등이 되어보세요. 좋아하는 스트리머가 방송을 시작하는 즉시 바탕 화면 알림을 받으세요.
• 호버 라이브 미리보기: 현재 탭을 벗어날 필요 없이 채널 링크 위로 마우스를 가져가기만 하면 라이브 스트림을 미리 볼 수 있어 시간을 절약할 수 있습니다.
• 일시 정지 방지 및 플레이어 최적화: 탭을 전환할 때 스트림이 자동으로 일시 정지되는 것을 방지하고, 성가신 네트워크 오류(예: Twitch #2000)로부터 자동 복구 기능을 즐기세요.
• 채팅 필터링 및 시청 시간 추적기: 키워드 필터를 사용하여 원치 않는 스팸을 숨기고, 좋아하는 채널의 정확한 시청 시간을 추적하세요.
• 통합 대시보드: Twitch와 Kick을 매끄럽게 통합하여 누가 방송 중인지 한눈에 보여주는 세련된 팝업입니다.

개인정보 보호 최우선:
StreamPulse는 개인 데이터를 전혀 수집하지 않으며, 계정이 필요하지 않고, 광고나 트래커가 전혀 없습니다. 모든 설정은 기기에 안전하게 로컬로 저장됩니다.
```

### 🇮🇩 Indonésien (ID)
**Short Description**:
`Klaim otomatis Channel Points, peringatan live, pratinjau & filter obrolan untuk Twitch & Kick. Tersedia dalam 15 bahasa! Gratis.`

**Detailed Description**:
```text
StreamPulse adalah ekstensi browser terbaik untuk meningkatkan pengalaman menonton Twitch dan Kick Anda. Sangat ringan dan secepat kilat, ini mengotomatiskan tugas Anda tanpa memperlambat browser Anda.

✨ BARU: Ekstensi ini sekarang telah diterjemahkan sepenuhnya dan tersedia dalam lebih dari 15 bahasa!

Fitur Utama:
• Kumpulkan Channel Points Otomatis: Jangan pernah melewatkan poin saluran Twitch atau hadiah Kick! StreamPulse mengklaimnya secara otomatis di latar belakang saat Anda menikmati streaming.
• Peringatan Live Real-Time: Jadilah yang pertama di obrolan. Dapatkan pemberitahuan desktop instan pada detik streamer favorit Anda mulai siaran.
• Pratinjau Live Saat Diarahkan: Menghemat waktu dengan mempratinjau live stream apa pun hanya dengan mengarahkan kursor ke tautan saluran, tidak perlu meninggalkan tab Anda saat ini.
• Anti-Jeda & Pengoptimalan Pemutar: Mencegah streaming dijeda secara otomatis saat Anda beralih tab, dan nikmati pemulihan otomatis dari kesalahan jaringan yang mengganggu (seperti Twitch #2000).
• Penyaringan Obrolan & Pelacak Waktu Tonton: Sembunyikan spam yang tidak diinginkan menggunakan filter kata kunci, dan lacak waktu tonton persis Anda di saluran favorit Anda.
• Dasbor Terpadu: Pop-up ramping dan lengkap yang menyatukan Twitch dan Kick untuk menunjukkan siapa yang sedang live secara sekilas.

Privasi Pertama:
StreamPulse TIDAK mengumpulkan data pribadi apa pun, TIDAK memerlukan akun, dan TIDAK MENGANDUNG iklan atau pelacak. Semua pengaturan Anda disimpan dengan aman secara lokal di perangkat Anda.
```

### 🇳🇱 Néerlandais (NL)
**Short Description**:
`Automatisch claimen van kanaalpunten, live meldingen, voorvertoningen & chatfilters voor Twitch & Kick. In 15 talen! Gratis.`

**Detailed Description**:
```text
StreamPulse is de ultieme browserextensie om je kijkervaring op Twitch en Kick te verbeteren. Vederlicht en razendsnel, het automatiseert je workflow zonder je browser te vertragen.

✨ NIEUW: De extensie is nu volledig vertaald en beschikbaar in meer dan 15 talen!

Belangrijkste functies:
• Kanaalpunten automatisch verzamelen: Loop nooit meer Twitch-kanaalpunten of Kick-beloningen mis! StreamPulse claimt ze automatisch op de achtergrond terwijl jij van de stream geniet.
• Realtime live waarschuwingen: Wees de eerste in de chat. Ontvang direct bureaubladmeldingen op het moment dat je favoriete streamers live gaan.
• Live voorvertoningen (hover): Bespaar tijd door een voorbeeld van een live stream te bekijken door simpelweg met je muis over een kanaallink te gaan, zonder dat je je huidige tabblad hoeft te verlaten.
• Anti-Pause en speleroptimalisatie: Voorkom dat streams automatisch pauzeren wanneer je van tabblad wisselt, en geniet van automatisch herstel van vervelende netwerkfouten (zoals Twitch #2000).
• Chatfiltering en kijktijdtracker: Verberg ongewenste spam met behulp van trefwoordfilters en houd je exacte kijktijd bij op je favoriete kanalen.
• Geünificeerd dashboard: Een strakke, alles-in-één pop-up die Twitch en Kick naadloos samenbrengt om in één oogopslag te laten zien wie er live is.

Privacy voorop:
StreamPulse verzamelt GEEN persoonlijke gegevens, vereist GEEN account en bevat NUL advertenties of trackers. Al je instellingen worden veilig en lokaal op je apparaat opgeslagen.
```

### 🇸🇪 Suédois (SV)
**Short Description**:
`Automatisk insamling av kanalpoäng, livevarningar, förhandsvisningar & chattfilter för Twitch & Kick. På 15 språk! Gratis.`

**Detailed Description**:
```text
StreamPulse är det ultimata webbläsartillägget för att förbättra din tittarupplevelse på Twitch och Kick. Ultralätt och blixtsnabb automatiserar den ditt arbetsflöde utan att göra din webbläsare långsammare.

✨ NYHET: Tillägget är nu helt översatt och tillgängligt på över 15 språk!

Nyckelfunktioner:
• Samla in kanalpoäng automatiskt: Missa aldrig Twitch-kanalpoäng eller Kick-belöningar igen! StreamPulse samlar in dem automatiskt i bakgrunden medan du njuter av streamen.
• Livevarningar i realtid: Var först i chatten. Få omedelbara skrivbordsaviseringar samma sekund som dina favoritstreamers går live.
• Live-förhandsvisningar vid hovring: Spara tid genom att förhandsgranska vilken live stream som helst bara genom att hålla muspekaren över en kanallänk, du behöver inte lämna din nuvarande flik.
• Anti-Pause och spelaroptimering: Förhindra att streams pausas automatiskt när du byter flik, och njut av automatisk återställning från irriterande nätverksfel (som Twitch #2000).
• Chattfiltrering och visningstidspårare: Dölj oönskad spam med hjälp av sökordsfilter och spåra din exakta visningstid över dina favoritkanaler.
• Enhetlig instrumentpanel: En elegant allt-i-ett-popup som sömlöst för samman Twitch och Kick för att visa vem som är live med en blick.

Integritet först:
StreamPulse samlar INTE in några personuppgifter, kräver INGET konto och innehåller NOLL annonser eller spårare. Alla dina inställningar sparas säkert lokalt på din enhet.
```

### 🇨🇿 Tchèque (CS)
**Short Description**:
`Automatické sbírání bodů, živá upozornění, náhledy a filtry chatu pro Twitch a Kick. K dispozici v 15 jazycích! Zdarma.`

**Detailed Description**:
```text
StreamPulse je dokonalé rozšíření prohlížeče, které pozvedne váš zážitek ze sledování na Twitchi a Kicku. Je mimořádně lehké a bleskově rychlé, automatizuje vaše činnosti, aniž by zpomalovalo váš prohlížeč.

✨ NOVINKA: Rozšíření je nyní plně přeloženo a je k dispozici ve více než 15 jazycích!

Klíčové vlastnosti:
• Automatické sbírání bodů kanálu: Už nikdy nezmeškáte body kanálu Twitch nebo odměny na Kicku! StreamPulse je automaticky sbírá na pozadí, zatímco si užíváte stream.
• Živá upozornění v reálném čase: Buďte v chatu první. Získejte okamžitá upozornění na plochu ve vteřině, kdy vaši oblíbení streameři začnou vysílat.
• Živé náhledy po najetí myší: Ušetřete čas tím, že si prohlédnete jakýkoli živý stream pouhým najetím myší na odkaz na kanál, aniž byste museli opustit aktuální kartu.
• Anti-Pause a optimalizace přehrávače: Zabraňte automatickému pozastavení streamů při přepínání karet a užijte si automatické zotavení z nepříjemných chyb sítě (jako je chyba #2000).
• Filtrování chatu a sledování času sledování: Skryjte nechtěný spam pomocí filtrů klíčových slov a sledujte svůj přesný čas sledování na svých oblíbených kanálech.
• Sjednocený ovládací panel: Elegantní vyskakovací okno, které plynule spojuje Twitch a Kick, abyste na první pohled viděli, kdo vysílá živě.

Ochrana soukromí na prvním místě:
StreamPulse NEshromažďuje žádné osobní údaje, NEvyžaduje ŽÁDNÝ účet a obsahuje NULA reklam nebo sledovačů. Všechna vaše nastavení jsou bezpečně uložena lokálně ve vašem zařízení.
```
