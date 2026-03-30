import { Form } from "@/components/listing-session/Form";
import { ContentCard } from "@/components/dashboard/ContentCard";
import styles from "@/components/dashboard/dashboard.module.css";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ListingSessionPage({ params }: Props) {
  const { id } = await params;
  return (
    <div className={styles.stack}>
      <ContentCard title="Listing Session Editor" subtitle="Internal operator workspace for listing intake and publishing.">
        <p className={styles.muted}>Session ID: {id}</p>
      </ContentCard>
      <Form sessionId={id} />
    </div>
  );
}
