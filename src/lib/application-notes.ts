// Anotações da equipe por candidatura (tabela application_notes).
import { z } from "zod";

export const NOTE_COLUMNS = "id, body, authorId, authorName, createdAt, updatedAt";
export const NOTE_MAX_LENGTH = 5000;

export const noteBodySchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Escreva a anotação.")
    .max(NOTE_MAX_LENGTH, "Máximo de 5.000 caracteres."),
});

export interface ApplicationNote {
  id: string;
  body: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  updatedAt: string;
}
