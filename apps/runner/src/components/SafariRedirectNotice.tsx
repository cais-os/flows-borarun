import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';
import { isSafariDesktop } from '@/lib/utils';

export const SafariRedirectNotice = () => {
  if (!isSafariDesktop()) return null;

  return (
    <Alert className="mb-4">
      <Info className="h-4 w-4" />
      <AlertDescription>
        Você será redirecionado para completar o pagamento. Após finalizar, você retornará automaticamente ao aplicativo.
      </AlertDescription>
    </Alert>
  );
};
