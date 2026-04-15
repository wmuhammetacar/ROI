import type { ReactNode } from 'react';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function Modal({ title, onClose, children }: ModalProps) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-panel">
        <header className="modal-header">
          <h3>{title}</h3>
          <button type="button" className="ghost" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="modal-content">{children}</div>
      </div>
    </div>
  );
}
