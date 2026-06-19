import type { FileRecord } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Utility to parse PostgreSQL text array representation (e.g., "['tag1', 'tag2']" or '{"tag1", "tag2"}')
export function parseTags(tagsField: any): string[] {
  if (!tagsField) return [];
  if (Array.isArray(tagsField)) return tagsField;
  
  const tagsStr = String(tagsField).trim();
  
  // If it's a Python list string format like "['tag1', 'tag2']"
  if (tagsStr.startsWith('[') && tagsStr.endsWith(']')) {
    try {
      // Replace single quotes with double quotes to make it valid JSON
      const jsonStr = tagsStr.replace(/'/g, '"');
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      // Fallback: split by comma and clean up quotes/brackets
      return tagsStr
        .slice(1, -1)
        .split(',')
        .map(t => t.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
    }
  }

  // If it's a PostgreSQL native text array format like '{"tag1","tag2"}'
  if (tagsStr.startsWith('{') && tagsStr.endsWith('}')) {
    return tagsStr
      .slice(1, -1)
      .split(',')
      .map(t => t.trim().replace(/^"|"$/g, ''))
      .filter(Boolean);
  }

  // Comma separated fallback
  return tagsStr.split(',').map(t => t.trim()).filter(Boolean);
}

export async function fetchFiles(): Promise<FileRecord[]> {
  const res = await fetch(`${API_BASE}/files/`);
  if (!res.ok) {
    throw new Error('Failed to retrieve vault files');
  }
  return res.json();
}

export async function deleteFile(fileId: number): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE}/files/${fileId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || 'Failed to delete file from vault');
  }
  return res.json();
}

export async function getDownloadLink(fileId: number): Promise<string> {
  const res = await fetch(`${API_BASE}/download/${fileId}`);
  if (!res.ok) {
    throw new Error('Failed to generate download ticket');
  }
  const data = await res.json();
  if (data.error) {
    throw new Error(data.error);
  }
  return data.download_url;
}

export async function getShareLink(fileId: number, expiryMinutes: number): Promise<{ share_url: string; expires_in_minutes: number }> {
  const res = await fetch(`${API_BASE}/share/${fileId}?expiry_minutes=${expiryMinutes}`);
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || 'Failed to generate expiring link');
  }
  const data = await res.json();
  if (data.error) {
    throw new Error(data.error);
  }
  return {
    share_url: data.share_url,
    expires_in_minutes: data.expires_in_minutes,
  };
}

export async function searchVault(query: string): Promise<FileRecord[]> {
  if (!query.trim()) {
    return fetchFiles();
  }
  const res = await fetch(`${API_BASE}/search/?query=${encodeURIComponent(query)}`);
  if (!res.ok) {
    throw new Error('Failed to query semantic search engine');
  }
  const data = await res.json();
  if (data.error) {
    throw new Error(data.error);
  }
  return data.results || [];
}

export function uploadFileWithProgress(
  file: File,
  onProgress: (progress: number) => void
): { promise: Promise<any>; abort: () => void } {
  const xhr = new XMLHttpRequest();
  
  const promise = new Promise((resolve, reject) => {
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        const percentComplete = Math.round((event.loaded / event.total) * 100);
        onProgress(percentComplete);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response);
          }
        } catch (e) {
          resolve({ message: 'Upload completed' });
        }
      } else {
        reject(new Error(`Server responded with code ${xhr.status}`));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Network error during file upload'));
    });

    xhr.addEventListener('abort', () => {
      reject(new Error('Upload cancelled by user'));
    });

    const formData = new FormData();
    formData.append('file', file);

    xhr.open('POST', `${API_BASE}/upload/`, true);
    xhr.send(formData);
  });

  return {
    promise,
    abort: () => xhr.abort(),
  };
}
