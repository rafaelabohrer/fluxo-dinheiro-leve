import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";
import { useState } from "react";

interface AttachmentViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileUrl: string;
  fileName: string;
  fileType: string;
  onDownload: () => void;
}

const AttachmentViewer = ({ 
  open, 
  onOpenChange, 
  fileUrl, 
  fileName, 
  fileType,
  onDownload 
}: AttachmentViewerProps) => {
  const [loading, setLoading] = useState(true);

  const isImage = fileType.startsWith('image/');
  const isPDF = fileType === 'application/pdf' || fileName.endsWith('.pdf');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="truncate pr-4">{fileName}</DialogTitle>
            <Button
              variant="outline"
              size="icon"
              onClick={onDownload}
              className="flex-shrink-0"
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        
        <div className="px-6 pb-6 overflow-auto max-h-[calc(90vh-100px)]">
          {isImage ? (
            <div className="relative">
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted">
                  <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
                </div>
              )}
              <img
                src={fileUrl}
                alt={fileName}
                className="w-full h-auto rounded-lg"
                onLoad={() => setLoading(false)}
                onError={() => setLoading(false)}
              />
            </div>
          ) : isPDF ? (
            <div className="w-full h-[70vh] bg-muted rounded-lg overflow-hidden">
              <iframe
                src={fileUrl}
                className="w-full h-full"
                title={fileName}
                onLoad={() => setLoading(false)}
              />
              {loading && (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground mb-4">
                Pré-visualização não disponível para este tipo de arquivo.
              </p>
              <Button onClick={onDownload}>
                <Download className="h-4 w-4 mr-2" />
                Baixar Arquivo
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AttachmentViewer;
