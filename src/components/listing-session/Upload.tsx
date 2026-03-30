"use client";

type UploadProps = {
  files: File[];
  onFilesChange: (files: File[]) => void;
  busy?: boolean;
};

export function Upload({ files, onFilesChange, busy }: UploadProps) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-300">Attach photos</div>
      <input
        className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 file:mr-3 file:rounded-md file:border-0 file:bg-slate-800 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-100"
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => onFilesChange(Array.from(e.target.files ?? []))}
        disabled={busy}
      />
      {files.length ? (
        <p className="mt-2 text-xs text-emerald-300">Selected: {files.length}</p>
      ) : (
        <p className="mt-2 text-xs text-slate-400">Photos upload automatically when you send a message.</p>
      )}
    </div>
  );
}
