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
