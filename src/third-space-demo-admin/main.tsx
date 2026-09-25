import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/cormorant-garamond/latin-400.css";
import "@fontsource/cormorant-garamond/latin-500.css";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-600.css";
import { AdminDashboard } from "./AdminDashboard";
import "./admin-dashboard.css";

createRoot(document.getElementById("root")!).render(<StrictMode><AdminDashboard /></StrictMode>);
