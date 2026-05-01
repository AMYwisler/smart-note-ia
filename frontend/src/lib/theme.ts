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

export const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  Devis: { bg: "#E0F2FE", text: "#075985" },
  Finances: { bg: "#DCFCE7", text: "#166534" },
  Juridique: { bg: "#F3E8FF", text: "#6B21A8" },
  Famille: { bg: "#FFE4E6", text: "#9F1239" },
  Véhicules: { bg: "#FEF3C7", text: "#92400E" },
  Travaux: { bg: "#FFEDD5", text: "#9A3412" },
  Clients: { bg: "#DBEAFE", text: "#1E40AF" },
  Fournisseurs: { bg: "#E0E7FF", text: "#3730A3" },
  Banque: { bg: "#CCFBF1", text: "#0F766E" },
  Administratif: { bg: "#F1F5F9", text: "#334155" },
  Santé: { bg: "#FCE7F3", text: "#9D174D" },
  Personnel: { bg: "#ECFCCB", text: "#3F6212" },
  Urgent: { bg: "#FEE2E2", text: "#991B1B" },
};

export const ALL_CATEGORIES = [
  "Devis", "Finances", "Juridique", "Famille", "Véhicules", "Travaux",
  "Clients", "Fournisseurs", "Banque", "Administratif", "Santé",
  "Personnel", "Urgent",
];
