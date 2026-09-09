import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/oxygen/latin-400.css";
import "@fontsource/oxygen/latin-700.css";
import "../shared/design/tokens.css";
import "../trainer-preview/trainer-dashboard.css";
import "../features/marketplace/marketplace.css";
import { MarketplaceApp } from "../features/marketplace/MarketplaceApp";
createRoot(document.getElementById("root")!).render(<StrictMode><MarketplaceApp trainer={false} /></StrictMode>);
