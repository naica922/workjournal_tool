"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { updateRole } from "@/server/settings";
import styles from "@/app/settings/settings.module.css";

// Lets a former apprentice who now supervises apprentices switch to the host
// role (and back). The journal history stays on the account either way.
export function RoleCard({ role }: { role: "apprentice" | "host" }) {
  const router = useRouter();
  const isHost = role === "host";

  const mutation = useMutation({
    mutationFn: updateRole,
    // Server components (sidebar, settings sections) depend on the role.
    onSuccess: () => router.refresh(),
  });

  return (
    <section className={styles.card}>
      <h2 className={`${styles.cardTitle} title-medium`}>Role</h2>
      <p className={`${styles.empty} body-medium`}>
        {isHost
          ? "You are a host. You can review your apprentices' journals and still browse your own journal from your apprentice days."
          : "You are an apprentice. If you now supervise apprentices yourself, switch to the host role - your journal history stays on your account."}
      </p>
      {mutation.isError && (
        <p className={`${styles.error} body-medium`}>
          {(mutation.error as Error).message}
        </p>
      )}
      <div className={styles.actions}>
        <md-outlined-button
          type="button"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate(isHost ? "apprentice" : "host")}
        >
          {isHost ? "Switch back to apprentice" : "I now supervise apprentices"}
        </md-outlined-button>
      </div>
    </section>
  );
}
