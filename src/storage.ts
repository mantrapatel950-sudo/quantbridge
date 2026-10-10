import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const USERS_DIR = path.resolve(DATA_DIR, 'users');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function ensureUserDir(userId: string): string {
  ensureDataDir();
  // Sanitize userId to safe filename characters
  const safeId = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const userDir = path.resolve(USERS_DIR, safeId);
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }
  return userDir;
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
    const tempPath = `${filePath}.tmp.${Date.now()}`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempPath, filePath);
  } catch (err) {
    console.error(`Error writing ${filename} to storage:`, err);
  }
}

// -------------------------------------------------------------------------
// Multi-Tenant Per-User Storage Isolation
// -------------------------------------------------------------------------

export function loadUserFile<T>(userId: string, filename: string, defaultValue: T): T {
  try {
    // If default user and user file doesn't exist, fallback to base data/ file
    if (!userId || userId === 'default' || userId === 'local-dev-user') {
      const baseFile = path.join(DATA_DIR, filename);
      if (fs.existsSync(baseFile)) {
        return loadFromFile(filename, defaultValue);
      }
    }

    const userDir = ensureUserDir(userId);
    const filePath = path.join(userDir, filename);

    if (!fs.existsSync(filePath)) {
      // If default/owner user, initialize from base file if exists
      if (userId === 'default' || userId === 'local-dev-user') {
        const baseData = loadFromFile(filename, defaultValue);
        saveUserFile(userId, filename, baseData);
        return baseData;
      }
      saveUserFile(userId, filename, defaultValue);
      return defaultValue;
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch (err) {
    console.error(`Error reading ${filename} for user ${userId}:`, err);
    return defaultValue;
  }
}

export function saveUserFile<T>(userId: string, filename: string, data: T): void {
  try {
    const userDir = ensureUserDir(userId);
    const filePath = path.join(userDir, filename);
    const tempPath = `${filePath}.tmp.${Date.now()}`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempPath, filePath);

    // Also mirror to base data/ if owner/default user for backward compatibility
    if (userId === 'default' || userId === 'local-dev-user') {
      saveToFile(filename, data);
    }
  } catch (err) {
    console.error(`Error writing ${filename} for user ${userId}:`, err);
  }
}
