export async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: "include",
    headers: options.body ? { "Content-Type": "application/json", ...options.headers } : options.headers,
  });
  if (response.status === 204) return null;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && path !== "/auth/login" && path !== "/auth/me") {
      window.dispatchEvent(new Event("auth-expired"));
    }
    throw new Error(body.error || "Request failed. Please try again.");
  }
  return body;
}

export const formatQuantity = (value) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
export const formatDate = (value) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(`${value.replace(" ", "T")}Z`));
