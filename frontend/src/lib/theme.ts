// Shared theme constants (Smart Notes IA)
export const COLORS = {
  bg: "#FFFFFF",
  bg2: "#FAFAFA",
  surface: "#FFFFFF",
  text: "#0A0A0A",
  textSecondary: "#6B7280",
  textTertiary: "#9CA3AF",
  border: "#E5E7EB",
  borderFocus: "#0A0A0A",
  black: "#0A0A0A",
  urgent: "#FF3B30",
  urgentBg: "#FEF2F2",
  urgentBorder: "#FECACA",
  status: {
    todo: "#F3F4F6",
    todoText: "#4B5563",
    in_progress: "#DBEAFE",
    in_progressText: "#1D4ED8",
    done: "#D1FAE5",
    doneText: "#047857",
  },
};

export const STATUS_LABEL: Record<string, string> = {
  todo: "À faire",
  in_progress: "En cours",
  done: "Fait",
};

export const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Devis:         { bg: "#E0F2FE", text: "#075985", border: "#7DD3FC" },
  Finances:      { bg: "#DCFCE7", text: "#166534", border: "#86EFAC" },
  Juridique:     { bg: "#F3E8FF", text: "#6B21A8", border: "#C4B5FD" },
  Famille:       { bg: "#FFE4E6", text: "#9F1239", border: "#FDA4AF" },
  Véhicules:     { bg: "#FEF3C7", text: "#92400E", border: "#FCD34D" },
  Travaux:       { bg: "#FFEDD5", text: "#9A3412", border: "#FDBA74" },
  Clients:       { bg: "#DBEAFE", text: "#1E40AF", border: "#93C5FD" },
  Fournisseurs:  { bg: "#E0E7FF", text: "#3730A3", border: "#A5B4FC" },
  Banque:        { bg: "#CCFBF1", text: "#0F766E", border: "#5EEAD4" },
  Administratif: { bg: "#F1F5F9", text: "#334155", border: "#CBD5E1" },
  Santé:         { bg: "#FCE7F3", text: "#9D174D", border: "#F9A8D4" },
  Personnel:     { bg: "#ECFCCB", text: "#3F6212", border: "#BEF264" },
  Urgent:        { bg: "#FEE2E2", text: "#991B1B", border: "#FCA5A5" },
};

// Ionicons name per category for visual identification
export const CATEGORY_ICONS: Record<string, string> = {
  Devis: "document-text",
  Finances: "wallet",
  Juridique: "shield-checkmark",
  Famille: "heart",
  Véhicules: "car",
  Travaux: "construct",
  Clients: "people",
  Fournisseurs: "cube",
  Banque: "card",
  Administratif: "folder",
  Santé: "medkit",
  Personnel: "person",
  Urgent: "alert-circle",
};

export const ALL_CATEGORIES = [
  "Devis", "Finances", "Juridique", "Famille", "Véhicules", "Travaux",
  "Clients", "Fournisseurs", "Banque", "Administratif", "Santé",
  "Personnel", "Urgent",
];
