import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api, { setToken, clearToken, formatApiErrorDetail } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(undefined); // undefined = loading, null = anon, object = authed

    const loadMe = useCallback(async () => {
        if (!localStorage.getItem("nexus_token")) {
            setUser(null);
            return;
        }
        try {
            const { data } = await api.get("/auth/me");
            setUser(data);
        } catch {
            setUser(null);
        }
    }, []);

    useEffect(() => {
        loadMe();
    }, [loadMe]);

    const login = async (email, password) => {
        const { data } = await api.post("/auth/login", { email, password });
        setToken(data.access_token);
        setUser(data.user);
        return data.user;
    };

    const register = async (name, email, password) => {
        const { data } = await api.post("/auth/register", { name, email, password });
        setToken(data.access_token);
        setUser(data.user);
        return data.user;
    };

    const logout = async () => {
        try {
            await api.post("/auth/logout");
        } catch {
            /* ignore */
        }
        clearToken();
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, register, logout, formatApiErrorDetail }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
