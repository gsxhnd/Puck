import { useEffect, useState } from "react";
import packageJson from "../../package.json";
import { isTauri } from "@/lib/platform";

export function useAppVersion(): string {
  const [version, setVersion] = useState(packageJson.version);

  useEffect(() => {
    if (!isTauri()) return;

    void import("@tauri-apps/api/app").then(({ getVersion }) =>
      getVersion().then(setVersion),
    );
  }, []);

  return version;
}
