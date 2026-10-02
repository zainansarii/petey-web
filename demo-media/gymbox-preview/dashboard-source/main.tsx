import { StrictMode } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-600.css";
import { AdminDashboard } from "./AdminDashboard";
import "./admin-dashboard.css";
import "./capture.css";
const route = (window as Window & { GYMBOX_CAPTURE?: string }).GYMBOX_CAPTURE || location.pathname;
const capture = route.includes("trainers") ? "trainers" : route.includes("emma") ? "emma" : "overview";
document.documentElement.dataset.capture = route.includes("emma-bottom") ? "emma-bottom" : capture;

flushSync(() => createRoot(document.getElementById("root")!).render(<StrictMode><AdminDashboard capture={capture} /></StrictMode>));
