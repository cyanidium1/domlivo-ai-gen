import Link from "next/link";
import { QuickLinksCard } from "@/components/dashboard/QuickLinksCard";
import { ContentCard } from "@/components/dashboard/ContentCard";
import styles from "@/components/dashboard/dashboard.module.css";

export default function HomePage() {
  return (
    <div className={styles.stack}>
      <ContentCard title="Welcome">
        <p className={styles.muted}>
          Use the sidebar to navigate project sections. Start with a new listing session.
        </p>
        <Link className={styles.utilityLink} href="/listing-sessions/new">
          Open Listing Sessions
        </Link>
      </ContentCard>
      <QuickLinksCard />
    </div>
  );
}
