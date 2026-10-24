export async function savePortableFile(name: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export async function chooseBackupFile(): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.json,application/json';
    input.oncancel = () => resolve(null);
    input.onchange = () => { const file = input.files?.[0]; if (!file) { resolve(null); return; } if (file.size > 30 * 1024 * 1024) { reject(new Error('Choose a file under 30 MB.')); return; } file.text().then(resolve, reject); };
    input.click();
  });
}
