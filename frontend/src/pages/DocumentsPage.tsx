import React, { useEffect, useState } from "react";
import { Table, Button, Popconfirm, message } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import FileUploader from "../components/FileUploader";
import { getDocuments, deleteDocument, DocumentInfo } from "../services/api";

const DocumentsPage: React.FC = () => {
  const [docs, setDocs] = useState<DocumentInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchDocs = async () => {
    setLoading(true);
    const data = await getDocuments();
    setDocs(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  const handleDelete = async (id: string) => {
    await deleteDocument(id);
    message.success("Document deleted");
    fetchDocs();
  };

  const columns = [
    { title: "Filename", dataIndex: "filename", key: "filename" },
    { title: "Chunks", dataIndex: "chunk_count", key: "chunk_count" },
    {
      title: "Upload Time",
      dataIndex: "upload_time",
      key: "upload_time",
      render: (t: string) => new Date(t).toLocaleString(),
    },
    {
      title: "Action",
      key: "action",
      render: (_: any, record: DocumentInfo) => (
        <Popconfirm
          title="Delete this document?"
          onConfirm={() => handleDelete(record.id)}
        >
          <Button danger icon={<DeleteOutlined />} size="small">
            Delete
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div style={{ padding: 40, maxWidth: 900, margin: "0 auto" }}>
      <FileUploader onUploadSuccess={fetchDocs} />
      <Table
        columns={columns}
        dataSource={docs}
        rowKey="id"
        loading={loading}
        style={{ marginTop: 24 }}
        pagination={false}
      />
    </div>
  );
};

export default DocumentsPage;
