/** Mensaje legible desde errores de invoke (Tauri) u otros valores desconocidos */
export function formatInvokeError(err: unknown): string {
	if (typeof err === "string") return err;
	if (err instanceof Error) return err.message;
	if (
		err &&
		typeof err === "object" &&
		"message" in err &&
		typeof (err as { message: unknown }).message === "string"
	) {
		return (err as { message: string }).message;
	}
	return String(err);
}
