export default function Loading({ label = 'Inhalte werden geladen …' }) {
  return <div className="loading"><span className="spinner" />{label}</div>;
}
