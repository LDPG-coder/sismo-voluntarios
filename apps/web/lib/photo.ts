const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const BLOB_HOST = "blobstoragex9083.blob.core.windows.net";

/**
 * Devuelve la URL a usar en un <img>. Las fotos del blob de programaexcelencia
 * se sirven a traves de nuestro proxy (/api/v1/media/proxy-image) porque el
 * blob devuelve un Content-Type no estandar ("picture") que el navegador
 * rechaza. El resto de URLs (Google, storage propio) se usan directamente.
 */
export function displayPhoto(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.includes(BLOB_HOST)) {
    return `${API}/api/v1/media/proxy-image?url=${encodeURIComponent(url)}`;
  }
  return url;
}
