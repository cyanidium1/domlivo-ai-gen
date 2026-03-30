type PreviewProps = {
  data: unknown;
  title: string;
};

export function Preview({ data, title }: PreviewProps) {
  return (
    <div style={{ border: "1px solid #ddd", padding: 12, borderRadius: 8 }}>
      <h3>{title}</h3>
      <pre
        style={{
          background: "#f7f7f7",
          padding: 12,
          borderRadius: 8,
          overflowX: "auto",
          fontSize: 12,
        }}
      >
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
