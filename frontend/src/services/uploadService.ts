import axios from "axios";
import api from "./apiClient";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_EXT = ["jpg", "jpeg", "png", "webp"];

/**
 * Sunucuya gitmeden önce hızlı kontrol. Geçersizse translation anahtarı döner, geçerliyse null.
 * Asıl doğrulama backend'dedir; bu sadece gereksiz istekleri önler.
 */
export function validateImageFile(
  file: File | null | undefined,
): string | null {
  if (!file || file.size === 0) return "upload.errors.noFile";

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  // Bazı sistemlerde (özellikle Windows) .webp için file.type boş gelebilir.
  const typeOk =
    ALLOWED_MIME.includes(file.type) ||
    (file.type === "" && ALLOWED_EXT.includes(ext));
  if (!typeOk) return "upload.errors.invalidType";

  if (file.size > MAX_IMAGE_BYTES) return "upload.errors.tooLarge";
  return null;
}

/** Yükleme hatasını kullanıcıya gösterilecek translation anahtarına çevirir. */
export function getUploadErrorKey(error: unknown): string {
  if (!axios.isAxiosError(error)) return "upload.errors.generic";
  if (!error.response) return "upload.errors.network";

  switch (error.response.status) {
    case 400: {
      const errors = (
        error.response.data as { errors?: Record<string, string[]> } | undefined
      )?.errors;
      return errors?.file?.length
        ? "upload.errors.invalidImage"
        : "upload.errors.generic";
    }
    case 401:
      return "upload.errors.sessionExpired";
    case 403:
      return "upload.errors.forbidden";
    case 413:
      return "upload.errors.tooLarge";
    case 429:
      return "upload.errors.rateLimited";
    default:
      return "upload.errors.generic";
  }
}

function toFormData(file: File): FormData {
  const formData = new FormData();
  formData.append("file", file);
  return formData;
}

export const uploadService = {
  /** Admin: film/oyuncu/yönetmen görselleri. */
  uploadImage: async (file: File): Promise<string> => {
    const { data } = await api.post("/uploads/image", toFormData(file), {
      headers: { "Content-Type": undefined },
    });
    return data.url;
  },
  /** Liste kapağı: giriş yapmış her kullanıcı. */
  uploadCover: async (file: File): Promise<string> => {
    const { data } = await api.post("/uploads/cover", toFormData(file), {
      headers: { "Content-Type": undefined },
    });
    return data.url;
  },
};
