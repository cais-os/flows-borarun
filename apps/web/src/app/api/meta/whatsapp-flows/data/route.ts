import { NextResponse } from "next/server";
import crypto from "crypto";

// Handle private key in multiple formats: PEM with real newlines, PEM with literal \n, or base64-encoded PEM
function resolvePrivateKey(): string {
  const raw = process.env.WHATSAPP_FLOWS_PRIVATE_KEY || "";
  if (!raw) return "";
  // If it starts with base64 (no -----), decode it
  if (!raw.includes("-----")) {
    try {
      return Buffer.from(raw, "base64").toString("utf-8");
    } catch {
      return raw;
    }
  }
  // Replace literal \n with real newlines
  return raw.replace(/\\n/g, "\n");
}
const PRIVATE_KEY = resolvePrivateKey();

// -- Encryption helpers (Meta WhatsApp Flows data exchange protocol) --
// Reference: https://developers.facebook.com/docs/whatsapp/flows/guides/implementingyourflowendpoint/

function decryptRequest(body: { encrypted_aes_key: string; encrypted_flow_data: string; initial_vector: string }) {
  const { encrypted_aes_key, encrypted_flow_data, initial_vector } = body;

  const decryptedAesKey = crypto.privateDecrypt(
    {
      key: crypto.createPrivateKey(PRIVATE_KEY),
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    Buffer.from(encrypted_aes_key, "base64")
  );

  const flowDataBuffer = Buffer.from(encrypted_flow_data, "base64");
  const initialVectorBuffer = Buffer.from(initial_vector, "base64");

  const TAG_LENGTH = 16;
  const encrypted_flow_data_body = flowDataBuffer.subarray(0, -TAG_LENGTH);
  const encrypted_flow_data_tag = flowDataBuffer.subarray(-TAG_LENGTH);

  const decipher = crypto.createDecipheriv("aes-128-gcm", decryptedAesKey, initialVectorBuffer);
  decipher.setAuthTag(encrypted_flow_data_tag);

  const decryptedJSONString = Buffer.concat([
    decipher.update(encrypted_flow_data_body),
    decipher.final(),
  ]).toString("utf-8");

  return {
    decryptedBody: JSON.parse(decryptedJSONString),
    aesKeyBuffer: decryptedAesKey,
    initialVectorBuffer,
  };
}

function encryptResponse(response: Record<string, unknown>, aesKeyBuffer: Buffer, initialVectorBuffer: Buffer) {
  // Flip the IV bytes (NOT bitwise) as per Meta docs
  const flipped_iv: number[] = [];
  for (const pair of initialVectorBuffer.entries()) {
    flipped_iv.push(~pair[1]);
  }

  const cipher = crypto.createCipheriv("aes-128-gcm", aesKeyBuffer, Buffer.from(flipped_iv));
  return Buffer.concat([
    cipher.update(JSON.stringify(response), "utf-8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]).toString("base64");
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
        screen: "INFO_ADICIONAL",
        data: { ...accumulated, descricao_lesao: "" },
      };
    }

    case "SAUDE_DETALHE":
      return {
        screen: "INFO_ADICIONAL",
        data: {
          ...carry(data),
          descricao_lesao: data.descricao_lesao || "",
        },
      };

    case "INFO_ADICIONAL":
      return {
        screen: "CONFIRMACAO",
        data: {
          ...carry(data),
          info_adicional: data.info_adicional || "",
        },
      };

    default:
      return { screen: "BOAS_VINDAS", data: {} };
  }
}

export async function POST(request: Request) {
  try {
    if (!PRIVATE_KEY) {
      console.error("[whatsapp-flows/data] Missing WHATSAPP_FLOWS_PRIVATE_KEY");
      return NextResponse.json({ error: "Missing WHATSAPP_FLOWS_PRIVATE_KEY" }, { status: 500 });
    }

    const body = await request.json();
    const { decryptedBody, aesKeyBuffer, initialVectorBuffer } = decryptRequest(body);

    console.log("[whatsapp-flows/data] action:", decryptedBody.action, "screen:", decryptedBody.screen);

    // Health check from Meta
    if (decryptedBody.action === "ping") {
      const response = encryptResponse(
        { data: { status: "active" } },
        aesKeyBuffer,
        initialVectorBuffer
      );
      return new NextResponse(response, { headers: { "Content-Type": "text/plain" } });
    }

    const result = getNextScreen(decryptedBody);
    const response = encryptResponse(result, aesKeyBuffer, initialVectorBuffer);

    return new NextResponse(response, { headers: { "Content-Type": "text/plain" } });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const errStack = error instanceof Error ? error.stack : "";
    console.error("[whatsapp-flows/data] error:", errMsg);
    console.error("[whatsapp-flows/data] stack:", errStack);
    console.error("[whatsapp-flows/data] PRIVATE_KEY starts with:", PRIVATE_KEY.substring(0, 30));
    console.error("[whatsapp-flows/data] PRIVATE_KEY length:", PRIVATE_KEY.length);
    // Return 421 to signal decryption failure — Meta will refresh the public key
    return new NextResponse(JSON.stringify({ error: errMsg }), { status: 421, headers: { "Content-Type": "application/json" } });
  }
}
