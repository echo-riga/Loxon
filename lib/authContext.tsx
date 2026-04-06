import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type User = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "supervisor" | "engineer";
  team_id: number | null;
};

type AuthContextType = {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function restore() {
      try {
        const storedToken = await AsyncStorage.getItem("worktrace_token");
        const storedUser = await AsyncStorage.getItem("worktrace_user");
        console.log("restore:", storedUser); // ← add this
        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
        }
      } catch (e) {
        // corrupted storage, ignore
      } finally {
        setLoading(false);
      }
    }
    restore();
  }, []);

  async function login(token: string, user: User) {
    await AsyncStorage.setItem("worktrace_token", token);
    await AsyncStorage.setItem("worktrace_user", JSON.stringify(user));
    console.log("login saved:", user.role, user.email); // ← add this
    setToken(token);
    setUser(user);
  }

  async function logout() {
    await AsyncStorage.removeItem("worktrace_token");
    await AsyncStorage.removeItem("worktrace_user");
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
