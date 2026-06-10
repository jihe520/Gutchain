import React from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import "./style.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Gutchain options root element was not found.");
}

createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
