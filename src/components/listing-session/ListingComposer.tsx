"use client";

import { Mic, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { transcribeAudio } from "@/lib/listing-session/client";

type ListingComposerProps = {
  sessionId: string;
  value: string;
  onChange: (value: string) => void;
};

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function ListingComposer({ sessionId, value, onChange }: ListingComposerProps) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const latestValueRef = useRef(value);

  useEffect(() => {
    latestValueRef.current = value;
  }, [value]);

  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [recording]);

  const stopMediaTracks = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const startRecording = async () => {
    setError(null);
    setNotice(null);
    setRecordSeconds(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      recorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setRecording(false);
        stopMediaTracks();
        if (!chunksRef.current.length) return;

        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType || "audio/webm" });
        const ext = blob.type.includes("mpeg") ? "mp3" : blob.type.includes("wav") ? "wav" : "webm";
        const file = new File([blob], `composer-note-${Date.now()}.${ext}`, { type: blob.type || "audio/webm" });

        setTranscribing(true);
        try {
          const result = await transcribeAudio(sessionId, file);
          const transcript = result.transcript.trim();
          if (!transcript) {
            setNotice("Транскрипция пуста. Попробуйте записать еще раз.");
            return;
          }
          const currentValue = latestValueRef.current;
          const nextValue = currentValue.trim() ? `${currentValue.trim()}\n${transcript}` : transcript;
          onChange(nextValue);
          setNotice("Готово: текст из записи добавлен. Можно записать следующий фрагмент.");
        } catch (err) {
          setError(err instanceof Error ? err.message : "Не удалось распознать запись");
        } finally {
          setTranscribing(false);
        }
      };

      mediaRecorder.start();
      setRecording(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Нет доступа к микрофону");
      stopMediaTracks();
    }
  };

  const stopRecording = () => {
    if (!recorderRef.current) return;
    if (recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
  };

  return (
    <div className="rounded-2xl border border-slate-700/70 bg-slate-900/40 p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <label htmlFor="listing-composer" className="text-sm font-medium text-slate-100">
          Main listing input
        </label>
        <button
          className={[
            "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed",
            recording
              ? "border-rose-700/70 bg-rose-950/30 text-rose-100 hover:bg-rose-900/30"
              : "border-slate-700 bg-slate-900/50 text-slate-100 hover:bg-slate-900/80",
          ].join(" ")}
          type="button"
          onClick={recording ? stopRecording : () => void startRecording()}
          disabled={transcribing}
        >
          {recording ? <Square size={15} /> : <Mic size={15} />}
          {recording ? `Stop (${formatTime(recordSeconds)})` : "Record"}
        </button>
      </div>

      <textarea
        id="listing-composer"
        className="min-h-[180px] w-full rounded-xl border border-slate-700 bg-slate-950/40 px-3 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/80"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Describe the property or use the microphone to dictate details..."
      />

      <p className="mt-2 text-xs text-slate-400">You can record multiple times. Each new transcript is appended to this field.</p>
      {recording ? <p className="mt-2 text-xs text-rose-200">Recording in progress...</p> : null}
      {transcribing ? <p className="mt-2 text-xs text-blue-300">Transcribing audio...</p> : null}
      {notice ? <p className="mt-2 text-xs text-emerald-300">{notice}</p> : null}
      {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}
