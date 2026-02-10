import { useEffect } from 'react';
import { useFileBrowserStore } from '@/stores/fileBrowserStore';
import FileBrowserPanel from './FileBrowserPanel';
import FileViewerPanel from './FileViewerPanel';

export default function FileSidebar() {
  const visible = useFileBrowserStore((s) => s.visible);

  useEffect(() => {
    if (visible) {
      useFileBrowserStore.getState().requestInitialData();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="file-sidebar">
      <FileBrowserPanel />
      <FileViewerPanel />
    </div>
  );
}
