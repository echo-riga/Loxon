import {
  View,
  StyleSheet,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  ScrollView,
  Image,
} from "react-native";
import { useState, useEffect } from "react";
import { router } from "expo-router";
import { Text, TextInput, Button } from "react-native-paper";
import { useAuth } from "@/lib/authContext";
import { apiFetch } from "@/lib/api";

const { width } = Dimensions.get("window");
const isTablet = width >= 768;

export default function LoginScreen() {
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [error, setError] = useState("");

  function validate() {
    let valid = true;
    if (!email) {
      setEmailError("Email is required.");
      valid = false;
    } else setEmailError("");
    if (!password) {
      setPasswordError("Password is required.");
      valid = false;
    } else setPasswordError("");
    return valid;
  }

  async function handleLogin() {
    if (!validate()) return;
    setError("");
    setLoading(true);

    try {
      const res = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      console.log("Login response:", res); // add this
      if (!res) {
        setError("Could not reach the server. Check your connection.");
        return;
      }

      if (res.message && !res.token) {
        setError(res.message);
        return;
      }
      const { token, user } = res;
      await login(token, user);
      // ✅ RootRedirect will automatically navigate based on user.role
    } catch (e) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#f0f9ff" />
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topBar} />

          <View style={styles.brandSection}>
            <Image
              source={require("@/assets/images/loxon_logo.png")}
              style={[styles.logo, isTablet && styles.logoTablet]}
              resizeMode="contain"
            />
            <Text
              style={[styles.companyName, isTablet && styles.companyNameTablet]}
            >
              LOXON PHILIPPINES INC.
            </Text>
            <Text style={[styles.appName, isTablet && styles.appNameTablet]}>
              WorkTrace
            </Text>
            <View
              style={[
                styles.appNameUnderline,
                isTablet && styles.appNameUnderlineTablet,
              ]}
            />
            <Text style={[styles.tagline, isTablet && styles.taglineTablet]}>
              Workforce Management System
            </Text>
          </View>

          <View style={[styles.card, isTablet && styles.cardTablet]}>
            <Text
              style={[styles.cardTitle, isTablet && styles.cardTitleTablet]}
            >
              Sign In
            </Text>
            <Text
              style={[
                styles.cardSubtitle,
                isTablet && styles.cardSubtitleTablet,
              ]}
            >
              Use your company credentials to continue.
            </Text>

            {!!error && <Text style={styles.globalError}>{error}</Text>}

            <TextInput
              label="Email Address"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              mode="outlined"
              style={[styles.input, isTablet && styles.inputTablet]}
              outlineColor="#cbd5e1"
              activeOutlineColor="#18B4E8"
              error={!!emailError}
              left={<TextInput.Icon icon="email-outline" color="#94a3b8" />}
            />
            {!!emailError && <Text style={styles.errorText}>{emailError}</Text>}

            <TextInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              mode="outlined"
              style={[styles.input, isTablet && styles.inputTablet]}
              outlineColor="#cbd5e1"
              activeOutlineColor="#18B4E8"
              error={!!passwordError}
              left={<TextInput.Icon icon="lock-outline" color="#94a3b8" />}
              right={
                <TextInput.Icon
                  icon={showPassword ? "eye-off-outline" : "eye-outline"}
                  color="#94a3b8"
                  onPress={() => setShowPassword((v) => !v)}
                />
              }
            />
            {!!passwordError && (
              <Text style={styles.errorText}>{passwordError}</Text>
            )}

            <Button
              mode="contained"
              onPress={handleLogin}
              loading={loading}
              disabled={loading}
              style={styles.loginBtn}
              contentStyle={[
                styles.loginBtnContent,
                isTablet && styles.loginBtnContentTablet,
              ]}
              labelStyle={[
                styles.loginBtnLabel,
                isTablet && styles.loginBtnLabelTablet,
              ]}
            >
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </View>

          <Text style={[styles.footer, isTablet && styles.footerTablet]}>
            © {new Date().getFullYear()} Loxon Philippines Inc. All rights
            reserved.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f0f9ff" },
  scrollContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: "#18B4E8",
  },
  brandSection: {
    alignItems: "center",
    marginBottom: 32,
    width: "100%",
    maxWidth: 480,
  },
  logo: { width: 64, height: 64, marginBottom: 12 },
  logoTablet: { width: 88, height: 88, marginBottom: 16 },
  companyName: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2.5,
    color: "#64748b",
    marginBottom: 6,
  },
  companyNameTablet: { fontSize: 12, letterSpacing: 3 },
  appName: {
    fontSize: 32,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.5,
  },
  appNameTablet: { fontSize: 44 },
  appNameUnderline: {
    width: 40,
    height: 3,
    backgroundColor: "#18B4E8",
    borderRadius: 2,
    marginTop: 6,
    marginBottom: 8,
  },
  appNameUnderlineTablet: {
    width: 56,
    height: 4,
    marginTop: 8,
    marginBottom: 10,
  },
  tagline: {
    fontSize: 12,
    color: "#94a3b8",
    letterSpacing: 0.5,
    fontWeight: "500",
  },
  taglineTablet: { fontSize: 14 },
  card: {
    width: "100%",
    maxWidth: 480,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 24,
    shadowColor: "#0ea5e9",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
  },
  cardTablet: { maxWidth: 520, borderRadius: 20, padding: 36 },
  cardTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 4,
  },
  cardTitleTablet: { fontSize: 26, marginBottom: 6 },
  cardSubtitle: { fontSize: 13, color: "#94a3b8", marginBottom: 20 },
  cardSubtitleTablet: { fontSize: 15, marginBottom: 28 },
  globalError: {
    fontSize: 13,
    color: "#ef4444",
    marginBottom: 12,
    textAlign: "center",
  },
  input: { backgroundColor: "#ffffff", marginBottom: 4, fontSize: 14 },
  inputTablet: { fontSize: 16, marginBottom: 6 },
  errorText: { fontSize: 11, color: "#ef4444", marginBottom: 8, marginLeft: 4 },
  loginBtn: { borderRadius: 10, marginTop: 4, backgroundColor: "#18B4E8" },
  loginBtnContent: { height: 48 },
  loginBtnContentTablet: { height: 56 },
  loginBtnLabel: { fontSize: 15, fontWeight: "700", letterSpacing: 0.5 },
  loginBtnLabelTablet: { fontSize: 17 },
  footer: {
    marginTop: 24,
    fontSize: 11,
    color: "#94a3b8",
    textAlign: "center",
  },
  footerTablet: { fontSize: 13, marginTop: 32 },
});
