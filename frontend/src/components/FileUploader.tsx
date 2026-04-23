import React from "react";
import { Upload, message } from "antd";
import { InboxOutlined } from "@ant-design/icons";
import { uploadDocument } from "../services/api";

const { Dragger } = Upload;

interface FileUploaderProps {
  onUploadSuccess: () => void;
}

const FileUploader: React.FC<FileUploaderProps> = ({ onUploadSuccess }) => {
  const handleUpload = async (options: any) => {
    const { file, onSuccess, onError } = options;
    try {
      await uploadDocument(file);
      onSuccess(null, file);
      message.success(`${file.name} uploaded successfully`);
      onUploadSuccess();
    } catch (err: any) {
      onError(err);
      message.error(`${file.name} upload failed: ${err.message}`);
    }
  };

  return (
    <Dragger
      customRequest={handleUpload}
      multiple
      accept=".pdf,.docx,.md,.txt"
      showUploadList={false}
    >
      <p className="ant-upload-drag-icon">
        <InboxOutlined />
      </p>
      <p className="ant-upload-text">Click or drag files to upload</p>
      <p className="ant-upload-hint">
        Supports PDF, Word, Markdown, TXT
      </p>
    </Dragger>
  );
};

export default FileUploader;
