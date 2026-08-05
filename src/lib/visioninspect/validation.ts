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

export const MIN_IMAGE_DIMENSION = 200;
export const MAX_IMAGE_DIMENSION = 4096;

/**
 * Extracts width and height from PNG, JPEG, or WebP image buffers without external dependencies.
 * Returns null if the header is missing or unparseable.
 */
export function detectDimensionsFromBuffer(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 12) return null;

  // PNG
  if (
    buffer.length >= 24 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    return { width, height };
  }

  // JPEG
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset < buffer.length - 8) {
      // Find next 0xFF marker prefix
      while (offset < buffer.length && buffer[offset] !== 0xff) {
        offset++;
      }
      while (offset < buffer.length && buffer[offset] === 0xff) {
        offset++;
      }
      if (offset >= buffer.length) break;

      const marker = buffer[offset];
      if (marker === undefined) break;
      offset++; // skip marker byte

      // Standalone markers with no length payload (SOI, EOI, RST0-RST7, TEM)
      if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
        continue;
      }

      if (offset + 2 > buffer.length) break;
      const length = buffer.readUInt16BE(offset);

      // Check for Start of Frame (SOF) markers
      if (
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf)
      ) {
        if (offset + 7 <= buffer.length) {
          const height = buffer.readUInt16BE(offset + 3);
          const width = buffer.readUInt16BE(offset + 5);
          return { width, height };
        }
      }

      offset += length;
    }
  }

  // WebP
  if (
    buffer.length >= 30 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    const format = buffer.subarray(12, 16).toString('ascii');
    if (format === 'VP8 ' && buffer.length >= 30) {
      const width = buffer.readUInt16LE(26) & 0x3fff;
      const height = buffer.readUInt16LE(28) & 0x3fff;
      return { width, height };
    }
    if (format === 'VP8L' && buffer.length >= 25) {
      const b0 = buffer[21] ?? 0;
      const b1 = buffer[22] ?? 0;
      const b2 = buffer[23] ?? 0;
      const b3 = buffer[24] ?? 0;
      const width = 1 + (((b1 & 0x3f) << 8) | b0);
      const height = 1 + (((b3 & 0xf) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
      return { width, height };
    }
    if (format === 'VP8X' && buffer.length >= 30) {
      const b24 = buffer[24] ?? 0;
      const b25 = buffer[25] ?? 0;
      const b26 = buffer[26] ?? 0;
      const b27 = buffer[27] ?? 0;
      const b28 = buffer[28] ?? 0;
      const b29 = buffer[29] ?? 0;
      const width = 1 + (b24 | (b25 << 8) | (b26 << 16));
      const height = 1 + (b27 | (b28 << 8) | (b29 << 16));
      return { width, height };
    }
  }

  return null;
}

export interface ValidatedImage {
  buffer: Buffer;
  mimeType: SupportedMimeType;
}

/**
 * Validates an uploaded image buffer against size, mime-type, and dimension rules. Throws
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

  const dimensions = detectDimensionsFromBuffer(buffer);
  if (dimensions) {
    if (dimensions.width < MIN_IMAGE_DIMENSION || dimensions.height < MIN_IMAGE_DIMENSION) {
      throw new ImageValidationError(
        `Image resolution (${dimensions.width}×${dimensions.height}px) is too small. Minimum required is ${MIN_IMAGE_DIMENSION}×${MIN_IMAGE_DIMENSION}px.`,
      );
    }
    if (dimensions.width > MAX_IMAGE_DIMENSION || dimensions.height > MAX_IMAGE_DIMENSION) {
      throw new ImageValidationError(
        `Image resolution (${dimensions.width}×${dimensions.height}px) is too large. Maximum allowed is ${MAX_IMAGE_DIMENSION}×${MAX_IMAGE_DIMENSION}px.`,
      );
    }
  }

  return { buffer, mimeType: detectedMimeType };
}
