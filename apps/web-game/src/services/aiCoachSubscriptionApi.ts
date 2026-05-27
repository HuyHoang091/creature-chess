import { apiFetch } from "./api";

// ─── Types ───────────────────────────────────────────
export interface UsageStat {
	used: number;
	limit: number;
}

export interface SubscriptionDTO {
	id: string;
	plan: string;
	planName: string;
	usage: {
		queries: UsageStat;
		positioning: UsageStat;
		build: UsageStat;
		battleAnalysis: UsageStat;
	};
	periodStart: string;
	periodEnd: string | null;
	activatedAt: string;
}

export interface PlanDTO {
	id: string;
	name: string;
	priceUsd: number;
	priceVnd: number;
	limits: {
		queries: number;
		positioning: number;
		build: number;
		battleAnalysis: number;
	};
	description: string;
}

export interface CreateOrderResponse {
	orderId: string;
	amountUsd: string;
	planId: string;
	planName: string;
}

export interface VerifyPaymentResponse {
	success: boolean;
	plan: string;
	planName: string;
	periodEnd: string;
	message: string;
}

export interface PaymentHistoryItem {
	id: string;
	plan: string;
	planName: string;
	amountUsd: number;
	amountVnd: number | null;
	status: string;
	createdAt: string;
}

// ─── API Calls ───────────────────────────────────────

export const fetchSubscription = (token: string) =>
	apiFetch<SubscriptionDTO>("/ai-coach/subscription", { method: "GET" }, token);

export const fetchPlans = () =>
	apiFetch<{ plans: PlanDTO[] }>("/ai-coach/plans", { method: "GET" });

export const createOrder = (token: string, planId: string, amountVnd?: number) =>
	apiFetch<CreateOrderResponse>(
		"/ai-coach/create-order",
		{
			method: "POST",
			body: JSON.stringify({ planId, amountVnd }),
		},
		token
	);

export const verifyPayment = (
	token: string,
	payload: {
		orderId: string;
		paypalOrderId?: string;
		payerName?: string;
		payerEmail?: string;
		captureId?: string;
	}
) =>
	apiFetch<VerifyPaymentResponse>(
		"/ai-coach/verify-payment",
		{
			method: "POST",
			body: JSON.stringify(payload),
		},
		token
	);

export const reportPaymentFailed = (
	token: string,
	orderId: string,
	errorMessage?: string
) =>
	apiFetch<{ success: boolean }>(
		"/ai-coach/payment-failed",
		{
			method: "POST",
			body: JSON.stringify({ orderId, errorMessage }),
		},
		token
	);

export const fetchPaymentHistory = (token: string) =>
	apiFetch<{ payments: PaymentHistoryItem[] }>(
		"/ai-coach/payment-history",
		{ method: "GET" },
		token
	);
