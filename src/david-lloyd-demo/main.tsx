import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-600.css";
import { DavidLloydDemo } from "./DavidLloydDemo";
import "./david-lloyd.css";

createRoot(document.getElementById("root")!).render(<StrictMode><DavidLloydDemo /></StrictMode>);
