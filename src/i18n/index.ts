import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import zhCNCommon from "./locales/zh-CN/common.json";
import zhCNConnections from "./locales/zh-CN/connections.json";
import zhCNTerminal from "./locales/zh-CN/terminal.json";
import zhCNFiles from "./locales/zh-CN/files.json";
import zhCNSettings from "./locales/zh-CN/settings.json";

import enUSCommon from "./locales/en-US/common.json";
import enUSConnections from "./locales/en-US/connections.json";
import enUSTerminal from "./locales/en-US/terminal.json";
import enUSFiles from "./locales/en-US/files.json";
import enUSSettings from "./locales/en-US/settings.json";

const resources = {
  "zh-CN": {
    common: zhCNCommon,
    connections: zhCNConnections,
    terminal: zhCNTerminal,
    files: zhCNFiles,
    settings: zhCNSettings,
  },
  "en-US": {
    common: enUSCommon,
    connections: enUSConnections,
    terminal: enUSTerminal,
    files: enUSFiles,
    settings: enUSSettings,
  },
} as const;

void i18n.use(initReactI18next).init({
  resources,
  lng: "zh-CN",
  fallbackLng: "en-US",
  defaultNS: "common",
  ns: ["common", "connections", "terminal", "files", "settings"],
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
