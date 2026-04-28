import { useEffect, useRef } from "react";

export interface ContextMenuItem {
	label: string;
	onClick: () => void;
	danger?: boolean;
	disabled?: boolean;
	separator?: false;
}

export interface ContextMenuSeparator {
	separator: true;
}

export type ContextMenuEntry = ContextMenuItem | ContextMenuSeparator;

interface ContextMenuProps {
	x: number;
	y: number;
	items: ContextMenuEntry[];
	onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
	const menuRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		function handleClick(e: MouseEvent) {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				onClose();
			}
		}
		function handleKey(e: KeyboardEvent) {
			if (e.key === "Escape") onClose();
		}
		window.addEventListener("mousedown", handleClick);
		window.addEventListener("keydown", handleKey);
		return () => {
			window.removeEventListener("mousedown", handleClick);
			window.removeEventListener("keydown", handleKey);
		};
	}, [onClose]);

	useEffect(() => {
		if (!menuRef.current) return;
		const rect = menuRef.current.getBoundingClientRect();
		const vw = window.innerWidth;
		const vh = window.innerHeight;
		if (rect.right > vw) {
			menuRef.current.style.left = `${Math.max(0, x - rect.width)}px`;
		}
		if (rect.bottom > vh) {
			menuRef.current.style.top = `${Math.max(0, y - rect.height)}px`;
		}
	}, [x, y]);

	return (
		<div
			ref={menuRef}
			className="fixed z-[200] min-w-[180px] rounded-lg border border-slate-200 bg-white py-1 shadow-xl"
			style={{ left: x, top: y }}
		>
			{items.map((item, i) => {
				if (item.separator) {
					return <div key={`sep-${i}`} className="my-1 border-t border-slate-100" />;
				}
				return (
					<button
						key={`${item.label}-${i}`}
						type="button"
						disabled={item.disabled}
						className={`w-full px-3 py-1.5 text-left text-sm transition-colors disabled:opacity-40 ${
							item.danger ? "text-red-600 hover:bg-red-50" : "text-slate-700 hover:bg-slate-100"
						}`}
						onClick={() => {
							item.onClick();
							onClose();
						}}
					>
						{item.label}
					</button>
				);
			})}
		</div>
	);
}
