import { ConfirmDialog } from "./ConfirmDialog";

export const UNSAVED_SETTINGS_LEAVE_TITLE = "Cambios sin guardar";

export const UNSAVED_SETTINGS_LEAVE_MESSAGE =
	"Hay cambios sin guardar en la configuración. ¿Salir sin guardar?";

interface UnsavedSettingsLeaveDialogProps {
	open: boolean;
	onConfirm: () => void;
	onCancel: () => void;
}

/** Misma copia y acciones que App.tsx (tabs) y SettingsPanel (cerrar / cancelar). */
export function UnsavedSettingsLeaveDialog({
	open,
	onConfirm,
	onCancel,
}: UnsavedSettingsLeaveDialogProps) {
	return (
		<ConfirmDialog
			open={open}
			title={UNSAVED_SETTINGS_LEAVE_TITLE}
			message={UNSAVED_SETTINGS_LEAVE_MESSAGE}
			confirmLabel="Salir sin guardar"
			cancelLabel="Cancelar"
			variant="danger"
			onConfirm={onConfirm}
			onCancel={onCancel}
		/>
	);
}
