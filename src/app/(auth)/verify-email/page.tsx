import { redirect } from "next/navigation";
import { VerifyEmailForm } from "@/components/auth/verify-email-form";

export const metadata = { title: "Verify email - Arbeitsjournal Tool" };

export default async function VerifyEmailPage(
  props: PageProps<"/verify-email">,
) {
  const { email } = await props.searchParams;
  if (!email || typeof email !== "string") {
    redirect("/login");
  }

  return <VerifyEmailForm email={email} />;
}
