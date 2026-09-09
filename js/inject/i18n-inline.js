/**
 * FICHIER GÉNÉRÉ : NE PAS ÉDITER À LA MAIN.
 * Source : i18n/translations.js (clés "inject.*")
 * Régénérer : node scripts/build-inline-i18n.mjs
 *
 * Expose window.__SP_I18N__ pour les content scripts, qui sont injectés comme
 * scripts classiques et ne peuvent pas importer de module ES.
 */
(function () {
  "use strict";
  if (typeof window === "undefined") return;
  // Déclaré dans plusieurs entrées content_scripts (l'ordre entre entrées n'est
  // pas garanti par Chrome, chacune doit donc pouvoir le charger). On sort tôt
  // si une autre entrée l'a déjà installé.
  if (window.__SP_I18N__) return;

  var STRINGS = {
  "fr": {
    "topbar": {
      "previews": "Previews au survol",
      "thisChannel": "Cette chaîne",
      "badgeColor": "Couleur du badge",
      "badgeAuthor": "Pseudo",
      "badgeTheme": "Thème",
      "badgeCustom": "Perso",
      "liveNow": "En direct",
      "noneLive": "Personne en direct",
      "watchedHere": "Regardé ici",
      "follow": "Suivre",
      "followed": "Suivi",
      "autoClaim": "Points automatiques",
      "fastForward": "Avance rapide",
      "more": "+{{count}} autres",
      "tip": "Offrir un Bubble Tea",
      "settings": "Tous les réglages"
    },
    "quickFollow": {
      "add": "Ajouter à StreamPulse",
      "tracked": "Suivi",
      "remove": "Retirer de StreamPulse",
      "added": "{{name}} ajouté à StreamPulse",
      "removed": "{{name}} retiré de StreamPulse",
      "error": "Action impossible. Réessayez."
    },
    "player": {
      "skipToLive": "Rattraper le direct",
      "holdToFastForward": "Maintenir pour avance x2",
      "latencyEmpty": "Latence : --",
      "latencyValue": "Latence : {{value}}s",
      "offline": "HORS LIGNE"
    },
    "chatFilter": {
      "replacement": "Message supprimé par StreamPulse"
    }
  },
  "en": {
    "topbar": {
      "previews": "Hover previews",
      "thisChannel": "This channel",
      "badgeColor": "Badge colour",
      "badgeAuthor": "Username",
      "badgeTheme": "Theme",
      "badgeCustom": "Custom",
      "liveNow": "Live now",
      "noneLive": "Nobody live right now",
      "watchedHere": "Watched here",
      "follow": "Follow",
      "followed": "Followed",
      "autoClaim": "Auto channel points",
      "fastForward": "Fast forward",
      "more": "+{{count}} more",
      "tip": "Offer a Bubble Tea",
      "settings": "All settings"
    },
    "quickFollow": {
      "add": "Add to StreamPulse",
      "tracked": "Tracked",
      "remove": "Remove from StreamPulse",
      "added": "{{name}} added to StreamPulse",
      "removed": "{{name}} removed from StreamPulse",
      "error": "Action failed. Try again."
    },
    "player": {
      "skipToLive": "Skip to live",
      "holdToFastForward": "Hold to fast-forward x2",
      "latencyEmpty": "Latency: --",
      "latencyValue": "Latency: {{value}}s",
      "offline": "OFFLINE"
    },
    "chatFilter": {
      "replacement": "Message removed by StreamPulse"
    }
  },
  "es": {
    "topbar": {
      "previews": "Vistas previas",
      "thisChannel": "Este canal",
      "badgeColor": "Color de la insignia",
      "badgeAuthor": "Nombre",
      "badgeTheme": "Tema",
      "badgeCustom": "Personal.",
      "liveNow": "En directo",
      "noneLive": "Nadie en directo",
      "watchedHere": "Visto aquí",
      "follow": "Seguir",
      "followed": "Seguido",
      "autoClaim": "Puntos automáticos",
      "fastForward": "Avance rápido",
      "more": "+{{count}} más",
      "tip": "Invitar a un Bubble Tea",
      "settings": "Ajustes"
    },
    "quickFollow": {
      "add": "Añadir a StreamPulse",
      "tracked": "Siguiendo",
      "remove": "Quitar de StreamPulse",
      "added": "{{name}} añadido a StreamPulse",
      "removed": "{{name}} eliminado de StreamPulse",
      "error": "Acción fallida. Inténtalo de nuevo."
    },
    "player": {
      "skipToLive": "Volver al directo",
      "holdToFastForward": "Mantén pulsado para avanzar x2",
      "latencyEmpty": "Latencia: --",
      "latencyValue": "Latencia: {{value}}s",
      "offline": "DESCONECTADO"
    },
    "chatFilter": {
      "replacement": "Mensaje eliminado por StreamPulse"
    }
  },
  "pt-BR": {
    "topbar": {
      "previews": "Prévias ao passar",
      "thisChannel": "Este canal",
      "badgeColor": "Cor do distintivo",
      "badgeAuthor": "Nome",
      "badgeTheme": "Tema",
      "badgeCustom": "Custom",
      "liveNow": "Ao vivo",
      "noneLive": "Ninguém ao vivo",
      "watchedHere": "Assistido aqui",
      "follow": "Seguir",
      "followed": "Seguindo",
      "autoClaim": "Pontos automáticos",
      "fastForward": "Avanço rápido",
      "more": "+{{count}} outros",
      "tip": "Pagar um Bubble Tea",
      "settings": "Configurações"
    },
    "quickFollow": {
      "add": "Adicionar ao StreamPulse",
      "tracked": "Seguindo",
      "remove": "Remover do StreamPulse",
      "added": "{{name}} adicionado ao StreamPulse",
      "removed": "{{name}} removido do StreamPulse",
      "error": "Falha na ação. Tente novamente."
    },
    "player": {
      "skipToLive": "Voltar ao ao vivo",
      "holdToFastForward": "Segure para avançar x2",
      "latencyEmpty": "Latência: --",
      "latencyValue": "Latência: {{value}}s",
      "offline": "OFFLINE"
    },
    "chatFilter": {
      "replacement": "Mensagem removida pelo StreamPulse"
    }
  },
  "de": {
    "topbar": {
      "previews": "Hover-Vorschau",
      "thisChannel": "Dieser Kanal",
      "badgeColor": "Farbe des Abzeichens",
      "badgeAuthor": "Name",
      "badgeTheme": "Theme",
      "badgeCustom": "Eigene",
      "liveNow": "Jetzt live",
      "noneLive": "Niemand ist live",
      "watchedHere": "Hier geschaut",
      "follow": "Folgen",
      "followed": "Verfolgt",
      "autoClaim": "Automatische Punkte",
      "fastForward": "Schnellvorlauf",
      "more": "+{{count}} weitere",
      "tip": "Bieten Sie einen Bubble Tea an",
      "settings": "Alle Einstellungen"
    },
    "quickFollow": {
      "add": "Zu StreamPulse hinzufügen",
      "tracked": "Verfolgt",
      "remove": "Aus StreamPulse entfernen",
      "added": "{{name}} zu StreamPulse hinzugefügt",
      "removed": "{{name}} aus StreamPulse entfernt",
      "error": "Aktion fehlgeschlagen. Versuchen Sie es erneut."
    },
    "player": {
      "skipToLive": "Weiter zum Leben",
      "holdToFastForward": "Halten Sie die Taste gedrückt, um x2",
      "latencyEmpty": "vorzuspulen Latenz: --",
      "latencyValue": "Latenz: {{value}}s",
      "offline": "OFFLINE"
    },
    "chatFilter": {
      "replacement": "Nachricht von StreamPulse entfernt"
    }
  },
  "it": {
    "topbar": {
      "previews": "Anteprime al passaggio del mouse",
      "thisChannel": "Questo canale",
      "badgeColor": "Colore del badge",
      "badgeAuthor": "Nome",
      "badgeTheme": "Tema",
      "badgeCustom": "Custom",
      "liveNow": "Ora in diretta",
      "noneLive": "Nessuno in diretta",
      "watchedHere": "Guardato qui",
      "follow": "Segui",
      "followed": "Seguito",
      "autoClaim": "Punti automatici",
      "fastForward": "Avanzamento rapido",
      "more": "+{{count}} altri",
      "tip": "Offri un Bubble Tea",
      "settings": "Tutte le impostazioni"
    },
    "quickFollow": {
      "add": "Aggiungi a StreamPulse",
      "tracked": "Tracciato",
      "remove": "Rimuovi da StreamPulse",
      "added": "{{nome}} aggiunto a StreamPulse",
      "removed": "{{nome}} rimosso da StreamPulse",
      "error": "Azione fallita. Riprova."
    },
    "player": {
      "skipToLive": "Passa alla diretta",
      "holdToFastForward": "Tieni premuto per avanzare velocemente x2",
      "latencyEmpty": "Latenza: --",
      "latencyValue": "Latenza: {{value}}s",
      "offline": "NON IN LINEA"
    },
    "chatFilter": {
      "replacement": "Messaggio rimosso da StreamPulse"
    }
  },
  "pl": {
    "topbar": {
      "previews": "Najedź kursorem na podglądy",
      "thisChannel": "Ten kanał",
      "badgeColor": "Kolor odznaki",
      "badgeAuthor": "Pseudonim",
      "badgeTheme": "Motyw",
      "badgeCustom": "Własny",
      "liveNow": "Na żywo",
      "noneLive": "Nikt nie nadaje",
      "watchedHere": "Oglądane tutaj",
      "follow": "Obserwuj",
      "followed": "Obserwowany",
      "autoClaim": "Automatyczne punkty",
      "fastForward": "Przewijanie",
      "more": "+{{count}} więcej",
      "tip": "Zaoferuj herbatę bąbelkową",
      "settings": "Wszystkie ustawienia"
    },
    "quickFollow": {
      "add": "Dodaj do StreamPulse",
      "tracked": "Śledzone",
      "remove": "Usuń ze StreamPulse",
      "added": "{{name}} dodano do StreamPulse",
      "removed": "{{name}} usunięty ze StreamPulse",
      "error": "Akcja nie powiodła się. Spróbuj ponownie."
    },
    "player": {
      "skipToLive": "Przejdź do transmisji na żywo",
      "holdToFastForward": "Przytrzymaj, aby przewinąć do przodu x2",
      "latencyEmpty": "Opóźnienie: --",
      "latencyValue": "Opóźnienie: {{value}} s",
      "offline": "OFFLINE"
    },
    "chatFilter": {
      "replacement": "Wiadomość usunięta przez StreamPulse"
    }
  },
  "tr": {
    "topbar": {
      "previews": "Fareyle üzerine gelindiğinde görünen önizlemeler",
      "thisChannel": "Bu kanal",
      "badgeColor": "Rozet rengi",
      "badgeAuthor": "Kullanıcı adı",
      "badgeTheme": "Tema",
      "badgeCustom": "Özel",
      "liveNow": "Şu anda yayında",
      "noneLive": "Kimse yayında değil",
      "watchedHere": "Burada izlenen",
      "follow": "Takip et",
      "followed": "Takip ediliyor",
      "autoClaim": "Otomatik puanlar",
      "fastForward": "Hızlı ileri",
      "more": "+{{count}} daha",
      "tip": "Bir Bubble Tea ikram edin",
      "settings": "Tüm ayarlar"
    },
    "quickFollow": {
      "add": "StreamPulse'a ekle",
      "tracked": "Takip Edilen",
      "remove": "StreamPulse'tan kaldır",
      "added": "{{name}}, StreamPulse'a eklendi",
      "removed": "{{name}}, StreamPulse'tan kaldırıldı",
      "error": "İşlem başarısız oldu. Lütfen tekrar deneyin."
    },
    "player": {
      "skipToLive": "Canlı yayına atla",
      "holdToFastForward": "Hızlı ileri sarma için basılı tutun x2",
      "latencyEmpty": "Gecikme: --",
      "latencyValue": "Gecikme süresi: {{value}} saniye",
      "offline": "ÇEVRİMDIŞI"
    },
    "chatFilter": {
      "replacement": "Mesaj, StreamPulse tarafından kaldırıldı"
    }
  },
  "ru": {
    "topbar": {
      "previews": "Предварительный просмотр при наведении курсора",
      "thisChannel": "Этот канал",
      "badgeColor": "Цвет значка",
      "badgeAuthor": "Ник",
      "badgeTheme": "Тема",
      "badgeCustom": "Свой",
      "liveNow": "В эфире",
      "noneLive": "Никого нет в эфире",
      "watchedHere": "Просмотрено здесь",
      "follow": "Отслеживать",
      "followed": "Отслеживается",
      "autoClaim": "Автоочки канала",
      "fastForward": "Перемотка",
      "more": "+{{count}} ещё",
      "tip": "Предложите чай с пузырьками",
      "settings": "Все настройки"
    },
    "quickFollow": {
      "add": "Добавить в StreamPulse",
      "tracked": "Отслеживается",
      "remove": "Удалить из StreamPulse",
      "added": "{{name}} добавлен в StreamPulse",
      "removed": "{{name}} удален из StreamPulse",
      "error": "Операция не удалась. Попробуйте ещё раз."
    },
    "player": {
      "skipToLive": "Перейти к трансляции",
      "holdToFastForward": "Удерживайте для ускоренного просмотра в 2 раза",
      "latencyEmpty": "Задержка: --",
      "latencyValue": "Задержка: {{value}} с",
      "offline": "ОФЛАЙН"
    },
    "chatFilter": {
      "replacement": "Сообщение удалено StreamPulse"
    }
  },
  "ja": {
    "topbar": {
      "previews": "ホバー時のプレビュー",
      "thisChannel": "このチャンネル",
      "badgeColor": "バッジの色",
      "badgeAuthor": "ユーザー名",
      "badgeTheme": "テーマ",
      "badgeCustom": "カスタム",
      "liveNow": "配信中",
      "noneLive": "配信中の人はいません",
      "watchedHere": "ここでの視聴",
      "follow": "フォロー",
      "followed": "フォロー中",
      "autoClaim": "ポイント自動取得",
      "fastForward": "早送り",
      "more": "他 {{count}} 件",
      "tip": "バブルティーを振る舞う",
      "settings": "すべての設定"
    },
    "quickFollow": {
      "add": "StreamPulseに追加",
      "tracked": "追跡済み",
      "remove": "StreamPulseから削除する",
      "added": "{{name}} が StreamPulse に追加されました",
      "removed": "{{name}} が StreamPulse から削除されました",
      "error": "操作に失敗しました。もう一度お試しください。"
    },
    "player": {
      "skipToLive": "ライブへスキップ",
      "holdToFastForward": "長押しで早送り（2倍速）",
      "latencyEmpty": "レイテンシー：--",
      "latencyValue": "遅延：{{value}}秒",
      "offline": "オフライン"
    },
    "chatFilter": {
      "replacement": "StreamPulse によりメッセージが削除されました"
    }
  },
  "ko": {
    "topbar": {
      "previews": "마우스 오버 시 미리보기",
      "thisChannel": "이 채널",
      "badgeColor": "배지 색상",
      "badgeAuthor": "사용자 이름",
      "badgeTheme": "테마",
      "badgeCustom": "사용자 지정",
      "liveNow": "방송 중",
      "noneLive": "방송 중인 사람이 없습니다",
      "watchedHere": "여기서 시청",
      "follow": "팔로우",
      "followed": "팔로우 중",
      "autoClaim": "자동 채널 포인트",
      "fastForward": "빨리 감기",
      "more": "외 {{count}}명",
      "tip": "버블티 한 잔 대접하기",
      "settings": "모든 설정"
    },
    "quickFollow": {
      "add": "StreamPulse에 추가하기",
      "tracked": "추적됨",
      "remove": "StreamPulse에서 제거",
      "added": "{{name}}이(가) StreamPulse에 추가되었습니다.",
      "removed": "{{name}}이(가) StreamPulse에서 삭제되었습니다.",
      "error": "작업이 실패했습니다. 다시 시도해 주세요."
    },
    "player": {
      "skipToLive": "라이브로 건너뛰기",
      "holdToFastForward": "길게 누르면 2배속으로 빨리 감기",
      "latencyEmpty": "지연 시간: --",
      "latencyValue": "지연 시간: {{value}}초",
      "offline": "오프라인"
    },
    "chatFilter": {
      "replacement": "StreamPulse에 의해 메시지가 삭제되었습니다."
    }
  },
  "id": {
    "topbar": {
      "previews": "Pratinjau saat mengarahkan kursor",
      "thisChannel": "Kanal ini",
      "badgeColor": "Warna lencana",
      "badgeAuthor": "Nama",
      "badgeTheme": "Tema",
      "badgeCustom": "Khusus",
      "liveNow": "Sedang live",
      "noneLive": "Tidak ada yang live",
      "watchedHere": "Ditonton di sini",
      "follow": "Ikuti",
      "followed": "Diikuti",
      "autoClaim": "Poin otomatis",
      "fastForward": "Maju cepat",
      "more": "+{{count}} lainnya",
      "tip": "Menawarkan Bubble Tea",
      "settings": "Semua pengaturan"
    },
    "quickFollow": {
      "add": "Tambahkan ke StreamPulse",
      "tracked": "Dilacak",
      "remove": "Hapus dari StreamPulse",
      "added": "{{name}} telah ditambahkan ke StreamPulse",
      "removed": "{{name}} telah dihapus dari StreamPulse",
      "error": "Tindakan gagal. Coba lagi."
    },
    "player": {
      "skipToLive": "Lompat ke siaran langsung",
      "holdToFastForward": "Tahan tombol untuk memajukan cepat x2",
      "latencyEmpty": "Latensi: --",
      "latencyValue": "Latensi: {{value}} detik",
      "offline": "OFFLINE"
    },
    "chatFilter": {
      "replacement": "Pesan dihapus oleh StreamPulse"
    }
  },
  "nl": {
    "topbar": {
      "previews": "Voorbeelden bij aanwijzen",
      "thisChannel": "Dit kanaal",
      "badgeColor": "Kleur van de badge",
      "badgeAuthor": "Naam",
      "badgeTheme": "Thema",
      "badgeCustom": "Eigen",
      "liveNow": "Nu live",
      "noneLive": "Niemand is live",
      "watchedHere": "Hier gekeken",
      "follow": "Volgen",
      "followed": "Gevolgd",
      "autoClaim": "Automatische punten",
      "fastForward": "Snel vooruit",
      "more": "+{{count}} meer",
      "tip": "Bied een bubble tea aan",
      "settings": "Alle instellingen"
    },
    "quickFollow": {
      "add": "Toevoegen aan StreamPulse",
      "tracked": "Gevolgd",
      "remove": "Uit StreamPulse verwijderen",
      "added": "{{name}} is toegevoegd aan StreamPulse",
      "removed": "{{name}} is verwijderd uit StreamPulse",
      "error": "De actie is mislukt. Probeer het nog eens."
    },
    "player": {
      "skipToLive": "Ga naar live",
      "holdToFastForward": "Houd ingedrukt om 2x sneller vooruit te spoelen",
      "latencyEmpty": "Vertraging: --",
      "latencyValue": "Vertraging: {{value}}s",
      "offline": "OFFLINE"
    },
    "chatFilter": {
      "replacement": "Bericht verwijderd door StreamPulse"
    }
  },
  "hi": {
    "topbar": {
      "previews": "Hover previews",
      "thisChannel": "यह चैनल",
      "badgeColor": "बैज का रंग",
      "badgeAuthor": "नाम",
      "badgeTheme": "थीम",
      "badgeCustom": "कस्टम",
      "liveNow": "अभी लाइव",
      "noneLive": "कोई लाइव नहीं",
      "watchedHere": "यहाँ देखा गया",
      "follow": "फ़ॉलो करें",
      "followed": "फ़ॉलो किया",
      "autoClaim": "स्वतः चैनल पॉइंट",
      "fastForward": "फास्ट फॉरवर्ड",
      "more": "+{{count}} और",
      "tip": "Offer a Bubble Tea",
      "settings": "All settings"
    },
    "quickFollow": {
      "add": "Add to StreamPulse",
      "tracked": "Tracked",
      "remove": "Remove from StreamPulse",
      "added": "{{name}} added to StreamPulse",
      "removed": "{{name}} removed from StreamPulse",
      "error": "Action failed. Try again."
    },
    "player": {
      "skipToLive": "Skip to live",
      "holdToFastForward": "Hold to fast-forward x2",
      "latencyEmpty": "Latency: --",
      "latencyValue": "Latency: {{value}}s",
      "offline": "OFFLINE"
    },
    "chatFilter": {
      "replacement": "Message removed by StreamPulse"
    }
  },
  "sv": {
    "topbar": {
      "previews": "Förhandsvisning vid muspekning",
      "thisChannel": "Den här kanalen",
      "badgeColor": "Märkets färg",
      "badgeAuthor": "Namn",
      "badgeTheme": "Tema",
      "badgeCustom": "Egen",
      "liveNow": "Sänder nu",
      "noneLive": "Ingen sänder nu",
      "watchedHere": "Tittat här",
      "follow": "Följ",
      "followed": "Följd",
      "autoClaim": "Automatiska poäng",
      "fastForward": "Snabbspolning",
      "more": "+{{count}} till",
      "tip": "Bjud på ett bubbelte",
      "settings": "Alla inställningar"
    },
    "quickFollow": {
      "add": "Lägg till i StreamPulse",
      "tracked": "Spårad",
      "remove": "Ta bort från StreamPulse",
      "added": "{{name}} har lagts till i StreamPulse",
      "removed": "{{name}} har tagits bort från StreamPulse",
      "error": "Åtgärden misslyckades. Försök igen."
    },
    "player": {
      "skipToLive": "Gå till live",
      "holdToFastForward": "Håll ned för att spola fram x2",
      "latencyEmpty": "Fördröjning: --",
      "latencyValue": "Fördröjning: {{value}} sekunder",
      "offline": "OFFLINE"
    },
    "chatFilter": {
      "replacement": "Meddelandet har tagits bort av StreamPulse"
    }
  },
  "cs": {
    "topbar": {
      "previews": "Náhledy při najetí myší",
      "thisChannel": "Tento kanál",
      "badgeColor": "Barva odznaku",
      "badgeAuthor": "Jméno",
      "badgeTheme": "Motiv",
      "badgeCustom": "Vlastní",
      "liveNow": "Právě živě",
      "noneLive": "Nikdo nevysílá",
      "watchedHere": "Sledováno zde",
      "follow": "Sledovat",
      "followed": "Sledováno",
      "autoClaim": "Automatické body",
      "fastForward": "Rychlé přetáčení",
      "more": "+{{count}} dalších",
      "tip": "Nabídněte bubble tea",
      "settings": "Všechna nastavení"
    },
    "quickFollow": {
      "add": "Přidat do StreamPulse",
      "tracked": "Sledováno",
      "remove": "Odstranit ze StreamPulse",
      "added": "{{name}} byl přidán do StreamPulse",
      "removed": "{{name}} byl odstraněn ze StreamPulse",
      "error": "Akce se nezdařila. Zkuste to znovu."
    },
    "player": {
      "skipToLive": "Přejít na živé vysílání",
      "holdToFastForward": "Podržte pro dvojnásobné zrychlení přehrávání",
      "latencyEmpty": "Zpoždění: --",
      "latencyValue": "Zpoždění: {{value}} s",
      "offline": "OFFLINE"
    },
    "chatFilter": {
      "replacement": "Zpráva byla odstraněna službou StreamPulse"
    }
  }
};
  var DEFAULT_LANG = "en";

  /**
   * Résout une préférence stockée ("pt_BR", "EN", "de-DE") vers une langue
   * disponible. Exact d'abord, puis sous-étiquette de base.
   */
  function resolve(value) {
    if (typeof value !== "string" || !value.trim()) return DEFAULT_LANG;
    var raw = value.trim().replace(/_/g, "-").toLowerCase();
    var codes = Object.keys(STRINGS);
    for (var i = 0; i < codes.length; i++) {
      if (codes[i].toLowerCase() === raw) return codes[i];
    }
    var base = raw.split("-")[0];
    for (var j = 0; j < codes.length; j++) {
      if (codes[j].toLowerCase() === base) return codes[j];
      if (codes[j].toLowerCase().split("-")[0] === base) return codes[j];
    }
    return DEFAULT_LANG;
  }

  /** Lit une clé "a.b.c", avec repli sur l'anglais puis sur la clé brute. */
  function get(lang, key, params) {
    var value = dig(STRINGS[lang], key);
    if (value == null) value = dig(STRINGS[DEFAULT_LANG], key);
    if (typeof value !== "string") return key;
    if (params) {
      value = value.replace(/{{\s*([^}\s]+)\s*}}/g, function (match, name) {
        return Object.prototype.hasOwnProperty.call(params, name) ? params[name] : match;
      });
    }
    return value;
  }

  function dig(root, key) {
    if (!root) return null;
    var parts = String(key).split(".");
    var node = root;
    for (var i = 0; i < parts.length; i++) {
      if (node == null || typeof node !== "object") return null;
      node = node[parts[i]];
    }
    return node;
  }

  window.__SP_I18N__ = {
    resolve: resolve,
    get: get,
    languages: Object.keys(STRINGS),
    defaultLanguage: DEFAULT_LANG,
  };
})();
