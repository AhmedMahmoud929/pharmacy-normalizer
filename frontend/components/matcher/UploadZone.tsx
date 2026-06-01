"use client";

import React from "react";
import { Upload, FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";

interface UploadZoneProps {
  file: File | null;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const UploadZone: React.FC<UploadZoneProps> = ({ file, onFileChange }) => {
  return (
    <div
      className={cn(
        "relative group overflow-hidden w-full flex items-center justify-center rounded-2xl border-2 border-dashed transition-all duration-300",
        file ? "border-primary/50 bg-primary/5" : "border-neutral-gray/20 hover:border-primary/30 bg-white dark:bg-zinc-900/50"
      )}
    >
      <input
        type="file"
        accept=".xlsx,.xls,.csv"
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        onChange={onFileChange}
      />
      <div className="p-8 text-center space-y-4">
        <div className="w-16 h-16 mx-auto bg-primary/10 rounded-2xl flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
          {file ? <FileSpreadsheet className="w-8 h-8" /> : <Upload className="w-8 h-8" />}
        </div>
        <div>
          <p className="font-semibold text-lg text-foreground">
            {file ? file.name : "Upload Pharmacy Sheet"}
          </p>
          <p className="text-sm text-neutral-muted mt-1">
            Drag and drop .xlsx or .csv files here
          </p>
        </div>
      </div>
    </div>
  );
};
