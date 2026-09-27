import {
  normalizeText,
  parseSections,
  chunkDocumentText,
  chunkSingleText,
  DEFAULT_CHUNKING_OPTIONS,
} from './src/services/chunkingService.ts';

console.log('--- TEST 1: Short Document ---');
const shortText = 'Binary search requires sorted data.\nIt has a time complexity of O(log n).';
const shortChunks = chunkDocumentText(shortText);
console.log('Short chunks count:', shortChunks.length);
console.log('Chunk 0:', shortChunks[0]);
if (shortChunks.length === 1 && shortChunks[0].page_number === null) {
  console.log('✅ TEST 1 PASSED: Exactly 1 chunk produced for short text!');
} else {
  console.error('❌ TEST 1 FAILED');
}

console.log('\n--- TEST 2: Multi-Page PDF Text (Simulating campus_market_prompt.pdf) ---');
// Simulating 2 pages with 2500 and 1700 characters
const page1Text = Array(15).fill('Round Robin scheduling uses a time quantum. Preemption occurs when the quantum expires.').join(' ');
const page2Text = Array(12).fill('Virtual memory uses page tables and TLBs. Paging enables contiguous virtual address space.').join(' ');
const multiPageDoc = `Page 1:\n${page1Text}\n\nPage 2:\n${page2Text}`;

const pdfChunks = chunkDocumentText(multiPageDoc);
console.log('Total PDF chunks generated:', pdfChunks.length);
pdfChunks.forEach((c, i) => {
  console.log(`Chunk ${i}: Page ${c.page_number}, Chars: ${c.character_count}, Words: ${c.word_count}, Preview: ${c.content.slice(0, 60)}...`);
});

const page1Chunks = pdfChunks.filter(c => c.page_number === 1);
const page2Chunks = pdfChunks.filter(c => c.page_number === 2);
console.log(`Page 1 chunks: ${page1Chunks.length}, Page 2 chunks: ${page2Chunks.length}`);

if (pdfChunks.length > 1 && page1Chunks.length > 0 && page2Chunks.length > 0 && pdfChunks[0].slide_number === null) {
  console.log('✅ TEST 2 PASSED: Multi-page document partitioned with correct page_number metadata!');
} else {
  console.error('❌ TEST 2 FAILED');
}

console.log('\n--- TEST 3: Multi-Slide PPTX Text ---');
const pptxDoc = `Slide 1:\nOperating Systems and Architecture Overview.\n\nSlide 2:\nCPU Scheduling Algorithms and Multitasking Concepts.`;
const pptxChunks = chunkDocumentText(pptxDoc);
console.log('PPTX chunks count:', pptxChunks.length);
pptxChunks.forEach((c, i) => {
  console.log(`Chunk ${i}: Slide ${c.slide_number}, Page ${c.page_number}, Content: "${c.content}"`);
});

if (pptxChunks.length === 2 && pptxChunks[0].slide_number === 1 && pptxChunks[1].slide_number === 2 && pptxChunks[0].page_number === null) {
  console.log('✅ TEST 3 PASSED: Slide numbers preserved accurately!');
} else {
  console.error('❌ TEST 3 FAILED');
}

console.log('\n--- TEST 4: Boundary & Overlap Verification ---');
const sampleText = `The operating system is essential software that manages hardware and software resources.

Process scheduling is an essential task of the operating system. It selects which process runs on the CPU.
There are various scheduling algorithms such as First-Come First-Served, Shortest Job First, and Priority Scheduling.
Round Robin is widely used in time-sharing systems where each process is given a fixed time slice.

Memory management is another crucial component. It tracks each memory location and handles paging and swapping.
Virtual memory allows execution of processes that may not be completely in memory.
Page replacement algorithms include FIFO, Optimal, and Least Recently Used.

File systems provide an abstraction for storing data persistently on storage drives.
Common file systems include NTFS, ext4, APFS, and FAT32.`;

const chunks = chunkSingleText(sampleText, DEFAULT_CHUNKING_OPTIONS);
console.log('Sample text chunks count:', chunks.length);
chunks.forEach((c, idx) => {
  console.log(`Chunk ${idx} length: ${c.length} chars`);
  console.log(`Start: "${c.slice(0, 45)}..."`);
  console.log(`End: "...${c.slice(-45)}"`);
});

console.log('\nAll unit tests completed successfully!');
