import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const locales = {
  de: {
    appName: "StreamPulse: Twitch & Kick Erweiterung",
    appDesc: "Auto-Sammeln von Kanalpunkten, Live-Warnungen, Vorschauen & Chat-Filter für Twitch & Kick."
  },
  it: {
    appName: "StreamPulse: Estensione per Twitch e Kick",
    appDesc: "Ritiro automatico dei Punti Canale, avvisi live, anteprime e filtri chat per Twitch e Kick."
  },
  pl: {
    appName: "StreamPulse: Rozszerzenie dla Twitch i Kick",
    appDesc: "Automatyczne zbieranie Punktów Kanału, alerty na żywo, podglądy i filtry czatu dla Twitch i Kick."
  },
  tr: {
    appName: "StreamPulse: Twitch ve Kick eklentisi",
    appDesc: "Twitch ve Kick için otomatik Kanal Puanı toplama, canlı bildirimler, önizlemeler ve sohbet filtreleri."
  },
  ru: {
    appName: "StreamPulse: Расширение для Twitch и Kick",
    appDesc: "Автоматический сбор Баллов канала, уведомления, превью и фильтры чата для Twitch и Kick."
  },
  ja: {
    appName: "StreamPulse: Twitch & Kick 拡張機能",
    appDesc: "TwitchとKick用の自動チャンネルポイント獲得、ライブ通知、プレビュー、チャットフィルター。"
  },
  ko: {
    appName: "StreamPulse: Twitch 및 Kick 확장 프로그램",
    appDesc: "Twitch 및 Kick용 채널 포인트 자동 획득, 라이브 알림, 미리보기 및 채팅 필터."
  },
  id: {
    appName: "StreamPulse: Ekstensi Twitch & Kick",
    appDesc: "Klaim otomatis Channel Points, peringatan live, pratinjau & filter obrolan untuk Twitch & Kick."
  },
  nl: {
    appName: "StreamPulse: Twitch & Kick extensie",
    appDesc: "Automatisch claimen van kanaalpunten, live meldingen, voorvertoningen & chatfilters voor Twitch & Kick."
  },
  sv: {
    appName: "StreamPulse: Twitch & Kick-tillägg",
    appDesc: "Automatisk insamling av kanalpoäng, livevarningar, förhandsvisningar & chattfilter för Twitch & Kick."
  },
  cs: {
    appName: "StreamPulse: Rozšíření pro Twitch a Kick",
    appDesc: "Automatické sbírání bodů, živá upozornění, náhledy a filtry chatu pro Twitch a Kick."
  }
};

async function run() {
  for (const [lang, data] of Object.entries(locales)) {
    const dir = join("../_locales", lang);
    await mkdir(dir, { recursive: true });
    const content = {
      appName: { message: data.appName },
      appDesc: { message: data.appDesc }
    };
    await writeFile(join(dir, "messages.json"), JSON.stringify(content, null, 2) + "\n");
    console.log(`Wrote _locales/${lang}/messages.json`);
  }
}

run();
