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
 *   changes  array    { type, text }: type is "new" | "fix" | "improved",
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
    version: "26.9.13",
    date: "2026-09-13",
    title: {
      fr: "Savoir quand le titre change",
      en: "Know when the title changes",
      es: "Sabe cuándo cambia el título",
      "pt-BR": "Saiba quando o título muda",
      de: "Wissen, wann der Titel wechselt",
      it: "Sapere quando cambia il titolo",
      pl: "Wiedz, kiedy zmienia się tytuł",
      tr: "Başlık değiştiğinde haberdar ol",
      ru: "Знать, когда меняется название",
      ja: "タイトルの変更を見逃さない",
      ko: "제목이 바뀌면 바로 알림",
      id: "Tahu saat judul berubah",
      nl: "Weten wanneer de titel verandert",
      sv: "Vet när titeln ändras",
      cs: "Vědět, kdy se změní název"
    },
    subtitle: {
      fr: "De nouvelles alertes quand un streamer change le titre de son live, et une grosse passe de correction sur les traductions.",
      en: "New alerts when a streamer changes their stream title, plus a big cleanup pass on the translations.",
      es: "Nuevas alertas cuando un streamer cambia el título de su directo, y una gran tanda de correcciones en las traducciones.",
      "pt-BR": "Novos alertas quando um streamer muda o título da live, e uma grande rodada de correções nas traduções.",
      de: "Neue Benachrichtigungen, wenn ein Streamer den Titel ändert, und eine große Korrekturrunde bei den Übersetzungen.",
      it: "Nuovi avvisi quando uno streamer cambia il titolo della diretta, e una bella tornata di correzioni sulle traduzioni.",
      pl: "Nowe alerty, gdy streamer zmienia tytuł transmisji, oraz duża porcja poprawek w tłumaczeniach.",
      tr: "Bir yayıncı yayın başlığını değiştirdiğinde yeni bildirimler ve çevirilerde geniş bir düzeltme turu.",
      ru: "Новые оповещения, когда стример меняет название трансляции, и большая волна исправлений в переводах.",
      ja: "配信タイトルの変更を知らせる新しい通知と、翻訳の大規模な修正。",
      ko: "스트리머가 방송 제목을 바꾸면 알려주는 새 알림, 그리고 번역 대규모 수정.",
      id: "Notifikasi baru saat streamer mengubah judul siaran, plus banyak perbaikan terjemahan.",
      nl: "Nieuwe meldingen wanneer een streamer de titel van de stream wijzigt, plus een grote opschoonronde in de vertalingen.",
      sv: "Nya aviseringar när en streamer ändrar sändningens titel, plus en stor omgång rättningar i översättningarna.",
      cs: "Nová upozornění, když streamer změní název vysílání, a velká vlna oprav v překladech."
    },
    changes: [
      {
        type: "new",
        text: {
          fr: "Récap à la demande : choisissez les 7 ou 30 derniers jours ou un mois, en format PC (16:9) ou mobile (9:16), puis téléchargez l'image ou partagez-la sur X. Accessible depuis Réglages, Temps de visionnage.",
          en: "On-demand recap: pick the last 7 or 30 days or a month, in desktop (16:9) or mobile (9:16) format, then download the image or share it on X. Available from Settings, Watch time.",
          es: "Resumen a la carta: elige los últimos 7 o 30 días o un mes, en formato PC (16:9) o móvil (9:16), y descarga la imagen o compártela en X. Disponible en Ajustes, Tiempo de visualización.",
          "pt-BR": "Resumo sob demanda: escolha os últimos 7 ou 30 dias ou um mês, no formato PC (16:9) ou celular (9:16), e baixe a imagem ou compartilhe no X. Disponível em Configurações, Tempo assistido.",
          de: "Rückblick auf Abruf: Wähle die letzten 7 oder 30 Tage oder einen Monat, im PC- (16:9) oder Mobilformat (9:16), und lade das Bild herunter oder teile es auf X. Zu finden unter Einstellungen, Zuschauzeit.",
          it: "Riepilogo su richiesta: scegli gli ultimi 7 o 30 giorni o un mese, in formato PC (16:9) o mobile (9:16), poi scarica l'immagine o condividila su X. Disponibile in Impostazioni, Tempo di visione.",
          pl: "Podsumowanie na żądanie: wybierz ostatnie 7 lub 30 dni albo miesiąc, w formacie PC (16:9) lub telefonu (9:16), a potem pobierz obraz lub udostępnij go na X. Dostępne w Ustawieniach, Czas oglądania.",
          tr: "İsteğe bağlı özet: son 7 veya 30 günü ya da bir ayı seç, PC (16:9) veya mobil (9:16) formatında, ardından görseli indir ya da X'te paylaş. Ayarlar, İzleme süresi bölümünden erişilebilir.",
          ru: "Итоги по запросу: выбери последние 7 или 30 дней или месяц, в формате ПК (16:9) или телефона (9:16), затем скачай изображение или поделись им в X. Доступно в Настройках, Время просмотра.",
          ja: "いつでも作れるまとめ：過去7日間・30日間または月を選び、PC（16:9）かモバイル（9:16）形式で画像をダウンロード、またはXでシェアできます。設定の「視聴時間」から利用できます。",
          ko: "원할 때 만드는 결산: 최근 7일, 30일 또는 한 달을 고르고 PC(16:9) 또는 모바일(9:16) 형식으로 이미지를 다운로드하거나 X에 공유하세요. 설정의 시청 시간에서 이용할 수 있습니다.",
          id: "Rekap kapan saja: pilih 7 atau 30 hari terakhir atau satu bulan, dalam format PC (16:9) atau ponsel (9:16), lalu unduh gambarnya atau bagikan di X. Tersedia di Pengaturan, Waktu menonton.",
          nl: "Overzicht op aanvraag: kies de laatste 7 of 30 dagen of een maand, in pc- (16:9) of mobiel formaat (9:16), en download de afbeelding of deel hem op X. Te vinden onder Instellingen, Kijktijd.",
          sv: "Sammanfattning när du vill: välj de senaste 7 eller 30 dagarna eller en månad, i datorformat (16:9) eller mobilformat (9:16), och ladda ner bilden eller dela den på X. Finns under Inställningar, Tittartid.",
          cs: "Přehled na požádání: vyber posledních 7 nebo 30 dní nebo měsíc, ve formátu PC (16:9) nebo mobil (9:16), a stáhni obrázek nebo ho sdílej na X. Najdeš ho v Nastavení, Doba sledování."
        }
      },
      {
        type: "improved",
        text: {
          fr: "Les cartes hors ligne affichent la dernière catégorie diffusée, et le dernier titre au survol. Twitch ne renvoie rien pour une chaîne hors ligne : ces informations sont désormais conservées.",
          en: "Offline cards now show the last category streamed, and the last title on hover. Twitch returns nothing for an offline channel, so this is now remembered.",
          es: "Las tarjetas offline muestran la última categoría emitida y el último título al pasar el ratón. Twitch no devuelve nada para un canal offline, así que ahora se guarda.",
          "pt-BR": "Os cards offline mostram a última categoria transmitida e o último título ao passar o mouse. A Twitch não devolve nada para um canal offline, então agora isso fica guardado.",
          de: "Offline-Karten zeigen die zuletzt gestreamte Kategorie und beim Überfahren den letzten Titel. Twitch liefert für einen Offline-Kanal nichts, das wird jetzt gemerkt.",
          it: "Le schede offline mostrano l'ultima categoria trasmessa e l'ultimo titolo al passaggio del mouse. Twitch non restituisce nulla per un canale offline, quindi ora viene conservato.",
          pl: "Karty offline pokazują ostatnią nadawaną kategorię, a po najechaniu myszą ostatni tytuł. Twitch nic nie zwraca dla kanału offline, więc teraz jest to zapamiętywane.",
          tr: "Çevrimdışı kartlar yayınlanan son kategoriyi, üzerine gelince de son başlığı gösteriyor. Twitch çevrimdışı bir kanal için hiçbir şey döndürmüyor, artık bu bilgi saklanıyor.",
          ru: "Карточки офлайн показывают последнюю транслировавшуюся категорию, а при наведении и последнее название. Twitch ничего не отдаёт для офлайн-канала, теперь это запоминается.",
          ja: "オフラインのカードに、最後に配信していたカテゴリーを表示し、カーソルを合わせると最後のタイトルが出ます。Twitchはオフラインのチャンネルについて何も返さないため、この情報を保持するようにしました。",
          ko: "오프라인 카드에 마지막으로 방송한 카테고리가 표시되고, 마우스를 올리면 마지막 제목이 나옵니다. 트위치는 오프라인 채널 정보를 주지 않기 때문에, 이제 이 정보를 기억합니다.",
          id: "Kartu offline kini menampilkan kategori terakhir yang disiarkan, dan judul terakhir saat disorot. Twitch tidak mengembalikan apa pun untuk kanal offline, jadi kini disimpan.",
          nl: "Offline kaarten tonen de laatst gestreamde categorie, en bij hover de laatste titel. Twitch geeft niets terug voor een offline kanaal, dus dit wordt nu onthouden.",
          sv: "Offlinekort visar den senast sända kategorin, och den senaste titeln när du håller muspekaren över. Twitch returnerar inget för en offlinekanal, så detta sparas nu.",
          cs: "Karty offline zobrazují naposledy vysílanou kategorii a po najetí myší poslední název. Twitch pro offline kanál nevrací nic, takže se to nyní pamatuje."
        }
      },
      {
        type: "fix",
        text: {
          fr: "Changer votre pseudo dans les Réglages met aussi à jour votre photo de profil. Elle restait celle du compte saisi à l'installation.",
          en: "Changing your username in Settings now updates your profile picture too. It used to keep the one from the account entered at install time.",
          es: "Cambiar tu nombre en Ajustes ahora actualiza también tu foto de perfil. Antes se quedaba la de la cuenta indicada al instalar.",
          "pt-BR": "Mudar seu nome nas Configurações agora também atualiza sua foto de perfil. Antes ficava a da conta informada na instalação.",
          de: "Wenn du deinen Namen in den Einstellungen änderst, wird jetzt auch dein Profilbild aktualisiert. Vorher blieb das des bei der Installation angegebenen Kontos.",
          it: "Cambiare il tuo nome nelle Impostazioni aggiorna ora anche la foto profilo. Prima restava quella dell'account indicato all'installazione.",
          pl: "Zmiana nazwy w Ustawieniach aktualizuje teraz także zdjęcie profilowe. Wcześniej zostawało to z konta podanego przy instalacji.",
          tr: "Ayarlar'da kullanıcı adınızı değiştirmek artık profil fotoğrafınızı da güncelliyor. Önceden kurulumda girilen hesabınki kalıyordu.",
          ru: "Смена ника в настройках теперь обновляет и фото профиля. Раньше оставалось фото аккаунта, указанного при установке.",
          ja: "設定でユーザー名を変更すると、プロフィール写真も更新されるようになりました。これまではインストール時に入力したアカウントの写真が残っていました。",
          ko: "설정에서 사용자명을 바꾸면 프로필 사진도 함께 갱신됩니다. 이전에는 설치할 때 입력한 계정의 사진이 그대로 남아 있었습니다.",
          id: "Mengubah nama pengguna di Pengaturan kini juga memperbarui foto profil Anda. Sebelumnya tetap memakai foto akun yang dimasukkan saat pemasangan.",
          nl: "Je naam wijzigen bij Instellingen werkt nu ook je profielfoto bij. Voorheen bleef die van het account dat bij de installatie was ingevuld.",
          sv: "Att ändra ditt användarnamn i Inställningar uppdaterar nu även din profilbild. Tidigare låg den kvar från kontot som angavs vid installationen.",
          cs: "Změna přezdívky v Nastavení nyní aktualizuje i profilovou fotku. Dříve zůstávala fotka účtu zadaného při instalaci."
        }
      },
      {
        type: "fix",
        text: {
          fr: "Le bandeau rouge « Aucune préférence à mettre à jour » n'apparaît plus alors qu'aucun réglage n'a échoué.",
          en: "The red “No preferences to update” banner no longer appears when nothing actually failed.",
          es: "El aviso rojo «No hay preferencias que actualizar» ya no aparece cuando en realidad no ha fallado nada.",
          "pt-BR": "O aviso vermelho “Nenhuma preferência para atualizar” não aparece mais quando nada de fato falhou.",
          de: "Der rote Hinweis „Keine Einstellungen zu aktualisieren“ erscheint nicht mehr, wenn gar nichts fehlgeschlagen ist.",
          it: "L'avviso rosso «Nessuna preferenza da aggiornare» non compare più quando in realtà non è fallito nulla.",
          pl: "Czerwony komunikat „Brak preferencji do zaktualizowania” nie pojawia się już, gdy w rzeczywistości nic się nie nie powiodło.",
          tr: "Aslında hiçbir şey başarısız olmadığında çıkan kırmızı “Güncellenecek tercih yok” uyarısı artık görünmüyor.",
          ru: "Красная плашка «Нет настроек для обновления» больше не появляется, когда на самом деле ничего не сорвалось.",
          ja: "実際には何も失敗していないのに出ていた赤い「更新する設定がありません」の帯を表示しなくなりました。",
          ko: "실제로는 아무것도 실패하지 않았는데 뜨던 빨간 “업데이트할 설정이 없습니다” 배너가 더 이상 나오지 않습니다.",
          id: "Spanduk merah “Tidak ada preferensi untuk diperbarui” tidak lagi muncul padahal tidak ada yang gagal.",
          nl: "De rode melding “Geen voorkeuren om bij te werken” verschijnt niet meer wanneer er niets is misgegaan.",
          sv: "Den röda rutan ”Inga inställningar att uppdatera” visas inte längre när ingenting faktiskt misslyckats.",
          cs: "Červený pruh „Žádné předvolby k aktualizaci“ se už neobjevuje, když ve skutečnosti nic neselhalo."
        }
      },
      {
        type: "new",
        text: {
          fr: "Alertes de changement de titre : soyez prévenu quand un streamer modifie le titre de son live. À activer dans les Réglages, puis à couper streamer par streamer avec le nouveau bouton sur chaque carte.",
          en: "Title change alerts: get notified when a streamer edits their stream title. Turn them on in Settings, then mute them streamer by streamer with the new button on each card.",
          es: "Alertas de cambio de título: recibe un aviso cuando un streamer edita el título de su directo. Actívalas en Ajustes y siléncialas streamer por streamer con el nuevo botón de cada tarjeta.",
          "pt-BR": "Alertas de mudança de título: seja avisado quando um streamer editar o título da live. Ative nas Configurações e silencie streamer por streamer com o novo botão em cada card.",
          de: "Benachrichtigungen bei Titeländerung: Erfahre, wenn ein Streamer den Titel seines Streams ändert. In den Einstellungen aktivieren und pro Streamer über den neuen Button auf jeder Karte stummschalten.",
          it: "Avvisi di cambio titolo: ricevi una notifica quando uno streamer modifica il titolo della diretta. Attivali nelle Impostazioni e silenziali streamer per streamer con il nuovo pulsante su ogni scheda.",
          pl: "Alerty o zmianie tytułu: dowiedz się, gdy streamer zmieni tytuł transmisji. Włącz je w Ustawieniach, a potem wyciszaj osobno dla każdego streamera nowym przyciskiem na karcie.",
          tr: "Başlık değişikliği uyarıları: bir yayıncı yayın başlığını düzenlediğinde haberdar olun. Ayarlar'dan açın, sonra her karttaki yeni düğmeyle yayıncı bazında susturun.",
          ru: "Оповещения об изменении названия: узнавайте, когда стример меняет название трансляции. Включите их в настройках и отключайте для каждого стримера новой кнопкой на карточке.",
          ja: "タイトル変更の通知：配信者が配信タイトルを変更したときに知らせます。設定でオンにして、各カードの新しいボタンで配信者ごとにオフにできます。",
          ko: "제목 변경 알림: 스트리머가 방송 제목을 수정하면 알려줍니다. 설정에서 켜고, 각 카드의 새 버튼으로 스트리머별로 끌 수 있습니다.",
          id: "Peringatan perubahan judul: dapatkan notifikasi saat streamer mengubah judul siarannya. Aktifkan di Pengaturan, lalu bisukan per streamer lewat tombol baru di tiap kartu.",
          nl: "Meldingen bij titelwijziging: krijg bericht wanneer een streamer de titel van de stream aanpast. Zet ze aan bij Instellingen en demp ze per streamer met de nieuwe knop op elke kaart.",
          sv: "Aviseringar vid titeländring: få besked när en streamer ändrar sändningens titel. Slå på dem i Inställningar och tysta dem per streamer med den nya knappen på varje kort.",
          cs: "Upozornění na změnu názvu: dozvíte se, když streamer změní název vysílání. Zapněte je v Nastavení a ztlumte je u jednotlivých streamerů novým tlačítkem na kartě."
        }
      },
      {
        type: "new",
        text: {
          fr: "Votre photo de profil Twitch apparaît désormais en filigrane derrière vos points et votre temps de visionnage.",
          en: "Your Twitch profile picture now appears as a watermark behind your points and watch time.",
          es: "Tu foto de perfil de Twitch aparece ahora como marca de agua detrás de tus puntos y tu tiempo de visionado.",
          "pt-BR": "Sua foto de perfil da Twitch agora aparece como marca-d'água atrás dos seus pontos e do seu tempo assistido.",
          de: "Dein Twitch-Profilbild erscheint jetzt als Wasserzeichen hinter deinen Punkten und deiner Sehzeit.",
          it: "La tua foto profilo Twitch appare ora in filigrana dietro i tuoi punti e il tuo tempo di visione.",
          pl: "Twoje zdjęcie profilowe z Twitcha pojawia się teraz jako znak wodny za punktami i czasem oglądania.",
          tr: "Twitch profil fotoğrafınız artık puanlarınızın ve izleme sürenizin arkasında filigran olarak görünüyor.",
          ru: "Ваше фото профиля Twitch теперь видно фоном за очками и временем просмотра.",
          ja: "Twitchのプロフィール写真が、ポイントと視聴時間の背景に透かしとして表示されるようになりました。",
          ko: "이제 트위치 프로필 사진이 포인트와 시청 시간 뒤에 워터마크로 표시됩니다.",
          id: "Foto profil Twitch Anda kini tampil sebagai tanda air di belakang poin dan waktu tonton Anda.",
          nl: "Je Twitch-profielfoto verschijnt nu als watermerk achter je punten en kijktijd.",
          sv: "Din Twitch-profilbild visas nu som vattenstämpel bakom dina poäng och din speltid.",
          cs: "Vaše profilová fotka z Twitche se nyní zobrazuje jako vodoznak za body a časem sledování."
        }
      },
      {
        type: "improved",
        text: {
          fr: "Les boutons de chaque carte indiquent leur rôle au survol : notifications, alertes catégorie, alertes titre, ouvrir, retirer. Ils étaient restés en français dans toutes les autres langues.",
          en: "Each card button now says what it does on hover: notifications, category alerts, title alerts, open, remove. They had stayed in French in every other language.",
          es: "Los botones de cada tarjeta indican su función al pasar el ratón: notificaciones, alertas de categoría, alertas de título, abrir, quitar. Se habían quedado en francés en todos los demás idiomas.",
          "pt-BR": "Os botões de cada card mostram sua função ao passar o mouse: notificações, alertas de categoria, alertas de título, abrir, remover. Eles tinham ficado em francês em todos os outros idiomas.",
          de: "Die Buttons jeder Karte zeigen beim Überfahren ihre Funktion: Benachrichtigungen, Kategoriewarnungen, Titel-Benachrichtigungen, Öffnen, Entfernen. Sie waren in allen anderen Sprachen auf Französisch geblieben.",
          it: "I pulsanti di ogni scheda mostrano la loro funzione al passaggio del mouse: notifiche, avvisi categoria, avvisi titolo, apri, rimuovi. Erano rimasti in francese in tutte le altre lingue.",
          pl: "Przyciski na każdej karcie pokazują swoją funkcję po najechaniu: powiadomienia, alerty kategorii, alerty tytułu, otwórz, usuń. We wszystkich innych językach pozostawały po francusku.",
          tr: "Her karttaki düğmeler üzerine gelince ne işe yaradığını gösteriyor: bildirimler, kategori uyarıları, başlık uyarıları, aç, kaldır. Diğer tüm dillerde Fransızca kalmışlardı.",
          ru: "Кнопки на карточке подсказывают своё назначение при наведении: уведомления, оповещения о категории, оповещения о названии, открыть, удалить. Во всех других языках они оставались на французском.",
          ja: "各カードのボタンにカーソルを合わせると役割が表示されます：通知、カテゴリー通知、タイトル通知、開く、削除。これまで他の言語ではフランス語のままでした。",
          ko: "각 카드의 버튼에 마우스를 올리면 기능이 표시됩니다: 알림, 카테고리 알림, 제목 알림, 열기, 삭제. 그동안 다른 모든 언어에서 프랑스어로 남아 있었습니다.",
          id: "Tombol di tiap kartu kini menunjukkan fungsinya saat disorot: notifikasi, peringatan kategori, peringatan judul, buka, hapus. Sebelumnya tetap berbahasa Prancis di semua bahasa lain.",
          nl: "De knoppen op elke kaart tonen bij hover waar ze voor dienen: meldingen, categoriemeldingen, titelmeldingen, openen, verwijderen. Ze waren in alle andere talen in het Frans gebleven.",
          sv: "Knapparna på varje kort visar vad de gör när du håller muspekaren över: aviseringar, kategoriaviseringar, titelaviseringar, öppna, ta bort. De hade blivit kvar på franska i alla andra språk.",
          cs: "Tlačítka na každé kartě po najetí myší ukážou, k čemu slouží: oznámení, upozornění na kategorii, upozornění na název, otevřít, odebrat. Ve všech ostatních jazycích zůstávala francouzsky."
        }
      },
      {
        type: "fix",
        text: {
          fr: "Sur une carte en live, le nom de la plateforme n'apparaît plus deux fois.",
          en: "On a live card, the platform name no longer appears twice.",
          es: "En una tarjeta en directo, el nombre de la plataforma ya no aparece dos veces.",
          "pt-BR": "Em um card ao vivo, o nome da plataforma não aparece mais duas vezes.",
          de: "Auf einer Live-Karte erscheint der Plattformname nicht mehr doppelt.",
          it: "Su una scheda in diretta, il nome della piattaforma non compare più due volte.",
          pl: "Na karcie transmisji na żywo nazwa platformy nie pojawia się już dwa razy.",
          tr: "Canlı bir kartta platform adı artık iki kez görünmüyor.",
          ru: "На карточке трансляции название платформы больше не показывается дважды.",
          ja: "配信中のカードで、プラットフォーム名が二重に表示されなくなりました。",
          ko: "라이브 카드에서 플랫폼 이름이 두 번 표시되지 않습니다.",
          id: "Pada kartu siaran langsung, nama platform tidak lagi muncul dua kali.",
          nl: "Op een livekaart verschijnt de naam van het platform niet meer twee keer.",
          sv: "På ett livekort visas plattformens namn inte längre två gånger.",
          cs: "Na kartě živého vysílání se název platformy už neobjevuje dvakrát."
        }
      },
      {
        type: "fix",
        text: {
          fr: "Grand ménage dans les traductions : « Twitch » et « Kick » étaient traduits en mots courants dans une dizaine de langues, et le nom du jeu ou de la plateforme manquait dans plusieurs notifications.",
          en: "Big translation cleanup: “Twitch” and “Kick” were being translated into everyday words in about ten languages, and the game or platform name was missing from several notifications.",
          es: "Gran limpieza en las traducciones: «Twitch» y «Kick» se traducían como palabras comunes en una decena de idiomas, y faltaba el nombre del juego o de la plataforma en varias notificaciones.",
          "pt-BR": "Grande limpeza nas traduções: “Twitch” e “Kick” eram traduzidos como palavras comuns em uma dezena de idiomas, e faltava o nome do jogo ou da plataforma em várias notificações.",
          de: "Großer Übersetzungs-Frühjahrsputz: „Twitch“ und „Kick“ wurden in rund zehn Sprachen als Alltagswörter übersetzt, und in mehreren Benachrichtigungen fehlte der Spiel- oder Plattformname.",
          it: "Grande pulizia nelle traduzioni: «Twitch» e «Kick» venivano tradotti come parole comuni in una decina di lingue, e in diverse notifiche mancava il nome del gioco o della piattaforma.",
          pl: "Duże porządki w tłumaczeniach: „Twitch” i „Kick” były tłumaczone jako zwykłe słowa w kilkunastu językach, a w kilku powiadomieniach brakowało nazwy gry lub platformy.",
          tr: "Çevirilerde büyük temizlik: “Twitch” ve “Kick” yaklaşık on dilde günlük kelimelere çevriliyordu ve birkaç bildirimde oyun veya platform adı eksikti.",
          ru: "Большая уборка в переводах: «Twitch» и «Kick» переводились как обычные слова примерно в десяти языках, а в нескольких уведомлениях пропадало название игры или платформы.",
          ja: "翻訳の大掃除：10ほどの言語で「Twitch」と「Kick」が普通の単語として翻訳されており、いくつかの通知ではゲーム名やプラットフォーム名が抜けていました。",
          ko: "번역 대청소: 열 개 남짓한 언어에서 “Twitch”와 “Kick”이 일반 단어로 번역되어 있었고, 일부 알림에서는 게임이나 플랫폼 이름이 빠져 있었습니다.",
          id: "Pembersihan besar pada terjemahan: “Twitch” dan “Kick” diterjemahkan menjadi kata sehari-hari di sekitar sepuluh bahasa, dan nama game atau platform hilang di beberapa notifikasi.",
          nl: "Grote opruiming in de vertalingen: “Twitch” en “Kick” werden in een tiental talen als gewone woorden vertaald, en in meerdere meldingen ontbrak de naam van de game of het platform.",
          sv: "Stor uppstädning i översättningarna: ”Twitch” och ”Kick” översattes till vardagsord på ett tiotal språk, och i flera aviseringar saknades spelets eller plattformens namn.",
          cs: "Velký úklid v překladech: „Twitch“ a „Kick“ se v deseti jazycích překládaly jako běžná slova a v několika oznámeních chybělo jméno hry nebo platformy."
        }
      }
    ]
  },
  {
    version: "26.9.9",
    date: "2026-09-09",
    title: {
      fr: "StreamPulse arrive sur Firefox",
      en: "StreamPulse lands on Firefox",
      es: "StreamPulse llega a Firefox",
      "pt-BR": "StreamPulse chega ao Firefox",
      de: "StreamPulse kommt zu Firefox",
      it: "StreamPulse arriva su Firefox",
      pl: "StreamPulse trafia na Firefoksa",
      tr: "StreamPulse artık Firefox'ta",
      ru: "StreamPulse выходит в Firefox",
      ja: "StreamPulseがFirefoxに登場",
      ko: "StreamPulse, 이제 Firefox에서",
      id: "StreamPulse hadir di Firefox",
      nl: "StreamPulse komt naar Firefox",
      sv: "StreamPulse kommer till Firefox",
      cs: "StreamPulse míří do Firefoxu"
    },
    subtitle: {
      fr: "La version Firefox est en ligne, avec le badge communautaire dans le tchat Twitch.",
      en: "The Firefox version is live, along with the community badge in Twitch chat.",
      es: "La versión para Firefox ya está disponible, junto a la insignia comunitaria en el chat de Twitch.",
      "pt-BR": "A versão para Firefox está no ar, junto com o distintivo comunitário no chat da Twitch.",
      de: "Die Firefox-Version ist da, zusammen mit dem Community-Abzeichen im Twitch-Chat.",
      it: "La versione Firefox è online, insieme al badge della comunità nella chat di Twitch.",
      pl: "Wersja na Firefoksa jest już dostępna, razem z odznaką społeczności na czacie Twitcha.",
      tr: "Firefox sürümü yayında; yanında Twitch sohbetindeki topluluk rozeti.",
      ru: "Версия для Firefox доступна, вместе со значком сообщества в чате Twitch.",
      ja: "Firefox版を公開しました。Twitchチャットのコミュニティバッジも一緒に。",
      ko: "Firefox 버전이 출시되었습니다. 트위치 채팅의 커뮤니티 배지도 함께.",
      id: "Versi Firefox sudah tersedia, bersama lencana komunitas di obrolan Twitch.",
      nl: "De Firefox-versie is live, samen met de community-badge in de Twitch-chat.",
      sv: "Firefox-versionen är live, tillsammans med gemenskapsmärket i Twitch-chatten.",
      cs: "Verze pro Firefox je online, spolu s komunitním odznakem v chatu Twitche."
    },
    changes: [
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
          fr: "Panneau de la topbar Twitch repensé : le temps passé sur la chaîne que vous regardez, un bouton pour l'ajouter à vos suivis, vos réglages rapides, et la liste de vos streamers actuellement en direct, cliquables pour basculer sans quitter la page.",
          en: "Redesigned Twitch top-bar panel: how long you have watched the current channel, a button to add it to your list, your quick settings, and your streamers currently live: click to switch without leaving the page.",
          es: "Panel de la barra superior de Twitch rediseñado: el tiempo pasado en el canal actual, un botón para añadirlo a tus seguidos, tus ajustes rápidos y tus streamers en directo, clicables para cambiar sin salir de la página.",
          "pt-BR": "Painel da barra superior da Twitch redesenhado: o tempo assistido no canal atual, um botão para adicioná-lo aos seus seguidos, seus ajustes rápidos e seus streamers ao vivo, clicáveis para trocar sem sair da página.",
          de: "Neu gestaltetes Twitch-Topbar-Panel: deine Sehzeit im aktuellen Kanal, ein Button zum Hinzufügen, deine Schnelleinstellungen und deine Streamer, die gerade live sind, anklickbar zum Wechseln, ohne die Seite zu verlassen.",
          it: "Pannello della barra superiore di Twitch ridisegnato: il tempo passato sul canale attuale, un pulsante per aggiungerlo ai seguiti, le impostazioni rapide e i tuoi streamer in diretta, cliccabili per cambiare senza lasciare la pagina.",
          pl: "Przeprojektowany panel górnego paska Twitcha: czas spędzony na oglądanym kanale, przycisk dodania go do obserwowanych, szybkie ustawienia i lista streamerów na żywo, klikalna, by przełączyć bez opuszczania strony.",
          tr: "Yeniden tasarlanan Twitch üst çubuk paneli: izlediğiniz kanalda geçirdiğiniz süre, onu listenize ekleme düğmesi, hızlı ayarlarınız ve şu anda yayında olan yayıncılarınız, sayfadan ayrılmadan geçmek için tıklanabilir.",
          ru: "Обновлённая панель верхней строки Twitch: время, проведённое на текущем канале, кнопка добавления в список, быстрые настройки и стримеры, которые сейчас в эфире: кликните, чтобы переключиться, не покидая страницу.",
          ja: "Twitchトップバーのパネルを刷新：視聴中のチャンネルでの視聴時間、フォローに追加するボタン、クイック設定、そして配信中のストリーマー一覧。クリックでページを離れずに切り替えられます。",
          ko: "트위치 상단 바 패널 개편: 현재 채널의 시청 시간, 목록에 추가하는 버튼, 빠른 설정, 그리고 방송 중인 스트리머 목록. 클릭하면 페이지를 벗어나지 않고 이동합니다.",
          id: "Panel bilah atas Twitch dirancang ulang: waktu tonton di kanal yang sedang Anda tonton, tombol untuk menambahkannya, pengaturan cepat, dan streamer Anda yang sedang live: klik untuk beralih tanpa meninggalkan halaman.",
          nl: "Vernieuwd Twitch-topbalkpaneel: je kijktijd op het huidige kanaal, een knop om het toe te voegen, je snelle instellingen en je streamers die nu live zijn: klik om te wisselen zonder de pagina te verlaten.",
          sv: "Omdesignad panel i Twitch-topplisten: din tittartid på kanalen du ser, en knapp för att lägga till den, dina snabbinställningar och dina streamers som sänder nu, klickbara för att byta utan att lämna sidan.",
          cs: "Přepracovaný panel horní lišty Twitche: čas strávený na sledovaném kanálu, tlačítko pro přidání mezi sledované, rychlá nastavení a streameři, kteří právě vysílají: kliknutím přepnete bez opuštění stránky."
        }
      },
      {
        type: "new",
        text: {
          fr: "La couleur du badge de tchat est réglable : la couleur du pseudo de chacun, du blanc ou noir selon le thème Twitch, ou une couleur de votre choix.",
          en: "The chat badge colour is now adjustable: each person's username colour, white or black to match the Twitch theme, or a colour of your choice.",
          es: "El color de la insignia del chat es ajustable: el color del nombre de cada persona, blanco o negro según el tema de Twitch, o el color que prefieras.",
          "pt-BR": "A cor do distintivo no chat é ajustável: a cor do nome de cada pessoa, branco ou preto conforme o tema da Twitch, ou a cor que você preferir.",
          de: "Die Farbe des Chat-Abzeichens ist einstellbar: die Namensfarbe der jeweiligen Person, Weiß oder Schwarz passend zum Twitch-Theme, oder eine eigene Farbe.",
          it: "Il colore del badge in chat è regolabile: il colore del nome di ciascuno, bianco o nero secondo il tema di Twitch, o un colore a tua scelta.",
          pl: "Kolor odznaki na czacie można ustawić: kolor pseudonimu każdej osoby, biały lub czarny zgodnie z motywem Twitcha, albo dowolny kolor.",
          tr: "Sohbet rozetinin rengi ayarlanabilir: her kişinin kullanıcı adı rengi, Twitch temasına göre beyaz veya siyah, ya da seçtiğiniz bir renk.",
          ru: "Цвет значка в чате настраивается: цвет ника каждого, белый или чёрный по теме Twitch, либо любой цвет на ваш выбор.",
          ja: "チャットバッジの色を設定できます：各ユーザー名の色、Twitchのテーマに合わせた白か黒、または好きな色。",
          ko: "채팅 배지 색상을 설정할 수 있습니다: 각자의 사용자 이름 색상, 트위치 테마에 맞춘 흰색 또는 검은색, 혹은 원하는 색상.",
          id: "Warna lencana obrolan kini dapat diatur: warna nama tiap orang, putih atau hitam sesuai tema Twitch, atau warna pilihan Anda.",
          nl: "De kleur van de chatbadge is instelbaar: de naamkleur van elke persoon, wit of zwart volgens het Twitch-thema, of een kleur naar keuze.",
          sv: "Chattmärkets färg går att ställa in: varje persons namnfärg, vitt eller svart efter Twitch-temat, eller en egen färg.",
          cs: "Barvu odznaku v chatu lze nastavit: barva jména každého uživatele, bílá nebo černá podle motivu Twitche, nebo vlastní barva."
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
          fr: "Le badge communautaire n'envoie plus votre pseudo : seule une empreinte de celui-ci est transmise, calculée dans votre navigateur, et la liste publique n'affiche aucun nom.",
          en: "The community badge no longer sends your username: only a fingerprint of it is transmitted, computed in your browser, and the public list shows no names.",
          es: "La insignia comunitaria ya no envía tu nombre: solo se transmite una huella de este, calculada en tu navegador, y la lista pública no muestra ningún nombre.",
          "pt-BR": "O distintivo comunitário não envia mais o seu nome: apenas uma impressão dele é transmitida, calculada no seu navegador, e a lista pública não exibe nome algum.",
          de: "Das Community-Abzeichen sendet deinen Namen nicht mehr: Übertragen wird nur ein im Browser berechneter Fingerabdruck davon, und die öffentliche Liste zeigt keine Namen.",
          it: "Il badge della comunità non invia più il tuo nome: viene trasmessa solo un'impronta di esso, calcolata nel tuo browser, e l'elenco pubblico non mostra alcun nome.",
          pl: "Odznaka społeczności nie wysyła już Twojego pseudonimu: przesyłany jest tylko jego odcisk, obliczany w przeglądarce, a publiczna lista nie pokazuje żadnych nazw.",
          tr: "Topluluk rozeti artık kullanıcı adınızı göndermiyor: yalnızca tarayıcınızda hesaplanan bir parmak izi iletilir ve herkese açık liste hiçbir ad göstermez.",
          ru: "Значок сообщества больше не отправляет ваш ник: передаётся только его отпечаток, вычисленный в браузере, и публичный список не показывает имён.",
          ja: "コミュニティバッジはユーザー名を送信しなくなりました。送られるのはブラウザ内で計算されたハッシュのみで、公開リストに名前は表示されません。",
          ko: "커뮤니티 배지는 더 이상 사용자 이름을 보내지 않습니다. 브라우저에서 계산된 지문만 전송되며, 공개 목록에는 이름이 표시되지 않습니다.",
          id: "Lencana komunitas tidak lagi mengirim nama pengguna Anda: hanya sidiknya yang dikirim, dihitung di peramban Anda, dan daftar publik tidak menampilkan nama.",
          nl: "De community-badge stuurt je naam niet meer: alleen een in je browser berekende vingerafdruk ervan wordt verzonden, en de openbare lijst toont geen namen.",
          sv: "Gemenskapsmärket skickar inte längre ditt namn: endast ett fingeravtryck av det, beräknat i din webbläsare, överförs och den offentliga listan visar inga namn.",
          cs: "Komunitní odznak už neodesílá vaše jméno: přenáší se pouze jeho otisk vypočítaný ve vašem prohlížeči a veřejný seznam nezobrazuje žádná jména."
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
        type: "improved",
        text: {
          fr: "Chaque changement de réglage affiche désormais une confirmation : plus de doute sur ce qui a été pris en compte.",
          en: "Every setting change now shows a confirmation, so there is no doubt about what was applied.",
          es: "Cada cambio de ajuste muestra ahora una confirmación: sin dudas sobre lo que se ha aplicado.",
          "pt-BR": "Cada alteração de configuração agora exibe uma confirmação: sem dúvidas sobre o que foi aplicado.",
          de: "Jede Einstellungsänderung zeigt jetzt eine Bestätigung: kein Zweifel mehr, was übernommen wurde.",
          it: "Ogni modifica alle impostazioni mostra ora una conferma: nessun dubbio su cosa è stato applicato.",
          pl: "Każda zmiana ustawień pokazuje teraz potwierdzenie: bez wątpliwości, co zostało zapisane.",
          tr: "Her ayar değişikliği artık bir onay gösteriyor: neyin uygulandığına dair şüphe kalmıyor.",
          ru: "Каждое изменение настройки теперь показывает подтверждение: понятно, что именно применилось.",
          ja: "設定を変更するたびに確認が表示されます。何が反映されたか迷いません。",
          ko: "설정을 변경할 때마다 확인 메시지가 표시되어 무엇이 적용됐는지 분명해집니다.",
          id: "Setiap perubahan pengaturan kini menampilkan konfirmasi, jadi tidak ada keraguan tentang apa yang diterapkan.",
          nl: "Elke wijziging van een instelling toont nu een bevestiging: geen twijfel meer over wat is toegepast.",
          sv: "Varje ändrad inställning visar nu en bekräftelse, så du vet vad som sparats.",
          cs: "Každá změna nastavení nyní zobrazí potvrzení, takže je jasné, co se uložilo."
        }
      },
      {
        type: "improved",
        text: {
          fr: "Les trois tailles de preview au survol sont nettement plus distinctes, et la qualité vidéo suit la taille choisie.",
          en: "The three hover preview sizes are now clearly distinct, and video quality follows the size you pick.",
          es: "Los tres tamaños de vista previa son mucho más distintos, y la calidad de vídeo sigue el tamaño elegido.",
          "pt-BR": "Os três tamanhos de pré-visualização estão bem mais distintos, e a qualidade do vídeo acompanha o tamanho escolhido.",
          de: "Die drei Vorschaugrößen unterscheiden sich jetzt deutlich, und die Videoqualität folgt der gewählten Größe.",
          it: "Le tre dimensioni dell'anteprima sono nettamente più distinte e la qualità video segue quella scelta.",
          pl: "Trzy rozmiary podglądu są wyraźnie różne, a jakość wideo dostosowuje się do wybranego rozmiaru.",
          tr: "Üç önizleme boyutu artık belirgin biçimde farklı ve video kalitesi seçilen boyutu izliyor.",
          ru: "Три размера превью теперь заметно различаются, а качество видео следует выбранному размеру.",
          ja: "ホバープレビューの3つのサイズがはっきり区別できるようになり、画質も選んだサイズに追従します。",
          ko: "미리보기 세 가지 크기가 확실히 구분되며, 영상 화질도 선택한 크기를 따릅니다.",
          id: "Tiga ukuran pratinjau kini jelas berbeda, dan kualitas video mengikuti ukuran yang dipilih.",
          nl: "De drie voorbeeldformaten verschillen nu duidelijk, en de videokwaliteit volgt het gekozen formaat.",
          sv: "De tre förhandsvisningsstorlekarna skiljer sig nu tydligt, och videokvaliteten följer vald storlek.",
          cs: "Tři velikosti náhledu se nyní zřetelně liší a kvalita videa se řídí zvolenou velikostí."
        }
      },
      {
        type: "improved",
        text: {
          fr: "Le soutien au développeur propose Revolut et PayPal partout, y compris depuis la topbar Twitch qui n'offrait qu'un seul choix.",
          en: "Supporting the developer offers both Revolut and PayPal everywhere, including from the Twitch top bar which previously offered only one.",
          es: "El apoyo al desarrollador ofrece Revolut y PayPal en todas partes, incluida la barra superior de Twitch, que antes solo daba una opción.",
          "pt-BR": "O apoio ao desenvolvedor oferece Revolut e PayPal em todos os lugares, inclusive na barra superior da Twitch, que antes tinha só uma opção.",
          de: "Die Unterstützung bietet überall Revolut und PayPal, auch in der Twitch-Topbar, wo es bisher nur eine Option gab.",
          it: "Il sostegno allo sviluppatore offre Revolut e PayPal ovunque, anche dalla barra superiore di Twitch che ne proponeva una sola.",
          pl: "Wsparcie twórcy oferuje Revolut i PayPal wszędzie, także na górnym pasku Twitcha, gdzie wcześniej była tylko jedna opcja.",
          tr: "Geliştiriciye destek her yerde Revolut ve PayPal sunuyor; daha önce tek seçenek olan Twitch üst çubuğu dahil.",
          ru: "Поддержка разработчика предлагает Revolut и PayPal везде, включая верхнюю панель Twitch, где раньше был лишь один вариант.",
          ja: "開発者への支援はどこからでもRevolutとPayPalを選べます。選択肢が1つだけだったTwitchトップバーも同様です。",
          ko: "개발자 후원은 어디서든 Revolut과 PayPal을 제공합니다. 선택지가 하나뿐이던 트위치 상단 바도 마찬가지입니다.",
          id: "Dukungan untuk pengembang menawarkan Revolut dan PayPal di mana saja, termasuk bilah atas Twitch yang sebelumnya hanya satu pilihan.",
          nl: "Steun aan de ontwikkelaar biedt overal Revolut én PayPal, ook in de Twitch-topbalk die eerder maar één optie had.",
          sv: "Stöd till utvecklaren erbjuder Revolut och PayPal överallt, även från Twitch-topplisten som tidigare bara hade ett val.",
          cs: "Podpora vývojáře nabízí Revolut i PayPal všude, včetně horní lišty Twitche, kde byla dříve jen jedna možnost."
        }
      },
      {
        type: "improved",
        text: {
          fr: "Les notes de version s'ouvrent aussi depuis l'en-tête du pop-up, à côté du bouton d'actualisation, avec la même pastille de nouveauté que dans les réglages.",
          en: "Patch notes also open from the popup header, next to the refresh button, with the same new-release dot as in the settings.",
          es: "Las notas de la versión también se abren desde la cabecera de la ventana emergente, junto al botón de actualizar, con el mismo punto de novedad que en los ajustes.",
          "pt-BR": "As notas da versão também abrem pelo cabeçalho do pop-up, ao lado do botão de atualizar, com o mesmo ponto de novidade das configurações.",
          de: "Die Versionshinweise lassen sich jetzt auch über die Kopfzeile des Pop-ups öffnen, neben dem Aktualisieren-Button, mit demselben Neuigkeitspunkt wie in den Einstellungen.",
          it: "Le note di versione si aprono anche dall'intestazione del pop-up, accanto al pulsante di aggiornamento, con lo stesso pallino di novità delle impostazioni.",
          pl: "Informacje o wersji otwierają się także z nagłówka okienka, obok przycisku odświeżania, z tą samą kropką nowości co w ustawieniach.",
          tr: "Sürüm notları artık açılır pencerenin üst şeridinden de, yenileme düğmesinin yanından açılıyor; ayarlardakiyle aynı yenilik noktasıyla.",
          ru: "Заметки о выпуске теперь открываются и из шапки всплывающего окна, рядом с кнопкой обновления, с той же точкой новизны, что и в настройках.",
          ja: "リリースノートはポップアップのヘッダー、更新ボタンの隣からも開けます。設定側と同じ新着ドットが付きます。",
          ko: "릴리스 노트를 팝업 헤더의 새로고침 버튼 옆에서도 열 수 있습니다. 설정에 있는 것과 같은 새 소식 표시가 함께 나타납니다.",
          id: "Catatan versi kini juga terbuka dari header pop-up, di samping tombol segarkan, dengan titik penanda baru yang sama seperti di pengaturan.",
          nl: "De release-opmerkingen openen nu ook vanuit de koptekst van de pop-up, naast de vernieuwknop, met hetzelfde nieuwtjesstipje als in de instellingen.",
          sv: "Versionsnoteringarna öppnas nu även från popupens sidhuvud, bredvid uppdateringsknappen, med samma nyhetsprick som i inställningarna.",
          cs: "Poznámky k verzi se nově otevřou i ze záhlaví vyskakovacího okna, vedle tlačítka obnovení, se stejnou tečkou novinky jako v nastavení."
        }
      },
      {
        type: "improved",
        text: {
          fr: "L'ouverture automatique de l'inventaire Drops se déclenche toutes les 24h par défaut, au lieu de toutes les 4h. Les installations restées sur 4h basculent d'elles-mêmes, et la fréquence reste réglable dans les réglages.",
          en: "Automatic Drops inventory opening now runs every 24h by default instead of every 4h. Installs still set to 4h switch over on their own, and the frequency stays adjustable in the settings.",
          es: "La apertura automática del inventario de Drops se ejecuta cada 24 h de forma predeterminada, en lugar de cada 4 h. Las instalaciones que seguían en 4 h cambian solas, y la frecuencia sigue siendo ajustable en los ajustes.",
          "pt-BR": "A abertura automática do inventário de Drops passa a ocorrer a cada 24h por padrão, em vez de a cada 4h. As instalações que continuavam em 4h mudam sozinhas, e a frequência continua ajustável nas configurações.",
          de: "Das automatische Öffnen des Drops-Inventars läuft jetzt standardmäßig alle 24 Std. statt alle 4 Std. Installationen, die noch auf 4 Std. standen, stellen sich von selbst um, und die Frequenz bleibt in den Einstellungen änderbar.",
          it: "L'apertura automatica dell'inventario Drops scatta ogni 24 h per impostazione predefinita, invece che ogni 4 h. Le installazioni rimaste a 4 h passano da sole, e la frequenza resta regolabile nelle impostazioni.",
          pl: "Automatyczne otwieranie ekwipunku Dropów działa domyślnie co 24 h zamiast co 4 h. Instalacje pozostawione na 4 h przełączają się same, a częstotliwość nadal można zmienić w ustawieniach.",
          tr: "Drops envanterinin otomatik açılışı artık varsayılan olarak 4 saatte bir yerine 24 saatte bir çalışıyor. Hâlâ 4 saatte bir ayarında olan kurulumlar kendiliğinden geçiyor ve sıklık ayarlardan değiştirilebilir kalıyor.",
          ru: "Автоматическое открытие инвентаря Drops по умолчанию срабатывает раз в 24 часа вместо каждых 4 часов. Установки, оставшиеся на 4 часах, переключаются сами, а частоту по-прежнему можно изменить в настройках.",
          ja: "Dropsインベントリの自動オープンが、既定で4時間ごとから24時間ごとになりました。4時間のままだった環境は自動的に切り替わり、頻度は設定でいつでも変更できます。",
          ko: "Drops 인벤토리 자동 열기가 기본값으로 4시간마다에서 24시간마다로 바뀌었습니다. 아직 4시간으로 남아 있던 설치본은 자동으로 전환되며, 주기는 설정에서 계속 변경할 수 있습니다.",
          id: "Pembukaan otomatis inventaris Drops kini berjalan setiap 24 jam secara bawaan, bukan setiap 4 jam. Pemasangan yang masih di 4 jam berpindah sendiri, dan frekuensinya tetap bisa diatur di pengaturan.",
          nl: "Het automatisch openen van de Drops-inventaris gebeurt nu standaard elke 24 uur in plaats van elke 4 uur. Installaties die nog op 4 uur stonden schakelen vanzelf om, en de frequentie blijft instelbaar in de instellingen.",
          sv: "Automatisk öppning av Drops-inventariet körs nu var 24:e timme som standard i stället för var 4:e timme. Installationer som stod kvar på 4 timmar byter av sig själva, och frekvensen går fortfarande att ändra i inställningarna.",
          cs: "Automatické otevírání inventáře Drops se ve výchozím nastavení spouští každých 24 hodin místo každých čtyř hodin. Instalace, které zůstaly na čtyřech hodinách, se přepnou samy a frekvenci lze dál měnit v nastavení."
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
      },
      {
        type: "fix",
        text: {
          fr: "Le badge du tchat était espacé deux fois plus que les badges natifs de Twitch : son alignement est désormais identique aux leurs, y compris avec 7TV.",
          en: "The chat badge was spaced twice as far as Twitch's native badges: its alignment now matches theirs exactly, 7TV included.",
          es: "La insignia del chat tenía el doble de separación que las nativas de Twitch: ahora se alinea igual que ellas, también con 7TV.",
          "pt-BR": "O distintivo do chat tinha o dobro do espaçamento dos nativos da Twitch: agora alinha exatamente como eles, inclusive com 7TV.",
          de: "Das Chat-Abzeichen hatte doppelt so viel Abstand wie Twitchs eigene Abzeichen: Die Ausrichtung stimmt jetzt exakt, auch mit 7TV.",
          it: "Il badge in chat aveva il doppio dello spazio rispetto a quelli nativi di Twitch: ora è allineato esattamente come loro, anche con 7TV.",
          pl: "Odznaka na czacie miała dwa razy większy odstęp niż natywne odznaki Twitcha: teraz jest wyrównana identycznie, także z 7TV.",
          tr: "Sohbet rozeti, Twitch'in yerel rozetlerinden iki kat fazla boşluğa sahipti: hizalaması artık onlarla birebir aynı, 7TV dahil.",
          ru: "Значок в чате отстоял вдвое дальше, чем родные значки Twitch: теперь выравнивание совпадает с ними, включая 7TV.",
          ja: "チャットバッジの間隔がTwitch純正バッジの2倍でした。7TVを含め、配置が純正と同一になりました。",
          ko: "채팅 배지의 간격이 트위치 기본 배지의 두 배였습니다. 이제 7TV를 포함해 정확히 동일하게 정렬됩니다.",
          id: "Lencana obrolan berjarak dua kali lipat dari lencana asli Twitch: kini sejajar persis dengan mereka, termasuk dengan 7TV.",
          nl: "De chatbadge stond twee keer zo ver als de eigen badges van Twitch: de uitlijning is nu identiek, ook met 7TV.",
          sv: "Chattmärket hade dubbelt så stort avstånd som Twitchs egna märken: justeringen är nu identisk, även med 7TV.",
          cs: "Odznak v chatu měl dvojnásobné odsazení oproti nativním odznakům Twitche: zarovnání je nyní shodné, i se 7TV."
        }
      },
      {
        type: "fix",
        text: {
          fr: "Après une mise à jour de l'extension, la preview au survol restait figée sur sa taille par défaut jusqu'au rechargement de la page. La carte laissée par la version précédente est désormais nettoyée automatiquement.",
          en: "After an extension update, the hover preview stayed stuck at its default size until the page was reloaded. The card left behind by the previous version is now cleaned up automatically.",
          es: "Tras una actualización de la extensión, la vista previa se quedaba en su tamaño por defecto hasta recargar la página. La tarjeta dejada por la versión anterior ahora se limpia automáticamente.",
          "pt-BR": "Após uma atualização da extensão, a pré-visualização ficava presa no tamanho padrão até recarregar a página. O cartão deixado pela versão anterior agora é removido automaticamente.",
          de: "Nach einem Update der Erweiterung blieb die Vorschau bis zum Neuladen der Seite auf der Standardgröße. Die von der Vorversion zurückgelassene Karte wird jetzt automatisch entfernt.",
          it: "Dopo un aggiornamento dell'estensione, l'anteprima restava bloccata sulla dimensione predefinita fino al ricaricamento della pagina. La scheda lasciata dalla versione precedente ora viene rimossa automaticamente.",
          pl: "Po aktualizacji rozszerzenia podgląd pozostawał w domyślnym rozmiarze aż do odświeżenia strony. Karta pozostawiona przez poprzednią wersję jest teraz usuwana automatycznie.",
          tr: "Uzantı güncellendikten sonra önizleme, sayfa yenilenene kadar varsayılan boyutunda takılı kalıyordu. Önceki sürümden kalan kart artık otomatik olarak temizleniyor.",
          ru: "После обновления расширения превью оставалось в размере по умолчанию до перезагрузки страницы. Карточка, оставшаяся от прошлой версии, теперь удаляется автоматически.",
          ja: "拡張機能の更新後、ページを再読み込みするまでプレビューが既定サイズのままでした。前バージョンが残したカードを自動的に片付けるようにしました。",
          ko: "확장 프로그램 업데이트 후 페이지를 새로 고치기 전까지 미리보기가 기본 크기로 고정됐습니다. 이전 버전이 남긴 카드를 이제 자동으로 정리합니다.",
          id: "Setelah pembaruan ekstensi, pratinjau tetap pada ukuran bawaan sampai halaman dimuat ulang. Kartu yang ditinggalkan versi sebelumnya kini dibersihkan otomatis.",
          nl: "Na een update van de extensie bleef het voorbeeld op het standaardformaat staan tot de pagina werd herladen. De kaart van de vorige versie wordt nu automatisch opgeruimd.",
          sv: "Efter en uppdatering av tillägget fastnade förhandsvisningen i standardstorleken tills sidan laddades om. Kortet som lämnats av den tidigare versionen städas nu bort automatiskt.",
          cs: "Po aktualizaci rozšíření zůstal náhled ve výchozí velikosti až do obnovení stránky. Karta zanechaná předchozí verzí se nyní automaticky odstraní."
        }
      },
      {
        type: "fix",
        text: {
          fr: "Le bouton « prédictions » ajouté en tête du tchat a été retiré : il faisait doublon avec l'interface de Twitch.",
          en: "The « predictions » button added at the top of chat has been removed: it duplicated Twitch's own interface.",
          es: "Se ha eliminado el botón de «predicciones» añadido en la cabecera del chat: duplicaba la interfaz de Twitch.",
          "pt-BR": "O botão de «previsões» adicionado no topo do chat foi removido: duplicava a interface da própria Twitch.",
          de: "Der oben im Chat eingefügte „Vorhersagen“-Button wurde entfernt: Er duplizierte Twitchs eigene Oberfläche.",
          it: "Il pulsante «predizioni» aggiunto in cima alla chat è stato rimosso: duplicava l'interfaccia di Twitch.",
          pl: "Przycisk „predykcje” dodawany na górze czatu został usunięty: dublował interfejs Twitcha.",
          tr: "Sohbetin üstüne eklenen «tahminler» düğmesi kaldırıldı: Twitch'in kendi arayüzünü tekrarlıyordu.",
          ru: "Кнопка «прогнозы» вверху чата удалена: она дублировала интерфейс самого Twitch.",
          ja: "チャット上部に追加していた「予測」ボタンを削除しました。Twitch本体のUIと重複していたためです。",
          ko: "채팅 상단에 추가되던 '예측' 버튼을 제거했습니다. 트위치 자체 인터페이스와 중복됐기 때문입니다.",
          id: "Tombol «prediksi» di bagian atas obrolan dihapus: fungsinya menduplikasi antarmuka Twitch sendiri.",
          nl: "De knop 'voorspellingen' bovenaan de chat is verwijderd: die dupliceerde de interface van Twitch zelf.",
          sv: "Knappen ”förutsägelser” högst upp i chatten har tagits bort: den dubblerade Twitchs eget gränssnitt.",
          cs: "Tlačítko „předpovědi“ přidávané nad chat bylo odstraněno: duplikovalo vlastní rozhraní Twitche."
        }
      },
      {
        type: "fix",
        text: {
          fr: "Les alertes Drop et Raid ne s'affichaient plus : leur icône ne se chargeait pas et Chrome refusait la notification entière. Elles sont de retour, et leurs textes sont traduits dans les 15 langues au lieu de rester en français.",
          en: "Drop and Raid alerts stopped appearing: their icon failed to load and Chrome rejected the whole notification. They are back, and their text is now translated into all 15 languages instead of staying in French.",
          es: "Las alertas de Drops y Raids ya no aparecían: su icono no se cargaba y Chrome rechazaba toda la notificación. Vuelven a funcionar, y sus textos están traducidos a los 15 idiomas en lugar de quedarse en francés.",
          "pt-BR": "Os alertas de Drop e Raid não apareciam mais: o ícone não carregava e o Chrome recusava a notificação inteira. Eles voltaram, e seus textos estão traduzidos nos 15 idiomas em vez de ficarem em francês.",
          de: "Drop- und Raid-Benachrichtigungen erschienen nicht mehr: Ihr Symbol lud nicht und Chrome lehnte die gesamte Benachrichtigung ab. Sie sind zurück, und ihre Texte liegen jetzt in allen 15 Sprachen vor statt nur auf Französisch.",
          it: "Gli avvisi Drop e Raid non comparivano più: la loro icona non si caricava e Chrome rifiutava l'intera notifica. Sono tornati, e i loro testi sono tradotti in tutte e 15 le lingue invece di restare in francese.",
          pl: "Powiadomienia o Dropach i Raidach przestały się pojawiać: ich ikona się nie ładowała, a Chrome odrzucał całe powiadomienie. Wróciły, a ich treść jest teraz przetłumaczona na wszystkie 15 języków zamiast pozostawać po francusku.",
          tr: "Drop ve Raid bildirimleri artık görünmüyordu: simgeleri yüklenmiyor ve Chrome bildirimin tamamını reddediyordu. Geri geldiler ve metinleri Fransızca kalmak yerine 15 dile çevrildi.",
          ru: "Уведомления о Drop и Raid перестали появляться: их значок не загружался, и Chrome отклонял уведомление целиком. Они вернулись, а их тексты переведены на все 15 языков вместо французского.",
          ja: "DropとRaidの通知が表示されなくなっていました。アイコンを読み込めず、Chromeが通知そのものを拒否していたためです。通知が復活し、本文もフランス語のままではなく15言語に翻訳されました。",
          ko: "Drop과 Raid 알림이 더 이상 표시되지 않았습니다. 아이콘을 불러오지 못해 Chrome이 알림 전체를 거부했기 때문입니다. 알림이 돌아왔고, 문구도 프랑스어 대신 15개 언어로 번역됐습니다.",
          id: "Notifikasi Drop dan Raid tidak lagi muncul: ikonnya gagal dimuat dan Chrome menolak seluruh notifikasi. Keduanya kembali berfungsi, dan teksnya kini diterjemahkan ke 15 bahasa alih-alih tetap dalam bahasa Prancis.",
          nl: "Drop- en Raid-meldingen verschenen niet meer: hun pictogram laadde niet en Chrome weigerde de hele melding. Ze zijn terug, en hun teksten zijn nu vertaald in alle 15 talen in plaats van in het Frans te blijven.",
          sv: "Aviseringar för Drops och Raids visades inte längre: ikonen laddades inte och Chrome avvisade hela aviseringen. De är tillbaka, och texterna är nu översatta till alla 15 språk i stället för att stå kvar på franska.",
          cs: "Upozornění na Dropy a Raidy se přestala zobrazovat: jejich ikona se nenačetla a Chrome odmítl celé oznámení. Jsou zpět a jejich texty jsou nyní přeložené do všech 15 jazyků místo francouzštiny."
        }
      },
      {
        type: "fix",
        text: {
          fr: "Le temps de visionnage restait sur « -- » à l'ouverture du pop-up et n'apparaissait qu'après un passage par les réglages. Il s'affiche désormais dès l'ouverture.",
          en: "Watch time stayed on « -- » when the popup opened and only showed up after a trip through the settings. It now appears as soon as the popup opens.",
          es: "El tiempo de visionado se quedaba en « -- » al abrir la ventana emergente y solo aparecía tras pasar por los ajustes. Ahora se muestra desde la apertura.",
          "pt-BR": "O tempo de exibição ficava em « -- » ao abrir o pop-up e só aparecia depois de passar pelas configurações. Agora ele aparece assim que o pop-up abre.",
          de: "Die Sehzeit blieb beim Öffnen des Pop-ups auf „--“ stehen und erschien erst nach einem Besuch der Einstellungen. Jetzt wird sie sofort beim Öffnen angezeigt.",
          it: "Il tempo di visione restava su « -- » all'apertura del pop-up e compariva solo dopo un passaggio dalle impostazioni. Ora viene mostrato fin dall'apertura.",
          pl: "Czas oglądania pozostawał na „--” po otwarciu okienka i pojawiał się dopiero po wizycie w ustawieniach. Teraz widać go od razu po otwarciu.",
          tr: "İzleme süresi, açılır pencere açıldığında « -- » olarak kalıyor ve yalnızca ayarlara girildikten sonra görünüyordu. Artık pencere açılır açılmaz görünüyor.",
          ru: "Время просмотра оставалось на « -- » при открытии всплывающего окна и появлялось только после захода в настройки. Теперь оно отображается сразу при открытии.",
          ja: "ポップアップを開いた直後の視聴時間が「--」のままで、設定画面を一度開くまで表示されませんでした。今は開いた時点で表示されます。",
          ko: "팝업을 열었을 때 시청 시간이 '--'로 남아 있었고, 설정을 한 번 열어야 표시됐습니다. 이제 팝업을 여는 즉시 표시됩니다.",
          id: "Waktu tonton tetap « -- » saat pop-up dibuka dan baru muncul setelah membuka pengaturan. Kini langsung tampil begitu pop-up dibuka.",
          nl: "De kijktijd bleef op '--' staan bij het openen van de pop-up en verscheen pas na een bezoek aan de instellingen. Nu staat hij er meteen bij het openen.",
          sv: "Visningstiden stod kvar på ”--” när popupen öppnades och dök upp först efter en tur via inställningarna. Nu visas den direkt när popupen öppnas.",
          cs: "Doba sledování zůstávala po otevření vyskakovacího okna na „--“ a objevila se až po návštěvě nastavení. Nyní se zobrazí hned po otevření."
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
          "ru": "Кнопка «Добавить в StreamPulse» теперь отображается прямо на страницах каналов Twitch, рядом с кнопкой «Подписаться». Она имеет фиолетовый цвет, если на стримера ещё не подписаны, и серый после добавления.",
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

/** Release correspondant exactement a une version, ou null. */
export function getRelease(version) {
  return RELEASES.find((entry) => entry.version === version) || null;
}
