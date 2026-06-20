"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

export interface Station {
  id: string;
  name: string;
}

interface StationContextValue {
  stations: Station[];
  selectedStation: Station | null;
  setSelectedStation: (s: Station | null) => void;
  stationParam: string | null; // the ?stationId= value to append to API calls
  loading: boolean;
}

const StationContext = createContext<StationContextValue>({
  stations: [],
  selectedStation: null,
  setSelectedStation: () => {},
  stationParam: null,
  loading: true,
});

export function StationProvider({ children }: { children: ReactNode }) {
  const [stations, setStations] = useState<Station[]>([]);
  const [selectedStation, setSelectedStationState] = useState<Station | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore last-selected station from localStorage. The DC oversees every
    // station, so the default (no saved selection) is "All Stations" (null).
    const saved = localStorage.getItem("dc_selected_station");
    fetch("/api/stations", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        const list: Station[] = d.stations || [];
        setStations(list);
        if (saved && saved !== "__all__") {
          const found = list.find((s) => s.id === saved);
          if (found) setSelectedStationState(found);
        }
        // Otherwise leave selectedStation as null → all stations.
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function setSelectedStation(s: Station | null) {
    setSelectedStationState(s);
    // Persist the explicit "All Stations" choice so it survives reloads.
    localStorage.setItem("dc_selected_station", s ? s.id : "__all__");
  }

  return (
    <StationContext.Provider
      value={{
        stations,
        selectedStation,
        setSelectedStation,
        stationParam: selectedStation?.id ?? null,
        loading,
      }}
    >
      {children}
    </StationContext.Provider>
  );
}

export function useStation() {
  return useContext(StationContext);
}
