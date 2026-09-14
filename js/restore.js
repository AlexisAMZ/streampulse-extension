// Restore page: reads a backup file (current or legacy flat format), shows what
// it will add, and merges it into the data already stored once confirmed.
//
// It runs in a tab rather than in the popup: opening a file picker makes Chrome
// close the popup, and the chosen file was silently lost.

import { initI18n, applyTranslations, t, getCurrentLanguage, resolveLocale } from "./i18n.js";
import { BACKUP_KEYS, MAX_BACKUP_BYTES, mergeBackup, parseBackup } from "./backup.js";

const views = {
  pick: document.getElementById("restore-pick"),
  review: document.getElementById("restore-review"),
  done: document.getElementById("restore-done"),
};
const fileInput = document.getElementById("file-input");
const dropZone = document.getElementById("drop-zone");
const errorEl = document.getElementById("restore-error");
const confirmButton = document.getElementById("restore-confirm");

let pending = null;

function showView(name) {
  for (const [key, view] of Object.entries(views)) view.hidden = key !== name;
}

function showError(key) {
  errorEl.textContent = t(key);
  errorEl.hidden = false;
}

function formatDate(iso) {
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) return t("backup.restorePage.unknownDate");
  return date.toLocaleDateString(resolveLocale(getCurrentLanguage()), { day: "numeric", month: "long", year: "numeric" });
}

async function readFile(file) {
  errorEl.hidden = true;
  if (!file) return;
  if (file.size > MAX_BACKUP_BYTES) {
    showError("backup.tooLarge");
    return;
  }

  let parsed;
  try {
    parsed = parseBackup(JSON.parse(await file.text()));
  } catch {
    parsed = { ok: false, error: "not-json" };
  }
  if (!parsed.ok) {
    console.warn("[restore] backup rejected:", parsed.error);
    showError("backup.invalid");
    return;
  }

  // Preview against what is stored now: only the streamers missing here count.
  const preview = mergeBackup(await chrome.storage.local.get(BACKUP_KEYS), parsed.data);
  pending = parsed;
  document.getElementById("file-name").textContent = file.name;
  document.getElementById("sum-streamers").textContent = String(preview.addedStreamers);
  document.getElementById("sum-months").textContent = String(parsed.summary.months);
  document.getElementById("sum-date").textContent = formatDate(parsed.summary.exportedAt);
  confirmButton.disabled = false;
  showView("review");
  confirmButton.focus();
}

async function restore() {
  if (!pending) return;
  confirmButton.disabled = true;
  errorEl.hidden = true;
  try {
    // Merge, never replace: the backup adds to what is already there.
    const { data } = mergeBackup(await chrome.storage.local.get(BACKUP_KEYS), pending.data);
    await chrome.storage.local.set(data);
    // The service worker rereads the streamers and rebuilds its caches.
    chrome.runtime.sendMessage({ type: "refreshStatuses" }).catch(() => {});
    // eslint-disable-next-line require-atomic-updates -- a single confirm click owns this restore.
    pending = null;
    showView("done");
    document.getElementById("restore-close").focus();
  } catch (error) {
    console.error("[restore] write failed:", error);
    showError("backup.restorePage.failed");
    confirmButton.disabled = false;
  }
}

function resetPicker() {
  pending = null;
  fileInput.value = "";
  errorEl.hidden = true;
  showView("pick");
}

fileInput.addEventListener("change", () => {
  readFile(fileInput.files?.[0]).catch((error) => {
    console.error("[restore] read failed:", error);
    showError("backup.invalid");
  });
});

dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropZone.classList.add("is-over");
});
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("is-over"));
dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropZone.classList.remove("is-over");
  readFile(event.dataTransfer?.files?.[0]).catch((error) => {
    console.error("[restore] read failed:", error);
    showError("backup.invalid");
  });
});
// A file dropped beside the zone must not navigate the tab away.
window.addEventListener("dragover", (event) => event.preventDefault());
window.addEventListener("drop", (event) => event.preventDefault());

confirmButton.addEventListener("click", restore);
document.getElementById("restore-cancel").addEventListener("click", resetPicker);
document.getElementById("restore-close").addEventListener("click", () => window.close());

async function init() {
  await initI18n();
  applyTranslations(document);
  document.documentElement.lang = getCurrentLanguage();
}

init().catch((error) => console.error("[restore] init failed:", error));
