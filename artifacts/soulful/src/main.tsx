import { createRoot } from "react-dom/client";
import { setBaseUrl } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";

const apiUrl = import.meta.env.VITE_API_URL;
if (apiUrl) {
  setBaseUrl(apiUrl);

  // Several pages call the browser's native fetch("/api/...") directly
  // instead of going through the generated API client (which already
  // respects setBaseUrl above). Patch the global fetch once, here, so
  // every one of those relative calls is also redirected to the real
  // API server — rather than hitting this app's own origin, where no
  // such route exists.
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === "string" && input.startsWith("/api")) {
      return originalFetch(`${apiUrl}${input}`, init);
    }
    return originalFetch(input, init);
  };
} else {
  console.warn(
    "VITE_API_URL is not set — API requests will be relative to this app's own origin, which will fail if the API is on a different domain.",
  );
}

createRoot(document.getElementById("root")!).render(<App />);