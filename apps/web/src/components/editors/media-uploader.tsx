"use client";

import { useCallback, useRef, type DragEvent, useState } from "react";
import { Upload, X, FileText, Image, Mic, Video } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MediaUploaderProps {
  accept: string;
  type: "image" | "file" | "audio" | "video";
  value?: string;
  fileName?: string;
  onChange: (url: string, fileName: string) => void;
  onRemove: () => void;
}

const typeIcons = {
  image: <Image size={20} />,
  file: <FileText size={20} />,
  audio: <Mic size={20} />,
  video: <Video size={20} />,
};

const typeLabels = {
  image: "imagem",
  file: "arquivo",
  audio: "audio",
  video: "video",
};

export function MediaUploader({
  accept,
  type,
  value,
  fileName,
  onChange,
  onRemove,
}: MediaUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        onChange(reader.result as string, file.name);
      };
      reader.readAsDataURL(file);
    },
    [onChange]
  );

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  if (value) {
    return (
      <div className="border rounded-lg p-3 bg-gray-50">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-gray-500">{typeIcons[type]}</span>
            <span className="text-sm text-gray-700 truncate">
              {fileName || "Arquivo"}
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={onRemove}>
            <X size={14} />
          </Button>
        </div>
        {type === "image" && (
          <img
            src={value}
            alt="Preview"
            className="mt-2 rounded max-h-32 object-cover w-full"
          />
        )}
        {type === "audio" && (
          <audio controls className="mt-2 w-full" src={value} />
        )}
        {type === "video" && (
          <video controls className="mt-2 max-h-48 w-full rounded" src={value} />
        )}
      </div>
    );
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
        isDragging
          ? "border-primary bg-primary/5"
          : "border-gray-200 hover:border-gray-300"
      }`}
    >
      <Upload size={20} className="mx-auto text-gray-400 mb-2" />
      <p className="text-sm text-gray-500">
        Arraste ou clique para enviar {typeLabels[type]}
      </p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </div>
  );
}
