import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import mammoth from "mammoth";

dotenv.config();

const app = express();
const PORT = 3000;

// Enable JSON body parsing with higher limit for base64 image transfer
app.use(express.json({ limit: "15mb" }));

// Initialize GoogleGenAI with API key and headers
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// API: Process physical paper sheet or Word document (.docx) using Gemini AI
app.post("/api/scan-table", async (req, res) => {
  try {
    if (!ai) {
      return res.status(500).json({
        error: "Il servizio di intelligenza artificiale (Gemini API) non è configurato. Controlla le impostazioni.",
      });
    }

    const { image, date } = req.body;
    if (!image) {
      return res.status(400).json({ error: "File o immagine mancante" });
    }

    // Detect if the file is a Word document (.docx)
    const isWord = image.startsWith("data:application/vnd.openxmlformats-officedocument.wordprocessingml.document") || 
                   image.startsWith("data:application/msword") ||
                   req.body.fileType === "docx" || 
                   req.body.isWord === true;

    if (isWord) {
      // Clean base64 prefix in a fully robust way
      let base64Data = image;
      if (image.includes(";base64,")) {
        base64Data = image.split(";base64,")[1];
      } else if (image.includes(",")) {
        base64Data = image.split(",")[1];
      }
      
      const buffer = Buffer.from(base64Data, "base64");
      
      // Extract text from docx buffer using mammoth
      const result = await mammoth.extractRawText({ buffer });
      const extractedText = result.value;

      if (!extractedText || extractedText.trim() === "") {
        return res.status(400).json({
          error: "Il file Word caricato è vuoto o non contiene testo leggibile.",
        });
      }

      const prompt = `
Sei un assistente per la gestione di uno stabilimento balneare. Ti viene fornito il testo estratto da un file Word (.docx) contenente le prenotazioni dei lettini per il giorno ${date || "selezionato"}.
Il testo potrebbe contenere elenchi, tabelle, appunti o righe come:
- "Lettino 12: Mario Rossi abbonato"
- "Lettino 15 M: Luca Bianchi" (M = Mattina)
- "34 P - Giuseppe Verdi" (P = Pomeriggio)
- "Abbonato lettino 60 giornata intera"
- "62 - Riservato"

La disposizione dei lettini validi della spiaggia è:
- PEDANA SINISTRA: lettini da 1 a 34
- PEDANA DESTRA: lettini da 60 a 109

Analizza attentamente questo testo ed estrai TUTTE le prenotazioni dei lettini:
1. Trova il numero del lettino (deve essere un numero valido tra quelli elencati sopra).
2. Estrai il nome del cliente. Se non è presente alcun nome ma la riga indica che è occupato/riservato, usa "Riservato".
3. Determina se si tratta di un abbonato ("subscriber") o di un cliente giornaliero ("daily"). Cerca parole come "Abbonato", "Abb", "Abbonamento", o scritte ricorrenti. Di default, se non specificato, usa "daily".
4. Determina la fascia oraria (slot): mattina ("morning"), pomeriggio ("afternoon") o giornata intera ("full_day"). Se c'è scritto "Mattina", "M", "Mattino", usa "morning". Se c'è scritto "Pomeriggio", "P", usa "afternoon". Altrimenti, di default, imposta "full_day".

Testo estratto dal file Word:
"""
${extractedText}
"""

Restituisci l'elenco completo in formato JSON strutturato con lo schema specificato.
`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            description: "Lista delle prenotazioni rilevate nel file Word",
            items: {
              type: Type.OBJECT,
              properties: {
                bedNumber: {
                  type: Type.INTEGER,
                  description: "Il numero del lettino prenotato (es. 12, 60, 104)",
                },
                customerName: {
                  type: Type.STRING,
                  description: "Il nome del cliente scritto sulla cella. Se non c'è nome ma è occupato, usa 'Riservato'",
                },
                customerType: {
                  type: Type.STRING,
                  enum: ["daily", "subscriber"],
                  description: "Tipo di cliente: 'subscriber' per abbonati, 'daily' per clienti giornalieri",
                },
                slot: {
                  type: Type.STRING,
                  enum: ["morning", "afternoon", "full_day"],
                  description: "La fascia oraria prenotata",
                },
                notes: {
                  type: Type.STRING,
                  description: "Eventuali altre note scritte",
                },
              },
              required: ["bedNumber", "customerName", "customerType", "slot"],
            },
          },
        },
      });

      const parsedBookings = JSON.parse(response.text || "[]");
      return res.json({ bookings: parsedBookings });
    }

    // Fallback: Clean base64 string if it contains prefix data:image/...;base64,
    let base64Data = image;
    if (image.includes(";base64,")) {
      base64Data = image.split(";base64,")[1];
    } else if (image.includes(",")) {
      base64Data = image.split(",")[1];
    }

    const prompt = `
Sei un assistente per la gestione di uno stabilimento balneare. Ti viene fornita la foto di un foglio cartaceo o di una tabella quotidiana che rappresenta le prenotazioni dei lettini per il giorno ${date || "selezionato"}.
La tabella fisica segue la disposizione dei lettini della spiaggia:
- PEDANA SINISTRA:
  - Lato sinistro (colonne 1 a 5): lettini 1-5, 11-15, 21-25, 31-34.
  - Lato destro (colonne 6 a 10): lettini 6-10, 16-20, 26-30.
- PEDANA DESTRA:
  - Lato sinistro (colonne 1 a 5): lettini 60-64, 71-75, 82-86, 93-97.
  - Lato destro (colonne 6 a 11): lettini 65-70, 76-81, 87-92, 98-103, 109-104 (il 109 è a sinistra, il 104 è a destra).

Nel foglio cartaceo fornito, l'operatore scrive a mano i nomi dei clienti, fa delle crocette "X", scrive abbreviazioni come "Abb" o "Abbonato", o cerchia/segna i numeri per indicare che sono prenotati.
Analizza l'immagine e identifica TUTTE le prenotazioni scritte a mano o segnate:
1. Trova il numero del lettino (corrispondente alla cella della griglia).
2. Estrai il nome del cliente (se leggibile, altrimenti usa "Riservato" o "Occupato").
3. Determina se si tratta di un abbonato ("subscriber") o di un cliente giornaliero ("daily"). Cerca parole come "Abb", "Abbonato", "Abbonamento" o scritte ricorrenti.
4. Determina la fascia oraria (slot): mattina ("morning"), pomeriggio ("afternoon") o giornata intera ("full_day"). Se c'è scritto "Mattina" o "M", usa "morning". Se c'è scritto "Pomeriggio" o "P", usa "afternoon". Altrimenti, di default, imposta "full_day".

Restituisci l'elenco completo in formato JSON strutturato con lo schema specificato.
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: base64Data,
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          description: "Lista delle prenotazioni rilevate nell'immagine",
          items: {
            type: Type.OBJECT,
            properties: {
              bedNumber: {
                type: Type.INTEGER,
                description: "Il numero del lettino prenotato (es. 1, 15, 62, 104)",
              },
              customerName: {
                type: Type.STRING,
                description: "Il nome del cliente scritto sulla cella. Se non c'è nome ma è occupato, usa 'Riservato'",
              },
              customerType: {
                type: Type.STRING,
                enum: ["daily", "subscriber"],
                description: "Tipo di cliente: 'subscriber' per abbonati, 'daily' per clienti giornalieri",
              },
              slot: {
                type: Type.STRING,
                enum: ["morning", "afternoon", "full_day"],
                description: "La fascia oraria prenotata",
              },
              notes: {
                type: Type.STRING,
                description: "Eventuali altre note scritte a mano (es. 'pagato', 'acconto', '2 lettini')",
              },
            },
            required: ["bedNumber", "customerName", "customerType", "slot"],
          },
        },
      },
    });

    const parsedBookings = JSON.parse(response.text || "[]");
    return res.json({ bookings: parsedBookings });
  } catch (error: any) {
    console.error("Errore durante la scansione della tabella:", error);
    return res.status(500).json({
      error: "Errore durante l'elaborazione dell'immagine o del file: " + (error.message || error),
    });
  }
});

// Configure Vite or serve static production bundle
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
