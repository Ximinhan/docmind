import React from "react";
import { Tag } from "antd";
import { RobotOutlined, UserOutlined } from "@ant-design/icons";

interface ChatMessageProps {
  role: "human" | "assistant";
  content: string;
  sources?: { filename: string; chunk_index: number }[];
  streaming?: boolean;
}

const ChatMessage: React.FC<ChatMessageProps> = ({
  role,
  content,
  sources,
  streaming,
}) => {
  const isUser = role === "human";

  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        padding: "12px 0",
        flexDirection: isUser ? "row-reverse" : "row",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: isUser ? "#1677ff" : "#52c41a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          flexShrink: 0,
        }}
      >
        {isUser ? <UserOutlined /> : <RobotOutlined />}
      </div>
      <div
        style={{
          maxWidth: "70%",
          background: isUser ? "#1677ff" : "#f0f0f0",
          color: isUser ? "#fff" : "#000",
          padding: "10px 16px",
          borderRadius: 12,
          whiteSpace: "pre-wrap",
        }}
      >
        {content}
        {streaming && <span className="cursor-blink">|</span>}
        {sources && sources.length > 0 && (
          <div style={{ marginTop: 8 }}>
            {sources.map((s, i) => (
              <Tag key={i} color="blue">
                {s.filename} #{s.chunk_index}
              </Tag>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;
