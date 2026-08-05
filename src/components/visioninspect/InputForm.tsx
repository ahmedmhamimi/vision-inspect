/**
 * InputForm.tsx
 * The upload entry point for a new inspection. Performs client-side file-type and
 * size checks purely for fast, friendly feedback — this is a UX nicety, not a security
 * boundary. The real gate is validateImageUpload() in route.ts, which checks the actual
 * file content server-side regardless of what this component allows through.
 *
 * - InputForm: renders the file picker, drag target, and preview; calls onSubmit with
 *   the base64-encoded image and its client-reported mime type once the user confirms.
 */
'use client';

import { useCallback, useRef, useState } from 'react';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const CLIENT_MAX_BYTES = 8 * 1024 * 1024; // mirrors the server default; server is authoritative
const MIN_DIMENSION = 200;
const MAX_DIMENSION = 4096;

interface InputFormProps {
  onSubmit: (imageBase64: string, mimeType: string) => void;
  disabled?: boolean;
}

function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      resolve({ width, height });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read image dimensions. File may be corrupted.'));
    };
    img.src = url;
  });
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the "data:image/jpeg;base64," prefix — the server only wants the payload.
      const commaIndex = result.indexOf(',');
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = () => reject(new Error('Could not read the selected file.'));
    reader.readAsDataURL(file);
  });
}

export function InputForm({ onSubmit, disabled = false }: InputFormProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedDimensions, setSelectedDimensions] = useState<{ width: number; height: number } | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setClientError(null);

    const resetFileSelection = () => {
      setSelectedFile(null);
      setPreviewUrl(null);
      setSelectedDimensions(null);
      if (inputRef.current) inputRef.current.value = '';
    };

    if (!ACCEPTED_TYPES.includes(file.type)) {
      resetFileSelection();
      setClientError('Please choose a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size > CLIENT_MAX_BYTES) {
      resetFileSelection();
      setClientError('That file is larger than 8MB. Please choose a smaller image.');
      return;
    }

    try {
      const { width, height } = await getImageDimensions(file);
      if (width < MIN_DIMENSION || height < MIN_DIMENSION) {
        resetFileSelection();
        setClientError(
          `⛔ Image resolution (${width}×${height}px) is too small! Minimum allowed resolution is ${MIN_DIMENSION}×${MIN_DIMENSION}px. Upload cancelled.`,
        );
        return;
      }
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        resetFileSelection();
        setClientError(
          `⛔ Image resolution (${width}×${height}px) exceeds the limit of 4096×4096px! Maximum allowed resolution is ${MAX_DIMENSION}×${MAX_DIMENSION}px. Upload cancelled.`,
        );
        return;
      }
      setSelectedDimensions({ width, height });
    } catch (err) {
      resetFileSelection();
      setClientError(err instanceof Error ? err.message : 'Invalid image file.');
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }, []);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleSubmit = async () => {
    if (!selectedFile) return;
    try {
      const base64 = await fileToBase64(selectedFile);
      onSubmit(base64, selectedFile.type);
    } catch {
      setClientError('Could not read the selected file. Please try choosing it again.');
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setSelectedDimensions(null);
    setClientError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="glass-card p-6 sm:p-7 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-fluid-lg font-bold text-graphite tracking-tight">
            Upload inspection image
          </h2>
          <p className="mt-1 font-body text-sm text-graphite-soft">
            JPEG, PNG, or WebP — 200×200px to 4096×4096px, up to 8MB. One image per inspection.
          </p>
        </div>
      </div>

      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragActive(true);
        }}
        onDragLeave={() => setIsDragActive(false)}
        onDrop={handleDrop}
        className={`group mt-5 flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-6 text-center transition-all duration-300 ${
          isDragActive
            ? 'border-blue-500 bg-blue-500/10 scale-[1.01] shadow-lg shadow-blue-500/10'
            : 'border-steel-dark/70 bg-porcelain-dim/60 hover:border-blue-500/50 hover:bg-white/80'
        }`}
      >
        {previewUrl ? (
          <div className="flex flex-col items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Selected inspection image preview"
              className="max-h-[280px] max-w-full rounded-xl object-contain shadow-md"
            />
            {selectedDimensions && (
              <span className="font-mono text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                ✓ Resolution: {selectedDimensions.width} × {selectedDimensions.height} px
              </span>
            )}
          </div>
        ) : (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-sm border border-blue-100 group-hover:scale-110 transition-transform">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </div>
            <p className="font-body text-sm font-medium text-graphite-soft">
              Drag & drop an image here, or choose a file
            </p>
            <span className="font-mono text-xs text-graphite-soft/80 bg-porcelain px-3 py-1 rounded-full border border-steel/60 shadow-inner">
              Allowed resolution: 200×200px – 4096×4096px
            </span>
            <label className="touch-target inline-flex cursor-pointer items-center rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 font-body text-sm font-semibold text-white shadow-md shadow-blue-500/20 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/30 hover:scale-105">
              Choose file
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPTED_TYPES.join(',')}
                onChange={handleInputChange}
                disabled={disabled}
                className="sr-only"
                aria-label="Choose an inspection image file"
              />
            </label>
          </>
        )}
      </div>

      {clientError && (
        <div role="alert" className="mt-4 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 shadow-sm animate-fade-in">
          <svg className="h-5 w-5 flex-shrink-0 text-red-600" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
          </svg>
          <p className="font-body text-sm font-semibold">
            {clientError}
          </p>
        </div>
      )}

      {selectedFile && (
        <div className="mt-5 flex flex-col gap-3 sm:flex-row animate-fade-in">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={disabled}
            className="touch-target flex-1 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 font-body text-sm font-semibold text-white shadow-md shadow-blue-500/25 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/35 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Analyze image
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={disabled}
            className="touch-target rounded-full border border-steel-dark/80 bg-white px-5 py-3 font-body text-sm font-semibold text-graphite-soft transition-all duration-300 hover:bg-porcelain-dim hover:text-graphite hover:border-steel-dark"
          >
            Choose a different file
          </button>
        </div>
      )}
    </div>
  );
}
