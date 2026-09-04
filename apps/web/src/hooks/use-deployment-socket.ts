"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { API_URL } from "@/lib/api-client";

export interface LiveLogLine {
  level: string;
  message: string;
  timestamp: string;
}

export interface LiveStatus {
  status: string;
  progressPct: number;
  currentStep: string | null;
}

/** Subscribes to the live log + status stream for a single deployment. */
export function useDeploymentSocket(deploymentId: string | null, initialLogs: LiveLogLine[] = []) {
  const [logs, setLogs] = useState<LiveLogLine[]>(initialLogs);
  const [status, setStatus] = useState<LiveStatus | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const seededRef = useRef(false);

  useEffect(() => {
    if (!seededRef.current && initialLogs.length) {
      setLogs(initialLogs);
      seededRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLogs.length]);

  useEffect(() => {
    if (!deploymentId) return;

    const socket = io(`${API_URL}/deployments`, { transports: ["websocket"], withCredentials: true });
    socketRef.current = socket;

    socket.on("connect", () => socket.emit("subscribe", deploymentId));
    socket.on("log", (line: LiveLogLine) => setLogs((prev) => [...prev, line]));
    socket.on("status", (s: LiveStatus) => setStatus(s));

    return () => {
      socket.emit("unsubscribe", deploymentId);
      socket.disconnect();
    };
  }, [deploymentId]);

  return { logs, status };
}
