import { C, R } from '../theme';

type Props = {
  isLoading: boolean;
  error: string;
  onRetry: () => void;
  isEmpty: boolean;
  emptyText: string;
};

// Bedakan "gagal memuat" dari "memang kosong": gagal selalu menyebut sebab dan memberi Coba lagi.
export default function LoadState({ isLoading, error, onRetry, isEmpty, emptyText }: Props) {
  if (error) {
    return (
      <div role="alert" style={alertBox}>
        Gagal memuat: {error}
        <button type="button" onClick={onRetry} style={retryBtn}>Coba lagi</button>
      </div>
    );
  }
  if (isLoading) return <p style={note} aria-live="polite">Memuat…</p>;
  if (isEmpty) return <p style={note}>{emptyText}</p>;
  return null;
}

const alertBox: React.CSSProperties = { marginTop: 16, padding: 12, background: C.card, border: `1px solid ${C.danger}`, borderRadius: R.md, fontSize: 14, color: C.text };
const retryBtn: React.CSSProperties = { marginLeft: 8, background: 'none', border: 'none', color: C.primary, fontWeight: 700, cursor: 'pointer', fontSize: 14 };
const note: React.CSSProperties = { marginTop: 16, fontSize: 13, color: C.muted };
