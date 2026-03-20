export type FlowAnalyticsSummary = {
  flowId: string;
  flowName: string;
  isActive: boolean;
  totalExecutions: number;
  completed: number;
  abandoned: number;
  completionRate: number;
};

export type FlowFunnelNode = {
  nodeId: string;
  nodeType: string;
  label: string;
  visits: number;
  percentage: number;
  dropOff: number;
};

export type FlowFunnelData = {
  totalExecutions: number;
  completed: number;
  abandoned: number;
  nodes: FlowFunnelNode[];
};

export type GeneralAnalytics = {
  conversations: { total: number; new: number };
  subscriptions: {
    active: number;
    expired: number;
    cancelled: number;
    renewed: number;
    notRenewed: number;
  };
  tags: Array<{ name: string; count: number }>;
  messages: {
    total: number;
    fromBot: number;
    fromContact: number;
    fromHuman: number;
  };
};
