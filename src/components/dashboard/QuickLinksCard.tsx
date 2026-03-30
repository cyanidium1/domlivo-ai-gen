import styles from "@/components/dashboard/dashboard.module.css";

export function QuickLinksCard() {
  return (
    <div className={styles.card}>
      <h3 className={styles.cardTitle}>Quick Links</h3>
      <a className={styles.utilityLink} href="http://localhost:3333" target="_blank" rel="noreferrer">
        Sanity Studio
      </a>
      <a className={styles.utilityLink} href="http://localhost:3000" target="_blank" rel="noreferrer">
        Domlivo Frontend
      </a>
      <a className={styles.utilityLink} href="#">
        Published Objects (placeholder)
      </a>
    </div>
  );
}

