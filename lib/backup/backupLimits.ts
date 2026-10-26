export const MAX_BACKUP_BYTES = 30 * 1024 * 1024;
export const MAX_BACKUP_RECORDS = 50000;
export function utf8Bytes(value: string) {
  let bytes = 0;
  for (let index = 0; index < value.length; index++) { const code = value.charCodeAt(index); if (code < 128) bytes++; else if (code < 2048) bytes += 2; else if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length && value.charCodeAt(index + 1) >= 0xdc00 && value.charCodeAt(index + 1) <= 0xdfff) { bytes += 4; index++; } else bytes += 3; }
  return bytes;
}
