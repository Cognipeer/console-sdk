import { ConsoleClient } from '@cognipeer/console-sdk';

/**
 * Basic chat completion example
 */
async function basicChat() {
  const client = new ConsoleClient({
    apiKey: process.env.COGNIPEER_API_KEY!,
  });

  console.log('=== Basic Chat Example ===\n');

  const response = await client.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {
        role: 'system',
        content: 'You are a helpful assistant.',
      },
      {
        role: 'user',
        content: 'What is the capital of France?',
      },
    ],
  });

  console.log('Response:', response.choices[0].message.content);
  console.log('\nUsage:', response.usage);
}

/**
 * Multi-turn conversation example
 */
async function multiTurnChat() {
  const client = new ConsoleClient({
    apiKey: process.env.COGNIPEER_API_KEY!,
  });

  console.log('\n=== Multi-Turn Conversation ===\n');

  const messages = [
    {
      role: 'system' as const,
      content: 'You are a knowledgeable history teacher.',
    },
    {
      role: 'user' as const,
      content: 'Tell me about World War II.',
    },
  ];

  // First turn
  const response1 = await client.chat.completions.create({
    model: 'gpt-4',
    messages,
  });

  console.log('Assistant:', response1.choices[0].message.content);
  messages.push(response1.choices[0].message);

  // Second turn
  messages.push({
    role: 'user',
    content: 'What were the main causes?',
  });

  const response2 = await client.chat.completions.create({
    model: 'gpt-4',
    messages,
  });

  console.log('\nAssistant:', response2.choices[0].message.content);
}

/**
 * Temperature and creativity example
 */
async function temperatureExample() {
  const client = new ConsoleClient({
    apiKey: process.env.COGNIPEER_API_KEY!,
  });

  console.log('\n=== Temperature Example ===\n');

  const prompt = 'Write a creative tagline for a coffee shop.';

  // Low temperature (more deterministic)
  console.log('Low temperature (0.2):');
  const lowTemp = await client.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
  });
  console.log(lowTemp.choices[0].message.content);

  // High temperature (more creative)
  console.log('\nHigh temperature (1.5):');
  const highTemp = await client.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
    temperature: 1.5,
  });
  console.log(highTemp.choices[0].message.content);
}

/**
 * Max tokens example
 */
async function maxTokensExample() {
  const client = new ConsoleClient({
    apiKey: process.env.COGNIPEER_API_KEY!,
  });

  console.log('\n=== Max Tokens Example ===\n');

  const response = await client.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {
        role: 'user',
        content: 'Explain quantum computing in detail.',
      },
    ],
    max_tokens: 100, // Limit response length
  });

  console.log('Response (limited to 100 tokens):');
  console.log(response.choices[0].message.content);
  console.log('\nTokens used:', response.usage.completion_tokens);
}

// Run examples
async function main() {
  try {
    await basicChat();
    await multiTurnChat();
    await temperatureExample();
    await maxTokensExample();
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
