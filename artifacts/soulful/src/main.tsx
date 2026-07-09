import { createRoot } from "react-dom/client";
import { setBaseUrl } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";

const apiUrl = import.meta.env.VITE_API_URL;
if (apiUrl) {
  setBaseUrl(apiUrl);
} else {
  console.warn(
    "VITE_API_URL is not set — API requests will be relative to this app's own origin, which will fail if the API is on a different domain.",
  );
}

createRoot(document.getElementById("root")!).render(<App />);