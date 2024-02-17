SOLANA_VERSION="${1:-1.18.1}"
ROOT_DIR="./"

log="setup_script_log.out"
touch "$log"

function download_solana(){
    $SHELL -c "$(curl -sSfL https://release.solana.com/v$SOLANA_VERSION/install)"
}

function prepare_solana_path(){
    cd 
    ROOT_DIR="$(pwd)"
    sol_path="$ROOT_DIR/.local/share/solana/install/active_release/bin:\$PATH"
    cd - &>$log
    echo "$sol_path"
}

sol_path=$(prepare_solana_path)
echo "appending '$sol_path' to shell profile " &>$log

case "$SHELL" in
   "/bin/zsh") profile_file="$root_dir/.zprofile"
      ;;
   "bin/bash") profile_file="$root_dir/.bash_profile"
      ;;
#    <shell_path>)
#       ;;
   *)
    #  Default condition to be executed
     ;;
esac

echo "$sol_path" >> ~/$profile_file
solana --version $>$log


# export PATH="/Users/cemtunaboylu/.local/share/solana/install/active_release/bin:$PATH" to /Users/cemtunaboylu/.bash_profile
