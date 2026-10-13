/**
 * Textes de la 5e capture, « Tu gardes la main » : badges suivis, réglages à
 * portée et vie privée.
 *
 * Chaque affirmation de vie privée reprend la déclaration de la fiche
 * (CHROMEWEBSTORE.md) : aucun compte, aucun traceur, et des streamers, réglages
 * et temps de visionnage qui restent sur l'appareil. On ne dit jamais « aucune
 * donnée envoyée » (le badge communautaire, désactivé par défaut, et la licence
 * StreamPulse+ contactent le serveur), ni « sans publicité » (une promotion de
 * nos autres produits pourrait en tenir lieu), ni gratuit/nouveau/n° 1
 * (policy.mjs). Le mot « badge » suit celui de l'interface de chaque langue.
 */

export const CONTROL_COPY = {
  fr: {
    title: "Tu gardes la main.",
    subtitle: "Tes badges suivis pour toi, chaque réglage à ta portée, tes données sur ton appareil.",
    columns: [
      { title: "Tes badges, suivis pour toi", body: "Ceux en cours, ceux à venir et ceux obtenus, au même endroit." },
      { title: "Chaque réglage à ta portée", body: "Live, catégorie, titre, son et heures calmes : c'est toi qui choisis." },
      { title: "Ta vie privée d'abord", body: "Streamers, réglages et temps de visionnage restent sur ton appareil.", points: ["Aucun compte", "Aucun traceur", "Données sur ton appareil"] },
    ],
  },
  en: {
    title: "You stay in control.",
    subtitle: "Your badges tracked for you, every setting within reach, your data on your device.",
    columns: [
      { title: "Your badges, tracked for you", body: "In progress, upcoming and earned, all in one place." },
      { title: "Every setting within reach", body: "Live, category, title, sound and quiet hours: you decide." },
      { title: "Privacy comes first", body: "Streamers, settings and watch time stay on your device.", points: ["No account", "No trackers", "Data on your device"] },
    ],
  },
  es: {
    title: "Tú tienes el control.",
    subtitle: "Tus insignias al día, cada ajuste a tu alcance, tus datos en tu dispositivo.",
    columns: [
      { title: "Tus insignias, siempre al día", body: "Las que están en curso, las próximas y las conseguidas, en un solo lugar." },
      { title: "Cada ajuste a tu alcance", body: "Directo, categoría, título, sonido y horas de silencio: tú decides." },
      { title: "Tu privacidad, primero", body: "Streamers, ajustes y tiempo de visualización se quedan en tu dispositivo.", points: ["Sin cuenta", "Sin rastreadores", "Datos en tu dispositivo"] },
    ],
  },
  "pt-BR": {
    title: "Você no controle.",
    subtitle: "Seus emblemas em dia, cada ajuste ao seu alcance, seus dados no seu dispositivo.",
    columns: [
      { title: "Seus emblemas, sempre em dia", body: "Os em andamento, os próximos e os conquistados, num só lugar." },
      { title: "Cada ajuste ao seu alcance", body: "Live, categoria, título, som e horas de silêncio: você decide." },
      { title: "Sua privacidade em primeiro lugar", body: "Streamers, configurações e tempo assistido ficam no seu dispositivo.", points: ["Sem conta", "Sem rastreadores", "Dados no seu dispositivo"] },
    ],
  },
  de: {
    title: "Du behältst die Kontrolle.",
    subtitle: "Deine Abzeichen im Blick, jede Einstellung in Reichweite, deine Daten auf deinem Gerät.",
    columns: [
      { title: "Deine Abzeichen, im Blick", body: "Laufende, kommende und erhaltene Abzeichen an einem Ort." },
      { title: "Jede Einstellung in Reichweite", body: "Live, Kategorie, Titel, Ton und Ruhezeiten: du entscheidest." },
      { title: "Datenschutz zuerst", body: "Streamer, Einstellungen und Sehdauer bleiben auf deinem Gerät.", points: ["Kein Konto", "Keine Tracker", "Daten auf deinem Gerät"] },
    ],
  },
  it: {
    title: "Il controllo è tuo.",
    subtitle: "I tuoi badge sempre aggiornati, ogni impostazione a portata di mano, i tuoi dati sul tuo dispositivo.",
    columns: [
      { title: "I tuoi badge, sempre aggiornati", body: "In corso, in arrivo e ottenuti, in un unico posto." },
      { title: "Ogni impostazione a portata di mano", body: "Diretta, categoria, titolo, suono e ore di silenzio: decidi tu." },
      { title: "Prima di tutto la tua privacy", body: "Streamer, impostazioni e tempo di visione restano sul tuo dispositivo.", points: ["Nessun account", "Nessun tracker", "Dati sul tuo dispositivo"] },
    ],
  },
  pl: {
    title: "To ty masz kontrolę.",
    subtitle: "Twoje odznaki pod okiem, każde ustawienie pod ręką, twoje dane na twoim urządzeniu.",
    columns: [
      { title: "Twoje odznaki, zawsze na bieżąco", body: "W toku, nadchodzące i zdobyte, w jednym miejscu." },
      { title: "Każde ustawienie pod ręką", body: "Transmisja, kategoria, tytuł, dźwięk i godziny ciszy: ty decydujesz." },
      { title: "Prywatność przede wszystkim", body: "Streamerzy, ustawienia i czas oglądania zostają na twoim urządzeniu.", points: ["Bez konta", "Bez trackerów", "Dane na twoim urządzeniu"] },
    ],
  },
  tr: {
    title: "Kontrol sende.",
    subtitle: "Rozetlerin takipte, her ayar elinin altında, verilerin cihazında.",
    columns: [
      { title: "Rozetlerin, senin için takipte", body: "Süren, yaklaşan ve kazanılan rozetler tek bir yerde." },
      { title: "Her ayar elinin altında", body: "Canlı yayın, kategori, başlık, ses ve sessiz saatler: karar senin." },
      { title: "Önce gizliliğin", body: "Yayıncılar, ayarlar ve izleme süresi cihazında kalır.", points: ["Hesap yok", "İzleyici yok", "Veriler cihazında"] },
    ],
  },
  ru: {
    title: "Всё под твоим контролем.",
    subtitle: "Твои значки под присмотром, каждая настройка под рукой, данные на твоём устройстве.",
    columns: [
      { title: "Твои значки под присмотром", body: "Текущие, предстоящие и полученные значки в одном месте." },
      { title: "Каждая настройка под рукой", body: "Эфир, категория, название, звук и тихие часы: решаешь ты." },
      { title: "Приватность прежде всего", body: "Стримеры, настройки и время просмотра остаются на твоём устройстве.", points: ["Без аккаунта", "Без трекеров", "Данные на твоём устройстве"] },
    ],
  },
  ja: {
    title: "主導権は、あなたに。",
    subtitle: "バッジはおまかせ、設定はすべて手元で、データは端末の中に。",
    columns: [
      { title: "バッジを自動で見守る", body: "進行中・開始予定・獲得済みのバッジを一か所で確認できます。" },
      { title: "すべての設定が手元に", body: "ライブ、カテゴリ、タイトル、通知音、サイレント時間を自分で選べます。" },
      { title: "プライバシーを最優先", body: "配信者リスト、設定、視聴時間は端末の中にとどまります。", points: ["アカウント不要", "トラッカーなし", "データは端末内"] },
    ],
  },
  ko: {
    title: "주도권은 당신에게.",
    subtitle: "배지는 알아서 챙기고, 모든 설정은 손끝에, 데이터는 기기에.",
    columns: [
      { title: "배지를 대신 챙겨 드립니다", body: "진행 중, 예정, 획득한 배지를 한곳에서 확인합니다." },
      { title: "모든 설정이 손 닿는 곳에", body: "라이브, 카테고리, 제목, 알림음, 방해 금지 시간을 직접 정합니다." },
      { title: "개인정보가 먼저입니다", body: "스트리머 목록, 설정, 시청 시간은 기기에만 남습니다.", points: ["계정 불필요", "추적기 없음", "데이터는 기기 안에"] },
    ],
  },
};
