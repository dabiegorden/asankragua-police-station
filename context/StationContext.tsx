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
    // Restore last-selected station from localStorage
    const saved = localStorage.getItem("dc_selected_station");
    fetch("/api/stations", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        const list: Station[] = d.stations || [];
        setStations(list);
        if (saved) {
          const found = list.find((s) => s.id === saved);
          if (found) setSelectedStationState(found);
          else if (list[0]) setSelectedStationState(list[0]);
        } else if (list[0]) {
          setSelectedStationState(list[0]);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function setSelectedStation(s: Station | null) {
    setSelectedStationState(s);
    if (s) localStorage.setItem("dc_selected_station", s.id);
    else localStorage.removeItem("dc_selected_station");
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
