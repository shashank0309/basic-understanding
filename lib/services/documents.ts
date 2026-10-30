import { db } from "../db";
import { str } from "../json";
import { chunk } from "../seed/documents";
import { embed } from "../similarity/embeddings";

/** Splits a process document into chunks and stores their embeddings (RAG index). */
export async function indexDocument(docId: string, title: string, content: string) {
  await db.docChunk.deleteMany({ where: { docId } });
  const parts = chunk(content);
  for (const [idx, text] of parts.entries()) {
    await db.docChunk.create({ data: { docId, idx, text, embedding: str(embed(`${title}. ${text}`)) } });
  }
  return parts.length;
}
