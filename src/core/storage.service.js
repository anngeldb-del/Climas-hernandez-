/**
 * storage.service.js
 * -----------------------------------------------------------------------
 * Uploads vehicle/order/warranty photos to Firebase Storage. Images are
 * compressed client-side (see utils.compressImage) before upload to keep
 * bandwidth and storage cost low — a phone photo is 3-8MB, a compressed
 * 1600px WebP is typically under 300KB with no visible quality loss for
 * this use case (documenting a repair, not print photography).
 */

import { storage, ref, uploadBytes, getDownloadURL, deleteObject } from './firebase.init.js';
import { compressImage, tempId } from './utils.js';

/**
 * @param {string} folderPath e.g. `service-orders/${orderId}/before`
 * @param {File} file
 * @returns {Promise<{path: string, url: string, name: string}>}
 */
export async function uploadPhoto(folderPath, file) {
  const compressed = await compressImage(file);
  const path = `${folderPath}/${tempId()}_${compressed.name}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, compressed);
  const url = await getDownloadURL(storageRef);
  return { path, url, name: compressed.name };
}

export async function uploadPhotos(folderPath, files, onProgress) {
  const results = [];
  for (let i = 0; i < files.length; i++) {
    results.push(await uploadPhoto(folderPath, files[i]));
    onProgress?.(i + 1, files.length);
  }
  return results;
}

export async function deletePhoto(path) {
  try {
    await deleteObject(ref(storage, path));
  } catch (error) {
    // Object may already be gone (e.g. double-click delete) — not fatal.
    console.warn('[storage] delete failed', path, error);
  }
}

/** Converts a <canvas> signature pad into a File ready for uploadPhoto(). */
export function canvasToFile(canvas, filename) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(new File([blob], filename, { type: 'image/png' })), 'image/png');
  });
}
