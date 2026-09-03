/**
 * Helper utility to resize and compress uploaded images for damage assessment photos.
 * Ensures up to 10 photos per building can be stored smoothly in local state / Firestore without exceeding payload limits.
 */

export async function compressImageFile(file: File, maxWidth = 1200, maxHeight = 1200, quality = 0.78): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            maxHeight = height;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = () => {
        reject(new Error('Gagal memuat file gambar'));
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = () => {
      reject(new Error('Gagal membaca file gambar'));
    };
    reader.readAsDataURL(file);
  });
}
