import { NextResponse } from "next/server";
import crypto from "crypto";

// Handle both real newlines and literal \n from env var
const PRIVATE_KEY = (process.env.WHATSAPP_FLOWS_PRIVATE_KEY || "").replace(/\\n/g, "\n");

// -- Encryption helpers (Meta WhatsApp Flows data exchange protocol) --

function decryptRequest(body: { encrypted_aes_key: string; encrypted_flow_data: string; initial_vector: string }) {
  const privateKey = crypto.createPrivateKey(PRIVATE_KEY);

  const aesKeyBuffer = crypto.privateDecrypt(
    { key: privateKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
    Buffer.from(body.encrypted_aes_key, "base64")
  );

  const flowDataBuffer = Buffer.from(body.encrypted_flow_data, "base64");
  const ivBuffer = Buffer.from(body.initial_vector, "base64");

  const TAG_LENGTH = 16;
  const encrypted = flowDataBuffer.subarray(0, -TAG_LENGTH);
  const tag = flowDataBuffer.subarray(-TAG_LENGTH);

  const decipher = crypto.createDecipheriv("aes-128-gcm", aesKeyBuffer, ivBuffer);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return { decrypted: JSON.parse(decrypted.toString("utf-8")), aesKey: aesKeyBuffer, iv: ivBuffer };
}

function encryptResponse(response: Record<string, unknown>, aesKey: Buffer, iv: Buffer) {
  const flipped = Buffer.from(iv);
  for (let i = 0; i < flipped.length; i++) flipped[i] = flipped[i] ^ 0xff;

  const cipher = crypto.createCipheriv("aes-128-gcm", aesKey, flipped);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(response), "utf-8"), cipher.final(), cipher.getAuthTag()]);
  return encrypted.toString("base64");
}

// -- Screen routing logic --

type FlowRequest = {
  version: string;
  action: "ping" | "INIT" | "data_exchange";
  screen?: string;
  data?: Record<string, string>;
  flow_token?: string;
};

// Helper to carry all accumulated data forward
function carry(data: Record<string, string>, defaults: Record<string, string> = {}): Record<string, string> {
  return { ...defaults, ...data };
}

function getNextScreen(request: FlowRequest): { screen: string; data: Record<string, unknown> } {
  const { action, screen, data = {} } = request;

  if (action === "ping") {
    return { screen: "BOAS_VINDAS", data: {} };
  }

  if (action === "INIT") {
    return { screen: "BOAS_VINDAS", data: {} };
  }

  switch (screen) {
    case "BOAS_VINDAS":
      return { screen: "DADOS_BASICOS", data: {} };

    case "DADOS_BASICOS":
      return {
        screen: "EXPERIENCIA",
        data: {
          idade: data.idade || "",
          altura: data.altura || "",
          peso: data.peso || "",
          sexo: data.sexo || "",
        },
      };

    case "EXPERIENCIA": {
      const jaCorre = data.ja_corre || "zero";
      const base = {
        idade: data.idade || "",
        altura: data.altura || "",
        peso: data.peso || "",
        sexo: data.sexo || "",
        ja_corre: jaCorre,
      };

      // Runner → show running details
      if (jaCorre === "as_vezes" || jaCorre === "frequente") {
        return { screen: "DETALHES_CORRIDA", data: base };
      }
      // Beginner → skip to other activities
      return {
        screen: "OUTRAS_ATIVIDADES",
        data: {
          ...base,
          vezes_semana: "",
          volume_4_semanas: "",
          maior_distancia: "",
        },
      };
    }

    case "DETALHES_CORRIDA":
      return {
        screen: "VOLUME_CORRIDA",
        data: {
          idade: data.idade || "",
          altura: data.altura || "",
          peso: data.peso || "",
          sexo: data.sexo || "",
          ja_corre: data.ja_corre || "",
          vezes_semana: data.vezes_semana || "",
          maior_distancia: data.maior_distancia || "",
        },
      };

    case "VOLUME_CORRIDA":
      return {
        screen: "OUTRAS_ATIVIDADES",
        data: {
          idade: data.idade || "",
          altura: data.altura || "",
          peso: data.peso || "",
          sexo: data.sexo || "",
          ja_corre: data.ja_corre || "",
          vezes_semana: data.vezes_semana || "",
          maior_distancia: data.maior_distancia || "",
          volume_4_semanas: data.volume_4_semanas || "",
        },
      };

    case "OUTRAS_ATIVIDADES":
      return {
        screen: "OBJETIVO",
        data: {
          ...carry(data),
          outras_atividades: data.outras_atividades || "",
        },
      };

    case "OBJETIVO": {
      const objetivo = data.objetivo || "";
      const accumulated = {
        ...carry(data),
        objetivo,
      };

      if (objetivo === "distancia_x") {
        return { screen: "OBJETIVO_DISTANCIA", data: accumulated };
      }
      if (objetivo === "melhorar_tempo") {
        return { screen: "OBJETIVO_TEMPO", data: accumulated };
      }
      // Other goals → skip to availability
      return {
        screen: "DISPONIBILIDADE",
        data: { ...accumulated, distancia_alvo: "", distancia_tempo: "" },
      };
    }

    case "OBJETIVO_DISTANCIA":
      return {
        screen: "DISPONIBILIDADE",
        data: {
          ...carry(data),
          distancia_alvo: data.distancia_alvo || "",
          distancia_tempo: "",
        },
      };

    case "OBJETIVO_TEMPO":
      return {
        screen: "DISPONIBILIDADE",
        data: {
          ...carry(data),
          distancia_tempo: data.distancia_tempo || "",
          distancia_alvo: "",
        },
      };

    case "DISPONIBILIDADE":
      return {
        screen: "SAUDE",
        data: {
          ...carry(data),
          dias_treino: data.dias_treino || "",
          semanas_plano: data.semanas_plano || "",
        },
      };

    case "SAUDE": {
      const temLesao = data.tem_lesao || "nao";
      const accumulated = { ...carry(data), tem_lesao: temLesao };

      if (temLesao === "sim") {
        return { screen: "SAUDE_DETALHE", data: accumulated };
      }
      return {
        screen: "CONFIRMACAO",
        data: { ...accumulated, descricao_lesao: "" },
      };
    }

    case "SAUDE_DETALHE":
      return {
        screen: "CONFIRMACAO",
        data: {
          ...carry(data),
          descricao_lesao: data.descricao_lesao || "",
        },
      };

    default:
      return { screen: "BOAS_VINDAS", data: {} };
  }
}

export async function POST(request: Request) {
  try {
    if (!PRIVATE_KEY) {
      return NextResponse.json({ error: "Missing WHATSAPP_FLOWS_PRIVATE_KEY" }, { status: 500 });
    }

    const body = await request.json();
    const { decrypted, aesKey, iv } = decryptRequest(body);

    console.log("[whatsapp-flows/data] action:", decrypted.action, "screen:", decrypted.screen);

    // Health check from Meta
    if (decrypted.action === "ping") {
      const response = encryptResponse({ version: decrypted.version, data: { status: "active" } }, aesKey, iv);
      return new NextResponse(response, { headers: { "Content-Type": "text/plain" } });
    }

    const result = getNextScreen(decrypted);
    const response = encryptResponse({ version: decrypted.version, ...result }, aesKey, iv);

    return new NextResponse(response, { headers: { "Content-Type": "text/plain" } });
  } catch (error) {
    console.error("[whatsapp-flows/data] error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
