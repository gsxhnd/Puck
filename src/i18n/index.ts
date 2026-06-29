import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import zhCNInfo from "./locales/zh-CN/info.json";
import zhCNCommon from "./locales/zh-CN/common.json";
import zhCNConnections from "./locales/zh-CN/connections.json";
import zhCNTerminal from "./locales/zh-CN/terminal.json";
import zhCNFiles from "./locales/zh-CN/files.json";
import zhCNSettings from "./locales/zh-CN/settings.json";
import zhCNCommandPalette from "./locales/zh-CN/command-palette.json";
import zhCNErrors from "./locales/zh-CN/errors.json";

import enUSInfo from "./locales/en-US/info.json";
import enUSCommon from "./locales/en-US/common.json";
import enUSConnections from "./locales/en-US/connections.json";
import enUSTerminal from "./locales/en-US/terminal.json";
import enUSFiles from "./locales/en-US/files.json";
import enUSSettings from "./locales/en-US/settings.json";
import enUSCommandPalette from "./locales/en-US/command-palette.json";
import enUSErrors from "./locales/en-US/errors.json";

const resources = {
  "zh-CN": {
    info: zhCNInfo,
    common: zhCNCommon,
    connections: zhCNConnections,
    terminal: zhCNTerminal,
    files: zhCNFiles,
    settings: zhCNSettings,
    errors: zhCNErrors,
    commandPalette: zhCNCommandPalette,
  },
  "en-US": {
    info: enUSInfo,
    common: enUSCommon,
    connections: enUSConnections,
    terminal: enUSTerminal,
    files: enUSFiles,
    settings: enUSSettings,
    errors: enUSErrors,
    commandPalette: enUSCommandPalette,
  },
} as const;

void i18n.use(initReactI18next).init({
  resources,
  lng: "zh-CN",
  fallbackLng: "en-US",
  defaultNS: "common",
  ns: ["common", "connections", "terminal", "files", "settings", "errors", "info", "commandPalette"],
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
