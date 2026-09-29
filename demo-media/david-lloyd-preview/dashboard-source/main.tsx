import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-600.css";
import { AdminDashboard } from "./AdminDashboard";
import "./admin-dashboard.css";
import "./capture.css";
const capture = location.pathname.includes("trainers") ? "trainers" : location.pathname.includes("emma") ? "emma" : "overview";
document.documentElement.dataset.capture = location.pathname.includes("emma-bottom") ? "emma-bottom" : capture;

createRoot(document.getElementById("root")!).render(<StrictMode><AdminDashboard capture={capture} /></StrictMode>);
