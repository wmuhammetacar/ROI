import type { ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  title?: string;
  children: ReactNode;
  actions?: ReactNode;
  onClose: () => void;
}

export function Modal({ open, title, children, actions, onClose }: ModalProps) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modal-header">
          <div>
            {title ? <h3>{title}</h3> : null}
          </div>
          <button type="button" className="ghost" onClick={onClose} aria-label="Close">
            Close
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {actions ? <div className="modal-actions">{actions}</div> : null}
      </div>
    </div>
  );
}
