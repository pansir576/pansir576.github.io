export const RECIPE_VOICE_KEY = "simulating-cook:voice:v1";

export function loadRecipeVoiceEnabled(): boolean {
  try {
    return window.localStorage.getItem(RECIPE_VOICE_KEY) === "on";
  } catch {
    return false;
  }
}

export function saveRecipeVoiceEnabled(enabled: boolean) {
  try {
    window.localStorage.setItem(RECIPE_VOICE_KEY, enabled ? "on" : "off");
  } catch {
    // Voice remains usable when storage is unavailable.
  }
}

export function stopRecipeSpeech() {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

export function speakRecipeText(text: string) {
  if (!text.trim() || !("speechSynthesis" in window)) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-CN";
  utterance.rate = 0.95;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
  return true;
}
