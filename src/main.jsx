import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { ThemeProvider } from "./context/ThemeContext";
import { ToastProvider } from "./context/ToastContext";
import ToastContainer from "./components/ui/ToastContainer";
import { registerSW } from "virtual:pwa-register";

// Register Service Worker for offline capabilities
if ('serviceWorker' in navigator) {
  registerSW({
    onNeedRefresh() {
       // Optional: Prompt user to refresh for new version
       console.log("New content available, please refresh.");
    },
    onOfflineReady() {
       console.log("App is ready to work offline!");
    },
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <App />
        <ToastContainer />
      </ToastProvider>
    </ThemeProvider>
  </React.StrictMode>
);
