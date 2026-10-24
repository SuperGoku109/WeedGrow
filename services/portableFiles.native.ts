import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
export async function savePortableFile(name: string, content: string, mime: string) {
  const file = new File(Paths.cache, name); file.write(content);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(file.uri, { mimeType: mime, dialogTitle: 'Save your garden export' });
}
export async function chooseBackupFile(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain'], copyToCacheDirectory: true });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if ((asset.size || 0) > 30 * 1024 * 1024) throw new Error('Choose a file under 30 MB.');
  return new File(asset.uri).text();
}
