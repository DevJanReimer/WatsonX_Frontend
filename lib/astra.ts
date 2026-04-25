import { DataAPIClient } from "@datastax/astra-db-ts";

function getCollection() {
  const token = process.env.ASTRA_DB_APPLICATION_TOKEN;
  const endpoint = process.env.ASTRA_DB_API_ENDPOINT;
  const collectionName = process.env.ASTRA_DB_COLLECTION;

  if (!token) throw new Error("ASTRA_DB_APPLICATION_TOKEN is not set");
  if (!endpoint) throw new Error("ASTRA_DB_API_ENDPOINT is not set");
  if (!collectionName) throw new Error("ASTRA_DB_COLLECTION is not set");

  const client = new DataAPIClient(token);
  const db = client.db(endpoint);
  return db.collection(collectionName);
}

export interface DocumentRecord {
  filename: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
  watsonxDocumentId: string | null;
}

export async function saveDocument(record: DocumentRecord): Promise<void> {
  const collection = getCollection();
  await collection.insertOne(record);
}
