import fs from 'fs';
import { extractTextFromPDF } from './src/services/extractionService.ts';
import { chunkDocumentText } from './src/services/chunkingService.ts';

async function testCampusMarket() {
  const data = fs.readFileSync('campus_market_prompt.pdf');
  const extractedText = await extractTextFromPDF(data.buffer);

  console.log('Extracted text total length:', extractedText.length);
  console.log('Preview first 200 chars:\n', extractedText.slice(0, 200));

  const chunks = chunkDocumentText(extractedText);
  console.log('\n--- CHUNKING RESULT FOR campus_market_prompt.pdf ---');
  console.log('Total chunks generated:', chunks.length);

  chunks.forEach((chunk, i) => {
    console.log(`\n[Chunk ${i}] Page: ${chunk.page_number} | Chars: ${chunk.character_count} | Words: ${chunk.word_count}`);
    console.log(`Preview: "${chunk.content.slice(0, 100)}..."`);
  });

  if (chunks.length >= 3) {
    console.log('\n✅ VERIFICATION SUCCESS: campus_market_prompt.pdf generated multiple chunks with page numbers!');
  } else {
    console.error('❌ Unexpected chunks count:', chunks.length);
  }
}

testCampusMarket().catch(console.error);
