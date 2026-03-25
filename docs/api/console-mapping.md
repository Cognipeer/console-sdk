# Console API Mapping

This page maps the SDK surface to the underlying Cognipeer Console client API.

Use it when you need to:

- review what an SDK method sends over HTTP,
- migrate from raw fetch calls to the SDK,
- confirm where platform docs live versus where SDK docs live.

## Mapping Table

| Capability | SDK method | Console endpoint | Console docs |
| --- | --- | --- | --- |
| Chat completions | `client.chat.completions.create()` | `POST /chat/completions` | [Chat Completions](https://cognipeer.github.io/cognipeer-console/api/chat-completions) |
| Embeddings | `client.embeddings.create()` | `POST /embeddings` | [Embeddings](https://cognipeer.github.io/cognipeer-console/api/embeddings) |
| List agents | `client.agents.list()` | `GET /agents` | [Agents](https://cognipeer.github.io/cognipeer-console/api/agents) |
| Get agent | `client.agents.get(agentKey)` | `GET /agents/:agentKey` | [Agents](https://cognipeer.github.io/cognipeer-console/api/agents) |
| Invoke agent | `client.agents.responses.create()` | `POST /responses` | [Agents](https://cognipeer.github.io/cognipeer-console/api/agents) |
| List vector providers | `client.vectors.providers.list()` | `GET /vector/providers` | [Vector](https://cognipeer.github.io/cognipeer-console/api/vector) |
| Create vector provider | `client.vectors.providers.create()` | `POST /vector/providers` | [Vector](https://cognipeer.github.io/cognipeer-console/api/vector) |
| List indexes | `client.vectors.indexes.list(providerKey)` | `GET /vector/providers/:providerKey/indexes` | [Vector](https://cognipeer.github.io/cognipeer-console/api/vector) |
| Create index | `client.vectors.indexes.create(providerKey, data)` | `POST /vector/providers/:providerKey/indexes` | [Vector](https://cognipeer.github.io/cognipeer-console/api/vector) |
| Get index | `client.vectors.indexes.get(providerKey, indexId)` | `GET /vector/providers/:providerKey/indexes/:externalId` | [Vector](https://cognipeer.github.io/cognipeer-console/api/vector) |
| Update index | `client.vectors.indexes.update(providerKey, indexId, data)` | `PATCH /vector/providers/:providerKey/indexes/:externalId` | [Vector](https://cognipeer.github.io/cognipeer-console/api/vector) |
| Delete index | `client.vectors.indexes.delete(providerKey, indexId)` | `DELETE /vector/providers/:providerKey/indexes/:externalId` | [Vector](https://cognipeer.github.io/cognipeer-console/api/vector) |
| Upsert vectors | `client.vectors.upsert(...)` or `client.vectors.indexes.upsert(...)` | `POST /vector/providers/:providerKey/indexes/:externalId/upsert` | [Vector](https://cognipeer.github.io/cognipeer-console/api/vector) |
| Query vectors | `client.vectors.query(...)` or `client.vectors.indexes.query(...)` | `POST /vector/providers/:providerKey/indexes/:externalId/query` | [Vector](https://cognipeer.github.io/cognipeer-console/api/vector) |
| Delete vectors | `client.vectors.delete(...)` or `client.vectors.indexes.deleteVectors(...)` | `DELETE /vector/providers/:providerKey/indexes/:externalId/vectors` | [Vector](https://cognipeer.github.io/cognipeer-console/api/vector) |
| List buckets | `client.files.buckets.list()` | `GET /files/buckets` | [Files](https://cognipeer.github.io/cognipeer-console/api/files) |
| Get bucket | `client.files.buckets.get(bucketKey)` | `GET /files/buckets/:bucketKey` | [Files](https://cognipeer.github.io/cognipeer-console/api/files) |
| List files | `client.files.list(bucketKey, query)` | `GET /files/buckets/:bucketKey/objects` | [Files](https://cognipeer.github.io/cognipeer-console/api/files) |
| Upload file | `client.files.upload(bucketKey, data)` | `POST /files/buckets/:bucketKey/objects` | [Files](https://cognipeer.github.io/cognipeer-console/api/files) |
| Get file metadata | `client.files.get(bucketKey, objectKey)` | `GET /files/buckets/:bucketKey/objects/:objectKey` | [Files](https://cognipeer.github.io/cognipeer-console/api/files) |
| Delete file | `client.files.delete(bucketKey, objectKey)` | `DELETE /files/buckets/:bucketKey/objects/:objectKey` | [Files](https://cognipeer.github.io/cognipeer-console/api/files) |
| List prompts | `client.prompts.list()` | `GET /prompts` | [Prompts](https://cognipeer.github.io/cognipeer-console/api/prompts) |
| Get prompt | `client.prompts.get(key, options)` | `GET /prompts/:key` | [Prompts](https://cognipeer.github.io/cognipeer-console/api/prompts) |
| Render prompt | `client.prompts.render(key, options)` | `POST /prompts/:key/render` | [Prompts](https://cognipeer.github.io/cognipeer-console/api/prompts) |
| List prompt versions | `client.prompts.listVersions(key)` | `GET /prompts/:key/versions` | [Prompts](https://cognipeer.github.io/cognipeer-console/api/prompts) |
| List prompt deployments | `client.prompts.getDeployments(key)` | `GET /prompts/:key/deployments` | [Prompts](https://cognipeer.github.io/cognipeer-console/api/prompts) |
| Run prompt deployment action | `client.prompts.deploy(key, options)` | `POST /prompts/:key/deployments` | [Prompts](https://cognipeer.github.io/cognipeer-console/api/prompts) |
| Compare prompt versions | `client.prompts.compare(key, fromVersionId, toVersionId)` | `GET /prompts/:key/compare` | [Prompts](https://cognipeer.github.io/cognipeer-console/api/prompts) |
| Evaluate guardrail | `client.guardrails.evaluate(data)` | `POST /guardrails/evaluate` | [Guardrails](https://cognipeer.github.io/cognipeer-console/api/guardrails) |
| Ingest tracing session | `client.tracing.ingest(data)` | `POST /tracing/sessions` | [Tracing](https://cognipeer.github.io/cognipeer-console/api/tracing) |
| List config groups | `client.config.listGroups()` | `GET /config/groups` | [Config](https://cognipeer.github.io/cognipeer-console/api/config) |
| Create config group | `client.config.createGroup(data)` | `POST /config/groups` | [Config](https://cognipeer.github.io/cognipeer-console/api/config) |
| Get config group | `client.config.getGroup(groupKey)` | `GET /config/groups/:groupKey` | [Config](https://cognipeer.github.io/cognipeer-console/api/config) |
| Resolve config items | `client.config.resolve(data)` | `POST /config/resolve` | [Config](https://cognipeer.github.io/cognipeer-console/api/config) |
| Audit config item | `client.config.auditLogs(key)` | `GET /config/items/:key/audit` | [Config](https://cognipeer.github.io/cognipeer-console/api/config) |
| List memory stores | `client.memory.stores.list()` | `GET /memory/stores` | [Memory](https://cognipeer.github.io/cognipeer-console/api/memory) |
| Add memory | `client.memory.add(storeKey, data)` | `POST /memory/stores/:storeKey/memories` | [Memory](https://cognipeer.github.io/cognipeer-console/api/memory) |
| Search memory | `client.memory.search(storeKey, data)` | `POST /memory/stores/:storeKey/search` | [Memory](https://cognipeer.github.io/cognipeer-console/api/memory) |
| Recall memory | `client.memory.recall(storeKey, data)` | `POST /memory/stores/:storeKey/recall` | [Memory](https://cognipeer.github.io/cognipeer-console/api/memory) |
| Ingest RAG content | `client.rag.ingest(moduleKey, data)` | `POST /rag/modules/:moduleKey/ingest` | [RAG](https://cognipeer.github.io/cognipeer-console/api/rag) |
| Query RAG module | `client.rag.query(moduleKey, data)` | `POST /rag/modules/:moduleKey/query` | [RAG](https://cognipeer.github.io/cognipeer-console/api/rag) |
| Delete RAG document | `client.rag.deleteDocument(moduleKey, documentId)` | `DELETE /rag/modules/:moduleKey/documents/:documentId` | [RAG](https://cognipeer.github.io/cognipeer-console/api/rag) |

## Ownership Rule

- Use the **Console docs** when you need platform semantics, deployment context, or raw endpoint behavior.
- Use the **SDK docs** when you need method signatures, request helpers, typed responses, or code examples.

## Related Reading

- [Working with Console](/guide/working-with-console)
- [Console API Overview](https://cognipeer.github.io/cognipeer-console/api/overview)
- [Cognipeer Console SDK Client](/api/client)