import { DataAPIClient, Collection } from "@datastax/astra-db-ts";

let _collection: Collection | null = null;

function getCollection(): Collection {
  if (_collection) return _collection;

  const token = process.env.ASTRA_DB_APPLICATION_TOKEN;
  const endpoint = process.env.ASTRA_DB_API_ENDPOINT;
  const collectionName = process.env.ASTRA_DB_COLLECTION;

  if (!token) throw new Error("ASTRA_DB_APPLICATION_TOKEN is not set");
  if (!endpoint) throw new Error("ASTRA_DB_API_ENDPOINT is not set");
  if (!collectionName) throw new Error("ASTRA_DB_COLLECTION is not set");

  const client = new DataAPIClient(token);
  const db = client.db(endpoint);
  _collection = db.collection(collectionName);
  return _collection;
}

export interface DocumentChunk {
  filename: string;
  mimeType: string;
  uploadedAt: string;
  chunkIndex: number;
  totalChunks: number;
  content: string;
}

const CHUNK_SIZE = 6000;

export async function saveDocuments(
  filename: string,
  mimeType: string,
  text: string
): Promise<void> {
  const uploadedAt = new Date().toISOString();
  const chunks: DocumentChunk[] = [];

  for (let i = 0; i < text.length; i += CHUNK_SIZE) {
    chunks.push({
      filename,
      mimeType,
      uploadedAt,
      chunkIndex: Math.floor(i / CHUNK_SIZE),
      totalChunks: Math.ceil(text.length / CHUNK_SIZE),
      content: text.slice(i, i + CHUNK_SIZE)
    });
  }

  if (chunks.length === 0) return;
  const collection = getCollection();
  await collection.insertMany(chunks);
}
