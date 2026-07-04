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

    const { files, image, isWord, date } = req.body;
    
    // Ensure backward compatibility if a single file is uploaded
    let filesToProcess = [];
    if (files && Array.isArray(files)) {
      filesToProcess = files;
    } else if (image) {
      filesToProcess = [{ image, isWord: !!isWord, name: "upload" }];
    }

    if (filesToProcess.length === 0) {
      return res.status(400).json({ error: "Nessun file o immagine fornita per l'analisi" });
    }

    // Unified system prompt for extracting bookings based on correct beach coordinates
    const systemInstructionPrompt = `
Sei un assistente esperto per la gestione dello stabilimento balneare "Sabbia & Sole". Ti viene fornito il contenuto di tabelle o note relative alle prenotazioni dei lettini per il giorno ${date || "selezionato"}.
La disposizione dei lettini validi dello stabilimento balneare è:
- PEDANA SINISTRA: lettini da 1 a 34
- PEDANA DESTRA: lettini da 60 a 109
Qualsiasi numero di lettino al di fuori di questi intervalli (es. 40, 50, 115) deve essere rigorosamente ignorato, in quanto non esistente.

Analizza attentamente i dati forniti per estrarre TUTTE le prenotazioni dei lettini identificabili:
1. Trova il numero del lettino (deve essere un numero valido tra quelli elencati sopra).
2. Estrai il nome del cliente. Se non è presente alcun nome ma la cella/riga indica chiaramente che è occupata o riservata, usa esattamente "Riservato".
3. Determina se si tratta di un abbonato ("subscriber") o di un cliente giornaliero ("daily"). Cerca parole chiave come "Abbonato", "Abb", "Abbonamento", o scritte analoghe. Se non è specificato, usa "daily" come impostazione predefinita.
4. Determina la fascia oraria (slot): mattina ("morning"), pomeriggio ("afternoon") o giornata intera ("full_day"). Se c'è scritto "Mattina", "M", "Mattino", usa "morning". Se c'è scritto "Pomeriggio", "P", usa "afternoon". Altrimenti, di default, imposta "full_day".

Restituisci l'elenco completo esclusivamente in formato JSON strutturato con lo schema specificato, senza testo o spiegazioni aggiuntive.
`;

    // Response schema configuration for Type safety
    const responseSchemaConfig = {
      type: Type.ARRAY,
      description: "Lista delle prenotazioni rilevate",
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
            description: "Eventuali note aggiuntive",
          },
        },
        required: ["bedNumber", "customerName", "customerType", "slot"],
      },
    };

    let allCombinedBookings: any[] = [];

    // Process all files in parallel for maximum speed and efficiency
    await Promise.all(
      filesToProcess.map(async (fileItem: { image: string; isWord: boolean; name: string }) => {
        try {
          const { image: itemData, isWord: itemIsWord } = fileItem;
          if (!itemData) return;

          // Clean base64 string
          let base64Data = itemData;
          if (itemData.includes(";base64,")) {
            base64Data = itemData.split(";base64,")[1];
          } else if (itemData.includes(",")) {
            base64Data = itemData.split(",")[1];
          }

          if (itemIsWord) {
            // Processing Word document
            const buffer = Buffer.from(base64Data, "base64");
            const result = await mammoth.extractRawText({ buffer });
            const extractedText = result.value;

            if (!extractedText || extractedText.trim() === "") {
              return; // skip empty Word files
            }

            const prompt = `${systemInstructionPrompt}\n\nTesto estratto dal file Word:\n"""\n${extractedText}\n"""`;

            const response = await ai!.models.generateContent({
              model: "gemini-3.5-flash",
              contents: prompt,
              config: {
                responseMimeType: "application/json",
                responseSchema: responseSchemaConfig,
              },
            });

            const parsed = JSON.parse(response.text || "[]");
            if (Array.isArray(parsed)) {
              allCombinedBookings = [...allCombinedBookings, ...parsed];
            }
          } else {
            // Processing Image
            let mimeType = "image/jpeg";
            if (itemData.startsWith("data:")) {
              const match = itemData.match(/^data:([^;]+);base64,/);
              if (match) mimeType = match[1];
            }

            const response = await ai!.models.generateContent({
              model: "gemini-3.5-flash",
              contents: [
                {
                  role: "user",
                  parts: [
                    { text: systemInstructionPrompt },
                    {
                      inlineData: {
                        mimeType,
                        data: base64Data,
                      },
                    },
                  ],
                },
              ],
              config: {
                responseMimeType: "application/json",
                responseSchema: responseSchemaConfig,
              },
            });

            const parsed = JSON.parse(response.text || "[]");
            if (Array.isArray(parsed)) {
              allCombinedBookings = [...allCombinedBookings, ...parsed];
            }
          }
        } catch (fileErr) {
          console.error(`Errore durante l'elaborazione del file ${fileItem.name || 'sconosciuto'}:`, fileErr);
          // Let other files continue processing
        }
      })
    );

    // Deduplicate bookings that might overlap exactly (e.g. same bed and slot across files)
    const uniqueBookingsMap = new Map();
    allCombinedBookings.forEach((b) => {
      if (!b.bedNumber) return;
      const key = `${b.bedNumber}-${b.slot}`;
      uniqueBookingsMap.set(key, b);
    });

    return res.json({ bookings: Array.from(uniqueBookingsMap.values()) });
  } catch (error: any) {
    console.error("Errore complessivo durante l'elaborazione della scansione:", error);
    return res.status(500).json({
      error: "Errore durante l'elaborazione dei file: " + (error.message || error),
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
