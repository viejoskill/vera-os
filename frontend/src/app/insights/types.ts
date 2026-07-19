export interface Insight {
  id: string;
  type: 'opportunity' | 'risk' | 'recommendation' | 'priority' | 'reminder' | 'task';
  category: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  reason: string;
  suggested_action: string;
  action_label: string;
  link_route: string;
  link_label: string;
  signals: string[];
  meta: Record<string, unknown>;
}

export interface InsightsSummary {
  by_type: Record<string, number>;
  total: number;
  active_conversations: number;
}

export interface InsightsResponse {
  insights: Insight[];
  summary: InsightsSummary;
}
