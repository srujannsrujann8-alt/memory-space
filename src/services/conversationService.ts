import { supabase } from '../lib/supabase';

export interface MessageSource {
  id: string;
  message_id: string;
  document_id: string | null;
  chunk_id: string | null;
  filename: string;
  chunk_index: number;
  similarity: number;
  content_snippet?: string;
}

export interface ConversationMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  grounded: boolean;
  created_at: string;
  sources?: MessageSource[];
}

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatResponse {
  success: boolean;
  conversation_id: string;
  message_id?: string;
  query: string;
  search_query?: string;
  answer: string;
  sources: Array<{
    chunk_id: string;
    document_id: string;
    chunk_index: number;
    filename: string;
    category: string;
    file_type: string;
    similarity: number;
    content: string;
  }>;
  chunks_retrieved: number;
  grounded: boolean;
  embedding_model?: string;
  generation_model?: string;
  error?: string;
}

// ── Fetch Conversations ───────────────────────────────────────────────────────

export async function fetchConversations(): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select('id, title, created_at, updated_at')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching conversations:', error);
    return [];
  }
  return data || [];
}

// ── Fetch Conversation Messages With Sources ─────────────────────────────────

export async function fetchConversationMessages(
  conversationId: string
): Promise<ConversationMessage[]> {
  const { data: messages, error: mErr } = await supabase
    .from('conversation_messages')
    .select('id, conversation_id, role, content, grounded, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (mErr || !messages) {
    console.error('Error fetching messages:', mErr);
    return [];
  }

  // Load message sources
  const messageIds = messages.map((m) => m.id);
  let sourcesByMessage: Record<string, MessageSource[]> = {};

  if (messageIds.length > 0) {
    const { data: sources } = await supabase
      .from('message_sources')
      .select('*')
      .in('message_id', messageIds);

    if (sources) {
      sources.forEach((s) => {
        if (!sourcesByMessage[s.message_id]) {
          sourcesByMessage[s.message_id] = [];
        }
        sourcesByMessage[s.message_id].push(s);
      });
    }
  }

  return messages.map((m) => ({
    ...m,
    sources: sourcesByMessage[m.id] || [],
  }));
}

// ── Delete Conversation ──────────────────────────────────────────────────────

export async function deleteConversation(conversationId: string): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('id', conversationId);

  if (error) {
    console.error('Error deleting conversation:', error);
    throw new Error(error.message);
  }
}

// ── Send Message (Multi-turn RAG) ────────────────────────────────────────────

export async function sendChatMessage(
  message: string,
  conversationId?: string
): Promise<ChatResponse> {
  const trimmed = message.trim();
  if (!trimmed) {
    throw new Error('Message cannot be empty.');
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('You must be logged in.');
  }

  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      message: trimmed,
      conversation_id: conversationId,
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || `Chat failed with status ${res.status}`);
  }

  return data as ChatResponse;
}
