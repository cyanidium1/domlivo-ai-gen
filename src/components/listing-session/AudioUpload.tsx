"use client";

import { Upload } from "lucide-react";
import { useState } from "react";

import { uploadAudio } from "@/lib/listing-session/client";

type AudioUploadProps = {
  sessionId: string;
  onUploaded: () => void;
};

export function AudioUpload({ sessionId, onUploaded }: AudioUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      await uploadAudio(sessionId, file);
      setFile(null);
      onUploaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/25 p-3">
      <div className="text-xs font-medium text-slate-300">Upload audio file instead</div>
      <input
        className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 file:mr-3 file:rounded-md file:border-0 file:bg-slate-800 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-100"
        type="file"
        accept="audio/*,.txt"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      <button
        className="mt-2 inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-transparent px-3 py-2 text-sm text-slate-200 hover:bg-slate-900/40 disabled:opacity-60"
        onClick={handleUpload}
        disabled={!file || loading}
        type="button"
      >
        <Upload size={16} />
        {loading ? "Uploading..." : "Upload audio file"}
      </button>
      {error && <p className="mt-2 text-sm text-rose-300">{error}</p>}
    </div>
  );
}

