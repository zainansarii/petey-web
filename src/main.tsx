import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/oxygen/latin-400.css";
import "@fontsource/oxygen/latin-700.css";
import { App } from "./app/App";
import "./shared/design/tokens.css";
import "./app/app.css";
import "./shared/design/typography.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
