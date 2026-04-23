import React, { useState } from "react";
import { Layout } from "antd";
import Navbar from "./components/Navbar";
import ChatPage from "./pages/ChatPage";
import DocumentsPage from "./pages/DocumentsPage";
import SettingsPage from "./pages/SettingsPage";

const { Content } = Layout;

const App: React.FC = () => {
  const [page, setPage] = useState("chat");

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Navbar current={page} onChange={setPage} />
      <Content>
        {page === "chat" && <ChatPage />}
        {page === "documents" && <DocumentsPage />}
        {page === "settings" && <SettingsPage />}
      </Content>
    </Layout>
  );
};

export default App;
