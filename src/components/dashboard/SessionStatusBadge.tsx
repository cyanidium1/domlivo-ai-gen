import styles from "@/components/dashboard/dashboard.module.css";

type SessionStatusBadgeProps = {
  status?: string | null;
};

export function SessionStatusBadge({ status }: SessionStatusBadgeProps) {
  const value = status ?? "loading";
  const variantClass =
    value === "published"
      ? styles.statusPublished
      : value === "failed"
        ? styles.statusFailed
        : "";

  return <span className={`${styles.status} ${variantClass}`}>{value}</span>;
}

