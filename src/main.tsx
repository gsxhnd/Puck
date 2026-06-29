import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { initPuckConfigStorage } from "@/lib/puck-config-storage";

async function bootstrap() {
  await initPuckConfigStorage();

  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

void bootstrap();
