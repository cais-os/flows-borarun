"use client";

import { Button } from "@/components/ui/button";

const WHATSAPP_APP_URL = "whatsapp://send";
const WHATSAPP_WEB_URL = "https://wa.me/";

export function CloseButton() {
  function handleClose() {
    window.close();

    setTimeout(() => {
      if (document.visibilityState !== "visible") return;

      window.location.replace(WHATSAPP_APP_URL);

      setTimeout(() => {
        if (document.visibilityState !== "visible") return;
        window.location.replace(WHATSAPP_WEB_URL);
      }, 400);
    }, 250);
  }

  return (
    <Button
      onClick={handleClose}
      className="rounded-xl bg-slate-900 hover:bg-slate-800"
    >
      Fechar
    </Button>
  );
}
