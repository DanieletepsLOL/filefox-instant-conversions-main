export type StoredUploadedFile = {
  id: string;
  name: string;
  size: number;
  type: string;
  status: "ready" | "converting" | "done";
  uploadedAt: string;
};

const STORAGE_KEY = "filefox:uploads";

function parseStoredUploads(): StoredUploadedFile[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as StoredUploadedFile[];
  } catch {
    return [];
  }
}

export function getStoredUploads(): StoredUploadedFile[] {
  return parseStoredUploads();
}

export function saveUploads(uploads: StoredUploadedFile[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(uploads));
}

export function addStoredUploads(newUploads: StoredUploadedFile[]) {
  const existing = parseStoredUploads();
  const existingIds = new Set(existing.map((file) => file.id));
  const nextUploads = [...existing, ...newUploads.filter((file) => !existingIds.has(file.id))];
  saveUploads(nextUploads);
  return nextUploads;
}

export function removeStoredUpload(id: string) {
  const existing = parseStoredUploads();
  const nextUploads = existing.filter((file) => file.id !== id);
  saveUploads(nextUploads);
}

export function clearStoredUploads() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
