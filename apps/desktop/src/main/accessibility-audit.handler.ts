import {
  accessibilityAuditIpcReplyErrorSchema,
  accessibilityAuditIpcReplySuccessSchema,
  accessibilityAuditIpcUtilityToMainSchema,
} from "@adt/types";
import {
  audit,
  close as closeAccessibilityAuditWindows,
} from "./accessibility-audit";

/*
    The child (API) process cannot access Electron APIs directly,
    so the main process handles accessibility audit operations on its behalf via IPC messaging.
*/
export function handleAccessibilityAuditMessages(
  apiProcess: Electron.UtilityProcess,
) {
  return async (msg: unknown) => {
    const parsed = accessibilityAuditIpcUtilityToMainSchema.safeParse(msg);
    if (!parsed.success) {
      // Not an accessibility audit message — let other handlers process it.
      return;
    }

    const m = parsed.data;

    if (m.type === "axe-audit") {
      try {
        const result = await audit({
          filePath: m.filePath,
          ruleIds: m.ruleIds,
          axeSource: m.axeSource,
          viewport: m.viewport,
        });
        apiProcess.postMessage(
          accessibilityAuditIpcReplySuccessSchema.parse({
            type: "axe-audit-reply",
            id: m.id,
            title: result.title,
            violations: result.violations,
            incomplete: result.incomplete,
            passCount: result.passCount,
            inapplicableCount: result.inapplicableCount,
          }),
        );
      } catch (error) {
        apiProcess.postMessage(
          accessibilityAuditIpcReplyErrorSchema.parse({
            type: "axe-audit-reply",
            id: m.id,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      }
      return;
    }

    if (m.type === "axe-audit-close") {
      await closeAccessibilityAuditWindows();
    }
  };
}
