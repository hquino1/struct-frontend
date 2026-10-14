import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Modal({
  title,
  label,
  onClose,
  children,
}: {
  title: string;
  label?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={label ?? title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <Button variant="ghost" size="icon" title="Close dialog" onClick={onClose}>
            <X />
          </Button>
        </div>
        {children}
      </section>
    </div>
  );
}
