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
  [NODE_TYPES.TEMPLATE_IMAGE]: {
    label: "Template com Imagem",
    color: "#3B82F6",
    description: "Template do WhatsApp com imagem de header",
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
