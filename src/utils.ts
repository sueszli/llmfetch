export function log(...args: any[]) {
    const getCallerLocation = (): string => {
        const stack = new Error().stack;
        if (!stack) return "unknown";

        const lines = stack.split("\n");
        const callerLine = lines[3];
        if (!callerLine) return "unknown";

        // extract function name
        const functionMatch = callerLine.match(/at (?:async )?(\w+)/);
        const functionName = functionMatch?.[1] || "anonymous";

        // extract file path and line number from stack trace
        const pathMatch = callerLine.match(/\((.+):(\d+):(\d+)\)/) || callerLine.match(/at (.+):(\d+):(\d+)/);

        if (pathMatch && pathMatch[1] && pathMatch[2]) {
            const filePath = pathMatch[1];
            const line = pathMatch[2];
            const fileName = filePath.split("/").pop() || "unknown";
            return `${fileName}:${functionName}:${line}`;
        }

        return "unknown";
    };

    const location = getCallerLocation();
    console.log(`[${location}]`, ...args);
}
