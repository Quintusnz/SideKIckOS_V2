// Quick test to see what the API returns
const testApi = async () => {
  try {
    const response = await fetch('http://localhost:3000/api/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Hello, what skills do you have?' }],
      }),
    });

    console.log('Status:', response.status);
    console.log('Headers:', Object.fromEntries(response.headers));

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      fullText += chunk;
      console.log('--- Raw Chunk ---');
      console.log(chunk);
      console.log('--- End Chunk ---');
    }

    console.log('\n=== FULL RESPONSE ===');
    console.log(fullText);
  } catch (error) {
    console.error('Error:', error.message);
  }
};

testApi();
