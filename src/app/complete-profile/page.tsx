import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { isProfileComplete } from "@/lib/apprenticeship";
import { CompleteProfileForm } from "@/components/auth/complete-profile-form";

export const metadata = { title: "Complete your profile - Arbeitsjournal Tool" };

export default async function CompleteProfilePage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  if (isProfileComplete(session.user)) {
    redirect("/");
  }

  const name = session.user.name?.trim() ?? "";
  const [firstName, ...rest] = name.split(" ");

  return (
    <CompleteProfileForm
      initialFirstName={firstName ?? ""}
      initialLastName={rest.join(" ")}
    />
  );
}
