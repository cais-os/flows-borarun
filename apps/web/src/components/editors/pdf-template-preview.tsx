"use client";

import { useState, type CSSProperties } from "react";
import { Expand } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface PdfTemplatePreviewProps {
  html: string;
  className?: string;
  dialogTitle?: string;
  dialogDescription?: string;
}

function PreviewSheet({
  html,
  title,
  frameClassName = "",
  iframeClassName = "",
  frameStyle,
}: {
  html: string;
  title: string;
  frameClassName?: string;
  iframeClassName?: string;
  frameStyle?: CSSProperties;
}) {
  return (
    <div
      className={cn(
        "mx-auto overflow-hidden rounded-[22px] border border-stone-300 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.16)]",
        frameClassName
      )}
      style={frameStyle}
    >
      <iframe
        title={title}
        srcDoc={html}
        sandbox=""
        className={cn("h-full w-full bg-white", iframeClassName)}
      />
    </div>
  );
}

export function PdfTemplatePreview({
  html,
  className = "",
  dialogTitle = "Preview A4 do PDF",
  dialogDescription = "Visualizacao ampliada do layout em formato de pagina inteira.",
}: PdfTemplatePreviewProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div
        className={cn(
          "relative rounded-[28px] border border-stone-200 bg-[linear-gradient(180deg,#f6f0e8_0%,#efe6da_100%)] p-3 shadow-sm",
          className
        )}
      >
        <PreviewSheet
          html={html}
          title={dialogTitle}
          frameClassName="aspect-[210/297]"
        />

        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="group absolute inset-0 z-10 cursor-zoom-in rounded-[28px] bg-black/0 transition hover:bg-black/5"
          aria-label="Abrir preview ampliado do PDF"
        >
          <span className="absolute right-5 bottom-5 inline-flex items-center gap-2 rounded-full bg-white/92 px-3 py-1.5 text-xs font-medium text-stone-700 shadow-sm backdrop-blur transition group-hover:bg-white">
            <Expand size={12} />
            Ampliar
          </span>
        </button>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="top-0 left-0 flex h-[100svh] max-h-[100svh] w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 p-0 sm:top-[50%] sm:left-[50%] sm:h-[94vh] sm:max-h-[94vh] sm:max-w-[96vw] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg sm:border">
          <DialogHeader className="border-b border-stone-200 px-4 py-4 sm:px-6">
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>{dialogDescription}</DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-hidden bg-[linear-gradient(180deg,#f6f0e8_0%,#efe6da_100%)] p-3 sm:p-6">
            <div className="flex h-full w-full items-center justify-center overflow-hidden">
              <PreviewSheet
                html={html}
                title={`${dialogTitle} ampliado`}
                frameClassName="h-full w-full sm:max-w-[1120px]"
                frameStyle={{ height: "100%" }}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
