import type { Node, Edge } from '@xyflow/react';

type Strategy = {
  indicator: {
    type: string;
    period: number;
  };
  condition: {
    operator: string;
    value: number;
  };
  action: {
    type: string;
    amount: number;
  };
};

type CompileResult = {
  valid: boolean;
  strategy?: Strategy;
  message: string;
};

// This is a mock compiler. In a real scenario, this would involve
// much more complex logic to parse and validate the flow.
export function compileStrategy(nodes: Node[], edges: Edge[]): CompileResult {
  const indicatorNode = nodes.find((n) => n.type === 'indicator');
  const logicNode = nodes.find((n) => n.type === 'logic');
  const actionNode = nodes.find((n) => n.type === 'action');

  if (!indicatorNode || !logicNode || !actionNode) {
    return {
      valid: false,
      message: 'Hata: Strateji akışı eksik. Lütfen bir İndikatör, bir Mantık ve bir İşlem düğümü ekleyin.',
    };
  }

  const indicatorToLogicEdge = edges.find(
    (e) => e.source === indicatorNode.id && e.target === logicNode.id
  );
  const logicToActionEdge = edges.find(
    (e) => e.source === logicNode.id && e.target === actionNode.id
  );

  if (!indicatorToLogicEdge || !logicToActionEdge) {
    return {
      valid: false,
      message: 'Hata: Düğümler doğru bağlanmamış. Akış şu sırada olmalıdır: İndikatör -> Mantık -> İşlem.',
    };
  }

  try {
    const strategy: Strategy = {
      indicator: {
        type: indicatorNode.data.indicatorType || 'RSI',
        period: Number(indicatorNode.data.period) || 14,
      },
      condition: {
        operator: logicNode.data.operator || 'lt',
        value: Number(logicNode.data.value) || 30,
      },
      action: {
        type: actionNode.data.actionType || 'BUY',
        amount: Number(actionNode.data.amount) || 100,
      },
    };

    return {
      valid: true,
      strategy: strategy,
      message: 'Strateji başarıyla derlendi!',
    };
  } catch (error) {
    return {
        valid: false,
        message: `Derleme sırasında bir hata oluştu: ${(error as Error).message}`,
    }
  }
}
