import React, { useEffect, useState } from "react";
import { Form, Select, Slider, Button, Card, message } from "antd";
import { getModelSettings, updateModelSettings } from "../services/api";

const SettingsPage: React.FC = () => {
  const [form] = Form.useForm();
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      const data = await getModelSettings();
      setModels(data.available_models || []);
      form.setFieldsValue(data.current);
    };
    load();
  }, [form]);

  const handleSave = async () => {
    setLoading(true);
    const values = form.getFieldsValue();
    await updateModelSettings(values);
    message.success("Settings updated");
    setLoading(false);
  };

  return (
    <div style={{ padding: 40, maxWidth: 600, margin: "0 auto" }}>
      <Card title="Model Settings">
        <Form form={form} layout="vertical">
          <Form.Item label="Provider" name="provider">
            <Select>
              <Select.Option value="ollama">Ollama (Local)</Select.Option>
              <Select.Option value="openai">OpenAI</Select.Option>
              <Select.Option value="anthropic">Anthropic</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item label="Model" name="model">
            <Select>
              {models.map((m) => (
                <Select.Option key={m} value={m}>
                  {m}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item label="Temperature" name="temperature">
            <Slider min={0} max={1} step={0.1} />
          </Form.Item>

          <Form.Item label="Top-K Chunks" name="top_k">
            <Slider min={1} max={20} step={1} />
          </Form.Item>

          <Button type="primary" onClick={handleSave} loading={loading}>
            Save Settings
          </Button>
        </Form>
      </Card>
    </div>
  );
};

export default SettingsPage;
