const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8000";

export interface DocumentInfo {
  id: string;
  filename: string;
  chunk_count: number;
  upload_time: string;
}

export interface ChatMessage {
  role: "human" | "assistant";
  content: string;
  sources?: { filename: string; chunk_index: number }[];
}

export interface ModelSettings {
  provider: string;
  model: string;
  temperature: number;
  top_k: number;
}

export async function uploadDocument(file: File): Promise<DocumentInfo> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/api/documents/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getDocuments(): Promise<DocumentInfo[]> {
  const res = await fetch(`${API_BASE}/api/documents`);
  const data = await res.json();
  return data.documents;
}

export async function deleteDocument(id: string): Promise<void> {
  await fetch(`${API_BASE}/api/documents/${id}`, { method: "DELETE" });
}

export async function chatStream(
  question: string,
  history: ChatMessage[],
  onChunk: (text: string) => void,
  onSources: (sources: { filename: string; chunk_index: number }[]) => void,
  onDone: () => void
) {
  const res = await fetch(`${API_BASE}/api/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, history }),
  });

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);
        if (data === "[DONE]") {
          onDone();
          return;
        }
        const parsed = JSON.parse(data);
        if (parsed.type === "answer") {
          onChunk(parsed.content);
        } else if (parsed.type === "sources") {
          onSources(parsed.content);
        }
      }
    }
  }
  onDone();
}

export async function getModelSettings() {
  const res = await fetch(`${API_BASE}/api/settings/models`);
  return res.json();
}

export async function updateModelSettings(settings: ModelSettings) {
  const res = await fetch(`${API_BASE}/api/settings/models`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
  return res.json();
}
