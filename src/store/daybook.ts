"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface QuickNote {
  id: string;
  title: string;
  date: string;
  completedAt: string | null;
}

interface Daybook {
  notes: QuickNote[];
  selected: { projectId: string; taskId: string; date: string }[];
  add: (title: string, date: string) => void;
  toggle: (id: string) => void;
  remove: (id: string) => void;
  select: (projectId: string, taskId: string, date: string) => void;
}

export const useDaybook = create<Daybook>()(persist((set) => ({
  notes: [],
  selected: [],
  add: (title, date) => {
    const value = title.trim().slice(0, 200);
    if (!value) return;
    set((s) => ({ notes: [...s.notes, { id: crypto.randomUUID(), title: value, date, completedAt: null }] }));
  },
  toggle: (id) => set((s) => ({ notes: s.notes.map((n) => n.id === id ? { ...n, completedAt: n.completedAt ? null : new Date().toISOString() } : n) })),
  remove: (id) => set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),
  select: (projectId, taskId, date) => set((s) => ({ selected: s.selected.some((t) => t.projectId === projectId && t.taskId === taskId && t.date === date)
    ? s.selected.filter((t) => !(t.projectId === projectId && t.taskId === taskId && t.date === date))
    : [...s.selected, { projectId, taskId, date }] })),
}), { name: "wayline-daybook-v1", skipHydration: true }));
