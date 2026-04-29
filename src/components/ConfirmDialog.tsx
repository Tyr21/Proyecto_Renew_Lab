import { useEffect, useId, useRef, type ReactNode } from "react";

export interface ConfirmDialogProps {
	open: boolean;
	title: string;
	message: ReactNode;
	confirmLabel: string;
	cancelLabel?: string;
	variant?: "default" | "danger";
	onConfirm: () => void;
	onCancel: () => void;
}

/**
 * Diálogo modal accesible (sin window.confirm). El overlay cierra con Escape o clic fuera.
 */
export function ConfirmDialog({
	open,
	title,
	message,
	confirmLabel,
	cancelLabel = "Cancelar",
	variant = "default",
	onConfirm,
	onCancel,
}: ConfirmDialogProps) {
	const titleId = useId();
	const descId = useId();
	const cancelRef = useRef<HTMLButtonElement>(null);
	const prevFocus = useRef<Element | null>(null);
	const onCancelRef = useRef(onCancel);
	onCancelRef.current = onCancel;

	useEffect(() => {
		if (!open) return;
		prevFocus.current = document.activeElement;
		queueMicrotask(() => cancelRef.current?.focus());
		return () => {
			if (prevFocus.current instanceof HTMLElement) prevFocus.current.focus();
		};
	}, [open]);

	useEffect(() => {
		if (!open) return;
		function onDocKey(e: KeyboardEvent) {
			if (e.key === "Escape") {
				e.preventDefault();
				onCancelRef.current();
			}
		}
		document.addEventListener("keydown", onDocKey);
		return () => document.removeEventListener("keydown", onDocKey);
	}, [open]);

	if (!open) return null;

	const confirmClass =
		variant === "danger"
			? "rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
			: "rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700";

	return (
		<div
			className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 p-4"
			role="dialog"
			aria-modal="true"
			aria-labelledby={titleId}
			aria-describedby={descId}
			onClick={(e) => {
				if (e.target === e.currentTarget) onCancel();
			}}
		>
			<div
				className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl"
				onClick={(e) => e.stopPropagation()}
			>
				<h2 id={titleId} className="text-lg font-semibold text-slate-800">
					{title}
				</h2>
				<div id={descId} className="mt-2 text-sm text-slate-600">
					{message}
				</div>
				<div className="mt-5 flex justify-end gap-2">
					<button
						ref={cancelRef}
						type="button"
						onClick={onCancel}
						className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
					>
						{cancelLabel}
					</button>
					<button type="button" onClick={onConfirm} className={confirmClass}>
						{confirmLabel}
					</button>
				</div>
			</div>
		</div>
	);
}
