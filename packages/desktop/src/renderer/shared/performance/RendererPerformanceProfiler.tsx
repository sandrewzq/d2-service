import { Fragment, Profiler, type ReactNode } from "react";
import {
  isRendererPerformanceDiagnosticsEnabled,
  recordRendererPerformanceCommit
} from "./rendererPerformanceDiagnostics";

export function RendererPerformanceProfiler(props: {
  id: string;
  children: ReactNode;
}) {
  if (!isRendererPerformanceDiagnosticsEnabled()) {
    return <Fragment>{props.children}</Fragment>;
  }

  return (
    <Profiler id={props.id} onRender={recordRendererPerformanceCommit}>
      {props.children}
    </Profiler>
  );
}

