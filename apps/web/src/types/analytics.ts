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

export type FlowAnalyticsLayoutNode = {
  nodeId: string;
  nodeType: string;
  label: string;
  visits: number;
  percentage: number;
  cumulativeDropOff: number;
  position: {
    x: number;
    y: number;
  };
};

export type FlowAnalyticsLayoutEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
};

export type FlowFunnelData = {
  flowName: string;
  totalExecutions: number;
  completed: number;
  abandoned: number;
  nodes: FlowFunnelNode[];
  layoutNodes: FlowAnalyticsLayoutNode[];
  layoutEdges: FlowAnalyticsLayoutEdge[];
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
