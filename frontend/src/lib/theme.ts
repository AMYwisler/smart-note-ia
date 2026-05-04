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

// Reduced palette: 6 categories only
export const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Devis:         { bg: "#E0F2FE", text: "#075985", border: "#7DD3FC" },
  Travaux:       { bg: "#FFEDD5", text: "#9A3412", border: "#FDBA74" },
  Personnel:     { bg: "#ECFCCB", text: "#3F6212", border: "#BEF264" },
  Administratif: { bg: "#F1F5F9", text: "#334155", border: "#CBD5E1" },
  Urgent:        { bg: "#FEE2E2", text: "#991B1B", border: "#FCA5A5" },
  Divers:        { bg: "#F5F3FF", text: "#5B21B6", border: "#DDD6FE" },
};

// Ionicons name per category for visual identification
export const CATEGORY_ICONS: Record<string, string> = {
  Devis: "document-text",
  Travaux: "construct",
  Personnel: "person",
  Administratif: "folder",
  Urgent: "alert-circle",
  Divers: "ellipsis-horizontal-circle",
};

export const ALL_CATEGORIES = [
  "Devis", "Travaux", "Personnel", "Administratif", "Urgent", "Divers",
];
