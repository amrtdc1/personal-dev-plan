import type { ReactNode } from "react";

type AsyncStateContainerProps = {
  isLoading: boolean;
  loadingFallback?: ReactNode;
  errorMessage?: string | null;
  errorFallback?: ReactNode;
  isEmpty?: boolean;
  emptyFallback?: ReactNode;
  children: ReactNode;
};

export function AsyncStateContainer({
  isLoading,
  loadingFallback = null,
  errorMessage,
  errorFallback = null,
  isEmpty = false,
  emptyFallback = null,
  children,
}: AsyncStateContainerProps) {
  if (isLoading) {
    return <>{loadingFallback}</>;
  }

  if (errorMessage) {
    return <>{errorFallback}</>;
  }

  if (isEmpty) {
    return <>{emptyFallback}</>;
  }

  return <>{children}</>;
}
