"use client";

import { use } from "react";
import BuilderPage from "@/components/builder/builder-page";

interface BuilderRouteProps {
  params: Promise<{ id: string }>;
}

export default function BuilderRoute({ params }: BuilderRouteProps) {
  const { id } = use(params);
  return <BuilderPage contractId={id} />;
}
