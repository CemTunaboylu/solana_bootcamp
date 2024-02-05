const VERBOSE = true

// TODO: change this to appropriate logging mech.
function log(...msg: any[]) {
    if (VERBOSE)
        console.log(msg)
}

export { log };