
async function testKey() {
  const apiKey = 'AIzaSyAxIHPPMWkWxJ6KMp_w5XMWhtUyogWDLxY';
  const model = 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  console.log('Testing URL (masked):', url.replace(apiKey, 'REDACTED'));

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Hello, say "Connection Successful" if you can hear me.' }] }]
      })
    });

    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response Body:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Fetch Error:', err);
  }
}

testKey();
