import type { ComponentType } from "react";
import type { SettingsSection } from "@/page/settings/settings-constants";
import { GeneralSettingsSection } from "@/page/settings/sections/general-section";
import { AppearanceSettingsSection } from "@/page/settings/sections/appearance-section";
import { TerminalSettingsSection } from "@/page/settings/sections/terminal-section";
import { SystemResourcesSettingsSection } from "@/page/settings/sections/system-resources-section";
import { ConnectionsSettingsSection } from "@/page/settings/sections/connections-section";
import { KeyboardSettingsSection } from "@/page/settings/sections/keyboard-section";
import { AboutSettingsSection } from "@/page/settings/sections/about-section";

export const SETTINGS_SECTION_VIEWS: Record<SettingsSection, ComponentType> = {
  general: GeneralSettingsSection,
  appearance: AppearanceSettingsSection,
  terminal: TerminalSettingsSection,
  systemResources: SystemResourcesSettingsSection,
  connections: ConnectionsSettingsSection,
  keyboard: KeyboardSettingsSection,
  about: AboutSettingsSection,
};
