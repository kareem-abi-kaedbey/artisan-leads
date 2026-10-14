import { z } from "zod";

export const LeadSchema = z.object({
  name: z.string().trim().min(2, "Le nom est trop court."),

  email: z
    .string()
    .trim()
    .email("L'adresse email n'est pas valide."),

  phone: z.string().trim().min(6, "Le numéro de téléphone n'est pas valide."),

  location: z.string().trim().min(2, "La localisation est requise."),

  projectType: z.enum([
    "Agencement sur mesure",
    "Meuble / rangement",
    "Cuisine",
    "Autre",
  ]),

  budget: z.enum([
    "Moins de 2 000 €",
    "2 000 € – 5 000 €",
    "5 000 € – 10 000 €",
    "Plus de 10 000 €",
    "Je ne sais pas encore",
  ]),

  description: z
    .string()
    .trim()
    .min(10, "Décrivez un peu plus votre projet.")
    .max(2000, "La description est trop longue."),
});

export type LeadInput = z.infer<typeof LeadSchema>;