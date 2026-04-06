"use client";

import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, Loader2 } from "lucide-react";

export function SearchInput({
  value,
  onChange,
  onSearch,
  placeholder = "Search...",
  isSearching = false,
  className = "",
}) {
  const [localValue, setLocalValue] = useState(value);

  const handleInputChange = useCallback(
    (e) => {
      const newValue = e.target.value;
      setLocalValue(newValue);
      onChange(newValue);
    },
    [onChange]
  );

  const handleKeyPress = useCallback(
    (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onSearch(localValue);
      }
    },
    [localValue, onSearch]
  );

  const handleClear = useCallback(() => {
    setLocalValue("");
    onChange("");
    onSearch("");
  }, [onChange, onSearch]);

  const handleSearchClick = useCallback(() => {
    onSearch(localValue);
  }, [localValue, onSearch]);

  return (
    <div className={`relative flex items-center ${className}`}>
      <div className="relative flex-1">
        <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
        <Input
          placeholder={placeholder}
          value={localValue}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          className="pl-10 pr-10"
          disabled={isSearching}
        />
        {localValue && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-3 h-4 w-4 text-gray-400 hover:text-gray-600"
            disabled={isSearching}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleSearchClick}
        disabled={isSearching || !localValue.trim()}
        className="ml-2 bg-transparent"
      >
        {isSearching ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Search className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
