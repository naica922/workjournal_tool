import styles from "@/app/settings/settings.module.css";

// Profile summary card from the mobile mock: avatar, name, email, role.
export function ProfileHeader({
  name,
  email,
  role,
}: {
  name: string;
  email: string;
  role: "apprentice" | "host";
}) {
  const initial = (name.trim()[0] ?? "?").toUpperCase();

  return (
    <section className={styles.profileHeader}>
      <span className={styles.profileAvatar} aria-hidden="true">
        {initial}
      </span>
      <h2 className={`${styles.profileName} title-medium`}>{name}</h2>
      <p className={`${styles.profileMeta} body-medium`}>{email}</p>
      <p className={`${styles.profileMeta} body-small`}>
        {role === "host" ? "Host" : "Apprentice"}
      </p>
    </section>
  );
}
