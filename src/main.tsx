import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/chewy/latin-400.css";
import "@fontsource/open-sans/latin-400.css";
import "@fontsource/open-sans/latin-600.css";
import "@fontsource/open-sans/latin-700.css";
import { App } from "./app/App";
import "./shared/design/tokens.css";
import "./app/app.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
