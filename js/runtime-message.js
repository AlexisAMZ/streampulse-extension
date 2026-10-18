// Reads may return data without a success flag; mutations must check success.
export async function sendAppMessage(payload, runtime = chrome.runtime, unavailable = "unavailable") {
  try {
    const response = await runtime.sendMessage(payload);
    if (!response || typeof response !== "object") return { error: unavailable };
    return response;
  } catch (error) {
    console.warn("[StreamPulse] message failed:", payload.type, error?.message || error);
    return { error: unavailable };
  }
}
