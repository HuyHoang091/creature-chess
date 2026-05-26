import React from "react";
import { X, CheckCircle, AlertTriangle } from "lucide-react";

import styles from "./App.module.css";

// --- Modal ---

export const Modal = ({
	title,
	children,
	headerExtras,
	footer,
	onClose,
	wide = false,
}: {
	title: string;
	children: React.ReactNode;
	headerExtras?: React.ReactNode;
	footer?: React.ReactNode;
	onClose: () => void;
	wide?: boolean;
}) => (
	<div className={styles.modalBackdrop} onClick={onClose}>
		<div
			className={`${styles.modal} ${wide ? styles.modalWide : ""}`}
			onClick={(event) => event.stopPropagation()}
		>
			<div className={styles.modalHeader}>
				<div className={styles.modalHeaderTop}>
					<h3>{title}</h3>
					<button type="button" className={styles.ghostButton} onClick={onClose} aria-label="Close">
						<X size={18} />
					</button>
				</div>
				{headerExtras}
			</div>
			<div className={styles.modalBody}>{children}</div>
			{footer && <div className={styles.modalFooter}>{footer}</div>}
		</div>
	</div>
);

// --- StatCard ---

export const StatCard = ({
	label,
	value,
	description,
}: {
	label: string;
	value: string | number;
	description?: string;
}) => (
	<div className={styles.statCard}>
		<div className={styles.statLabel}>{label}</div>
		<div className={styles.statValue}>{value}</div>
		{description ? <div className={styles.statMeta}>{description}</div> : null}
	</div>
);

// --- Toast ---

export type ToastItem = {
	id: number;
	message: string;
	type: "success" | "error";
};

export const useToast = () => {
	const [toasts, setToasts] = React.useState<ToastItem[]>([]);
	const idRef = React.useRef(0);

	const show = React.useCallback((message: string, type: "success" | "error" = "success") => {
		const id = ++idRef.current;
		setToasts((prev) => [...prev, { id, message, type }]);
		setTimeout(() => {
			setToasts((prev) => prev.filter((t) => t.id !== id));
		}, 3500);
	}, []);

	return { toasts, show };
};

export const ToastContainer = ({ toasts }: { toasts: ToastItem[] }) => {
	if (toasts.length === 0) return null;
	return (
		<div className={styles.toastContainer}>
			{toasts.map((toast) => (
				<div
					key={toast.id}
					className={`${styles.toast} ${toast.type === "error" ? styles.toastError : styles.toastSuccess}`}
				>
					{toast.type === "success" ? (
						<CheckCircle size={16} />
					) : (
						<AlertTriangle size={16} />
					)}
					<span>{toast.message}</span>
				</div>
			))}
		</div>
	);
};
