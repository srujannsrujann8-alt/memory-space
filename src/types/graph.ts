import type { Document } from './document';
import type { KnowledgeTopic } from '../services/topicService';

export interface GraphNodeItem {
  id: string;
  name: string;
  category: string;
  position: [number, number, number];
  related: string[];
  documents: number;
  description: string;
  color: string;
  glowColor: string;
  sourceFile?: string;
  page?: number;
  confidence?: number;
  summarySnippet?: string;
  realDoc?: Document;
  realTopic?: KnowledgeTopic;
  isRootNode?: boolean;
  isCategoryNode?: boolean;
  isTopicNode?: boolean;
  connectedDocCount?: number;
}
