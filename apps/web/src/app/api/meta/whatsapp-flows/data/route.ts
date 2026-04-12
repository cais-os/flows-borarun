export const maxDuration = 60;

import { NextResponse } from "next/server";
import {
  decryptFlowRequest,
  encryptFlowResponse,
  resolveWhatsAppFlowsPrivateKey,
} from "@/lib/whatsapp-flow-crypto";

const PRIVATE_KEY = resolveWhatsAppFlowsPrivateKey();

type FlowRequest = {
  version: string;
  action: "ping" | "INIT" | "data_exchange";
  screen?: string;
  data?: Record<string, string>;
  flow_token?: string;
};

function carry(
  data: Record<string, string>,
  defaults: Record<string, string> = {}
): Record<string, string> {
  return { ...defaults, ...data };
}

function getNextScreen(request: FlowRequest): {
  screen: string;
  data: Record<string, unknown>;
} {
  const { action, screen, data = {} } = request;

  if (action === "ping" || action === "INIT") {
    return { screen: "BOAS_VINDAS", data: {} };
  }

  switch (screen) {
    case "BOAS_VINDAS":
      return { screen: "DADOS_BASICOS", data: {} };

    case "DADOS_BASICOS":
      return {
        screen: "EXPERIENCIA",
        data: {
          nome: data.nome || "",
          idade: data.idade || "",
          altura: data.altura || "",
          peso: data.peso || "",
          sexo: data.sexo || "",
        },
      };

    case "EXPERIENCIA": {
      const jaCorre = data.ja_corre || "zero";
      const base = {
        nome: data.nome || "",
        idade: data.idade || "",
        altura: data.altura || "",
        peso: data.peso || "",
        sexo: data.sexo || "",
        ja_corre: jaCorre,
      };

      if (jaCorre === "as_vezes" || jaCorre === "frequente") {
        return { screen: "DETALHES_CORRIDA", data: base };
      }

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
          nome: data.nome || "",
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
          nome: data.nome || "",
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
      return NextResponse.json(
        { error: "Missing WHATSAPP_FLOWS_PRIVATE_KEY" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { decryptedBody, aesKeyBuffer, ivBuffer } = decryptFlowRequest(
      body,
      PRIVATE_KEY
    );

    console.log(
      "[whatsapp-flows/data] action:",
      decryptedBody.action,
      "screen:",
      decryptedBody.screen
    );

    if (decryptedBody.action === "ping") {
      const response = encryptFlowResponse(
        { data: { status: "active" } },
        aesKeyBuffer,
        ivBuffer
      );
      return new NextResponse(response, {
        headers: { "Content-Type": "text/plain" },
      });
    }

    const result = getNextScreen(decryptedBody as FlowRequest);
    const response = encryptFlowResponse(result, aesKeyBuffer, ivBuffer);

    return new NextResponse(response, {
      headers: { "Content-Type": "text/plain" },
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const errStack = error instanceof Error ? error.stack : "";

    console.error("[whatsapp-flows/data] error:", errMsg);
    if (errStack) {
      console.error("[whatsapp-flows/data] stack:", errStack);
    }

    return new NextResponse(JSON.stringify({ error: errMsg }), {
      status: 421,
      headers: { "Content-Type": "application/json" },
    });
  }
}
