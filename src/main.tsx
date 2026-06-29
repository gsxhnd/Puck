import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { bootstrapPersistStores } from "@/lib/bootstrap-persist-stores";

async function bootstrap() {
  await bootstrapPersistStores();

  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

void bootstrap();
