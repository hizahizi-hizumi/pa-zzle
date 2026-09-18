const isLocalDevelopment =
  import.meta.env.DEV && import.meta.env.MODE !== "test";

export const internalDiagnosticsAvailable =
  isLocalDevelopment || __PA_ZZLE_INTERNAL_DIAGNOSTICS__;

export const buildRevision = __PA_ZZLE_BUILD_REVISION__;
