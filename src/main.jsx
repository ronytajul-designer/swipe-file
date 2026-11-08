import React from "react";
import { createRoot } from "react-dom/client";
import { MotionConfig } from "motion/react";
import "lenis/dist/lenis.css";
import "./styles.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </React.StrictMode>
);
