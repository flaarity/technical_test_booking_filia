type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Record<string, string | string[]>;
};

type TokenGetter = () => Promise<string | null>;

type ApiRequestOptions = Omit<RequestInit, "headers"> & {
  headers?: HeadersInit;
};

export class ApiError extends Error {
  readonly status: number;
  readonly errors: Record<string, string | string[]>;

  constructor(
    message: string,
    status: number,
    errors: Record<string, string | string[]> = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
  }
}

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, "") ??
  "http://localhost:4000";

export async function apiRequest<T>(
  path: string,
  getToken: TokenGetter,
  options: ApiRequestOptions = {},
): Promise<T> {
  const token = await getToken();
  if (!token) {
    throw new ApiError("Silakan login terlebih dahulu.", 401);
  }

  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Accept", "application/json");
  if (options.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    throw new Error("Tidak dapat terhubung ke server. Periksa koneksi Anda.", {
      cause: error,
    });
  }

  let envelope: ApiEnvelope<T>;
  try {
    envelope = (await response.json()) as ApiEnvelope<T>;
  } catch {
    throw new ApiError(
      response.ok ? "Respons server tidak valid." : "Permintaan gagal.",
      response.status,
    );
  }

  if (!response.ok || envelope.success === false) {
    throw new ApiError(
      envelope.message || "Permintaan tidak dapat diproses.",
      response.status,
      envelope.errors ?? {},
    );
  }

  if (!("data" in envelope)) {
    throw new ApiError("Respons server tidak memiliki data.", response.status);
  }
  return envelope.data as T;
}
