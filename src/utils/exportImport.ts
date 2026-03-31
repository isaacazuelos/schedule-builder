import type { ExportedConfig } from '../types';

export function exportConfig(config: ExportedConfig): void {
  const json = JSON.stringify(config, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `schedule-config-${config.targetMonth}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importConfig(file: File): Promise<ExportedConfig> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const config = JSON.parse(e.target?.result as string) as ExportedConfig;
        // Basic validation
        if (!Array.isArray(config.staff)) throw new Error('Invalid config: missing staff array');
        resolve(config);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

export function exportScheduleHtml(html: string, month: string): void {
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `schedule-${month}.html`;
  a.click();
  URL.revokeObjectURL(url);
}
