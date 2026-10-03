// Pure helpers for validating uploads (kept free of dependencies so they are easy to test)
export const IMAGES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
export const DOCS: Record<string, string> = {
  ...IMAGES,
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'text/plain': 'txt',
};
export const LIMIT = { image: 3 * 1024 * 1024, material: 8 * 1024 * 1024 };

// Check the file's real signature so a renamed file cannot sneak through
export function signatureOk(ext: string, b: Buffer): boolean {
  switch (ext) {
    case 'jpg': return b[0] === 0xff && b[1] === 0xd8;
    case 'png': return b[0] === 0x89 && b.toString('ascii', 1, 4) === 'PNG';
    case 'webp': return b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP';
    case 'pdf': return b.toString('ascii', 0, 4) === '%PDF';
    case 'docx': case 'pptx': case 'xlsx': return b.toString('ascii', 0, 2) === 'PK';
    default: return true;
  }
}

export const STORED_NAME = /^[a-f0-9-]{36}\.(jpg|png|webp|pdf|docx|pptx|xlsx|txt)$/;

