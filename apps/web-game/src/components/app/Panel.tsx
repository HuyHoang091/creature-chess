import React from "react";
import { useDispatch } from "react-redux";
import { X } from "lucide-react";

import { AppShellCommands } from "~/store/appShell/state";

import styles from "./Panel.module.css";

export const Panel = ({
	title,
	children,
	onClose,
}: {
	title: string;
	children: React.ReactNode;
	onClose?: () => void;
}) => {
	const dispatch = useDispatch();

	const handleClose = () => {
		dispatch(AppShellCommands.setPanel(null));
		onClose?.();
	};

	return (
		<div className={styles.overlay} onClick={handleClose}>
			<div className={styles.panel} onClick={(e) => e.stopPropagation()}>
				<div className={styles.header}>
					<div className={styles.title}>{title}</div>
					<button className={styles.closeBtn} onClick={handleClose}>
						<X size={18} />
					</button>
				</div>
				<div className={styles.body}>{children}</div>
			</div>
		</div>
	);
};
