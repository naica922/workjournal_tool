import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getProfile } from "@/server/settings";
import { AppShell } from "@/components/app-shell";
import { ProfileForm } from "@/components/settings/profile-form";
import { HostsSection } from "@/components/settings/hosts-section";
import { HostDashboard } from "@/components/settings/host-dashboard";
import styles from "./settings.module.css";

export const metadata = { title: "Settings - Arbeitsjournal Tool" };

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  const profile = await getProfile();

  return (
    <AppShell active="settings">
      <div className={styles.page}>
        <h1 className={`${styles.heading} headline-small`}>Settings</h1>
        <ProfileForm profile={profile} />
        {profile.role === "apprentice" ? <HostsSection /> : <HostDashboard />}
      </div>
    </AppShell>
  );
}
