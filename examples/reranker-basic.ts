import { ConsoleClient } from '@cognipeer/console-sdk';

async function main() {
  const apiKey = process.env.COGNIPEER_API_KEY;
  if (!apiKey) throw new Error('COGNIPEER_API_KEY is required');

  const client = new ConsoleClient({
    apiKey,
    ...(process.env.COGNIPEER_BASE_URL ? { baseURL: process.env.COGNIPEER_BASE_URL } : {}),
  });

  const rerankerKey = process.env.COGNIPEER_RERANKER_KEY;
  if (!rerankerKey) {
    const all = await client.rerankers.list();
    console.log('Available rerankers:', all.map((r) => r.key));
    throw new Error('Set COGNIPEER_RERANKER_KEY to one of the rerankers above.');
  }

  const result = await client.rerankers.run(rerankerKey, {
    query: 'best espresso machine for beginners',
    documents: [
      'Breville Bambino Plus — compact and forgiving.',
      'La Marzocco Linea Mini — top-tier prosumer espresso.',
      { id: 'doc-3', text: 'Gaggia Classic Pro — modder friendly entry point.' },
      'Random unrelated text about cats.',
    ],
    top_n: 3,
  });

  console.log('Reranked:');
  for (const r of result.results) {
    console.log(`  ${r.relevance_score.toFixed(4)}  ${r.document.text}`);
  }
  console.log('Meta:', result.meta);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
