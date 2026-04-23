import React from "react";
import { Layout, Menu } from "antd";
import {
  MessageOutlined,
  FileOutlined,
  SettingOutlined,
} from "@ant-design/icons";

const { Header } = Layout;

interface NavbarProps {
  current: string;
  onChange: (key: string) => void;
}

const Navbar: React.FC<NavbarProps> = ({ current, onChange }) => {
  const items = [
    { key: "chat", icon: <MessageOutlined />, label: "Chat" },
    { key: "documents", icon: <FileOutlined />, label: "Documents" },
    { key: "settings", icon: <SettingOutlined />, label: "Settings" },
  ];

  return (
    <Header style={{ display: "flex", alignItems: "center" }}>
      <div
        style={{
          color: "#fff",
          fontSize: 20,
          fontWeight: 700,
          marginRight: 40,
        }}
      >
        DocMind
      </div>
      <Menu
        theme="dark"
        mode="horizontal"
        selectedKeys={[current]}
        items={items}
        onClick={(e) => onChange(e.key)}
        style={{ flex: 1 }}
      />
    </Header>
  );
};

export default Navbar;
