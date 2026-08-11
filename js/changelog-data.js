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
    version: "26.8.9",
    "date": "2026-08-10",
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
