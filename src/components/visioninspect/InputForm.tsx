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

interface InputFormProps {
  onSubmit: (imageBase64: string, mimeType: string) => void;
  disabled?: boolean;
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
  const [clientError, setClientError] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    setClientError(null);

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setClientError('Please choose a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size > CLIENT_MAX_BYTES) {
      setClientError('That file is larger than 8MB. Please choose a smaller image.');
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
    setClientError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="evidence-tag p-5 sm:p-6">
      <h2 className="font-display text-fluid-lg font-medium text-graphite">
        Upload an inspection image
      </h2>
      <p className="mt-1 font-body text-sm text-graphite-soft">
        JPEG, PNG, or WebP — up to 8MB. One image per inspection.
      </p>

      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragActive(true);
        }}
        onDragLeave={() => setIsDragActive(false)}
        onDrop={handleDrop}
        className={`mt-4 flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-tag border-2 border-dashed p-6 text-center transition-colors ${
          isDragActive ? 'border-teal bg-teal/5' : 'border-steel-dark bg-porcelain-dim'
        }`}
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="Selected inspection image preview"
            className="max-h-[280px] max-w-full rounded-tag object-contain"
          />
        ) : (
          <>
            <p className="font-body text-sm text-graphite-soft">
              Drag an image here, or choose a file
            </p>
            <label className="touch-target inline-flex cursor-pointer items-center rounded-tag border border-teal bg-teal px-4 py-2 font-body text-sm font-medium text-white transition-colors hover:bg-teal-dark focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-teal">
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
        <p role="alert" className="mt-3 font-body text-sm text-severity-high">
          {clientError}
        </p>
      )}

      {selectedFile && (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={disabled}
            className="touch-target flex-1 rounded-tag bg-teal px-4 py-2 font-body text-sm font-medium text-white transition-colors hover:bg-teal-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            Analyze image
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={disabled}
            className="touch-target rounded-tag border border-steel-dark px-4 py-2 font-body text-sm font-medium text-graphite-soft transition-colors hover:bg-porcelain-dim"
          >
            Choose a different file
          </button>
        </div>
      )}
    </div>
  );
}
