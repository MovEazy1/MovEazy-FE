import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "./firebase";

function buildUniqueMediaName(file) {
  const originalName = String(file?.name || "property-media")
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-");
  const extension = originalName.includes(".") ? originalName.slice(originalName.lastIndexOf(".")) : ".bin";
  const nonce = Math.random().toString(36).slice(2, 10);
  return `${Date.now()}-${nonce}${extension}`;
}

function isAllowedMediaType(file) {
  const type = String(file?.type || "");
  return type.startsWith("image/") || type.startsWith("video/");
}

export async function uploadPropertyMediaFile(file) {
  if (!file) {
    throw new Error("Please select a photo or video first.");
  }
  if (!isAllowedMediaType(file)) {
    throw new Error("Only image or video files are allowed.");
  }

  const uniqueName = buildUniqueMediaName(file);
  const storageRef = ref(storage, `properties/${uniqueName}`);
  await uploadBytes(storageRef, file, {
    contentType: file.type || "application/octet-stream",
  });
  return getDownloadURL(storageRef);
}

