import { OpenAIEmbeddings } from "@langchain/openai";
import { PineconeStore } from "@langchain/pinecone";
import { ChatOpenAI } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";
import { getPineconeIndex } from "./pinecone";

export const embeddings = new OpenAIEmbeddings({
  apiKey: process.env.OPENAI_API_KEY!,
  modelName: "text-embedding-3-large",
});

export const llm = new ChatOpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
  modelName: "gpt-4o-mini",
  temperature: 0.2,
});

export const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
});

export async function ingestDocument(params: {
  text: string;
  metadata: Record<string, any>;
  userId: string;
}) {
  const { text, metadata, userId } = params;

  const docs = await textSplitter.createDocuments([text], [metadata]);

  const docsWithUser = docs.map(
    (doc) =>
      new Document({
        pageContent: doc.pageContent,
        metadata: { ...(doc.metadata as any), userId },
      })
  );

  const index = await getPineconeIndex();

  await PineconeStore.fromDocuments(docsWithUser, embeddings, {
    pineconeIndex: index,
    namespace: `user-${userId}`,
  });

  return { success: true, chunks: docsWithUser.length };
}

export async function queryRAG(params: { question: string; userId: string }) {
  const { question, userId } = params;

  const index = await getPineconeIndex();

  const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
    pineconeIndex: index,
    namespace: `user-${userId}`,
  });

  const relevantDocs = await vectorStore.similaritySearch(question, 4);

  if (relevantDocs.length === 0) {
    return { answer: "Bu konu hakkında bilgim yok.", sources: [] };
  }

  const context = relevantDocs.map((d) => d.pageContent).join("\n\n---\n\n");

  const prompt = `Aşağıdaki bilgileri kullanarak soruyu cevapla. Bilgi yoksa uydurma:

${context}

Soru: ${question}

Cevap:`;

  const res = await llm.invoke(prompt);

  return {
    answer: res.content,
    sources: relevantDocs.map((d) => d.metadata),
  };
}