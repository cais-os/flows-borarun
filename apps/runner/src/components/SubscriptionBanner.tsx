import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { AlertCircle } from 'lucide-react';

export const SubscriptionBanner = () => {
  const navigate = useNavigate();

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white shadow-lg pt-safe">
      <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">
            Você está sem uma assinatura ativa! Assine para continuar visualizando seu plano.
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => navigate('/subscription')}
          className="flex-shrink-0 bg-white text-amber-600 hover:bg-gray-100 font-semibold"
        >
          Assinar
        </Button>
      </div>
    </div>
  );
};
