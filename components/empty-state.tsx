"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileX, Search, RefreshCw } from "lucide-react";
interface EmptyStateProps {
  type: String;
  title: String;
  description: String;
  actionLabel?: String;
  onAction?: () => void;
  searchTerm?: String;
}

export function EmptyState({
  type,
  title,
  description,
  actionLabel,
  onAction,
  searchTerm,
}: EmptyStateProps) {
  const getIcon = () => {
    switch (type) {
      case "no-results":
        return <Search className="h-12 w-12 text-gray-400" />;
      case "error":
        return <RefreshCw className="h-12 w-12 text-gray-400" />;
      default:
        return <FileX className="h-12 w-12 text-gray-400" />;
    }
  };

  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        {getIcon()}
        <h3 className="mt-4 text-lg font-semibold text-gray-900">{title}</h3>
        <p className="mt-2 text-sm text-gray-500 text-center max-w-sm">
          {description}
          {searchTerm && (
            <span className="block mt-1 font-medium">
              Search term: "{searchTerm}"
            </span>
          )}
        </p>
        {actionLabel && onAction && (
          <Button
            variant="outline"
            onClick={onAction}
            className="mt-4 bg-transparent"
          >
            {actionLabel}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
