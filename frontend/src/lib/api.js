import axios from "axios";

export const BACKEND_URL = (process.env.REACT_APP_BACKEND_URL || "http://localhost:8001").replace(/\/+$/, "");
export const API = `${BACKEND_URL}/api`;

const TOKEN_KEY = "nexus_token";

const api = axios.create({ baseURL: API, withCredentials: false });

api.interceptors.request.use((config) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

export function setToken(token) {
    if (token) localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
}
export function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

export function formatApiErrorDetail(detail) {
    if (detail == null) return "Something went wrong. Please try again.";
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail))
        return detail
            .map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e)))
            .filter(Boolean)
            .join(" ");
    if (detail && typeof detail.msg === "string") return detail.msg;
    return String(detail);
}

export default api;
