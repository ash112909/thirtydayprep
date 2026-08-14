import { useState } from "react";
import { Text, TextInput, View, KeyboardAvoidingView, Platform } from "react-native";
import { Link } from "expo-router";
import { supabase } from "@/lib/supabase";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useThemedStyles } from "@/hooks/useThemedStyles";

export default function SignUp() {
  const { styles, colors } = useThemedStyles((colors) => ({
    container: { flex: 1, backgroundColor: colors.background, padding: 24, justifyContent: "center" },
    title: { fontSize: 28, fontWeight: "800", color: colors.text, marginBottom: 4 },
    subtitle: { fontSize: 15, color: colors.textMuted, marginBottom: 32 },
    input: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 14,
      color: colors.text,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    error: { color: colors.danger, marginBottom: 12 },
    link: { marginTop: 20, alignSelf: "center" },
    linkText: { color: colors.primary },
  }));
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);

  async function handleSignUp() {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) {
      setError(error.message);
    } else if (!data.session) {
      setConfirmationSent(true);
    }
    setLoading(false);
  }

  if (confirmationSent) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.subtitle}>
          We sent a confirmation link to {email}. Confirm your email, then log in.
        </Text>
        <Link href="/(auth)/sign-in" style={styles.link}>
          <Text style={styles.linkText}>Back to log in</Text>
        </Link>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Text style={styles.title}>Create your account</Text>
      <Text style={styles.subtitle}>Tell us who you are and we'll build your study plan.</Text>

      <TextInput
        style={styles.input}
        placeholder="Full name"
        placeholderTextColor={colors.textMuted}
        value={fullName}
        onChangeText={setFullName}
      />
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password (min 6 characters)"
        placeholderTextColor={colors.textMuted}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <PrimaryButton
        title="Sign up"
        onPress={handleSignUp}
        loading={loading}
        disabled={!email || password.length < 6}
      />

      <Link href="/(auth)/sign-in" style={styles.link}>
        <Text style={styles.linkText}>Already have an account? Log in</Text>
      </Link>
    </KeyboardAvoidingView>
  );
}
