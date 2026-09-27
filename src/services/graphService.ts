import type { Document, DocumentCategory } from '../types/document';
import { DOCUMENT_CATEGORIES } from '../types/document';
import type { KnowledgeTopic } from './topicService';
import type { GraphNodeItem } from '../types/graph';
import { getDisplayFilename } from './categoryService';

export type { GraphNodeItem };

export const CATEGORY_COLORS: Record<string, { color: string; glow: string }> = {
  MemorySpace: { color: '#38bdf8', glow: '#0284c7' }, // Cyan core
  Documents:   { color: '#38bdf8', glow: '#0284c7' }, // Cyan
  Notes:       { color: '#a855f7', glow: '#7e22ce' }, // Violet
  Code:        { color: '#10b981', glow: '#059669' }, // Emerald
  Images:      { color: '#ec4899', glow: '#db2777' }, // Pink
  Assignments: { color: '#f59e0b', glow: '#d97706' }, // Amber
  Topic:       { color: '#818cf8', glow: '#4f46e5' }, // Indigo
};

export interface BuildGraphOptions {
  selectedCategory?: string | null;
  expandedDocId?: string | null;
}

/**
 * Deterministically constructs a 3D Knowledge Graph representing:
 * 
 * USER (implicit session)
 *   ↓
 * MEMORYSPACE (Root Node at [0, 0, 0])
 *   ↓
 * CATEGORY (5 Core Nodes: Documents, Notes, Code, Images, Assignments)
 *   ↓
 * DOCUMENT (Connected to its selected Category)
 *   ↓
 * FUTURE TOPICS / CONCEPTS (Child satellites expandable on click)
 */
export function buildKnowledgeGraph(
  documents: Document[],
  topics: KnowledgeTopic[] = [],
  docTopics: Array<{ document_id: string; topic_id: string }> = [],
  options: BuildGraphOptions = {}
): GraphNodeItem[] {
  if (!documents || documents.length === 0) return [];

  const { selectedCategory = null, expandedDocId = null } = options;
  const isFilteringCategory = selectedCategory && selectedCategory !== 'All Knowledge';

  const nodes: GraphNodeItem[] = [];

  // Group user documents by category
  const categoryDocsMap = new Map<DocumentCategory, Document[]>();
  DOCUMENT_CATEGORIES.forEach((cat) => {
    categoryDocsMap.set(cat, []);
  });

  documents.forEach((doc) => {
    const cat = (doc.category || 'Documents') as DocumentCategory;
    if (categoryDocsMap.has(cat)) {
      categoryDocsMap.get(cat)!.push(doc);
    } else {
      categoryDocsMap.get('Documents')!.push(doc);
    }
  });

  // Determine which categories to include in graph
  const categoriesToShow = isFilteringCategory
    ? DOCUMENT_CATEGORIES.filter((c) => c === selectedCategory)
    : DOCUMENT_CATEGORIES;

  const R_cat = 4.2;
  const categoryNodeIds: string[] = [];
  const catPositions = new Map<string, [number, number, number]>();

  // 1. Create Category Hub Nodes
  categoriesToShow.forEach((categoryName) => {
    const originalIndex = DOCUMENT_CATEGORIES.indexOf(categoryName);
    const catDocs = categoryDocsMap.get(categoryName) || [];
    const catNodeId = `cat-${categoryName.toLowerCase()}`;
    categoryNodeIds.push(catNodeId);

    // Radial layout: arranged symmetrically around central MemorySpace core
    const angleCat = isFilteringCategory
      ? 0
      : (2 * Math.PI * originalIndex) / DOCUMENT_CATEGORIES.length - Math.PI / 2;

    const catX = Number((R_cat * Math.cos(angleCat)).toFixed(2));
    const catY = Number((0.25 * Math.sin(angleCat * 2)).toFixed(2));
    const catZ = Number((R_cat * Math.sin(angleCat)).toFixed(2));
    catPositions.set(catNodeId, [catX, catY, catZ]);

    const colorConfig = CATEGORY_COLORS[categoryName] || CATEGORY_COLORS.Documents;
    const docNodeIds = catDocs.map((d) => `doc-${d.id}`);

    // Category node links to root MemorySpace + all its child documents
    nodes.push({
      id: catNodeId,
      name: categoryName,
      category: categoryName,
      position: [catX, catY, catZ],
      related: ['root-memoryspace', ...docNodeIds],
      documents: catDocs.length,
      description: `${categoryName} category containing ${catDocs.length} ${catDocs.length === 1 ? 'file' : 'files'}.`,
      color: colorConfig.color,
      glowColor: colorConfig.glow,
      confidence: 100,
      summarySnippet: `${categoryName} cluster with ${catDocs.length} personal documents.`,
      isCategoryNode: true,
      isRootNode: false,
      isTopicNode: false,
    });

    // 2. Create Document Leaf Nodes under this Category
    const M = catDocs.length;
    const baseAngle = isFilteringCategory ? 0 : Math.atan2(catZ, catX);
    const R_doc = M === 1 ? 2.1 : 2.4;

    catDocs.forEach((doc, docIndex) => {
      const docNodeId = `doc-${doc.id}`;
      const angularOffset = M === 1 ? 0 : (docIndex - (M - 1) / 2) * 0.52;
      const phi = baseAngle + angularOffset;

      const docX = Number((catX + R_doc * Math.cos(phi)).toFixed(2));
      const docY = Number((catY + (docIndex % 2 === 0 ? 0.35 : -0.35)).toFixed(2));
      const docZ = Number((catZ + R_doc * Math.sin(phi)).toFixed(2));

      // Linked topics for this document (if expanded in future)
      const linkedTopicIds = docTopics
        .filter((dt) => dt.document_id === doc.id)
        .map((dt) => `topic-${dt.topic_id}`);

      const relatedIds = [catNodeId];

      // If document is selected/expanded, also link its topics
      if (expandedDocId === doc.id) {
        relatedIds.push(...linkedTopicIds);
      }

      nodes.push({
        id: docNodeId,
        name: getDisplayFilename(doc.filename),
        category: doc.category,
        position: [docX, docY, docZ],
        related: relatedIds,
        documents: 1,
        description: `Stored document under category "${doc.category}". Size: ${(doc.file_size / 1024).toFixed(1)} KB.`,
        color: colorConfig.color,
        glowColor: colorConfig.glow,
        sourceFile: doc.filename,
        confidence: 100,
        summarySnippet: `Document ${getDisplayFilename(doc.filename)} (${doc.file_type.toUpperCase()}) in ${categoryName}.`,
        realDoc: doc,
        isCategoryNode: false,
        isRootNode: false,
        isTopicNode: false,
      });

      // 3. Document → Future Topics / Concepts (Satellite expansion)
      if (expandedDocId === doc.id) {
        const docTopicList = topics.filter((t) =>
          docTopics.some((dt) => dt.document_id === doc.id && dt.topic_id === t.id)
        );

        if (docTopicList.length > 0) {
          const R_orbit = 2.0;
          docTopicList.forEach((topic, tIdx) => {
            const topicAngle = (2 * Math.PI * tIdx) / docTopicList.length + 0.35;
            const tX = Number((docX + R_orbit * Math.cos(topicAngle)).toFixed(2));
            const tY = Number((docY + 0.4 * Math.sin(topicAngle * 2)).toFixed(2));
            const tZ = Number((docZ + R_orbit * Math.sin(topicAngle)).toFixed(2));

            nodes.push({
              id: `topic-${topic.id}`,
              name: topic.name,
              category: 'Topic',
              position: [tX, tY, tZ],
              related: [docNodeId],
              documents: 1,
              description: topic.description || `Concept from "${getDisplayFilename(doc.filename)}".`,
              color: CATEGORY_COLORS.Topic.color,
              glowColor: CATEGORY_COLORS.Topic.glow,
              confidence: 95,
              summarySnippet: `Extracted concept from ${getDisplayFilename(doc.filename)}.`,
              realTopic: topic,
              isCategoryNode: false,
              isRootNode: false,
              isTopicNode: true,
              connectedDocCount: 1,
            });
          });
        }
      }
    });
  });

  // 4. Central MemorySpace Root Node
  nodes.unshift({
    id: 'root-memoryspace',
    name: 'MemorySpace',
    category: 'MemorySpace',
    position: [0, 0, 0],
    related: categoryNodeIds,
    documents: documents.length,
    description: `Personal MemorySpace Core connecting ${documents.length} ${documents.length === 1 ? 'file' : 'files'} across ${categoriesToShow.length} categories.`,
    color: CATEGORY_COLORS.MemorySpace.color,
    glowColor: CATEGORY_COLORS.MemorySpace.glow,
    confidence: 100,
    summarySnippet: `Central MemorySpace Root containing ${documents.length} verified personal documents.`,
    isRootNode: true,
    isCategoryNode: false,
    isTopicNode: false,
  });

  return nodes;
}
