"use client";
import { useEffect, useState } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

/**
 * Android hardware back button: when there's no more in-app history to go
 * back to (i.e. the button would otherwise exit the app), ask for
 * confirmation first instead of closing immediately. No-op on web.
 */
export function BackButtonGuard() {
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const listenerPromise = App.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        setConfirmOpen(true);
      }
    });

    return () => {
      listenerPromise.then((listener) => listener.remove());
    };
  }, []);

  if (!Capacitor.isNativePlatform()) return null;

  return (
    <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)}>
      <h2 className="text-lg font-bold">Exit Monto Parent?</h2>
      <p className="text-sm text-muted-foreground mt-2">
        You'll stop receiving calls and reminders from your child's Monto box while the app is closed.
      </p>
      <div className="flex gap-3 mt-6">
        <Button variant="outline" onClick={() => setConfirmOpen(false)} className="flex-1 h-11 rounded-2xl">
          Cancel
        </Button>
        <Button variant="destructive" onClick={() => App.exitApp()} className="flex-1 h-11 rounded-2xl">
          Exit
        </Button>
      </div>
    </Modal>
  );
}
