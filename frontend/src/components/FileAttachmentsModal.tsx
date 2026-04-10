import { useEffect, useMemo, useState } from "react";
import { Trash2, Upload, FileText, Image as ImageIcon } from "lucide-react";
import type { ApiEntityType, ApiUserFile } from "../types/api";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";

type Props = {
  entityType: ApiEntityType;
  entityId: number;
  onClose: () => void;
};

export function FileAttachmentsModal({ entityType, entityId, onClose }: Props) {
  const { user } = useAuth();
  const canRead = useMemo(() => user?.permissions?.includes("files:read") ?? false, [user]);
  const canWrite = useMemo(() => user?.permissions?.includes("files:write") ?? false, [user]);

  const [files, setFiles] = useState<ApiUserFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const loadFiles = async () => {
    if (!canRead) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await api.listFiles({ entity_type: entityType, entity_id: entityId });
      setFiles(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить файлы");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, entityId, canRead]);

  const formatBytes = (bytes: number) => {
    const kb = bytes / 1024;
    if (kb < 1024) return `${Math.round(kb)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  const onUpload = async () => {
    if (!selectedFile) return;
    if (!canWrite) {
      setError("Недостаточно прав для загрузки файлов");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      await api.uploadEntityFile({
        file: selectedFile,
        entity_type: entityType,
        entity_id: entityId,
      });
      setSelectedFile(null);
      await loadFiles();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки файла");
    } finally {
      setUploading(false);
    }
  };

  const onDelete = async (fileId: number) => {
    if (!canWrite) return;
    if (!window.confirm("Удалить файл?")) return;
    setError(null);
    try {
      await api.deleteFile(fileId);
      await loadFiles();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось удалить файл");
    }
  };

  const emptyText = canRead
    ? "Файлов пока нет"
    : "Нет прав на просмотр файлов";

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-3xl p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-1">
              Вложения для {entityType === "athlete" ? "спортсмена" : "мед. записи"}
            </h3>
            <p className="text-sm text-gray-600">Связанные файлы (S3/объектное хранилище)</p>
          </div>
          <button
            className="absolute top-3 right-3 p-2 hover:bg-gray-100 rounded-lg transition-colors"
            onClick={onClose}
            title="Закрыть"
          >
            <span className="text-gray-500 text-xl">×</span>
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="mb-4">
          <div className="flex items-center gap-3">
            <input
              type="file"
              disabled={!canWrite || uploading}
              className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-60"
              onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
            />
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60 inline-flex items-center gap-2"
              disabled={!canWrite || uploading || !selectedFile}
              onClick={() => void onUpload()}
            >
              <Upload className="w-4 h-4" />
              {uploading ? "Загрузка..." : "Загрузить"}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Разрешены: `pdf`, `png/jpg/jpeg`, `docx`, `txt`. Максимум: 10MB.
          </p>
        </div>

        <div className="border-t border-gray-200 pt-4">
          {loading ? (
            <div className="text-gray-600">Загрузка файлов...</div>
          ) : files.length === 0 ? (
            <div className="text-center py-10 text-gray-600">
              <FileText className="w-8 h-8 mx-auto mb-3 text-gray-400" />
              <div>{emptyText}</div>
            </div>
          ) : (
            <div className="space-y-3">
              {files.map((f) => {
                const isImage = (f.content_type ?? "").startsWith("image/");
                return (
                  <div key={f.id} className="flex items-start justify-between gap-4 rounded-lg border border-gray-200 p-3">
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 truncate">{f.original_name}</div>
                      <div className="text-sm text-gray-600 mt-1">
                        {f.content_type ? f.content_type : "unknown"} · {formatBytes(f.size_bytes)}
                      </div>
                      {isImage && f.download_url && (
                        <div className="mt-3">
                          <img
                            src={f.download_url}
                            alt={f.original_name}
                            loading="lazy"
                            className="max-h-48 rounded-lg border border-gray-200 object-contain"
                          />
                        </div>
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        <a
                          className="text-blue-600 hover:underline text-sm inline-flex items-center gap-1"
                          href={f.download_url ?? "#"}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => {
                            if (!f.download_url) e.preventDefault();
                          }}
                        >
                          {isImage ? <ImageIcon className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                          Открыть/скачать
                        </a>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {canWrite && (
                        <button
                          onClick={() => void onDelete(f.id)}
                          className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                          title="Удалить файл"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
