export function normalizeRunnerPhone(phone: string) {
  return (phone || "").replace(/\D/g, "");
}
