import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Upload, FileCheck, Loader2, X, FileText, Camera, RotateCcw, Check } from "lucide-react";
import { useUpload } from "@/hooks/use-upload";
import { useTranslation } from "react-i18next";
import { getDocumentUrl, parseStoredDocumentReference } from "@/lib/document-utils";

interface DocumentMetadata {
  path: string;
  name: string;
}

export function parseDocumentValue(value: string): DocumentMetadata | null {
  const p = parseStoredDocumentReference(value);
  if (!p) return null;
  return { path: getDocumentUrl(p.storagePath) ?? p.storagePath, name: p.displayName };
}

interface DocumentUploadWithCameraProps {
  value: string;
  onChange: (value: string) => void;
  onFile?: (file: File) => void;
  placeholder?: string;
  disabled?: boolean;
  testId?: string;
  documentType?: string;
  preferCamera?: boolean;
}

export function DocumentUploadWithCamera({
  value,
  onChange,
  onFile,
  placeholder,
  disabled = false,
  testId,
  documentType = "document",
  preferCamera = false,
}: DocumentUploadWithCameraProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pendingFileName, setPendingFileName] = useState<string>("");
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");

  const { uploadFile, isUploading, error } = useUpload({
    onSuccess: (response) => {
      const metadata: DocumentMetadata & { size?: number } = {
        path: response.objectPath,
        name: pendingFileName,
        size: response.metadata.size,
      };
      onChange(JSON.stringify(metadata));
      setCapturedImage(null);
    },
    onError: (err) => {
      console.error("Upload error:", err);
      setPendingFileName("");
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPendingFileName(file.name);
      onFile?.(file);
      await uploadFile(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClear = () => {
    onChange("");
    setPendingFileName("");
  };

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      setIsCameraOpen(true);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch(console.error);
        }
      }, 100);
    } catch (err) {
      console.error("Camera access error:", err);
      if (err instanceof Error) {
        if (err.name === "NotAllowedError") {
          setCameraError(t("onboarding.cameraPermissionDenied", "Camera permission denied. Please allow camera access in your browser settings."));
        } else if (err.name === "NotFoundError") {
          setCameraError(t("onboarding.cameraNotFound", "No camera found on this device."));
        } else {
          setCameraError(t("onboarding.cameraError", "Could not access camera. Please try again."));
        }
      }
    }
  }, [facingMode, t]);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setIsCameraOpen(false);
    setCapturedImage(null);
    setCameraError(null);
  }, [stream]);

  const switchCamera = useCallback(async () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    const newFacingMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(newFacingMode);

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: newFacingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play().catch(console.error);
      }
    } catch (err) {
      console.error("Camera switch error:", err);
    }
  }, [stream, facingMode]);

  const capturePhoto = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
        setCapturedImage(dataUrl);
      }
    }
  }, []);

  const retakePhoto = useCallback(() => {
    setCapturedImage(null);
  }, []);

  const uploadCapturedPhoto = useCallback(async () => {
    if (!capturedImage) return;

    const response = await fetch(capturedImage);
    const blob = await response.blob();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `${documentType}_${timestamp}.jpg`;
    const file = new File([blob], fileName, { type: "image/jpeg" });

    setPendingFileName(fileName);
    onFile?.(file);
    stopCamera();
    await uploadFile(file);
  }, [capturedImage, documentType, onFile, stopCamera, uploadFile]);

  const hasUploadedFile = !!value;
  const parsedDoc = parseDocumentValue(value);
  const displayName = parsedDoc?.name || t("onboarding.uploadedDocument", "Uploaded Document");

  return (
    <div className="space-y-2">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        {hasUploadedFile ? (
          <div className="flex items-center gap-2 flex-1 px-3 py-2 border rounded-md bg-muted/30">
            <FileCheck className="h-4 w-4 text-green-600 flex-shrink-0" />
            <span className="text-sm truncate flex-1" title={displayName}>
              {displayName}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 flex-shrink-0"
              onClick={handleClear}
              disabled={disabled || isUploading}
              data-testid={testId ? `${testId}-clear` : undefined}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-1 px-3 py-2 border rounded-md text-muted-foreground">
            <FileText className="h-4 w-4 flex-shrink-0" />
            <span className="text-sm truncate">
              {placeholder || t("onboarding.noFileSelected", "No file selected")}
            </span>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,image/heic,image/heif,application/pdf"
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled || isUploading}
          data-testid={testId ? `${testId}-input` : undefined}
        />
        <div className="flex gap-2 sm:flex-none">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="flex-1 sm:flex-none"
            onClick={startCamera}
            disabled={disabled || isUploading}
            title={t("onboarding.captureWithCamera", "Capture with camera")}
            data-testid={testId ? `${testId}-camera` : undefined}
          >
            <Camera className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="flex-1 sm:flex-none"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isUploading}
            title={t("onboarding.uploadFile", "Upload file")}
            data-testid={testId ? `${testId}-button` : undefined}
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
      {(error || cameraError) && (
        <p className="text-sm text-destructive">{cameraError || error?.message}</p>
      )}

      <Dialog open={isCameraOpen} onOpenChange={(open) => !open && stopCamera()}>
        <DialogContent className="w-[95vw] max-w-lg p-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Camera className="h-4 w-4 shrink-0" />
              {t("onboarding.captureDocument", "Capture Document")}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {t("onboarding.cameraTip", "Position the document within the frame and ensure good lighting")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="relative aspect-[4/3] bg-black rounded-lg overflow-hidden w-full">
              {capturedImage ? (
                <img
                  src={capturedImage}
                  alt="Captured"
                  className="w-full h-full object-contain"
                />
              ) : (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-contain"
                />
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>

            <div className="flex justify-center gap-2">
              {capturedImage ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={retakePhoto}
                    disabled={isUploading}
                    className="flex-1"
                    data-testid="camera-retake"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    {t("onboarding.retake", "Retake")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={uploadCapturedPhoto}
                    disabled={isUploading}
                    className="flex-1"
                    data-testid="camera-confirm"
                  >
                    {isUploading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4 mr-2" />
                    )}
                    {t("onboarding.usePhoto", "Use Photo")}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={switchCamera}
                    className="flex-1"
                    data-testid="camera-switch"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    {t("onboarding.switchCamera", "Switch Camera")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={capturePhoto}
                    className="flex-1"
                    data-testid="camera-capture"
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    {t("onboarding.capture", "Capture")}
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
