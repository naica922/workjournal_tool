import { LoginForm } from "@/components/auth/login-form";
import { googleEnabled } from "@/lib/auth";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return <LoginForm googleEnabled={googleEnabled} />;
}
