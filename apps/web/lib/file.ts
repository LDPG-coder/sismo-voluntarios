export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("no se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });
}

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export const MAX_DOC_BYTES = 8 * 1024 * 1024;

export function imageTooLarge(file: File): boolean {
  return file.size > MAX_IMAGE_BYTES;
}

export function docTooLarge(file: File): boolean {
  return file.size > MAX_DOC_BYTES;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es", {
    style: "currency",
    currency: "BOB",
    maximumFractionDigits: 2,
  }).format(value || 0);
}
