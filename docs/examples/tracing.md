# Agent Tracing

This guide covers how to implement tracing for your AI agents using Cognipeer Console SDK. Tracing helps you monitor agent execution, debug issues, and gain insights into your AI workflows.

## Overview

Cognipeer Console SDK provides two main tracing integrations:

1. **LangChain Tracing** - For LangChain agents and chains
2. **LangGraph Tracing** - For LangGraph state machines and workflows

## Installation

```bash
npm install @cognipeer/console-sdk @langchain/core langchain
# For LangGraph support
npm install @langchain/langgraph
```

## LangChain Integration

### Basic Tracing with Callbacks

Use `CognipeerTracingCallbackHandler` to capture events from LangChain chains and agents:

```typescript
import { ConsoleClient } from '@cognipeer/console-sdk';
import { CognipeerTracingCallbackHandler } from '@cognipeer/console-sdk/integrations/langchain';
import { ChatOpenAI } from '@langchain/openai';

const client = new ConsoleClient({
  apiKey: process.env.COGNIPEER_API_KEY!,
});

// Create tracing handler
const tracingHandler = new CognipeerTracingCallbackHandler({
  client,
  sessionId: 'my-session-123',
  threadId: 'thread_support-ticket-99',
  agent: {
    name: 'my-langchain-agent',
    version: '1.0.0',
  },
  autoFlush: true,
  debug: true,
});

// Use with LangChain
const model = new ChatOpenAI({
  modelName: 'gpt-4',
  callbacks: [tracingHandler],
});

const response = await model.invoke('Hello, how are you?');
console.log(response.content);

// End session when done
await tracingHandler.endSession();
```

### Using createCognipeerAgentTracing Helper

For cleaner code, use the `createCognipeerAgentTracing` helper:

```typescript
import { ConsoleClient, createCognipeerAgentTracing } from '@cognipeer/console-sdk';
import { ChatOpenAI } from '@langchain/openai';
import { AgentExecutor, createOpenAIFunctionsAgent } from 'langchain/agents';

const client = new ConsoleClient({
  apiKey: process.env.COGNIPEER_API_KEY!,
});

// Create tracing binding
const tracing = createCognipeerAgentTracing({
  client,
  agent: {
    name: 'customer-support-agent',
    version: '2.0.0',
  },
  debug: true,
});

console.log('Session ID:', tracing.sessionId);

// Create agent with tracing callbacks
const model = new ChatOpenAI({ modelName: 'gpt-4' });
const agent = await createOpenAIFunctionsAgent({
  llm: model,
  tools: [],
  prompt: promptTemplate,
});

const executor = new AgentExecutor({
  agent,
  tools: [],
  callbacks: tracing.callbacks, // Pass tracing callbacks
});

// Run agent
const result = await executor.invoke({
  input: 'Help me with my order',
});

// Flush and end session
await tracing.end();
```

### Using CognipeerLangChainChatModel

Use Cognipeer Console SDK's LangChain-compatible chat model for seamless integration:

```typescript
import { ConsoleClient } from '@cognipeer/console-sdk';
import { CognipeerLangChainChatModel, createCognipeerAgentTracing } from '@cognipeer/console-sdk/integrations/langchain';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

const client = new ConsoleClient({
  apiKey: process.env.COGNIPEER_API_KEY!,
});

// Create Cognipeer-powered chat model
const model = new CognipeerLangChainChatModel({
  client,
  model: 'gpt-4',
  temperature: 0.7,
  maxTokens: 1000,
});

// With tracing
const tracing = createCognipeerAgentTracing({ client });

const messages = [
  new SystemMessage('You are a helpful assistant.'),
  new HumanMessage('What is the capital of France?'),
];

const response = await model.invoke(messages, {
  callbacks: tracing.callbacks,
});

console.log(response.content);
await tracing.end();
```

### Streaming with Tracing

```typescript
import { CognipeerLangChainChatModel, createCognipeerAgentTracing } from '@cognipeer/console-sdk/integrations/langchain';

const model = new CognipeerLangChainChatModel({
  client,
  model: 'gpt-4',
});

const tracing = createCognipeerAgentTracing({ client });

const stream = await model.stream(
  [new HumanMessage('Tell me a story about a robot')],
  { callbacks: tracing.callbacks }
);

for await (const chunk of stream) {
  process.stdout.write(chunk.content);
}

await tracing.end();
```

### Tracing Middleware

For advanced use cases, use the tracing middleware:

```typescript
import { createCognipeerTracingMiddleware } from '@cognipeer/console-sdk/integrations/langchain';

const middleware = createCognipeerTracingMiddleware({
  client,
  agent: {
    name: 'middleware-agent',
    version: '1.0.0',
  },
  debug: true,
});

console.log('Session:', middleware.sessionId);

// Use with createAgent or similar patterns
const agent = await createAgent({
  llm: model,
  tools: myTools,
  middleware: [middleware.middleware],
});

// Run your agent...
const result = await agent.invoke({ input: 'Hello' });

// End session
await middleware.end();
```

## LangGraph Integration

### Basic LangGraph Tracing

For LangGraph state machines, use `createCognipeerLangGraphTracing`:

```typescript
import { ConsoleClient } from '@cognipeer/console-sdk';
import { createCognipeerLangGraphTracing } from '@cognipeer/console-sdk/integrations/langgraph';
import { StateGraph, MessagesAnnotation, START, END } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';

const client = new ConsoleClient({
  apiKey: process.env.COGNIPEER_API_KEY!,
});

// Create tracing
const tracing = createCognipeerLangGraphTracing({
  client,
  agent: {
    name: 'my-langgraph-agent',
    version: '1.0.0',
  },
  threadId: 'thread_workflow-42',
  debug: true,
});

console.log('Session ID:', tracing.sessionId);

const model = new ChatOpenAI({ modelName: 'gpt-4' });

// Define node functions
async function callModel(state: typeof MessagesAnnotation.State) {
  const response = await model.invoke(state.messages);
  return { messages: [response] };
}

// Wrap with tracing
const tracedCallModel = tracing.wrapNode('callModel', callModel);

// Build graph
const graph = new StateGraph(MessagesAnnotation)
  .addNode('callModel', tracedCallModel)
  .addEdge(START, 'callModel')
  .addEdge('callModel', END)
  .compile();

// Execute with graph-level tracing
const graphId = tracing.startGraph('SimpleAgent');

try {
  const result = await graph.invoke({
    messages: [{ role: 'user', content: 'Hello!' }],
  });
  await tracing.endGraph(graphId, result, 'success');
  console.log(result);
} catch (error) {
  await tracing.endGraph(graphId, undefined, 'error');
  throw error;
}

// End session
await tracing.end();
```

### Tracing Multiple Nodes

Use `traceNodes` to wrap multiple node functions at once:

```typescript
import { createCognipeerLangGraphTracing } from '@cognipeer/console-sdk/integrations/langgraph';
import { StateGraph, MessagesAnnotation, START, END } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';

const tracing = createCognipeerLangGraphTracing({
  client,
  agent: { name: 'multi-node-agent', version: '1.0.0' },
});

// Define node functions
async function callModel(state: typeof MessagesAnnotation.State) {
  const response = await model.invoke(state.messages);
  return { messages: [response] };
}

async function processTools(state: typeof MessagesAnnotation.State) {
  // Tool processing logic
  return { messages: state.messages };
}

async function summarize(state: typeof MessagesAnnotation.State) {
  // Summarization logic
  return { messages: state.messages };
}

// Wrap all nodes at once
const nodes = tracing.traceNodes({
  callModel,
  processTools,
  summarize,
});

// Build graph with traced nodes
const graph = new StateGraph(MessagesAnnotation)
  .addNode('callModel', nodes.callModel)
  .addNode('processTools', nodes.processTools)
  .addNode('summarize', nodes.summarize)
  .addEdge(START, 'callModel')
  .addConditionalEdges('callModel', routeModelOutput)
  .addEdge('processTools', 'callModel')
  .addEdge('summarize', END)
  .compile();
```

### ReAct Agent with Tracing

Complete example of a ReAct agent with tool calling:

```typescript
import { ConsoleClient } from '@cognipeer/console-sdk';
import { createCognipeerLangGraphTracing } from '@cognipeer/console-sdk/integrations/langgraph';
import { StateGraph, MessagesAnnotation, START, END } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { ChatOpenAI } from '@langchain/openai';
import { TavilySearchResults } from '@langchain/community/tools/tavily_search';
import { AIMessage } from '@langchain/core/messages';

const client = new ConsoleClient({
  apiKey: process.env.COGNIPEER_API_KEY!,
});

// Setup tracing
const tracing = createCognipeerLangGraphTracing({
  client,
  agent: {
    name: 'react-agent',
    version: '1.0.0',
    description: 'ReAct agent with web search',
  },
  threadId: 'thread_research-task-7',
  debug: true,
});

// Define tools
const tools = [new TavilySearchResults({ maxResults: 3 })];
const toolNode = new ToolNode(tools);

// Model with tools
const model = new ChatOpenAI({
  modelName: 'gpt-4',
  temperature: 0,
}).bindTools(tools);

// Define nodes
async function callModel(state: typeof MessagesAnnotation.State) {
  const response = await model.invoke(state.messages);
  
  // Record LLM call in tracing
  tracing.tracer.recordLLMCall('gpt-4', 100, 50, 500);
  
  return { messages: [response] };
}

async function executeTools(state: typeof MessagesAnnotation.State) {
  const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
  
  // Record tool calls
  if (lastMessage.tool_calls) {
    for (const toolCall of lastMessage.tool_calls) {
      tracing.tracer.recordToolCall(
        toolCall.name,
        toolCall.args,
        undefined,
        100
      );
    }
  }
  
  const result = await toolNode.invoke(state);
  return result;
}

// Routing function
function shouldContinue(state: typeof MessagesAnnotation.State) {
  const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
  if (lastMessage.tool_calls?.length) {
    return 'tools';
  }
  return END;
}

// Wrap nodes with tracing
const nodes = tracing.traceNodes({
  callModel,
  tools: executeTools,
});

// Build graph
const graph = new StateGraph(MessagesAnnotation)
  .addNode('callModel', nodes.callModel)
  .addNode('tools', nodes.tools)
  .addEdge(START, 'callModel')
  .addConditionalEdges('callModel', shouldContinue, {
    tools: 'tools',
    [END]: END,
  })
  .addEdge('tools', 'callModel')
  .compile();

// Run agent
async function runAgent(query: string) {
  const graphId = tracing.startGraph('ReActAgent', { query });
  
  try {
    const result = await graph.invoke({
      messages: [{ role: 'user', content: query }],
    });
    
    await tracing.endGraph(graphId, result, 'success');
    return result;
  } catch (error) {
    await tracing.endGraph(graphId, undefined, 'error');
    throw error;
  }
}

// Execute
const result = await runAgent('What is the latest news about AI?');
console.log(result.messages[result.messages.length - 1].content);

// End session
await tracing.end();
```

### Using Traced Invoker Helper

For simpler code, use the `createTracedGraphInvoker` helper:

```typescript
import { 
  createCognipeerLangGraphTracing,
  createTracedGraphInvoker 
} from '@cognipeer/console-sdk/integrations/langgraph';

const tracing = createCognipeerLangGraphTracing({ client });

// Create a traced invoker
const tracedInvoke = createTracedGraphInvoker(tracing, 'MyAgent');

// Use like normal invoke
const result = await tracedInvoke(graph, {
  messages: [{ role: 'user', content: 'Hello!' }],
});

await tracing.end();
```

### Streaming with Tracing

```typescript
import { 
  createCognipeerLangGraphTracing,
  createTracedGraphStreamer 
} from '@cognipeer/console-sdk/integrations/langgraph';

const tracing = createCognipeerLangGraphTracing({ client });
const tracedStream = createTracedGraphStreamer(tracing, 'StreamingAgent');

// Stream with automatic tracing
for await (const chunk of tracedStream(graph, { messages })) {
  console.log('Node:', Object.keys(chunk)[0]);
  console.log('Output:', chunk);
}

await tracing.end();
```

## Advanced Tracing Features

### Custom Agent Metadata

```typescript
const tracing = createCognipeerLangGraphTracing({
  client,
  agent: {
    name: 'custom-agent',
    version: '2.1.0',
    description: 'A specialized customer support agent',
    metadata: {
      department: 'support',
      tier: 'premium',
    },
  },
  summary: {
    totalInputTokens: 0,
    totalOutputTokens: 0,
    eventCounts: {},
  },
  config: {
    maxRetries: 3,
    timeout: 30000,
  },
});
```

### Manual Event Recording

```typescript
// Record custom tool calls
tracing.tracer.recordToolCall(
  'database_query',
  { table: 'users', filter: { active: true } },
  { count: 42 },
  150 // duration in ms
);

// Record LLM calls with token usage
tracing.tracer.recordLLMCall(
  'gpt-4',
  500,  // input tokens
  200,  // output tokens
  750   // duration in ms
);
```

### Manual Flush

```typescript
// Flush events at specific points
await tracing.flush('running');

// Or with the tracer directly
await tracing.tracer.flush('completed');
```

### Error Handling

```typescript
const graphId = tracing.startGraph('MyAgent');

try {
  const result = await graph.invoke(input);
  await tracing.endGraph(graphId, result, 'success');
} catch (error) {
  // Errors are automatically captured
  await tracing.endGraph(graphId, undefined, 'error');
  
  // You can also manually record errors
  await tracing.tracer.errorNode('node-id', error);
  
  throw error;
} finally {
  // Always end the session
  await tracing.end();
}
```

## Thread Correlation (Multi-Agent Workflows)

When multiple agents collaborate on a single task, use the same `threadId` across all of them to correlate the sessions in the dashboard.

```typescript
const THREAD_ID = `thread_order-${orderId}`;

// Agent 1 – Planner
const plannerTracing = createCognipeerLangGraphTracing({
  client,
  threadId: THREAD_ID,
  agent: { name: 'planner-agent', version: '1.0.0' },
});
// ... run planner graph ...
await plannerTracing.end();

// Agent 2 – Executor
const executorTracing = createCognipeerLangGraphTracing({
  client,
  threadId: THREAD_ID,
  agent: { name: 'executor-agent', version: '1.0.0' },
});
// ... run executor graph ...
await executorTracing.end();

// Agent 3 – Reviewer
const reviewerTracing = createCognipeerLangGraphTracing({
  client,
  threadId: THREAD_ID,
  agent: { name: 'reviewer-agent', version: '1.0.0' },
});
// ... run reviewer graph ...
await reviewerTracing.end();
```

All three sessions will appear under the same thread in **Tracing → Threads** in the dashboard, giving you a complete timeline of the workflow.

## Viewing Traces

After running your agents, you can view traces in the Cognipeer Dashboard:

1. Go to your Cognipeer Dashboard
2. Navigate to **Tracing** → **Sessions**
3. Find your session by ID or agent name
4. View the execution timeline, token usage, and event details

To view multi-agent workflows grouped by thread:

1. Navigate to **Tracing** → **Threads**
2. Browse threads with aggregated metrics and session counts
3. Click a thread to see the full chronological timeline of all participating sessions

## Best Practices

1. **Always end sessions** - Call `tracing.end()` when your agent completes
2. **Use meaningful names** - Give your agents and nodes descriptive names
3. **Enable debug mode** - During development, use `debug: true` for detailed logs
4. **Set session IDs** - Use custom session IDs for correlation with your systems
5. **Track token usage** - Use `recordLLMCall` to track costs accurately
6. **Handle errors** - Always wrap graph execution in try/catch for proper error tracing

## API Reference

### CognipeerTracingCallbackHandler

| Method | Description |
|--------|-------------|
| `getSessionId()` | Get the current session ID |
| `flush(status?)` | Flush buffered events |
| `endSession(status?)` | End session and flush |

### CognipeerLangGraphTracer

| Method | Description |
|--------|-------------|
| `getSessionId()` | Get the current session ID |
| `startGraph(name?, state?)` | Start graph execution |
| `endGraph(id, state?, status?)` | End graph execution |
| `startNode(name, state?)` | Start node execution |
| `endNode(id, output?, status?)` | End node execution |
| `wrapNode(name, fn)` | Wrap a node function |
| `traceNodes(nodes)` | Wrap multiple nodes |
| `recordToolCall(...)` | Record a tool call |
| `recordLLMCall(...)` | Record an LLM call |
| `flush(status?)` | Flush buffered events |
| `endSession(status?)` | End session |

## Next Steps

- Learn about [Chat Completions](/examples/chat)
- Explore [RAG with Vectors](/examples/rag)
- Check the [Tracing API Reference](/api/tracing)
