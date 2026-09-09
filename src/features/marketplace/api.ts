import { getCallableApp } from "../onboarding/api/webOnboarding";
import type { InboxItem, MarketplaceRequest, Message } from "./model";

export async function marketplace<T>(request: MarketplaceRequest): Promise<T> {
  if (import.meta.env.DEV) { const qa = await import("./qa"); if (qa.qaRole()) return qa.qaCall<T>(request); }
  const [{ httpsCallable, getFunctions }, { app }] = await Promise.all([import("firebase/functions"), getCallableApp()]);
  return (await httpsCallable<MarketplaceRequest, T>(getFunctions(app as Parameters<typeof getFunctions>[0], "europe-west2"), "webMarketplaceV1")(request)).data;
}
async function database() {
  const [{ getFirestore }, { app }] = await Promise.all([import("firebase/firestore"), getCallableApp()]);
  return getFirestore(app as Parameters<typeof getFirestore>[0]);
}
export async function watchInbox(uid: string, next: (items: InboxItem[]) => void, error: (error: Error) => void) {
  if (import.meta.env.DEV) { const qa = await import("./qa"); if (qa.qaRole()) return qa.qaWatch({ action: "inbox" }, result => result.items as InboxItem[], next, error); }
  const [{ collection, query, orderBy, limit, onSnapshot }, db] = await Promise.all([import("firebase/firestore"), database()]);
  return onSnapshot(query(collection(db, "webMarketplaceUsers", uid, "inbox"), orderBy("latestAt", "desc"), limit(100)), snap => next(snap.docs.map(doc => doc.data() as InboxItem)), error);
}
export async function watchMessages(id: string, next: (messages: Message[]) => void, error: (error: Error) => void) {
  if (import.meta.env.DEV) { const qa = await import("./qa"); if (qa.qaRole()) return qa.qaWatch({ action: "messages", enquiryId: id }, result => result.messages as Message[], next, error); }
  const [{ collection, query, orderBy, limit, onSnapshot }, db] = await Promise.all([import("firebase/firestore"), database()]);
  return onSnapshot(query(collection(db, "webEnquiries", id, "messages"), orderBy("seq", "desc"), limit(50)), snap => next(snap.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Message).reverse()), error);
}
export async function watchAccess(uid: string, revoked: () => void) {
  if (import.meta.env.DEV) { const qa = await import("./qa"); if (qa.qaRole()) return qa.qaWatch({ action: "access" }, result => result, () => {}, revoked); }
  const [{ doc, onSnapshot }, db] = await Promise.all([import("firebase/firestore"), database()]);
  return onSnapshot(doc(db, "webMarketplaceUsers", uid), snap => { if (snap.data()?.active === false) revoked(); }, revoked);
}
export const errorMessage = (error: unknown) => error instanceof Error ? error.message.replace(/^Firebase:\s*/, "") : "This action could not finish. Please try again.";
export function readLocal<T>(key: string, fallback: T): T { try { return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback; } catch { return fallback; } }
export function saveLocal(key: string, value: unknown) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Forms still work without storage. */ } }
export function removeLocal(key: string) { try { localStorage.removeItem(key); } catch { /* No persistent storage. */ } }
export function filePayload(file: File): Promise<{ name: string; base64: string }> {
  if (file.size > 5 * 1024 * 1024) return Promise.reject(new Error("Choose a file smaller than 5 MB."));
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(new Error("The file could not be read.")); reader.onload = () => resolve({ name: file.name, base64: String(reader.result).split(",")[1] }); reader.readAsDataURL(file); });
}
