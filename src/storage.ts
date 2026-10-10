import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve(process.cwd(), 'data');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadFromFile<T>(filename: string, defaultValue: T): T {
  try {
    ensureDataDir();
    const filePath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(filePath)) {
      saveToFile(filename, defaultValue);
      return defaultValue;
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed as T;
  } catch (err) {
    console.error(`Error reading ${filename} from storage:`, err);
    return defaultValue;
  }
}

export function saveToFile<T>(filename: string, data: T): void {
  try {
    ensureDataDir();
    const filePath = path.join(DATA_DIR, filename);
    // Write atomically via temporary file to prevent corruption
    const tempPath = `${filePath}.tmp.${Date.now()}`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempPath, filePath);
  } catch (err) {
    console.error(`Error writing ${filename} to storage:`, err);
  }
}
