/**
 * Front-end entry point that boots the React application.
 *
 * 前端入口。在挂载 React 之前先完成配置存储的预加载（从 `config.toml` 读取
 * 各区段并迁移旧数据），确保首屏渲染时 Zustand 的同步持久化读取已有数据，
 * 避免出现"先默认值、后跳变"的闪烁。
 */
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { initPuckConfigStorage } from "@/lib/puck-config-storage";

// 先等待配置预加载完成，再创建 React 根并渲染。
async function bootstrap() {
  await initPuckConfigStorage();

  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

void bootstrap();
