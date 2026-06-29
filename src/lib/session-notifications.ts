import { getCurrentWindow } from "@tauri-apps/api/window";
import { toast } from "sonner";
import { isTauri } from "@/lib/platform";

async function isAppFocused(): Promise<boolean> {
  if (isTauri()) {
    try {
      return await getCurrentWindow().isFocused();
    } catch {
      return document.hasFocus();
    }
  }
  return document.hasFocus();
}

async function sendSystemNotification(title: string, body: string) {
  if (!("Notification" in window)) {
    toast.error(title, { description: body });
    return;
  }

  if (Notification.permission === "default") {
    await Notification.requestPermission();
  }

  if (Notification.permission === "granted") {
    new Notification(title, { body });
    return;
  }

  toast.error(title, { description: body });
}

export async function notifySessionFailure(title: string, body: string) {
  const focused = await isAppFocused();
  if (focused) {
    toast.error(title, { description: body });
    return;
  }

  await sendSystemNotification(title, body);
}
