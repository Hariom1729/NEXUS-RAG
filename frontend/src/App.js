import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Toaster } from "@/components/ui/sonner";
import Login from "@/pages/Login";
import Chat from "@/pages/Chat";
import Compare from "@/pages/Compare";
import Ingest from "@/pages/Ingest";
import KnowledgeBase from "@/pages/KnowledgeBase";
import Dashboard from "@/pages/Dashboard";
import SystemStatus from "@/pages/SystemStatus";
import Settings from "@/pages/Settings";
import Admin from "@/pages/Admin";
import Playground from "@/pages/Playground";
import Inspector from "@/pages/Inspector";

function Splash() {
    return (
        <div className="flex h-screen items-center justify-center bg-background">
            <Loader2 className="animate-spin text-path-text" size={28} />
        </div>
    );
}

function Protected({ children, admin }) {
    const { user } = useAuth();
    if (user === undefined) return <Splash />;
    if (!user) return <Navigate to="/login" replace />;
    if (admin && user.role !== "admin") return <Navigate to="/chat" replace />;
    return children;
}

function Public({ children }) {
    const { user } = useAuth();
    if (user === undefined) return <Splash />;
    if (user) return <Navigate to="/chat" replace />;
    return children;
}

function App() {
    return (
        <div className="App">
            <AuthProvider>
                <BrowserRouter>
                    <Routes>
                        <Route path="/login" element={<Public><Login /></Public>} />
                        <Route path="/chat" element={<Protected><Chat /></Protected>} />
                        <Route path="/compare" element={<Protected><Compare /></Protected>} />
                        <Route path="/ingest" element={<Protected><Ingest /></Protected>} />
                        <Route path="/knowledge" element={<Protected><KnowledgeBase /></Protected>} />
                        <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
                        <Route path="/playground" element={<Protected><Playground /></Protected>} />
                        <Route path="/inspector" element={<Protected><Inspector /></Protected>} />
                        <Route path="/system" element={<Protected><SystemStatus /></Protected>} />
                        <Route path="/settings" element={<Protected><Settings /></Protected>} />
                        <Route path="/admin" element={<Protected admin><Admin /></Protected>} />
                        <Route path="*" element={<Navigate to="/chat" replace />} />
                    </Routes>
                </BrowserRouter>
                <Toaster position="top-right" richColors theme="dark" />
            </AuthProvider>
        </div>
    );
}

export default App;
