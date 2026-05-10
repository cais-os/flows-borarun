export const DEFAULT_AI_MODEL = "gpt-5.5";

export const AI_MODEL_OPTIONS = [
  { value: "gpt-5.5", label: "GPT-5.5" },
  { value: "gpt-5.4", label: "GPT-5.4" },
  { value: "gpt-5.4-mini", label: "GPT-5.4 Mini" },
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini" },
  { value: "gpt-4.1", label: "GPT-4.1" },
  { value: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
] as const;

export function isGpt5Model(model: string | undefined) {
  return typeof model === "string" && model.toLowerCase().startsWith("gpt-5");
}

export function getChatCompletionTokenParams(
  model: string | undefined,
  maxTokens: number
) {
  if (isGpt5Model(model)) {
    return { max_completion_tokens: maxTokens };
  }

  return { max_tokens: maxTokens };
}

export function getChatCompletionTemperatureParams(
  model: string | undefined,
  temperature: number
) {
  if (isGpt5Model(model)) {
    return {};
  }

  return { temperature };
}
