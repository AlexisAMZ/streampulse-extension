/**
 * Patch notes shown after an update.
 *
 * THE ONLY FILE TO EDIT WHEN YOU SHIP A RELEASE.
 *
 * Add a new entry at the TOP of RELEASES. The `version` MUST match the
 * `version` field in manifest.json — `npm run verify` fails the build if the
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
 *                     serif hero, so keep it to ~6 words in every language —
 *                     the last two are italic + violet, like the onboarding
 *                     welcome screen.
 *   subtitle i18n     One-line summary under the hero (optional). Falls back to
 *                     a count of the changes below.
 *   changes  array    { type, text } — type is "new" | "fix" | "improved",
 *                     text is an i18n map
 *   thanks   array    Contributor credits, newest release first:
 *                       handle  string  Display name / pseudo (required)
 *                       for     i18n    What they helped with (optional)
 *                       url     string  Profile link, https only (optional)
 */

/** Language used when a release has no text for the one the user picked. */
export const FALLBACK_LANGUAGE = "en";

export const RELEASES = [
  {
    version: "26.9.8",
    date: "2026-09-08",
    title: {
      fr: "Récap ZEvent et badge communautaire",
      en: "ZEvent recap and community badge",
      es: "Resumen del ZEvent e insignia comunitaria",
      "pt-BR": "Resumo do ZEvent e distintivo comunitário",
      de: "ZEvent-Rückblick und Community-Abzeichen",
      it: "Riepilogo ZEvent e badge della comunità",
      pl: "Podsumowanie ZEvent i odznaka społeczności",
      tr: "ZEvent özeti ve topluluk rozeti",
      ru: "Итоги ZEvent и значок сообщества",
      ja: "ZEventの記録とコミュニティバッジ",
      ko: "ZEvent 결산과 커뮤니티 배지",
      id: "Rekap ZEvent dan lencana komunitas",
      nl: "ZEvent-overzicht en community-badge",
      sv: "ZEvent-sammanfattning och gemenskapsmärke",
      cs: "Přehled ZEvent a komunitní odznak"
    },
    subtitle: {
      fr: "Votre bilan du ZEvent 2026 en image, et un badge StreamPulse dans le tchat Twitch.",
      en: "Your ZEvent 2026 stats as a shareable image, plus a StreamPulse badge in Twitch chat.",
      es: "Tu balance del ZEvent 2026 en imagen, y una insignia StreamPulse en el chat de Twitch.",
      "pt-BR": "Seu balanço do ZEvent 2026 em imagem, e um distintivo StreamPulse no chat da Twitch.",
      de: "Deine ZEvent-2026-Bilanz als Bild und ein StreamPulse-Abzeichen im Twitch-Chat.",
      it: "Il tuo bilancio dello ZEvent 2026 in immagine e un badge StreamPulse nella chat di Twitch.",
      pl: "Twoje podsumowanie ZEvent 2026 w obrazku i odznaka StreamPulse na czacie Twitcha.",
      tr: "ZEvent 2026 bilançonuz görsel olarak ve Twitch sohbetinde bir StreamPulse rozeti.",
      ru: "Ваши итоги ZEvent 2026 картинкой и значок StreamPulse в чате Twitch.",
      ja: "ZEvent 2026の記録を画像で。Twitchチャットには StreamPulse バッジ。",
      ko: "ZEvent 2026 결산을 이미지로, 그리고 트위치 채팅의 StreamPulse 배지.",
      id: "Rekap ZEvent 2026 Anda dalam gambar, plus lencana StreamPulse di obrolan Twitch.",
      nl: "Je ZEvent 2026-overzicht als afbeelding, plus een StreamPulse-badge in de Twitch-chat.",
      sv: "Din ZEvent 2026-sammanfattning som bild och ett StreamPulse-märke i Twitch-chatten.",
      cs: "Vaše bilance ZEvent 2026 v obrázku a odznak StreamPulse v chatu Twitche."
    },
    changes: [
      {
        type: "new",
        text: {
          fr: "Récap ZEvent 2026 : retrouvez le temps passé chez chaque streamer participant et exportez-le en image, au format Twitter ou story Instagram. Accessible depuis le bandeau ZEvent et depuis Réglages → Temps de visionnage.",
          en: "ZEvent 2026 recap: see how long you watched each participating streamer and export it as an image, in Twitter or Instagram story format. Available from the ZEvent banner and from Settings → Watch time.",
          es: "Resumen del ZEvent 2026: consulta el tiempo que pasaste con cada streamer participante y expórtalo como imagen, en formato Twitter o historia de Instagram. Disponible desde el banner ZEvent y en Ajustes → Tiempo de visionado.",
          "pt-BR": "Resumo do ZEvent 2026: veja quanto tempo você assistiu a cada streamer participante e exporte como imagem, em formato Twitter ou story do Instagram. Disponível no banner ZEvent e em Configurações → Tempo de exibição.",
          de: "ZEvent-2026-Rückblick: Sieh, wie lange du jeden teilnehmenden Streamer geschaut hast, und exportiere es als Bild im Twitter- oder Instagram-Story-Format. Erreichbar über das ZEvent-Banner und Einstellungen → Sehzeit.",
          it: "Riepilogo ZEvent 2026: scopri quanto tempo hai passato con ogni streamer partecipante ed esportalo come immagine, in formato Twitter o storia Instagram. Disponibile dal banner ZEvent e da Impostazioni → Tempo di visione.",
          pl: "Podsumowanie ZEvent 2026: sprawdź, ile czasu spędziłeś u każdego uczestniczącego streamera i wyeksportuj to jako obrazek w formacie Twittera lub relacji na Instagramie. Dostępne z banera ZEvent i z Ustawienia → Czas oglądania.",
          tr: "ZEvent 2026 özeti: katılan her yayıncıyı ne kadar izlediğinizi görün ve Twitter veya Instagram hikâye formatında görsel olarak dışa aktarın. ZEvent afişinden ve Ayarlar → İzleme süresi bölümünden erişilir.",
          ru: "Итоги ZEvent 2026: посмотрите, сколько вы смотрели каждого участвующего стримера, и сохраните картинку в формате Twitter или истории Instagram. Доступно из баннера ZEvent и в Настройки → Время просмотра.",
          ja: "ZEvent 2026の記録：参加ストリーマーごとの視聴時間を確認し、Twitter形式またはInstagramストーリー形式の画像として書き出せます。ZEventバナーと設定 → 視聴時間から利用できます。",
          ko: "ZEvent 2026 결산: 참가 스트리머별 시청 시간을 확인하고 트위터 또는 인스타그램 스토리 형식의 이미지로 내보낼 수 있습니다. ZEvent 배너와 설정 → 시청 시간에서 이용할 수 있습니다.",
          id: "Rekap ZEvent 2026: lihat berapa lama Anda menonton setiap streamer peserta dan ekspor sebagai gambar, dalam format Twitter atau story Instagram. Tersedia dari banner ZEvent dan Pengaturan → Waktu tonton.",
          nl: "ZEvent 2026-overzicht: bekijk hoelang je naar elke deelnemende streamer keek en exporteer het als afbeelding, in Twitter- of Instagram-storyformaat. Bereikbaar via de ZEvent-banner en Instellingen → Kijktijd.",
          sv: "ZEvent 2026-sammanfattning: se hur länge du tittade på varje deltagande streamer och exportera det som en bild, i Twitter- eller Instagram-storyformat. Nås från ZEvent-bannern och Inställningar → Tittartid.",
          cs: "Přehled ZEvent 2026: zjistěte, jak dlouho jste sledovali jednotlivé zúčastněné streamery, a exportujte to jako obrázek ve formátu Twitteru nebo Instagram story. Dostupné z banneru ZEvent a z Nastavení → Doba sledování."
        }
      },
      {
        type: "new",
        text: {
          fr: "Badge communautaire : tous les utilisateurs de StreamPulse sont automatiquement détectés et affichent une icône StreamPulse à côté de leur pseudo dans le tchat Twitch, visible par tous les membres de la communauté.",
          en: "Community badge: all StreamPulse users are automatically detected and display a StreamPulse icon next to their username in Twitch chat, visible to all community members.",
          es: "Insignia comunitaria: todos los usuarios de StreamPulse se detectan automáticamente y muestran un icono junto a su nombre en el chat de Twitch, visible para todos los miembros de la comunidad.",
          "pt-BR": "Distintivo comunitário: todos os usuários do StreamPulse são detectados automaticamente e exibem um ícone ao lado do nome no chat da Twitch, visível para todos os membros da comunidade.",
          de: "Community-Abzeichen: Alle StreamPulse-Nutzer werden automatisch erkannt und zeigen ein StreamPulse-Symbol neben ihrem Namen im Twitch-Chat an, sichtbar für alle Community-Mitglieder.",
          it: "Badge della comunità: tutti gli utenti StreamPulse vengono rilevati automaticamente e mostrano un'icona accanto al nome nella chat di Twitch, visibile a tutti i membri della comunità.",
          pl: "Odznaka społeczności: wszyscy użytkownicy StreamPulse są automatycznie wykrywani i wyświetlają ikonę obok swojego pseudonimu na czacie Twitcha, widoczną dla wszystkich członków społeczności.",
          tr: "Topluluk rozeti: tüm StreamPulse kullanıcıları otomatik olarak algılanır ve Twitch sohbetinde kullanıcı adlarının yanında bir StreamPulse simgesi görüntülenir, tüm topluluk üyeleri tarafından görülebilir.",
          ru: "Значок сообщества: все пользователи StreamPulse автоматически распознаются и отображают значок рядом с ником в чате Twitch, видимый всем участникам сообщества.",
          ja: "コミュニティバッジ：StreamPulseユーザーは自動的に検出され、Twitchチャットのユーザー名の横にStreamPulseアイコンが表示されます。すべてのコミュニティメンバーに表示されます。",
          ko: "커뮤니티 배지: 모든 StreamPulse 사용자가 자동으로 감지되어 트위치 채팅의 사용자 이름 옆에 StreamPulse 아이콘이 표시되며, 모든 커뮤니티 멤버에게 보입니다.",
          id: "Lencana komunitas: semua pengguna StreamPulse terdeteksi secara otomatis dan menampilkan ikon StreamPulse di samping nama mereka di obrolan Twitch, terlihat oleh semua anggota komunitas.",
          nl: "Community-badge: alle StreamPulse-gebruikers worden automatisch herkend en tonen een StreamPulse-pictogram naast hun naam in de Twitch-chat, zichtbaar voor alle leden van de community.",
          sv: "Gemenskapsmärke: alla StreamPulse-användare upptäcks automatiskt och visar en StreamPulse-ikon bredvid sitt namn i Twitch-chatten, synlig för alla i gemenskapen.",
          cs: "Komunitní odznak: všichni uživatelé StreamPulse jsou automaticky rozpoznáni a zobrazují ikonu StreamPulse vedle svého jména v chatu Twitche, viditelnou pro všechny členy komunity."
        }
      },
      {
        type: "new",
        text: {
          fr: "Dispositif temporaire ZEvent 2026 : bandeau interactif, filtre dédié et surlignage vert des streamers participants. Fonctionnalité active pour le week-end qui se désactivera automatiquement lundi à 3h du matin (désactivable à tout moment dans les Réglages).",
          en: "Temporary ZEvent 2026 features: interactive banner, dedicated filter, and green highlights for participating streamers. Active for the weekend and automatically turns off Monday at 3:00 AM (can also be toggled anytime in Settings).",
          es: "Dispositivo temporal ZEvent 2026: banner interactivo, filtro dedicado y resaltado verde para streamers participantes. Función activa para el fin de semana que se desactivará automáticamente el lunes a las 3:00 AM (desactivable en Ajustes).",
          "pt-BR": "Recursos temporários do ZEvent 2026: banner interativo, filtro dedicado e destaque verde para streamers participantes. Ativo para o fim de semana e desativado automaticamente na segunda-feira às 3h (desativável em Configurações).",
          de: "Temporäres ZEvent 2026 Feature: interaktives Banner, eigener Filter und grüne Hervorhebung für teilnehmende Streamer. Aktiv für das Wochenende und schaltet sich Montagmorgen um 3:00 Uhr automatisch ab (jederzeit in den Einstellungen deaktivierbar).",
          it: "Funzionalità temporanee ZEvent 2026: banner interattivo, filtro dedicato ed evidenziazione verde per gli streamer partecipanti. Attivo per il fine settimana e disattivato automaticamente lunedì alle 3:00 (disattivabile nelle Impostazioni).",
          pl: "Tymczasowe funkcje ZEvent 2026: interaktywny baner, dedykowany filtr i zielone wyróżnienie uczestniczących streamerów. Działa przez weekend i wyłącza się automatycznie w poniedziałek o 3:00 (możliwość wyłączenia w Ustawieniach).",
          tr: "Geçici ZEvent 2026 özellikleri: etkileşimli afiş, özel filtre ve katılımcı yayıncılar için yeşil vurgulama. Hafta sonu boyunca aktif olup Pazartesi 03:00'te otomatik kapanır (Ayarlar'dan da kapatılabilir).",
          ru: "Временные функции ZEvent 2026: интерактивный баннер, отдельный фильтр и зелёная подсветка стримеров. Активно на выходных и автоматически отключится в понедельник в 3:00 (можно отключить в Настройках).",
          ja: "ZEvent 2026週末限定機能：インタラクティブバナー、専用フィルター、参加配信者のグリーンハイライト。月曜午前3時に自動終了します（設定からいつでも無効化可能）。",
          ko: "ZEvent 2026 주말 한정 기능: 인터랙티브 배너, 전용 필터 및 참가 스트리머 녹색 강조 표시. 월요일 오전 3시에 자동 종료됩니다(설정에서 언제든지 비활성화 가능).",
          id: "Fitur sementara ZEvent 2026: banner interaktif, filter khusus, dan sorotan hijau untuk streamer yang berpartisipasi. Aktif selama akhir pekan dan mati otomatis Senin pukul 03.00 (bisa dimatikan di Pengaturan).",
          nl: "Tijdelijke ZEvent 2026-functies: interactieve banner, speciale filter en groene markering voor deelnemende streamers. Actief voor het weekend en schakelt maandag om 3:00 uur automatisch uit (altijd uitschakelbaar in Instellingen).",
          sv: "Tillfälliga ZEvent 2026-funktioner: interaktiv banner, dedikerat filter och grön markering för deltagande streamers. Aktivt under helgen och stängs av automatiskt måndag kl. 03:00 (kan stängas av i Inställningar).",
          cs: "Dočasné funkce ZEvent 2026: interaktivní banner, vyhrazený filtr a zelené zvýraznění zúčastněných streamerů. Aktivní během víkendu a v pondělí ve 3:00 se automaticky vypne (lze vypnout v Nastavení)."
        }
      },
      {
        type: "new",
        text: {
          fr: "Prise en charge officielle de Mozilla Firefox : moteur audio natif sans document offscreen et conformité stricte aux exigences de permissions Mozilla.",
          en: "Official Mozilla Firefox support: native background audio engine without offscreen documents and strict compliance with Mozilla permission rules.",
          es: "Compatibilidad oficial con Mozilla Firefox: motor de audio nativo sin documentos offscreen y cumplimiento estricto de los permisos de Mozilla.",
          "pt-BR": "Suporte oficial ao Mozilla Firefox: mecanismo de áudio nativo sem documentos offscreen e conformidade estrita com as permissões da Mozilla.",
          de: "Offizielle Unterstützung für Mozilla Firefox: nativer Audio-Engine ohne Offscreen-Dokumente und strikte Einhaltung der Mozilla-Berechtigungsrichtlinien.",
          it: "Supporto ufficiale per Mozilla Firefox: motore audio nativo senza documenti offscreen e piena conformità alle regole sui permessi di Mozilla.",
          pl: "Oficjalne wsparcie dla przeglądarki Mozilla Firefox: natywny silnik audio bez dokumentów offscreen i pełna zgodność z zasadami uprawnień Mozilli.",
          tr: "Resmi Mozilla Firefox desteği: offscreen belgeleri olmadan yerel ses motoru ve Mozilla izin kurallarına tam uyumluluk.",
          ru: "Официальная поддержка Mozilla Firefox: встроенный звуковой движок без offscreen-документов и строгое соблюдение правил разрешений Mozilla.",
          ja: "Mozilla Firefoxに正式対応。オフスクリーン文書を使用しないネイティブ音声エンジンと、Mozillaの権限ポリシーに完全準拠。",
          ko: "Mozilla Firefox 공식 지원: 오프스크린 문서가 없는 기본 오디오 엔진 탑재 및 Mozilla 권한 정책 완전 준수.",
          id: "Dukungan resmi untuk Mozilla Firefox: mesin audio bawaan tanpa dokumen offscreen dan kepatuhan penuh terhadap kebijakan izin Mozilla.",
          nl: "Officiële ondersteuning voor Mozilla Firefox: native audio-engine zonder offscreen-documenten en strikte naleving van de Mozilla-machtigingsregels.",
          sv: "Officiellt stöd för Mozilla Firefox: inbyggd ljudmotor utan offscreen-dokument och full överensstämmelse med Mozillas behörighetsregler.",
          cs: "Oficiální podpora pro Mozilla Firefox: nativní zvukový modul bez offscreen dokumentů a přísné dodržení pravidel oprávnění Mozilla."
        }
      },
      {
        type: "improved",
        text: {
          fr: "Le badge est désactivable à tout moment dans Réglages → Chat → Badge communautaire.",
          en: "The badge can be disabled anytime in Settings → Chat → Community badge.",
          es: "La insignia se puede desactivar en cualquier momento en Ajustes → Chat → Insignia comunitaria.",
          "pt-BR": "O distintivo pode ser desativado a qualquer momento em Configurações → Chat → Distintivo comunitário.",
          de: "Das Abzeichen kann jederzeit unter Einstellungen → Chat → Community-Abzeichen deaktiviert werden.",
          it: "Il badge può essere disattivato in qualsiasi momento in Impostazioni → Chat → Badge della comunità.",
          pl: "Odznakę można wyłączyć w dowolnym momencie w Ustawienia → Czat → Odznaka społeczności.",
          tr: "Rozet, Ayarlar → Sohbet → Topluluk rozeti bölümünden istediğiniz zaman devre dışı bırakılabilir.",
          ru: "Значок можно отключить в любое время в Настройки → Чат → Значок сообщества.",
          ja: "バッジは設定 → チャット → コミュニティバッジからいつでも無効にできます。",
          ko: "배지는 설정 → 채팅 → 커뮤니티 배지에서 언제든지 비활성화할 수 있습니다.",
          id: "Lencana dapat dinonaktifkan kapan saja di Pengaturan → Obrolan → Lencana komunitas.",
          nl: "De badge kan op elk moment worden uitgeschakeld via Instellingen → Chat → Community-badge.",
          sv: "Märket kan inaktiveras när som helst i Inställningar → Chatt → Gemenskapsmärke.",
          cs: "Odznak lze kdykoli deaktivovat v Nastavení → Chat → Komunitní odznak."
        }
      },
      {
        type: "improved",
        text: {
          fr: "Le badge communautaire n'envoie plus votre pseudo : seule une empreinte anonyme et irréversible est transmise, et la liste publique n'expose aucun nom.",
          en: "The community badge no longer sends your username: only an anonymous, irreversible fingerprint is transmitted, and the public list exposes no names.",
          es: "La insignia comunitaria ya no envía tu nombre: solo se transmite una huella anónima e irreversible, y la lista pública no expone ningún nombre.",
          "pt-BR": "O distintivo comunitário não envia mais o seu nome: apenas uma impressão anônima e irreversível é transmitida, e a lista pública não expõe nome algum.",
          de: "Das Community-Abzeichen sendet deinen Namen nicht mehr: Übertragen wird nur ein anonymer, nicht umkehrbarer Fingerabdruck, und die öffentliche Liste enthält keine Namen.",
          it: "Il badge della comunità non invia più il tuo nome: viene trasmessa solo un'impronta anonima e irreversibile, e l'elenco pubblico non espone alcun nome.",
          pl: "Odznaka społeczności nie wysyła już Twojego pseudonimu: przesyłany jest wyłącznie anonimowy, nieodwracalny odcisk, a publiczna lista nie ujawnia żadnych nazw.",
          tr: "Topluluk rozeti artık kullanıcı adınızı göndermiyor: yalnızca anonim ve geri döndürülemez bir parmak izi iletilir ve herkese açık liste hiçbir ad içermez.",
          ru: "Значок сообщества больше не отправляет ваш ник: передаётся только анонимный необратимый отпечаток, и публичный список не содержит имён.",
          ja: "コミュニティバッジはユーザー名を送信しなくなりました。送られるのは匿名で復元できないハッシュのみで、公開リストに名前は含まれません。",
          ko: "커뮤니티 배지는 더 이상 사용자 이름을 보내지 않습니다. 익명이며 되돌릴 수 없는 지문만 전송되고, 공개 목록에는 이름이 없습니다.",
          id: "Lencana komunitas tidak lagi mengirim nama pengguna Anda: hanya sidik anonim dan tidak dapat dibalik yang dikirim, dan daftar publik tidak memuat nama.",
          nl: "De community-badge stuurt je naam niet meer: alleen een anonieme, onomkeerbare vingerafdruk wordt verzonden, en de openbare lijst bevat geen namen.",
          sv: "Gemenskapsmärket skickar inte längre ditt namn: endast ett anonymt, oåterkalleligt fingeravtryck överförs, och den offentliga listan innehåller inga namn.",
          cs: "Komunitní odznak už neodesílá vaše jméno: přenáší se pouze anonymní a nevratný otisk a veřejný seznam neobsahuje žádná jména."
        }
      },
      {
        type: "improved",
        text: {
          fr: "Mise à jour des intitulés de l'extension dans les 15 langues pour refléter l'ensemble des fonctionnalités : alertes live en temps réel, points de chaîne et Twitch Drops.",
          en: "Updated extension titles across all 15 languages to highlight the full feature set: real-time live alerts, Channel Points, and Twitch Drops.",
          es: "Actualización de los títulos de la extensión en los 15 idiomas para reflejar todas las funciones: alertas en vivo en tiempo real, puntos de canal y Twitch Drops.",
          "pt-BR": "Atualização dos títulos da extensão nos 15 idiomas para destacar todos os recursos: alertas ao vivo em tempo real, pontos de canal e Twitch Drops.",
          de: "Aktualisierung der Erweiterungstitel in allen 15 Sprachen, um den gesamten Funktionsumfang widerzuspiegeln: Live-Benachrichtigungen, Kanalpunkte und Twitch Drops.",
          it: "Aggiornati i titoli dell'estensione in tutte le 15 lingue per evidenziare tutte le funzionalità: avvisi live in tempo reale, punti canale e Twitch Drops.",
          pl: "Zaktualizowano nazwy rozszerzenia we wszystkich 15 językach, aby uwzględnić pełny zestaw funkcji: powiadomienia na żywo, punkty i Twitch Drops.",
          tr: "Uzantı başlıkları, tüm özellikleri vurgulamak üzere 15 dilde güncellendi: gerçek zamanlı canlı yayın bildirimleri, Kanal Puanları ve Twitch Drops.",
          ru: "Обновлены названия расширения на всех 15 языках, отражающие полный набор функций: оповещения о трансляциях, баллы канала и Twitch Drops.",
          ja: "全15言語で拡張機能のタイトルを更新し、リアルタイム配信通知、チャンネルポイント、Twitch Dropsなど全機能を反映。",
          ko: "실시간 라이브 알림, 채널 포인트, Twitch Drops 등 모든 기능을 반영하도록 15개 언어 전체에서 확장 프로그램 제목을 개편했습니다.",
          id: "Pembaruan judul ekstensi di semua 15 bahasa untuk mencerminkan seluruh fitur: peringatan siaran langsung, Poin Saluran, dan Twitch Drops.",
          nl: "Titels van de extensie bijgewerkt in alle 15 talen om het volledige functiepakket te weerspiegelen: live meldingen, kanaalpunten en Twitch Drops.",
          sv: "Uppdaterade titlar på tillägget i alla 15 språk för att spegla hela funktionsuppsättningen: realtidsaviseringar, kanalpoäng och Twitch Drops.",
          cs: "Aktualizace názvů rozšíření ve všech 15 jazycích tak, aby odrážely všechny funkce: živá upozornění v reálném čase, body kanálu a Twitch Drops."
        }
      },
      {
        type: "improved",
        text: {
          fr: "La barre supérieure du pop-up est allégée : le badge de points en double en haut à droite a été retiré. Le compteur principal reste mis en valeur dans la section d'accueil avec son animation fluide.",
          en: "The popup top bar has been streamlined: the duplicate points badge in the top right was removed. The main counter remains highlighted in the greeting section with smooth animation.",
          es: "La barra superior del pop-up se ha simplificado: se eliminó la insignia de puntos duplicada en la esquina superior derecha. El contador principal se mantiene en la sección de inicio con su animación fluida.",
          "pt-BR": "A barra superior do pop-up foi simplificada: o emblema de pontos duplicado no canto superior direito foi removido. O contador principal permanece em destaque na seção inicial com animação fluida.",
          de: "Die obere Leiste des Pop-ups wurde aufgeräumt: Das doppelte Punkte-Symbol oben rechts wurde entfernt. Der Hauptzähler bleibt im Begrüßungsbereich mit flüssiger Animation hervorgehoben.",
          it: "La barra superiore del popup è stata alleggerita: il badge dei punti duplicato in alto a destra è stato rimosso. Il contatore principale rimane in evidenza nella sezione iniziale con animazione fluida.",
          pl: "Górny pasek okna został odchudzony: usunięto zduplikowaną plakietkę punktów w prawym górnym rogu. Główny licznik pozostaje wyróżniony w sekcji powitalnej z płynną animacją.",
          tr: "Açılır pencerenin üst çubuğu sadeleştirildi: sağ üstteki yinelenen puan rozeti kaldırıldı. Ana sayaç, karşılama bölümünde akıcı animasyonuyla vurgulanmaya devam ediyor.",
          ru: "Верхняя панель всплывающего окна стала чище: дублирующий значок баллов в правом верхнем углу удалён. Основной счётчик остаётся на главном экране с плавной анимацией.",
          ja: "ポップアップ上部バーを整理し、右上の重複したポイントバッジを削除しました。メインカウンターはウェルカムセクションでスムーズなアニメーションとともに引き続き表示されます。",
          ko: "팝업 상단 표시줄이 정리되었습니다. 오른쪽 상단의 중복 포인트 배지가 제거되었으며, 기본 카운터는 환영 섹션에서 부드러운 애니메이션과 함께 계속 유지됩니다.",
          id: "Bilah atas popup telah dirapikan: lencana poin duplikat di kanan atas dihapus. Penghitung utama tetap ditonjolkan di bagian pembuka dengan animasi yang halus.",
          nl: "De bovenbalk van de pop-up is opgeruimd: de dubbele puntenbadge rechtsboven is verwijderd. De hoofdteller blijft met vloeiende animatie zichtbaar in het begroetingsgedeelte.",
          sv: "Popupens övre fält har rensats upp: den dubbla poängbrickan uppe till höger togs bort. Huvudräknaren förblir framhävd i välkomstsektionen med mjuk animering.",
          cs: "Horní lišta vyskakovacího okna byla zpřehledněna: duplicitní odznak bodů vpravo nahoře byl odstraněn. Hlavní počítadlo zůstává zvýrazněno v uvítací sekci s plynulou animací."
        }
      },
      {
        type: "fix",
        text: {
          fr: "Correction du chargement de l'icône Twitch sur les systèmes et navigateurs stricts sur la casse des noms de fichiers.",
          en: "Fixed Twitch icon loading on systems and browsers enforcing strict case sensitivity on filenames.",
          es: "Corrección de la carga del icono de Twitch en sistemas y navegadores estrictos con las mayúsculas y minúsculas.",
          "pt-BR": "Correção do carregamento do ícone da Twitch em sistemas e navegadores sensíveis a maiúsculas e minúsculas.",
          de: "Korrektur beim Laden des Twitch-Symbols auf Systemen und Browsern mit strikter Groß-/Kleinschreibung.",
          it: "Corretto il caricamento dell'icona di Twitch su sistemi e browser rigorosi sulla distinzione tra maiuscole e minuscole.",
          pl: "Naprawiono ładowanie ikony Twitcha w systemach i przeglądarkach rozróżniających wielkość liter w nazwach plików.",
          tr: "Dosya adlarında büyük/küçük harf duyarlılığı olan sistem ve tarayıcılarda Twitch simgesinin yüklenmesi düzeltildi.",
          ru: "Исправлена загрузка значка Twitch в системах и браузерах, чувствительных к регистру имён файлов.",
          ja: "ファイル名の大文字・小文字を厳格に区別する環境やブラウザで、Twitchアイコンが正しく読み込まれるよう修正しました。",
          ko: "파일명 대소문자를 엄격하게 구분하는 시스템 및 브라우저에서 트위치 아이콘이 정상적으로 로드되도록 수정했습니다.",
          id: "Memperbaiki pemuatan ikon Twitch pada sistem dan peramban yang sensitif terhadap huruf besar/kecil pada nama file.",
          nl: "Oplossing voor het laden van het Twitch-pictogram op systemen en browsers die hoofdlettergevoelig zijn voor bestandsnamen.",
          sv: "Fixat laddning av Twitch-ikonen på system och webbläsare som skiljer på stora och små bokstäver.",
          cs: "Oprava načítání ikony Twitche na systémech a v prohlížečích citlivých na velikost písmen v názvech souborů."
        }
      }
    ]
  },
  {
    version: "26.8.12",
    "date": "2026-08-30",
    "title": {
      "fr": "Il ressemble enfin à Twitch",
      "en": "It finally looks like Twitch",
      "es": "Por fin parece de Twitch",
      "pt-BR": "Enfim com a cara da Twitch",
      "de": "Endlich wie ein Twitch-Button",
      "it": "Finalmente sembra di Twitch",
      "pl": "Wreszcie wygląda jak Twitch",
      "tr": "Sonunda Twitch'e benziyor",
      "ru": "Наконец-то как у Twitch",
      "ja": "ようやくTwitchらしく",
      "ko": "마침내 트위치처럼",
      "id": "Akhirnya terlihat seperti Twitch",
      "nl": "Eindelijk net als Twitch",
      "sv": "Äntligen som en Twitch-knapp",
      "cs": "Konečně vypadá jako Twitch"
    },
    "subtitle": {
      "fr": "Le bouton de chaîne adopte la forme, la taille et les couleurs de Twitch, et affiche enfin le bon état.",
      "en": "The channel button takes on Twitch's shape, size and colours, and finally shows the right state.",
      "es": "El botón de canal adopta la forma, el tamaño y los colores de Twitch, y por fin muestra el estado correcto.",
      "pt-BR": "O botão de canal adota a forma, o tamanho e as cores da Twitch, e enfim mostra o estado certo.",
      "de": "Die Kanal-Schaltfläche übernimmt Form, Größe und Farben von Twitch und zeigt endlich den richtigen Zustand.",
      "it": "Il pulsante del canale adotta forma, dimensioni e colori di Twitch e mostra finalmente lo stato corretto.",
      "pl": "Przycisk kanału przejmuje kształt, rozmiar i kolory Twitcha i wreszcie pokazuje właściwy stan.",
      "tr": "Kanal düğmesi Twitch'in biçimini, boyutunu ve renklerini benimsiyor ve nihayet doğru durumu gösteriyor.",
      "ru": "Кнопка на странице канала перенимает форму, размер и цвета Twitch и наконец показывает верное состояние.",
      "ja": "チャンネルページのボタンがTwitchの形状・サイズ・配色を採用し、ようやく正しい状態を表示します。",
      "ko": "채널 버튼이 트위치의 모양과 크기, 색상을 그대로 따르고 마침내 올바른 상태를 표시합니다.",
      "id": "Tombol saluran mengadopsi bentuk, ukuran, dan warna Twitch, dan akhirnya menampilkan status yang benar.",
      "nl": "De kanaalknop neemt de vorm, grootte en kleuren van Twitch over en toont eindelijk de juiste status.",
      "sv": "Kanalknappen antar Twitchs form, storlek och färger och visar äntligen rätt status.",
      "cs": "Tlačítko na stránce kanálu přebírá tvar, velikost i barvy Twitche a konečně zobrazuje správný stav."
    },
    "changes": [
      {
        "type": "improved",
        "text": {
          "fr": "Le bouton « Ajouter à StreamPulse » reprend maintenant exactement la géométrie des boutons de Twitch : pilule complète, 32 px de haut, et le même gris que « S'abonner » une fois la chaîne suivie. Il ne se repère plus comme un élément rapporté au milieu de la barre d'actions.",
          "en": "The “Add to StreamPulse” button now matches Twitch's own geometry exactly: full pill shape, 32px tall, and the same grey as “Subscribe” once the channel is tracked. It no longer stands out as something bolted onto the action row.",
          "es": "El botón «Añadir a StreamPulse» adopta ahora exactamente la geometría de los botones de Twitch: forma de píldora completa, 32 px de alto y el mismo gris que «Suscribirse» una vez seguido el canal. Ya no destaca como un añadido en la barra de acciones.",
          "pt-BR": "O botão “Adicionar ao StreamPulse” agora segue exatamente a geometria dos botões da Twitch: formato de pílula completo, 32 px de altura e o mesmo cinza de “Inscrever-se” depois que o canal é adicionado. Ele não parece mais um elemento colado na barra de ações.",
          "de": "Die Schaltfläche „Zu StreamPulse hinzufügen“ übernimmt jetzt exakt die Geometrie der Twitch-Schaltflächen: vollständige Pillenform, 32 px hoch und dasselbe Grau wie „Abonnieren“, sobald der Kanal hinzugefügt wurde. Sie wirkt in der Aktionsleiste nicht länger wie ein Fremdkörper.",
          "it": "Il pulsante “Aggiungi a StreamPulse” adotta ora esattamente la geometria dei pulsanti di Twitch: forma a pillola completa, 32 px di altezza e lo stesso grigio di “Iscriviti” una volta seguito il canale. Non si distingue più come un elemento aggiunto alla barra delle azioni.",
          "pl": "Przycisk „Dodaj do StreamPulse” ma teraz dokładnie taką samą geometrię jak przyciski Twitcha: pełny kształt pigułki, 32 px wysokości i ten sam szary kolor co „Subskrybuj” po dodaniu kanału. Nie wyróżnia się już jako element doklejony do paska akcji.",
          "tr": "“StreamPulse'a Ekle” düğmesi artık Twitch düğmelerinin geometrisini birebir kullanıyor: tam hap biçimi, 32 piksel yükseklik ve kanal eklendiğinde “Abone Ol” ile aynı gri. Artık işlem çubuğuna sonradan eklenmiş gibi durmuyor.",
          "ru": "Кнопка «Добавить в StreamPulse» теперь в точности повторяет геометрию кнопок Twitch: полностью скруглённая форма, высота 32 пикселя и тот же серый цвет, что и у «Подписаться», после добавления канала. Она больше не выделяется как чужеродный элемент на панели действий.",
          "ja": "「StreamPulseに追加」ボタンが、Twitchのボタンと完全に同じ形状になりました。角丸の錠剤型、高さ32px、チャンネル追加後は「チャンネル登録」と同じグレーです。アクションバーの中で後付けの要素に見えることがなくなりました。",
          "ko": "‘StreamPulse에 추가’ 버튼이 이제 트위치 버튼의 형태를 그대로 따릅니다. 완전한 알약 모양, 높이 32px, 채널을 추가한 뒤에는 ‘구독’과 같은 회색입니다. 더 이상 작업 표시줄에 덧붙인 요소처럼 보이지 않습니다.",
          "id": "Tombol “Tambahkan ke StreamPulse” kini mengikuti geometri tombol Twitch secara persis: bentuk pil penuh, tinggi 32 px, dan abu-abu yang sama dengan “Berlangganan” setelah saluran ditambahkan. Tombol ini tidak lagi terlihat seperti elemen tempelan di bilah tindakan.",
          "nl": "De knop ‘Toevoegen aan StreamPulse’ neemt nu precies de vormgeving van de Twitch-knoppen over: volledige pilvorm, 32 px hoog en hetzelfde grijs als ‘Abonneren’ zodra het kanaal is toegevoegd. Hij valt niet langer op als een vreemd element in de actiebalk.",
          "sv": "Knappen ”Lägg till i StreamPulse” följer nu exakt Twitchs egen geometri: helt rundad form, 32 px hög och samma grå som ”Prenumerera” när kanalen har lagts till. Den sticker inte längre ut som ett främmande element i åtgärdsraden.",
          "cs": "Tlačítko „Přidat do StreamPulse“ nyní přesně kopíruje geometrii tlačítek Twitche: plný tvar pilulky, výška 32 px a stejná šedá jako u „Odebírat“, jakmile kanál přidáte. Už nepůsobí jako cizí prvek v panelu akcí."
        }
      },
      {
        "type": "fix",
        "text": {
          "fr": "Le bouton affichait « Ajouter » sur une chaîne déjà suivie, puis basculait en gris une seconde plus tard. Il interrogeait le service worker, qui s'endort en arrière-plan et ne répondait pas ; la liste est maintenant lue directement dans le stockage, qui répond toujours.",
          "en": "The button showed “Add” on a channel you were already tracking, then flipped to grey a second later. It was asking the service worker, which goes to sleep in the background and never answered; the list is now read straight from storage, which always answers.",
          "es": "El botón mostraba «Añadir» en un canal que ya seguías y cambiaba a gris un segundo después. Consultaba al service worker, que se duerme en segundo plano y no respondía; ahora la lista se lee directamente del almacenamiento, que siempre responde.",
          "pt-BR": "O botão mostrava “Adicionar” em um canal que você já seguia e mudava para cinza um segundo depois. Ele consultava o service worker, que hiberna em segundo plano e não respondia; agora a lista é lida direto do armazenamento, que sempre responde.",
          "de": "Die Schaltfläche zeigte „Hinzufügen“ bei einem bereits hinzugefügten Kanal und wechselte erst eine Sekunde später zu Grau. Sie fragte den Service Worker ab, der im Hintergrund einschläft und nicht antwortete; die Liste wird jetzt direkt aus dem Speicher gelesen, der immer antwortet.",
          "it": "Il pulsante mostrava “Aggiungi” su un canale già seguito, per poi diventare grigio un secondo dopo. Interrogava il service worker, che va in sospensione in background e non rispondeva; ora l'elenco viene letto direttamente dalla memoria, che risponde sempre.",
          "pl": "Przycisk pokazywał „Dodaj” na kanale, który już obserwowałeś, a sekundę później zmieniał się na szary. Odpytywał service workera, który usypia w tle i nie odpowiadał; lista jest teraz odczytywana bezpośrednio z pamięci, która odpowiada zawsze.",
          "tr": "Düğme, zaten takip ettiğiniz bir kanalda “Ekle” yazıyor, bir saniye sonra griye dönüyordu. Arka planda uykuya geçen service worker'a soruyor ve yanıt alamıyordu; liste artık her zaman yanıt veren depolama alanından doğrudan okunuyor.",
          "ru": "Кнопка показывала «Добавить» на уже отслеживаемом канале и через секунду становилась серой. Она обращалась к service worker, который засыпает в фоне и не отвечал; теперь список читается напрямую из хранилища, которое отвечает всегда.",
          "ja": "すでに追加済みのチャンネルでボタンが「追加」と表示され、1秒後にグレーに切り替わっていました。バックグラウンドでスリープするサービスワーカーに問い合わせて応答が得られていなかったためです。現在は常に応答するストレージから直接読み込むようになりました。",
          "ko": "이미 추가한 채널에서도 버튼에 ‘추가’가 표시되었다가 1초 뒤 회색으로 바뀌었습니다. 백그라운드에서 절전 상태가 되는 서비스 워커에 요청해 응답을 받지 못했기 때문입니다. 이제 항상 응답하는 저장소에서 직접 목록을 읽습니다.",
          "id": "Tombol menampilkan “Tambahkan” pada saluran yang sudah Anda ikuti, lalu berubah menjadi abu-abu sedetik kemudian. Tombol ini menanyakan service worker, yang tertidur di latar belakang dan tidak menjawab; daftar kini dibaca langsung dari penyimpanan, yang selalu menjawab.",
          "nl": "De knop toonde ‘Toevoegen’ bij een kanaal dat je al volgde en werd een seconde later grijs. Hij bevroeg de service worker, die op de achtergrond in slaap valt en niet antwoordde; de lijst wordt nu rechtstreeks uit de opslag gelezen, die altijd antwoordt.",
          "sv": "Knappen visade ”Lägg till” på en kanal du redan följde och blev grå först en sekund senare. Den frågade service workern, som somnar i bakgrunden och inte svarade; listan läses nu direkt från lagringen, som alltid svarar.",
          "cs": "Tlačítko zobrazovalo „Přidat“ u kanálu, který jste už sledovali, a o sekundu později zšedlo. Dotazovalo se service workeru, který na pozadí usíná a neodpovídal; seznam se nyní načítá přímo z úložiště, které odpovídá vždy."
        }
      },
      {
        "type": "fix",
        "text": {
          "fr": "Sur les fenêtres étroites, le bouton faisait déborder la barre d'actions de Twitch et « S'abonner » passait sous le rail de droite. Quand la place manque, le libellé s'efface et seul le logo reste ; le texte complet s'affiche toujours au survol.",
          "en": "On narrow windows, the button pushed Twitch's action row out of its column and “Subscribe” slipped under the right-hand rail. When space runs short the label now disappears and only the logo stays; the full text still shows on hover.",
          "es": "En ventanas estrechas, el botón desbordaba la barra de acciones de Twitch y «Suscribirse» quedaba bajo la columna derecha. Cuando falta espacio, la etiqueta desaparece y solo queda el logotipo; el texto completo sigue apareciendo al pasar el cursor.",
          "pt-BR": "Em janelas estreitas, o botão fazia a barra de ações da Twitch transbordar e “Inscrever-se” ia parar embaixo da coluna da direita. Quando falta espaço, o rótulo some e fica só o logotipo; o texto completo continua aparecendo ao passar o cursor.",
          "de": "In schmalen Fenstern ließ die Schaltfläche die Aktionsleiste von Twitch überlaufen, und „Abonnieren“ rutschte unter die rechte Spalte. Wenn der Platz knapp wird, verschwindet jetzt die Beschriftung und nur das Logo bleibt; der vollständige Text erscheint weiterhin beim Überfahren mit der Maus.",
          "it": "Nelle finestre strette il pulsante faceva traboccare la barra delle azioni di Twitch e “Iscriviti” finiva sotto la colonna di destra. Quando lo spazio scarseggia l'etichetta scompare e resta solo il logo; il testo completo compare comunque al passaggio del mouse.",
          "pl": "W wąskich oknach przycisk powodował, że pasek akcji Twitcha wychodził poza swoją kolumnę, a „Subskrybuj” trafiał pod prawą szynę. Gdy brakuje miejsca, etykieta znika i zostaje samo logo; pełny tekst nadal pojawia się po najechaniu kursorem.",
          "tr": "Dar pencerelerde düğme, Twitch'in işlem çubuğunun sütunundan taşmasına ve “Abone Ol” düğmesinin sağ rayın altına kaymasına neden oluyordu. Yer daraldığında artık etiket kayboluyor ve yalnızca logo kalıyor; tam metin fareyle üzerine gelindiğinde yine görünüyor.",
          "ru": "В узких окнах кнопка выталкивала панель действий Twitch за пределы её колонки, и «Подписаться» уходила под правую панель. Когда места не хватает, подпись теперь скрывается и остаётся только логотип; полный текст по-прежнему виден при наведении.",
          "ja": "ウィンドウ幅が狭いと、ボタンがTwitchのアクションバーを列からはみ出させ、「チャンネル登録」が右側のレールの下に回り込んでいました。スペースが足りない場合はラベルが消え、ロゴだけが残るようになりました。マウスを重ねれば全文が表示されます。",
          "ko": "창이 좁을 때 이 버튼이 트위치 작업 표시줄을 열 밖으로 밀어내면서 ‘구독’이 오른쪽 레일 아래로 내려갔습니다. 이제 공간이 부족하면 레이블이 사라지고 로고만 남습니다. 전체 텍스트는 마우스를 올리면 그대로 표시됩니다.",
          "id": "Pada jendela sempit, tombol ini membuat bilah tindakan Twitch meluap dari kolomnya dan “Berlangganan” terdorong ke bawah kolom kanan. Saat ruang menipis, label kini menghilang dan hanya logo yang tersisa; teks lengkap tetap muncul saat kursor diarahkan ke tombol.",
          "nl": "In smalle vensters liet de knop de actiebalk van Twitch buiten zijn kolom lopen en schoof ‘Abonneren’ onder de rechterkolom. Als de ruimte krap wordt, verdwijnt nu het label en blijft alleen het logo over; de volledige tekst verschijnt nog steeds bij het zweven met de muis.",
          "sv": "I smala fönster fick knappen Twitchs åtgärdsrad att svämma över sin kolumn och ”Prenumerera” hamnade under den högra listen. När utrymmet tryter försvinner nu etiketten och bara logotypen blir kvar; hela texten visas fortfarande när du håller muspekaren över.",
          "cs": "V úzkých oknech tlačítko způsobovalo, že panel akcí Twitche přetekl ze svého sloupce a „Odebírat“ se propadlo pod pravou lištu. Když je málo místa, popisek nyní zmizí a zůstane jen logo; celý text se stále zobrazí po najetí myší."
        }
      },
      {
        "type": "fix",
        "text": {
          "fr": "Le logo StreamPulse était violet sur violet sur le bouton d'ajout, et violet sur gris foncé dans la barre de navigation Twitch : à peine visible dans les deux cas. Il passe en blanc partout où il est affiché.",
          "en": "The StreamPulse logo was purple on purple on the add button, and purple on dark grey in the Twitch nav bar: barely visible either way. It is now white everywhere it appears.",
          "es": "El logotipo de StreamPulse era morado sobre morado en el botón de añadir, y morado sobre gris oscuro en la barra de navegación de Twitch: apenas visible en ambos casos. Ahora es blanco en todos los lugares donde aparece.",
          "pt-BR": "O logotipo do StreamPulse ficava roxo sobre roxo no botão de adicionar e roxo sobre cinza-escuro na barra de navegação da Twitch: quase invisível nos dois casos. Agora ele é branco em todos os lugares onde aparece.",
          "de": "Das StreamPulse-Logo war auf der Hinzufügen-Schaltfläche Violett auf Violett und in der Twitch-Navigationsleiste Violett auf Dunkelgrau: in beiden Fällen kaum zu erkennen. Es ist jetzt überall weiß.",
          "it": "Il logo StreamPulse era viola su viola sul pulsante di aggiunta e viola su grigio scuro nella barra di navigazione di Twitch: a malapena visibile in entrambi i casi. Ora è bianco ovunque compaia.",
          "pl": "Logo StreamPulse było fioletowe na fioletowym tle przycisku dodawania i fioletowe na ciemnoszarym tle paska nawigacji Twitcha: w obu przypadkach ledwo widoczne. Teraz jest białe wszędzie, gdzie się pojawia.",
          "tr": "StreamPulse logosu ekleme düğmesinde mor üzerine mor, Twitch gezinti çubuğunda ise koyu gri üzerine mordu: her iki durumda da güçlükle seçiliyordu. Artık göründüğü her yerde beyaz.",
          "ru": "Логотип StreamPulse был фиолетовым на фиолетовом на кнопке добавления и фиолетовым на тёмно-сером в панели навигации Twitch: в обоих случаях он едва различался. Теперь он белый везде, где отображается.",
          "ja": "StreamPulseのロゴは、追加ボタンでは紫の上に紫、Twitchのナビゲーションバーでは濃いグレーの上に紫で表示されており、どちらもほとんど見えませんでした。表示されるすべての場所で白になりました。",
          "ko": "StreamPulse 로고가 추가 버튼에서는 보라색 위의 보라색으로, 트위치 내비게이션 바에서는 진회색 위의 보라색으로 표시되어 두 경우 모두 거의 보이지 않았습니다. 이제 표시되는 모든 위치에서 흰색으로 바뀝니다.",
          "id": "Logo StreamPulse tampil ungu di atas ungu pada tombol tambah, dan ungu di atas abu-abu gelap pada bilah navigasi Twitch: nyaris tidak terlihat pada keduanya. Kini logo tersebut berwarna putih di mana pun ditampilkan.",
          "nl": "Het StreamPulse-logo was paars op paars op de toevoegknop en paars op donkergrijs in de navigatiebalk van Twitch: in beide gevallen nauwelijks zichtbaar. Het is nu overal wit.",
          "sv": "StreamPulse-logotypen var lila mot lila på lägg till-knappen och lila mot mörkgrått i Twitchs navigeringsfält: knappt synlig i båda fallen. Den är nu vit överallt där den visas.",
          "cs": "Logo StreamPulse bylo na tlačítku pro přidání fialové na fialovém a v navigační liště Twitche fialové na tmavě šedém: v obou případech sotva viditelné. Nyní je bílé všude, kde se zobrazuje."
        }
      },
      {
        "type": "fix",
        "text": {
          "fr": "Les chaînes ajoutées avec une ancienne version de l'extension n'étaient pas reconnues par le bouton, qui proposait de les ajouter une seconde fois.",
          "en": "Channels added with an older version of the extension weren't recognised by the button, which offered to add them a second time.",
          "es": "Los canales añadidos con una versión anterior de la extensión no eran reconocidos por el botón, que ofrecía añadirlos por segunda vez.",
          "pt-BR": "Canais adicionados com uma versão antiga da extensão não eram reconhecidos pelo botão, que oferecia adicioná-los uma segunda vez.",
          "de": "Kanäle, die mit einer älteren Version der Erweiterung hinzugefügt wurden, wurden von der Schaltfläche nicht erkannt, die daraufhin anbot, sie ein zweites Mal hinzuzufügen.",
          "it": "I canali aggiunti con una versione precedente dell'estensione non venivano riconosciuti dal pulsante, che proponeva di aggiungerli una seconda volta.",
          "pl": "Kanały dodane starszą wersją rozszerzenia nie były rozpoznawane przez przycisk, który proponował dodanie ich po raz drugi.",
          "tr": "Uzantının eski bir sürümüyle eklenen kanallar düğme tarafından tanınmıyor ve ikinci kez eklenmeleri öneriliyordu.",
          "ru": "Каналы, добавленные в старой версии расширения, не распознавались кнопкой, и она предлагала добавить их повторно.",
          "ja": "以前のバージョンの拡張機能で追加したチャンネルがボタンに認識されず、二重に追加するよう促されていました。",
          "ko": "이전 버전의 확장 프로그램으로 추가한 채널을 버튼이 인식하지 못해 다시 추가하라고 안내했습니다.",
          "id": "Saluran yang ditambahkan dengan versi lama ekstensi tidak dikenali oleh tombol, sehingga ditawarkan untuk ditambahkan kedua kalinya.",
          "nl": "Kanalen die met een oudere versie van de extensie waren toegevoegd, werden niet herkend door de knop, die aanbood ze een tweede keer toe te voegen.",
          "sv": "Kanaler som lagts till med en äldre version av tillägget kändes inte igen av knappen, som erbjöd sig att lägga till dem en gång till.",
          "cs": "Kanály přidané starší verzí rozšíření tlačítko nerozpoznalo a nabízelo jejich přidání podruhé."
        }
      }
    ],
    "thanks": [
      {
        "handle": "NaGeL182",
        "url": "https://github.com/NaGeL182",
        "for": {
          "fr": "signalement des réglages Drops sans effet et de la fenêtre d'inventaire qui se rouvrait en boucle",
          "en": "reporting the Drops settings that did nothing and the inventory window that kept reopening",
          "es": "informar de los ajustes de Drops que no hacían nada y de la ventana de inventario que se reabría en bucle",
          "pt-BR": "relatar as configurações de Drops que não funcionavam e a janela de inventário que reabria em loop",
          "de": "Meldung der wirkungslosen Drops-Einstellungen und des Inventarfensters, das sich immer wieder öffnete",
          "it": "segnalazione delle impostazioni Drops che non avevano effetto e della finestra dell'inventario che si riapriva in continuazione",
          "pl": "zgłoszenie niedziałających ustawień Drops i okna ekwipunku, które otwierało się w kółko",
          "tr": "işe yaramayan Drops ayarlarını ve sürekli yeniden açılan envanter penceresini bildirme",
          "ru": "сообщение о неработающих настройках Drops и об окне инвентаря, которое открывалось снова и снова",
          "ja": "効果のなかったDrops設定と、繰り返し開き直すインベントリ画面の報告",
          "ko": "작동하지 않던 Drops 설정과 반복해서 다시 열리던 인벤토리 창 제보",
          "id": "melaporkan pengaturan Drops yang tidak berfungsi dan jendela inventaris yang terus terbuka kembali",
          "nl": "het melden van de Drops-instellingen die niets deden en het inventarisvenster dat zich steeds opnieuw opende",
          "sv": "rapportera Drops-inställningarna som inte gjorde något och inventariefönstret som öppnades om och om igen",
          "cs": "nahlášení nefunkčních nastavení Drops a okna inventáře, které se stále znovu otevíralo"
        }
      },
      {
        "handle": "Shiro",
        "for": {
          "fr": "tests et signalements sur le bouton des pages de chaîne",
          "en": "testing and reporting on the channel page button",
          "es": "pruebas e informes sobre el botón de las páginas de canal",
          "pt-BR": "testes e relatos sobre o botão das páginas de canal",
          "de": "Tests und Rückmeldungen zur Schaltfläche auf den Kanalseiten",
          "it": "test e segnalazioni sul pulsante delle pagine dei canali",
          "pl": "testy i zgłoszenia dotyczące przycisku na stronach kanałów",
          "tr": "kanal sayfalarındaki düğmeyle ilgili testler ve bildirimler",
          "ru": "тестирование и отзывы о кнопке на страницах каналов",
          "ja": "チャンネルページのボタンに関するテストと報告",
          "ko": "채널 페이지 버튼에 대한 테스트와 제보",
          "id": "pengujian dan laporan tentang tombol di halaman saluran",
          "nl": "tests en meldingen over de knop op de kanaalpagina's",
          "sv": "tester och rapporter om knappen på kanalsidorna",
          "cs": "testování a hlášení k tlačítku na stránkách kanálů"
        }
      }
    ]
  },
  {
    version: "26.8.11",
    "date": "2026-08-11",
    "title": {
      "fr": "Le bouton qui manquait",
      "en": "The button that was missing",
      "es": "El botón que faltaba",
      "pt-BR": "O botão que faltava",
      "de": "Der Knopf, der fehlte",
      "it": "Il pulsante che mancava",
      "pl": "Brakujący przycisk",
      "tr": "Eksik olan düğme",
      "ru": "Кнопка, которой не хватало",
      "ja": "なくなっていたボタン",
      "ko": "사라졌던 버튼",
      "id": "Tombol yang hilang",
      "nl": "De knop die ontbrak",
      "sv": "Knappen som saknades",
      "cs": "Tlačítko, které chybělo"
    },
    "subtitle": {
      "fr": "Ajoutez un streamer sans ouvrir l'extension, et des confirmations de suppression enfin lisibles.",
      "en": "Add a streamer without opening the extension, and removal confirmations that are finally readable.",
      "es": "Añade un streamer sin abrir la extensión, y confirmaciones de eliminación por fin legibles.",
      "pt-BR": "Adicione um streamer sem abrir a extensão, e confirmações de remoção enfim legíveis.",
      "de": "Hinzufügen eines Streamers, ohne die Erweiterung zu öffnen, sowie Endlich lesbare Bestätigungsmeldungen beim Entfernen.",
      "it": "Aggiungere uno streamer senza aprire l'estensione e rendere finalmente leggibili le richieste di conferma per la rimozione.",
      "pl": "Możliwość dodawania streamerów bez otwierania rozszerzenia oraz potwierdzenia usunięcia, które wreszcie są czytelne.",
      "tr": "Uzantıyı açmadan bir streamer ekleme ve nihayet okunabilir hale gelen kaldırma onayları.",
      "ru": "Добавлена возможность добавлять стримеры без открытия расширения, а также подтверждения удаления, которые теперь наконец-то можно прочитать.",
      "ja": "拡張機能を開かずにストリーマーを追加できるようにし、ようやく読みやすくなった削除確認画面を追加しました。",
      "ko": "확장 프로그램을 열지 않고도 스티머를 추가할 수 있게 하고, 드디어 읽기 쉬운 삭제 확인 메시지를 제공합니다.",
      "id": "Tambahkan streamer tanpa perlu membuka ekstensi, serta konfirmasi penghapusan yang akhirnya bisa dibaca dengan jelas.",
      "nl": "Een streamer toevoegen zonder de extensie te openen, en bevestigingsvensters voor het verwijderen die eindelijk goed leesbaar zijn.",
      "sv": "Lägg till en streamer utan att öppna tillägget, samt bekräftelser vid borttagning som äntligen går att läsa.",
      "cs": "Přidání streameru bez nutnosti otevřít rozšíření a potvrzení odstranění, která jsou konečně čitelná."
    },
    "changes": [
      {
        "type": "new",
        "text": {
          "fr": "L'extension est désormais entièrement traduite et disponible dans 15 langues ! Le Chrome Web Store affichera automatiquement le nom et la description dans votre langue.",
          "en": "The extension is now fully translated and available in 15 languages! The Chrome Web Store will automatically display the name and description in your language.",
          "es": "¡La extensión ya está completamente traducida y disponible en 15 idiomas! Chrome Web Store mostrará automáticamente el nombre y la descripción en tu idioma.",
          "pt-BR": "A extensão agora está totalmente traduzida e disponível em 15 idiomas! A Chrome Web Store exibirá automaticamente o nome e a descrição no seu idioma.",
          "de": "Die Erweiterung ist nun vollständig in 15 Sprachen übersetzt und verfügbar! Der Chrome Web Store zeigt Name und Beschreibung automatisch in Ihrer Sprache an.",
          "it": "L'estensione è ora completamente tradotta e disponibile in 15 lingue! Il Chrome Web Store visualizzerà automaticamente il nome e la descrizione nella tua lingua.",
          "pl": "Rozszerzenie jest teraz w pełni przetłumaczone i dostępne w 15 językach! Chrome Web Store automatycznie wyświetli nazwę i opis w Twoim języku.",
          "tr": "Eklenti artık tamamen çevrildi ve 15 dilde mevcut! Chrome Web Mağazası adı ve açıklamayı otomatik olarak dilinizde gösterecektir.",
          "ru": "Расширение теперь полностью переведено и доступно на 15 языках! Интернет-магазин Chrome будет автоматически отображать название и описание на вашем языке.",
          "ja": "拡張機能が完全に翻訳され、15の言語で利用できるようになりました！Chromeウェブストアでは、言語に合わせて名前と説明が自動的に表示されます。",
          "ko": "이제 확장 프로그램이 15개 언어로 완벽하게 번역되어 제공됩니다! Chrome 웹 스토어에서 사용자의 언어로 이름과 설명이 자동으로 표시됩니다.",
          "id": "Ekstensi kini telah diterjemahkan sepenuhnya dan tersedia dalam 15 bahasa! Chrome Web Store akan secara otomatis menampilkan nama dan deskripsi dalam bahasa Anda.",
          "nl": "De extensie is nu volledig vertaald en beschikbaar in 15 talen! De Chrome Web Store toont de naam en beschrijving automatisch in jouw taal.",
          "sv": "Tillägget är nu helt översatt och tillgängligt på 15 språk! Chrome Web Store visar automatiskt namn och beskrivning på ditt språk.",
          "cs": "Rozšíření je nyní plně přeloženo a je k dispozici v 15 jazycích! Internetový obchod Chrome automaticky zobrazí název a popis ve vašem jazyce."
        }
      },
      {
        "type": "new",
        "text": {
          "fr": "Un bouton « Ajouter à StreamPulse » apparaît maintenant directement sur les pages de chaîne Twitch, à côté du bouton S'abonner. Violet quand le streamer n'est pas encore suivi, gris une fois ajouté.",
          "en": "An “Add to StreamPulse” button now appears directly on Twitch channel pages, next to the Subscribe button. Purple when the streamer isn't followed yet, grey once added.",
          "es": "Ahora aparece un botón «Añadir a StreamPulse» directamente en las páginas de canal de Twitch, junto al botón Suscribirse. Morado cuando el streamer aún no está seguido, gris una vez añadido.",
          "pt-BR": "Um botão “Adicionar ao StreamPulse” agora aparece direto nas páginas de canal da Twitch, ao lado do botão Inscrever-se. Roxo quando o streamer ainda não é seguido, cinza depois de adicionado.",
          "de": "Auf den Twitch-Kanalsseiten wird nun direkt neben der Schaltfläche „Abonnieren“ eine Schaltfläche „Zu StreamPulse hinzufügen“ angezeigt. Diese ist violett, solange der Streamer noch nicht abonniert wurde, und grau, sobald er hinzugefügt wurde.",
          "it": "Nelle pagine dei canali di Twitch è ora presente un pulsante “Aggiungi a StreamPulse”, proprio accanto al pulsante “Iscriviti”. È di colore viola se lo streamer non è ancora seguito, mentre diventa grigio una volta aggiunto.",
          "pl": "Przycisk „Dodaj do StreamPulse” pojawia się teraz bezpośrednio na stronach kanałów serwisu Twitch, obok przycisku „Subskrybuj”. Jest fioletowy, gdy streamer nie jest jeszcze obserwowany, a szary po dodaniu.",
          "tr": "Artık Twitch kanal sayfalarında, “Abone Ol” düğmesinin hemen yanında bir “StreamPulse’a Ekle” düğmesi görünüyor. Yayıncı henüz takip edilmediğinde mor, eklendiğinde ise gri renkte görünür.",
          "ru": "Кнопка «Добавить в StreamPulse» теперь отображается прямо на страницах каналов Twitch, рядом с кнопкой «Подписаться». Она имеет фиолетовый цвет, если на стримера ещё не подписаны, и серый — после добавления.",
          "ja": "Twitchのチャンネルページに、「StreamPulseに追加」ボタンが、「チャンネル登録」ボタンのすぐ横に表示されるようになりました。まだその配信者をフォローしていない場合は紫色で表示され、追加すると灰色になります。",
          "ko": "이제 Twitch 채널 페이지의 ‘구독’ 버튼 바로 옆에 ‘StreamPulse에 추가’ 버튼이 표시됩니다. 스트리머를 아직 팔로우하지 않은 상태에서는 보라색으로, 추가한 후에는 회색으로 표시됩니다.",
          "id": "Tombol “Tambahkan ke StreamPulse” kini muncul langsung di halaman saluran Twitch, tepat di sebelah tombol “Berlangganan”. Tombol tersebut berwarna ungu jika streamer tersebut belum diikuti, dan berubah menjadi abu-abu setelah ditambahkan.",
          "nl": "Op de kanalenpagina's van Twitch verschijnt nu direct naast de knop ‘Abonneren’ een knop ‘Toevoegen aan StreamPulse’. Deze is paars als de streamer nog niet wordt gevolgd, en grijs zodra hij is toegevoegd.",
          "sv": "En knapp med texten ”Lägg till i StreamPulse” visas nu direkt på Twitch-kanalsidorna, bredvid knappen ”Prenumerera”. Den är lila om man ännu inte följer streamaren och grå när man har lagt till kanalen.",
          "cs": "Tlačítko „Přidat do StreamPulse“ se nyní zobrazuje přímo na stránkách kanálů na Twitchi, vedle tlačítka „Odebírat“. Je fialové, pokud streamera ještě nesledujete, a šedé, jakmile ho přidáte."
        }
      },
      {
        "type": "fix",
        "text": {
          "fr": "Le bouton Twitch ne s'affichait pas du tout si vous aviez 7TV installé : le garde anti-conflit remontait tout le DOM et rejetait la barre Twitch légitime.",
          "en": "The Twitch button didn't show up at all if you had 7TV installed: the conflict guard walked the whole DOM and rejected the legitimate Twitch bar.",
          "es": "El botón de Twitch no aparecía en absoluto si tenías 7TV instalado: la protección anticonflictos recorría todo el DOM y rechazaba la barra legítima de Twitch.",
          "pt-BR": "O botão da Twitch não aparecia se você tivesse o 7TV instalado: a proteção contra conflitos percorria todo o DOM e rejeitava a barra legítima da Twitch.",
          "de": "Die Twitch-Schaltfläche wurde überhaupt nicht angezeigt, wenn 7TV installiert war: Der Konflikt-Guard durchsuchte das gesamte DOM und wies die legitime Twitch-Leiste zurück.",
          "it": "Il pulsante di Twitch non veniva visualizzato affatto se si aveva installato 7TV: il sistema di protezione dai conflitti analizzava l'intero DOM e rifiutava la barra di Twitch legittima.",
          "pl": "Przycisk Twitch w ogóle się nie wyświetlał, jeśli miałeś zainstalowaną aplikację 7TV: mechanizm zapobiegania konfliktom przeszukiwał cały DOM i odrzucał prawidłowy pasek Twitcha.",
          "tr": "7TV yüklü ise Twitch düğmesi hiç görünmüyordu: Çakışma önleyici, DOM’un tamamını taradı ve geçerli Twitch çubuğunu reddetti.",
          "ru": "Кнопка Twitch вообще не отображалась, если у вас была установлена программа 7TV: механизм защиты от конфликтов просматривал весь DOM и отклонял нормальную панель Twitch.",
          "ja": "7TVがインストールされていると、Twitchボタンがまったく表示されませんでした。競合防止機能がDOM全体をスキャンし、正常なTwitchバーを拒否してしまったためです。",
          "ko": "7TV가 설치되어 있으면 Twitch 버튼이 전혀 표시되지 않았습니다. 충돌 방지 기능이 전체 DOM을 샅샅이 검사한 끝에 정상적인 Twitch 바를 차단했기 때문입니다.",
          "id": "Tombol Twitch sama sekali tidak muncul jika Anda telah menginstal 7TV: fitur Conflict Guard memeriksa seluruh DOM dan menolak bilah Twitch yang sah.",
          "nl": "De Twitch-knop werd helemaal niet weergegeven als je 7TV had geïnstalleerd: de conflictbewaker doorzocht de volledige DOM en wees de legitieme Twitch-balk af.",
          "sv": "Twitch-knappen visades inte alls om man hade 7TV installerat: konfliktkontrollen gick igenom hela DOM och avvisade den legitima Twitch-fältet.",
          "cs": "Tlačítko Twitch se vůbec nezobrazovalo, pokud jste měli nainstalovanou aplikaci 7TV: ochrana proti konfliktům prošla celý DOM a odmítla legitimní lištu Twitch."
        }
      },
      {
        "type": "fix",
        "text": {
          "fr": "Les notifications disparaissaient silencieusement quand l'avatar du streamer ne pouvait pas être téléchargé (bloqueur de contenu, CDN indisponible). Elles utilisent désormais le logo local en secours.",
          "en": "Notifications disappeared silently when the streamer's avatar couldn't be downloaded (content blocker, CDN unavailable). They now fall back to the local logo.",
          "es": "Las notificaciones desaparecían en silencio cuando no se podía descargar el avatar del streamer (bloqueador de contenido, CDN no disponible). Ahora recurren al logo local.",
          "pt-BR": "As notificações sumiam silenciosamente quando o avatar do streamer não podia ser baixado (bloqueador de conteúdo, CDN indisponível). Agora elas usam o logo local como reserva.",
          "de": "Benachrichtigungen wurden bisher unbemerkt ausgeblendet, wenn der Avatar des Streamers nicht heruntergeladen werden konnte (Inhaltsblocker, CDN nicht verfügbar). Nun wird stattdessen das lokale Logo angezeigt.",
          "it": "Le notifiche scomparivano senza alcun avviso quando non era possibile scaricare l'avatar dello streamer (a causa di un blocco dei contenuti o di un CDN non disponibile). Ora viene visualizzato il logo locale.",
          "pl": "Powiadomienia znikały bez ostrzeżenia, gdy nie można było pobrać awatara streamera (z powodu blokady treści lub niedostępności sieci CDN). Teraz wyświetlane jest lokalne logo.",
          "tr": "Yayıncının avatarı indirilemediğinde (içerik engelleyici, CDN kullanılamıyor), bildirimler sessizce kayboluyordu. Artık yerel logoya geri dönüyorlar.",
          "ru": "Уведомления незаметно исчезали, когда не удавалось загрузить аватар стримера (из-за блокировщика контента или недоступности CDN). Теперь вместо него отображается локальный логотип.",
          "ja": "配信者のアバターがダウンロードできなかった場合（コンテンツブロッカーやCDNが利用できない場合など）、通知が何も表示されなくなっていました。現在は、ローカルのロゴが表示されるようになりました。",
          "ko": "스트리머의 아바타를 다운로드할 수 없는 경우(콘텐츠 차단기, CDN 이용 불가 등), 알림이 아무런 표시 없이 사라졌습니다. 이제 로컬 로고로 대체됩니다.",
          "id": "Pemberitahuan menghilang tanpa pemberitahuan saat avatar si penyiar tidak dapat diunduh (karena pemblokir konten atau CDN tidak tersedia). Kini, pemberitahuan tersebut akan menampilkan logo lokal sebagai penggantinya.",
          "nl": "Meldingen verdwenen zonder waarschuwing wanneer de avatar van de streamer niet kon worden gedownload (inhoudsblokkering, CDN niet beschikbaar). Er wordt nu het lokale logo weergegeven.",
          "sv": "Meddelanden försvann utan förvarning när streamarens avatar inte kunde laddas ner (innehållsblockerare, CDN otillgängligt). Nu visas istället den lokala logotypen.",
          "cs": "Oznámení se tiše skryla, když se nepodařilo stáhnout avatar streamera (blokování obsahu, nedostupná síť CDN). Nyní se místo toho zobrazuje místní logo."
        }
      },
      {
        "type": "improved",
        "text": {
          "fr": "La confirmation de suppression d'un streamer n'était pas stylée et s'affichait avec les boutons bruts du navigateur. Nouveau design, avec le nom du streamer concerné.",
          "en": "The confirmation for removing a streamer was unstyled and used the browser's raw buttons. New design, showing the name of the streamer concerned.",
          "es": "La confirmación para eliminar un streamer no tenía estilo y usaba los botones sin formato del navegador. Nuevo diseño, con el nombre del streamer en cuestión.",
          "pt-BR": "A confirmação de remoção de um streamer não tinha estilo e usava os botões brutos do navegador. Novo design, com o nome do streamer em questão.",
          "de": "Die Bestätigungsmeldung zum Entfernen eines Streamers war ohne Formatierung und verwendete die Standardschaltflächen des Browsers. Neues Design, das den Namen des betreffenden Streamers anzeigt.",
          "it": "La finestra di conferma per la rimozione di uno streamer non presentava alcuno stile e utilizzava i pulsanti predefiniti del browser. Nuovo design, che mostra il nome dello streamer in questione.",
          "pl": "Potwierdzenie usunięcia streamera nie miało stylizacji i wykorzystywało standardowe przyciski przeglądarki. Nowy wygląd, w którym widoczna jest nazwa danego streamera.",
          "tr": "Bir yayıncının kaldırılmasına ilişkin onay mesajı, stil uygulanmamış haldeydi ve tarayıcının standart düğmelerini kullanıyordu. Yeni tasarımda ise söz konusu yayıncının adı gösteriliyor.",
          "ru": "Подтверждение удаления стримера не имело стилевого оформления и использовало стандартные кнопки браузера. Новый дизайн, в котором отображается имя соответствующего стримера.",
          "ja": "ストリーマーの削除確認画面は、スタイルが適用されておらず、ブラウザの標準ボタンが使用されていました。新しいデザインでは、対象となるストリーマーの名前が表示されるようになりました。",
          "ko": "스트리머 삭제 확인 화면은 디자인이 적용되지 않은 상태였으며, 브라우저의 기본 버튼을 사용했습니다. 이제 해당 스트리머의 이름이 표시되는 새로운 디자인으로 변경되었습니다.",
          "id": "Konfirmasi untuk menghapus seorang streamer sebelumnya tidak memiliki gaya dan menggunakan tombol bawaan browser. Desain baru ini menampilkan nama streamer yang bersangkutan.",
          "nl": "De bevestigingsmelding voor het verwijderen van een streamer had geen opmaak en maakte gebruik van de standaardknoppen van de browser. Nieuw ontwerp, waarin de naam van de betreffende streamer wordt weergegeven.",
          "sv": "Bekräftelsen för att ta bort en streamare hade ingen särskild formatering och använde webbläsarens standardknappar. Ny design som visar namnet på den berörda streamaren.",
          "cs": "Potvrzení odstranění streamera nemělo žádný styl a využívalo standardní tlačítka prohlížeče. Nový design, který zobrazuje jméno daného streamera."
        }
      },
      {
        "type": "improved",
        "text": {
          "fr": "La confirmation ne se ferme plus toute seule au bout de 3 secondes, et la touche Entrée annule au lieu de supprimer.",
          "en": "The confirmation no longer closes by itself after 3 seconds, and the Enter key cancels instead of deleting.",
          "es": "La confirmación ya no se cierra sola a los 3 segundos, y la tecla Intro cancela en lugar de eliminar.",
          "pt-BR": "A confirmação não fecha mais sozinha após 3 segundos, e a tecla Enter cancela em vez de excluir.",
          "de": "Die Bestätigungsmeldung schließt sich nicht mehr nach 3 Sekunden von selbst, und die Eingabetaste bricht den Vorgang ab, anstatt ihn zu löschen.",
          "it": "La finestra di conferma non si chiude più automaticamente dopo 3 secondi e il tasto Invio annulla l'operazione invece di cancellarla.",
          "pl": "Okno potwierdzenia nie zamyka się już samoistnie po 3 sekundach, a klawisz Enter powoduje anulowanie zamiast usunięcia.",
          "tr": "Onay penceresi artık 3 saniye sonra kendiliğinden kapanmıyor ve Enter tuşu silme işlemi yerine iptal işlemini gerçekleştiriyor.",
          "ru": "Окно подтверждения больше не закрывается автоматически через 3 секунды, а нажатие клавиши Enter приводит к отмене, а не к удалению.",
          "ja": "確認画面は3秒後に自動的に閉じなくなり、Enterキーを押すと削除されるのではなく、操作がキャンセルされるようになりました。",
          "ko": "확인 창이 더 이상 3초 후에 자동으로 닫히지 않으며, Enter 키를 누르면 삭제 대신 취소가 이루어집니다.",
          "id": "Kotak konfirmasi tidak lagi menutup dengan sendirinya setelah 3 detik, dan tombol Enter kini membatalkan alih-alih menghapus.",
          "nl": "Het bevestigingsvenster sluit niet meer automatisch na 3 seconden, en met de Enter-toets wordt de actie geannuleerd in plaats van gewist.",
          "sv": "Bekräftelsen stängs inte längre automatiskt efter 3 sekunder, och Enter-tangenten avbryter istället för att radera.",
          "cs": "Potvrzovací okno se již po 3 sekundách samo nezavře a stisk klávesy Enter akci zruší, místo aby ji potvrdil."
        }
      },
      {
        "type": "new",
        "text": {
          "fr": "Cette page de notes de version, qui s'ouvre après chaque mise à jour pour vous dire ce qui a changé. Elle suit la langue choisie dans l'extension, notes comprises.",
          "en": "This release notes page, which opens after every update to tell you what changed. It follows the language selected in the extension, notes included.",
          "es": "Esta página de notas de versión, que se abre tras cada actualización para contarte qué ha cambiado. Sigue el idioma elegido en la extensión, notas incluidas.",
          "pt-BR": "Esta página de notas de versão, que abre depois de cada atualização para contar o que mudou. Ela segue o idioma escolhido na extensão, incluindo as notas.",
          "de": "Diese Seite mit den Versionshinweisen wird nach jedem Update geöffnet, um Sie über die Änderungen zu informieren. Sie wird in der in der Erweiterung ausgewählten Sprache angezeigt, einschließlich der Hinweise.",
          "it": "Questa pagina delle note di rilascio, che si apre dopo ogni aggiornamento per illustrare le modifiche apportate, riproduce la lingua selezionata nell'estensione, note incluse.",
          "pl": "Ta strona z informacjami o aktualizacji, która otwiera się po każdej aktualizacji, aby poinformować użytkownika o wprowadzonych zmianach. Jest ona wyświetlana w języku wybranym w rozszerzeniu, łącznie z informacjami zawartymi w tej notatce.",
          "tr": "Bu sürüm notları sayfası, her güncellemeden sonra açılır ve size nelerin değiştiğini bildirir. Eklentide seçilen dili kullanır; notlar da buna dahildir.",
          "ru": "Эта страница с информацией об обновлениях открывается после каждого обновления и содержит сведения о внесенных изменениях. Текст страницы отображается на языке, выбранном в расширении, включая примечания.",
          "ja": "このリリースノートページは、アップデートが行われるたびに表示され、変更点についてお知らせします。このページは、拡張機能で選択された言語に合わせて表示され、記載されている注記も同様です。",
          "ko": "이 릴리스 노트 페이지는 업데이트가 있을 때마다 열리며, 변경된 내용을 알려줍니다. 이 페이지는 확장 프로그램에서 선택한 언어를 따르며, 포함된 노트도 마찬가지입니다.",
          "id": "Halaman catatan rilis ini akan terbuka setelah setiap pembaruan untuk memberi tahu Anda apa saja yang telah berubah. Halaman ini menampilkan bahasa yang dipilih di ekstensi tersebut, termasuk catatan-catatan yang ada.",
          "nl": "Deze pagina met release-opmerkingen wordt na elke update geopend om je te laten weten wat er is veranderd. De taal is afgestemd op de taal die in de extensie is geselecteerd, inclusief de opmerkingen.",
          "sv": "Den här sidan med informationsnoter öppnas efter varje uppdatering för att informera dig om vad som har ändrats. Språket på sidan följer det språk som valts i tillägget, inklusive informationsnoterna.",
          "cs": "Tato stránka s poznámkami k vydání se otevírá po každé aktualizaci a informuje vás o provedených změnách. Je zobrazena v jazyce, který jste si vybrali v rozšíření, včetně poznámek."
        }
      },
      {
        "type": "fix",
        "text": {
          "fr": "Les mots en italique violet des grands titres étaient rognés : le dégradé n'était peint que dans la boîte du mot, alors qu'une italique déborde à droite et qu'un jambage descend sous la ligne. La queue du g disparaissait.",
          "en": "The violet italic words in the large headings were clipped: the gradient was only painted inside the word's box, while an italic leans past it and a descender drops below the line. The tail of the g went missing.",
          "es": "Las palabras en cursiva violeta de los títulos grandes quedaban recortadas: el degradado solo se pintaba dentro de la caja de la palabra, mientras que una cursiva se inclina más allá y un rasgo desciende bajo la línea. La cola de la g desaparecía.",
          "pt-BR": "As palavras em itálico violeta dos títulos grandes ficavam cortadas: o gradiente era pintado apenas dentro da caixa da palavra, enquanto um itálico se inclina além dela e uma haste desce abaixo da linha. A cauda do g sumia.",
          "de": "Die violetten, kursiven Wörter in den großen Überschriften waren abgeschnitten: Der Farbverlauf wurde nur innerhalb des Wortfeldes aufgetragen, während ein kursiver Buchstabe über den Rahmen hinausragt und ein Unterlänge unter die Zeilengrenze fällt. Der Schwanz des „g“ fehlte.",
          "it": "Le parole in viola e in corsivo nei titoli principali sono state troncate: la sfumatura è stata applicata solo all’interno del riquadro della parola, mentre una lettera in corsivo sporge oltre il riquadro e una discendente scende al di sotto della linea. La coda della “g” è andata persa.",
          "pl": "Fioletowe, pisane kursywą słowa w dużych nagłówkach zostały przycięte: gradient został naniesiony tylko wewnątrz ramki słowa, podczas gdy kursywa wystaje poza nią, a ogonek litery opada poniżej linii. Zaginął ogonek litery „g”.",
          "tr": "Büyük başlıklardaki mor renkli italik kelimeler kesilmişti: renk geçişi yalnızca kelimenin kutusunun içine uygulanmıştı; oysa italik yazı kutunun dışına taşmış ve alt uzantısı satırın altına düşmüştü. “g” harfinin kuyruğu kaybolmuştu.",
          "ru": "Слова, выделенные фиолетовым курсивом в крупных заголовках, были обрезаны: градиент был нанесен только внутри рамки слова, в то время как курсив выходит за её пределы, а нижний вынос выходит за линию. Хвостик буквы «g» пропал.",
          "ja": "大きな見出しの紫色のイタリック体の文字は切り取られていました。グラデーションは文字の枠の内側のみに塗られていましたが、イタリック体の文字が枠からはみ出し、下垂部が行の下に突き出ていました。また、「g」の尾が欠けていました。",
          "ko": "큰 제목에 있는 보라색 이탤릭체 단어들이 잘려 나갔습니다. 그라데이션은 단어 상자 안쪽에만 칠해져 있었는데, 이탤릭체 글자가 상자 밖으로 삐져나와 있고, 하단 연장부가 선 아래로 떨어졌습니다. g의 꼬리 부분도 사라졌습니다.",
          "id": "Kata-kata berwarna ungu yang dicetak miring pada judul-judul besar tampak terpotong: gradasi warna hanya diterapkan di dalam kotak kata tersebut, sementara huruf miringnya melebihi batas kotak dan bagian bawah hurufnya menjulur di bawah garis. Ekor huruf g-nya hilang.",
          "nl": "De paarse, cursieve woorden in de grote koppen waren afgekapt: het kleurverloop was alleen binnen het kader van het woord aangebracht, terwijl een cursief letterdeel daarbuiten reikt en een onderlengsel onder de regel uitkomt. Het staartje van de g ontbrak.",
          "sv": "De violetta, kursiva orden i de stora rubrikerna var avklippta: färgövergången hade endast målats inuti ordets ram, medan en kursiv bokstav sträckte sig utanför ramen och en nedstrecksdel hängde under linjen. Slutet på bokstaven g saknades.",
          "cs": "Fialová kurzívní slova ve velkých nadpisech byla oříznuta: přechod byl namalován pouze uvnitř rámečku slova, zatímco kurzívní písmeno přesahuje jeho okraj a spodní výčnělek zasahuje pod čáru. Chyběla koncovka písmene „g“."
        }
      },
      {
        "type": "fix",
        "text": {
          "fr": "Plusieurs réglages restaient en français même après avoir choisi une autre langue : ouverture auto de l'inventaire, icônes d'onglet, journal d'événements et FAQ. Tout l'écran de réglages et la première configuration suivent désormais la langue choisie.",
          "en": "Several settings stayed in French even after picking another language: auto-open inventory, tab icons, event log and FAQ. The whole settings screen and the first-time setup now follow the language you choose.",
          "es": "Varios ajustes seguían en francés aunque eligieras otro idioma: apertura automática del inventario, iconos de pestaña, registro de eventos y FAQ. Toda la pantalla de ajustes y la configuración inicial siguen ahora el idioma elegido.",
          "pt-BR": "Vários ajustes continuavam em francês mesmo depois de escolher outro idioma: abertura automática do inventário, ícones de aba, registro de eventos e FAQ. Toda a tela de ajustes e a configuração inicial agora seguem o idioma escolhido.",
          "de": "Einige Einstellungen blieben auch nach der Auswahl einer anderen Sprache auf Französisch: automatisches Öffnen des Inventars, Registerkartensymbole, Ereignisprotokoll und FAQ. Der gesamte Einstellungsbildschirm und die Ersteinrichtung richten sich nun nach der von Ihnen gewählten Sprache.",
          "it": "Diverse impostazioni rimanevano in francese anche dopo aver selezionato un'altra lingua: apertura automatica dell'inventario, icone delle schede, registro eventi e FAQ. L'intera schermata delle impostazioni e la configurazione iniziale ora rispecchiano la lingua scelta.",
          "pl": "Niektóre opcje pozostały w języku francuskim nawet po wybraniu innego języka: automatyczne otwieranie ekwipunku, ikony zakładek, dziennik zdarzeń i sekcja FAQ. Cały ekran ustawień oraz procedura pierwszej konfiguracji są teraz dostosowane do wybranego języka.",
          "tr": "Başka bir dil seçildikten sonra bile bazı ayarlar Fransızca olarak kaldı: envanterin otomatik olarak açılması, sekme simgeleri, olay günlüğü ve SSS. Artık ayarlar ekranının tamamı ve ilk kurulum, seçtiğiniz dile göre görüntüleniyor.",
          "ru": "Некоторые настройки оставались на французском языке даже после выбора другого языка: автоматическое открытие инвентаря, значки вкладок, журнал событий и часто задаваемые вопросы. Теперь весь экран настроек и процесс первоначальной настройки отображаются на выбранном вами языке.",
          "ja": "別の言語を選択した後も、いくつかの設定項目（インベントリの自動表示、タブアイコン、イベントログ、FAQ）はフランス語のままになっていました。設定画面全体と初回セットアップは、選択した言語に合わせて表示されるようになりました。",
          "ko": "다른 언어를 선택했음에도 불구하고, 인벤토리 자동 열기, 탭 아이콘, 이벤트 로그 및 FAQ 등 몇 가지 설정 항목은 프랑스어로 남아 있었습니다. 이제 전체 설정 화면과 초기 설정 과정이 사용자가 선택한 언어를 따릅니다.",
          "id": "Beberapa pengaturan tetap dalam bahasa Prancis meskipun sudah memilih bahasa lain: pembukaan inventaris otomatis, ikon tab, riwayat peristiwa, dan FAQ. Layar pengaturan secara keseluruhan serta proses pengaturan awal kini menyesuaikan dengan bahasa yang Anda pilih.",
          "nl": "Verschillende instellingen bleven in het Frans staan, zelfs nadat een andere taal was geselecteerd: het automatisch openen van de inventaris, tabbladpictogrammen, het gebeurtenissenlogboek en de veelgestelde vragen. Het volledige instellingenscherm en de eerste installatie worden nu aangepast aan de door jou gekozen taal.",
          "sv": "Flera inställningar förblev på franska även efter att ett annat språk valts: automatisk öppning av inventariet, flikikoner, händelselogg och vanliga frågor. Hela inställningsskärmen och den första konfigurationen anpassas nu efter det språk du väljer.",
          "cs": "Některá nastavení zůstala ve francouzštině i po výběru jiného jazyka: automatické otevírání inventáře, ikony záložek, protokol událostí a často kladené otázky. Celá obrazovka nastavení a úvodní nastavení se nyní přizpůsobují jazyku, který si vyberete."
        }
      },
      {
        "type": "fix",
        "text": {
          "fr": "La pastille LIVE sur l'icône de l'onglet était rognée par le détourage de l'avatar, au point d'être invisible à taille réelle. Elle devient un anneau rouge autour de l'avatar du streamer.",
          "en": "The LIVE dot on the tab icon was clipped by the avatar mask, to the point of being invisible at actual size. It is now a red ring around the streamer's avatar.",
          "es": "El punto LIVE en el icono de la pestaña quedaba recortado por el recorte del avatar, hasta ser invisible a tamaño real. Ahora es un anillo rojo alrededor del avatar del streamer.",
          "pt-BR": "O ponto LIVE no ícone da aba era cortado pelo recorte do avatar, a ponto de ficar invisível no tamanho real. Agora é um anel vermelho ao redor do avatar do streamer.",
          "de": "Der „LIVE“-Punkt auf dem Registerkartensymbol wurde von der Avatar-Maske so stark überdeckt, dass er in Originalgröße nicht mehr zu erkennen war. Er erscheint nun als roter Ring um den Avatar des Streamers.",
          "it": "Il puntino \"LIVE\" sull'icona della scheda era coperto dalla maschera dell'avatar, al punto da risultare invisibile a grandezza naturale. Ora è un anello rosso attorno all'avatar dello streamer.",
          "pl": "Kropka „LIVE” na ikonie zakładki została przycięta przez maskę awatara do tego stopnia, że w rzeczywistym rozmiarze była niewidoczna. Teraz ma postać czerwonego pierścienia otaczającego awatar streamera.",
          "tr": "Sekme simgesindeki LIVE noktası, avatar maskesi tarafından kesilmişti; öyle ki gerçek boyutunda görünmez hale gelmişti. Artık yayıncının avatarının etrafında kırmızı bir halka olarak görünüyor.",
          "ru": "Точка «LIVE» на значке вкладки была обрезана маской аватара настолько, что при реальном размере она стала невидимой. Теперь это красное кольцо вокруг аватара стримера.",
          "ja": "タブアイコンの「LIVE」のドットがアバターのマスクに隠れてしまい、実際のサイズでは見えなくなっていました。現在は、ストリーマーのアバターの周囲に赤いリングが表示されるようになっています。",
          "ko": "탭 아이콘에 있는 ‘LIVE’ 점 표시가 아바타 마스크에 가려져 실제 크기에서는 보이지 않을 정도였습니다. 현재는 스트리머의 아바타 주위를 둘러싼 빨간색 원으로 표시됩니다.",
          "id": "Titik \"LIVE\" pada ikon tab terpotong oleh bingkai avatar, hingga tidak terlihat lagi pada ukuran aslinya. Kini, titik tersebut berubah menjadi lingkaran merah di sekeliling avatar si penyiar.",
          "nl": "De LIVE-stip op het tabbladpictogram werd door het avatar-masker afgedekt, waardoor deze op ware grootte niet meer zichtbaar was. Het is nu een rode ring rondom de avatar van de streamer.",
          "sv": "LIVE-pricken på flikikonen skars av av avatarmasken, så att den blev osynlig i sin egentliga storlek. Nu visas den som en röd ring runt streamarens avatar.",
          "cs": "Tečka „LIVE“ na ikoně záložky byla překryta maskou avatara natolik, že při skutečné velikosti nebyla vidět. Nyní se jedná o červený kruh kolem avatara streamera."
        }
      },
      {
        "type": "new",
        "text": {
          "fr": "L'anneau de l'onglet passe à l'orange et clignote quand la chaîne raide ailleurs, pour que vous voyiez le raid partir même si l'annulation automatique est active.",
          "en": "The tab ring turns orange and blinks when the channel raids someone else, so you can see the raid happen even when auto-cancel is on.",
          "es": "El anillo de la pestaña se vuelve naranja y parpadea cuando el canal hace raid a otro, para que veas el raid aunque la cancelación automática esté activa.",
          "pt-BR": "O anel da aba fica laranja e pisca quando o canal faz raid em outro, para você ver o raid acontecer mesmo com o cancelamento automático ativo.",
          "de": "Der Tab-Ring leuchtet orange und blinkt, wenn der Kanal einen anderen Spieler angreift, sodass du den Angriff auch dann sehen kannst, wenn die automatische Abbruchfunktion aktiviert ist.",
          "it": "L'anello della scheda diventa arancione e lampeggia quando il canale effettua un raid contro qualcun altro, così puoi vedere il raid anche quando la funzione di annullamento automatico è attiva.",
          "pl": "Pierścień zakładki zmienia kolor na pomarańczowy i miga, gdy użytkownik z kanału atakuje kogoś innego, dzięki czemu można obserwować przebieg ataku nawet przy włączonej funkcji automatycznego anulowania.",
          "tr": "Kanal, başka birine baskın düzenlediğinde sekme halkası turuncu renge dönüp yanıp söner; böylece otomatik iptal özelliği açık olsa bile baskının gerçekleştiğini görebilirsiniz.",
          "ru": "Когда участники канала устраивают рейд на кого-то другого, кольцо вкладки становится оранжевым и мигает, так что вы можете видеть, как происходит рейд, даже если включена функция автоматической отмены.",
          "ja": "チャンネルが他のプレイヤーを襲撃すると、タブリングがオレンジ色に点滅するため、自動キャンセルがオンになっていても襲撃が行われていることがわかります。",
          "ko": "채널이 다른 사람을 습격하면 탭 링이 주황색으로 변하며 깜빡이므로, 자동 취소 기능이 켜져 있어도 습격이 진행되는 것을 확인할 수 있습니다.",
          "id": "Cincin tab akan berubah menjadi oranye dan berkedip saat saluran tersebut melakukan serangan terhadap orang lain, sehingga Anda tetap bisa melihat serangan tersebut terjadi meskipun fitur pembatalan otomatis sedang aktif.",
          "nl": "De tabring wordt oranje en knippert wanneer het kanaal iemand anders aanvalt, zodat je de aanval kunt zien, zelfs als de automatische annulering is ingeschakeld.",
          "sv": "Flikringen blir orange och blinkar när kanalen gör en raid mot någon annan, så att du kan se när raiden pågår även när funktionen för automatisk avbrytning är aktiverad.",
          "cs": "Když někdo z kanálu spustí raid na jiného hráče, prstenec záložky se zbarví do oranžova a bliká, takže můžete sledovat průběh raidu i při zapnuté funkci automatického zrušení."
        }
      },
      {
        "type": "fix",
        "text": {
          "fr": "L'annulation automatique des raids ne trouvait plus la bannière quand Twitch renommait ses éléments internes, et pouvait réagir jusqu'à deux secondes trop tard. La détection a été élargie et le clic part dès l'apparition de la bannière. Correctif encore à confirmer : il faut tomber sur une chaîne au moment précis où elle raide pour le vérifier, donc l'investigation continue.",
          "en": "Auto-cancel raids stopped finding the banner whenever Twitch renamed its internal elements, and could react up to two seconds too late. Detection has been broadened and the click now fires as soon as the banner appears. Not confirmed yet: checking it means catching a channel at the exact moment it raids, so the investigation continues.",
          "es": "La cancelación automática de raids dejaba de encontrar el banner cuando Twitch renombraba sus elementos internos, y podía reaccionar hasta dos segundos tarde. La detección se ha ampliado y el clic se produce en cuanto aparece el banner. Aún sin confirmar: comprobarlo exige pillar un canal justo cuando hace raid, así que la investigación sigue.",
          "pt-BR": "O cancelamento automático de raids deixava de encontrar o banner quando a Twitch renomeava seus elementos internos, e podia reagir até dois segundos tarde demais. A detecção foi ampliada e o clique acontece assim que o banner aparece. Ainda não confirmado: verificar exige pegar um canal no momento exato em que ele faz raid, então a investigação continua.",
          "de": "Die automatische Abbruchfunktion für Raids erkannte das Banner nicht mehr, sobald Twitch seine internen Elemente umbenannte, und reagierte unter Umständen bis zu zwei Sekunden zu spät. Die Erkennung wurde erweitert, und der Klick wird nun ausgelöst, sobald das Banner erscheint. Noch nicht bestätigt: Um dies zu überprüfen, muss ein Kanal genau in dem Moment erfasst werden, in dem ein Raid stattfindet; daher dauern die Untersuchungen noch an.",
          "it": "La funzione di annullamento automatico dei raid smetteva di rilevare il banner ogni volta che Twitch rinominava i propri elementi interni e poteva reagire con un ritardo fino a due secondi. Il rilevamento è stato ampliato e ora il clic si attiva non appena appare il banner. Non ancora confermato: verificarlo significa intercettare un canale nel momento esatto in cui viene lanciato il raid, quindi l'indagine prosegue.",
          "pl": "Funkcja automatycznego anulowania rajdów przestawała wykrywać baner za każdym razem, gdy serwis Twitch zmieniał nazwy swoich wewnętrznych elementów, a reakcja mogła nastąpić nawet z dwusekundowym opóźnieniem. Zakres wykrywania został poszerzony, a kliknięcie uruchamia się teraz natychmiast po pojawieniu się banera. Niepotwierdzone: sprawdzenie tego wymaga uchwycenia kanału dokładnie w momencie rozpoczęcia rajdu, więc badania trwają.",
          "tr": "Otomatik iptal özelliği, Twitch’in iç öğelerinin adını değiştirdiği durumlarda afişi algılamayı durduruyordu ve tepki süresi iki saniyeye kadar gecikebiliyordu. Algılama kapsamı genişletildi ve artık afiş göründüğü anda tıklama tetikleniyor. Henüz teyit edilmedi: Bu durum, bir kanalın raid düzenlediği tam o anı yakalamayı gerektirdiğinden, araştırma devam ediyor.",
          "ru": "Функция автоматической отмены рейдов переставала обнаруживать баннер всякий раз, когда Twitch переименовывал свои внутренние элементы, и могла реагировать с задержкой до двух секунд. Область обнаружения была расширена, и теперь нажатие срабатывает, как только баннер появляется. Пока не подтверждено: проверка этого требует отслеживания канала именно в тот момент, когда начинается рейд, поэтому расследование продолжается.",
          "ja": "Twitchが内部要素の名前を変更した際、自動キャンセル機能によるレイドがバナーを検出できなくなり、反応が最大2秒遅れることがありました。検出範囲を拡大し、バナーが表示された瞬間にクリックが実行されるようになりました。未確認事項：これを確認するには、レイドが開始されるまさにその瞬間のチャンネルを捉える必要があるため、調査は継続中です。",
          "ko": "Twitch가 내부 요소의 이름을 변경할 때마다 자동 레이드 취소 기능이 배너를 인식하지 못했고, 반응이 최대 2초까지 늦어지는 문제가 있었습니다. 이제 감지 범위가 확대되어 배너가 나타나자마자 클릭이 실행됩니다. 아직 확인되지 않은 사항: 이를 확인하려면 채널이 레이드를 시작하는 정확한 순간을 포착해야 하므로, 현재 조사 중입니다.",
          "id": "Fitur pembatalan otomatis raid tidak lagi dapat mendeteksi banner setiap kali Twitch mengganti nama elemen internalnya, dan kadang-kadang bereaksi hingga dua detik terlambat. Cakupan deteksi telah diperluas, dan klik kini langsung terpicu begitu banner muncul. Belum dikonfirmasi: untuk memverifikasinya, diperlukan penangkapan saluran tepat pada saat raid berlangsung, sehingga penyelidikan masih berlanjut.",
          "nl": "Raids met automatische annulering vonden de banner niet meer wanneer Twitch de namen van zijn interne elementen wijzigde, en konden tot twee seconden te laat reageren. De detectie is uitgebreid en de klik wordt nu geactiveerd zodra de banner verschijnt. Nog niet bevestigd: om dit te controleren moet een kanaal precies op het moment van de raid worden vastgelegd, dus het onderzoek loopt nog.",
          "sv": "Den automatiska avbrytningsfunktionen för raider slutade upptäcka bannern när Twitch bytte namn på sina interna element, och kunde reagera upp till två sekunder för sent. Detekteringen har utvidgats och klicket utlöses nu så snart bannern visas. Ännu inte bekräftat: att kontrollera detta innebär att man måste fånga en kanal precis i det ögonblick den startar en raid, så utredningen fortsätter.",
          "cs": "Funkce automatického zrušení raidů přestala rozpoznávat banner, kdykoli Twitch přejmenoval své interní prvky, a mohla reagovat až o dvě sekundy pozdě. Rozsah detekce byl rozšířen a kliknutí se nyní spustí, jakmile se banner objeví. Zatím nepotvrzeno: ověření této funkce znamená zachytit kanál přesně v okamžiku, kdy spustí raid, takže vyšetřování pokračuje."
        }
      }
    ],
    "thanks": [
      {
        "handle": "Shiro",
        "for": {
          "fr": "signalement des bugs de cette version",
          "en": "reporting the bugs in this release",
          "es": "reportar los bugs de esta versión",
          "pt-BR": "relatar os bugs desta versão",
          "de": "Fehler in dieser Version melden",
          "it": "segnalazione dei bug presenti in questa versione",
          "pl": "zgłaszanie błędów w tej wersji",
          "tr": "bu sürümdeki hataları bildirme",
          "ru": "сообщение об ошибках в этом выпуске",
          "ja": "このリリースにおけるバグの報告",
          "ko": "이번 릴리스의 버그 보고",
          "id": "melaporkan bug pada rilis ini",
          "nl": "het melden van de bugs in deze release",
          "sv": "rapportera fel i den här versionen",
          "cs": "hlášení chyb v této verzi"
        }
      }
    ]
  }
];


/**
 * Texte d'un champ i18n pour une langue donnee.
 *
 * Ces trois fonctions vivaient ici jusqu'a la 26.8.9, puis ont disparu quand
 * fab414f a regenere le fichier pour les 11 nouvelles langues. changelog.js les
 * importe toujours : l'import echouait, le module entier ne s'executait pas, et
 * la page de notes de version ne montrait plus que sa coquille vide. Le controle
 * de `npm run verify` ne l'attrapait pas — il verifie que les fichiers JS
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

/** Release correspondant exactement a une version, ou null. */
export function getRelease(version) {
  return RELEASES.find((entry) => entry.version === version) || null;
}
