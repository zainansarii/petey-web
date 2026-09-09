import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/oxygen/latin-400.css";
import "@fontsource/oxygen/latin-700.css";
import "../shared/design/tokens.css";
import { TrainerDashboard } from "./TrainerDashboard";
import "./trainer-dashboard.css";

createRoot(document.getElementById("root")!).render(<StrictMode><TrainerDashboard /></StrictMode>);
