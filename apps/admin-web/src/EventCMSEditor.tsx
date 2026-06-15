import React, { useState, useEffect, useCallback } from "react";
import { Plus, Trash, GripVertical, Radio, ExternalLink, RefreshCw } from "lucide-react";
import { adminApi, AdminEvent, EventPageSection, EventTask, EventReward } from "./api";
import styles from "./EventCMSEditor.module.css";
import { Modal } from "./components";

type EventCMSEditorProps = {
	token: string;
	lang: "vi" | "en";
	t: (key: any) => string;
	showToast: (msg: string, type: "success" | "error") => void;
};

const DEFAULT_SECTIONS: EventPageSection[] = [
	{ id: "banner", type: "banner", order: 0, visible: true },
	{ id: "countdown", type: "countdown", order: 1, visible: true },
	{ id: "description", type: "description", order: 2, visible: true },
	{ id: "tasks", type: "tasks", order: 3, visible: true },
	{ id: "rewards", type: "rewards", order: 4, visible: true },
];

export const EventCMSEditor: React.FC<EventCMSEditorProps> = ({ token, lang, t, showToast }) => {
	const [events, setEvents] = useState<AdminEvent[]>([]);
	const [loading, setLoading] = useState(false);
	const [editingEvent, setEditingEvent] = useState<AdminEvent | null>(null);

	const loadEvents = useCallback(async () => {
		setLoading(true);
		try {
			const payload = await adminApi.events(token);
			setEvents(payload.events);
		} catch (error) {
			showToast((error as Error).message, "error");
		} finally {
			setLoading(false);
		}
	}, [token, showToast]);

	useEffect(() => {
		loadEvents();
	}, [loadEvents]);

	const onSaveEvent = async (eventData: Partial<AdminEvent>) => {
		try {
			if (editingEvent?.id) {
				await adminApi.updateEvent(token, editingEvent.id, eventData);
				showToast("Event updated successfully", "success");
			} else {
				await adminApi.createEvent(token, eventData as any);
				showToast("Event created successfully", "success");
			}
			setEditingEvent(null);
			loadEvents();
		} catch (error) {
			showToast((error as Error).message, "error");
		}
	};

	const onDeleteEvent = async (id: string) => {
		if (!window.confirm("Are you sure you want to delete this event?")) return;
		try {
			await adminApi.deleteEvent(token, id);
			showToast("Event deleted", "success");
			loadEvents();
		} catch (error) {
			showToast((error as Error).message, "error");
		}
	};

	const onBroadcast = async (id: string) => {
		if (!window.confirm("Broadcast notification to all active players?")) return;
		try {
			const res = await adminApi.broadcastEventNotification(token, id);
			showToast(`Broadcast sent to ${res.sent} players`, "success");
		} catch (error) {
			showToast((error as Error).message, "error");
		}
	};

	if (editingEvent) {
		return (
			<EventEditor
				event={editingEvent}
				onSave={onSaveEvent}
				onCancel={() => setEditingEvent(null)}
				lang={lang}
				t={t}
			/>
		);
	}

	return (
		<div className={styles.root}>
			<div className={styles.toolbar}>
				<button className={styles.ghostButton} onClick={loadEvents} disabled={loading}>
					<RefreshCw size={16} />
					<span>{t("reload")}</span>
				</button>
				<button
					className={styles.primaryButton}
					onClick={() =>
						setEditingEvent({
							id: "",
							name: "New Event",
							description: "",
							status: "draft",
							startsAt: null,
							endsAt: null,
							bannerUrl: "",
							themeColor: "#3b82f6",
							pageSlug: "",
							tasks: [],
							rewards: [],
							pageContent: DEFAULT_SECTIONS,
						})
					}
				>
					<Plus size={16} />
					<span>Create Event</span>
				</button>
			</div>

			<div className={styles.panel}>
				<div className={styles.panelHeader}>
					<h2>{t("createdEvents")}</h2>
					<span className={styles.muted}>
						{loading ? t("loading") : `${events.length} events`}
					</span>
				</div>
				<div className={styles.grid}>
					{events.map((evt) => (
						<div key={evt.id} className={styles.eventCard}>
							<div className={styles.rowTitle}>{evt.name}</div>
							<div className={styles.rowMeta}>
								<span className={evt.status === "active" ? styles.statusOk : evt.status === "scheduled" ? styles.statusPending : styles.statusDraft}>
									{evt.status}
								</span>
								{" · "}
								{evt.pageSlug ? (
									<a href={adminApi.eventPageUrl(evt.pageSlug)} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>
										/{evt.pageSlug} <ExternalLink size={12} style={{ display: 'inline' }} />
									</a>
								) : "No slug"}
							</div>
							<div className={styles.formActions}>
								<button className={styles.ghostButton} onClick={() => setEditingEvent(evt)}>
									Edit CMS
								</button>
								{evt.status === "active" && (
									<button className={styles.primaryButton} onClick={() => onBroadcast(evt.id)} title="Broadcast to all players">
										<Radio size={14} />
									</button>
								)}
								<button className={styles.dangerButton} onClick={() => onDeleteEvent(evt.id)}>
									<Trash size={14} />
								</button>
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	);
};

const EventEditor = ({ event, onSave, onCancel, lang, t }: { event: AdminEvent, onSave: (e: Partial<AdminEvent>) => void, onCancel: () => void, lang: string, t: any }) => {
	const [draft, setDraft] = useState<AdminEvent>({ ...event, tasks: event.tasks || [], rewards: event.rewards || [], pageContent: event.pageContent || DEFAULT_SECTIONS });
	const [activeTab, setActiveTab] = useState<"general" | "content" | "tasks" | "rewards">("general");

	const updateDraft = (fields: Partial<AdminEvent>) => setDraft(prev => ({ ...prev, ...fields }));

	const handleSave = () => {
		if (!draft.name.trim()) {
			alert("Tên sự kiện không được để trống!");
			return;
		}
		if (draft.startsAt && draft.endsAt) {
			if (new Date(draft.startsAt) >= new Date(draft.endsAt)) {
				alert("Ngày kết thúc phải lớn hơn ngày bắt đầu!");
				return;
			}
		}
		onSave(draft);
	};

	return (
		<div className={styles.root}>
			<div className={styles.toolbar}>
				<div style={{ display: "flex", gap: 8 }}>
					<button className={`${styles.ghostButton} ${activeTab === "general" ? styles.primaryButton : ""}`} onClick={() => setActiveTab("general")}>General</button>
					<button className={`${styles.ghostButton} ${activeTab === "content" ? styles.primaryButton : ""}`} onClick={() => setActiveTab("content")}>Page Layout</button>
					<button className={`${styles.ghostButton} ${activeTab === "tasks" ? styles.primaryButton : ""}`} onClick={() => setActiveTab("tasks")}>Tasks ({draft.tasks.length})</button>
					<button className={`${styles.ghostButton} ${activeTab === "rewards" ? styles.primaryButton : ""}`} onClick={() => setActiveTab("rewards")}>Rewards ({draft.rewards.length})</button>
				</div>
				<div style={{ display: "flex", gap: 8 }}>
					<button className={styles.ghostButton} onClick={onCancel}>Cancel</button>
					<button className={styles.primaryButton} onClick={handleSave}>Save Event</button>
				</div>
			</div>

			<div className={styles.editorLayout}>
				<div className={styles.editorSidebar}>
					{activeTab === "general" && (
						<>
							<label className={styles.field}>
								<span>Event Name</span>
								<input value={draft.name} onChange={e => updateDraft({ name: e.target.value })} />
							</label>
							<label className={styles.field}>
								<span>Status</span>
								<select value={draft.status} onChange={e => updateDraft({ status: e.target.value as any })}>
									<option value="draft">Draft</option>
									<option value="scheduled">Scheduled</option>
									<option value="active">Active</option>
									<option value="ended">Ended</option>
								</select>
							</label>
							<label className={styles.field}>
								<span>🎮 Loại Sự Kiện (Event Type)</span>
								<select value={(draft as any).eventType || "generic"} onChange={e => updateDraft({ eventType: e.target.value } as any)}>
									<option value="generic">Generic (Tổng hợp)</option>
									<option value="daily_login">📅 Daily Login (Điểm danh)</option>
									<option value="play_games">🎮 Play Games (Chơi game)</option>
									<option value="win_games">🏆 Win Games (Thắng game)</option>
									<option value="competition">⚔️ Competition (Cạnh tranh xếp hạng)</option>
									<option value="coop">🤝 Co-op (Chung sức nhập mã)</option>
									<option value="lucky_spin">🎰 Lucky Spin (Vòng quay may mắn)</option>
									<option value="topup_bonus">💎 Top-up Bonus (Ưu đãi nạp Gem)</option>
								</select>
							</label>
							<label className={styles.field}>
								<span>Banner Image URL</span>
								<input value={draft.bannerUrl || ""} onChange={e => updateDraft({ bannerUrl: e.target.value })} placeholder="https://..." />
							</label>
							<label className={styles.field}>
								<span>Theme Color</span>
								<input type="color" value={draft.themeColor || "#3b82f6"} onChange={e => updateDraft({ themeColor: e.target.value })} />
							</label>
							<label className={styles.field}>
								<span>Description</span>
								<textarea rows={4} value={draft.description || ""} onChange={e => updateDraft({ description: e.target.value })} />
							</label>
							<label className={styles.field}>
								<span>Starts At</span>
								<input type="datetime-local" value={draft.startsAt?.slice(0, 16) || ""} onChange={e => updateDraft({ startsAt: e.target.value })} />
							</label>
							<label className={styles.field}>
								<span>Ends At</span>
								<input type="datetime-local" value={draft.endsAt?.slice(0, 16) || ""} onChange={e => updateDraft({ endsAt: e.target.value })} />
							</label>
						</>
					)}

					{activeTab === "content" && (
						<>
							<div className={styles.field}>
								<span>Page Sections</span>
								<div className={styles.sectionList}>
									{draft.pageContent.sort((a, b) => a.order - b.order).map((section, idx) => (
										<div key={section.id} className={styles.sectionItem}>
											<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
												<GripVertical size={14} style={{ cursor: "grab" }} />
												<span style={{ fontSize: 13, textTransform: "capitalize" }}>{section.type}</span>
											</div>
											<label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
												<input
													type="checkbox"
													checked={section.visible}
													onChange={e => {
														const newContent = [...draft.pageContent];
														newContent[idx].visible = e.target.checked;
														updateDraft({ pageContent: newContent });
													}}
												/> Visible
											</label>
										</div>
									))}
								</div>
								<span className={styles.muted} style={{ marginTop: 8 }}>Drag and drop not implemented in this demo. Just toggle visibility.</span>
							</div>
						</>
					)}

					{activeTab === "tasks" && (
						<div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
							<button className={styles.ghostButton} onClick={() => updateDraft({ tasks: [...draft.tasks, { id: `task-${Date.now()}`, title: "New Task", description: "", type: "play_games", target: 1, reward: { gold: 100 } }] })}>
								<Plus size={14} /> Add Task
							</button>
							{draft.tasks.map((task, idx) => (
								<div key={task.id} className={styles.sectionItem} style={{ flexDirection: "column", alignItems: "stretch", gap: 12, padding: "12px" }}>
									<label className={styles.field}>
										<span>Task Title</span>
										<input value={task.title} onChange={e => {
											const newT = [...draft.tasks]; newT[idx].title = e.target.value; updateDraft({ tasks: newT });
										}} placeholder="Task Title" />
									</label>
									<label className={styles.field}>
										<span>Type</span>
										<select value={task.type} onChange={e => {
											const newT = [...draft.tasks]; newT[idx].type = e.target.value as any; updateDraft({ tasks: newT });
										}}>
											<option value="play_games">Play Games</option>
											<option value="win_games">Win Games</option>
											<option value="topup_bonus">Top-up Bonus</option>
											<option value="daily_login">Daily Login</option>
											<option value="competition">Competition</option>
											<option value="coop">Co-op</option>
											<option value="lucky_spin">Lucky Spin</option>
											<option value="custom">Custom</option>
										</select>
									</label>
									<div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
										<label className={styles.field} style={{ flex: 1 }}>
											<span>Target</span>
											<input type="number" value={task.target} onChange={e => {
												const newT = [...draft.tasks]; newT[idx].target = Number(e.target.value); updateDraft({ tasks: newT });
											}} placeholder="Target count" />
										</label>
										<button className={styles.dangerButton} style={{ marginBottom: 4 }} onClick={() => {
											const newT = [...draft.tasks]; newT.splice(idx, 1); updateDraft({ tasks: newT });
										}}><Trash size={12} /></button>
									</div>
								</div>
							))}
						</div>
					)}

					{activeTab === "rewards" && (
						<div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
							<button className={styles.ghostButton} onClick={() => updateDraft({ rewards: [...draft.rewards, { id: `reward-${Date.now()}`, title: "New Reward", description: "", type: "gold", amount: 100 }] })}>
								<Plus size={14} /> Add Global Reward
							</button>
							{draft.rewards.map((reward, idx) => (
								<div key={reward.id} className={styles.sectionItem} style={{ flexDirection: "column", alignItems: "stretch", gap: 12, padding: "12px" }}>
									<label className={styles.field}>
										<span>Reward Title</span>
										<input value={reward.title} onChange={e => {
											const newR = [...draft.rewards]; newR[idx].title = e.target.value; updateDraft({ rewards: newR });
										}} placeholder="Reward Title" />
									</label>
									<label className={styles.field}>
										<span>Type</span>
										<select value={reward.type} onChange={e => {
											const newR = [...draft.rewards]; newR[idx].type = e.target.value as any; updateDraft({ rewards: newR });
										}}>
											<option value="gold">Gold</option>
											<option value="gems">Gems</option>
											<option value="tickets">Tickets</option>
											<option value="custom">Custom</option>
										</select>
									</label>
									<div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
										<label className={styles.field} style={{ flex: 1 }}>
											<span>Amount</span>
											<input type="number" value={reward.amount} onChange={e => {
												const newR = [...draft.rewards]; newR[idx].amount = Number(e.target.value); updateDraft({ rewards: newR });
											}} placeholder="Amount" />
										</label>
										<button className={styles.dangerButton} style={{ marginBottom: 4 }} onClick={() => {
											const newR = [...draft.rewards]; newR.splice(idx, 1); updateDraft({ rewards: newR });
										}}><Trash size={12} /></button>
									</div>
								</div>
							))}
						</div>
					)}
				</div>

				<div className={styles.editorMain}>
					<div className={styles.previewBox} style={{ borderColor: draft.themeColor || "var(--border-color)" }}>
						<h3 style={{ margin: 0, color: draft.themeColor || "var(--text-primary)" }}>Preview: {draft.name}</h3>

						{draft.pageContent.filter(s => s.visible).sort((a, b) => a.order - b.order).map(section => (
							<div key={section.id} style={{ marginBottom: 16 }}>
								{section.type === "banner" && (
									<div className={styles.previewBanner}>
										{draft.bannerUrl ? <img src={draft.bannerUrl} alt="Banner" /> : "No Banner Image"}
									</div>
								)}
								{section.type === "countdown" && (
									<div style={{ textAlign: "center", padding: 16, background: "var(--bg-tertiary)", borderRadius: 8, fontWeight: 600 }}>
										Event Starts: {draft.startsAt || "TBD"}
									</div>
								)}
								{section.type === "description" && (
									<p style={{ whiteSpace: "pre-wrap", color: "var(--text-secondary)", fontSize: 14 }}>
										{draft.description || "No description"}
									</p>
								)}
								{section.type === "tasks" && draft.tasks.length > 0 && (
									<div>
										<h4>Tasks</h4>
										<div className={styles.previewTasks}>
											{draft.tasks.map(t => (
												<div key={t.id} className={styles.previewCard}>
													<strong>{t.title}</strong><br />
													<span className={styles.muted}>Target: {t.target} {t.type}</span>
												</div>
											))}
										</div>
									</div>
								)}
								{section.type === "rewards" && draft.rewards.length > 0 && (
									<div>
										<h4>Rewards</h4>
										<div className={styles.previewRewards}>
											{draft.rewards.map(r => (
												<div key={r.id} className={styles.previewCard}>
													<strong>{r.title}</strong><br />
													<span className={styles.muted}>{r.amount} {r.type}</span>
												</div>
											))}
										</div>
									</div>
								)}
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
};
