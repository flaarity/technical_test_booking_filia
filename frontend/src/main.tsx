import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { ClerkProvider } from "@clerk/react";

const root = createRoot(document.getElementById("root")!);
const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

root.render(
  <StrictMode>
    {publishableKey ? (
      <ClerkProvider publishableKey={publishableKey}>
        <App />
      </ClerkProvider>
    ) : (
      <main className="configuration-screen">
        <h1>Konfigurasi Clerk diperlukan</h1>
        <p>
          Isi <code>VITE_CLERK_PUBLISHABLE_KEY</code> di file environment
          frontend untuk menjalankan Book-in.
        </p>
      </main>
    )}
  </StrictMode>,
);
