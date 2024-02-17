set -e 
export logfile="test.log"
export validator_pid=""

function runWithLogging() {
    "$@" >> "$logfile" 2>&1
}

function runWithTee() {
    "$@" 2>&1 | tee -a "$logfile" 
}

function graceful_exit() {
    echo "an unexpected error occured"
    echo "cleaning artifacts"
    kill_artifact_processes
    clean_js_files
    exit 1
}

trap 'graceful_exit' ERR

function compile_test_files(){
    for file in *test.ts; do
        runWithLogging echo "compiling $file" 
        runWithLogging tsc "$file" 
        # runWithLogging tsc "$file" --downlevelIteration # for tests that use a generator 
    done
}

function run_tests() {
    for file in *test.js; do
        runWithTee node "$file"
    done
}

function clean_js_files() {
    rm -f *.js
}

function kill_artifact_processes(){
    kill "$validator_pid" # solana log will kill itself when test-validator dies
}

function start_tests(){
    [ -f "$logfile" ] && rm "$logfile"
    touch "$logfile"

    # first try to compile them
    compile_test_files

    solana config set --url localhost 
    # ensure solana-test_validator is running in the background, run it in parallel and get its pid
    solana-test-validator -r -q > /dev/null 2>&1 & # silence
    validator_pid=$!
    solana logs &
    # ensure solana-test_validator is running in the background 
    ps -fA|grep solana||grep -v "grep"
    sleep 1 # give time to solana-test-validator

    run_tests
    clean_js_files

    kill_artifact_processes

    ps -fA|grep test|grep -v "grep"
}

start_tests