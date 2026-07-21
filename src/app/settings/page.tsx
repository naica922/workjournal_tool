import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getProfile } from "@/server/settings";
import { AppShell } from "@/components/app-shell";
import { ProfileForm } from "@/components/settings/profile-form";
import { HostsSection } from "@/components/settings/hosts-section";
import { RoleCard } from "@/components/settings/role-card";
import styles from "./settings.module.css";

export const metadata = { title: "Settings - Arbeitsjournal Tool" };

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  const profile = await getProfile();
  const role = profile.role === "host" ? "host" : "apprentice";

  return (
    <AppShell active="settings" role={role}>
      <div className={styles.page}>
        <h1 className={`${styles.heading} headline-small`}>Settings</h1>
        <ProfileForm profile={profile} />
        {role === "apprentice" && <HostsSection />}
        <RoleCard role={role} />
      </div>
    </AppShell>
  );
}
