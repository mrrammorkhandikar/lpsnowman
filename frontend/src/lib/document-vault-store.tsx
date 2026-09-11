import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { useMockData } from "./mock-data-store";

export type DocumentCategory = 
  | "pod" 
  | "bol" 
  | "invoice" 
  | "insurance" 
  | "rc" 
  | "fitness" 
  | "license" 
  | "lr" 
  | "eway_bill" 
  | "weight_slip" 
  | "photos" 
  | "verification"
  | "receipts"
  | "other";

export type DocumentStatus = "active" | "expiring_soon" | "expired";

export interface VaultDocument {
  documentId: string;
  fileName: string;
  fileSize: number;
  fileType: "pdf" | "image";
  fileUrl: string;
  category: DocumentCategory;
  loadId?: string;
  shipmentId?: string;
  uploadedBy: string;
  uploadedDate: Date;
  expiryDate?: Date;
  status: DocumentStatus;
  notes?: string;
  tags: string[];
  version: number;
  isVerified: boolean;
  previousVersions?: { version: number; uploadedDate: Date; fileName: string }[];
}

export interface DocumentTemplate {
  id: DocumentCategory;
  name: string;
  description: string;
  hasExpiry: boolean;
  defaultExpiryMonths?: number;
  requiredFields: string[];
  suggestedTags: string[];
}

export const documentCategoryLabels: Record<DocumentCategory, string> = {
  pod: "Proof of Delivery",
  bol: "Bill of Lading",
  invoice: "Invoice",
  insurance: "Insurance",
  rc: "Registration Certificate",
  fitness: "Fitness Certificate",
  license: "License",
  lr: "LR / Consignment Note",
  eway_bill: "E-way Bill",
  weight_slip: "Weight Slip",
  photos: "Photos",
  verification: "Verification Documents",
  receipts: "Trip Receipts",
  other: "Other",
};

export const documentTemplates: DocumentTemplate[] = [
  {
    id: "pod",
    name: "Proof of Delivery",
    description: "Document confirming successful delivery of goods",
    hasExpiry: false,
    requiredFields: ["loadId"],
    suggestedTags: ["delivery", "signature", "confirmation"],
  },
  {
    id: "bol",
    name: "Bill of Lading",
    description: "Legal document between shipper and carrier",
    hasExpiry: false,
    requiredFields: ["loadId"],
    suggestedTags: ["shipping", "contract", "cargo"],
  },
  {
    id: "invoice",
    name: "Invoice",
    description: "Billing document for freight charges",
    hasExpiry: false,
    requiredFields: [],
    suggestedTags: ["billing", "payment", "freight"],
  },
  {
    id: "insurance",
    name: "Insurance Certificate",
    description: "Cargo or vehicle insurance documentation",
    hasExpiry: true,
    defaultExpiryMonths: 12,
    requiredFields: [],
    suggestedTags: ["coverage", "policy", "liability"],
  },
  {
    id: "rc",
    name: "Registration Certificate",
    description: "Vehicle registration document",
    hasExpiry: true,
    defaultExpiryMonths: 60,
    requiredFields: [],
    suggestedTags: ["vehicle", "registration", "RTO"],
  },
  {
    id: "fitness",
    name: "Fitness Certificate",
    description: "Vehicle fitness certification",
    hasExpiry: true,
    defaultExpiryMonths: 12,
    requiredFields: [],
    suggestedTags: ["vehicle", "fitness", "inspection"],
  },
  {
    id: "license",
    name: "Driver License",
    description: "Driver's commercial license",
    hasExpiry: true,
    defaultExpiryMonths: 24,
    requiredFields: [],
    suggestedTags: ["driver", "license", "commercial"],
  },
  {
    id: "lr",
    name: "LR / Consignment Note",
    description: "Lorry receipt or consignment documentation",
    hasExpiry: false,
    requiredFields: ["loadId"],
    suggestedTags: ["consignment", "receipt", "transport"],
  },
  {
    id: "eway_bill",
    name: "E-way Bill",
    description: "Electronic waybill for goods movement",
    hasExpiry: true,
    defaultExpiryMonths: 0,
    requiredFields: ["loadId"],
    suggestedTags: ["GST", "transport", "compliance"],
  },
  {
    id: "weight_slip",
    name: "Weight Slip",
    description: "Official weight measurement document",
    hasExpiry: false,
    requiredFields: ["loadId"],
    suggestedTags: ["weight", "measurement", "cargo"],
  },
  {
    id: "photos",
    name: "Photos",
    description: "Loading, unloading, or inspection photos",
    hasExpiry: false,
    requiredFields: [],
    suggestedTags: ["photos", "inspection", "condition"],
  },
  {
    id: "receipts",
    name: "Trip Receipts",
    description: "Fuel, toll, maintenance, and other trip receipts",
    hasExpiry: false,
    requiredFields: ["loadId"],
    suggestedTags: ["receipt", "fuel", "toll"],
  },
  {
    id: "other",
    name: "Other Document",
    description: "Miscellaneous documents",
    hasExpiry: false,
    requiredFields: [],
    suggestedTags: [],
  },
];

function generateId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}

function calculateStatus(expiryDate?: Date): DocumentStatus {
  if (!expiryDate) return "active";
  const now = new Date();
  const daysUntilExpiry = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (daysUntilExpiry < 0) return "expired";
  if (daysUntilExpiry <= 30) return "expiring_soon";
  return "active";
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

const initialDocuments: VaultDocument[] = [
  {
    documentId: "DOC-001",
    fileName: "POD_Load_LD-001.pdf",
    fileSize: 245000,
    fileType: "pdf",
    fileUrl: "/mock/pod.pdf",
    category: "pod",
    loadId: "LD-001",
    uploadedBy: "System",
    uploadedDate: daysAgo(2),
    status: "active",
    notes: "Signed by receiver",
    tags: ["delivery", "signed"],
    version: 1,
    isVerified: true,
  },
  {
    documentId: "DOC-002",
    fileName: "Invoice_March_2024.pdf",
    fileSize: 128000,
    fileType: "pdf",
    fileUrl: "/mock/invoice.pdf",
    category: "invoice",
    uploadedBy: "Finance Team",
    uploadedDate: daysAgo(5),
    status: "active",
    notes: "Monthly freight charges",
    tags: ["billing", "march"],
    version: 1,
    isVerified: true,
  },
  {
    documentId: "DOC-003",
    fileName: "Cargo_Insurance_2024.pdf",
    fileSize: 512000,
    fileType: "pdf",
    fileUrl: "/mock/insurance.pdf",
    category: "insurance",
    uploadedBy: "Admin",
    uploadedDate: daysAgo(180),
    expiryDate: daysFromNow(15),
    status: "expiring_soon",
    notes: "Annual cargo insurance policy",
    tags: ["coverage", "annual"],
    version: 2,
    isVerified: true,
    previousVersions: [
      { version: 1, uploadedDate: daysAgo(365), fileName: "Cargo_Insurance_2023.pdf" },
    ],
  },
  {
    documentId: "DOC-004",
    fileName: "BOL_Load_LD-002.pdf",
    fileSize: 198000,
    fileType: "pdf",
    fileUrl: "/mock/bol.pdf",
    category: "bol",
    loadId: "LD-002",
    uploadedBy: "Carrier",
    uploadedDate: daysAgo(1),
    status: "active",
    tags: ["shipping", "contract"],
    version: 1,
    isVerified: false,
  },
  {
    documentId: "DOC-005",
    fileName: "Vehicle_RC_MH12AB1234.pdf",
    fileSize: 320000,
    fileType: "pdf",
    fileUrl: "/mock/rc.pdf",
    category: "rc",
    uploadedBy: "Fleet Manager",
    uploadedDate: daysAgo(300),
    expiryDate: daysFromNow(-10),
    status: "expired",
    notes: "Renewal pending",
    tags: ["vehicle", "registration"],
    version: 1,
    isVerified: true,
  },
  {
    documentId: "DOC-006",
    fileName: "Fitness_Certificate_TRK001.pdf",
    fileSize: 156000,
    fileType: "pdf",
    fileUrl: "/mock/fitness.pdf",
    category: "fitness",
    uploadedBy: "Fleet Manager",
    uploadedDate: daysAgo(60),
    expiryDate: daysFromNow(90),
    status: "active",
    tags: ["inspection", "passed"],
    version: 1,
    isVerified: true,
  },
  {
    documentId: "DOC-007",
    fileName: "Driver_License_DL001.pdf",
    fileSize: 89000,
    fileType: "pdf",
    fileUrl: "/mock/license.pdf",
    category: "license",
    uploadedBy: "HR",
    uploadedDate: daysAgo(45),
    expiryDate: daysFromNow(500),
    status: "active",
    notes: "Commercial driving license",
    tags: ["driver", "commercial"],
    version: 1,
    isVerified: true,
  },
  {
    documentId: "DOC-008",
    fileName: "LR_Consignment_LD-003.pdf",
    fileSize: 145000,
    fileType: "pdf",
    fileUrl: "/mock/lr.pdf",
    category: "lr",
    loadId: "LD-003",
    uploadedBy: "Operations",
    uploadedDate: daysAgo(3),
    status: "active",
    tags: ["consignment", "transport"],
    version: 1,
    isVerified: true,
  },
  {
    documentId: "DOC-009",
    fileName: "Eway_Bill_LD-004.pdf",
    fileSize: 78000,
    fileType: "pdf",
    fileUrl: "/mock/eway.pdf",
    category: "eway_bill",
    loadId: "LD-004",
    uploadedBy: "System",
    uploadedDate: daysAgo(7),
    expiryDate: daysFromNow(25),
    status: "expiring_soon",
    tags: ["GST", "compliance"],
    version: 1,
    isVerified: true,
  },
  {
    documentId: "DOC-010",
    fileName: "Weight_Slip_LD-001.pdf",
    fileSize: 45000,
    fileType: "pdf",
    fileUrl: "/mock/weight.pdf",
    category: "weight_slip",
    loadId: "LD-001",
    uploadedBy: "Warehouse",
    uploadedDate: daysAgo(2),
    status: "active",
    notes: "Total weight: 18,500 kg",
    tags: ["weight", "verified"],
    version: 1,
    isVerified: true,
  },
  {
    documentId: "DOC-011",
    fileName: "Loading_Photos_LD-002.jpg",
    fileSize: 2400000,
    fileType: "image",
    fileUrl: "/mock/loading.jpg",
    category: "photos",
    loadId: "LD-002",
    uploadedBy: "Driver",
    uploadedDate: daysAgo(1),
    status: "active",
    notes: "Cargo properly secured",
    tags: ["loading", "inspection"],
    version: 1,
    isVerified: false,
  },
  {
    documentId: "DOC-012",
    fileName: "Vehicle_Insurance_TRK002.pdf",
    fileSize: 380000,
    fileType: "pdf",
    fileUrl: "/mock/vehicle_insurance.pdf",
    category: "insurance",
    uploadedBy: "Fleet Manager",
    uploadedDate: daysAgo(120),
    expiryDate: daysFromNow(8),
    status: "expiring_soon",
    notes: "Comprehensive coverage",
    tags: ["vehicle", "coverage"],
    version: 1,
    isVerified: true,
  },
  {
    documentId: "DOC-013",
    fileName: "POD_Load_LD-005.pdf",
    fileSize: 267000,
    fileType: "pdf",
    fileUrl: "/mock/pod2.pdf",
    category: "pod",
    loadId: "LD-005",
    uploadedBy: "Driver",
    uploadedDate: daysAgo(10),
    status: "active",
    notes: "Partial delivery - remainder scheduled",
    tags: ["partial", "delivery"],
    version: 1,
    isVerified: true,
  },
  {
    documentId: "DOC-014",
    fileName: "Delivery_Photos_LD-001.jpg",
    fileSize: 1800000,
    fileType: "image",
    fileUrl: "/mock/delivery.jpg",
    category: "photos",
    loadId: "LD-001",
    uploadedBy: "Driver",
    uploadedDate: daysAgo(2),
    status: "active",
    tags: ["delivery", "condition"],
    version: 1,
    isVerified: true,
  },
  {
    documentId: "DOC-015",
    fileName: "Invoice_April_2024.pdf",
    fileSize: 142000,
    fileType: "pdf",
    fileUrl: "/mock/invoice2.pdf",
    category: "invoice",
    uploadedBy: "Finance Team",
    uploadedDate: daysAgo(20),
    status: "active",
    notes: "Includes fuel surcharge",
    tags: ["billing", "april"],
    version: 1,
    isVerified: true,
  },
];

interface DocumentVaultContextType {
  documents: VaultDocument[];
  templates: DocumentTemplate[];
  uploadDocument: (doc: Omit<VaultDocument, "documentId" | "status" | "version" | "uploadedDate">) => VaultDocument;
  updateDocument: (docId: string, updates: Partial<VaultDocument>) => void;
  deleteDocument: (docId: string) => void;
  verifyDocument: (docId: string) => void;
  replaceDocument: (docId: string, newFile: { fileName: string; fileSize: number; fileType: "pdf" | "image" }) => void;
  getDocumentById: (docId: string) => VaultDocument | undefined;
  getDocumentsByLoad: (loadId: string) => VaultDocument[];
  getExpiringDocuments: () => VaultDocument[];
  getExpiredDocuments: () => VaultDocument[];
  searchDocuments: (query: string) => VaultDocument[];
}

const DocumentVaultContext = createContext<DocumentVaultContextType | null>(null);

export function DocumentVaultProvider({ children }: { children: ReactNode }) {
  const [documents, setDocuments] = useState<VaultDocument[]>([]);
  const { addNotification } = useMockData();

  const uploadDocument = useCallback((
    docData: Omit<VaultDocument, "documentId" | "status" | "version" | "uploadedDate">
  ): VaultDocument => {
    const newDoc: VaultDocument = {
      ...docData,
      documentId: generateId("DOC"),
      status: calculateStatus(docData.expiryDate),
      version: 1,
      uploadedDate: new Date(),
    };

    setDocuments(prev => [newDoc, ...prev]);

    addNotification({
      title: "Document Uploaded",
      message: `${newDoc.fileName} has been added to your vault`,
      type: "document",
      loadId: newDoc.loadId,
    });

    return newDoc;
  }, [addNotification]);

  const updateDocument = useCallback((docId: string, updates: Partial<VaultDocument>) => {
    setDocuments(prev => prev.map(doc => {
      if (doc.documentId === docId) {
        const updated = { ...doc, ...updates };
        if (updates.expiryDate !== undefined) {
          updated.status = calculateStatus(updates.expiryDate);
        }
        return updated;
      }
      return doc;
    }));
  }, []);

  const deleteDocument = useCallback((docId: string) => {
    setDocuments(prev => prev.filter(doc => doc.documentId !== docId));
  }, []);

  const verifyDocument = useCallback((docId: string) => {
    setDocuments(prev => prev.map(doc => 
      doc.documentId === docId ? { ...doc, isVerified: true } : doc
    ));
  }, []);

  const replaceDocument = useCallback((
    docId: string, 
    newFile: { fileName: string; fileSize: number; fileType: "pdf" | "image" }
  ) => {
    setDocuments(prev => prev.map(doc => {
      if (doc.documentId === docId) {
        return {
          ...doc,
          ...newFile,
          fileUrl: `/mock/${doc.category}.${newFile.fileType === "pdf" ? "pdf" : "jpg"}`,
          version: doc.version + 1,
          uploadedDate: new Date(),
          previousVersions: [
            ...(doc.previousVersions || []),
            { version: doc.version, uploadedDate: doc.uploadedDate, fileName: doc.fileName },
          ],
        };
      }
      return doc;
    }));
  }, []);

  const getDocumentById = useCallback((docId: string) => {
    return documents.find(doc => doc.documentId === docId);
  }, [documents]);

  const getDocumentsByLoad = useCallback((loadId: string) => {
    return documents.filter(doc => doc.loadId === loadId);
  }, [documents]);

  const getExpiringDocuments = useCallback(() => {
    return documents.filter(doc => doc.status === "expiring_soon");
  }, [documents]);

  const getExpiredDocuments = useCallback(() => {
    return documents.filter(doc => doc.status === "expired");
  }, [documents]);

  const searchDocuments = useCallback((query: string) => {
    const q = query.toLowerCase();
    return documents.filter(doc => 
      doc.fileName.toLowerCase().includes(q) ||
      doc.loadId?.toLowerCase().includes(q) ||
      doc.category.toLowerCase().includes(q) ||
      doc.tags.some(tag => tag.toLowerCase().includes(q)) ||
      doc.notes?.toLowerCase().includes(q)
    );
  }, [documents]);

  return (
    <DocumentVaultContext.Provider value={{
      documents,
      templates: documentTemplates,
      uploadDocument,
      updateDocument,
      deleteDocument,
      verifyDocument,
      replaceDocument,
      getDocumentById,
      getDocumentsByLoad,
      getExpiringDocuments,
      getExpiredDocuments,
      searchDocuments,
    }}>
      {children}
    </DocumentVaultContext.Provider>
  );
}

export function useDocumentVault() {
  const context = useContext(DocumentVaultContext);
  if (!context) {
    throw new Error("useDocumentVault must be used within DocumentVaultProvider");
  }
  return context;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", { 
    month: "short", 
    day: "numeric", 
    year: "numeric" 
  });
}

export function getDaysUntilExpiry(date?: Date): number | null {
  if (!date) return null;
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}
