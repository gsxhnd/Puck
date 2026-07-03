import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AppErrorBoundary } from "@/components/app-error-boundary";
import { AppFatalScreen } from "@/components/app-fatal-screen";
import { bootstrapPersistStores } from "@/lib/bootstrap-persist-stores";
import i18n from "@/i18n";
import "./App.css";

function formatBootstrapError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown startup error";
}

async function bootstrap() {
  try {
    await bootstrapPersistStores();
  } catch (error) {
    console.error("Bootstrap failed:", error);
    const root = document.getElementById("root");
    if (!root) return;

    ReactDOM.createRoot(root).render(
      <AppFatalScreen
        title={i18n.t("common:bootstrapFailed.title")}
        description={i18n.t("common:bootstrapFailed.description")}
        detail={formatBootstrapError(error)}
      />,
    );
    return;
  }

  const root = document.getElementById("root");
  if (!root) return;

  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </React.StrictMode>,
  );
}

bootstrap().catch((error) => {
  console.error("Bootstrap failed:", error);
});
