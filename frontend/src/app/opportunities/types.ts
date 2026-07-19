export interface Opportunity {
  type: string;
  priority: 'high' | 'medium' | 'low';
  reason: string;
  suggested_message: string;
  contact_id: string;
  contact_name: string;
  conversation_id: string;
  hours_since_last: number;
  signals: string[];
}
