import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { useEffect, type ComponentType } from "react";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  component: ComponentType<any>;
  [key: string]: any;
}

export function ProtectedRoute({ component: Component, ...rest }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation("/access?mode=signin");
    }
  }, [isLoading, isAuthenticated, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F5F3]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#0B2925]" />
          <p className="text-xs font-semibold text-[#755B73]">Verifying session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <Component {...rest} />;
}

export default ProtectedRoute;
