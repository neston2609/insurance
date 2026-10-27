import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/prompt/400.css";
import "@fontsource/prompt/500.css";
import "@fontsource/prompt/600.css";
import "@fontsource/prompt/700.css";
import { PublicSite } from "./PublicSite";
import "./styles.css";
import "./app.css";
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PublicSite />
  </React.StrictMode>,
);
