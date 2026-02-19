import { CognipeerClient } from '@cognipeer/console-sdk';

/**
 * Basic streaming example
 */
async function basicStreaming() {
  const client = new CognipeerClient({
    apiKey: process.env.COGNIPEER_API_KEY!,
  });

  console.log('=== Basic Streaming Example ===\n');
  console.log('User: Tell me a short story about a robot.\n');
  console.log('Assistant: ');

  const stream = await client.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {
        role: 'user',
        content: 'Tell me a short story about a robot.',
      },
    ],
    stream: true,
  });

  let fullResponse = '';

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      process.stdout.write(content);
      fullResponse += content;
    }
  }

  console.log('\n\nFull response length:', fullResponse.length);
}

/**
 * Streaming with conversation history
 */
async function streamingWithHistory() {
  const client = new CognipeerClient({
    apiKey: process.env.COGNIPEER_API_KEY!,
  });

  console.log('\n=== Streaming with History ===\n');

  const messages = [
    {
      role: 'system' as const,
      content: 'You are a helpful coding assistant.',
    },
    {
      role: 'user' as const,
      content: 'What is recursion?',
    },
  ];

  console.log('User: What is recursion?\n');
  console.log('Assistant: ');

  const stream = await client.chat.completions.create({
    model: 'gpt-4',
    messages,
    stream: true,
  });

  let assistantMessage = '';

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      process.stdout.write(content);
      assistantMessage += content;
    }
  }

  console.log('\n');

  // Add to conversation history
  messages.push({
    role: 'assistant',
    content: assistantMessage,
  });

  messages.push({
    role: 'user',
    content: 'Can you give me a Python example?',
  });

  console.log('\nUser: Can you give me a Python example?\n');
  console.log('Assistant: ');

  const stream2 = await client.chat.completions.create({
    model: 'gpt-4',
    messages,
    stream: true,
  });

  for await (const chunk of stream2) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      process.stdout.write(content);
    }
  }

  console.log('\n');
}

/**
 * Streaming with cancellation
 */
async function streamingWithCancellation() {
  const client = new CognipeerClient({
    apiKey: process.env.COGNIPEER_API_KEY!,
  });

  console.log('\n=== Streaming with Cancellation ===\n');
  console.log('User: Write a very long essay about AI.\n');
  console.log('Assistant: ');

  const controller = new AbortController();

  // Cancel after 3 seconds
  setTimeout(() => {
    console.log('\n\n[Cancelling stream...]');
    controller.abort();
  }, 3000);

  try {
    const stream = await client.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'user',
          content: 'Write a very long essay about artificial intelligence.',
        },
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        process.stdout.write(content);
      }
    }
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      console.log('\nStream cancelled successfully.');
    } else {
      throw error;
    }
  }
}

/**
 * Real-time UI update simulation
 */
async function realtimeUIExample() {
  const client = new CognipeerClient({
    apiKey: process.env.COGNIPEER_API_KEY!,
  });

  console.log('\n=== Real-time UI Update Example ===\n');

  interface UIState {
    content: string;
    isComplete: boolean;
    wordCount: number;
  }

  const uiState: UIState = {
    content: '',
    isComplete: false,
    wordCount: 0,
  };

  // Simulate UI update function
  function updateUI(state: UIState) {
    // Clear console (simulation)
    process.stdout.write('\r\x1b[K');
    process.stdout.write(
      `Words: ${state.wordCount} | ${state.isComplete ? 'Complete' : 'Streaming...'}`
    );
  }

  const stream = await client.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {
        role: 'user',
        content: 'Explain the benefits of TypeScript in 3 sentences.',
      },
    ],
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      uiState.content += content;
      uiState.wordCount = uiState.content.split(/\s+/).length;
      updateUI(uiState);
    }
  }

  uiState.isComplete = true;
  updateUI(uiState);
  console.log('\n\nFinal content:');
  console.log(uiState.content);
}

// Run examples
async function main() {
  try {
    await basicStreaming();
    await streamingWithHistory();
    await streamingWithCancellation();
    await realtimeUIExample();
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
