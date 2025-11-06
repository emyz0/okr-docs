import { Pinecone } from "@pinecone-database/pinecone";

/**
 * Pinecone client Singleton - bir kere oluştur, her yerde kullan.
 */
let pineconeClient: Pinecone | null = null;

export async function getPineconeClient() {
  if (pineconeClient) {
    return pineconeClient;
  }

  pineconeClient = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!,
  });

  return pineconeClient;
}

/**
 * Index'i getir
 */
export async function getPineconeIndex() {
  const client = await getPineconeClient();
  const indexName = process.env.PINECONE_INDEX_NAME || "okr-docs";
  return client.index(indexName);
}