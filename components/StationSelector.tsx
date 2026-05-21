"use client";

import { useStation } from "@/context/StationContext";
import { Building2, ChevronDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function StationSelector() {
  const { stations, selectedStation, setSelectedStation, loading } =
    useStation();

  if (loading || stations.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <Building2 size={14} className="text-amber-600 shrink-0" />
      <span className="text-xs font-medium text-gray-500 hidden sm:block">
        Viewing station:
      </span>
      <Select
        value={selectedStation?.id ?? ""}
        onValueChange={(id) => {
          const station = stations.find((s) => s.id === id) ?? null;
          setSelectedStation(station);
        }}
      >
        <SelectTrigger className="h-8 text-xs border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 w-48 focus:ring-amber-400">
          <SelectValue placeholder="Select station" />
        </SelectTrigger>
        <SelectContent>
          {stations.map((s) => (
            <SelectItem key={s.id} value={s.id} className="text-xs">
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
