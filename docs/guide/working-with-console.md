# Working With Cognipeer Console

The SDK is not a replacement for Cognipeer Console. It is the developer-facing client for applications that call a Console deployment.

## Use Console For

- deployment and hosting,
- tenant isolation and access control,
- API token issuance,
- providers, models, vector stores, files, prompts, agents, and guardrails,
- tracing dashboards, incidents, and operational workflows.

See the [Cognipeer Console docs](https://cognipeer.github.io/cognipeer-console/) for those topics.

## Use The SDK For

- initializing a client in TypeScript or JavaScript,
- making authenticated calls from apps and services,
- using typed request and response models,
- integrating with frameworks and runtimes,
- replacing ad-hoc fetch calls with a stable client layer.

## Typical Team Workflow

1. A platform team deploys and configures Cognipeer Console.
2. Providers, policies, and runtime features are configured in the dashboard.
3. An API token is created for the consuming application.
4. The application team installs `@cognipeer/console-sdk`.
5. The SDK is pointed at the Console client API base URL.
6. Application traffic is observed back in Console through tracing, alerts, and operational dashboards.

## Base URL For Self-Hosted Console

When you connect to a self-hosted deployment, use the full client API base URL:

```text
https://your-console.example.com/api/client/v1
```

The SDK targets the Console client API surface, not the dashboard root.

## Canonical Ownership

| Topic | Canonical docs |
| --- | --- |
| Deployment, providers, tenancy, platform behavior | [Cognipeer Console docs](https://cognipeer.github.io/cognipeer-console/) |
| Raw endpoint semantics and HTTP payloads | [Cognipeer Console API reference](https://cognipeer.github.io/cognipeer-console/api/overview) |
| TypeScript and JavaScript method signatures | Console SDK docs |
| Examples and framework integrations | Console SDK docs |

## Related Reading

- [Getting Started](/guide/getting-started)
- [Console API Mapping](/api/console-mapping)
- [Console Authentication Guide](https://cognipeer.github.io/cognipeer-console/guide/authentication)
- [Console API Overview](https://cognipeer.github.io/cognipeer-console/api/overview)