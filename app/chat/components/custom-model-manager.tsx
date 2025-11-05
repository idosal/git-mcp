import { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/chat/components/ui/dialog";
import { Button } from "~/chat/components/ui/button";
import { Input } from "~/chat/components/ui/input";
import { Label } from "~/chat/components/ui/label";
import { toast } from "sonner";
import { STORAGE_KEYS } from "~/chat/lib/constants";
import type { CustomModelConfig } from "../ai/providers.shared";
import { Trash2, Plus, Edit2 } from "lucide-react";
import { ScrollArea } from "~/chat/components/ui/scroll-area";

interface CustomModelManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CustomModelManager({
  open,
  onOpenChange,
}: CustomModelManagerProps) {
  const [models, setModels] = useState<CustomModelConfig[]>([]);
  const [editingModel, setEditingModel] = useState<CustomModelConfig | null>(
    null,
  );
  const [formData, setFormData] = useState<Omit<CustomModelConfig, "id">>({
    label: "",
    baseURL: "",
    apiKey: "",
    modelName: "",
    provider: "",
    description: "",
    capabilities: [],
  });

  // Load models from localStorage
  useEffect(() => {
    if (open) {
      try {
        const stored = localStorage.getItem(STORAGE_KEYS.CUSTOM_MODELS);
        setModels(stored ? JSON.parse(stored) : []);
      } catch (error) {
        console.error("Error loading custom models:", error);
        setModels([]);
      }
    }
  }, [open]);

  // Save models to localStorage
  const saveModels = useCallback((updatedModels: CustomModelConfig[]) => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.CUSTOM_MODELS,
        JSON.stringify(updatedModels),
      );
      setModels(updatedModels);
      // Dispatch custom event for same-window updates
      window.dispatchEvent(new CustomEvent("customModelsChanged"));
    } catch (error) {
      console.error("Error saving custom models:", error);
      toast.error("Failed to save custom models");
    }
  }, []);

  // Add or update model
  const handleSaveModel = useCallback(() => {
    if (
      !formData.label ||
      !formData.baseURL ||
      !formData.apiKey ||
      !formData.modelName
    ) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      let updatedModels: CustomModelConfig[];

      if (editingModel) {
        // Update existing model
        updatedModels = models.map((m) =>
          m.id === editingModel.id ? { ...formData, id: editingModel.id } : m,
        );
        toast.success("Model updated successfully");
      } else {
        // Add new model with more robust ID generation
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 9);
        const newModel: CustomModelConfig = {
          ...formData,
          id: `custom-${timestamp}-${random}`,
        };
        updatedModels = [...models, newModel];
        toast.success("Model added successfully");
      }

      saveModels(updatedModels);
      resetForm();
    } catch (error) {
      console.error("Error saving model:", error);
      toast.error("Failed to save model");
    }
  }, [formData, editingModel, models, saveModels]);

  // Delete model
  const handleDeleteModel = useCallback(
    (id: string) => {
      try {
        const updatedModels = models.filter((m) => m.id !== id);
        saveModels(updatedModels);
        toast.success("Model deleted successfully");
      } catch (error) {
        console.error("Error deleting model:", error);
        toast.error("Failed to delete model");
      }
    },
    [models, saveModels],
  );

  // Edit model
  const handleEditModel = useCallback((model: CustomModelConfig) => {
    setEditingModel(model);
    setFormData({
      label: model.label,
      baseURL: model.baseURL,
      apiKey: model.apiKey,
      modelName: model.modelName,
      provider: model.provider || "",
      description: model.description || "",
      capabilities: model.capabilities || [],
    });
  }, []);

  // Reset form
  const resetForm = useCallback(() => {
    setEditingModel(null);
    setFormData({
      label: "",
      baseURL: "",
      apiKey: "",
      modelName: "",
      provider: "",
      description: "",
      capabilities: [],
    });
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Custom Model Management</DialogTitle>
          <DialogDescription>
            Add and manage OpenAI-compatible custom models. Configure the API
            base URL, API key, and model name.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full pr-4">
            {/* Model Form */}
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="label">Label (Display Name) *</Label>
                <Input
                  id="label"
                  value={formData.label}
                  onChange={(e) =>
                    setFormData({ ...formData, label: e.target.value })
                  }
                  placeholder="My Custom Model"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="baseURL">API Base URL *</Label>
                <Input
                  id="baseURL"
                  value={formData.baseURL}
                  onChange={(e) =>
                    setFormData({ ...formData, baseURL: e.target.value })
                  }
                  placeholder="https://api.example.com/v1"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="apiKey">API Key *</Label>
                <Input
                  id="apiKey"
                  type="password"
                  value={formData.apiKey}
                  onChange={(e) =>
                    setFormData({ ...formData, apiKey: e.target.value })
                  }
                  placeholder="sk-..."
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="modelName">Model Name *</Label>
                <Input
                  id="modelName"
                  value={formData.modelName}
                  onChange={(e) =>
                    setFormData({ ...formData, modelName: e.target.value })
                  }
                  placeholder="gpt-4-turbo"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="provider">Provider (Optional)</Label>
                <Input
                  id="provider"
                  value={formData.provider}
                  onChange={(e) =>
                    setFormData({ ...formData, provider: e.target.value })
                  }
                  placeholder="OpenAI, Together AI, etc."
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Description of this model"
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSaveModel} className="flex-1">
                  {editingModel ? (
                    <>
                      <Edit2 className="h-4 w-4 mr-2" />
                      Update Model
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Model
                    </>
                  )}
                </Button>
                {editingModel && (
                  <Button variant="outline" onClick={resetForm}>
                    Cancel Edit
                  </Button>
                )}
              </div>
            </div>

            {/* Models List */}
            {models.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold mb-3">
                  Configured Models
                </h3>
                <div className="space-y-2">
                  {models.map((model) => (
                    <div
                      key={model.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="font-medium">{model.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {model.modelName} • {model.provider || "Custom"}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditModel(model)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteModel(model.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
