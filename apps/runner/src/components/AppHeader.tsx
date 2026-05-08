import { useNavigate } from 'react-router-dom';
import { ChevronLeft, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { track } from '@/lib/analytics';
import { useAuth } from '@/hooks/useAuth';

interface AppHeaderProps {
  title?: string;
  showBackButton?: boolean;
  onBack?: () => void;
  showLogoutButton?: boolean;
  onLogout?: () => void;
}

export const AppHeader = ({ title, showBackButton = false, onBack, showLogoutButton = false, onLogout }: AppHeaderProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleBack = () => {
    track('activity_clicked_back_button', user?.id, {
      metadata: {
        title: title || 'BORARUN',
        has_custom_back_handler: !!onBack
      }
    });

    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  const displayText = title || 'BORARUN';
  const isCustomTitle = !!title;

  return (
    <header className="w-full py-2 px-2 relative" style={{ backgroundColor: '#daf46c' }}>
      <div className="flex items-center justify-between">
        {showBackButton ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            className="text-black hover:text-black/70 hover:bg-primary/20"
          >
            <ChevronLeft style={{ width: '28px', height: '28px' }} strokeWidth={2} />
          </Button>
        ) : showLogoutButton ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={onLogout}
            className="text-black hover:text-black/70 hover:bg-primary/20 h-9 w-9"
          >
            <LogOut style={{ width: '24px', height: '24px' }} strokeWidth={2} />
          </Button>
        ) : null}
        <div className="flex-1 flex justify-center">
          <h1
            className={`text-2xl md:text-4xl font-brand ${isCustomTitle ? 'font-bold' : 'font-black'}`}
            style={{ color: '#000000' }}
          >
            {displayText}
          </h1>
        </div>
        {showBackButton && (
          <div className="w-[48px]" />
        )}
        {showLogoutButton && (
          <div className="w-[40px]" />
        )}
      </div>
    </header>
  );
};
