"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  RiCloseLine,
  RiAlertLine,
  RiTimeLine,
  RiMapPinLine,
} from "@remixicon/react";
import { cn } from "@/lib/utils";
import {
  api,
  type Player as ApiPlayer,
  type DashboardStats,
  type ConnectionMetrics,
} from "@/lib/api";
import { useSelectedServer } from "@/lib/server-context";

// Transform API player to dashboard player format
interface DashboardPlayer {
  id: string;
  name: string;
  lat: number;
  lng: number;
  severity: string;
  detector: string;
  findings: number;
  lastSeen: string;
  region: string;
}

interface ActivePlayerDot {
  id: string;
  name: string;
  lat: number;
  lng: number;
  lastSeen: string;
}

const severityColors = {
  low: "#3b82f6",
  medium: "#f59e0b",
  high: "#ef4444",
  critical: "#dc2626",
};

// Helper to convert hex color to rgba string
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Helper to format relative time
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
}

// Generate pseudo-random position for globe visualization
function generateGlobePosition(uuid: string): { lat: number; lng: number } {
  // Use uuid to generate deterministic but varied positions
  const hash = hashString(uuid);

  return {
    lat: ((hash % 100) / 100 - 0.5) * Math.PI * 0.9,
    lng: ((hash >> 8) % 628) / 100,
  };
}

// Helper to convert string (including UUID) to numeric hash for animation/rendering
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

// Player Detail Panel
function PlayerDetailPanel({
  player,
  onClose,
}: {
  player: DashboardPlayer;
  onClose: () => void;
}) {
  const color =
    severityColors[player.severity as keyof typeof severityColors] ||
    severityColors.low;

  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-96 animate-fade-in">
      <div className="glass-panel rounded-xl shadow-2xl overflow-hidden backdrop-blur-2xl bg-[#0a0a0f]/80">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: color }}
              />
              <div
                className="absolute inset-0 rounded-full animate-ping opacity-50"
                style={{ backgroundColor: color }}
              />
            </div>
            <span className="text-base font-medium text-white">
              {player.name}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-white/10 transition-colors group"
          >
            <RiCloseLine className="w-5 h-5 text-white/40 group-hover:text-white/80 transition-colors" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          {/* Severity Badge */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-white/40">
              Threat Level
            </span>
            <span
              className="px-2.5 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wide"
              style={{
                color,
                backgroundColor: `${color}15`,
              }}
            >
              {player.severity}
            </span>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/[0.02] rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <RiAlertLine className="w-3.5 h-3.5 text-white/40" />
                <span className="text-[10px] uppercase tracking-wider text-white/40">
                  Findings
                </span>
              </div>
              <p className="text-2xl font-light text-white tabular-nums">
                {player.findings}
              </p>
            </div>
            <div className="bg-white/[0.02] rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <RiTimeLine className="w-3.5 h-3.5 text-white/40" />
                <span className="text-[10px] uppercase tracking-wider text-white/40">
                  Seen
                </span>
              </div>
              <p className="text-sm font-medium text-white/90">
                {player.lastSeen}
              </p>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-3 pt-3 border-t border-white/[0.06]">
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/40">Latest Check</span>
              <span className="text-white/80 font-mono bg-white/[0.03] px-2 py-1 rounded-md">
                {player.detector}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/40">Region</span>
              <span className="text-white/80 flex items-center gap-1.5">
                <RiMapPinLine className="w-3.5 h-3.5 text-white/40" />
                {player.region}
              </span>
            </div>
          </div>

          {/* Action */}
          <Link
            href={`/dashboard/findings?player=${encodeURIComponent(player.name)}`}
            className="group flex items-center justify-center gap-2 w-full py-2.5 mt-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/[0.12] text-white/80 hover:text-white text-xs font-medium transition-all"
          >
            <span>View All Findings</span>
            <span className="text-white/40 group-hover:text-white/60 group-hover:translate-x-0.5 transition-all">
              →
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}

// Animated Globe Component
function AnimatedGlobe({
  players,
  activePlayers,
  onPlayerClick,
}: {
  players: DashboardPlayer[];
  activePlayers: ActivePlayerDot[];
  onPlayerClick: (player: DashboardPlayer) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerPositionsRef = useRef<
    { id: string; x: number; y: number; radius: number; isText?: boolean }[]
  >([]);
  // Persist animation state across data refreshes (players/activePlayers change every refresh)
  const rotationRef = useRef(0);
  const gridPointsRef = useRef<{ lat: number; lng: number }[]>([]);
  const playersRef = useRef(players);
  const activePlayersRef = useRef(activePlayers);

  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  useEffect(() => {
    activePlayersRef.current = activePlayers;
  }, [activePlayers]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      // Reset transform before scaling to prevent compounding on resize
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener("resize", resize);

    // Grid points
    if (gridPointsRef.current.length === 0) {
      const pts: { lat: number; lng: number }[] = [];
      for (let i = 0; i < 100; i++) {
        pts.push({
          lat: (Math.random() - 0.5) * Math.PI * 0.9,
          lng: Math.random() * Math.PI * 2,
        });
      }
      gridPointsRef.current = pts;
    }

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const radius = Math.min(centerX, centerY) * 0.85;
      const time = Date.now() / 1000;
      const rotation = rotationRef.current;

      ctx.clearRect(0, 0, rect.width, rect.height);

      // Blueprint grid background
      ctx.strokeStyle = "rgba(99, 102, 241, 0.03)";
      ctx.lineWidth = 1;
      for (let i = 0; i < rect.width; i += 20) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, rect.height);
        ctx.stroke();
      }
      for (let i = 0; i < rect.height; i += 20) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(rect.width, i);
        ctx.stroke();
      }

      // Globe glow
      const gradient = ctx.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        radius * 1.2
      );
      gradient.addColorStop(0, "rgba(99, 102, 241, 0.1)");
      gradient.addColorStop(0.5, "rgba(99, 102, 241, 0.05)");
      gradient.addColorStop(1, "rgba(99, 102, 241, 0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, rect.width, rect.height);

      // Globe outline
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(99, 102, 241, 0.3)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Inner circle
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 0.3, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(99, 102, 241, 0.15)";
      ctx.stroke();

      // Latitude lines
      for (let i = -2; i <= 2; i++) {
        const lat = (i / 3) * Math.PI * 0.45;
        const y = centerY + Math.sin(lat) * radius;
        const r = Math.cos(lat) * radius;

        ctx.beginPath();
        ctx.ellipse(centerX, y, r, r * 0.25, 0, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(99, 102, 241, 0.1)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Longitude lines
      for (let i = 0; i < 8; i++) {
        const lng = (i / 8) * Math.PI + rotation;
        ctx.beginPath();
        for (let j = 0; j <= 60; j++) {
          const lat = (j / 60 - 0.5) * Math.PI;
          const x = centerX + Math.cos(lat) * Math.sin(lng) * radius;
          const y = centerY + Math.sin(lat) * radius;
          const z = Math.cos(lat) * Math.cos(lng);

          if (z > -0.1) {
            if (j === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
        }
        ctx.strokeStyle = `rgba(99, 102, 241, ${0.05 + Math.abs(Math.cos(lng)) * 0.1})`;
        ctx.stroke();
      }

      // Draw grid points
      gridPointsRef.current.forEach((point) => {
        const x =
          centerX +
          Math.cos(point.lat) * Math.sin(point.lng + rotation) * radius;
        const y = centerY + Math.sin(point.lat) * radius;
        const z = Math.cos(point.lat) * Math.cos(point.lng + rotation);

        if (z > 0) {
          ctx.beginPath();
          ctx.arc(x, y, 1, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(99, 102, 241, ${0.1 + z * 0.2})`;
          ctx.fill();
        }
      });

      // Draw active players (seen but no findings) as subtle gray points
      activePlayersRef.current.forEach((p) => {
        const x =
          centerX + Math.cos(p.lat) * Math.sin(p.lng + rotation) * radius;
        const y = centerY + Math.sin(p.lat) * radius;
        const z = Math.cos(p.lat) * Math.cos(p.lng + rotation);

        if (z > 0) {
          const h = hashString(p.id);
          const pulse = 1.5 + Math.sin(time * 1.25 + h) * 0.35;

          // Soft ring
          ctx.beginPath();
          ctx.arc(x, y, pulse + 2.5, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(180, 180, 180, ${0.06 + z * 0.08})`;
          ctx.lineWidth = 1;
          ctx.stroke();

          // Core dot
          ctx.beginPath();
          ctx.arc(x, y, pulse, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(160, 160, 160, ${0.22 + z * 0.22})`;
          ctx.fill();
        }
      });

      // Draw player points with labels
      const newPlayerPositions: {
        id: string;
        x: number;
        y: number;
        radius: number;
        isText?: boolean;
      }[] = [];

      playersRef.current.forEach((player) => {
        const x =
          centerX +
          Math.cos(player.lat) * Math.sin(player.lng + rotation) * radius;
        const y = centerY + Math.sin(player.lat) * radius;
        const z = Math.cos(player.lat) * Math.cos(player.lng + rotation);

        if (z > 0) {
          const color =
            severityColors[player.severity as keyof typeof severityColors] ||
            severityColors.low;
          // Use hash of player.id (UUID) instead of parseFloat which returns NaN for UUIDs
          const playerHash = hashString(player.id);
          const pulseSize = 4 + Math.sin(time * 3 + playerHash) * 2;

          // Outer pulse ring
          ctx.beginPath();
          ctx.arc(x, y, pulseSize + 8, 0, Math.PI * 2);
          ctx.strokeStyle = hexToRgba(color, 0.2);
          ctx.lineWidth = 1;
          ctx.stroke();

          // Inner pulse ring
          ctx.beginPath();
          ctx.arc(x, y, pulseSize + 4, 0, Math.PI * 2);
          ctx.strokeStyle = hexToRgba(color, 0.4);
          ctx.stroke();

          // Core dot
          ctx.beginPath();
          ctx.arc(x, y, pulseSize, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();

          // Label line and text
          const labelOffset = 60 + (playerHash % 3) * 20;
          const angle = Math.atan2(y - centerY, x - centerX);
          const labelX = x + Math.cos(angle) * labelOffset;
          const labelY = y + Math.sin(angle) * labelOffset;

          // Line from dot to label
          ctx.beginPath();
          ctx.moveTo(
            x + Math.cos(angle) * (pulseSize + 10),
            y + Math.sin(angle) * (pulseSize + 10)
          );
          ctx.lineTo(
            labelX - Math.cos(angle) * 5,
            labelY - Math.sin(angle) * 5
          );
          ctx.strokeStyle = `rgba(255, 255, 255, ${0.2 + z * 0.3})`;
          ctx.lineWidth = 1;
          ctx.stroke();

          // Small connector dot
          ctx.beginPath();
          ctx.arc(labelX, labelY, 2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${0.3 + z * 0.4})`;
          ctx.fill();

          // Player name
          ctx.font = "11px -apple-system, BlinkMacSystemFont, sans-serif";
          ctx.fillStyle = `rgba(255, 255, 255, ${0.5 + z * 0.4})`;
          ctx.textAlign = x > centerX ? "left" : "right";

          const textX = labelX + (x > centerX ? 8 : -8);
          const textY = labelY + 4;
          const textMetrics = ctx.measureText(player.name);
          const textWidth = textMetrics.width;

          ctx.fillText(player.name, textX, textY);

          // Detector tag
          ctx.font = "9px monospace";
          ctx.fillStyle = hexToRgba(color, 0.7);
          ctx.fillText(player.detector, textX, labelY + 16);

          // Store position for click detection (both dot and text)
          newPlayerPositions.push({
            id: player.id,
            x,
            y,
            radius: pulseSize + 15, // Hitbox for dot
          });

          // Add hitbox for text area
          const textHitboxX = x > centerX ? textX : textX - textWidth;
          const textHitboxY = textY - 10;
          newPlayerPositions.push({
            id: player.id,
            x: textHitboxX + textWidth / 2,
            y: textHitboxY + 10,
            radius: Math.max(textWidth / 2 + 10, 20), // Approximate hitbox for text
            isText: true,
          });
        }
      });

      playerPositionsRef.current = newPlayerPositions;

      rotationRef.current = rotation + 0.002;
      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if click is on any player dot
    for (const pos of playerPositionsRef.current) {
      const dist = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2);
      if (dist <= pos.radius) {
        const player = players.find((p) => p.id === pos.id);
        if (player) {
          onPlayerClick(player);
        }
        break;
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if hovering over any player dot
    let isHovering = false;
    for (const pos of playerPositionsRef.current) {
      const dist = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2);
      if (dist <= pos.radius) {
        isHovering = true;
        break;
      }
    }
    canvas.style.cursor = isHovering ? "pointer" : "default";
  };

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ width: "100%", height: "100%" }}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
    />
  );
}

// Stat panel with glass effect
function StatPanel({
  label,
  value,
  suffix,
  trend,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  trend?: string;
}) {
  return (
    <div className="relative p-4 rounded-xl overflow-hidden backdrop-blur-xl bg-white/[0.03] border border-white/[0.08]">
      <div className="relative z-10">
        <p className="text-[10px] uppercase tracking-wider text-indigo-400 mb-1">
          {label}
        </p>
        <p className="text-2xl font-light text-white tabular-nums">
          {value}
          {suffix && (
            <span className="text-sm text-white/50 ml-0.5">{suffix}</span>
          )}
        </p>
        {trend && <p className="text-[10px] text-emerald-400 mt-1">{trend}</p>}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const selectedServerId = useSelectedServer();
  const [mounted, setMounted] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<DashboardPlayer | null>(
    null
  );
  const [players, setPlayers] = useState<DashboardPlayer[]>([]);
  const [activePlayers, setActivePlayers] = useState<ActivePlayerDot[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [connectionMetrics, setConnectionMetrics] =
    useState<ConnectionMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track current server ID to prevent stale responses from updating state
  const currentServerIdRef = useRef<string | null>(null);

  useEffect(() => {
    setMounted(true);

    // If there's no server selected (e.g., server removed), don't get stuck loading
    if (!selectedServerId) {
      currentServerIdRef.current = null;
      setSelectedPlayer(null);
      setPlayers([]);
      setActivePlayers([]);
      setStats(null);
      setConnectionMetrics(null);
      setError(null);
      setLoading(false);
      return;
    }

    // Update ref to current server - used to guard against stale responses
    currentServerIdRef.current = selectedServerId;
    const serverId = selectedServerId;

    // Fetch data from API
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const [playersData, statsData] = await Promise.all([
          api.getPlayers(serverId),
          api.getStats(serverId),
        ]);

        // Guard against stale responses if server changed during fetch
        if (currentServerIdRef.current !== serverId) return;

        // Transform API players to dashboard format
        const dashboardPlayers: DashboardPlayer[] = playersData.players.map(
          (p) => {
            const pos = generateGlobePosition(p.uuid);
            return {
              id: p.uuid,
              name: p.username,
              lat: pos.lat,
              lng: pos.lng,
              severity: p.highest_severity,
              detector: p.detectors[0] || "unknown",
              findings: p.findings_count,
              lastSeen: formatRelativeTime(p.last_seen),
              region: "Global", // Could be enhanced with GeoIP
            };
          }
        );

        setPlayers(dashboardPlayers);
        setActivePlayers(
          playersData.activePlayers.map((p) => {
            const pos = generateGlobePosition(p.uuid);
            return {
              id: p.uuid,
              name: p.username,
              lat: pos.lat,
              lng: pos.lng,
              lastSeen: formatRelativeTime(p.last_seen),
            };
          })
        );
        setStats(statsData);
      } catch (err) {
        // Guard against stale error handling
        if (currentServerIdRef.current !== serverId) return;
        console.error("Failed to fetch dashboard data:", err);
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        // Guard against stale loading state
        if (currentServerIdRef.current === serverId) {
          setLoading(false);
        }
      }
    }

    // Fetch connection status
    async function fetchConnectionStatus() {
      try {
        const metrics = await api.getConnectionStatus(serverId);
        // Guard against stale responses
        if (currentServerIdRef.current !== serverId) return;
        setConnectionMetrics(metrics);
      } catch (err) {
        console.error("Failed to fetch connection status:", err);
      }
    }

    fetchData();
    fetchConnectionStatus();

    // Refresh data every 30 seconds
    const dataInterval = setInterval(fetchData, 30000);
    // Refresh connection status every 5 seconds
    const statusInterval = setInterval(fetchConnectionStatus, 5000);

    return () => {
      clearInterval(dataInterval);
      clearInterval(statusInterval);
    };
  }, [selectedServerId]);

  if (!mounted) return null;

  return (
    <div className="h-screen flex gap-6 -m-6 overflow-hidden">
      {/* Globe Section - Left */}
      <div className="flex-1 relative">
        <AnimatedGlobe
          players={players}
          activePlayers={activePlayers}
          onPlayerClick={setSelectedPlayer}
        />

        {/* Player Detail Panel */}
        {selectedPlayer && (
          <PlayerDetailPanel
            player={selectedPlayer}
            onClose={() => setSelectedPlayer(null)}
          />
        )}

        {/* Overlay HUD elements */}
        <div className="absolute top-6 left-6 right-6 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-medium text-white/90">
                Global Monitor
              </h1>
              <p className="text-xs text-white/40">
                Real-time threat detection
              </p>
            </div>
            <div className="glass-panel px-3 py-1.5 rounded-full">
              <span className="text-[10px] text-emerald-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                LIVE
              </span>
            </div>
          </div>
        </div>

        {/* Loading / Error states */}
        {loading && !stats && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20">
            <div className="text-white/60 text-sm">Loading...</div>
          </div>
        )}

        {error && (
          <div className="absolute bottom-20 left-6 right-6 z-20">
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-xs">
              {error}
            </div>
          </div>
        )}

        {/* Bottom stats bar */}
        <div className="absolute bottom-6 left-6 right-6">
          <div className="grid grid-cols-4 gap-4">
            <StatPanel
              label="Detections"
              value={stats?.total_findings?.toLocaleString() ?? "—"}
              trend={
                stats?.findings_today
                  ? `+${stats.findings_today} today`
                  : undefined
              }
            />
            <StatPanel
              label="Modules"
              value={stats?.active_modules ?? "—"}
              suffix="active"
            />
            <StatPanel
              label="Players"
              value={stats?.players_monitored ?? "—"}
              trend="with findings"
            />
            <StatPanel
              label="Latency"
              value={connectionMetrics?.apiLatencyMs ?? "—"}
              suffix="ms"
            />
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="w-72 flex flex-col gap-3 pt-[52px] pb-6 pr-6">
        {/* Recent Findings - 50% */}
        <div className="glass-panel rounded-xl flex-1 flex flex-col">
          <div className="px-4 py-3 border-b border-white/[0.06]">
            <h2 className="text-sm font-medium text-white/90">
              Recent Findings
            </h2>
          </div>
          <div className="flex-1 overflow-auto divide-y divide-white/[0.04]">
            {players.length === 0 && activePlayers.length === 0 && !loading && (
              <div className="px-4 py-8 text-center text-white/40 text-sm">
                No players yet
              </div>
            )}
            {players.length === 0 && activePlayers.length > 0 && !loading && (
              <div className="divide-y divide-white/[0.04]">
                <div className="px-4 py-3 text-[10px] uppercase tracking-wider text-white/40">
                  Active players (no findings)
                </div>
                {activePlayers.map((p) => (
                  <button
                    key={p.id}
                    onClick={() =>
                      setSelectedPlayer({
                        id: p.id,
                        name: p.name,
                        lat: p.lat,
                        lng: p.lng,
                        severity: "low",
                        detector: "—",
                        findings: 0,
                        lastSeen: p.lastSeen,
                        region: "Global",
                      })
                    }
                    className="w-full px-4 py-3 hover:bg-white/[0.03] transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full flex-shrink-0 bg-white/20" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white/90 truncate">{p.name}</p>
                        <p className="text-[10px] text-white/40">{p.lastSeen}</p>
                      </div>
                      <span className="text-[10px] text-white/30 uppercase">
                        active
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {players.map((player) => (
              <button
                key={player.id}
                onClick={() => setSelectedPlayer(player)}
                className="w-full px-4 py-3 hover:bg-white/[0.03] transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor:
                        severityColors[
                          player.severity as keyof typeof severityColors
                        ] || severityColors.low,
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white/90 truncate">
                      {player.name}
                    </p>
                    <p className="text-[10px] text-white/40 font-mono">
                      {player.detector}
                    </p>
                  </div>
                  <span className="text-[10px] text-white/30 uppercase">
                    {player.severity}
                  </span>
                </div>
              </button>
            ))}
          </div>
          <div className="px-4 py-2.5 border-t border-white/[0.06]">
            <Link
              href="/dashboard/findings"
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              View all →
            </Link>
          </div>
        </div>

        {/* System Status - 50% */}
        <div className="glass-panel rounded-xl flex-1 flex flex-col p-4">
          <h2 className="text-sm font-medium text-white/90 mb-3">
            Connection Status
          </h2>

          <div className="flex-1 space-y-3">
            {/* Latency metrics - now using real data */}
            {(() => {
              const getStatus = (ms: number | null, online?: boolean) => {
                if (ms === null || ms < 0)
                  return online === false ? "offline" : "unknown";
                if (ms < 50) return "excellent";
                if (ms < 150) return "good";
                return "poor";
              };

              const connections = connectionMetrics
                ? [
                    {
                      label: "Dashboard → API",
                      ping: connectionMetrics.apiLatencyMs,
                      status: getStatus(connectionMetrics.apiLatencyMs),
                    },
                    {
                      label: "API → Server",
                      ping: connectionMetrics.serverPingMs,
                      status: getStatus(
                        connectionMetrics.serverPingMs,
                        connectionMetrics.serverReachable
                      ),
                    },
                    {
                      label: "Plugin Status",
                      ping: connectionMetrics.pluginOnline
                        ? Math.min(connectionMetrics.pluginLastSeenMs, 9999)
                        : null,
                      status: connectionMetrics.pluginOnline
                        ? "excellent"
                        : "offline",
                      isLastSeen: true,
                    },
                  ]
                : [
                    { label: "Dashboard → API", ping: null, status: "unknown" },
                    { label: "API → Server", ping: null, status: "unknown" },
                    {
                      label: "Plugin Status",
                      ping: null,
                      status: "unknown",
                      isLastSeen: true,
                    },
                  ];

              return connections.map((conn, i) => (
                <div
                  key={i}
                  className="bg-white/[0.02] rounded-lg p-3 relative"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-white/70">{conn.label}</span>
                    <span
                      className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        conn.status === "excellent"
                          ? "bg-emerald-400"
                          : conn.status === "good"
                            ? "bg-amber-400"
                            : conn.status === "offline" ||
                                conn.status === "unknown"
                              ? "bg-red-400"
                              : "bg-orange-400"
                      )}
                    />
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-medium text-white tabular-nums">
                      {conn.ping !== null && conn.ping >= 0 ? conn.ping : "—"}
                    </span>
                    <span className="text-[10px] text-white/40">
                      {conn.isLastSeen
                        ? conn.ping !== null && conn.ping >= 0
                          ? "ms ago"
                          : ""
                        : "ms"}
                    </span>
                  </div>
                </div>
              ));
            })()}
          </div>

          {/* Overall Status */}
          <div className="pt-3 mt-auto border-t border-white/[0.06]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-white/40">All Systems</span>
              <span
                className={cn(
                  "text-xs",
                  connectionMetrics?.pluginOnline &&
                    connectionMetrics?.serverReachable
                    ? "text-emerald-400"
                    : connectionMetrics?.pluginOnline ||
                        connectionMetrics?.serverReachable
                      ? "text-amber-400"
                      : "text-red-400"
                )}
              >
                {connectionMetrics?.pluginOnline &&
                connectionMetrics?.serverReachable
                  ? "Operational"
                  : connectionMetrics?.pluginOnline ||
                      connectionMetrics?.serverReachable
                    ? "Partial"
                    : "Offline"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
