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
  if (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof window.speechSynthesis.cancel === "function"
  ) {
    window.speechSynthesis.cancel();
  }
}

interface RecipeSpeechOptions {
  rate?: number;
  pitch?: number;
}

export function speakRecipeText(
  text: string,
  options: RecipeSpeechOptions = {},
) {
  if (
    !text.trim() ||
    typeof window === "undefined" ||
    !("speechSynthesis" in window) ||
    typeof window.speechSynthesis.speak !== "function" ||
    typeof SpeechSynthesisUtterance === "undefined"
  ) {
    return false;
  }
  if (typeof window.speechSynthesis.cancel === "function") {
    window.speechSynthesis.cancel();
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-CN";
  utterance.rate = options.rate ?? 0.95;
  utterance.pitch = options.pitch ?? 1;
  const voices =
    typeof window.speechSynthesis.getVoices === "function"
      ? window.speechSynthesis.getVoices()
      : [];
  const preferredVoice = voices.find((voice) =>
    /Xiaoxiao|Xiaoyi|Huihui|Ting-Ting|Meijia/i.test(voice.name),
  );
  if (preferredVoice) utterance.voice = preferredVoice;
  window.speechSynthesis.speak(utterance);
  return true;
}
