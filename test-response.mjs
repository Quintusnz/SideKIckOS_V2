/**
 * Test to see the actual API response format
 */

async function testAPIResponse() {
  try {
    console.log('Testing API response format...\n');

    const response = await fetch('http://127.0.0.1:3000/api/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Say hello briefly' }],
      }),
      timeout: 30000,
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', {
      contentType: response.headers.get('content-type'),
      transferEncoding: response.headers.get('transfer-encoding'),
    });

    const text = await response.text();
    
    console.log('\n=== RAW RESPONSE ===');
    console.log(text);
    
    console.log('\n=== RESPONSE LINES (with indices) ===');
    const lines = text.split('\n');
    lines.forEach((line, idx) => {
      console.log(`[${idx}] ${line}`);
    });

    console.log('\n=== ANALYSIS ===');
    const nonEmptyLines = lines.filter(l => l.trim());
    console.log(`Total lines: ${lines.length}`);
    console.log(`Non-empty lines: ${nonEmptyLines.length}`);
    
    // Try to extract text
    let extracted = '';
    for (const line of nonEmptyLines) {
      if (line.startsWith('0:"')) {
        console.log('Found format 0: type line');
        const content = line.slice(2);
        try {
          const parsed = JSON.parse(content);
          console.log('  Parsed value:', parsed);
          extracted += parsed;
        } catch (error) {
          console.log('  Failed to parse as JSON');
          console.log('  Reason:', error instanceof Error ? error.message : String(error));
        }
      } else if (line.startsWith('d:')) {
        console.log('Found format d: type line');
        const jsonStr = line.slice(2);
        try {
          const data = JSON.parse(jsonStr);
          console.log('  Parsed data:', data);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.log('  Failed to parse JSON:', message);
        }
      } else {
        console.log(`Unknown format: ${line.substring(0, 50)}`);
      }
    }
    
    console.log('\n=== EXTRACTED TEXT ===');
    console.log(extracted || '(no text extracted)');

  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testAPIResponse();
