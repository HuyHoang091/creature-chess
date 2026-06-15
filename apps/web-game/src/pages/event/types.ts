export type EventData = {
  id: string;
  name: string;
  description: string;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  bannerUrl: string | null;
  themeColor: string | null;
  pageSlug: string | null;
  eventType: string | null; // play_games | win_games | daily_login | competition | coop | lucky_spin | topup_bonus | generic
  tasks: TaskItem[];
  rewards: RewardItem[];
  pageContent: PageSection[];
  config: Record<string, any>; // flexible per-type config
};

export type TaskItem = {
  id: string;
  title: string;
  description: string;
  type: string;
  target: number;
  reward: { gold?: number; gems?: number; item?: string };
};

export type RewardItem = {
  id: string;
  title: string;
  description: string;
  type: string;
  amount: number;
};

export type PageSection = {
  id: string;
  type: string;
  order: number;
  visible: boolean;
};
