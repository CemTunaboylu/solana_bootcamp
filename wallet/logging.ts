const VERBOSE = true

// TODO: change this to appropriate logging mech.
function log(...msg: any[]) {
    if (VERBOSE)
        console.log(msg)
}

function logWithTrace(trace: string, ...msg: any[]) {
    if (VERBOSE)
        console.log(`[${trace}]-`, msg)
}

export { log, logWithTrace };