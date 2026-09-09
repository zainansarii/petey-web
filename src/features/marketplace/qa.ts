// Development-only browser harness. Production builds eliminate this module.
import type { MarketplaceRequest } from "./model";
export const qaRole = () => import.meta.env.DEV && ["localhost", "127.0.0.1"].includes(location.hostname) ? new URLSearchParams(location.search).get("pilotQa") : null;
export async function qaCall<T>(request: MarketplaceRequest): Promise<T> {
  const response = await fetch("http://127.0.0.1:5063/marketplace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: qaRole(), request }) });
  const result = await response.json();
  if (!response.ok) throw Object.assign(new Error(result.message), { code: `functions/${result.code}` });
  return result;
}
export function qaWatch<T>(request: MarketplaceRequest, select: (result: Record<string, unknown>) => T, next: (value: T) => void, error: (error: Error) => void) {
  let active = true; let previous = "";
  const read = async () => { try { const value = select(await qaCall(request)); const serialized = JSON.stringify(value); if (active && serialized !== previous) { previous = serialized; next(value); } } catch (e) { if (active) error(e as Error); } };
  void read(); const timer = window.setInterval(() => void read(), 1500);
  return () => { active = false; clearInterval(timer); };
}
