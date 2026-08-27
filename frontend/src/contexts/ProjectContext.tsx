"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "./AuthContext";

export interface Project {
  id: string;
  code: string;
  name: string;
  currency: string;
  status: string;
}

interface ProjectContextValue {
  projects: Project[];
  currentProject: Project | null;
  setCurrentProjectId: (id: string) => void;
  isLoading: boolean;
}

const ProjectContext = createContext<ProjectContextValue | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [currentProjectId, setCurrentProjectIdState] = useState<string | null>(null);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => (await api.get<Project[]>("/projects")).data,
    enabled: !!user,
  });

  useEffect(() => {
    const stored = window.localStorage.getItem("ccc_project_id");
    if (stored) setCurrentProjectIdState(stored);
  }, []);

  useEffect(() => {
    if (!currentProjectId && projects.length > 0) {
      setCurrentProjectId(projects[0].id);
    }
  }, [projects, currentProjectId]);

  function setCurrentProjectId(id: string) {
    setCurrentProjectIdState(id);
    window.localStorage.setItem("ccc_project_id", id);
  }

  const currentProject = projects.find((p) => p.id === currentProjectId) ?? projects[0] ?? null;

  return (
    <ProjectContext.Provider value={{ projects, currentProject, setCurrentProjectId, isLoading }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProject must be used within ProjectProvider");
  return ctx;
}
