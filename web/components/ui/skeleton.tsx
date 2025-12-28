"use client";

import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-white/[0.06]",
        className
      )}
    />
  );
}

// Finding list item skeleton
export function FindingListItemSkeleton() {
  return (
    <div className="w-full flex items-center gap-4 px-5 py-3.5">
      <Skeleton className="w-2 h-2 rounded-full flex-shrink-0" />
      <div className="w-32 flex-shrink-0">
        <Skeleton className="h-4 w-20" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-4 w-16 rounded" />
            <Skeleton className="h-4 w-14 rounded" />
          </div>
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
      <div className="w-24 flex-shrink-0">
        <Skeleton className="h-3 w-16 ml-auto" />
      </div>
      <div className="w-20 flex-shrink-0">
        <Skeleton className="h-3 w-12 ml-auto" />
      </div>
      <div className="w-14 flex-shrink-0">
        <Skeleton className="h-3 w-10 ml-auto" />
      </div>
    </div>
  );
}

// Full findings page loading skeleton
export function FindingsSkeleton() {
  return (
    <div className="h-screen -m-6 flex flex-col relative">
      {/* Header */}
      <div className="p-5 border-b border-white/[0.06]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold text-white">Findings</h1>
            <p className="text-sm text-white/50 mt-0.5">Detection events</p>
          </div>
        </div>

        {/* Search skeleton */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-full max-w-sm rounded-lg" />
          <div className="flex items-center gap-1 p-1 rounded-lg bg-white/[0.02]">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-7 w-14 rounded-md" />
            ))}
          </div>
        </div>
      </div>

      {/* Content skeleton */}
      <div className="flex-1 overflow-y-auto divide-y divide-white/[0.04]">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <FindingListItemSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

// Dashboard-specific skeleton for stat panels
export function StatPanelSkeleton() {
  return (
    <div className="relative p-4 rounded-xl overflow-hidden backdrop-blur-xl bg-white/[0.03] border border-white/[0.08]">
      <div className="relative z-10">
        <Skeleton className="h-3 w-16 mb-2" />
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-3 w-20 mt-2" />
      </div>
    </div>
  );
}

// Skeleton for player list items
export function PlayerListItemSkeleton() {
  return (
    <div className="w-full px-4 py-3">
      <div className="flex items-center gap-3">
        <Skeleton className="w-2 h-2 rounded-full flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <Skeleton className="h-4 w-24 mb-1" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-3 w-12" />
      </div>
    </div>
  );
}

// Skeleton for connection status items
export function ConnectionStatusSkeleton() {
  return (
    <div className="bg-white/[0.02] rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="w-1.5 h-1.5 rounded-full" />
      </div>
      <Skeleton className="h-6 w-12" />
    </div>
  );
}

// Module card skeleton
export function ModuleCardSkeleton() {
  return (
    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
      {/* Status Badge placeholder */}
      <div className="flex justify-end mb-2">
        <Skeleton className="h-5 w-16 rounded-md" />
      </div>

      {/* Icon & Info */}
      <div className="flex items-start gap-3 mb-4">
        <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
        <div className="flex-1">
          <Skeleton className="h-4 w-24 mb-1" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>

      {/* Checks Preview */}
      <div className="flex gap-1 mb-4">
        <Skeleton className="h-4 w-10 rounded" />
        <Skeleton className="h-4 w-12 rounded" />
        <Skeleton className="h-4 w-8 rounded" />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-white/[0.04]">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-4 w-7 rounded-full" />
      </div>
    </div>
  );
}

// Full modules page loading skeleton
export function ModulesSkeleton() {
  return (
    <div className="h-screen -m-6 flex flex-col relative">
      {/* Header */}
      <div className="p-5 border-b border-white/[0.06]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">Modules</h1>
            <p className="text-sm text-white/50 mt-0.5">Manage detection modules</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <ModuleCardSkeleton />
          <ModuleCardSkeleton />
          <ModuleCardSkeleton />
          <ModuleCardSkeleton />
          <ModuleCardSkeleton />
          <ModuleCardSkeleton />
          {/* Add Module Card placeholder */}
          <div className="p-4 rounded-xl border border-dashed border-white/[0.08] flex flex-col items-center justify-center min-h-[180px]">
            <Skeleton className="h-12 w-12 rounded-xl mb-3" />
            <Skeleton className="h-4 w-20 mb-1" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Player card skeleton
export function PlayerCardSkeleton() {
  return (
    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
      {/* Player Header */}
      <div className="flex items-start gap-3 mb-3">
        {/* Avatar */}
        <Skeleton className="w-10 h-10 rounded-lg flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <Skeleton className="h-4 w-24 mb-1" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="w-2 h-2 rounded-full flex-shrink-0" />
      </div>

      {/* Stats Row */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Skeleton className="w-3.5 h-3.5 rounded" />
          <Skeleton className="h-3 w-4" />
        </div>
        <div className="flex items-center gap-1.5">
          <Skeleton className="w-3.5 h-3.5 rounded" />
          <Skeleton className="h-3 w-4" />
        </div>
        <div className="flex-1" />
        <Skeleton className="h-3 w-12" />
      </div>
    </div>
  );
}

// Full players page loading skeleton
export function PlayersSkeleton() {
  return (
    <div className="h-screen -m-6 flex flex-col relative">
      {/* Header */}
      <div className="p-5 border-b border-white/[0.06]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold text-white">Players</h1>
            <p className="text-sm text-white/50 mt-0.5">Player activity and session history</p>
          </div>
          {/* Quick Stats */}
          <div className="flex items-center gap-4">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-full max-w-sm rounded-lg" />
          <div className="flex items-center gap-1 p-1 rounded-lg bg-white/[0.02]">
            <Skeleton className="h-7 w-12 rounded-md" />
            <Skeleton className="h-7 w-14 rounded-md" />
            <Skeleton className="h-7 w-16 rounded-md" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <PlayerCardSkeleton />
          <PlayerCardSkeleton />
          <PlayerCardSkeleton />
          <PlayerCardSkeleton />
          <PlayerCardSkeleton />
          <PlayerCardSkeleton />
          <PlayerCardSkeleton />
          <PlayerCardSkeleton />
        </div>
      </div>
    </div>
  );
}

// Settings page loading skeleton
export function SettingsSkeleton() {
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Settings</h1>
          <p className="text-sm text-white/50 mt-0.5">Configure server preferences and notifications</p>
        </div>
      </div>

      {/* Webhook Section */}
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02]">
        <div className="flex items-start gap-3 p-4 border-b border-white/[0.06]">
          <Skeleton className="h-8 w-8 rounded-md" />
          <div>
            <Skeleton className="h-4 w-16 mb-1" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <Skeleton className="h-3 w-20 mb-1.5" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-3 w-56 mt-1" />
          </div>
          <Skeleton className="h-8 w-28 rounded-md" />
        </div>
      </div>

      {/* Notification Thresholds */}
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02]">
        <div className="flex items-start gap-3 p-4 border-b border-white/[0.06]">
          <Skeleton className="h-8 w-8 rounded-md" />
          <div>
            <Skeleton className="h-4 w-40 mb-1" />
            <Skeleton className="h-3 w-64" />
          </div>
        </div>
        <div className="divide-y divide-white/[0.06]">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-5 w-9 rounded-full" />
            </div>
          ))}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="rounded-lg border border-red-500/20 bg-red-500/5">
        <div className="flex items-start gap-3 p-4 border-b border-red-500/20">
          <Skeleton className="h-8 w-8 rounded-md" />
          <div>
            <Skeleton className="h-4 w-24 mb-1" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-4 w-24 mb-1" />
              <Skeleton className="h-3 w-56" />
            </div>
            <Skeleton className="h-8 w-28 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Full dashboard loading skeleton
export function DashboardSkeleton() {
  return (
    <div className="min-h-screen lg:h-screen flex flex-col lg:flex-row gap-4 lg:gap-6 -m-4 lg:-m-6 overflow-x-hidden">
      {/* Globe Section skeleton */}
      <div className="flex-1 relative h-[50vh] lg:h-auto min-h-[300px]">
        {/* Placeholder for globe with subtle animation */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative w-64 h-64 lg:w-96 lg:h-96">
            {/* Animated circle outline */}
            <div className="absolute inset-0 rounded-full border border-indigo-500/20 animate-pulse" />
            <div className="absolute inset-4 rounded-full border border-indigo-500/10 animate-pulse" style={{ animationDelay: '150ms' }} />
            <div className="absolute inset-8 rounded-full border border-indigo-500/5 animate-pulse" style={{ animationDelay: '300ms' }} />
            {/* Center loading indicator */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-indigo-500/40 animate-ping" />
            </div>
          </div>
        </div>

        {/* Top HUD skeleton */}
        <div className="absolute top-4 left-4 right-4 lg:top-6 lg:left-6 lg:right-6 z-10">
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-5 w-32 mb-1" />
              <Skeleton className="h-3 w-40" />
            </div>
            <Skeleton className="h-6 w-14 rounded-full" />
          </div>
        </div>

        {/* Bottom stats bar skeleton - desktop only */}
        <div className="hidden lg:block absolute bottom-6 left-6 right-6">
          <div className="grid grid-cols-4 gap-4">
            <StatPanelSkeleton />
            <StatPanelSkeleton />
            <StatPanelSkeleton />
            <StatPanelSkeleton />
          </div>
        </div>
      </div>

      {/* Right Panel skeleton */}
      <div className="w-full lg:w-72 flex flex-col gap-3 px-4 pb-4 lg:px-0 lg:pt-[52px] lg:pb-6 lg:pr-6">
        {/* Recent Findings skeleton */}
        <div className="glass-panel rounded-xl flex-1 flex flex-col">
          <div className="px-4 py-3 border-b border-white/[0.06]">
            <Skeleton className="h-4 w-28" />
          </div>
          <div className="flex-1 overflow-auto divide-y divide-white/[0.04]">
            <PlayerListItemSkeleton />
            <PlayerListItemSkeleton />
            <PlayerListItemSkeleton />
            <PlayerListItemSkeleton />
            <PlayerListItemSkeleton />
          </div>
          <div className="px-4 py-2.5 border-t border-white/[0.06]">
            <Skeleton className="h-3 w-16" />
          </div>
        </div>

        {/* Connection Status skeleton */}
        <div className="glass-panel rounded-xl flex-1 flex flex-col p-4">
          <Skeleton className="h-4 w-32 mb-3" />
          <div className="flex-1 space-y-3">
            <ConnectionStatusSkeleton />
            <ConnectionStatusSkeleton />
            <ConnectionStatusSkeleton />
          </div>
          <div className="pt-3 mt-auto border-t border-white/[0.06]">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        </div>

        {/* Mobile stats grid skeleton */}
        <div className="lg:hidden grid grid-cols-2 gap-3">
          <StatPanelSkeleton />
          <StatPanelSkeleton />
          <StatPanelSkeleton />
          <StatPanelSkeleton />
        </div>
      </div>
    </div>
  );
}
