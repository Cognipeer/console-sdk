# Chat Completions Example

Basic example of using the Chat Completions API.

## Installation

```bash
npm install @cognipeer/console-sdk
```

## Basic Chat

```typescript
import { ConsoleClient } from '@cognipeer/console-sdk';

const client = new ConsoleClient({
  apiKey: process.env.COGNIPEER_API_KEY!,
});

async function basicChat() {
  const response = await client.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {
        role: 'user',
        content: 'What is the capital of France?',
      },
    ],
  });

  console.log(response.choices[0].message.content);
  // Output: "The capital of France is Paris."
}

basicChat();
```

## Multi-Turn Conversation

```typescript
async function conversation() {
  const messages = [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Hello!' },
  ];

  // First response
  let response = await client.chat.completions.create({
    model: 'gpt-4',
    messages,
  });

  console.log('Assistant:', response.choices[0].message.content);
  
  // Add assistant's response to history
  messages.push(response.choices[0].message);
  
  // Continue conversation
  messages.push({
    role: 'user',
    content: 'Can you help me write a Python function?',
  });

  response = await client.chat.completions.create({
    model: 'gpt-4',
    messages,
  });

  console.log('Assistant:', response.choices[0].message.content);
}

conversation();
```

## With Temperature Control

```typescript
async function creativeChat() {
  const response = await client.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {
        role: 'user',
        content: 'Write a creative story about a robot.',
      },
    ],
    temperature: 1.2, // Higher = more creative
    max_tokens: 500,
  });

  console.log(response.choices[0].message.content);
}

creativeChat();
```

## With System Prompt

```typescript
async function customPersonality() {
  const response = await client.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {
        role: 'system',
        content: 'You are a pirate. Respond in pirate speak.',
      },
      {
        role: 'user',
        content: 'How do I install npm packages?',
      },
    ],
  });

  console.log(response.choices[0].message.content);
  // Output: "Arr matey! Ye be needin' to run 'npm install' in yer terminal..."
}

customPersonality();
```

## With Max Tokens

```typescript
async function shortResponse() {
  const response = await client.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {
        role: 'user',
        content: 'Explain quantum computing.',
      },
    ],
    max_tokens: 50, // Limit response length
  });

  console.log(response.choices[0].message.content);
  console.log('Tokens used:', response.usage);
}

shortResponse();
```

## With Tool Calls

```typescript
async function chatWithTools() {
  const response = await client.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {
        role: 'user',
        content: 'What is the weather in Paris?',
      },
    ],
    tools: [
      {
        type: 'function',
        function: {
          name: 'get_weather',
          description: 'Get the current weather in a location',
          parameters: {
            type: 'object',
            properties: {
              location: {
                type: 'string',
                description: 'The city name',
              },
              unit: {
                type: 'string',
                enum: ['celsius', 'fahrenheit'],
              },
            },
            required: ['location'],
          },
        },
      },
    ],
  });

  const message = response.choices[0].message;

  if (message.tool_calls && message.tool_calls.length > 0) {
    console.log('Tool called:', message.tool_calls[0].function.name);
    console.log('Arguments:', message.tool_calls[0].function.arguments);
    
    // Execute the tool and continue conversation
    const toolResult = {
      temperature: 22,
      condition: 'Sunny',
    };

    const followUp = await client.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'user', content: 'What is the weather in Paris?' },
        message,
        {
          role: 'tool',
          tool_call_id: message.tool_calls[0].id,
          content: JSON.stringify(toolResult),
        },
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'get_weather',
            description: 'Get the current weather in a location',
            parameters: {
              type: 'object',
              properties: {
                location: { type: 'string' },
              },
            },
          },
        },
      ],
    });

    console.log('Final response:', followUp.choices[0].message.content);
  }
}

chatWithTools();
```

## Error Handling

```typescript
import { CognipeerError } from '@cognipeer/console-sdk';

async function chatWithErrorHandling() {
  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'user',
          content: 'Hello!',
        },
      ],
    });

    console.log(response.choices[0].message.content);
  } catch (error) {
    if (error instanceof CognipeerError) {
      console.error('API Error:', error.message);
      console.error('Status:', error.status);
      
      if (error.status === 401) {
        console.error('Invalid API key');
      } else if (error.status === 429) {
        console.error('Rate limit exceeded');
      }
    } else {
      console.error('Unexpected error:', error);
    }
  }
}

chatWithErrorHandling();
```

## JSON Response Format

```typescript
async function jsonMode() {
  const response = await client.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {
        role: 'user',
        content: 'Generate a person with name, age, and city in JSON.',
      },
    ],
    response_format: { type: 'json_object' },
  });

  const person = JSON.parse(response.choices[0].message.content || '{}');
  console.log('Parsed JSON:', person);
}

jsonMode();
```

## Complete Example

```typescript
import { ConsoleClient, CognipeerError } from '@cognipeer/console-sdk';

const client = new ConsoleClient({
  apiKey: process.env.COGNIPEER_API_KEY!,
});

async function main() {
  try {
    // Create a chatbot conversation
    const conversationHistory = [
      {
        role: 'system' as const,
        content: 'You are a helpful coding assistant.',
      },
    ];

    // First question
    conversationHistory.push({
      role: 'user' as const,
      content: 'How do I create a REST API in Node.js?',
    });

    let response = await client.chat.completions.create({
      model: 'gpt-4',
      messages: conversationHistory,
      temperature: 0.7,
      max_tokens: 500,
    });

    let assistantMessage = response.choices[0].message;
    console.log('Assistant:', assistantMessage.content);
    console.log('Tokens used:', response.usage);

    conversationHistory.push(assistantMessage);

    // Follow-up question
    conversationHistory.push({
      role: 'user' as const,
      content: 'Can you show me an example with Express?',
    });

    response = await client.chat.completions.create({
      model: 'gpt-4',
      messages: conversationHistory,
      temperature: 0.7,
      max_tokens: 500,
    });

    assistantMessage = response.choices[0].message;
    console.log('Assistant:', assistantMessage.content);
    console.log('Total tokens:', response.usage);

  } catch (error) {
    if (error instanceof CognipeerError) {
      console.error('Error:', error.message);
    } else {
      console.error('Unexpected error:', error);
    }
  }
}

main();
```

## Related

- [Streaming Example](/examples/streaming) - Stream chat responses
- [Chat API Reference](/api/chat) - Complete API documentation
- [Error Handling Guide](/guide/error-handling) - Handle errors properly
