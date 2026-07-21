/**
 * validation.ts
 * Server-side image validation, run BEFORE any provider is called. This is the concrete
 * enforcement point for "invalid input returns a safe 4xx response and does not call the
 * provider" — see tests/api/visioninspect.test.ts for the test proving the fake adapter
 * is never invoked when this validation fails.
 *
 * Deliberately checks file content (magic bytes), not the filename or a client-supplied
 * mime_type field alone — a renamed non-image file, or a client lying about its own
 * content type, must not reach the provider.
 *
 * - validateImageUpload(buffer, claimedMimeType): the main entry point.
 * - ImageValidationError: thrown with a safe, user-facing message on any failure.
 */
import { getMaxUploadBytes } from '@/lib/ai/providers';

export class ImageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageValidationError';
  }
}

type SupportedMimeType = 'image/jpeg' | 'image/png' | 'image/webp';

/** Magic-byte signatures for the three formats this application accepts. Checked against
 *  the actual buffer content, never against a filename extension or a trusted header. */
function detectMimeTypeFromBuffer(buffer: Buffer): SupportedMimeType | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

export interface ValidatedImage {
  buffer: Buffer;
  mimeType: SupportedMimeType;
}

/**
 * Validates an uploaded image buffer against size and content-type rules. Throws
 * ImageValidationError with a message safe to show directly to the end user on any
 * failure. Never throws for reasons that would leak internal detail (e.g. file paths,
 * stack traces) — see docs/security-checklist.md "safe errors".
 */
export function validateImageUpload(buffer: Buffer, claimedMimeType: string): ValidatedImage {
  const maxBytes = getMaxUploadBytes();

  if (buffer.length === 0) {
    throw new ImageValidationError('The uploaded file is empty.');
  }

  if (buffer.length > maxBytes) {
    const maxMb = (maxBytes / (1024 * 1024)).toFixed(1);
    throw new ImageValidationError(`The uploaded file exceeds the ${maxMb}MB size limit.`);
  }

  const detectedMimeType = detectMimeTypeFromBuffer(buffer);
  if (!detectedMimeType) {
    throw new ImageValidationError(
      'The uploaded file does not appear to be a JPEG, PNG, or WebP image. Only these ' +
        'formats are supported.',
    );
  }

  if (claimedMimeType !== detectedMimeType) {
    throw new ImageValidationError(
      'The uploaded file\u2019s actual content does not match its declared type. Please ' +
        're-upload the original image file.',
    );
  }

  return { buffer, mimeType: detectedMimeType };
}
