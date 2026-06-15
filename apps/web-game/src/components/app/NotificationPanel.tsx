import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { X } from "lucide-react";

import { NotificationCommands } from "~/store/notifications/state";
import { AppState } from "~/store/state";

import styles from "./NotificationPanel.module.css";

export const NotificationPanel = ({ onClose }: { onClose: () => void }) => {
	const dispatch = useDispatch();
	const notifications = useSelector((state: AppState) => state.notifications.items);

	const unreadCount = notifications.filter((n) => !n.read).length;

	return (
		<div className={styles.overlay} onClick={onClose}>
			<div className={styles.panel} onClick={(e) => e.stopPropagation()}>
				<div className={styles.header}>
					<div className={styles.title}>Notifications</div>
					<button className={styles.closeBtn} onClick={onClose} title="Close">
						<X size={16} />
					</button>
				</div>
				{notifications.length === 0 ? (
					<div className={styles.empty}>No notifications</div>
				) : (
					<div className={styles.list}>
						{notifications.map((item) => (
							<div
								key={item.id}
								className={`${styles.item} ${!item.read ? styles.unread : ""}`}
							>
								<div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
									<div className={styles.message}>{item.message}</div>
									{item.data?.type === "game_event" && item.data?.pageSlug && (
										<a
											href={`/events/${item.data.pageSlug}`}
											target="_blank"
											rel="noopener noreferrer"
											style={{
												fontSize: '12px',
												color: 'var(--primary-color)',
												textDecoration: 'none',
												fontWeight: 'bold',
												background: 'rgba(59, 130, 246, 0.1)',
												padding: '4px 8px',
												borderRadius: '4px',
												display: 'inline-flex',
												alignItems: 'center',
												gap: '4px',
												alignSelf: 'flex-start'
											}}
											onClick={() => dispatch(NotificationCommands.markRead(item.id))}
										>
											View Event
										</a>
									)}
								</div>
								<button
									className={styles.removeBtn}
									onClick={() =>
										dispatch(NotificationCommands.markRead(item.id))
									}
									title="Dismiss"
								>
									<X size={14} />
								</button>
							</div>
						))}
					</div>
				)}
				{unreadCount > 0 && (
					<button
						className={styles.clearAll}
						onClick={() => dispatch(NotificationCommands.setNotifications([]))}
					>
						Clear all
					</button>
				)}
			</div>
		</div>
	);
};
