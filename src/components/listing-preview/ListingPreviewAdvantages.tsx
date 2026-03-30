type Props = {
  items: string[];
};

export function ListingPreviewAdvantages({ items }: Props) {
  return (
    <ul className="list-disc pl-5 text-sm text-slate-200">
      {items.map((a, idx) => (
        <li key={`${a}-${idx}`} className="my-1">
          {a}
        </li>
      ))}
    </ul>
  );
}

