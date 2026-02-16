# LangGraph Integration

CGate SDK provides seamless integration with LangGraph for tracing and monitoring your graph-based AI agent workflows.

## Installation

```bash
npm install @cognipeer/cgate-sdk @langchain/langgraph
```

## Quick Start

```typescript
import { CGateClient, createCGateLangGraphTracing } from '@cognipeer/cgate-sdk';
import { StateGraph, MessagesAnnotation, START, END } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';

// Create CGate client
const client = new CGateClient({
  apiKey: 'your-api-key',
});

// Create LangGraph tracing
const tracing = createCGateLangGraphTracing({
  client,
  agent: {
    name: 'my-langgraph-agent',
    version: '1.0.0',
  },
  debug: true,
});

// Define your node functions with tracing
const nodes = tracing.traceNodes({
  callModel: async (state) => {
    const model = new ChatOpenAI({ model: 'gpt-4o-mini' });
    const response = await model.invoke(state.messages);
    return { messages: [response] };
  },
  processResult: async (state) => {
    // Process the result
    return state;
  },
});

// Build your graph
const graph = new StateGraph(MessagesAnnotation)
  .addNode('callModel', nodes.callModel)
  .addNode('processResult', nodes.processResult)
  .addEdge(START, 'callModel')
  .addEdge('callModel', 'processResult')
  .addEdge('processResult', END)
  .compile();

// Run with tracing
async function run() {
  const graphId = tracing.startGraph('MyAgent');
  
  try {
    const result = await graph.invoke({
      messages: [{ role: 'user', content: 'Hello!' }],
    });
    await tracing.endGraph(graphId, result, 'success');
  } catch (error) {
    await tracing.endGraph(graphId, undefined, 'error');
  }
  
  // End the session
  await tracing.end('success');
}
```

## API Reference

### `createCGateLangGraphTracing(options)`

Creates a LangGraph tracing binding.

#### Options

| Option | Type | Description |
|--------|------|-------------|
| `client` | `CGateClient \| CGateClientOptions` | SDK client or configuration |
| `sessionId` | `string` | Optional session ID (auto-generated if omitted) |
| `threadId` | `string` | Optional thread ID to group related sessions across agents |
| `agent` | `TracingAgent` | Agent descriptor |
| `summary` | `TracingSummary` | Initial summary |
| `config` | `Record<string, unknown>` | Optional config blob |
| `autoFlush` | `boolean` | Auto flush on node completion (default: false) |
| `debug` | `boolean` | Enable debug logging (default: false) |
| `logger` | `Function` | Custom logger function |

#### Returns

| Property | Type | Description |
|----------|------|-------------|
| `sessionId` | `string` | Session ID for correlation |
| `tracer` | `CGateLangGraphTracer` | Tracer instance |
| `wrapNode` | `Function` | Wrap a single node with tracing |
| `traceNodes` | `Function` | Wrap multiple nodes at once |
| `startGraph` | `Function` | Start graph execution tracking |
| `endGraph` | `Function` | End graph execution tracking |
| `flush` | `Function` | Manually flush events |
| `end` | `Function` | End session and flush |

### `tracing.wrapNode(nodeName, fn)`

Wraps a single node function with automatic tracing.

```typescript
const tracedNode = tracing.wrapNode('myNode', async (state) => {
  // Your node logic
  return { ...state, processed: true };
});
```

### `tracing.traceNodes(nodes)`

Wraps multiple node functions at once.

```typescript
const nodes = tracing.traceNodes({
  node1: async (state) => { /* ... */ },
  node2: async (state) => { /* ... */ },
  node3: async (state) => { /* ... */ },
});
```

### `tracing.startGraph(graphName?, initialState?)`

Starts tracking a graph execution. Returns a `graphId` for correlation.

```typescript
const graphId = tracing.startGraph('MyWorkflow', { input: 'data' });
```

### `tracing.endGraph(graphId, finalState?, status?)`

Ends tracking a graph execution.

```typescript
await tracing.endGraph(graphId, result, 'success');
// or on error
await tracing.endGraph(graphId, undefined, 'error');
```

### Tracer Instance Methods

Access the tracer directly for fine-grained control:

```typescript
// Record a tool call
tracing.tracer.recordToolCall('toolName', { arg: 'value' }, 'result', 100);

// Record an LLM call
tracing.tracer.recordLLMCall('gpt-4o-mini', 100, 50, 500);

// Manual node tracking
const nodeId = tracing.tracer.startNode('customNode', state);
// ... do work ...
await tracing.tracer.endNode(nodeId, output, 'success');
```

## Advanced Usage

### ReAct Agent with Tools

```typescript
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { TavilySearch } from '@langchain/tavily';

const tools = [new TavilySearch({ apiKey: 'your-key' })];
const modelWithTools = model.bindTools(tools);

const nodes = tracing.traceNodes({
  callModel: async (state) => {
    const response = await modelWithTools.invoke(state.messages);
    
    // Optional: Record LLM usage
    if (response.usage_metadata) {
      tracing.tracer.recordLLMCall(
        'gpt-4o-mini',
        response.usage_metadata.input_tokens,
        response.usage_metadata.output_tokens
      );
    }
    
    return { messages: [response] };
  },
  
  executeTools: async (state) => {
    const toolNode = new ToolNode(tools);
    const result = await toolNode.invoke(state);
    
    // Optional: Record tool calls
    const lastMessage = state.messages.at(-1);
    lastMessage?.tool_calls?.forEach((tc) => {
      tracing.tracer.recordToolCall(tc.name, tc.args);
    });
    
    return result;
  },
});

// Routing function
function shouldContinue(state) {
  const lastMessage = state.messages.at(-1);
  if (lastMessage?.tool_calls?.length) {
    return 'tools';
  }
  return '__end__';
}

const graph = new StateGraph(MessagesAnnotation)
  .addNode('callModel', nodes.callModel)
  .addNode('tools', nodes.executeTools)
  .addEdge(START, 'callModel')
  .addConditionalEdges('callModel', shouldContinue, {
    tools: 'tools',
    __end__: END,
  })
  .addEdge('tools', 'callModel')
  .compile();
```

### Streaming Support

```typescript
import { createTracedGraphStreamer } from '@cognipeer/cgate-sdk';

const tracedStream = createTracedGraphStreamer(tracing, 'StreamingAgent');

for await (const chunk of tracedStream(graph, { messages: [...] })) {
  // Process chunks
  console.log(chunk);
}
```

### Simple Workflow Example

```typescript
import { Annotation } from '@langchain/langgraph';

const WorkflowState = Annotation.Root({
  input: Annotation({ default: () => '' }),
  output: Annotation({ default: () => '' }),
  steps: Annotation({ default: () => [] }),
});

const nodes = tracing.traceNodes({
  step1: async (state) => ({
    steps: [...state.steps, 'step1'],
    output: `Processed: ${state.input}`,
  }),
  step2: async (state) => ({
    steps: [...state.steps, 'step2'],
    output: state.output.toUpperCase(),
  }),
  step3: async (state) => ({
    steps: [...state.steps, 'step3'],
    output: `Final: ${state.output}`,
  }),
});

const workflow = new StateGraph(WorkflowState)
  .addNode('step1', nodes.step1)
  .addNode('step2', nodes.step2)
  .addNode('step3', nodes.step3)
  .addEdge(START, 'step1')
  .addEdge('step1', 'step2')
  .addEdge('step2', 'step3')
  .addEdge('step3', END)
  .compile();

// Run
const graphId = tracing.startGraph('Workflow');
const result = await workflow.invoke({ input: 'Hello' });
await tracing.endGraph(graphId, result);
await tracing.end();
```

## Event Types

The tracer records the following event types:

| Type | Description |
|------|-------------|
| `chain_start` | Graph execution started |
| `chain_end` | Graph execution completed |
| `ai_call` | Node execution or LLM call |
| `tool_call` | Tool invocation |
| `error` | Error occurred |

## Session Structure

Each tracing session includes:

- **Session ID**: Unique identifier for the session
- **Agent**: Name, version, and model information
- **Events**: Sequence of traced events
- **Summary**: Aggregated metrics (duration, token usage, event counts)
- **Status**: Overall session status (success/error/running)

## Best Practices

1. **Always end sessions**: Call `tracing.end()` when done to ensure all events are flushed
2. **Use meaningful names**: Give descriptive names to graphs and nodes
3. **Handle errors**: Properly call `endGraph` with 'error' status on failures
4. **Control flushing**: For many operations, disable `autoFlush` and call `flush()` manually
5. **Debug mode**: Enable during development to see detailed logs
