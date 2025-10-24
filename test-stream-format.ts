import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

async function testStreamFormat() {
  const result = await streamText({
    model: openai('gpt-4-turbo'),
    system: 'You are a helpful assistant.',
    messages: [
      {
        role: 'user',
        content: 'Say hello in 5 words or less',
      },
    ],
  });

  // Convert to text stream response to see the format
  const response = result.toTextStreamResponse();
  const text = await response.text();
  
  console.log('=== RESPONSE TEXT ===');
  console.log(text);
  console.log('=== END ===');
  
  // Also try reading as json-encoded stream
  console.log('\n=== RESPONSE LINES ===');
  const lines = text.split('\n').filter(l => l.trim());
  lines.forEach((line, i) => {
    console.log(`Line ${i}:`, line);
  });
}

testStreamFormat().catch(console.error);
