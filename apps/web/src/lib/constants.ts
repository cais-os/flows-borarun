import type { RandomizerSplit } from "@/types/node-data";
import { NODE_TYPES } from "@/types/flow";

export const NODE_CONFIG = {
  [NODE_TYPES.TRIGGER]: {
    label: "Trigger",
    color: "#8B5CF6",
    description: "Ponto de entrada do flow",
  },
  [NODE_TYPES.SEND_MESSAGE]: {
    label: "Enviar Mensagem",
    color: "#25D366",
    description: "Envia texto, template, imagem, arquivo ou audio",
  },
  [NODE_TYPES.TAG_CONVERSATION]: {
    label: "Taguear",
    color: "#0EA5E9",
    description: "Adiciona uma tag existente ao cliente atual",
  },
  [NODE_TYPES.RANDOMIZER]: {
    label: "Teste A/B",
    color: "#F97316",
    description: "Divide o trafego aleatoriamente entre caminhos",
  },
  [NODE_TYPES.WAIT_FOR_REPLY]: {
    label: "Capturar Resposta",
    color: "#EC4899",
    description: "Pausa o flow, salva a resposta e segue pela regra que der match",
  },
  [NODE_TYPES.GENERATE_PDF]: {
    label: "Gerar PDF",
    color: "#EF4444",
    description: "Gera um PDF personalizado com IA e envia pelo WhatsApp",
  },
  [NODE_TYPES.WAIT_TIMER]: {
    label: "Temporizador",
    color: "#F59E0B",
    description: "Espera X minutos pela resposta. Segue por 'respondeu' ou 'não respondeu'",
  },
  [NODE_TYPES.FINISH_FLOW]: {
    label: "Finalizar Flow",
    color: "#0F766E",
    description: "Encerra o flow e marca a conversa como finalizada",
  },
  [NODE_TYPES.AI_COLLECTOR]: {
    label: "Coletor IA",
    color: "#6366F1",
    description: "Coleta informacoes estruturadas do usuario com IA",
  },
  [NODE_TYPES.STRAVA_CONNECT]: {
    label: "Conectar Strava",
    color: "#FC4C02",
    description: "Envia o link de conexao do Strava para o usuario",
  },
  [NODE_TYPES.PAYMENT]: {
    label: "Pagamento",
    color: "#00B1EA",
    description: "Envia um link de pagamento do Mercado Pago",
  },
  [NODE_TYPES.WHATSAPP_FLOW]: {
    label: "Formulario WhatsApp",
    color: "#075E54",
    description: "Envia um formulario nativo do WhatsApp e captura as respostas",
  },
} as const;

export const DEFAULT_SPLITS = [
  { id: "split-a", label: "Caminho A", percentage: 25 },
  { id: "split-b", label: "Caminho B", percentage: 25 },
  { id: "split-c", label: "Caminho C", percentage: 25 },
  { id: "split-d", label: "Caminho D", percentage: 25 },
] satisfies RandomizerSplit[];

export function createDefaultSplits(): RandomizerSplit[] {
  return DEFAULT_SPLITS.map((split) => ({ ...split }));
}
