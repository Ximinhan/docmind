import React, { useState, useRef, useEffect } from "react";
import { Input, Button, Space, Empty } from "antd";
import { SendOutlined } from "@ant-design/icons";
import ChatMessageComponent from "../components/ChatMessage";
import { chatStream, ChatMessage } from "../services/api";

const ChatPage: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const question = input.trim();
    if (!question || loading) return;

    setInput("");
    const userMsg: ChatMessage = { role: "human", content: question };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    const assistantMsg: ChatMessage = {
      role: "assistant",
      content: "",
      sources: [],
    };
    setMessages((prev) => [...prev, assistantMsg]);

    await chatStream(
      question,
      messages,
      (text) => {
        assistantMsg.content += text;
        setMessages((prev) => [...prev.slice(0, -1), { ...assistantMsg }]);
      },
      (sources) => {
        assistantMsg.sources = sources;
        setMessages((prev) => [...prev.slice(0, -1), { ...assistantMsg }]);
      },
      () => {
        setLoading(false);
      }
    );
  };

  return (
    <div
      style={{
        height: "calc(100vh - 64px)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ flex: 1, overflow: "auto", padding: "20px 40px" }}>
        {messages.length === 0 && (
          <Empty
            description="Upload documents and start asking questions"
            style={{ marginTop: 100 }}
          />
        )}
        {messages.map((msg, i) => (
          <ChatMessageComponent
            key={i}
            role={msg.role}
            content={msg.content}
            sources={msg.sources}
            streaming={loading && i === messages.length - 1 && msg.role === "assistant"}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      <div style={{ padding: "16px 40px", borderTop: "1px solid #f0f0f0" }}>
        <Space.Compact style={{ width: "100%" }}>
          <Input
            size="large"
            placeholder="Ask a question about your documents..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPressEnter={handleSend}
            disabled={loading}
          />
          <Button
            type="primary"
            size="large"
            icon={<SendOutlined />}
            onClick={handleSend}
            loading={loading}
          >
            Send
          </Button>
        </Space.Compact>
      </div>
    </div>
  );
};

export default ChatPage;
