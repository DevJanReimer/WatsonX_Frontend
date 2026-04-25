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

export interface DocumentRecord {
  filename: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
  content: string; // base64-encoded file bytes
  watsonxDocumentId: string | null;
}

export async function saveDocuments(records: DocumentRecord[]): Promise<void> {
  if (records.length === 0) return;
  const collection = getCollection();
  await collection.insertMany(records);
}
