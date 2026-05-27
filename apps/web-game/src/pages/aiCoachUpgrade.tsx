import React, { useEffect, useState, useCallback, useRef } from "react";
import { useSelector } from "react-redux";
import {
	Brain,
	Crosshair,
	Hammer,
	Swords,
	MessageSquare,
	Shield,
	Check,
	AlertTriangle,
	ChevronRight,
	CreditCard,
	Crown,
	Sparkles,
	Star,
	Zap,
} from "lucide-react";

import { AppState } from "~/store/state";
import {
	fetchSubscription,
	fetchPlans,
	createOrder,
	verifyPayment,
	reportPaymentFailed,
	fetchPaymentHistory,
	type SubscriptionDTO,
	type PlanDTO,
	type PaymentHistoryItem,
} from "~/services/aiCoachSubscriptionApi";

import styles from "./AiCoachUpgradePage.module.css";

// PayPal SDK client ID – same sandbox key from the demo
const PAYPAL_CLIENT_ID =
	"Af37P1fTOc_4eTMaNyALE4LHuTGgPA093G-V6gwAryBTVN_EvswbY0Mlz513LA-L92SYXtcvyH_iU5V-";

// Plan icons mapping
const PLAN_ICONS: Record<string, React.ReactNode> = {
	free: <Brain size={20} />,
	basic: <Star size={20} />,
	pro: <Zap size={20} />,
	unlimited: <Crown size={20} />,
};

// Feature icons mapping
const FEATURE_ICONS: Record<string, React.ReactNode> = {
	queries: <MessageSquare size={14} />,
	positioning: <Crosshair size={14} />,
	build: <Hammer size={14} />,
	battleAnalysis: <Swords size={14} />,
};

const FEATURE_LABELS: Record<string, string> = {
	queries: "Coach Queries",
	positioning: "Positioning",
	build: "Build Advice",
	battleAnalysis: "Battle Analysis",
};

function formatLimit(value: number): string {
	return value >= 999999 ? "∞" : value.toLocaleString();
}

function formatVnd(amount: number): string {
	return amount.toLocaleString("vi-VN") + "₫";
}

type PageState = "loading" | "plans" | "payment" | "success" | "error";

export const AiCoachUpgradePage = () => {
	const token = useSelector((state: AppState) => state.auth.accessToken);

	const [pageState, setPageState] = useState<PageState>("loading");
	const [subscription, setSubscription] = useState<SubscriptionDTO | null>(null);
	const [plans, setPlans] = useState<PlanDTO[]>([]);
	const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
	const [paymentHistory, setPaymentHistory] = useState<PaymentHistoryItem[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [successInfo, setSuccessInfo] = useState<{
		planName: string;
		periodEnd: string;
	} | null>(null);

	const paypalContainerRef = useRef<HTMLDivElement>(null);
	const paypalLoadedRef = useRef(false);
	const paypalInstanceRef = useRef<any>(null);
	
	// Add ref to prevent closure capture issues in paypal callbacks
	const pendingOrderIdRef = useRef<string | null>(null);

	// ─── Load data ─────────────────────────────────────
	const loadData = useCallback(async () => {
		if (!token) {
			setError("Vui lòng đăng nhập để sử dụng tính năng này");
			setPageState("error");
			return;
		}

		try {
			setPageState("loading");
			const [subData, plansData, historyData] = await Promise.all([
				fetchSubscription(token),
				fetchPlans(),
				fetchPaymentHistory(token),
			]);

			setSubscription(subData);
			setPlans(plansData.plans);
			setPaymentHistory(historyData.payments);
			setSelectedPlanId(null);
			setPageState("plans");
		} catch (err) {
			setError((err as Error).message || "Không thể tải dữ liệu");
			setPageState("error");
		}
	}, [token]);

	useEffect(() => {
		loadData();
	}, [loadData]);

	// ─── PayPal SDK Loading ────────────────────────────
	const loadPayPalScript = useCallback((): Promise<void> => {
		return new Promise((resolve, reject) => {
			if ((window as any).paypal) {
				resolve();
				return;
			}

			const existingScript = document.querySelector(
				'script[src*="paypal.com/sdk/js"]'
			);
			if (existingScript) {
				existingScript.addEventListener("load", () => resolve());
				existingScript.addEventListener("error", () =>
					reject(new Error("PayPal SDK load failed"))
				);
				return;
			}

			const script = document.createElement("script");
			script.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&currency=USD`;
			script.onload = () => resolve();
			script.onerror = () => reject(new Error("PayPal SDK load failed"));
			document.head.appendChild(script);
		});
	}, []);

	// ─── Render PayPal buttons ──────────────────────────
	const renderPayPalButtons = useCallback(
		async (planId: string) => {
			if (!token || !paypalContainerRef.current) return;

			try {
				await loadPayPalScript();
			} catch {
				setError("Không thể tải PayPal SDK");
				return;
			}

			const paypal = (window as any).paypal;
			if (!paypal) return;

			// Clear existing buttons
			if (paypalContainerRef.current) {
				paypalContainerRef.current.innerHTML = "";
			}
			if (paypalInstanceRef.current) {
				try {
					paypalInstanceRef.current.close();
				} catch (e) {}
				paypalInstanceRef.current = null;
			}

			const buttons = paypal.Buttons({
					// In sandbox mode, use the direct create approach
					createOrder: async (
						_data: any,
						actions: any
					): Promise<string> => {
						try {
							const plan = plans.find((p) => p.id === planId);
							const orderData = await createOrder(
								token,
								planId,
								plan?.priceVnd
							);
							pendingOrderIdRef.current = orderData.orderId;

							return actions.order.create({
								purchase_units: [
									{
										amount: {
											value: orderData.amountUsd,
											currency_code: "USD",
										},
										description: `AI Coach ${orderData.planName} Plan`,
										custom_id: orderData.orderId,
									},
								],
							});
						} catch (err) {
							setError(
								(err as Error).message ||
									"Không thể tạo đơn hàng"
							);
							throw err;
						}
					},

					onApprove: async (data: any, actions: any) => {
						try {
							const details = await actions.order.capture();

							if (details.status === "COMPLETED") {
								const payerName = details.payer?.name
									? `${details.payer.name.given_name} ${details.payer.name.surname}`
									: undefined;

								const result = await verifyPayment(token, {
									orderId: pendingOrderIdRef.current || "",
									paypalOrderId: data.orderID,
									payerName,
									payerEmail:
										details.payer?.email_address,
									captureId:
										details.purchase_units?.[0]
											?.payments?.captures?.[0]?.id,
								});

								setSuccessInfo({
									planName: result.planName,
									periodEnd: result.periodEnd,
								});

								if (paypalInstanceRef.current) {
									try {
										paypalInstanceRef.current.close();
									} catch (e) {}
									paypalInstanceRef.current = null;
								}
								setPageState("success");
							} else {
								setError(
									"Thanh toán chưa hoàn tất. Trạng thái: " +
										details.status
								);
							}
						} catch (err) {
							setError(
								(err as Error).message ||
									"Lỗi xác thực thanh toán"
							);
						}
					},

					onError: async (err: any) => {
						console.error("PayPal Error:", err);
						if (pendingOrderIdRef.current) {
							await reportPaymentFailed(
								token,
								pendingOrderIdRef.current,
								err?.message || "PayPal error"
							).catch(() => {});
						}
						setError(
							"Đã xảy ra lỗi trong quá trình thanh toán. Vui lòng thử lại."
						);
					},

					onCancel: async () => {
						if (pendingOrderIdRef.current) {
							await reportPaymentFailed(
								token,
								pendingOrderIdRef.current,
								"User cancelled"
							).catch(() => {});
						}
						setError("Bạn đã hủy thanh toán.");
						pendingOrderIdRef.current = null;
					},

					style: {
						layout: "vertical",
						color: "gold",
						shape: "rect",
						label: "paypal",
						height: 45,
					},
				});
				
			buttons.render(paypalContainerRef.current);
			paypalInstanceRef.current = buttons;

			paypalLoadedRef.current = true;
		},
		[token, plans, loadPayPalScript]
	);

	// ─── Select a plan ─────────────────────────────────
	const handleSelectPlan = (planId: string) => {
		if (planId === subscription?.plan) return;

		const planOrder = ["free", "basic", "pro", "unlimited"];
		const currentIdx = planOrder.indexOf(subscription?.plan || "free");
		const targetIdx = planOrder.indexOf(planId);

		if (targetIdx <= currentIdx) return;

		setSelectedPlanId(planId);
		setError(null);
		paypalLoadedRef.current = false;
	};

	// ─── Proceed to payment ─────────────────────────────
	const handleProceedToPayment = () => {
		if (!selectedPlanId) return;
		setPageState("payment");
		setError(null);

		// Render PayPal buttons after a tick
		requestAnimationFrame(() => {
			renderPayPalButtons(selectedPlanId);
		});
	};

	// ─── Back to plans ──────────────────────────────────
	const handleBackToPlans = () => {
		if (paypalInstanceRef.current) {
			try {
				paypalInstanceRef.current.close();
			} catch (e) {}
			paypalInstanceRef.current = null;
		}
		setPageState("plans");
		setError(null);
		pendingOrderIdRef.current = null;
		paypalLoadedRef.current = false;
	};

	// ─── Usage bar helpers ──────────────────────────────
	const getUsagePercent = (used: number, limit: number) => {
		if (limit >= 999999) return 0;
		return Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));
	};

	const getBarClass = (percent: number) => {
		if (percent >= 100) return `${styles.usageBarInner} ${styles.full}`;
		if (percent >= 75) return `${styles.usageBarInner} ${styles.warning}`;
		return styles.usageBarInner;
	};

	// ─── Render Loading ─────────────────────────────────
	if (pageState === "loading") {
		return (
			<div className={styles.loadingState}>
				<div className={styles.spinner} />
				<span>Đang tải dữ liệu...</span>
			</div>
		);
	}

	// ─── Render Error ───────────────────────────────────
	if (pageState === "error" && !plans.length) {
		return (
			<div className={styles.root}>
				<div className={styles.errorBanner}>
					<AlertTriangle size={18} />
					<span>{error || "Đã xảy ra lỗi"}</span>
					<button className={styles.retryBtn} onClick={loadData}>
						Thử lại
					</button>
				</div>
			</div>
		);
	}

	// ─── Render Success ─────────────────────────────────
	if (pageState === "success" && successInfo) {
		return (
			<div className={styles.root}>
				<div className={styles.successState}>
					<div className={styles.successIcon}>
						<Check size={32} />
					</div>
					<div className={styles.successTitle}>
						Nâng cấp thành công!
					</div>
					<div className={styles.successMessage}>
						Gói AI Coach của bạn đã được nâng cấp lên{" "}
						<strong>{successInfo.planName}</strong>. Giới hạn sử
						dụng đã được cập nhật.
					</div>
					<div className={styles.successDetails}>
						<span>
							Hết hạn:{" "}
							{new Date(
								successInfo.periodEnd
							).toLocaleDateString("vi-VN")}
						</span>
						<span>
							Email xác nhận đã được gửi đến hộp thư của bạn
						</span>
					</div>
					<button
						className={styles.closeSuccessBtn}
						onClick={() => {
							setPageState("loading");
							loadData();
						}}
					>
						Xong
					</button>
				</div>
			</div>
		);
	}

	// ─── Render Payment ─────────────────────────────────
	if (pageState === "payment") {
		const plan = plans.find((p) => p.id === selectedPlanId);

		return (
			<div className={styles.root}>
				<div className={styles.upgradeAction}>
					<div className={styles.selectedPlanSummary}>
						<div>
							<div className={styles.selectedPlanLabel}>
								Gói đã chọn
							</div>
							<div className={styles.selectedPlanNameLg}>
								{plan?.name || selectedPlanId}
							</div>
						</div>
						<div className={styles.selectedPlanPriceLg}>
							${plan?.priceUsd?.toFixed(2)}
						</div>
					</div>

					{error && (
						<div className={styles.errorBanner}>
							<AlertTriangle size={16} />
							<span>{error}</span>
							<button
								className={styles.retryBtn}
								onClick={() => {
									setError(null);
									renderPayPalButtons(selectedPlanId!);
								}}
							>
								Thử lại
							</button>
						</div>
					)}

					<div
						ref={paypalContainerRef}
						className={styles.paypalContainer}
					/>

					<div className={styles.securityBadge}>
						<Shield size={14} />
						<span>
							Giao dịch được mã hóa và bảo mật bởi PayPal
						</span>
					</div>
				</div>

				<button
					className={styles.closeSuccessBtn}
					onClick={handleBackToPlans}
				>
					← Quay lại chọn gói
				</button>
			</div>
		);
	}

	// ─── Render Plans ───────────────────────────────────
	const selectedPlan = plans.find((p) => p.id === selectedPlanId);
	const planOrder = ["free", "basic", "pro", "unlimited"];
	const currentPlanIdx = planOrder.indexOf(subscription?.plan || "free");

	return (
		<div className={styles.root}>
			{/* Current Plan */}
			{subscription && (
				<div className={styles.currentPlanBanner}>
					<div className={styles.planIconWrap}>
						{PLAN_ICONS[subscription.plan] || (
							<Brain size={24} />
						)}
					</div>
					<div className={styles.currentPlanInfo}>
						<div className={styles.currentPlanLabel}>
							Gói hiện tại
						</div>
						<div className={styles.currentPlanName}>
							{subscription.planName}
						</div>
						{subscription.periodEnd && (
							<div className={styles.currentPlanExpiry}>
								Hết hạn:{" "}
								{new Date(
									subscription.periodEnd
								).toLocaleDateString("vi-VN")}
							</div>
						)}
					</div>
				</div>
			)}

			{/* Usage Stats */}
			{subscription && (
				<div className={styles.usageSection}>
					<div className={styles.usageSectionTitle}>
						Mức sử dụng hôm nay
					</div>
					<div className={styles.usageGrid}>
						{(
							Object.keys(subscription.usage) as Array<
								keyof typeof subscription.usage
							>
						).map((key) => {
							const stat = subscription.usage[key];
							const percent = getUsagePercent(
								stat.used,
								stat.limit
							);
							return (
								<div key={key} className={styles.usageCard}>
									<div className={styles.usageLabel}>
										{FEATURE_ICONS[key]}
										<span>{FEATURE_LABELS[key]}</span>
									</div>
									<div className={styles.usageBarOuter}>
										<div
											className={getBarClass(percent)}
											style={{
												width: `${percent}%`,
											}}
										/>
									</div>
									<div className={styles.usageCount}>
										{stat.used} /{" "}
										{formatLimit(stat.limit)}
									</div>
								</div>
							);
						})}
					</div>
				</div>
			)}

			{/* Error */}
			{error && (
				<div className={styles.errorBanner}>
					<AlertTriangle size={16} />
					<span>{error}</span>
				</div>
			)}

			{/* Plan Cards */}
			<div>
				<div className={styles.plansTitle}>Chọn gói nâng cấp</div>
				<div className={styles.plansSubtitle}>
					Mở rộng giới hạn sử dụng AI Coach
				</div>
			</div>

			<div className={styles.plansGrid}>
				{plans.map((plan) => {
					const isCurrent = plan.id === subscription?.plan;
					const isSelected = plan.id === selectedPlanId;
					const planIdx = planOrder.indexOf(plan.id);
					const isDowngrade = planIdx <= currentPlanIdx;
					const isPopular = plan.id === "pro";

					let cardClass = styles.planCard;
					if (isCurrent) cardClass += ` ${styles.current}`;
					else if (isSelected) cardClass += ` ${styles.selected}`;
					else if (plan.id === subscription?.plan)
						cardClass += ` ${styles.active}`;

					return (
						<div
							key={plan.id}
							className={cardClass}
							onClick={
								isDowngrade
									? undefined
									: () => handleSelectPlan(plan.id)
							}
							style={
								isDowngrade && !isCurrent
									? { opacity: 0.35, pointerEvents: "none" }
									: undefined
							}
						>
							{isCurrent && (
								<div
									className={`${styles.planBadge} ${styles.currentBadge}`}
								>
									Đang dùng
								</div>
							)}
							{isPopular && !isCurrent && (
								<div
									className={`${styles.planBadge} ${styles.popularBadge}`}
								>
									<Sparkles size={10} /> Phổ biến
								</div>
							)}

							<div className={styles.planCardTop}>
								<div className={styles.planNameWrap}>
									<div className={styles.planName}>
										{PLAN_ICONS[plan.id]} {plan.name}
									</div>
									<div className={styles.planDesc}>
										{plan.description}
									</div>
								</div>
								<div className={styles.planPrice}>
									{plan.priceUsd === 0 ? (
										<div className={styles.planPriceUsd}>
											Miễn phí
										</div>
									) : (
										<>
											<div
												className={
													styles.planPriceUsd
												}
											>
												$
												{plan.priceUsd.toFixed(2)}
											</div>
											<div
												className={
													styles.planPriceVnd
												}
											>
												~{formatVnd(plan.priceVnd)}
											</div>
											<div
												className={
													styles.planPricePeriod
												}
											>
												/tháng
											</div>
										</>
									)}
								</div>
							</div>

							<div className={styles.planLimits}>
								{Object.entries(plan.limits).map(
									([key, val]) => (
										<div
											key={key}
											className={styles.planLimit}
										>
											{FEATURE_ICONS[key]}
											<span
												className={
													styles.planLimitValue
												}
											>
												{formatLimit(val)}
											</span>
											<span>
												{FEATURE_LABELS[key]}
											</span>
										</div>
									)
								)}
							</div>
						</div>
					);
				})}
			</div>

			{/* Upgrade Button */}
			{selectedPlan && (
				<button
					className={styles.upgradeBtn}
					onClick={handleProceedToPayment}
				>
					<CreditCard size={20} />
					Thanh toán ${selectedPlan.priceUsd.toFixed(2)} – Gói{" "}
					{selectedPlan.name}
					<ChevronRight size={18} />
				</button>
			)}

			{/* Security Badge */}
			<div className={styles.securityBadge}>
				<Shield size={14} />
				<span>
					Thanh toán an toàn qua PayPal. Bảo mật theo tiêu chuẩn PCI
					DSS.
				</span>
			</div>

			{/* Payment History */}
			{paymentHistory.length > 0 && (
				<div className={styles.historySection}>
					<div className={styles.historyTitle}>
						Lịch sử thanh toán
					</div>
					{paymentHistory.map((item) => (
						<div key={item.id} className={styles.historyItem}>
							<div className={styles.historyItemLeft}>
								<div className={styles.historyPlan}>
									{item.planName}
								</div>
								<div className={styles.historyDate}>
									{new Date(
										item.createdAt
									).toLocaleDateString("vi-VN")}
								</div>
							</div>
							<div>
								<div className={styles.historyAmount}>
									${item.amountUsd.toFixed(2)}
								</div>
								<div
									className={`${styles.historyStatus} ${
										styles[
											item.status as keyof typeof styles
										] || ""
									}`}
								>
									{item.status === "completed"
										? "Hoàn thành"
										: item.status === "pending"
											? "Chờ xử lý"
											: "Thất bại"}
								</div>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
};
