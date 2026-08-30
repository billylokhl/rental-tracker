import { useEffect, useRef } from 'preact/hooks';

/**
 * Floating toast notification with optional action buttons.
 * Auto-dismisses after `duration` ms.
 */
export function Toast({ toast, onDismiss }) {
  const timerRef = useRef(null);

  useEffect(() => {
    if (!toast) return;
    timerRef.current = setTimeout(onDismiss, toast.duration || 5000);
    return () => clearTimeout(timerRef.current);
  }, [toast, onDismiss]);

  if (!toast) return null;

  return (
    <div className="app-toast visible">
      <span style={{ fontWeight: 500 }}>{toast.message}</span>
      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginLeft: 'auto' }}>
        {toast.actionLabel && (
          <button
            style={{ background: '#38bdf8', color: '#0f172a', fontWeight: 700, border: 'none', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '11.5px' }}
            onClick={() => { toast.onAction?.(); onDismiss(); }}
          >
            {toast.actionLabel}
          </button>
        )}
        {toast.secondaryLabel && (
          <button
            style={{ background: 'rgba(255,255,255,0.1)', color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '11px' }}
            onClick={() => { toast.onSecondary?.(); onDismiss(); }}
          >
            {toast.secondaryLabel}
          </button>
        )}
        <button
          style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '18px', lineHeight: 1, cursor: 'pointer', padding: '0 4px', marginLeft: '2px' }}
          onClick={onDismiss}
        >
          ×
        </button>
      </div>
    </div>
  );
}
