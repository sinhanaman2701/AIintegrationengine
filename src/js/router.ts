// ============================================
// SIMPLE HASH ROUTER & AUTH STATE
// ============================================

export type AuthState = {
    type: "admin" | "user";
    email: string;
    name: string;
    vendor_id?: string;
    account_id?: string;
    account_label?: string;
    consumer_id?: string;
    site_id?: string;
};

export function setAuth(state: AuthState) {
    sessionStorage.setItem("auth", JSON.stringify(state));
}

export function getAuth(): AuthState | null {
    const raw = sessionStorage.getItem("auth");
    return raw ? JSON.parse(raw) : null;
}

export function clearAuth() {
    sessionStorage.removeItem("auth");
}

export function navigate(path: string) {
    window.location.hash = path;
}

export function getCurrentRoute(): string {
    return window.location.hash.slice(1) || "/";
}
