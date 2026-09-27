import { supabase } from '../lib/supabase';

export interface KnowledgeInsight {
  id: string;
  topic: string;
  insight_type: 'well_covered' | 'lightly_covered' | 'gap' | 'recommendation';
  evidence: string;
  confidence: number;
  created_at: string;
}

export async function fetchInsights(): Promise<KnowledgeInsight[]> {
  const { data, error } = await supabase
    .from('knowledge_insights')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching insights:', error);
    return [];
  }

  return (data || []) as KnowledgeInsight[];
}

export async function generateInsights(
  studyGoal?: string
): Promise<KnowledgeInsight[]> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('User not authenticated');
  }

  const res = await fetch('/api/insights/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ study_goal: studyGoal }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to generate study insights');
  }

  return (data.insights || []) as KnowledgeInsight[];
}
