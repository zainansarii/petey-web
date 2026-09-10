import { useSyncExternalStore } from "react";

const PHONE_QUERY = "(max-width: 767px)";
const subscribe = (onChange: () => void) => {
  const query = window.matchMedia(PHONE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};
const getSnapshot = () => window.matchMedia(PHONE_QUERY).matches;
const getServerSnapshot = () => false;

export function usePhoneLayout() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
